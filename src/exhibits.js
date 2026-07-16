/**
 * exhibits.js — 展品数据与 3D 标记管理模块
 *
 * 职责:
 *   1. 加载 exhibits.json
 *   2. 在各展厅生成展品 3D 标记物体（展台 + 悬浮水晶指示器）
 *   3. 建立 Object3D → exhibitId 映射
 *
 * 用法:
 *   const mgr = new ExhibitsManager(scene, hallPositions);
 *   await mgr.load('/assets/exhibits.json');
 *   const markers = mgr.getMarkers();
 *   // markers 可直接传给 InteractionManager.register()
 *   // 点击回调中: mgr.getById(exhibitId)
 */

import * as THREE from 'three';

// ── 标记几何体（静态复用）──
const pedestalGeo = new THREE.CylinderGeometry(0.3, 0.35, 1.0, 16);
const indicatorGeo = new THREE.OctahedronGeometry(0.25, 0);

const matPedestal = new THREE.MeshStandardMaterial({
  color: 0x4a3a2a, roughness: 0.35, metalness: 0.3,
});
const matIndicator = new THREE.MeshStandardMaterial({
  color: 0xc9a96e, roughness: 0.2, metalness: 0.8,
  emissive: 0x332200, emissiveIntensity: 0.3,
});
const matBase = new THREE.MeshStandardMaterial({
  color: 0x5a4a3a, roughness: 0.5, metalness: 0.15,
});

export class ExhibitsManager {
  /**
   * @param {THREE.Scene} scene
   * @param {Object<string, [number,number]>} hallPositions — { hallKey: [x, z] }
   */
  constructor(scene, hallPositions) {
    this.scene = scene;
    this.hallPositions = hallPositions;

    /** @type {Map<string, Object>} exhibitId → exhibitData */
    this._data = new Map();

    /** @type {Map<string, THREE.Object3D>} exhibitId → markerRoot */
    this._markers = new Map();

    /** @type {Map<THREE.Object3D, string>} mesh → exhibitId */
    this._meshMap = new Map();
  }

  /**
   * 加载展品数据并生成 3D 标记
   * @param {string} url — exhibits.json 路径
   */
  async load(url) {
    // 1) 加载 JSON
    let items;
    try {
      const res = await fetch(url);
      items = await res.json();
    } catch (e) {
      console.warn('⚠️  exhibits.json 加载失败:', e.message);
      items = this._fallbackData();
    }

    // 2) 存入 Map
    for (const item of items) {
      this._data.set(item.id, item);
    }

    // 3) 按展厅分组，生成 3D 标记
    const byHall = {};
    for (const item of items) {
      const hall = item.hall || 'centralHall';
      if (!byHall[hall]) byHall[hall] = [];
      byHall[hall].push(item);
    }

    for (const [hallKey, hallItems] of Object.entries(byHall)) {
      const pos = this.hallPositions[hallKey];
      if (!pos) continue;
      this._placeExhibits(hallKey, hallItems, pos);
    }

    console.log(`📦 展品数据: ${items.length} 条, ${this._markers.size} 个 3D 标记`);

    return items;
  }

  /**
   * 在指定展厅空间内排布展品标记
   */
  _placeExhibits(hallKey, items, [cx, cz]) {
    const count = items.length;

    // 布局: 沿 X 轴排列，间距 3m，占据展厅宽度的 70%
    const spread = Math.min(count * 2.8, 11);
    const startX = cx - spread / 2;

    for (let i = 0; i < count; i++) {
      const item = items[i];
      const x = startX + i * (spread / Math.max(count - 1, 1)) + (count === 1 ? spread / 2 : 0);
      const y = 0;
      const z = cz;  // 展厅中心 Z

      const markerRoot = this._createMarker(item, x, y, z);
      this._markers.set(item.id, markerRoot);
    }
  }

