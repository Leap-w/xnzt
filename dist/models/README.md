# models/ — 3D 模型目录

此处放置 Blender 导出的 GLB 模型文件。

## 主模型

| 文件 | 说明 |
|------|------|
| `exhibition.glb` | 展厅主体模型（如无此文件，自动使用程序化展厅） |

## Blender 导出设置

- **格式**: glTF Binary (.glb)
- **压缩**: Draco
- **面数**: 控制在 100MB 以内
- **坐标系**: Y-up
- **缩放**: 1 unit = 1 meter
- **材质**: 使用 Principled BSDF

## 命名规范

| 节点名称 | 对应展厅 |
|----------|---------|
| `Lobby` | 入口序厅 |
| `CentralHall` | 中央档案大厅 |
| `PeopleHall` | 人物·中原丰碑 |
| `RuleHall` | 制度·纪律之源 |
| `ZZUHall` | 郑大·清风传家 |
| `FutureHall` | 传承·见证致远 |
