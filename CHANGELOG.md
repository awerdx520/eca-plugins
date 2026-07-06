# 变更日志

## [0.1.1] — 2025-07-19

### 变更

- 仓库从单插件扁平结构迁移为 ECA 多插件标准布局（`.eca-plugin/marketplace.json` + `plugins/`）
- `marketplace.json` 字段 `path` 重命名为 `source`，符合 ECA 插件规范
- `skills/` 目录按 agentskills.io 规范重组：`skills/SKILL.md` → `skills/plantuml-render/SKILL.md`
- `eca.json` 填充插件元数据（name、version、description）
- `Readme.org` 项目结构图更新为多插件仓库布局

## [0.1.0] — 初始版本

- PlantUML 渲染 MCP 服务器（render_plantuml 工具）
- 三层强化渲染策略：pre-request hook + agent skill + post-request hook
- 内联 base64 PNG 图片输出
