/**
 * audio.js — 背景音乐接口模块
 *
 * 基于 Web Audio API 的轻量封装。
 * 当前仅提供接口和静音控制，音频文件由后续阶段接入。
 *
 * 用法:
 *   const audio = new AudioManager();
 *   audio.setVolume(0.3);
 *   audio.toggle();           // M 键
 */

export class AudioManager {
  constructor() {
    this._ctx = null;
    this._source = null;
    this._gainNode = null;
    this._buffer = null;
    this._isPlaying = false;
    this._isMuted = false;
    this._volume = 0.3;
    this._startTime = 0;
    this._pauseOffset = 0;

    // 懒初始化 AudioContext（需用户交互后）
    this._initOnInteraction = this._initOnInteraction.bind(this);
    document.addEventListener('click', this._initOnInteraction, { once: true });
    document.addEventListener('keydown', this._initOnInteraction, { once: true });
  }

  /** 首次用户交互时初始化 AudioContext */
  _initOnInteraction() {
    if (this._ctx) return;
    try {
      this._ctx = new (window.AudioContext || window.webkitAudioContext)();
      this._gainNode = this._ctx.createGain();
      this._gainNode.gain.value = this._volume;
      this._gainNode.connect(this._ctx.destination);
      console.log('🔊 AudioContext 已就绪');
    } catch (e) {
      console.warn('⚠️  AudioContext 不可用:', e.message);
    }
  }

  /**
   * 加载音频文件
   * @param {string} url — 音频文件路径
   */
  async load(url) {
    if (!this._ctx) this._initOnInteraction();
    if (!this._ctx) return;

    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      this._buffer = await this._ctx.decodeAudioData(arrayBuffer);
      console.log(`🎵 音频已加载: ${url}`);
    } catch (e) {
      console.warn('⚠️  音频加载失败:', e.message);
    }
  }

  /** 播放（循环） */
  play() {
    if (!this._ctx || !this._buffer || this._isPlaying) return;
    if (this._ctx.state === 'suspended') this._ctx.resume();

    this._source = this._ctx.createBufferSource();
    this._source.buffer = this._buffer;
    this._source.loop = true;
    this._source.connect(this._gainNode);

    const offset = this._pauseOffset % (this._buffer.duration || 1);
    this._source.start(0, offset);
    this._startTime = this._ctx.currentTime - offset;
    this._isPlaying = true;
  }

  /** 暂停 */
  pause() {
    if (!this._isPlaying || !this._source) return;
    this._pauseOffset = this.getCurrentTime();
    this._source.stop();
    this._source.disconnect();
    this._source = null;
    this._isPlaying = false;
  }

  /** 切换 播放/暂停 */
  toggle() {
    if (this._isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  /** 切换 静音/取消静音 */
  toggleMute() {
    this._isMuted = !this._isMuted;
    if (this._gainNode) {
      this._gainNode.gain.value = this._isMuted ? 0 : this._volume;
    }
    console.log(this._isMuted ? '🔇 静音' : '🔊 取消静音');
    return this._isMuted;
  }

  /** 设置音量 (0-1) */
  setVolume(v) {
    this._volume = Math.max(0, Math.min(1, v));
    if (!this._isMuted && this._gainNode) {
      this._gainNode.gain.value = this._volume;
    }
  }

  /** 获取当前播放时间（秒） */
  getCurrentTime() {
    if (!this._ctx || !this._isPlaying) return this._pauseOffset;
    return this._ctx.currentTime - this._startTime;
  }

  get isMuted() { return this._isMuted; }
  get isPlaying() { return this._isPlaying; }

  /** 销毁 */
  dispose() {
    if (this._source) {
      this._source.stop();
      this._source.disconnect();
    }
    if (this._gainNode) this._gainNode.disconnect();
    if (this._ctx) this._ctx.close();
  }
}
