/**
 * exhibition.js — 虚拟展厅空间构建模块
 *
 * "一厅四馆一中心" 布局：
 *   入口序厅 (Lobby) → 人物馆 (PeopleHall) → 中央大厅 (CentralHall)
 *     → 西:制度馆(RuleHall) / 东:郑大馆(ZZUHall) / 北:传承馆(FutureHall)
 *
 * 尺寸参考：建筑 ~55m(Z) × 44m(X) × 7m(H)
 * 所有坐标以中央大厅地面中心为原点 (0, 0, 0)。
 *
 * 返回: { scene, collidables, halls, spawn }
 */

import * as THREE from 'three';

// ═══════════════════════════════════════
//  空间常量
// ═══════════════════════════════════════

const HALL_W = 14;       // 展厅宽度 (X)
const HALL_D = 12;       // 展厅深度 (Z)
const HALL_H = 6;        // 展厅净高
const PEOPLE_D = 18;     // 人物馆深度（V2.0 一厅三展区）
const CENTER_W = 12;     // 中央大厅边长
const CENTER_H = 7;      // 中央大厅挑高
const LOBBY_W = 12;      // 序厅宽度
const LOBBY_D = 10;      // 序厅深度
const CORRIDOR_W = 5;    // 走廊宽度
const WALL_T = 0.4;      // 墙体厚度

// 展区中心坐标 (X, Z) — V2.0 环形动线
const POS = {
  lobby:       [0, 19],
  peopleHall:  [0, 8],
  centralHall: [0, 0],
  futureHall:  [0, -15],
  ruleHall:    [-16, 0],
  zzuHall:     [16, 0],
};

// 建筑包围盒
const BUILDING = {
  xMin: -23, xMax: 23,
  zMin: -24, zMax: 27,
};

// ═══════════════════════════════════════
//  PBR 材质库
// ═══════════════════════════════════════
//
// 使用 MeshStandardMaterial 的 PBR 参数：
//   roughness / metalness 控制表面属性
//   MeshPhysicalMaterial 的 clearcoat 用于玻璃/抛光效果
//   envMapIntensity 提升反射质感

const matFloor = new THREE.MeshStandardMaterial({
  color: 0x3a3240, roughness: 0.55, metalness: 0.03,
});

// 金属 — 抛光黄铜（导览线、装饰环）
const matGold = new THREE.MeshStandardMaterial({
  color: 0xc9a96e, roughness: 0.25, metalness: 0.85,
});

// 木材 — 深色红木（柱子、底座）
const matWood = new THREE.MeshStandardMaterial({
  color: 0x5a3620, roughness: 0.5, metalness: 0.05,
});

// 石材 — 浅灰色大理石（地面装饰、台面）
const matStone = new THREE.MeshStandardMaterial({
  color: 0x5a4a4a, roughness: 0.4, metalness: 0.1,
});

// 墙体 — 深红砂岩（外立面）
const matWallOuter = new THREE.MeshStandardMaterial({
  color: 0x5a2a2a, roughness: 0.72, metalness: 0.02,
});

// 墙体 — 暖色砂岩（内墙）
const matWallInner = new THREE.MeshStandardMaterial({
  color: 0x7a4838, roughness: 0.68, metalness: 0.03,
});

// 石材地砖 — 暗色抛光（中央大厅）
const matCentralFloor = new THREE.MeshStandardMaterial({
  color: 0x3a3028, roughness: 0.3, metalness: 0.15,
});

// 玻璃 — 半透明展示柜面（后续展柜使用）
const matGlass = new THREE.MeshPhysicalMaterial({
  color: 0xaaccee, roughness: 0.08, metalness: 0.05,
  transparent: true, opacity: 0.35,
  envMapIntensity: 0.6, clearcoat: 0.2,
});

// 黑色金属 — 展示柜框架
const matDarkMetal = new THREE.MeshStandardMaterial({
  color: 0x2a2220, roughness: 0.3, metalness: 0.9,
});

const matPillar = matWood;

// ═══════════════════════════════════════
//  几何体工厂（复用）
// ═══════════════════════════════════════

const boxGeoCache = new Map();
function boxGeo(w, h, d) {
  const key = `${w},${h},${d}`;
  if (!boxGeoCache.has(key)) {
    boxGeoCache.set(key, new THREE.BoxGeometry(w, h, d));
  }
  return boxGeoCache.get(key);
}

