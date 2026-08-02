# 统一工具插件重构：eca-common-tools

## 目标
当前仓库每个插件对应一个独立 MCP 服务器进程（plantuml-render 1 tool、pandoc-convert 2 tools），新增简单工具就要新增一个插件 + 一个 MCP 进程，功能碎片化。本次重构为统一插件 `eca-common-tools`：一个 MCP 服务器进程包含全部工具，模块化 tools 架构支持未来低成本扩展。

## 设计
- 新建统一插件 `plugins/eca-common-tools/`，一个 .mcp.json 声明 1 个 MCP 服务器（node src/index.mjs）
- 模块化架构：`src/index.mjs` 为中央注册表（TOOLS 数组聚合 + HANDLERS 分发），每个工具组一个模块文件
  - `src/plantuml.mjs`：render_plantuml（含 HTTP 双通道 + 常驻服务器生命周期）
  - `src/pandoc.mjs`：pandoc_convert + pandoc_list_formats
- hooks/ 迁移 plantuml-render 的 pre-request hook（画图规则注入：hooks.json + pre-request.sh + rules.md）
- 删除旧插件目录 `plugins/plantuml-render/` 与 `plugins/pandoc-convert/`
- marketplace.json 注册 eca-common-tools（替换 plantuml-render 条目，补上 pandoc 遗漏）
- 未来新增工具 = 新建模块文件 + index.mjs 注册两行，不再新增 MCP 进程

## 任务
- [x] 任务1：创建 eca-common-tools 插件骨架（eca.json、.mcp.json、package.json、hooks/）（依赖：无）
- [x] 任务2：实现 src/plantuml.mjs（迁移 render_plantuml + HTTP 双通道 + 生命周期）（依赖：任务1）
- [x] 任务3：实现 src/pandoc.mjs（迁移 pandoc_convert + pandoc_list_formats）（依赖：任务1）
- [x] 任务4：实现 src/index.mjs（TOOLS 聚合 + HANDLERS 分发 + 生命周期接线）（依赖：任务2、任务3）
- [x] 任务5：删除旧插件目录 plantuml-render/ 与 pandoc-convert/（依赖：任务4）
- [x] 任务6：更新 marketplace.json 注册 eca-common-tools（依赖：任务4）
- [x] 任务7：更新 README.md 与 CHANGELOG.md（依赖：任务5）
- [x] 任务8：更新 openspec/decisions.md 与 tech-debt.md（依赖：任务5）
- [x] 任务9：安装依赖 + 冒烟测试 + codegraph index（依赖：任务5）

## 文档清单
| 文档 | 路径 | 本次命中 |
|------|------|---------|
| 插件市场 | .eca-plugin/marketplace.json | ✅ 注册 eca-common-tools |
| README | README.md | ✅ 插件表格更新 |
| 变更日志 | CHANGELOG.md | ✅ 新增版本节 |
| 决策日志 | openspec/decisions.md | ✅ 追加统一插件决策 |
| 技术债 | openspec/tech-debt.md | ✅ 记录旧插件迁移残留（如有） |
| 插件说明 | plugins/eca-common-tools/Readme.org | ✅ 新建插件文档 |

## 验证标准
- L1 语法：node --check src/index.mjs、src/plantuml.mjs、src/pandoc.mjs 全部通过
- L2 功能：MCP 服务器启动后 tools/list 返回 3 个工具（render_plantuml、pandoc_convert、pandoc_list_formats）；逐个调用验证正常
- L3 不变量：旧插件目录完全删除（无 plantuml-render/、pandoc-convert/ 残留）；marketplace.json 只注册 eca-common-tools；pre-request hook 迁移后画图规则注入正常

## 注意事项
- 迁移时保持工具行为不变（render_plantuml 的 HTTP 双通道、pandoc 的临时文件安全机制都要保留）
- pre-request hook 的 matcher 保持 ".*"（全局注入画图规则）
- 所有文档使用简体中文
- 本次只创建 openspec 计划文件这一个文件，不要修改其他任何文件
