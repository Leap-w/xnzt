# 廉花郑放·赓续清风 — 红色廉洁文化档案展

![展厅截图](public/assets/screenshot.png)

基于 **Three.js** 的 Web 端 3D 虚拟展厅。用户通过浏览器进入一个三维展厅空间，可自由移动、旋转视角、浏览展品、点击查看档案内容。

🌐 **[在线体验 →](https://你的用户名.github.io/lianhua-zhengfang-exhibition/)**

---

## 目录

- [展厅结构](#展厅结构)
- [项目结构](#项目结构)
- [快速开始](#快速开始)
- [操作说明](#操作说明)
- [Blender 模型接入](#blender-模型接入)
- [展品数据管理](#展品数据管理)
- [部署到 GitHub Pages](#部署到-github-pages)
- [技术栈](#技术栈)
- [开发阶段](#开发阶段)

---

## 展厅结构

```
一厅四馆一中心

        传承·见证致远 (北)
              │
  制度馆 ← 中央档案大厅 → 郑大馆
  (西)       │            (东)
        人物·中原丰碑
              │
          入口序厅 (南)
```

| 展厅 | 内容 |
|------|------|
| 入口序厅 | 展览主题墙，观众入口 |
| 人物·中原丰碑 | 焦裕禄、王荷波、嵇文甫、张人亚 |
| 制度·纪律之源 | 三大纪律八项注意、入党誓词、党章纪律、新时代廉洁文化 |
| 郑大·清风传家 | 郑州大学校史、廉洁档案、清廉教育 |
| 传承·见证致远 | 数字廉洁互动墙、古今廉洁故事、廉洁箴言、红廉习话 |

---

## 项目结构

```
├── src/
│   ├── main.js           # 入口 — 渲染器、场景编排、渲染循环
│   ├── exhibition.js     # 展厅空间构建（程序化一厅四馆一中心）
│   ├── exhibits.js        # 展品管理 — JSON 数据 + 3D 标记生成
│   ├── popup.js           # 弹窗 — 展品信息卡片（标题/图片/视频/描述）
│   ├── interaction.js     # 交互 — Raycaster 准星射线 + 距离提示
│   ├── controls.js        # 控制器 — WASD + PointerLock + 碰撞 + 滚轮
│   ├── cinematic.js       # 开场动画 — 相机飞入 + 字幕淡入淡出
│   ├── minimap.js         # 小地图 — Canvas 俯视展厅 + 玩家位置
│   ├── joystick.js        # 虚拟摇杆 — 移动端双区触控
│   ├── loader.js          # 模型加载 — GLTF + Draco 解压
│   ├── audio.js           # 音频 — Web Audio API 背景音乐接口
│   ├── camera.js          # 相机 — PerspectiveCamera
│   └── scene.js           # 测试场景（备用）
├── public/
│   ├── assets/
│   │   └── exhibits.json  # 展品内容数据（JSON 驱动，无需改代码）
│   ├── models/            # ← 放置 exhibition.glb
│   │   └── README.md      # Blender 导出规范
│   └── textures/          # 贴图纹理
├── .github/workflows/
│   └── deploy.yml         # GitHub Actions 自动部署
├── index.html             # HTML — HUD + 弹窗 + 摇杆 + 字幕
├── package.json
├── vite.config.js
└── README.md
```

---

## 快速开始

### 环境要求

- **Node.js** ≥ 18
- **npm** ≥ 9

### 本地开发

```bash
# 克隆仓库
git clone https://github.com/你的用户名/lianhua-zhengfang-exhibition.git
cd lianhua-zhengfang-exhibition

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

浏览器打开 `http://localhost:3000`。

首次启动会播放开场动画（约 7 秒），结束后进入序厅，点击画面锁定鼠标即可漫游。

---

## 操作说明

### 桌面端

| 操作 | 按键 |
|------|------|
| 锁定鼠标 / 进入漫游 | 点击画面 |
| 前进 / 后退 | W / S |
| 左移 / 右移 | A / D |
| 旋转视角 | 移动鼠标 |
| 缩放视野 | 滚轮 |
| 静音切换 | M 键 |
| 查看展品档案 | 走近展台 → 点击 |
| 关闭弹窗 | ESC / 点击遮罩 / ✕ |
| 释放鼠标 | ESC |

### 移动端

| 操作 | 方式 |
|------|------|
| 移动 | 左半屏虚拟摇杆（拖拽） |
| 旋转视角 | 右半屏滑动 |
| 查看展品档案 | 对准展台 → 点击 |

---

## Blender 模型接入

### 导出要求

| 参数 | 设置 |
|------|------|
| 格式 | glTF Binary (.glb) |
| 压缩 | Draco（推荐） |
| 面数 | 控制在 100MB 以内 |
| 坐标系 | Y 轴向上 |
| 单位 | 1 unit = 1 meter |

### 节点命名

在 Blender 中选中物体 → Object Properties → Name 填入以下名称：

| 英文名称 | 对应展厅 |
|----------|---------|
| `Lobby` | 入口序厅 |
| `CentralHall` | 中央档案大厅 |
| `PeopleHall` | 人物·中原丰碑 |
| `RuleHall` | 制度·纪律之源 |
| `ZZUHall` | 郑大·清风传家 |
| `FutureHall` | 传承·见证致远 |

命名匹配的节点会自动建立引用，存储在 `state.halls` 中。

### 模型替换

1. 将 `exhibition.glb` 放入 `public/models/`
2. 刷新页面 — 无需修改任何代码

如果没有模型文件，程序化展厅会自动生效（作为降级方案）。

---

## 展品数据管理

所有展品内容通过 `public/assets/exhibits.json` 管理。

### 数据格式

```json
{
  "id": "jiaoyulu",
  "title": "焦裕禄",
  "subtitle": "人民的好公仆",
  "type": "person",
  "hall": "peopleHall",
  "year": "1922年 — 1964年",
  "description": "展品简介…",
  "highlight": "金句引语…",
  "sections": [
    { "heading": "生平事迹", "body": "正文内容…" }
  ],
  "images": ["/assets/photo.jpg"],
  "video": ""
}
```

### 字段说明

| 字段 | 必填 | 说明 |
|------|------|------|
| `id` | ✓ | 唯一标识 |
| `title` | ✓ | 展品标题 |
| `subtitle` | | 副标题 |
| `type` | ✓ | `person` / `rule` / `zzu` / `future` |
| `hall` | ✓ | `peopleHall` / `ruleHall` / `zzuHall` / `futureHall` |
| `year` | | 年代（显示在标题下方） |
| `description` | | 简介（弹窗开头） |
| `highlight` | | 金句引语（金色高亮框） |
| `sections` | | 分段内容 `[{heading, body}]` |
| `images` | | 图片 URL 数组（支持轮播） |
| `video` | | 视频嵌入 URL（可选） |

### 添加展品

直接编辑 `exhibits.json`，添加新条目即可。3D 展台标记自动生成，无需修改代码。图片放入 `public/assets/` 目录。

---

## 部署到 GitHub Pages

### 方法一：GitHub Actions 自动部署（推荐）

1. 创建 GitHub 仓库，命名与 `vite.config.js` 中 `REPO_NAME` 一致
2. 推送到 `main` 分支
3. 仓库 Settings → Pages → Source: `gh-pages` → `/ (root)`
4. Actions 会自动构建并部署

**首次使用前**：
- 修改 `vite.config.js` 中的 `REPO_NAME` 为你的仓库名
- 修改 `package.json` 中的 `homepage` 和 `repository.url` 为你的仓库地址

### 方法二：手动部署

```bash
# 安装 gh-pages
npm install -D gh-pages

# 构建 + 部署
npm run deploy
```

### 自定义域名

1. 在 `public/` 下创建 `CNAME` 文件，内容为你的域名
2. 修改 `vite.config.js`：`const base = '/';`
3. 在 DNS 中添加 CNAME 记录指向 `<用户名>.github.io`

### 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `VITE_BASE` | 部署子路径 | `/<REPO_NAME>/` |

```bash
# 自定义 base 路径
VITE_BASE=/custom-path/ npm run build
```

---

## 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| [Three.js](https://threejs.org/) | 0.170 | WebGL 3D 渲染 |
| [Vite](https://vitejs.dev/) | 6 | 开发 & 构建工具 |
| [Draco](https://google.github.io/draco/) | 1.5.7 | 几何解压（CDN） |
| Blender | 3.x+ | 3D 建模 |
| GitHub Actions | — | CI/CD 自动部署 |

---

## 运行命令

```bash
npm install          # 安装依赖
npm run dev          # 启动开发服务器 (localhost:3000)
npm run build        # 生产构建 (dist/)
npm run preview      # 预览生产构建
npm run deploy       # 构建并部署到 gh-pages
```

---

## 开发阶段

- [x] Phase 0 — 项目初始化、基础场景
- [x] Phase 1 — GLB 模型加载、第一人称漫游、碰撞检测
- [x] Phase 2 — 展品交互系统（JSON 驱动 + 弹窗）
- [x] Phase 3 — 视觉效果（PBR 材质 + 灯光 + 开场动画 + 小地图 + 移动端）
- [x] Phase 4 — GitHub Pages 部署
- [ ] Phase 5 — 实际图片/视频/音频素材接入
- [ ] Phase 6 — Blender 精细模型替换
