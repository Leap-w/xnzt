/**
 * loader.js — 模型加载模块
 *
 * 封装 GLTFLoader + Draco 解压，提供进度回调和节点注册。
 *
 * 用法：
 *   const loader = new ExhibitionLoader();
 *   const result = await loader.loadModel('/models/exhibition.glb', onProgress);
 *   // result = { root, halls: { lobby, centralHall, ... }, allNodes }
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

// ── Blender 导出命名约定 ──
export const HALL_NAMES = [
  'Lobby',        // 序厅
  'CentralHall',  // 中央档案大厅
  'PeopleHall',   // 人物·中原丰碑
  'RuleHall',     // 制度·纪律之源
  'ZZUHall',      // 郑大·清风传家
  'FutureHall',   // 传承·见证致远
];

// 中文对照（调试用）
const HALL_LABELS = {
  Lobby: '序厅',
  CentralHall: '中央档案大厅',
  PeopleHall: '人物·中原丰碑',
  RuleHall: '制度·纪律之源',
  ZZUHall: '郑大·清风传家',
  FutureHall: '传承·见证致远',
};

/**
 * 模型加载器 — 封装 Draco + GLTF 加载全流程
 */
export class ExhibitionLoader {
  constructor() {
    // Draco 解码器（从 Google CDN 加载，不占用项目带宽）
    this._draco = new DRACOLoader();
    this._draco.setDecoderPath(
      'https://www.gstatic.com/draco/versioned/decoders/1.5.7/',
    );

    // GLTF 加载器
    this._gltfLoader = new GLTFLoader();
    this._gltfLoader.setDRACOLoader(this._draco);
  }

  /**
   * 加载 GLB 展厅模型
   *
   * @param {string} path        — 模型路径，如 '/models/exhibition.glb'
   * @param {(pct: number) => void} [onProgress]  — 0..1 进度
   * @returns {Promise<LoadResult>}
   */
  async loadModel(path, onProgress) {
    // 1) 加载 GLB
    const gltf = await new Promise((resolve, reject) => {
      this._gltfLoader.load(
        path,
        (gltf) => resolve(gltf),
        (event) => {
          if (event.total > 0 && onProgress) {
            onProgress(event.loaded / event.total);
          }
        },
        (err) => reject(err),
      );
    });

    const root = gltf.scene;

    // 2) 遍历节点 → 渲染配置 + 命名收集
    const allNodes = new Map();
    const meshes = [];

    root.traverse((node) => {
      // 记录所有有名称的节点
      if (node.name) {
        allNodes.set(node.name, node);
      }

      // 对 Mesh 统一开启阴影
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
        meshes.push(node);
      }
    });

    // 3) 按 Blender 命名匹配展区节点
    const halls = {};
    for (const name of HALL_NAMES) {
      if (allNodes.has(name)) {
        halls[name.charAt(0).toLowerCase() + name.slice(1)] = allNodes.get(name);
        console.log(`  📦 展厅节点: ${name} — ${HALL_LABELS[name] || ''}`);
      } else {
        halls[name.charAt(0).toLowerCase() + name.slice(1)] = null;
        console.warn(`  ⚠️  未找到展厅节点: "${name}"`);
      }
    }

    return { root, halls, allNodes, meshes };
  }

  /**
   * 从模型根节点中提取所有 Mesh → Box3 碰撞体列表
   *
   * 策略：对名称中包含 "Wall" / "wall" / "墙体" 的节点，
   * 或用最小尺寸阈值过滤（排除地面等大平面）。
   *
   * @param {THREE.Object3D} root
   * @returns {THREE.Mesh[]}
   */
  static extractCollidables(root) {
    const collidables = [];

    root.traverse((node) => {
      if (!node.isMesh) return;

      const name = node.name.toLowerCase();

      // 明确标记为墙体
      const isWall = name.includes('wall') || name.includes('墙体') || name.includes('墙');

      // 排除地面（Y 轴很薄的平面）
      const bbox = new THREE.Box3().setFromObject(node);
      const size = new THREE.Vector3();
      bbox.getSize(size);
      const isFloor = size.y < 0.2 && size.x > 5 && size.z > 5;

      if (isWall && !isFloor) {
        collidables.push(node);
      }
    });

    // 如果没有匹配到任何墙体，返回所有非地面 Mesh 作为保守碰撞
    if (collidables.length === 0) {
      root.traverse((node) => {
        if (!node.isMesh) return;
        const bbox = new THREE.Box3().setFromObject(node);
        const size = new THREE.Vector3();
        bbox.getSize(size);
        // 跳过很大的水平面（地面/天花板）
        if (size.y < 0.5 && Math.min(size.x, size.z) > 5) return;
        collidables.push(node);
      });
    }

    return collidables;
  }

  /** 销毁 — 释放 Draco 资源 */
  dispose() {
    this._draco.dispose();
  }
}

/**
 * @typedef {Object} LoadResult
 * @property {THREE.Group} root                — 模型根节点
 * @property {Object<string, THREE.Object3D|null>} halls — 按小驼峰命名的展厅节点
 * @property {Map<string, THREE.Object3D>} allNodes      — 所有具名节点
 * @property {THREE.Mesh[]} meshes             — 所有 Mesh（已开阴影）
 */
