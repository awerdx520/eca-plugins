# 添加 post-request hook — 自动语法检查 + 渲染

## 目标
新增 post-request hook，自动扫描 LLM 回复中的 `@startuml...@enduml` 块，
先语法检查，通过后渲染为图片以 data URI 嵌入回复。同时简化 pre-request hook，
使其只负责"画图时输出 @startuml 代码块"这一条规则。

## 设计

三层防线新架构：

| 防线 | 机制 | 职责 |
|------|------|------|
| L1 | pre-request hook | 注入规则：画图时输出 @startuml 代码块，不教模型调用任何工具 |
| L2 | post-request hook 语法检查 | 在回复发出前，`plantuml -tsyntax` 检查每个块，失败则注入错误提示 |
| L3 | post-request hook 渲染 | 语法通过的块 → `plantuml -tpng` → base64 → data URI 嵌入回复 |

### post-request.sh 工作流
1. 读取 JSON 输入中的 `response` 字段（LLM 回复文本）
2. 扫描 `@startuml...@enduml` 块
3. 对每个块：
   - `plantuml -tsyntax` 语法检查
   - 通过 → `plantuml -tpng` → base64 编码
   - 失败 → 收集错误信息
4. 构造 `replacedResponse`：原回复 + 图片 data URI（或语法错误提示）
5. 输出 JSON：`{replacedResponse: "修改后的回复"}`

### 简化的 pre-request.sh INJECTION
只注入一条规则：需要画图时输出 PlantUML 语法代码块，不提及任何工具调用。

## 任务

- [ ] 任务1：创建 post-request.sh（依赖：无）
- [ ] 任务2：更新 hooks.json 注册 postRequest（依赖：任务1）
- [ ] 任务3：简化 pre-request.sh INJECTION（依赖：无）
- [ ] 任务4：测试 post-request.sh（依赖：任务1）
