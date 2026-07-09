# 架构决策日志

本文件记录 eca-plantuml-plugin 仓库的重大架构决策。

---

## 2025-07-19 — 采用 ECA 多插件仓库标准布局

**决策**：将仓库从单插件扁平结构迁移为 ECA 规范的多插件仓库格式。

**理由**：
- ECA 插件规范要求 marketplace.json 使用 `source` 字段指向插件目录
- skills 目录需符合 agentskills.io 规范（`skills/<name>/SKILL.md`）
- 多插件布局（`.eca-plugin/marketplace.json` + `plugins/<name>/`）是未来扩展的前提

**影响**：
- marketplace.json 字段 `path` → `source`
- skills 目录重组：`skills/SKILL.md` → `skills/plantuml-render/SKILL.md`
- Readme.org 结构图需更新

---

## 2025-07-21 — 从 post-request hook 切换到 MCP 服务器工具调用

**决策**：将 PlantUML 渲染从 post-request hook 自动处理切换为 MCP 服务器 render_plantuml 工具调用模式。

**理由**：
- customTool 的 `{{arg}}` 模板替换是 shell 字符串拼接（`bash -c "脚本"`），PlantUML 源码含多行、引号、`$`、`` ` `` 等特殊字符时存在 shell 注入风险
- MCP 服务器通过 stdio JSON 通信，参数不经过 shell 解释，安全性更高
- MCP 服务器方案与 ECA 插件系统的 `.mcp.json` 机制原生集成，`${plugin:root}` 变量确保路径可移植
- 模型主动调用工具比 hook 自动处理后加工更可控——模型知道渲染结果并能在回复中正确引用
- harspower-agent.md 第 67 行已预设工具调用方式（「调用 `render_plantuml` 工具」），此变更使代码与文档一致

**影响**：
- 新增 `src/index.mjs`（MCP 服务器）、`package.json`（依赖）、`.mcp.json`（声明）
- 删除 `hooks/post-request.sh`，从 `hooks.json` 移除 post-request 注册
- 更新 `rules.md` 的「输出后处理」段为工具调用指引
- config.json 中 `toolCall.approval.allow` 的 `"plantuml-render": {}` 无需修改（MCP 服务器名匹配）

---

## 2026-07-15 — 新增 pandoc-convert 插件，纯 MCP 工具型架构

**决策**：新增 pandoc-convert 插件，提供 pandoc_convert 和 pandoc_list_formats 两个 MCP 工具，采用纯 MCP 工具型架构（无 pre-request hook）。

**理由**：
- pandoc 是纯工具型需求——模型按需调用文档转换，无需持续注入规则
- 与 plantuml-render 相比：PlantUML 需要注入画图规则 + 语法自检清单（pre-request hook），pandoc 不需要
- 用户内容通过临时文件传递（writeFile → spawn pandoc → readFile），避免 shell 注入
- pandoc 3.6.1 已就绪，支持 46 种输入 / 67 种输出格式

**影响**：
- 新增 5 个文件（eca.json、.mcp.json、package.json、src/index.mjs、Readme.org）
- 更新 README.md 插件表格和 CHANGELOG.md
- 无需 hooks/ 目录（纯工具型插件）
