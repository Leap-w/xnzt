/**
 * cinematic.js — 开场动画模块
 *
 * 相机从展厅外 → 序厅 → 中央大厅的平滑飞行动画。
 * 伴有标题 / 副标题字幕的淡入淡出。
 *
 * 用法:
 *   const cinematic = new CinematicIntro(camera, spawnPos, centralPos);
 *   await cinematic.play();  // 返回 Promise，动画完成后 resolve
 */

import * as THREE from 'three';

/** easeInOutCubic */
function ease(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export class CinematicIntro {
  /**
   * @param {THREE.Camera} camera
   * @param {THREE.Vector3} spawnPos      — 序厅出生点
   * @param {THREE.Vector3} centralLookAt — 进入大厅后的注视点
   */
  constructor(camera, spawnPos, centralLookAt) {
    this.camera = camera;
    this._subtitleEl = document.getElementById('cinematic-subtitle');
    this._titleEl = document.getElementById('cinematic-title');

    // 阶段定义
    this._phases = [
      // phase 0: 序厅 → 穿过序厅北门 → 人物馆
      {
        start: new THREE.Vector3(spawnPos.x, spawnPos.y + 0.8, spawnPos.z + 3),
        end:   new THREE.Vector3(spawnPos.x, 1.6, spawnPos.z - 6),
        lookAtStart: new THREE.Vector3(spawnPos.x, 1.4, 0),
        lookAtEnd:   new THREE.Vector3(0, 1.4, 0),
        duration: 3.5,
        title: '廉花郑放 · 赓续清风',
        subtitle: '红色廉洁文化档案展',
      },
      // phase 1: 穿过人物馆 → 中央大厅入口
      {
        start: new THREE.Vector3(0, 1.6, -2),
        end:   centralLookAt ? centralLookAt.clone().add(new THREE.Vector3(0, 2, 4)) : new THREE.Vector3(0, 2.2, 4),
        lookAtStart: new THREE.Vector3(0, 1.4, -4),
        lookAtEnd:   centralLookAt || new THREE.Vector3(0, 1.4, 0),
        duration: 3.0,
        title: '',
        subtitle: '一厅四馆一中心',
      },
    ];

    this._totalDuration = this._phases.reduce((s, p) => s + p.duration, 0);
    this._running = false;
  }

  /**
   * 执行开场动画。
   * @returns {Promise<void>}
   */
  async play() {
    if (this._running) return;
    this._running = true;

    // 禁用控制器移动（动画期间）
    this.camera.position.copy(this._phases[0].start);

    let phaseStartTime = 0;

    for (let pi = 0; pi < this._phases.length; pi++) {
      const phase = this._phases[pi];
      const startTime = performance.now() / 1000;

      // 字幕
      if (this._titleEl) {
        this._titleEl.textContent = phase.title;
        this._titleEl.classList.toggle('visible', !!phase.title);
      }
      if (this._subtitleEl) {
        this._subtitleEl.textContent = phase.subtitle;
        this._subtitleEl.classList.toggle('visible', !!phase.subtitle);
      }

      await this._runPhase(phase, startTime);
      phaseStartTime += phase.duration;
    }

    // 隐藏字幕
    if (this._titleEl) this._titleEl.classList.remove('visible');
    if (this._subtitleEl) this._subtitleEl.classList.remove('visible');

    this._running = false;
  }

  _runPhase(phase, startTime) {
    return new Promise((resolve) => {
      const tick = () => {
        const elapsed = performance.now() / 1000 - startTime;
        const rawT = Math.min(elapsed / phase.duration, 1);
        const t = ease(rawT);

        // 位置插值
        this.camera.position.lerpVectors(phase.start, phase.end, t);

        // 注视点插值
        const lookAt = new THREE.Vector3().lerpVectors(phase.lookAtStart, phase.lookAtEnd, t);
        this.camera.lookAt(lookAt);

        if (rawT >= 1) {
          // 字幕渐隐
          if (this._titleEl) this._titleEl.classList.remove('visible');
          if (this._subtitleEl) this._subtitleEl.classList.remove('visible');
          resolve();
          return;
        }

        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }

  /** 中途取消动画 */
  cancel() {
    this._running = false;
    if (this._titleEl) this._titleEl.classList.remove('visible');
    if (this._subtitleEl) this._subtitleEl.classList.remove('visible');
  }
}
