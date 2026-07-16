/**
 * interaction.js — 展品交互模块
 *
 * 职责:
 *   - Raycaster 射线检测
 *   - 近距离悬停 → 显示"查看档案"提示 + 光标变化
 *   - 点击 → 触发 onExhibitClick(exhibitId, mesh)
 *   - 交互提示标签（HUD）
 *
 * 设计:
 *   - 可交互物体通过 register(id, mesh) 注册
 *   - 支持检测距离阈值（由外部配置）
 *   - 热路径零 GC
 */

import * as THREE from 'three';

const PROXIMITY_THRESHOLD = 3.5;  // 触发"查看档案"提示的最大距离（米）

export class InteractionManager {
  /**
   * @param {THREE.Camera} camera
   * @param {THREE.Scene} scene
   * @param {HTMLElement} domElement
   */
  constructor(camera, scene, domElement) {
    this.camera = camera;
    this.scene = scene;
    this.domElement = domElement;

    this.raycaster = new THREE.Raycaster();

    // 射线原点偏移（从相机位置向前推一点）
    this._rayOrigin = new THREE.Vector3();
    this._mouse = new THREE.Vector2();

    // 可交互 mesh 列表
    this.interactiveMeshes = [];

    // 状态
    this.hoveredMesh = null;
    this.hoveredExhibitId = null;
    this.isPointerLocked = false;

    // 回调
    /** @type {(exhibitId: string, mesh: THREE.Object3D) => void} */
    this.onExhibitClick = null;
    /** @type {(exhibitId: string, mesh: THREE.Object3D) => void} */
    this.onExhibitHover = null;
    /** @type {() => void} */
    this.onExhibitUnhover = null;

    // 提示 DOM
    this._hintEl = null;
    this._hintVisible = false;

    // 绑定
    this._onClick = this._onClick.bind(this);
    this._onPointerLockChange = this._onPointerLockChange.bind(this);

    this.domElement.addEventListener('click', this._onClick);
    document.addEventListener('pointerlockchange', this._onPointerLockChange);
  }

  // ═══════════════════════════════════
  //  注册
  // ═══════════════════════════════════

  /** 注册可交互 mesh 列表 */
  registerMeshes(meshes) {
    if (Array.isArray(meshes)) {
      this.interactiveMeshes.push(...meshes);
    } else {
      this.interactiveMeshes.push(meshes);
    }
  }

  /** 清空并重新注册 */
  setMeshes(meshes) {
    this.interactiveMeshes = meshes.slice();
  }

  /** 注销 */
  unregister(mesh) {
    const idx = this.interactiveMeshes.indexOf(mesh);
    if (idx !== -1) this.interactiveMeshes.splice(idx, 1);
  }

  // ═══════════════════════════════════
  //  提示 HUD
  // ═══════════════════════════════════

  _ensureHintEl() {
    if (!this._hintEl) {
      this._hintEl = document.createElement('div');
      this._hintEl.id = 'interact-hint';
      this._hintEl.innerHTML = '<span class="hint-dot"></span> 查看档案';
      document.body.appendChild(this._hintEl);
    }
    return this._hintEl;
  }

  _showHint(x, y, exhibitId) {
    this._ensureHintEl();
    this._hintEl.style.left = `${x}px`;
    this._hintEl.style.top = `${y}px`;
    this._hintEl.classList.add('visible');
    this._hintVisible = true;
  }

  _hideHint() {
    if (this._hintEl) {
      this._hintEl.classList.remove('visible');
    }
    this._hintVisible = false;
  }

  // ═══════════════════════════════════
  //  每帧更新
  // ═══════════════════════════════════

