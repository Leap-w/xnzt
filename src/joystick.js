/**
 * joystick.js — 移动端虚拟摇杆模块
 *
 * 双区触控：
 *   - 左半屏：移动摇杆（前进/后退/左/右）
 *   - 右半屏：视角拖拽（滑动旋转视角）
 *
 * 仅在触屏设备上激活，桌面端不显示。
 *
 * 用法:
 *   const joy = new VirtualJoystick(domElement);
 *   // 每帧读取: joy.moveX, joy.moveY, joy.lookDx, joy.lookDy
 *   // 点击锁定: 由 domElement click 处理
 */

export class VirtualJoystick {
  /**
   * @param {HTMLElement} domElement — 渲染器画布
   */
  constructor(domElement) {
    this.domElement = domElement;
    this.isTouchDevice = false;

    // 输出值（每帧读取后由外部清零）
    this.moveX = 0;   // -1(左) .. +1(右)
    this.moveY = 0;   // -1(后) .. +1(前)  — 注意符号：上=前进为正
    this.lookDx = 0;
    this.lookDy = 0;

    // 移动摇杆
    this._moveActive = false;
    this._moveId = null;
    this._moveBaseX = 0;
    this._moveBaseY = 0;
    this._moveCurX = 0;
    this._moveCurY = 0;
    this._moveRadius = 55; // 摇杆最大偏移 px

    // 视角拖拽
    this._lookActive = false;
    this._lookId = null;
    this._lookPrevX = 0;
    this._lookPrevY = 0;

    this._onTouchStart = this._onTouchStart.bind(this);
    this._onTouchMove = this._onTouchMove.bind(this);
    this._onTouchEnd = this._onTouchEnd.bind(this);

    this._detectAndInit();
  }

  _detectAndInit() {
    // 仅触屏设备启用
    this.isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (!this.isTouchDevice) return;

    document.body.classList.add('touch-device');

    this._createDOM();

    this.domElement.addEventListener('touchstart', this._onTouchStart, { passive: false });
    this.domElement.addEventListener('touchmove', this._onTouchMove, { passive: false });
    this.domElement.addEventListener('touchend', this._onTouchEnd);
    this.domElement.addEventListener('touchcancel', this._onTouchEnd);

    console.log('📱 虚拟摇杆已启用');
  }

  _createDOM() {
    // 移动摇杆底座
    this._moveBaseEl = document.createElement('div');
    this._moveBaseEl.className = 'joystick-base';
    this._moveBaseEl.id = 'joystick-move';

    this._moveThumbEl = document.createElement('div');
    this._moveThumbEl.className = 'joystick-thumb';
    this._moveBaseEl.appendChild(this._moveThumbEl);

    // 视角提示
    this._lookHintEl = document.createElement('div');
    this._lookHintEl.className = 'look-hint';
    this._lookHintEl.textContent = '滑动旋转视角';

    document.body.appendChild(this._moveBaseEl);
    document.body.appendChild(this._lookHintEl);
  }

  // ═══════════════════════════
  //  触控事件
  // ═══════════════════════════

  _onTouchStart(e) {
    const halfW = window.innerWidth / 2;

    for (const t of e.changedTouches) {
      if (t.clientX < halfW) {
        // 左侧 → 移动摇杆
        if (this._moveActive) continue;
        this._moveActive = true;
        this._moveId = t.identifier;
        this._moveBaseX = t.clientX;
        this._moveBaseY = t.clientY;
        this._moveCurX = t.clientX;
        this._moveCurY = t.clientY;

        // 摇杆 UI 定位
        if (this._moveBaseEl) {
          this._moveBaseEl.style.left = `${t.clientX}px`;
          this._moveBaseEl.style.top = `${t.clientY}px`;
          this._moveBaseEl.classList.add('active');
        }

        e.preventDefault();
      } else {
        // 右侧 → 视角拖拽
        if (this._lookActive) continue;
        this._lookActive = true;
        this._lookId = t.identifier;
        this._lookPrevX = t.clientX;
        this._lookPrevY = t.clientY;

        if (this._lookHintEl) {
          this._lookHintEl.style.display = 'none';
        }
      }
    }
  }

  _onTouchMove(e) {
    const halfW = window.innerWidth / 2;

    for (const t of e.changedTouches) {
      if (t.identifier === this._moveId && this._moveActive) {
        this._moveCurX = t.clientX;
        this._moveCurY = t.clientY;

        const dx = t.clientX - this._moveBaseX;
        const dy = t.clientY - this._moveBaseY;
        const dist = Math.min(Math.sqrt(dx * dx + dy * dy), this._moveRadius);
        const angle = Math.atan2(dx, dy);

        const clampedX = Math.sin(angle) * dist;
        const clampedY = Math.cos(angle) * dist;

        // 输出 -1..1
        this.moveX = clampedX / this._moveRadius;
        this.moveY = -clampedY / this._moveRadius; // 上=正

        // 更新摇杆 thumb 位置
        if (this._moveThumbEl) {
          this._moveThumbEl.style.transform = `translate(${clampedX}px, ${clampedY}px)`;
        }

        e.preventDefault();
      }

      if (t.identifier === this._lookId && this._lookActive) {
        this.lookDx = t.clientX - this._lookPrevX;
        this.lookDy = t.clientY - this._lookPrevY;
        this._lookPrevX = t.clientX;
        this._lookPrevY = t.clientY;

        e.preventDefault();
      }
    }
  }

  _onTouchEnd(e) {
    for (const t of e.changedTouches) {
      if (t.identifier === this._moveId) {
        this._moveActive = false;
        this._moveId = null;
        this.moveX = 0;
        this.moveY = 0;

        if (this._moveBaseEl) {
          this._moveBaseEl.classList.remove('active');
          this._moveThumbEl.style.transform = 'translate(0, 0)';
        }
      }

      if (t.identifier === this._lookId) {
        this._lookActive = false;
        this._lookId = null;
        this.lookDx = 0;
        this.lookDy = 0;
      }
    }
  }

  /** 每帧后重置增量值（lookDx/lookDy 是帧增量，需要手动清零） */
  resetFrame() {
    this.lookDx = 0;
    this.lookDy = 0;
  }

  dispose() {
    if (this._moveBaseEl) this._moveBaseEl.remove();
    if (this._lookHintEl) this._lookHintEl.remove();
    this.domElement.removeEventListener('touchstart', this._onTouchStart);
    this.domElement.removeEventListener('touchmove', this._onTouchMove);
    this.domElement.removeEventListener('touchend', this._onTouchEnd);
    this.domElement.removeEventListener('touchcancel', this._onTouchEnd);
  }
}
