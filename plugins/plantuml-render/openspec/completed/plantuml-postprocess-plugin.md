# PlantUML 后处理插件

## 目标

开发一个 ECA 插件，实现对话中 PlantUML 源码自动转换为渲染后的 PNG 图片，
以内联 base64 方式在客户端直接渲染。采用三层强化策略逼近"无感"体验。

## 设计

### 架构决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 图像注入方案 | MCP 工具 `render_plantuml` | ECA 原生支持 MCP 返回 image content 映射到 ChatImageContent |
| 可靠性增强 | 三层强化（preRequest Hook + Skill + postRequest 检测） | 单靠 prompt 指令对弱模型不可靠 |
| MCP 服务器语言 | Node.js | 已安装 node-plantuml@0.9.0，可复用 |
| 图片格式 | base64 PNG 内联 | ECA 协议 ChatImageContent 原生支持，无需文件系统 |

### 三层强化

1. **L1 preRequest Hook**：每次请求前，通过 `replacedPrompt` 自动注入渲染指令
2. **L2 Agent Skill**：SKILL.md 教模型何时调用、如何传参
3. **L3 postRequest Hook**：响应完成后扫描残留 PlantUML 块，通知用户

### 核心数据流

```
LLM输出PlantUML → 模型调用 render_plantuml(source) → MCP服务器执行 plantuml -tpng → 返回 base64 PNG → ECA分区: ChatImageContent → 客户端渲染
```

## 任务

- [ ] 创建项目结构和 marketplace.json
- [ ] 创建 MCP 服务器（Node.js）
- [ ] 创建 pre-request Hook（L1 强制注入）
- [ ] 创建 post-request Hook（L3 兜底检测）
- [ ] 创建 Agent Skill 文档（L2）
- [ ] 创建 .mcp.json 和 eca.json
- [ ] 安装依赖并测试验证
- [ ] 完善 Readme.org 文档

## 依赖关系

```
项目结构 → [MCP服务器, pre-request Hook, post-request Hook, Skill文档]
MCP服务器 → .mcp.json
[MCP服务器, pre-request Hook, post-request Hook, Skill文档, .mcp.json] → 测试验证 → Readme.org
```
