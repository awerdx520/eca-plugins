# 变更日志

## [0.5.0] — 2026-08-02

### 新增

- **常驻 HTTP 服务器模式，消除 JVM 冷启动瓶颈**
  - MCP 服务器启动时拉起 `plantuml --http-server:18080` 常驻进程，JVM 只启动一次
  - 渲染走 `GET /svg/<encoded>`（源码经 PlantUML 官方 encodeurl 算法编码），耗时从 ~470ms 降至 ~16ms（约 30 倍提升）
  - HTTP 不可用（端口占用/服务器崩溃）时自动回退 `plantuml -pipe -tsvg` CLI 模式，渲染功能永不中断
  - 语法错误（HTTP 400）直接返回错误，不触发 CLI 冷启动
  - MCP 退出时自动清理 http-server 进程，无僵尸进程

## [0.4.0] — 2026-08-02

### 变更

- **render_plantuml 输出格式：PNG 位图 → SVG 无损矢量**
  - 渲染命令从 `plantuml -tpng <临时文件>` 改为 `plantuml -pipe -tsvg`（stdin 传源码、stdout 收 SVG），消除临时文件往返
  - MCP image content 的 mimeType 改为 `image/svg+xml`，返回 `data:image/svg+xml;base64,...`
  - SVG 无损矢量：可无限缩放、文字可选中复制；复杂图 base64 体积比 PNG 小约 50%
  - 语法错误检测保持有效（plantuml 退出码 100，`code !== 0` 仍捕获）
  - 同步更新 hooks/rules.md、Readme.org、eca.json、package.json、README.md 中的 PNG 描述
  - 已知瓶颈：每次渲染 JVM 冷启动约 470ms，已记入 openspec/tech-debt.md

## [0.3.0] — 2026-07-15

### 新增

- **pandoc-convert 插件** — 文档格式转换 MCP 服务器
  - 提供 `pandoc_convert` 工具（Markdown ↔ Org ↔ HTML ↔ LaTeX ↔ DOCX 等格式互转）
  - 提供 `pandoc_list_formats` 工具（列出 pandoc 支持的 46 种输入 / 67 种输出格式）
  - 纯 MCP 工具型架构，通过临时文件传递内容，避免 shell 注入
  - 支持 pandoc 3.6.1+

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
