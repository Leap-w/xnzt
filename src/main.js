/**
 * main.js — 入口模块
 *
 * 启动流程:
 *   1. 渲染器 + 展览空间（立即可见）
 *   2. 开场动画（相机飞入，字幕淡入淡出）
 *   3. 动画结束 → 用户控制激活 + FPS + 小地图
 *   4. 展品数据 + GLB 模型异步加载
 *   5. 移动端虚拟摇杆自动检测
 */

import * as THREE from 'three';
import { createExhibition, HALL_POSITIONS, addExhibitionLights } from './exhibition.js';
import { createCamera, handleResize } from './camera.js';
import { FirstPersonController } from './controls.js';
import { ExhibitionLoader } from './loader.js';
import { InteractionManager } from './interaction.js';
import { ExhibitsManager } from './exhibits.js';
import { PopupManager } from './popup.js';
import { AudioManager } from './audio.js';
import { CinematicIntro } from './cinematic.js';
import { Minimap } from './minimap.js';
import { VirtualJoystick } from './joystick.js';

// ═══════════════════════════════════════
//  DOM 引用
// ═══════════════════════════════════════

const appEl = document.getElementById('app');
const overlayEl = document.getElementById('loading-overlay');
const progressFill = document.getElementById('progress-fill');
const progressText = document.getElementById('progress-text');
const loadSpinner = document.getElementById('load-spinner');
const loadError = document.getElementById('load-error');
const loadRetry = document.getElementById('load-retry');
const fpsEl = document.getElementById('fps');
const lockHint = document.getElementById('lock-hint');
const audioIcon = document.getElementById('audio-icon');
const controlHint = document.getElementById('control-hint');

// ═══════════════════════════════════════
//  兜底保护 — 无论如何 8 秒后强制隐藏加载遮罩
// ═══════════════════════════════════════

setTimeout(() => {
  if (overlayEl && !overlayEl.classList.contains('hidden')) {
    console.warn('⚠️  超时强制隐藏加载遮罩');
    hideOverlay();
  }
}, 8000);

// ═══════════════════════════════════════
//  渲染器
// ═══════════════════════════════════════

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
renderer.outputColorSpace = THREE.SRGBColorSpace;

appEl.appendChild(renderer.domElement);

// ═══════════════════════════════════════
//  展览空间
// ═══════════════════════════════════════

const {
  scene,
  collidables,
  halls: exhibitionHalls,
  spawn,
} = createExhibition();

// ═══════════════════════════════════════
//  建筑包围盒（小地图用）
// ═══════════════════════════════════════

const BUILDING_BOUNDS = {
  xMin: -23, xMax: 23,
  zMin: -24, zMax: 27,
};

// ═══════════════════════════════════════
//  相机
// ═══════════════════════════════════════

const camera = createCamera();
camera.position.copy(spawn.position);
camera.lookAt(spawn.lookAt);

// ═══════════════════════════════════════
//  控制器
// ═══════════════════════════════════════

const controller = new FirstPersonController(camera, renderer.domElement);
controller.setCollidables(collidables);

// ═══════════════════════════════════════
//  小地图
// ═══════════════════════════════════════

const minimap = new Minimap(HALL_POSITIONS, BUILDING_BOUNDS);

// ═══════════════════════════════════════
//  虚拟摇杆（仅触屏设备）
// ═══════════════════════════════════════

const joystick = new VirtualJoystick(renderer.domElement);

// ═══════════════════════════════════════
//  弹窗 — 安全创建，失败不阻塞整个应用
// ═══════════════════════════════════════

let popup;
try {
  popup = new PopupManager();
} catch (e) {
  console.warn('⚠️ 弹窗初始化失败，展品功能不可用:', e.message);
  // 创建一个 dummy popup，避免后续代码空指针
  popup = { isOpen: false, open() {}, close() {}, dispose() {} };
}

// ═══════════════════════════════════════
//  展品管理器
// ═══════════════════════════════════════

const exhibitsMgr = new ExhibitsManager(scene, HALL_POSITIONS);

// ═══════════════════════════════════════
//  交互
// ═══════════════════════════════════════

const interaction = new InteractionManager(camera, scene, renderer.domElement);
interaction.setIdLookup((mesh) => exhibitsMgr.getIdFromMesh(mesh));

