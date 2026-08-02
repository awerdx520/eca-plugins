# PlantUML 渲染优化：PNG 位图 → SVG 无损矢量

## 目标
plantuml-render 插件的 render_plantuml MCP 工具当前渲染位图 PNG，存在有损/不可缩放、复杂图体积大的问题。本次改为输出 SVG 无损矢量格式（可无限缩放、文字可选中），同时用 -pipe 模式省去临时文件往返，降低复杂图传输体积约 50%。

## 设计
- 渲染命令：`plantuml -pipe -tsvg`（stdin 传源码、stdout 收 SVG），替代 `-tpng <临时文件>`
- 返回格式：base64 data URI `data:image/svg+xml;base64,...`，MCP image content 的 mimeType 改为 `image/svg+xml`
- 移除临时文件逻辑（writeFile/readFile/unlink/mkdir/tmpdir/randomUUID/join import 全部删除）
- 错误检测：语法错误时 plantuml 退出码 100 仍可被 `code !== 0` 捕获（已验证）；另加 stdout 为空时的兜底检查
- 保留 MCP image content 结构不变，客户端按图渲染，仅 mimeType 变化

关键事实（Phase 1 已验证）：
- plantuml CLI 支持 --svg / --pipe 选项
- 真正语法错误退出码 100，无输出，现有 code !== 0 检测仍有效
- 复杂图 SVG base64 7816B vs PNG 15684B（-50%）；简单图 SVG 略大（XML 结构开销）
- 渲染耗时 SVG ≈ PNG（~470ms 为 JVM 冷启动主导）

## 任务
- [x] 任务1：修改 src/index.mjs — 渲染命令改为 -pipe -tsvg，mimeType 改 image/svg+xml，data URI 前缀改 data:image/svg+xml;base64,，删除临时文件相关 import 与逻辑（依赖：无）
- [x] 任务2：更新 hooks/rules.md — 「返回 PNG 图片」改为「返回 SVG 图片（无损矢量格式）」（依赖：任务1）
- [x] 任务3：更新 Readme.org — 概述与工作原理中的 PNG 描述改为 SVG（依赖：任务1）
- [x] 任务4：更新 eca.json 与 package.json 的 description（PNG → SVG）（依赖：任务1）
- [x] 任务5：更新 README.md 插件表格描述（PNG → SVG）（依赖：任务1）
- [x] 任务6：更新 CHANGELOG.md 新增 0.4.0 节（依赖：任务1-5）
- [x] 任务7：更新 openspec/decisions.md 追加 SVG 决策记录（依赖：任务1）
- [x] 任务8：更新 openspec/tech-debt.md 记录 JVM 冷启动债（依赖：无）
- [x] 任务9：codegraph index 更新索引（依赖：任务1）

## 文档清单
| 文档 | 路径 | 本次命中 |
|------|------|---------|
| README | README.md | ✅ 插件表格 PNG 描述 |
| 插件说明 | plugins/plantuml-render/Readme.org | ✅ 工作原理 PNG 描述 |
| 变更日志 | CHANGELOG.md | ✅ 新增 0.4.0 节 |
| 插件元数据 | plugins/plantuml-render/eca.json | ✅ description PNG |
| 包描述 | plugins/plantuml-render/package.json | ✅ description PNG |
| 画图规则 | plugins/plantuml-render/hooks/rules.md | ✅ 返回 PNG 图片 |
| 决策日志 | openspec/decisions.md | ✅ 追加 SVG 决策 |
| 技术债 | openspec/tech-debt.md | ✅ 记录 JVM 冷启动 |

## 验证标准
- L1 语法：node --check src/index.mjs 通过
- L2 功能：启动 MCP 服务器后调用 render_plantuml 返回 data:image/svg+xml 前缀的 base64，且 SVG 内容可被解析
- L3 不变量：全仓库无残留 `image/png` / `-tpng` 引用（历史 openspec/completed/ 与 CHANGELOG 历史节除外）

## 注意事项
- openspec/completed/post-request-hook.md 与 CHANGELOG.md 历史节（0.1.0 等）中的 PNG 描述属于历史记录，**不要修改**
- 所有文档使用简体中文
- 本次只创建 openspec 计划文件这一个文件，不要修改其他任何文件