  /**
   * 创建单个展品 3D 标记
   */
  _createMarker(item, x, y, z) {
    const root = new THREE.Group();
    root.name = `exhibit-${item.id}`;
    root.position.set(x, y, z);

    // 底座
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.4, 0.45, 0.15, 16),
      matBase,
    );
    base.position.y = 0.075;
    base.castShadow = true;
    base.receiveShadow = true;
    base.name = '底座';
    root.add(base);

    // 展台
    const pedestal = new THREE.Mesh(pedestalGeo, matPedestal);
    pedestal.position.y = 0.55;
    pedestal.castShadow = true;
    pedestal.receiveShadow = true;
    pedestal.name = '展台';
    root.add(pedestal);

    // 悬浮水晶指示器
    const indicator = new THREE.Mesh(indicatorGeo, matIndicator);
    indicator.position.y = 1.35;
    indicator.castShadow = true;
    indicator.name = '指示器';
    root.add(indicator);

    // 金色光环
    const ringGeo = new THREE.TorusGeometry(0.42, 0.03, 8, 32);
    const ring = new THREE.Mesh(ringGeo, matIndicator);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 1.35;
    ring.name = '光环';
    root.add(ring);

    // 台面装饰线
    const trimGeo = new THREE.TorusGeometry(0.33, 0.02, 8, 16);
    const trim = new THREE.Mesh(trimGeo, matIndicator);
    trim.rotation.x = Math.PI / 2;
    trim.position.y = 1.0;
    trim.name = '台面线';
    root.add(trim);

    // 标记可点击的物体（展台柱体 + 指示器 + 环）
    const clickables = [pedestal, indicator, ring, trim];
    for (const m of clickables) {
      this._meshMap.set(m, item.id);
    }

    this.scene.add(root);
    return root;
  }

  // ── 查询接口 ──

  /** 根据 id 获取展品数据 */
  getById(id) {
    return this._data.get(id) || null;
  }

  /** 根据被点击的 mesh 查找 exhibitId */
  getIdFromMesh(mesh) {
    return this._meshMap.get(mesh) || null;
  }

  /** 获取所有 3D 标记的根节点列表（传给 InteractionManager） */
  getMarkerRoots() {
    return Array.from(this._markers.values());
  }

  /** 获取所有标记内的可交互 mesh */
  getClickableMeshes() {
    return Array.from(this._meshMap.keys());
  }

  /**
   * 每帧更新：指示器悬浮旋转动画
   * @param {number} time — 运行时间（秒）
   */
  update(time) {
    for (const root of this._markers.values()) {
      const indicator = root.children.find((c) => c.name === '指示器');
      const ring = root.children.find((c) => c.name === '光环');
      if (indicator) {
        indicator.rotation.y = time * 1.2;
        indicator.position.y = 1.35 + Math.sin(time * 2.5) * 0.08;
      }
      if (ring) {
        ring.rotation.z = time * 0.6;
        ring.position.y = indicator ? indicator.position.y : 1.35;
      }
    }
  }

  /** 销毁所有标记 */
  dispose() {
    for (const root of this._markers.values()) {
      this.scene.remove(root);
    }
    this._markers.clear();
    this._meshMap.clear();
    this._data.clear();
  }

  // ── 降级数据（JSON 加载失败时使用）──
  _fallbackData() {
    return [
      {
        id: 'jiaoyulu',
        title: '焦裕禄',
        subtitle: '人民的好公仆',
        type: 'person', hall: 'peopleHall', year: '1922年 — 1964年',
        description: '焦裕禄同志是县委书记的榜样，带领兰考人民战天斗地。',
        highlight: '共产党员应该在群众最困难的时候，出现在群众面前。',
        sections: [
          { heading: '生平事迹', body: '焦裕禄，1922年出生于山东省淄博市。1962年调任兰考县委书记，带领全县人民治理内涝、风沙、盐碱三大自然灾害。1964年病逝，年仅42岁。' },
          { heading: '廉洁故事', body: '焦裕禄一生清正廉洁：用棍子顶肝止痛也不占公家便宜、教育子女不准搞特殊化、骑自行车下乡调研从不坐公车。' },
          { heading: '焦裕禄精神', body: '亲民爱民、艰苦奋斗、科学求实、迎难而上、无私奉献——习近平总书记概括的焦裕禄精神五个方面。' },
        ],
        images: [], video: '',
      },
      {
        id: 'wanghebo',
        title: '王荷波',
        subtitle: '党的早期纪律建设先驱',
        type: 'person', hall: 'peopleHall', year: '1882年 — 1927年',
        description: '党的纪律检查工作的开创者，1927年在党的五大上当选中央监察委员会首任主席。',
        highlight: '纪律是党的生命线，没有铁的纪律，就没有坚强的党。',
        sections: [
          { heading: '革命生平', body: '王荷波，福建福州人，早期工人运动领袖。1922年入党，1927年当选首任中央监察委员会主席，同年牺牲。' },
        ],
        images: [], video: '',
      },
      {
        id: 'jiwenfu',
        title: '嵇文甫',
        subtitle: '学界楷模·廉洁典范',
        type: 'person', hall: 'peopleHall', year: '1895年 — 1963年',
        description: '著名历史学家、教育家，郑州大学首任校长。治学严谨、清廉自守。',
        highlight: '以德立身，以学立言。做学问先做人，做人先修德。',
        sections: [
          { heading: '学术人生', body: '嵇文甫，1895年生于河南汲县。北京大学哲学系毕业，赴苏联留学。1956年筹建郑州大学并任首任校长。' },
          { heading: '廉洁治校', body: '建校初期条件艰苦，嵇文甫和师生同住简易宿舍，不使用公车，不公款吃喝，坚持每一分钱用在刀刃上。' },
        ],
        images: [], video: '',
      },
      {
        id: 'zhangrenya',
        title: '张人亚',
        subtitle: '党章守护者',
        type: 'person', hall: 'peopleHall', year: '1898年 — 1932年',
        description: '用生命守护中共首部党章等珍贵文献，书写了用生命守卫信仰的传奇。',
        highlight: '这是一位比生命还重要的托付——守护党的文献，就是守护信仰的根。',
        sections: [
          { heading: '衣冠冢的托付', body: '1927年大革命失败后，张人亚将党的机密文件托付父亲保管。父亲修衣冠冢藏文献，守墓二十余年，直至新中国成立。' },
        ],
        images: [], video: '',
      },
      {
        id: 'sanda-jilv',
        title: '三大纪律八项注意',
        subtitle: '人民军队铁的纪律',
        type: 'rule', hall: 'ruleHall', year: '1927年 — 至今',
        description: '中国人民解放军的优良传统和行动准则，体现全心全意为人民服务的宗旨。',
        highlight: '一切行动听指挥，不拿群众一针一线，一切缴获要归公。',
        sections: [
          { heading: '三大纪律', body: '一切行动听指挥、不拿群众一针一线、一切缴获要归公。这是人民军队纪律体系的核心。' },
        ],
        images: [], video: '',
      },
      {
        id: 'rudang-shici',
        title: '入党誓词',
        subtitle: '共产党人的庄严承诺',
        type: 'rule', hall: 'ruleHall', year: '跨越百年',
        description: '入党誓词是党员对党和人民的庄严政治承诺，严守纪律始终是核心内容。',
        highlight: '严守党的纪律，保守党的秘密……永不叛党。',
        sections: [
          { heading: '当代入党誓词', body: '我志愿加入中国共产党，拥护党的纲领，遵守党的章程……为共产主义奋斗终身，随时准备为党和人民牺牲一切，永不叛党。' },
        ],
        images: [], video: '',
      },
      {
        id: 'jiandang-jilv',
        title: '建党初期纪律建设',
        subtitle: '纪律是党的生命线',
        type: 'rule', hall: 'ruleHall', year: '1921年 — 1927年',
        description: '从一大到五大，党的纪律体系从无到有、从初创到逐步完善。',
        highlight: '纪律是执行路线的保证。',
        sections: [],
        images: [], video: '',
      },
      {
        id: 'xinshidai-lianjie',
        title: '新时代廉洁文化建设',
        subtitle: '全面从严治党',
        type: 'rule', hall: 'ruleHall', year: '2012年 — 至今',
        description: '党的十八大以来，推进全面从严治党，反腐败斗争取得压倒性胜利。',
        highlight: '一体推进不敢腐、不能腐、不想腐。',
        sections: [],
        images: [], video: '',
      },
      {
        id: 'zzu-jianshi',
        title: '郑州大学校史',
        subtitle: '砥砺奋进七十余载',
        type: 'zzu', hall: 'zzuHall', year: '1956年至今',
        description: '1956年建校，国家\"双一流\"建设高校。七十余年光辉历程。',
        highlight: '求是担当，追求卓越。',
        sections: [
          { heading: '建校历程', body: '1956年9月15日，郑州大学正式成立。嵇文甫任首任校长。2017年入选国家\"双一流\"建设高校。' },
        ],
        images: [], video: '',
      },
      {
        id: 'zzu-dangan',
        title: '郑大廉洁档案',
        subtitle: '校史中的清廉印记',
        type: 'zzu', hall: 'zzuHall',
        description: '七十余年办学中积累了丰富的廉洁文化档案资源。',
        highlight: '档案是历史的见证，廉洁是永恒的主题。',
        sections: [],
        images: [], video: '',
      },
      {
        id: 'zzu-jiaoyu',
        title: '清廉教育传承',
        subtitle: '薪火相传·立德树人',
        type: 'zzu', hall: 'zzuHall',
        description: '将廉洁教育作为立德树人的重要内容，贯穿人才培养全过程。',
        highlight: '教育的本质不仅是知识的传授，更是品格的塑造。',
        sections: [],
        images: [], video: '',
      },
      {
        id: 'future-wall',
        title: '数字廉洁互动墙',
        subtitle: '一翻一廉·清风徐来',
        type: 'future', hall: 'futureHall',
        description: '点击方块，翻开一面，看见一份清廉。',
        highlight: '翻开一面，看见一份清廉。',
        sections: [],
        images: [], video: '',
      },
      {
        id: 'lianjie-gushi',
        title: '古今廉洁故事',
        subtitle: '廉以修身·洁以养德',
        type: 'future', hall: 'futureHall',
        description: '从古至今涌现出无数清正廉洁的典范人物和动人故事。',
        highlight: '以史为镜，可以知兴替；以廉为镜，可以正衣冠。',
        sections: [],
        images: [], video: '',
      },
      {
        id: 'lianjie-zhenyan',
        title: '廉洁箴言',
        subtitle: '千古箴言·历久弥新',
        type: 'future', hall: 'futureHall',
        description: '中华民族关于清正廉洁的智慧结晶，至今仍然启发和警醒后来者。',
        highlight: '公生明，廉生威。',
        sections: [],
        images: [], video: '',
      },
      {
        id: 'honglian-xihua',
        title: '红廉习话',
        subtitle: '习近平关于廉洁文化的论述',
        type: 'future', hall: 'futureHall',
        description: '习近平总书记就加强新时代廉洁文化建设作出的一系列重要论述。',
        highlight: '一个人廉洁自律不过关，做人就没有骨气。',
        sections: [],
        images: [], video: '',
      },
    ];
  }
}