interaction.onExhibitHover = () => { document.body.style.cursor = 'pointer'; };
interaction.onExhibitUnhover = () => {
  document.body.style.cursor = document.pointerLockElement ? 'none' : 'default';
};

interaction.onExhibitClick = (exhibitId) => {
  const data = exhibitsMgr.getById(exhibitId);
  if (data) {
    document.exitPointerLock();
    popup.open(data);
  }
};

// ═══════════════════════════════════════
//  ESC 优先级
// ═══════════════════════════════════════

document.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' && popup.isOpen) {
    e.stopPropagation();
  }
});

// ═══════════════════════════════════════
//  背景音乐
// ═══════════════════════════════════════

const audio = new AudioManager();

document.addEventListener('keydown', (e) => {
  if (e.code === 'KeyM' && document.pointerLockElement && !popup.isOpen) {
    const muted = audio.toggleMute();
    if (audioIcon) {
      audioIcon.textContent = muted ? '🔇' : '🔊';
      audioIcon.classList.toggle('muted', muted);
    }
  }
});

if (audioIcon) {
  audioIcon.addEventListener('click', (e) => {
    e.stopPropagation();
    const muted = audio.toggleMute();
    audioIcon.textContent = muted ? '🔇' : '🔊';
    audioIcon.classList.toggle('muted', muted);
  });
}

// ═══════════════════════════════════════
//  全局状态
// ═══════════════════════════════════════

export const state = {
  modelRoot: null,
  halls: exhibitionHalls,
  hallPositions: HALL_POSITIONS,
  allNodes: new Map(),
  isModelLoaded: false,
  exhibitsMgr,
  popup,
  minimap,
};

window.__exhibition = state;

// ═══════════════════════════════════════
//  锁定提示
// ═══════════════════════════════════════

document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement && lockHint) {
    lockHint.style.opacity = '0';
    setTimeout(() => { if (lockHint) lockHint.remove(); }, 400);
  }
});

// ═══════════════════════════════════════
//  窗口缩放
// ═══════════════════════════════════════

window.addEventListener('resize', () => handleResize(camera, renderer));

// ═══════════════════════════════════════
//  FPS
// ═══════════════════════════════════════

let frameCount = 0;
let fpsTime = performance.now();

// ═══════════════════════════════════════
//  渲染循环
// ═══════════════════════════════════════

const clock = new THREE.Clock();
let elapsed = 0;
let cinematicDone = false;

function animate() {
  requestAnimationFrame(animate);

  const delta = Math.min(clock.getDelta(), 0.1);
  elapsed += delta;

  // 虚拟摇杆 → 控制器
  if (joystick.isTouchDevice) {
    controller.setExternalMove(joystick.moveX, joystick.moveY);
    controller.setExternalLook(joystick.lookDx, joystick.lookDy);
  }

  controller.update(delta);

  // 展品指示器动画
  exhibitsMgr.update(elapsed);

  // 交互检测
  if (!popup.isOpen) {
    interaction.update(delta);
  }

  renderer.render(scene, camera);

  // 小地图（动画结束后）
  if (cinematicDone) {
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const yaw = Math.atan2(dir.x, dir.z);
    minimap.update(camera.position.x, camera.position.z, yaw);
  }

  // 虚拟摇杆帧重置
  if (joystick.isTouchDevice) {
    joystick.resetFrame();
  }

  // FPS
  frameCount++;
  const now = performance.now();
  if (now - fpsTime >= 1000) {
    const fps = Math.round(frameCount / ((now - fpsTime) / 1000));
    frameCount = 0;
    fpsTime = now;
    if (fpsEl) {
      fpsEl.textContent = `${fps} FPS`;
      fpsEl.style.color = fps >= 55 ? '#8f8' : fps >= 30 ? '#ff8' : '#f66';
    }
  }
}

animate();

// ═══════════════════════════════════════
//  展品数据加载
// ═══════════════════════════════════════

// 注意：BASE 和 MODEL_PATH 必须在异步函数之前定义
// （它们在 async 函数体内同步求值）
const BASE = import.meta.env.BASE_URL;

async function loadExhibits() {
  try {
    await exhibitsMgr.load(`${BASE}assets/exhibits.json`);
    interaction.registerMeshes(exhibitsMgr.getClickableMeshes());
  } catch (e) {
    console.warn('⚠️  展品加载失败:', e.message);
  }
}

