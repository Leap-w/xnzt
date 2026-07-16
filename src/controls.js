/**
 * controls.js — 第一人称控制器模块
 *
 * 功能：
 *   - PointerLock 鼠标视角旋转
 *   - WASD 平面移动
 *   - 滚轮 FOV 缩放
 *   - 圆形 vs AABB 碰撞检测 + 沿墙滑动
 *
 * 设计要点：
 *   - update() 热路径中零 new 分配，保证 60 FPS
 *   - 碰撞体在 setCollidables() 中预计算 Box3，不每帧重建
 */
import * as THREE from 'three';

export class FirstPersonController {
  /**
   * @param {THREE.Camera} camera
   * @param {HTMLElement} domElement
   */
  constructor(camera, domElement) {
    this.camera = camera;
    this.domElement = domElement;

    // ── 移动参数 ──
    this.moveSpeed = 5.0;        // m/s
    this.lookSensitivity = 0.002;
    this.playerRadius = 0.4;     // 碰撞半径

    // ── 按键状态 ──
    this.moveForward = false;
    this.moveBackward = false;
    this.moveLeft = false;
    this.moveRight = false;

    // ── 视角 ──
    this.euler = new THREE.Euler(0, 0, 0, 'YXZ');
    this.isLocked = false;

    // ── 滚轮缩放 ──
    this.zoomFov = this.camera.fov;
    this.minFov = 20;
    this.maxFov = 90;

    // ── 外部输入（虚拟摇杆等）──
    this._externalMoveX = 0;
    this._externalMoveY = 0;
    this._externalLookDx = 0;
    this._externalLookDy = 0;

    // ── 碰撞体（{ box: Box3, object: Object3D }[]）──
    this.collidables = [];

    // ── 预分配向量（update 热路径零 GC）──
    this._direction = new THREE.Vector3();
    this._moveVector = new THREE.Vector3();
    this._up = new THREE.Vector3(0, 1, 0);
    this._forwardDelta = new THREE.Vector3();
    this._rightDelta = new THREE.Vector3();

    // ── 绑定 ──
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onWheel = this._onWheel.bind(this);
    this._onPointerLockChange = this._onPointerLockChange.bind(this);

    // ── 事件 ──
    this.domElement.addEventListener('click', () => this.lock());
    document.addEventListener('keydown', this._onKeyDown);
    document.addEventListener('keyup', this._onKeyUp);
    document.addEventListener('mousemove', this._onMouseMove);
    this.domElement.addEventListener('wheel', this._onWheel, { passive: false });
    document.addEventListener('pointerlockchange', this._onPointerLockChange);
  }

  // ══════════════════════════════════════════
  //  公开方法
  // ══════════════════════════════════════════

  /** 注册碰撞物体（传入 Mesh 或 Group 数组） */
  setCollidables(objects) {
    this.collidables = [];
    for (const obj of objects) {
      const box = new THREE.Box3().setFromObject(obj);
      this.collidables.push({ box, object: obj });
    }
  }

  /**
   * 外部移动输入（供虚拟摇杆等调用）
   * @param {number} x  -1..1 左右
   * @param {number} y  -1..1 前后（正=前进）
   */
  setExternalMove(x, y) {
    this._externalMoveX = x;
    this._externalMoveY = y;
  }

  /**
   * 外部视角输入（供虚拟摇杆等调用）
   * @param {number} dx  水平像素增量
   * @param {number} dy  垂直像素增量
   */
  setExternalLook(dx, dy) {
    this._externalLookDx = dx;
    this._externalLookDy = dy;
  }

  lock() {
    this.domElement.requestPointerLock();
  }

  unlock() {
    document.exitPointerLock();
  }

  // ══════════════════════════════════════════
  //  每帧更新
  // ══════════════════════════════════════════

  /**
   * @param {number} delta — 帧间隔（秒），已做 0.1s 上限
   */
  update(delta) {
    // ── 滚轮平滑缩放（锁定时也可用）──
    const fovDelta = this.zoomFov - this.camera.fov;
    if (Math.abs(fovDelta) > 0.01) {
      this.camera.fov += fovDelta * 0.15;
      this.camera.updateProjectionMatrix();
    }

    // ── 外部视角输入（无需锁定）──
    this._applyExternalLook(delta);

    if (!this.isLocked) return;

    // ── 1. 合成输入方向（键盘 + 外部）──
    this._direction.set(0, 0, 0);
    if (this.moveForward) this._direction.z += 1;
    if (this.moveBackward) this._direction.z -= 1;
    if (this.moveLeft) this._direction.x += 1;
    if (this.moveRight) this._direction.x -= 1;

    // 外部输入叠加
    this._direction.x += this._externalMoveX;
    this._direction.z += this._externalMoveY;

    if (this._direction.length() === 0) return;
    this._direction.normalize();

    // ── 2. 相机世界空间朝向（仅 XZ 平面）──
    this.camera.getWorldDirection(this._moveVector);
    this._moveVector.y = 0;
    this._moveVector.normalize();

    // ── 3. 前/后位移 ──
    this._forwardDelta
      .copy(this._moveVector)
      .multiplyScalar(this._direction.z * this.moveSpeed * delta);

    // ── 4. 左/右位移 ──
    this._rightDelta
      .crossVectors(this._moveVector, this._up)
      .normalize()
      .multiplyScalar(-this._direction.x * this.moveSpeed * delta);

    // ── 5. 碰撞解析移动 ──
    this._resolveMovement(
      this._forwardDelta.x + this._rightDelta.x,
      this._forwardDelta.z + this._rightDelta.z,
    );
  }