function addBox(scene, coll, w, h, d, x, y, z, mat, name) {
  const mesh = new THREE.Mesh(boxGeo(w, h, d), mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = name;
  scene.add(mesh);
  coll.push(mesh);
  return mesh;
}

// ═══════════════════════════════════════
//  主构建函数
// ═══════════════════════════════════════

export function createExhibition() {
  const scene = new THREE.Scene();

  // 深红棕背景色，与雾效统一
  scene.background = new THREE.Color(0x1a1218);
  scene.fog = new THREE.FogExp2(0x1a1218, 0.00006);

  const collidables = [];
  const halls = {};

  // ═══════════════════════════════════
  //  1. 地面
  // ═══════════════════════════════════

  const floorW = BUILDING.xMax - BUILDING.xMin;
  const floorD = BUILDING.zMax - BUILDING.zMin;
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(floorW, floorD),
    matFloor,
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0.001, (BUILDING.zMin + BUILDING.zMax) / 2);
  floor.receiveShadow = true;
  floor.name = '建筑地面';
  scene.add(floor);

  // ═══════════════════════════════════
  //  2. 中央大厅（核心）
  // ═══════════════════════════════════

  const [cx, cz] = POS.centralHall;

  // 中央大厅地面 — 抬升 0.1m，深色石材
  const centralFloor = new THREE.Mesh(
    new THREE.PlaneGeometry(CENTER_W, CENTER_W),
    matCentralFloor,
  );
  centralFloor.rotation.x = -Math.PI / 2;
  centralFloor.position.set(cx, 0.005, cz);
  centralFloor.receiveShadow = true;
  centralFloor.name = '中央大厅地面';
  scene.add(centralFloor);

  // 中央大厅 — 四根柱子
  const pillarGeo = new THREE.CylinderGeometry(0.35, 0.4, CENTER_H, 16);
  const pillarOff = CENTER_W / 2 - 1.2;
  for (const [px, pz] of [[pillarOff, pillarOff], [-pillarOff, pillarOff], [pillarOff, -pillarOff], [-pillarOff, -pillarOff]]) {
    const pillar = new THREE.Mesh(pillarGeo, matPillar);
    pillar.position.set(cx + px, CENTER_H / 2, cz + pz);
    pillar.castShadow = true;
    pillar.receiveShadow = true;
    pillar.name = '中央大厅柱子';
    scene.add(pillar);
    collidables.push(pillar);
  }

  // 中央大厅天花板装饰环
  const ringGeo = new THREE.TorusGeometry(CENTER_W / 2 - 1, 0.15, 8, 48);
  const ring = new THREE.Mesh(ringGeo, matGold);
  ring.rotation.x = Math.PI / 2;
  ring.position.set(cx, CENTER_H - 0.3, cz);
  ring.name = '中央大厅天花环';
  scene.add(ring);

  halls.centralHall = new THREE.Group();
  halls.centralHall.position.set(cx, 0, cz);
  halls.centralHall.name = 'CentralHall';

  // ═══════════════════════════════════
  //  3. 构建每个矩形展厅
  // ═══════════════════════════════════

  /**
   * 构建一个矩形展厅空间。
   *
   * @param {number} hx   — 展厅中心 X
   * @param {number} hz   — 展厅中心 Z
   * @param {number} w    — 宽度 (X)
   * @param {number} d    — 深度 (Z)
   * @param {number} h    — 高度
   * @param {string} name — 名称 (Lobby | PeopleHall | ...)
   * @param {Array<{side:string, gap:number, gapW:number}>} doorways
   *        side: 'n'|'s'|'e'|'w', gap: 距中心偏移, gapW: 开口宽度
   */
  function buildHall(hx, hz, w, d, h, name, doorways = []) {
    const halfW = w / 2;
    const halfD = d / 2;
    const hy = h / 2;

    const grp = new THREE.Group();
    grp.position.set(hx, 0, hz);
    grp.name = name;
    scene.add(grp);

    // 四面墙（开口处留空）
    const walls = [
      { side: 'n', cx: 0, cz: -halfD, sx: w + WALL_T, sz: WALL_T }, // 北墙
      { side: 's', cx: 0, cz: halfD, sx: w + WALL_T, sz: WALL_T },  // 南墙
      { side: 'e', cx: halfW, cz: 0, sx: WALL_T, sz: d },           // 东墙
      { side: 'w', cx: -halfW, cz: 0, sx: WALL_T, sz: d },          // 西墙
    ];

    for (const wall of walls) {
      const dw = doorways.filter((dw) => dw.side === wall.side);
      if (dw.length > 0) {
        // 有门洞 — 拆成两段
        const gap = dw[0].gap;
        const gapW = dw[0].gapW;

        if (wall.side === 'n' || wall.side === 's') {
          // 水平墙（沿 X 方向）
          const segLen = (wall.sx - gapW) / 2;
          const gapCenter = hx + gap;
          // 左段
          if (segLen > 0.3) {
            const segX = gapCenter - gapW / 2 - segLen / 2;
            addBox(scene, collidables, segLen, h, WALL_T, segX, hy, hz + wall.cz, matWallInner, `${name}-${wall.side}L`);
          }
          // 右段
          if (segLen > 0.3) {
            const segX = gapCenter + gapW / 2 + segLen / 2;
            addBox(scene, collidables, segLen, h, WALL_T, segX, hy, hz + wall.cz, matWallInner, `${name}-${wall.side}R`);
          }
        } else {
          // 垂直墙（沿 Z 方向）
          const segLen = (wall.sz - gapW) / 2;
          const gapCenter = hz + gap;
          // 上段
          if (segLen > 0.3) {
            const segZ = gapCenter - gapW / 2 - segLen / 2;
            addBox(scene, collidables, WALL_T, h, segLen, hx + wall.cx, hy, segZ, matWallInner, `${name}-${wall.side}U`);
          }
          // 下段
          if (segLen > 0.3) {
            const segZ = gapCenter + gapW / 2 + segLen / 2;
            addBox(scene, collidables, WALL_T, h, segLen, hx + wall.cx, hy, segZ, matWallInner, `${name}-${wall.side}D`);
          }
        }
      } else {
        // 完整墙体
        addBox(scene, collidables, wall.sx, h, wall.sz, hx + wall.cx, hy, hz + wall.cz, matWallInner, `${name}-${wall.side}`);
      }
    }

    return grp;
  }

  // ═══════════════════════════════════
  //  3a. 入口序厅
  // ═══════════════════════════════════

  const [lx, lz] = POS.lobby;
  // 南墙开门（正门入口），北墙开门（通往人物馆走廊）
  halls.lobby = buildHall(lx, lz, LOBBY_W, LOBBY_D, HALL_H, 'Lobby', [
    { side: 's', gap: 0, gapW: 4 },   // 入口大门
    { side: 'n', gap: 0, gapW: 4 },   // 通往人物馆
  ]);

  // ═══════════════════════════════════
  //  3b. 人物·中原丰碑 — V2.0 一厅三展区
  // ═══════════════════════════════════
  //  布局：
  //   ┌─────────────────┐
  //   │  Zone 1: 精神序厅 │← 南入口（从序厅来）
  //   │  中原精神之树     │
  //   ├─────────────────┤
  //   │  Zone 2: 人物展区 │
  //   │  焦裕禄 | 红旗渠  │
  //   ├─────────────────┤
  //   │  Zone 3: 传承展区 │
  //   │  精神传承互动墙   │← 北出口（通往中央大厅）
  //   └─────────────────┘

  const [px, pz] = POS.peopleHall;
  const pHalfW = HALL_W / 2;
  const pHalfD = PEOPLE_D / 2;  // 9m

  // 外围墙体（南墙开门→序厅，北墙开门→中央大厅）
  halls.peopleHall = buildHall(px, pz, HALL_W, PEOPLE_D, HALL_H, 'PeopleHall', [
    { side: 's', gap: 0, gapW: 4 },
    { side: 'n', gap: 0, gapW: 4 },
  ]);

  // ── 内部分隔墙（两道横墙，各有 3m 门洞）──
  function addDividerWall(dz, label) {
    const halfSeg = (HALL_W - 3) / 2;  // 3m 中央门洞
    const y = HALL_H / 2;
    if (halfSeg > 0.5) {
      addBox(scene, collidables, halfSeg, HALL_H, WALL_T, px - halfSeg / 2 - 1.5, y, pz + dz, matWallInner, `分隔墙-${label}-L`);
      addBox(scene, collidables, halfSeg, HALL_H, WALL_T, px + halfSeg / 2 + 1.5, y, pz + dz, matWallInner, `分隔墙-${label}-R`);
    }
  }

  // Zone 1｜2 分隔：pz + pHalfD - 6 = pz + 3  (Zone1 深6m)
  // Zone 2｜3 分隔：pz - pHalfD + 6 = pz - 3  (Zone3 深6m)
  addDividerWall(3, 'Z1Z2');
  // Zone 2 is the middle, Zone 3 is at north end
  // Actually let me recalculate:
  // Zone 1: pz + pHalfD to pz + pHalfD - 6 → Z1 south wall at pz+9, Z1 north wall at pz+3
  // Zone 2: pz + 3 to pz - 3 (middle 6m)
  // Zone 3: pz - 3 to pz - pHalfD → Z3 south wall at pz-3, Z3 north wall at pz-9
  // Divider 1 at pz+3 (between Z1/Z2)
  // Divider 2 at pz-3 (between Z2/Z3)

  // Divider at pz+3 (between Zone 1 and Zone 2)
  addDividerWall(3, 'Z1Z2');
  // Divider at pz-3 (between Zone 2 and Zone 3)
  addDividerWall(-3, 'Z2Z3');

  // ═══════════════════════════════════
  //  3b-1. 中原精神序厅 (Zone 1)
  // ═══════════════════════════════════
  //  南侧入口区，z 范围：pz+3 ~ pz+9
  //  中央：中原精神之树
  //  南墙：主题文字 "人物铸丰碑 精神传中原"

  const zone1Z = pz + pHalfD - 3;  // 序厅中心

  // 主题墙（南墙）
  const themeWallText = makeTextSprite(
    '人物铸丰碑  精神传中原',
    '中原红色人物精神展厅',
  );
  themeWallText.position.set(px, 3.2, pz + pHalfD - 1.0);
  themeWallText.scale.set(8, 1.8, 1);
  themeWallText.name = '主题墙文字';
  scene.add(themeWallText);

  // 南墙红绸装饰带
  const redBanner = new THREE.Mesh(
    new THREE.BoxGeometry(HALL_W - 0.5, 0.5, 0.08),
    new THREE.MeshStandardMaterial({ color: 0x8b1a1a, roughness: 0.4, metalness: 0.3, emissive: 0x1a0000, emissiveIntensity: 0.3 }),
  );
  redBanner.position.set(px, 3.8, pz + pHalfD - 0.6);
  redBanner.name = '南墙红绸';
  scene.add(redBanner);

  // 地面金色引导区（序厅→人物区过渡）
  const zone1Floor = new THREE.Mesh(
    new THREE.PlaneGeometry(HALL_W - 2, 4),
    new THREE.MeshStandardMaterial({ color: 0x3a3038, roughness: 0.4, metalness: 0.08 }),
  );
  zone1Floor.rotation.x = -Math.PI / 2;
  zone1Floor.position.set(px, 0.006, zone1Z);
  zone1Floor.receiveShadow = true;
  scene.add(zone1Floor);

  // ═══════════════════════════════════
  //  ★ 中原精神之树
  // ═══════════════════════════════════
  _buildSpiritTree(scene, px, zone1Z);

  // ═══════════════════════════════════
  //  3b-2. 红色人物展区 (Zone 2)
  // ═══════════════════════════════════
  //  z 范围：pz-3 ~ pz+3（中间 6m）
  //  左侧：焦裕禄人物展示单元
  //  右侧：红旗渠精神展示单元

  const zone2Z = pz;

  // —— 焦裕禄人物展示单元（左侧 X=-4 区域）——
  _buildJiaoYuluUnit(scene, collidables, px - 4, zone2Z);

  // —— 红旗渠精神展示单元（右侧 X=+4 区域）——
  _buildHongqiquUnit(scene, collidables, px + 4, zone2Z);

  // —— 中央过道铺地 ——
  const zone2Floor = new THREE.Mesh(
    new THREE.PlaneGeometry(1.5, 6),
    new THREE.MeshStandardMaterial({ color: 0x4a3a3a, roughness: 0.3, metalness: 0.15 }),
  );
  zone2Floor.rotation.x = -Math.PI / 2;
  zone2Floor.position.set(px, 0.006, zone2Z);
  zone2Floor.receiveShadow = true;
  scene.add(zone2Floor);

  // ═══════════════════════════════════
  //  3b-3. 精神传承展区 (Zone 3)
  // ═══════════════════════════════════
  //  z 范围：pz-9 ~ pz-3
  //  中央：数字精神传承互动墙 + 出口

  const zone3Z = pz - pHalfD + 3;

  // 北墙主题文字
  const futureText = makeTextSprite(
    '从中原丰碑到时代担当',
    '精神传承 · 清风永续',
  );
  futureText.position.set(px, 3.2, pz - pHalfD + 1.5);
  futureText.scale.set(7, 1.6, 1);
  futureText.name = '传承主题文字';
  scene.add(futureText);

  // 精神关键词发光柱（四根小柱排列在北墙前）
  const keywords = ['亲民爱民', '艰苦奋斗', '科学求实', '无私奉献'];
  for (let ki = 0; ki < keywords.length; ki++) {
    const kCol = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.28, 1.2, 12),
      new THREE.MeshStandardMaterial({ color: 0x8b5543, roughness: 0.3, metalness: 0.4, emissive: 0x1a0a00, emissiveIntensity: 0.2 }),
    );
    kCol.position.set(px - 4.5 + ki * 3, 0.6, pz - pHalfD + 4);
    kCol.castShadow = true;
    kCol.receiveShadow = true;
    kCol.name = `关键词柱-${keywords[ki]}`;
    scene.add(kCol);

    // 关键词标签
    const kwSprite = makeTextSprite(keywords[ki], '');
    kwSprite.position.set(px - 4.5 + ki * 3, 1.7, pz - pHalfD + 4);
    kwSprite.scale.set(2.5, 0.7, 1);
    scene.add(kwSprite);
  }

  // 出口门洞金色门框
  const doorFrameL = new THREE.Mesh(
    new THREE.BoxGeometry(0.15, HALL_H - 0.4, 0.25),
    matGold,
  );
  doorFrameL.position.set(px - 2.15, HALL_H / 2, pz - pHalfD + WALL_T);
  doorFrameL.name = '北门框-L';
  scene.add(doorFrameL);

  const doorFrameR = new THREE.Mesh(
    new THREE.BoxGeometry(0.15, HALL_H - 0.4, 0.25),
    matGold,
  );
  doorFrameR.position.set(px + 2.15, HALL_H / 2, pz - pHalfD + WALL_T);
  doorFrameR.name = '北门框-R';
  scene.add(doorFrameR);

  // ═══════════════════════════════════
  //  3c. 传承·见证致远（尾厅，北）
  // ═══════════════════════════════════

  const [fx, fz] = POS.futureHall;
  halls.futureHall = buildHall(fx, fz, HALL_W, HALL_D, HALL_H, 'FutureHall', [
    { side: 's', gap: 0, gapW: 4.5 }, // 从中央大厅进入
    // 北墙封闭 — 尾厅无出口
  ]);

  // ═══════════════════════════════════
  //  3d. 制度·纪律之源（西）
  // ═══════════════════════════════════

  const [rx, rz] = POS.ruleHall;
  halls.ruleHall = buildHall(rx, rz, HALL_W, HALL_D, HALL_H, 'RuleHall', [
    { side: 'e', gap: 0, gapW: 4.5 },  // 从中央大厅进入
  ]);

  // ═══════════════════════════════════
  //  3e. 郑大·清风传家（东）
  // ═══════════════════════════════════

  const [zx, zz] = POS.zzuHall;
  halls.zzuHall = buildHall(zx, zz, HALL_W, HALL_D, HALL_H, 'ZZUHall', [
    { side: 'w', gap: 0, gapW: 4.5 },  // 从中央大厅进入
  ]);

  // ═══════════════════════════════════
  //  4. 中央大厅墙体（连接各走廊）
  // ═══════════════════════════════════

  buildHall(cx, cz, CENTER_W, CENTER_W, CENTER_H, 'CentralHall', [
    { side: 's', gap: 0, gapW: CORRIDOR_W },  // 通往人物馆
    { side: 'n', gap: 0, gapW: CORRIDOR_W },  // 通往传承馆
    { side: 'e', gap: 0, gapW: CORRIDOR_W },  // 通往郑大馆
    { side: 'w', gap: 0, gapW: CORRIDOR_W },  // 通往制度馆
  ]);

  // ═══════════════════════════════════
  //  5. 走廊连接墙体
  // ═══════════════════════════════════

  // 走廊：各展厅门洞到中央大厅门洞之间加两侧墙
  function addCorridorWalls(fromX, fromZ, toX, toZ, gapW) {
    const dx = toX - fromX;
    const dz = toZ - fromZ;
    const len = Math.sqrt(dx * dx + dz * dz);
    if (len < 0.5) return;
    const midX = (fromX + toX) / 2;
    const midZ = (fromZ + toZ) / 2;
    const angle = Math.atan2(dz, dx);
    const perpX = Math.cos(angle + Math.PI / 2);
    const perpZ = Math.sin(angle + Math.PI / 2);
    const halfGap = gapW / 2;

    // 两侧墙体
    for (const sign of [-1, 1]) {
      const wx = midX + perpX * halfGap * sign;
      const wz = midZ + perpZ * halfGap * sign;
      const wallMesh = new THREE.Mesh(boxGeo(Math.abs(dx) || WALL_T, HALL_H, Math.abs(dz) || WALL_T), matWallInner);
      wallMesh.position.set(wx, HALL_H / 2, wz);
      wallMesh.castShadow = true;
      wallMesh.receiveShadow = true;
      wallMesh.name = '走廊墙';
      scene.add(wallMesh);
      collidables.push(wallMesh);
    }
  }

  // 人物馆北墙 → 中央大厅南墙 走廊 (人物Z=-1 到中央Z=-6，间距5m)
  const peopleNorthZ = pz - PEOPLE_D / 2;
  const centralSouthZ = cz - CENTER_W / 2;
  addCorridorWalls(px, peopleNorthZ + WALL_T, cx, centralSouthZ - WALL_T, CORRIDOR_W);

  // 中央→传承 (南北)
  const centralNorthZ = cz + CENTER_W / 2;
  const futureSouthZ = fz + HALL_D / 2;
  addCorridorWalls(cx, centralNorthZ + WALL_T, fx, futureSouthZ - WALL_T, CORRIDOR_W);

  // 中央→制度 (东西)
  const centralWestX = cx - CENTER_W / 2;
  const ruleEastX = rx + HALL_W / 2;
  addCorridorWalls(centralWestX - WALL_T, cz, ruleEastX + WALL_T, rz, CORRIDOR_W);

  // 中央→郑大 (东西)
  const centralEastX = cx + CENTER_W / 2;
  const zzuWestX = zx - HALL_W / 2;
  addCorridorWalls(centralEastX + WALL_T, cz, zzuWestX - WALL_T, zz, CORRIDOR_W);

  // 人物→序厅 走廊 (人物南墙Z=17 到序厅北墙Z=14，间距3m)
  const peopleSouthZ = pz + PEOPLE_D / 2;
  const lobbyNorthZ = lz - LOBBY_D / 2;
  addCorridorWalls(px, peopleSouthZ + WALL_T, lx, lobbyNorthZ - WALL_T, CORRIDOR_W);

  // ═══════════════════════════════════
  //  6. 金色导览线
  // ═══════════════════════════════════

  function addGuideLine(x1, z1, x2, z2) {
    const mx = (x1 + x2) / 2;
    const mz = (z1 + z2) / 2;
    const dx = x2 - x1;
    const dz = z2 - z1;
    const len = Math.sqrt(dx * dx + dz * dz);
    const angle = Math.atan2(dz, dx);

    const lineGeo = new THREE.BoxGeometry(len, 0.015, 0.08);
    const line = new THREE.Mesh(lineGeo, matGold);
    line.position.set(mx, 0.01, mz);
    line.rotation.y = angle;
    line.receiveShadow = true;
    line.name = '导览线';
    scene.add(line);

    // 两侧镶边
    for (const side of [-1, 1]) {
      const edgeGeo = new THREE.BoxGeometry(len, 0.015, 0.015);
      const edge = new THREE.Mesh(edgeGeo, new THREE.MeshStandardMaterial({
        color: 0x8a6a3a, roughness: 0.2, metalness: 0.8,
      }));
      edge.position.set(mx, 0.008, mz + side * 0.04);
      edge.rotation.y = angle;
      edge.name = '导览线边';
      scene.add(edge);
    }
  }

  // 导览线路径
  addGuideLine(lx, lz - LOBBY_D / 2 + 1, lx, lz + LOBBY_D / 2 - 1); // 序厅南北
  addGuideLine(px, pz - PEOPLE_D / 2 + 0.5, px, pz + PEOPLE_D / 2 - 0.5); // 人物馆 V2 南北（18m）
  addGuideLine(cx, cz - CENTER_W / 2 + 0.5, cx, cz + CENTER_W / 2 - 0.5); // 中央南北
  addGuideLine(fx, fz - HALL_D / 2 + 0.5, fx, fz + HALL_D / 2 - 0.5); // 传承南北
  addGuideLine(cx - CENTER_W / 2 + 0.5, cz, cx + CENTER_W / 2 - 0.5, cz); // 中央东西

  // ═══════════════════════════════════
  //  7. 外围建筑外墙
  // ═══════════════════════════════════

  // 用简化方式：给每个独立展区的外墙加厚装饰面
  // 实际项目中外墙由 Blender 模型提供，这里只做最简包围

  const bxMin = BUILDING.xMin, bxMax = BUILDING.xMax;
  const bzMin = BUILDING.zMin, bzMax = BUILDING.zMax;
  const bxMid = (bxMin + bxMax) / 2;
  const bzMid = (bzMin + bzMax) / 2;
  const bw = bxMax - bxMin;
  const bd = bzMax - bzMin;

  // 不包围整体，而是给走廊外侧未封闭处补墙
  // 这里保持简洁 — Blender 模型会提供完整外墙

  // ═══════════════════════════════════
  //  8. 灯光系统
  // ═══════════════════════════════════

  addExhibitionLights(scene);

  // ═══════════════════════════════════
  //  9. 展厅标识牌（3D Sprite）
  // ═══════════════════════════════════

  const signDefs = [
    { key: 'lobby',       pos: POS.lobby,       text: '序厅',       sub: '廉花郑放·赓续清风' },
    { key: 'peopleHall',  pos: POS.peopleHall,  text: '人物·中原丰碑', sub: '红色人物廉洁精神' },
    { key: 'centralHall', pos: POS.centralHall, text: '中央档案大厅', sub: '数字档案装置' },
    { key: 'ruleHall',    pos: POS.ruleHall,    text: '制度·纪律之源', sub: '红色纪律建设历史' },
    { key: 'zzuHall',     pos: POS.zzuHall,     text: '郑大·清风传家', sub: '校史廉洁文化' },
    { key: 'futureHall',  pos: POS.futureHall,  text: '传承·见证致远', sub: '数字廉洁互动墙' },
  ];

  for (const def of signDefs) {
    const sprite = makeSignSprite(def.text, def.sub);
    sprite.position.set(def.pos[0], HALL_H - 1.0, def.pos[1]);
    sprite.scale.set(5, 2, 1);
    sprite.name = `标识牌-${def.text}`;
    scene.add(sprite);

    // 挂牌底座装饰线
    const baseGeo = new THREE.BoxGeometry(5.5, 0.06, 0.12);
    const baseLine = new THREE.Mesh(baseGeo, matGold);
    baseLine.position.set(def.pos[0], HALL_H - 1.7, def.pos[1]);
    baseLine.name = `牌匾底座-${def.text}`;
    scene.add(baseLine);
  }

  // ═══════════════════════════════════
  //  10. 出生点
  // ═══════════════════════════════════

  const spawn = {
    position: new THREE.Vector3(lx, 1.6, lz + LOBBY_D / 2 - 1.5),
    lookAt: new THREE.Vector3(0, 1.4, 0), // 面朝中央大厅方向
  };

  // ═══════════════════════════════════
  //  11. 地面网格（调试用）
  // ═══════════════════════════════════

  // const grid = new THREE.GridHelper(
  //   Math.max(floorW, floorD),
  //   Math.max(floorW, floorD),
  //   0x444444, 0x333333,
  // );
  // grid.position.y = 0.003;
  // scene.add(grid);

  console.log(`🏛️  展厅空间构建完成`);
  console.log(`   展厅: 序厅 + 4主题馆 + 中央大厅`);
  console.log(`   碰撞体: ${collidables.length}`);
  console.log(`   出生点: 序厅入口 (${spawn.position.x.toFixed(1)}, ${spawn.position.z.toFixed(1)})`);

  return { scene, collidables, halls, spawn };
}

