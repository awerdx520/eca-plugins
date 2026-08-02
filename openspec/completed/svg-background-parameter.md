# PlantUML SVG 背景参数化：暗色主题可读性修复

## 目标
render_plantuml 渲染的 SVG 在暗色主题下背景透明 + 黑色字体不可读。根因：PlantUML 用 SVG 根元素 CSS background 设置白底，librsvg 不支持该属性导致实际透明。本次为工具增加 background 参数（默认不注入），agent 调用时显式传背景色，插件在 SVG 输出中注入标准 <rect> 背景元素。

## 设计
- 工具 schema 新增可选参数 `background`（string）：十六进制色值如 '#ffffff'；'none' 或不传 → 保持透明不注入
- 新增 applySvgBackground(svgText, background)：在 <svg ...> 标签后注入 <rect width="100%" height="100%" fill="<background>"/>（作为首个子元素 = 最底层，不遮挡图形）
- 参数校验：background 匹配 /^#[0-9a-fA-F]{3,8}$/ 才注入；'none' / 非法值 / 缺省 → 不注入（向后兼容）
- renderPlantuml(source, background) 双通道（HTTP + CLI）成功后统一过 applySvgBackground
- hooks/rules.md 明确要求 agent 调用时传 background:"#ffffff"（保证暗色主题可读），需透明传 "none"

## 任务
- [x] 任务1：修改 plugins/eca-common-tools/src/plantuml.mjs — schema 增加 background 参数；新增 applySvgBackground；handlePlantumlCall 读取 args.background 传入 renderPlantuml；双通道成功输出统一后处理（依赖：无）
- [x] 任务2：更新 plugins/eca-common-tools/hooks/rules.md — 「输出后处理」节补充：调用 render_plantuml 时传 background:"#ffffff"（暗色主题可读），需透明背景传 "none"（依赖：任务1）
- [x] 任务3：更新 plugins/eca-common-tools/Readme.org — 工作原理节补充 background 参数说明（依赖：任务1）
- [x] 任务4：更新 README.md — 插件功能描述补充背景参数（依赖：任务1）
- [x] 任务5：更新 CHANGELOG.md — 新增版本节记录本次变更（依赖：任务1-4）
- [x] 任务6：更新 openspec/decisions.md — 追加本次决策（依赖：任务1）

## 文档清单
| 文档 | 路径 | 本次命中 |
|------|------|---------|
| README | README.md | ✅ 功能描述补充背景参数 |
| 插件说明 | plugins/eca-common-tools/Readme.org | ✅ 工作原理节 |
| 变更日志 | CHANGELOG.md | ✅ 新增版本节 |
| 画图规则 | plugins/eca-common-tools/hooks/rules.md | ✅ 输出后处理节 |
| 决策日志 | openspec/decisions.md | ✅ 追加决策 |
| 插件元数据 | plugins/eca-common-tools/eca.json | ⏭ 描述不含背景 |
| 市场注册 | .eca-plugin/marketplace.json | ⏭ 描述不含背景 |

## 验证标准
- L1 语法：node --check plugins/eca-common-tools/src/plantuml.mjs 通过；JSON 文件（eca.json、marketplace.json）python3 json.load 校验合法
- L2 功能：调用 render_plantuml(source, background:"#ffffff") 返回 SVG 含 <rect width="100%" height="100%" fill="#ffffff"/>；缺省 background 或传 "none" 时无注入；rsvg-convert 渲染注入后 SVG 角落像素为白色（srgb(255,255,255)）
- L3 不变量：rules.md 工具调用指引与 schema background 参数描述一致（都支持 background 参数）

## 注意事项
- 只修改任务列出的文件，不要动其他文件
- 所有文档使用简体中文
- 注入 rect 用正则 /<svg[^>]*>/ 匹配第一个 <svg> 开始标签后插入
- 不要修改 openspec/completed/ 下的历史计划
