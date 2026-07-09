# pandoc-convert 插件

## 目标
为 eca-plugins 仓库新增 pandoc-convert 插件，提供 pandoc_convert 和 pandoc_list_formats 两个 MCP 工具。

## 设计
纯 MCP 工具型插件，与 plantuml-render 共享 MCP SDK 基础设施模式。用户内容通过临时文件传递，不经过 shell 字符串。

## 工具
| 工具 | 参数 | 返回 |
|------|------|------|
| pandoc_convert | content, from, to, options? | { content, from, to } |
| pandoc_list_formats | 无 | { input: string[], output: string[] } |

## 任务
- [x] 任务1：创建插件骨架（eca.json、.mcp.json、package.json）（依赖：无）
- [x] 任务2：实现 MCP 服务器 src/index.mjs（依赖：任务1）
- [x] 任务3：创建 Readme.org 文档（依赖：任务1）
- [x] 任务4：安装依赖并端到端验证（依赖：任务2）
- [x] 任务5：更新仓库级文档（README.md、CHANGELOG.md）（依赖：任务4）