/**
 * 向场景添加专业级展厅灯光套件。
 *
 * 三层灯光体系：
 *   1. 环境光 — 全局暗部提亮
 *   2. 主方向光 — 模拟天窗日光（投射阴影）
 *   3. 展厅区域光 — 每个展厅独立暖色点光源
 *   4. 展柜射灯 — 展台/展品重点照明（聚光灯）
 *
 * @param {THREE.Scene} targetScene
 */
export function addExhibitionLights(targetScene) {
  // ── 1. 环境光 — 深紫灰调，模拟博物馆暗光 ──
  const ambient = new THREE.AmbientLight(0x3a3048, 0.4);
  targetScene.add(ambient);

  // ── 2. 半球光 — 天空/地面双色 ──
  const hemi = new THREE.HemisphereLight(0xddeeff, 0x3a2830, 0.25);
  targetScene.add(hemi);

  // ── 3. 主方向光 — 模拟天窗，2048 阴影贴图 ──
  const sun = new THREE.DirectionalLight(0xffeedd, 0.9);
  sun.position.set(8, 16, 5);
  sun.castShadow = true;
  sun.shadow.mapSize.width = 2048;
  sun.shadow.mapSize.height = 2048;
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 55;
  sun.shadow.camera.left = -25;
  sun.shadow.camera.right = 25;
  sun.shadow.camera.top = 25;
  sun.shadow.camera.bottom = -25;
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.02;
  targetScene.add(sun);

  // ── 4. 补光 — 冷色调，消除暗部死黑 ──
  const fill = new THREE.DirectionalLight(0xccbbff, 0.28);
  fill.position.set(-6, 5, -8);
  targetScene.add(fill);

  // ── 5. 底部反弹光 — 模拟地面反射 ──
  const bounce = new THREE.DirectionalLight(0x5a4a3a, 0.15);
  bounce.position.set(0, 0.5, 0);
  targetScene.add(bounce);

  // ── 6. 各区展厅主灯 — 暖色点光源（投射柔和阴影）──
  const hallLights = [
    { pos: HALL_POSITIONS.lobby, intensity: 1.2 },
    { pos: HALL_POSITIONS.peopleHall, intensity: 1.0 },
    { pos: HALL_POSITIONS.centralHall, intensity: 1.6 },
    { pos: HALL_POSITIONS.futureHall, intensity: 1.0 },
    { pos: HALL_POSITIONS.ruleHall, intensity: 1.0 },
    { pos: HALL_POSITIONS.zzuHall, intensity: 1.0 },
  ];

  for (const { pos, intensity } of hallLights) {
    const light = new THREE.PointLight(0xffeedd, intensity, 18, 0.6);
    light.position.set(pos[0], HALL_H - 0.8, pos[1]);
    light.castShadow = true;
    light.shadow.mapSize.width = 512;
    light.shadow.mapSize.height = 512;
    light.shadow.bias = -0.0005;
    targetScene.add(light);
  }

  // ── 7. 展台射灯（中央大厅四盏）──
  const [cx, cz] = HALL_POSITIONS.centralHall;
  const spotAngles = [
    [cx + 2, cz + 2],
    [cx - 2, cz + 2],
    [cx + 2, cz - 2],
    [cx - 2, cz - 2],
  ];

  for (const [sx, sz] of spotAngles) {
    const spot = new THREE.SpotLight(0xffeedd, 1.2, 14, Math.PI / 9, 0.5, 0.6);
    spot.position.set(sx, HALL_H - 0.6, sz);
    const target = new THREE.Object3D();
    target.position.set(sx, 0.8, sz);
    targetScene.add(target);
    spot.target = target;
    spot.castShadow = true;
    spot.shadow.mapSize.width = 512;
    spot.shadow.mapSize.height = 512;
    spot.shadow.bias = -0.0003;
    targetScene.add(spot);
  }

  // ── 8. 走廊补灯 — 小型点光源 ──
  const corridorLights = [
    [0, -4],  [0, 3],   // 中央南北走廊
    [-3, 0],  [3, 0],   // 中央东西走廊
    [0, 12],             // 序厅-人物馆
    [0, -6.5],           // 中央北-传承
  ];

  for (const [lx2, lz2] of corridorLights) {
    const cl = new THREE.PointLight(0xffddaa, 0.4, 10, 0.5);
    cl.position.set(lx2, HALL_H - 0.6, lz2);
    targetScene.add(cl);
  }
}