  /** 移除所有监听 */
  dispose() {
    this.unlock();
    document.removeEventListener('keydown', this._onKeyDown);
    document.removeEventListener('keyup', this._onKeyUp);
    document.removeEventListener('mousemove', this._onMouseMove);
    this.domElement.removeEventListener('wheel', this._onWheel);
    document.removeEventListener('pointerlockchange', this._onPointerLockChange);
  }

  // ══════════════════════════════════════════
  //  内部 — 碰撞
  // ══════════════════════════════════════════

  /**
   * 尝试沿 X/Z 移动，遇墙则沿墙滑动。
   * 策略：全量 → X-only → Z-only，允许贴墙滑行。
   */
  _resolveMovement(dx, dz) {
    const px = this.camera.position.x;
    const pz = this.camera.position.z;
    const nx = px + dx;
    const nz = pz + dz;

    // 全量移动
    if (!this._checkCollision(nx, nz)) {
      this.camera.position.x = nx;
      this.camera.position.z = nz;
      return;
    }

    // X 分量单独尝试
    if (!this._checkCollision(nx, pz)) {
      this.camera.position.x = nx;
    }

    // Z 分量单独尝试
    if (!this._checkCollision(px, nz)) {
      this.camera.position.z = nz;
    }
    // 若两个分量都碰墙 → 原地不动（卡墙角保护）
  }

  /**
   * 圆形（玩家）vs AABB（墙壁）碰撞测试，仅在 XZ 平面。
   * @returns {boolean} true = 碰撞
   */
  _checkCollision(x, z) {
    const r = this.playerRadius;
    const r2 = r * r;

    for (let i = 0; i < this.collidables.length; i++) {
      const b = this.collidables[i].box;

      // 找到 AABB 上离圆心最近的点
      const cx = Math.max(b.min.x, Math.min(x, b.max.x));
      const cz = Math.max(b.min.z, Math.min(z, b.max.z));

      const dx = x - cx;
      const dz = z - cz;

      if (dx * dx + dz * dz < r2) {
        return true;
      }
    }

    return false;
  }

  // ══════════════════════════════════════════
  //  内部 — 输入处理
  // ══════════════════════════════════════════

  _onPointerLockChange() {
    this.isLocked = document.pointerLockElement === this.domElement;
  }

  _onKeyDown(event) {
    switch (event.code) {
      case 'KeyW': this.moveForward = true; break;
      case 'KeyS': this.moveBackward = true; break;
      case 'KeyA': this.moveLeft = true; break;
      case 'KeyD': this.moveRight = true; break;
    }
  }

  _onKeyUp(event) {
    switch (event.code) {
      case 'KeyW': this.moveForward = false; break;
      case 'KeyS': this.moveBackward = false; break;
      case 'KeyA': this.moveLeft = false; break;
      case 'KeyD': this.moveRight = false; break;
    }
  }

  _onWheel(event) {
    event.preventDefault();
    this.zoomFov = Math.max(
      this.minFov,
      Math.min(this.maxFov, this.zoomFov + event.deltaY * 0.05),
    );
  }

  _onMouseMove(event) {
    if (!this.isLocked) return;

    this._applyLookDelta(event.movementX || 0, event.movementY || 0);
  }

  /** 外部视角旋转（供虚拟摇杆） */
  _applyExternalLook(delta) {
    const dx = this._externalLookDx;
    const dy = this._externalLookDy;
    if (dx === 0 && dy === 0) return;

    this._applyLookDelta(dx * 0.6, dy * 0.6);
    // 外部输入不清零 — 由 joystick.resetFrame() 管理
  }

  /** 应用视角旋转增量 */
  _applyLookDelta(dx, dy) {
    if (dx === 0 && dy === 0) return;

    const mx = dx * this.lookSensitivity;
    const my = dy * this.lookSensitivity;

    this.euler.setFromQuaternion(this.camera.quaternion);
    this.euler.y -= mx;
    this.euler.x -= my;

    // 俯仰角钳制
    this.euler.x = Math.max(-Math.PI / 2.3, Math.min(Math.PI / 2.3, this.euler.x));

    this.camera.quaternion.setFromEuler(this.euler);
  }
}
