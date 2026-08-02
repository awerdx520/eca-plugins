# 新增 3 个高价值 Code Agent 工具到 eca-common-tools

## 目标
为 eca-common-tools 插件新增 3 个解决 Code Agent 核心痛点（验证反馈回路慢、错误定位难、LLM 输出不可靠）的工具：test_result_summarize（测试输出摘要）、stack_trace_analyze（堆栈解析）、code_block_extract（代码块提取）。全部为纯 JS 零依赖实现，扩展 util.mjs 模块 + index.mjs 注册。

## 设计

### 工具清单

| 工具 | 功能 | 痛点 | 实现位置 |
|------|------|------|----------|
| test_result_summarize | 解析 pytest/jest/go test 输出，自动识别框架，只返回失败用例+错误摘要（默认 top 10，含文件:行:列） | P2 验证反馈回路慢 | src/util.mjs |
| stack_trace_analyze | 多语言堆栈解析（Python/JS/Java/Go），输出错误类型+调用链+首个项目文件位置 | P3 错误定位难 | src/util.mjs |
| code_block_extract | 从 LLM 输出/文档提取 ``` 代码块，支持语言过滤与未闭合检测 | P4 LLM 输出不可靠 | src/util.mjs |

### 关键决策

1. **框架/语言自动探测**：不要求用户指定框架——test_result_summarize 通过输出特征识别 pytest（`=== FAILURES ===` / `FAILED`）/ jest（`✕` + `●` + `Test Suites:`）/ go test（`--- FAIL:` / `FAIL` 行）；stack_trace_analyze 通过特征识别 Python（`Traceback (most recent call last)`）/ JS（`at ... (file:line:col)`）/ Java（`at pkg.Class.method(File.java:line)`）/ Go（`goroutine ... [running]`）。无法识别时返回"无法识别的格式"提示（不硬猜）。
2. **启发式解析，零依赖**：不引入 AST 或第三方库。正则 + 行上下文提取关键信息。test_result_summarize 提取每个失败用例的标题 + 首个断言错误行（`assert` / `Error` / `expected` 行）+ 文件:行:列；stack_trace_analyze 提取错误类型（首行）+ 完整调用链（简化保留每个帧的 文件:行:列）+ 首个属于"项目文件"的帧（不在 node_modules/venv/usr/lib/go/src 等系统目录中）。
3. **code_block_extract 未闭合检测**：提取所有 ``` 代码块；若 ``` 出现次数为奇数（未闭合），在结果中标记 `⚠️ 检测到未闭合代码块（LLM 输出可能被截断）`。支持可选 language 参数过滤（如只取 javascript）与 index 参数（只取第 N 个）。
4. **模块化约定不变**：工具定义追加到 util.mjs 的 utilTools 数组；handleUtilCall switch 新增 3 个 case；index.mjs 的 HANDLERS 确认是否需补 3 行路由（若 HANDLERS 按名字显式路由则补，若 json_format 等已路由到 handleUtilCall 则确认新工具名是否覆盖——确认现有模式后决定，必要时补 3 行）。
5. **错误返回约定**：所有错误路径 `isError: true` + `⚠️` 前缀，沿用现有模式。

### 各工具 schema

**test_result_summarize**
- 参数：output（string，必需，测试命令的完整输出）；framework（string，可选，'auto'|'pytest'|'jest'|'go'，默认 'auto' 自动探测）；max_failures（number，可选，默认 10，最多返回的失败用例数）
- 返回：文本。含：识别的框架、总用例数（如可提取）、失败用例列表（标题 + 错误摘要 + 位置）、无失败时返回"✅ 全部通过（未检测到失败）"

**stack_trace_analyze**
- 参数：trace（string，必需，堆栈跟踪文本）；project_root（string，可选，项目根目录路径，用于判断"项目文件"）
- 返回：文本。含：错误类型、错误消息、调用链摘要（每帧 文件:行:列，最多 20 帧）、首个项目内位置（高亮标记）
- 无法识别 → "无法识别的堆栈格式"（isError: true）

**code_block_extract**
- 参数：text（string，必需，包含代码块的文本）；language（string，可选，过滤只提取指定语言代码块，如 'javascript'/'python'）；index（number，可选，只提取第 N 个代码块，1-based）
- 返回：文本。含：代码块数量、每个代码块的语言+内容（或指定单个）、未闭合警告（如有）

## 任务

- [x] 任务1：扩展 util.mjs 实现 test_result_summarize（依赖：无）
  - 验收：utilTools 数组追加工具定义；handleUtilCall 新增 case；pytest/jest/go 三种格式识别与解析；零依赖；node --check 通过
- [x] 任务2：扩展 util.mjs 实现 stack_trace_analyze（依赖：无）
  - 验收：Python/JS/Java/Go 四种格式识别与解析；输出含错误类型+调用链+首个项目文件；无法识别返回 isError；node --check 通过
- [x] 任务3：扩展 util.mjs 实现 code_block_extract（依赖：无）
  - 验收：代码块提取含语言过滤+index 选取+未闭合检测；node --check 通过
- [x] 任务4：注册到 index.mjs + 文档同步（依赖：任务1、任务2、任务3）
  - 验收：index.mjs 确认/补充 3 个路由；Readme.org 工具列表 7→10；README.md 说明更新；CHANGELOG.md 新增 [0.8.0] 条目
- [x] 任务5：端到端冒烟验证（依赖：任务4）
  - 验收：MCP JSON-RPC tools/list 返回 10 个工具；3 新工具正常/错误路径全通过（含真实 pytest/jest/go 样例输出、四种堆栈样例、未闭合代码块）

## 文档清单

| 文档 | 路径 | 本次命中 |
|------|------|----------|
| 插件说明 | plugins/eca-common-tools/Readme.org | ✅ 工具列表 7→10 |
| 仓库 README | README.md | ✅ 插件说明（版本列 0.8.0） |
| 变更日志 | CHANGELOG.md | ✅ 新增 [0.8.0] |
| 插件元数据 | eca.json / marketplace.json | ⏭ 未命中（描述不含工具明细） |
| 画图规则 | hooks/rules.md | ⏭ 未命中（render_plantuml 行为不变） |

## 验证标准

- L1 语法：util.mjs / index.mjs `node --check` 通过
- L2 功能：端到端冒烟测试（任务5），10 工具列表 + 3 新工具正常/错误路径；测试样例用真实 pytest/jest/go test 输出与四种语言堆栈（可从本仓库或标准样例构造）
- L3 不变量：
  - 模块化约定：工具定义与实现在 util.mjs；index.mjs 只做聚合路由
  - 零新依赖：package.json 不新增依赖
  - 错误返回：无法识别格式/缺参 → isError: true

## 注意事项

- 禁止修改 package.json（零新依赖约束）
- test_result_summarize 的框架探测失败时返回"无法识别的测试输出格式"（isError）而非猜测
- stack_trace_analyze 的"项目文件"判断：不在 node_modules/venv/site-packages/usr/lib/go/src 等系统目录即视为项目文件；无 project_root 时用排除法
- code_block_extract 未闭合检测：统计 ``` 出现次数，奇数则标记
- 所有代码注释、文档使用简体中文
