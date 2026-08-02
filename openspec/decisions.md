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

---

## 2026-08-02 — render_plantuml 输出格式切换：PNG 位图 → SVG 无损矢量

**决策**：render_plantuml MCP 工具的输出格式从 PNG 位图切换为 SVG 无损矢量，渲染命令从 `plantuml -tpng <临时文件>` 改为 `plantuml -pipe -tsvg`（stdin 传源码、stdout 收 SVG），MCP image content 的 mimeType 改为 `image/svg+xml`。

**理由**：
- SVG 是无损矢量格式，可无限缩放、文字可选中复制，作为文档配图质量远优于位图 PNG
- 复杂图（多节点+长文字）SVG base64 体积比 PNG 小约 50%（实测 7816B vs 15684B）
- `-pipe` 模式消除临时文件 write→spawn→read→unlink 往返，同时避免 shell 注入面
- 语法错误检测保持有效：plantuml 对无法解析的输入返回退出码 100，`code !== 0` 仍可捕获

**影响**：
- 修改 `src/index.mjs`（渲染命令、mimeType、移除临时文件相关 import）
- 同步更新 hooks/rules.md、Readme.org、eca.json、package.json、README.md、CHANGELOG.md
- 客户端需支持 `image/svg+xml` MCP image 内容渲染（Emacs image-mode 支持 SVG）
- JVM 冷启动瓶颈（~470ms）未在本次处理，已记入 tech-debt.md

---

## 2026-08-02 — render_plantuml 引入常驻 HTTP 服务器消除 JVM 冷启动

**决策**：render_plantuml 渲染路径从纯 CLI（`plantuml -pipe -tsvg`，每次冷启动 JVM ~470ms）升级为「常驻 HTTP 服务器优先 + CLI 回退」双通道。MCP 服务器启动时拉起 `plantuml --http-server:18080` 常驻进程，渲染走 `GET /svg/<encoded>`（源码经 PlantUML 官方 encodeurl 算法：deflateRawSync + 自定义 base64 字母表），HTTP 不可用时回退 CLI。

**理由**：
- 高频率使用场景下，每次渲染冷启动 JVM 是主要瓶颈（~470ms），常驻服务器将耗时降至 ~16ms（约 30 倍提升，实测 avg=16ms / min 13 / max 22）
- 语法错误 HTTP 返回 400 + 错误提示 SVG，比 CLI 退出码 100 更精确，且直接返回错误不触发冷启动
- 双通道设计保证渲染功能永不中断：端口占用、服务器崩溃均自动回退 CLI
- 编码走 URL 路径（GET）而非 raw body（POST /svg 实测返回 PNG 错误图，不可用）

**影响**：
- `src/index.mjs` 增加编码函数（encodePlantUML）、生命周期管理（ensureHttpServer + cleanup）、双通道渲染（renderViaHttp + renderViaCli）
- 端口固定 18080；MCP 退出时自动 kill http-server 进程
- 依赖 Node 原生 fetch（Node 18+）与 zlib
- 文档同步：Readme.org、CHANGELOG.md；tech-debt.md 中 JVM 冷启动条目标记已解决
