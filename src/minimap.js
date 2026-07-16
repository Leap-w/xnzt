/**
 * minimap.js — 展厅小地图模块
 *
 * 右上角 Canvas 绘制俯视图，显示展厅布局 + 玩家位置点。
 * 纯 DOM 层，不依赖 Three.js（通过坐标变换适配 3D 世界）。
 *
 * 用法:
 *   const mm = new Minimap(HALL_POSITIONS, BUILDING_BOUNDS);
 *   mm.update(playerX, playerZ, playerYaw);
 */

export class Minimap {
  /**
   * @param {Object<string,[number,number]>} hallPositions
   * @param {{xMin,xMax,zMin,zMax}} bounds  — 世界坐标边界
   */
  constructor(hallPositions, bounds) {
    this._hallPos = hallPositions;
    this._bounds = bounds;
    this._size = 170; // px

    this._createDOM();
  }

  _createDOM() {
    this._canvas = document.createElement('canvas');
    this._canvas.id = 'minimap-canvas';
    this._canvas.width = this._size * 2;
    this._canvas.height = this._size * 2;
    this._canvas.style.width = `${this._size}px`;
    this._canvas.style.height = `${this._size}px`;

    const wrap = document.createElement('div');
    wrap.id = 'minimap-wrap';
    wrap.appendChild(this._canvas);
    document.body.appendChild(wrap);

    this._ctx = this._canvas.getContext('2d');
  }

  /** 每帧更新玩家位置 */
  update(playerX, playerZ, playerYaw) {
    this._playerX = playerX;
    this._playerZ = playerZ;
    this._playerYaw = playerYaw;

    this._draw();
  }

  _draw() {
    const ctx = this._ctx;
    const S = this._size * 2; // 画布实际像素
    const PAD = 14;

    const bx = this._bounds.xMin, bW = this._bounds.xMax - this._bounds.xMin;
    const bz = this._bounds.zMin, bD = this._bounds.zMax - this._bounds.zMin;

    /** 世界 → 画布 */
    const tx = (wx) => PAD + ((wx - bx) / bW) * (S - PAD * 2);
    const ty = (wz) => PAD + ((wz - bz) / bD) * (S - PAD * 2);

    // 清屏
    ctx.clearRect(0, 0, S, S);

    // 背景
    ctx.fillStyle = 'rgba(10, 6, 14, 0.82)';
    ctx.beginPath();
    ctx.roundRect(0, 0, S, S, 10);
    ctx.fill();

    // 边框
    ctx.strokeStyle = 'rgba(201,169,110,0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(0.5, 0.5, S - 1, S - 1, 10);
    ctx.stroke();

    // 展厅色块
    const hallColors = {
      lobby:      'rgba(180,160,140,0.45)',
      peopleHall: 'rgba(200,120,100,0.45)',
      centralHall:'rgba(160,140,100,0.55)',
      ruleHall:   'rgba(120,140,180,0.45)',
      zzuHall:    'rgba(120,160,140,0.45)',
      futureHall: 'rgba(160,120,160,0.45)',
    };

    const hallSize = 5; // 展厅方块半尺寸（画布像素）

    for (const [key, [hx, hz]] of Object.entries(this._hallPos)) {
      const cx2 = tx(hx), cy2 = ty(hz);
      ctx.fillStyle = hallColors[key] || 'rgba(120,120,120,0.4)';
      ctx.fillRect(cx2 - hallSize, cy2 - hallSize, hallSize * 2, hallSize * 2);

      // 展厅标签
      const labels = {
        lobby: '序厅', peopleHall: '人物', centralHall: '中央',
        ruleHall: '制度', zzuHall: '郑大', futureHall: '传承',
      };
      const lb = labels[key] || '';
      ctx.fillStyle = 'rgba(220,200,170,0.9)';
      ctx.font = '8px "Microsoft YaHei","PingFang SC",sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(lb, cx2, cy2);
    }

    // 连接线
    ctx.strokeStyle = 'rgba(201,169,110,0.15)';
    ctx.lineWidth = 0.8;
    const paths = [
      ['lobby','peopleHall'], ['peopleHall','centralHall'],
      ['centralHall','futureHall'], ['centralHall','ruleHall'], ['centralHall','zzuHall'],
    ];
    for (const [a, b] of paths) {
      const pa = this._hallPos[a], pb = this._hallPos[b];
      if (pa && pb) {
        ctx.beginPath();
        ctx.moveTo(tx(pa[0]), ty(pa[1]));
        ctx.lineTo(tx(pb[0]), ty(pb[1]));
        ctx.stroke();
      }
    }

    // 玩家位置点
    if (this._playerX != null) {
      const px = tx(this._playerX);
      const py = ty(this._playerZ);

      // 方向箭头
      const arrowLen = 6;
      const ax = px + Math.sin(this._playerYaw || 0) * arrowLen;
      const ay = py - Math.cos(this._playerYaw || 0) * arrowLen;

      // 光晕
      ctx.fillStyle = 'rgba(201,169,110,0.25)';
      ctx.beginPath();
      ctx.arc(px, py, 5, 0, Math.PI * 2);
      ctx.fill();

      // 点
      ctx.fillStyle = '#c9a96e';
      ctx.beginPath();
      ctx.arc(px, py, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // 方向
      ctx.strokeStyle = '#e0c080';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(ax, ay);
      ctx.stroke();
    }
  }

  setVisible(v) {
    if (this._canvas) {
      this._canvas.parentElement.style.display = v ? 'block' : 'none';
    }
  }

  dispose() {
    if (this._canvas && this._canvas.parentElement) {
      this._canvas.parentElement.remove();
    }
  }
}