// ═══════════════════════════════════════
//  PeopleHall 子构建函数
// ═══════════════════════════════════════

/**
 * 中原精神之树 — 中央雕塑装置
 * 树干 + 四根分支，代表焦裕禄精神、红旗渠精神、大别山精神、愚公移山精神
 */
function _buildSpiritTree(scene, tx, tz) {
  const treeY = 0;

  // 底座 — 八角形平台
  const baseGeo = new THREE.CylinderGeometry(0.9, 1.0, 0.2, 8);
  const base = new THREE.Mesh(baseGeo, matStone);
  base.position.set(tx, 0.1, tz);
  base.castShadow = true;
  base.receiveShadow = true;
  base.name = '精神树底座';
  scene.add(base);

  // 树干 — 红木色圆柱
  const trunkGeo = new THREE.CylinderGeometry(0.15, 0.25, 2.8, 12);
  const trunk = new THREE.Mesh(trunkGeo, matWood);
  trunk.position.set(tx, 1.5, tz);
  trunk.castShadow = true;
  trunk.name = '精神树树干';
  scene.add(trunk);

  // 树冠 — 球形叶簇
  const crownGeo = new THREE.SphereGeometry(0.7, 12, 10);
  const crown = new THREE.Mesh(crownGeo, new THREE.MeshStandardMaterial({
    color: 0x4a6b3a, roughness: 0.6, metalness: 0.05,
  }));
  crown.position.set(tx, 3.1, tz);
  crown.name = '精神树冠';
  scene.add(crown);

  // 四根分支
  const branchLabels = [
    { text: '焦裕禄精神', angle: 0, color: 0xc9a96e },
    { text: '红旗渠精神', angle: Math.PI / 2, color: 0x8faacc },
    { text: '大别山精神', angle: Math.PI, color: 0xcc8f8f },
    { text: '愚公移山精神', angle: -Math.PI / 2, color: 0x8fcc8f },
  ];

  for (const br of branchLabels) {
    const bx = tx + Math.cos(br.angle) * 0.5;
    const bz = tz + Math.sin(br.angle) * 0.5;

    // 分支杆
    const branchGeo = new THREE.CylinderGeometry(0.04, 0.06, 1.3, 8);
    const branch = new THREE.Mesh(branchGeo, new THREE.MeshStandardMaterial({
      color: br.color, roughness: 0.3, metalness: 0.6,
    }));
    branch.position.set(bx, 2.2, bz);
    // 倾斜指向外侧
    branch.rotation.z = Math.cos(br.angle) * 0.6;
    branch.rotation.x = Math.sin(br.angle) * 0.6;
    branch.name = `分支-${br.text}`;
    scene.add(branch);

    // 末端叶片球
    const leafGeo = new THREE.SphereGeometry(0.15, 8, 6);
    const leaf = new THREE.Mesh(leafGeo, new THREE.MeshStandardMaterial({
      color: 0x5a8b4a, roughness: 0.5, metalness: 0.05,
      emissive: 0x0a1a00, emissiveIntensity: 0.15,
    }));
    leaf.position.set(bx + Math.cos(br.angle) * 0.7, 2.6, bz + Math.sin(br.angle) * 0.7);
    leaf.name = `叶片-${br.text}`;
    scene.add(leaf);

    // 标签精灵
    const label = makeTextSprite(br.text, '');
    label.position.set(bx + Math.cos(br.angle) * 1.3, 2.6, bz + Math.sin(br.angle) * 1.3);
    label.scale.set(2.2, 0.5, 1);
    scene.add(label);
  }
}

