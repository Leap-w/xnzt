/**
 * camera.js — 相机模块
 * 创建和管理透视相机
 */
import * as THREE from 'three';

/**
 * 创建第一人称透视相机
 * @returns {THREE.PerspectiveCamera}
 */
export function createCamera() {
  const camera = new THREE.PerspectiveCamera(
    60, // 视场角 (FOV)
    window.innerWidth / window.innerHeight, // 宽高比
    0.1, // 近裁剪面
    100, // 远裁剪面
  );

  // 初始位置：站在地面上方，略微后退以便看到立方体
  camera.position.set(5, 1.6, 8);
  camera.lookAt(0, 1, 0);

  return camera;
}

/**
 * 响应窗口大小变化，更新相机和渲染器
 * @param {THREE.PerspectiveCamera} camera
 * @param {THREE.WebGLRenderer} renderer
 */
export function handleResize(camera, renderer) {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
