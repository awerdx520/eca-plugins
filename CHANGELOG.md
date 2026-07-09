# 变更日志

## [0.2.0] — 2025-07-21

### 变更

- **架构切换：post-request hook → MCP 服务器工具调用**
  - 新增 MCP 服务器（`src/index.mjs`），提供 `render_plantuml` 工具
  - 新增 `.mcp.json` 声明 MCP 服务器，使用 `${plugin:root}` 变量
  - 新增 `package.json`，依赖 `@modelcontextprotocol/sdk`
  - 移除 `post-request.sh` 及其 hooks.json 注册
  - 更新 `rules.md`：从「post-request hook 自动处理」改为「调用 render_plantuml 工具」
  - 渲染安全性提升：MCP 通过 JSON 传参 + 临时文件，避免 shell 注入风险

### 理由

customTool 的 `{{arg}}` 模板替换是 shell 字符串拼接，PlantUML 源码含多行和特殊字符时存在注入风险。MCP 服务器通过 stdio JSON 通信 + spawn 临时文件方式，安全性更高。

## [0.1.1] — 2025-07-19

### 变更

- **画图规则集中化**：将分散在 rules/diagram-ascii.md、prompts/harspower-agent.md、prompts/general-agent.md 中的画图规则统一迁移到 plantuml-render 插件的 pre-request.sh hook 中
  - pre-request.sh INJECTION 从"仅渲染步骤"扩展为完整画图规则（适用范围 + 触发条件 + 语法速查 + 禁止行为 + 渲染流程）
  - harspower-agent.md 和 general-agent.md 中的硬编码渲染流程替换为插件引用
  - diagram-ascii.md 内容替换为插件引用空壳（保留文件作为 config.json rules 占位符）

- 仓库从单插件扁平结构迁移为 ECA 多插件标准布局（`.eca-plugin/marketplace.json` + `plugins/`）
- `marketplace.json` 字段 `path` 重命名为 `source`，符合 ECA 插件规范
- `skills/` 目录按 agentskills.io 规范重组：`skills/SKILL.md` → `skills/plantuml-render/SKILL.md`
- `eca.json` 填充插件元数据（name、version、description）
- `Readme.org` 项目结构图更新为多插件仓库布局

## [0.1.0] — 初始版本

- PlantUML 渲染 MCP 服务器（render_plantuml 工具）
- 三层强化渲染策略：pre-request hook + agent skill + post-request hook
- 内联 base64 PNG 图片输出