/**
 * 焦裕禄人物展示单元
 * 包含：KT 立牌 + 档案台 + 展示屏 + 语录墙
 */
function _buildJiaoYuluUnit(scene, coll, ux, uz) {
  const unitY = 0;

  // —— 人形 KT 板（简化：深绿色矩形 + 人物轮廓） ——
  const ktBaseGeo = new THREE.BoxGeometry(0.8, 2.2, 0.15);
  const ktBase = new THREE.Mesh(ktBaseGeo, new THREE.MeshStandardMaterial({
    color: 0x2a3a2a, roughness: 0.5, metalness: 0.05,
  }));
  ktBase.position.set(ux - 1.5, 1.1, uz);
  ktBase.name = '焦裕禄-KT板';
  ktBase.castShadow = true;
  scene.add(ktBase);

  // KT 板顶部红色标题条
  const ktTitle = makeTextSprite('焦桐常青', '丰碑永驻');
  ktTitle.position.set(ux - 1.5, 2.5, uz + 0.1);
  ktTitle.scale.set(1.6, 0.5, 1);
  scene.add(ktTitle);

  // 语录条
  const quote = makeTextSprite(
    '"心中装着全体人民，唯独没有他自己"',
    '—— 焦裕禄',
  );
  quote.position.set(ux - 1.5, 0.7, uz + 0.1);
  quote.scale.set(3.5, 0.5, 1);
  scene.add(quote);

  // —— 档案展台 ——
  const deskGeo = new THREE.BoxGeometry(1.5, 1.0, 1.0);
  const desk = new THREE.Mesh(deskGeo, matWood);
  desk.position.set(ux + 0.5, 0.5, uz - 1);
  desk.castShadow = true;
  desk.receiveShadow = true;
  desk.name = '焦裕禄-档案展台';
  scene.add(desk);
  coll.push(desk);

  // 展台上方玻璃展柜
  const glassGeo = new THREE.BoxGeometry(1.3, 0.6, 0.8);
  const glassCase = new THREE.Mesh(glassGeo, matGlass);
  glassCase.position.set(ux + 0.5, 1.3, uz - 1);
  glassCase.name = '焦裕禄-玻璃展柜';
  scene.add(glassCase);
  coll.push(glassCase);

  // 展台标签
  const deskLabel = makeTextSprite('干部十不准', '廉洁奉公档案');
  deskLabel.position.set(ux + 0.5, 1.9, uz - 0.5);
  deskLabel.scale.set(2.2, 0.6, 1);
  scene.add(deskLabel);

  // —— 展示屏（发光平面） ——
  const screenGeo = new THREE.PlaneGeometry(1.8, 1.2);
  const screen = new THREE.Mesh(screenGeo, new THREE.MeshBasicMaterial({
    color: 0xeeddcc,
    // 后续可替换为实际图片纹理
  }));
  screen.position.set(ux + 0.5, 1.6, uz + 1.2);
  screen.name = '焦裕禄-展示屏';
  scene.add(screen);

  // 屏幕边框
  const screenFrame = new THREE.Mesh(
    new THREE.BoxGeometry(2.0, 1.4, 0.05),
    matDarkMetal,
  );
  screenFrame.position.set(ux + 0.5, 1.6, uz + 1.15);
  screenFrame.name = '展示屏边框';
  scene.add(screenFrame);

  // 屏幕标签
  const screenLabel = makeTextSprite('兰考治沙故事', '影像档案');
  screenLabel.position.set(ux + 0.5, 0.6, uz + 1.2);
  screenLabel.scale.set(2.5, 0.5, 1);
  scene.add(screenLabel);
}

