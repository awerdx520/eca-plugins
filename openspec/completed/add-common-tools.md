# 新增 4 个通用工具到 eca-common-tools

## 目标
为 eca-common-tools 插件新增 4 个「小而通用」的 MCP 工具：plantuml_validate（PlantUML 语法校验）、json_format（JSON 格式化/压缩/排序）、csv_to_markdown（CSV → Markdown 表格）、regex_test（正则测试）。全部以插件既有模块化架构（src/*.mjs + index.mjs 注册两行）实现，text_diff 因 ECA 内置工具已覆盖而跳过。

## 设计

### 工具清单

| 工具 | 功能 | 依赖 | 实现位置 |
|------|------|------|----------|
| plantuml_validate | 仅校验 PlantUML 语法，不返回图片；合法返回"语法正确"，非法返回错误信息 | plantuml CLI（复用） | src/plantuml.mjs |
| json_format | JSON 格式化/压缩/排序，解析错误返回行列信息 | 无（纯 JS） | src/util.mjs |
| csv_to_markdown | CSV → Markdown 表格，支持自定义分隔符与引号包裹字段 | 无（纯 JS） | src/util.mjs |
| regex_test | 正则测试：pattern + flags + text → 匹配结果/捕获组/错误信息 | 无（纯 JS，子进程隔离） | src/util.mjs |

### 关键决策

1. **plantuml_validate 复用渲染通道判断语法**：HTTP 通道 GET /svg/<encoded> 返回 200 → 语法合法；返回 400 → 语法错误，从错误提示 SVG 中提取错误信息；HTTP 不可用时回退 CLI（`plantuml -pipe -tsvg` 退出码非 0 → 语法错误）。不返回图片，只返回文本结论。
2. **regex_test 子进程隔离防 ReDoS**：正则执行放入独立 node 子进程（spawn node -e），2 秒超时 kill，防止灾难性回溯卡死 MCP 主进程。沿袭 pandoc.mjs 的 spawn 模式。
3. **csv_to_markdown 手写状态机**：正确处理引号包裹字段（含逗号、换行转义），不引入第三方依赖。
4. **模块化约定不变**：util.mjs 导出 `utilTools` 工具定义数组 + `handleUtilCall` 分发函数；plantuml.mjs 在 plantumlTools 数组中追加 validate 工具定义，handlePlantumlCall 中新增 case。index.mjs 聚合 `[...plantumlTools, ...pandocTools, ...utilTools]`，HANDLERS 增加 util 相关路由。
5. **错误返回约定**：所有工具错误返回 `isError: true`，沿用现有 pandoc/plantuml 模式。

### 各工具 schema

**plantuml_validate**
- 参数：source（string，必需，完整 @startuml...@enduml 源码）
- 返回：文本。合法 → "PlantUML 语法正确"；非法 → 错误信息（来自 HTTP 400 错误 SVG 或 CLI stderr）

**json_format**
- 参数：json（string，必需，要格式化的 JSON 文本）；indent（number，可选，默认 2，缩进空格数）；sort_keys（boolean，可选，默认 false，对象键排序）；compact（boolean，可选，默认 false，true 时输出压缩 JSON 忽略 indent）
- 返回：文本。成功 → 格式化后 JSON；失败 → "JSON 解析错误: <message> (行 <line> 列 <col>)"

**csv_to_markdown**
- 参数：csv（string，必需，CSV 文本）；delimiter（string，可选，默认 ",", 分隔符）；has_header（boolean，可选，默认 true，首行是否为表头）
- 返回：文本。Markdown 表格；解析失败 → 错误信息

**regex_test**
- 参数：pattern（string，必需，正则表达式模式，不含斜杠）；flags（string，可选，默认 ""，如 "gim"）；text（string，必需，要测试的文本）
- 返回：文本。格式：
  - 正则编译错误 → 错误信息
  - 无匹配 → "无匹配"
  - 有匹配 → 匹配次数、每个匹配的完整文本 + 位置（start-end）+ 捕获组列表
  - 超时 → "正则执行超时（>2s），疑似灾难性回溯"

## 任务

- [x] 任务1：新建 src/util.mjs（json_format + csv_to_markdown + regex_test 三个工具定义 + handleUtilCall 分发函数）（依赖：无）
  - 验收：util.mjs 导出 utilTools 数组（3 个工具定义，含完整 inputSchema）与 handleUtilCall；node --check 通过；三个工具均实现零依赖纯 JS（regex_test 用子进程隔离）
- [x] 任务2：plantuml.mjs 新增 plantuml_validate 工具（依赖：无）
  - 验收：plantumlTools 数组追加 validate 工具定义；handlePlantumlCall 新增 case；复用 HTTP 400/200 判断 + CLI 回退；node --check 通过
- [x] 任务3：index.mjs 注册新工具（依赖：任务1、任务2）
  - 验收：ALL_TOOLS 展开 utilTools；HANDLERS 增加 json_format/csv_to_markdown/regex_test → handleUtilCall 与 plantuml_validate → handlePlantumlCall；node --check 通过
- [x] 任务4：文档同步（依赖：任务3）
  - 验收：Readme.org 工具列表与结构图更新（新增 util.mjs）、README.md 插件说明更新、CHANGELOG.md 新增 [0.7.0] 条目
- [x] 任务5：端到端冒烟验证（依赖：任务4）
  - 验收：启动 MCP 服务器，JSON-RPC tools/list 返回 7 个工具；逐一调用 4 个新工具验证正常路径 + 错误路径（json_format 传非法 JSON、regex_test 传非法 pattern、plantuml_validate 传残缺 @startuml、csv_to_markdown 传引号包裹字段）

## 文档清单

| 文档 | 路径 | 本次命中 |
|------|------|----------|
| 插件说明 | plugins/eca-common-tools/Readme.org | ✅ 工具列表 + 结构图 |
| 仓库 README | README.md | ✅ 插件说明 |
| 变更日志 | CHANGELOG.md | ✅ 新增 [0.7.0] |
| 插件元数据 | eca.json | ⏭ 未命中（描述不含工具明细，可不改；若改需同步 marketplace.json 描述） |
| 画图规则 | hooks/rules.md | ⏭ 未命中（render_plantuml 行为不变） |

## 验证标准

- L1 语法：全部 .mjs 文件 `node --check` 通过
- L2 功能：端到端冒烟测试（任务5），7 工具列表 + 4 新工具正常/错误路径
- L3 不变量：
  - 模块化约定：util.mjs 导出 [工具定义数组, handleUtilCall]；index.mjs 只做聚合不实现逻辑
  - 零新依赖：package.json 不新增任何依赖
  - 错误返回：所有错误路径 isError: true
  - 防 ReDoS：regex_test 必须子进程隔离 + 超时

## 注意事项

- 禁止修改 package.json（零新依赖约束）
- regex_test 必须用子进程执行正则（spawn node -e），禁止在主进程 new RegExp 后直接 matchAll（灾难性回溯会卡死 MCP 服务器）
- plantuml_validate 不返回图片，只返回文本结论；不要复用 applySvgBackground
- CSV 解析必须处理：引号包裹字段、引号内逗号、引号内换行、双引号转义（""）
- json_format 错误需用 JSON.parse 的 position 字段换算行列号（可简化为 "位置 <position>"）
- index.mjs 修改后重启 MCP 服务器才生效（本仓库仅改代码，不负责重启用户侧 ECA）
- 所有代码注释、文档使用简体中文
