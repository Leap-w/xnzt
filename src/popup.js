/**
 * popup.js — 展品信息弹窗管理模块
 *
 * 纯 DOM 层，不依赖 Three.js。
 * 根据 JSON 数据渲染结构化内容：
 *   - 标题 / 副标题 / 年代 / 类型徽章
 *   - highlight 金句高亮框
 *   - sections[] 分段标题+正文
 *   - 图片轮播（多图自动显示导航）
 *   - 视频嵌入（iframe 16:9）
 *
 * 用法:
 *   const popup = new PopupManager();
 *   popup.open(exhibitData);
 *   popup.close();
 */

const TYPE_BADGES = {
  person: '👤 人物',
  rule: '📜 制度',
  zzu: '🎓 郑大',
  future: '💎 传承',
};

export class PopupManager {
  constructor() {
    this.isOpen = false;
    this._currentImages = [];
    this._imageIndex = 0;

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onOverlayClick = this._onOverlayClick.bind(this);

    this._createDOM();
  }

  // ═══════════════════════════════════
  //  DOM 构建
  // ═══════════════════════════════════

  _createDOM() {
    this._overlay = document.createElement('div');
    this._overlay.id = 'exhibit-popup-overlay';
    this._overlay.innerHTML = `
      <div class="popup-card" id="popup-card">
        <button class="popup-close" title="关闭 (ESC)">✕</button>

        <div class="popup-header">
          <div class="popup-type-badge" id="popup-badge"></div>
          <h2 class="popup-title" id="popup-title"></h2>
          <div class="popup-subtitle" id="popup-subtitle"></div>
          <div class="popup-year" id="popup-year"></div>
        </div>

        <div class="popup-media" id="popup-media">
          <div class="popup-video-wrap" id="popup-video-wrap" style="display:none">
            <iframe id="popup-video" allowfullscreen></iframe>
          </div>
          <div class="popup-image-wrap" id="popup-image-wrap">
            <img id="popup-image" src="" alt="" />
            <div class="popup-image-nav" id="popup-image-nav" style="display:none">
              <button class="img-nav-btn" id="img-prev">◀</button>
              <span class="img-nav-info" id="img-nav-info"></span>
              <button class="img-nav-btn" id="img-next">▶</button>
            </div>
          </div>
        </div>

        <div class="popup-body" id="popup-body"></div>

        <div class="popup-footer">
          <span class="popup-hint">ESC 关闭  |  点击画面继续漫游</span>
        </div>
      </div>
    `;

    this._overlay.addEventListener('click', this._onOverlayClick);
    document.body.appendChild(this._overlay);

    // 缓存元素引用
    this.el = {
      overlay:  this._overlay,
      badge:    this._overlay.querySelector('#popup-badge'),
      title:    this._overlay.querySelector('#popup-title'),
      subtitle: this._overlay.querySelector('#popup-subtitle'),
      year:     this._overlay.querySelector('#popup-year'),
      body:     this._overlay.querySelector('#popup-body'),
      videoWrap:  this._overlay.querySelector('#popup-video-wrap'),
      video:      this._overlay.querySelector('#popup-video'),
      imageWrap:  this._overlay.querySelector('#popup-image-wrap'),
      image:      this._overlay.querySelector('#popup-image'),
      imageNav:   this._overlay.querySelector('#popup-image-nav'),
      imgNavInfo: this._overlay.querySelector('#img-nav-info'),
      close:      this._overlay.querySelector('#popup-close'),
    };

    // 关闭按钮（安全绑定，防止 querySelector 返回 null）
    if (this.el.close) {
      this.el.close.addEventListener('click', (ev) => {
        ev.stopPropagation();
        this.close();
      });
    }

    // 图片导航按钮（安全绑定）
    const prevBtn = this._overlay.querySelector('#img-prev');
    const nextBtn = this._overlay.querySelector('#img-next');
    if (prevBtn) {
      prevBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        this._prevImage();
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        this._nextImage();
      });
    }
  }

  // ═══════════════════════════════════
  //  打开 / 关闭
  // ═══════════════════════════════════

  /**
   * 打开弹窗，用 JSON 数据填充所有内容区
   * @param {Object} data — 展品数据
   */
  open(data) {
    if (!data) return;

    // ── 头部 ──
    this.el.badge.textContent = TYPE_BADGES[data.type] || '📋 档案';
    this.el.title.textContent = data.title || '';
    this.el.subtitle.textContent = data.subtitle || '';
    this.el.subtitle.style.display = data.subtitle ? 'block' : 'none';
    this.el.year.textContent = data.year || '';
    this.el.year.style.display = data.year ? 'block' : 'none';

    // ── 正文 ──
    this._buildBody(data);

    // ── 媒体 ──
    this._currentImages = data.images || [];

    if (data.video) {
      this.el.videoWrap.style.display = 'block';
      this.el.video.src = data.video;
      this.el.imageWrap.style.display = 'none';
    } else if (this._currentImages.length > 0) {
      this.el.videoWrap.style.display = 'none';
      this.el.video.src = '';
      this.el.imageWrap.style.display = 'block';
      this._imageIndex = 0;
      this._showImage(0);
      this.el.imageNav.style.display = this._currentImages.length > 1 ? 'flex' : 'none';
    } else {
      this.el.videoWrap.style.display = 'none';
      this.el.video.src = '';
      this.el.imageWrap.style.display = 'none';
    }

    // ── 显示 ──
    this._overlay.classList.add('visible');
    this.isOpen = true;

    // 正文区滚动到顶部
    this.el.body.scrollTop = 0;

    document.addEventListener('keydown', this._onKeyDown);
  }

  close() {
    this._overlay.classList.remove('visible');
    this.isOpen = false;

    if (this.el.video.src) {
      this.el.video.src = '';
    }

    document.removeEventListener('keydown', this._onKeyDown);
  }

  toggle(data) {
    if (this.isOpen) { this.close(); } else { this.open(data); }
  }

  // ═══════════════════════════════════
  //  正文构建
  // ═══════════════════════════════════

  /**
   * 根据 JSON 数据动态生成正文 HTML。
   *
   * 支持的字段（全部可选）：
   *   description — 展品简介（显示在 sections 之上）
   *   highlight   — 金句高亮框
   *   sections[]  — { heading, body } 分段内容
   */
  _buildBody(data) {
    let html = '';

    // 简介段落
    if (data.description) {
      html += `<p class="popup-intro">${this._escapeHTML(data.description)}</p>`;
    }

    // 金句高亮
    if (data.highlight) {
      html += `<blockquote class="popup-highlight">
        <span class="highlight-mark">❝</span>
        <p>${this._escapeHTML(data.highlight)}</p>
      </blockquote>`;
    }

    // 分段内容
    if (data.sections && data.sections.length > 0) {
      for (const sec of data.sections) {
        html += `<div class="popup-section">
          <h3 class="section-heading">${this._escapeHTML(sec.heading || '')}</h3>
          <div class="section-body">${this._formatBody(sec.body || '')}</div>
        </div>`;
      }
    }

    this.el.body.innerHTML = html;
  }

  /**
   * 格式化正文：将 \n\n 转为段落分隔，将 \n 转为 <br>，
   * 将 【标题】 标记转为高亮标签。
   */
  _formatBody(text) {
    let out = this._escapeHTML(text);

    // 【标题】→ 高亮标签
    out = out.replace(/【(.+?)】/g, '<strong class="story-label">$1</strong>');

    // 双换行 → 段落
    out = out.replace(/\n\n/g, '</p><p class="section-para">');
    // 单换行 → 换行
    out = out.replace(/\n/g, '<br>');

    return `<p class="section-para">${out}</p>`;
  }

  /** 基础 HTML 转义 */
  _escapeHTML(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ═══════════════════════════════════
  //  图片导航
  // ═══════════════════════════════════

  _showImage(idx) {
    if (idx < 0 || idx >= this._currentImages.length) return;
    this._imageIndex = idx;
    this.el.image.src = this._currentImages[idx];
    if (this.el.imgNavInfo) {
      this.el.imgNavInfo.textContent = `${idx + 1} / ${this._currentImages.length}`;
    }
  }

  _prevImage() {
    const idx = (this._imageIndex - 1 + this._currentImages.length) % this._currentImages.length;
    this._showImage(idx);
  }

  _nextImage() {
    const idx = (this._imageIndex + 1) % this._currentImages.length;
    this._showImage(idx);
  }

  // ═══════════════════════════════════
  //  事件
  // ═══════════════════════════════════

  _onKeyDown(event) {
    if (event.code === 'Escape') {
      event.preventDefault();
      this.close();
    }
  }

  _onOverlayClick(event) {
    if (event.target === this._overlay) {
      this.close();
    }
  }

  dispose() {
    this.close();
    document.removeEventListener('keydown', this._onKeyDown);
    if (this._overlay && this._overlay.parentNode) {
      this._overlay.parentNode.removeChild(this._overlay);
    }
  }
}