/**
 * 红旗渠精神展示单元
 * 岩壁背景 + 蓝色水流 + 精神关键词
 */
function _buildHongqiquUnit(scene, coll, ux, uz) {
  // —— 太行山岩壁（不规则块体模拟） ——
  const rockMat = new THREE.MeshStandardMaterial({
    color: 0x6b5a4a, roughness: 0.85, metalness: 0.02,
  });

  for (let ri = 0; ri < 5; ri++) {
    const rw = 0.8 + Math.random() * 1.2;
    const rh = 1.5 + Math.random() * 1.5;
    const rx = ux + 1.5 + (ri - 2) * 0.7;
    const rz = uz - 0.5 + (ri % 2) * 0.5;
    const rock = new THREE.Mesh(
      new THREE.BoxGeometry(rw, rh, 0.3),
      rockMat,
    );
    rock.position.set(rx, rh / 2, rz);
    rock.castShadow = true;
    rock.receiveShadow = true;
    rock.rotation.y = (Math.random() - 0.5) * 0.3;
    rock.name = `岩壁-${ri}`;
    scene.add(rock);
  }

  // —— 蓝色水流（发光平面） ——
  const waterGeo = new THREE.PlaneGeometry(2.5, 0.6);
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x4488cc,
    roughness: 0.2,
    metalness: 0.3,
    emissive: 0x112244,
    emissiveIntensity: 0.4,
  });
  const water = new THREE.Mesh(waterGeo, waterMat);
  water.position.set(ux + 1.5, 0.8, uz + 1.0);
  water.name = '红旗渠水流';
  scene.add(water);

  // 水流上方标签
  const hqLabel = makeTextSprite('自力更生  艰苦创业', '团结协作  无私奉献');
  hqLabel.position.set(ux + 1.5, 1.6, uz + 1.0);
  hqLabel.scale.set(4, 0.6, 1);
  scene.add(hqLabel);

  // —— 标识牌 ——
  const hqTitle = makeTextSprite('红旗渠精神', '太行山上的廉洁丰碑');
  hqTitle.position.set(ux + 1.5, 2.6, uz - 1.0);
  hqTitle.scale.set(3, 0.7, 1);
  scene.add(hqTitle);

  // 小型展台
  const hqPedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.4, 0.8, 12),
    matStone,
  );
  hqPedestal.position.set(ux + 1.5, 0.4, uz - 1.2);
  hqPedestal.castShadow = true;
  hqPedestal.receiveShadow = true;
  hqPedestal.name = '红旗渠展台';
  scene.add(hqPedestal);
  coll.push(hqPedestal);
}