loadExhibits();

// ═══════════════════════════════════════
//  GLB 模型加载
// ═══════════════════════════════════════

const MODEL_PATH = `${BASE}models/exhibition.glb`;
const glbLoader = new ExhibitionLoader();

function setProgress(pct) {
  if (!progressFill || !progressText) return;
  if (pct < 0) {
    progressFill.style.width = '60%';
    progressFill.style.transition = 'width 2s ease-in-out';
    progressText.textContent = '加载中…';
    return;
  }
  progressFill.style.transition = 'width 0.15s ease';
  const display = Math.round(pct * 100);
  progressFill.style.width = `${display}%`;
  progressText.textContent = `${display}%`;
}

function showLoadError(msg) {
  if (loadSpinner) loadSpinner.style.display = 'none';
  if (progressFill) progressFill.parentElement.style.display = 'none';
  if (progressText) progressText.style.display = 'none';
  if (loadError) { loadError.textContent = msg; loadError.classList.add('show'); }
  if (loadRetry) loadRetry.style.display = 'block';
}

function hideOverlay() {
  if (!overlayEl) return;
  overlayEl.classList.add('hidden');
  setTimeout(() => { if (overlayEl) overlayEl.remove(); }, 700);
}

async function loadGLB() {
  let fileExists = false;
  try {
    const res = await fetch(MODEL_PATH, { method: 'HEAD' });
    const ct = res.headers.get('content-type') || '';
    fileExists = res.ok && !ct.includes('text/html');
  } catch (_) {}

  if (!fileExists) {
    setProgress(1);
    setTimeout(hideOverlay, 800);
    return;
  }

  try {
    const result = await glbLoader.loadModel(MODEL_PATH, (pct) => setProgress(pct));
    setProgress(1);
    scene.clear();
    scene.background = new THREE.Color(0x1a1218);
    scene.fog = new THREE.FogExp2(0x1a1218, 0.00006);
    addExhibitionLights(scene);
    scene.add(result.root);
    state.modelRoot = result.root;
    state.allNodes = result.allNodes;
    state.isModelLoaded = true;
    Object.assign(state.halls, result.halls);
    const wallCollidables = ExhibitionLoader.extractCollidables(result.root);
    controller.setCollidables(wallCollidables);
    const box = new THREE.Box3().setFromObject(result.root);
    const center = new THREE.Vector3();
    box.getCenter(center);
    camera.position.set(center.x, 1.6, box.max.z + 2);
    camera.lookAt(center);
  } catch (err) {
    showLoadError(`⚠ 模型加载失败\n${err.message || '未知错误'}`);
    setTimeout(hideOverlay, 3000);
    return;
  }
  setTimeout(hideOverlay, 500);
}

loadGLB();

// ═══════════════════════════════════════
//  开场动画 + 启动
// ═══════════════════════════════════════

async function runIntro() {
  // 先隐藏加载遮罩
  setTimeout(hideOverlay, 600);

  // 播放开场动画
  const centralPos = new THREE.Vector3(
    HALL_POSITIONS.centralHall[0], 1.4, HALL_POSITIONS.centralHall[1],
  );
  const cinematic = new CinematicIntro(camera, spawn.position, centralPos);

  try {
    await cinematic.play();
  } catch (_) {
    cinematic.cancel();
  }

  cinematicDone = true;

  // 动画结束后显示 UI 元素
  minimap.setVisible(true);
  if (controlHint) controlHint.classList.add('visible');
  if (!joystick.isTouchDevice && lockHint) {
    lockHint.style.opacity = '1';
  }

  console.log('🏛️  展厅漫游已就绪');
}

// 稍等一帧确保渲染器就绪后开始
setTimeout(runIntro, 100);

console.log('╔══════════════════════════════════════╗');
console.log('║  廉花郑放·赓续清风                    ║');
console.log('║  红色廉洁文化档案展 — 3D 虚拟展厅     ║');
console.log('╠══════════════════════════════════════╣');
console.log('║  开场动画 → 序厅 → 中央大厅           ║');
console.log('║  右下角小地图  |  M 静音切换          ║');
console.log('║  走近展台 → 点击查看档案              ║');
console.log('╚══════════════════════════════════════╝');