  /**
   * @param {number} delta — 帧间隔
   * @param {(mesh: THREE.Object3D) => string|null} idLookup — 从 mesh 获取 exhibitId
   */
  update(delta, idLookup) {
    // 仅在指针锁定后检测（鼠标位置有意义）
    this.isPointerLocked = document.pointerLockElement === this.domElement;

    // 悬停检测始终从屏幕中心进行（第一人称准星）
    this._mouse.set(0, 0);
    this._rayOrigin.copy(this.camera.position);
    this.raycaster.set(this._rayOrigin, this.camera.getWorldDirection(new THREE.Vector3()));

    const hits = this.raycaster.intersectObjects(this.interactiveMeshes, false);

    let foundId = null;
    let foundMesh = null;
    let foundDistance = Infinity;

    if (hits.length > 0 && hits[0].distance < PROXIMITY_THRESHOLD) {
      foundMesh = hits[0].object;
      foundDistance = hits[0].distance;

      // 向上追溯查找有 exhibitId 的父节点
      let current = foundMesh;
      while (current) {
        if (idLookup) {
          const eid = idLookup(current);
          if (eid) {
            foundId = eid;
            break;
          }
        }
        if (current === this.scene) break;
        current = current.parent;
      }
    }

    // ── 状态转换 ──

    if (foundId !== this.hoveredExhibitId) {
      // 离开旧目标
      if (this.hoveredExhibitId && this.onExhibitUnhover) {
        this.onExhibitUnhover();
      }
      this._hideHint();

      // 进入新目标
      if (foundId) {
        this.hoveredExhibitId = foundId;
        this.hoveredMesh = foundMesh;

        if (this.onExhibitHover) {
          this.onExhibitHover(foundId, foundMesh);
        }

        // 定位提示标签在屏幕中心偏上
        const screenX = window.innerWidth / 2;
        const screenY = window.innerHeight / 2 - 60;
        this._showHint(screenX, screenY, foundId);
      } else {
        this.hoveredExhibitId = null;
        this.hoveredMesh = null;
        document.body.style.cursor = this.isPointerLocked ? 'none' : 'default';
      }
    }

    // 持续悬停 → 更新提示位置（跟随准星）
    if (this._hintVisible && foundId) {
      const screenX = window.innerWidth / 2;
      const screenY = window.innerHeight / 2 - 60;
      if (this._hintEl) {
        this._hintEl.style.left = `${screenX}px`;
        this._hintEl.style.top = `${screenY}px`;
      }
    }
  }

  // ═══════════════════════════════════
  //  点击
  // ═══════════════════════════════════

  _onClick(event) {
    if (document.pointerLockElement !== this.domElement) return;

    // 如果弹窗打开中，不触发新的点击
    const overlayOpen = document.getElementById('exhibit-popup-overlay');
    if (overlayOpen && overlayOpen.classList.contains('visible')) return;

    // 从屏幕中心发射射线（与 update 一致）
    this._rayOrigin.copy(this.camera.position);
    this.raycaster.set(this._rayOrigin, this.camera.getWorldDirection(new THREE.Vector3()));

    const hits = this.raycaster.intersectObjects(this.interactiveMeshes, false);

    if (hits.length > 0 && hits[0].distance < PROXIMITY_THRESHOLD) {
      let foundId = null;
      let current = hits[0].object;
      while (current) {
        if (this._findIdInParent) {
          const eid = this._findIdInParent(current);
          if (eid) { foundId = eid; break; }
        }
        if (current === this.scene) break;
        current = current.parent;
      }

      if (foundId && this.onExhibitClick) {
        this.onExhibitClick(foundId, hits[0].object);
      }
    }
  }

  /** 设置 ID 查找函数（由外部根据 mesh 返回 exhibitId） */
  setIdLookup(fn) {
    this._findIdInParent = fn;
  }

  _onPointerLockChange() {
    this.isPointerLocked = document.pointerLockElement === this.domElement;
    if (!this.isPointerLocked) {
      this._hideHint();
    }
  }

  /** 销毁 */
  dispose() {
    this._hideHint();
    if (this._hintEl && this._hintEl.parentNode) {
      this._hintEl.parentNode.removeChild(this._hintEl);
    }
    this.domElement.removeEventListener('click', this._onClick);
    document.removeEventListener('pointerlockchange', this._onPointerLockChange);
    this.interactiveMeshes = [];
  }
}