/**
 * 生成文字精灵（Canvas 纹理）
 * @param {string} line1 — 第一行
 * @param {string} line2 — 第二行（可选）
 * @returns {THREE.Sprite}
 */
function makeTextSprite(line1, line2) {
  const w = 1024, h = line2 ? 320 : 200;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');

  if (line2) {
    ctx.fillStyle = 'rgba(0,0,0,0)';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#e8d5b0';
    ctx.font = 'bold 48px "Microsoft YaHei","PingFang SC",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(line1, w / 2, h * 0.38);
    ctx.fillStyle = '#9a8a6a';
    ctx.font = '34px "Microsoft YaHei","PingFang SC",sans-serif';
    ctx.fillText(line2, w / 2, h * 0.72);
  } else {
    ctx.fillStyle = 'rgba(0,0,0,0)';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#e8d5b0';
    ctx.font = 'bold 42px "Microsoft YaHei","PingFang SC",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(line1, w / 2, h / 2);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.premultiplyAlpha = true;

  const mat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
  });
  return new THREE.Sprite(mat);
}

// ═══════════════════════════════════════
//  Canvas 纹理 → Sprite 标识牌（展厅门楣用）
// ═══════════════════════════════════════

function makeSignSprite(title, subtitle) {
  const w = 1024, h = 384;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');

  // 背景 — 半透明暗底
  ctx.fillStyle = 'rgba(20, 12, 16, 0.82)';
  const r = 28;
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(w - r, 0);
  ctx.quadraticCurveTo(w, 0, w, r);
  ctx.lineTo(w, h - r);
  ctx.quadraticCurveTo(w, h, w - r, h);
  ctx.lineTo(r, h);
  ctx.quadraticCurveTo(0, h, 0, h - r);
  ctx.lineTo(0, r);
  ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.closePath();
  ctx.fill();

  // 金色边框
  ctx.strokeStyle = '#c9a96e';
  ctx.lineWidth = 6;
  ctx.stroke();

  // 内细线框
  ctx.strokeStyle = 'rgba(201, 169, 110, 0.45)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(20, 20, w - 40, h - 40);

  // 标题文字
  ctx.fillStyle = '#e8d5b0';
  ctx.font = 'bold 72px "Microsoft YaHei", "PingFang SC", "Noto Sans SC", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, w / 2, h * 0.42);

  // 副标题
  ctx.fillStyle = '#9a8a6a';
  ctx.font = '36px "Microsoft YaHei", "PingFang SC", "Noto Sans SC", sans-serif';
  ctx.fillText(subtitle, w / 2, h * 0.72);

  // 顶部装饰点
  ctx.fillStyle = '#c9a96e';
  ctx.beginPath();
  ctx.arc(w / 2, 50, 10, 0, Math.PI * 2);
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.colorSpace = THREE.SRGBColorSpace;

  const spriteMat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
  });

  return new THREE.Sprite(spriteMat);
}

// ═══════════════════════════════════════
//  展区坐标查询（导航用）
// ═══════════════════════════════════════

export const HALL_POSITIONS = POS;
