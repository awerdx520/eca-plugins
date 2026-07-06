---
name: plantuml-render
description: 将对话中的 PlantUML 源码自动渲染为 PNG 图片内联显示。提供 render_plantuml MCP 工具，用于架构图、流程图、时序图等任何需要图形化表达的场景。Use when you output PlantUML code blocks (@startuml...@enduml) and need to render them as inline images.
---

# PlantUML 自动渲染 Skill

## 何时使用

- 输出架构图、流程图、时序图、组件图、类图等 PlantUML 图形时
- 任何包含 `@startuml...@enduml` 代码块的回复中
- 需要以可视化方式表达系统设计、数据流、调用关系等

## 使用方法

### 标准流程

1. 编写 PlantUML 源码（`@startuml...@enduml` 格式）
2. 将源码作为消息正文中的代码块输出（供文本查看和备份）
3. **立即调用 `render_plantuml` MCP 工具**，将源码作为 `source` 参数传入
4. 工具返回的 PNG 图片会自动以 `ChatImageContent` 形式在对话中渲染

### 参数格式

```
工具名: render_plantuml
参数:
  source (string, 必填): 完整的 PlantUML 源码，以 @startuml 开始、以 @enduml 结束
```

### 示例

当需要表达 "A 调用 B，B 返回结果给 A" 的流程时：

1. 输出文本：
```
@startuml
Alice -> Bob : 请求数据
Bob --> Alice : 返回结果
@enduml
```

2. 调用工具：
```
render_plantuml(source: "@startuml\nAlice -> Bob : 请求数据\nBob --> Alice : 返回结果\n@enduml")
```

### 注意事项

- **不要只输出代码块而不调用工具**——代码块只是文本备份，工具调用才能产生可渲染的图片
- source 参数必须是完整的 PlantUML 源码，包含 `@startuml` 和 `@enduml`
- 渲染失败时（如语法错误），工具会返回错误信息，根据错误信息修正源码后重试
- 图片以 base64 编码内联传输，无需文件系统访问，在远程 ECA 客户端也能正常显示
- 此规则对所有子代理同样适用（general、explorer 等）
