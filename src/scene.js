/**
 * scene.js — 场景模块
 *
 * 构建 20×20m 测试展厅，用于验证第一人称漫游与碰撞检测。
 *
 * 布局（俯视）：
 *   ┌──────────────────────────────┐
 *   │         北墙 (N)              │
 *   │                              │
 *   │  ┌──────┐        ┌──────┐   │
 *   │  │隔墙A │ 展 台  │隔墙B │   │
 *   │  └──────┘        └──────┘   │
 *   │      入口通道 →              │
 *   │         南墙 (S)             │
 *   └──────────────────────────────┘
 *
 * 返回值：{ scene, collidables }
 *   collidables — 传给 FirstPersonController.setCollidables()
 */
import * as THREE from 'three';

// ── 展厅尺寸常量 ──
const ROOM_SIZE = 20;       // 边长
const HALF = ROOM_SIZE / 2; // 半边长 10
const WALL_H = 4;           // 墙高
const WALL_T = 0.5;         // 墙厚

// ── 材质工厂 ──
function wallMaterial(color) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.75,
    metalness: 0.05,
  });
}

function makeBox(w, h, d, x, y, z, material, name) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = name;
  return mesh;
}

export function createScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1a2e);
  scene.fog = new THREE.Fog(0x1a1a2e, 14, 35);

  // ═══════════════════════════════════
  //  灯光
  // ═══════════════════════════════════

  // 环境光 — 提亮暗部
  scene.add(new THREE.AmbientLight(0x404060, 0.5));

  // 主方向光 — 模拟天窗
  const sun = new THREE.DirectionalLight(0xffeedd, 1.0);
  sun.position.set(0, 12, 4);
  sun.castShadow = true;
  sun.shadow.mapSize.width = 2048;
  sun.shadow.mapSize.height = 2048;
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 50;
  sun.shadow.camera.left = -15;
  sun.shadow.camera.right = 15;
  sun.shadow.camera.top = 15;
  sun.shadow.camera.bottom = -15;
  sun.shadow.bias = -0.0001;
  sun.shadow.normalBias = 0.02;
  scene.add(sun);

  // 补光 — 冷色
  const fill = new THREE.DirectionalLight(0xaaccff, 0.35);
  fill.position.set(-8, 4, -6);
  scene.add(fill);

  // ═══════════════════════════════════
  //  地面
  // ═══════════════════════════════════

  const floorGeo = new THREE.PlaneGeometry(ROOM_SIZE, ROOM_SIZE);
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x332e38,
    roughness: 0.55,
    metalness: 0.08,
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0;
  floor.receiveShadow = true;
  floor.name = '地面';
  scene.add(floor);

  // 网格线 — 辅助空间感知
  const grid = new THREE.GridHelper(ROOM_SIZE, ROOM_SIZE, 0x5a5a6a, 0x3a3a4a);
  grid.position.y = 0.005;
  scene.add(grid);

  // ═══════════════════════════════════
  //  材质预设
  // ═══════════════════════════════════

  const matWallOuter = wallMaterial(0x7a3a3a);  // 深红 — 外围墙体
  const matWallInner = wallMaterial(0x8b5543);  // 暖褐 — 内部隔墙

  const collidables = [];

  function addWall(w, h, d, x, y, z, mat, label) {
    const m = makeBox(w, h, d, x, y, z, mat, label);
    scene.add(m);
    collidables.push(m);
    return m;
  }

  // ═══════════════════════════════════
  //  外围墙体
  // ═══════════════════════════════════

  // 北（-Z）
  addWall(ROOM_SIZE, WALL_H, WALL_T, 0, WALL_H / 2, -HALF, matWallOuter, '北墙');
  // 南（+Z）
  addWall(ROOM_SIZE, WALL_H, WALL_T, 0, WALL_H / 2, HALF, matWallOuter, '南墙');
  // 西（-X）
  addWall(WALL_T, WALL_H, ROOM_SIZE, -HALF, WALL_H / 2, 0, matWallOuter, '西墙');
  // 东（+X）
  addWall(WALL_T, WALL_H, ROOM_SIZE, HALF, WALL_H / 2, 0, matWallOuter, '东墙');

  // ═══════════════════════════════════
  //  内部隔墙 — 划分展区
  // ═══════════════════════════════════

  // 隔墙 A — 左前区域
  addWall(7, WALL_H, WALL_T, -5, WALL_H / 2, -3, matWallInner, '隔墙A');

  // 隔墙 B — 右后区域
  addWall(7, WALL_H, WALL_T, 5, WALL_H / 2, 3, matWallInner, '隔墙B');

  // ═══════════════════════════════════
  //  中央展台
  // ═══════════════════════════════════

  const pedestalGeo = new THREE.BoxGeometry(2, 1.5, 2);
  const pedestalMat = new THREE.MeshStandardMaterial({
    color: 0x6b5b4a,
    roughness: 0.35,
    metalness: 0.25,
  });
  const pedestal = new THREE.Mesh(pedestalGeo, pedestalMat);
  pedestal.position.set(0, 0.75, 0);
  pedestal.castShadow = true;
  pedestal.receiveShadow = true;
  pedestal.name = '中央展台';
  scene.add(pedestal);
  collidables.push(pedestal);

  // 展台装饰边框
  const edgeGeo = new THREE.EdgesGeometry(pedestalGeo);
  const edgeLine = new THREE.LineSegments(
    edgeGeo,
    new THREE.LineBasicMaterial({ color: 0xc9a96e, transparent: true, opacity: 0.6 }),
  );
  pedestal.add(edgeLine);

  // ═══════════════════════════════════
  //  聚光灯 — 照射展台
  // ═══════════════════════════════════

  const spot = new THREE.SpotLight(0xffeedd, 2.5, 14, Math.PI / 7, 0.4, 0.5);
  spot.position.set(0, 5.5, 0);
  spot.target.position.copy(pedestal.position);
  spot.castShadow = true;
  spot.shadow.mapSize.width = 1024;
  spot.shadow.mapSize.height = 1024;
  spot.shadow.bias = -0.0001;
  scene.add(spot);
  scene.add(spot.target);

  // ═══════════════════════════════════
  //  天花板光晕指示器
  // ═══════════════════════════════════

  const ceilingRingGeo = new THREE.TorusGeometry(1.5, 0.08, 8, 32);
  const ceilingRing = new THREE.Mesh(
    ceilingRingGeo,
    new THREE.MeshBasicMaterial({ color: 0xeeddcc }),
  );
  ceilingRing.rotation.x = Math.PI / 2;
  ceilingRing.position.set(0, 5.6, 0);
  scene.add(ceilingRing);

  // ═══════════════════════════════════
  //  坐标轴参考（调试用，后续可移除）
  // ═══════════════════════════════════

  if (false) {
    const axes = new THREE.AxesHelper(5);
    scene.add(axes);
  }

  console.log(`🏛️  展厅场景就绪 — ${collidables.length} 个碰撞体`);

  return { scene, collidables };
}
