# 画图规则集中化 — 从 prompts/rules 迁移到 plugin hook

## 目标
将画图规则（何时用 PlantUML、禁止 ASCII/Mermaid、语法参考、渲染流程）从分散的
rules/diagram-ascii.md、prompts/harspower-agent.md、prompts/general-agent.md
统一迁移到 plantuml-render 插件的 pre-request.sh hook 中，hook 成为画图规则的
唯一权威源。

## 设计
- pre-request.sh 注入内容从"仅渲染步骤"扩展为"完整画图规则（触发条件 + 禁止项 + 语法 + 渲染流程）"
- prompts 中删除硬编码的渲染流程，替换为一句"图形绘制规则由 plantuml-render 插件的 pre-request hook 注入"
- rules/diagram-ascii.md 内容全部移入 hook，rule 文件替换为指向插件的引用
- config.json 中 `diagram-ascii.md` rule 保留（作为引用文件），不删除

## 决策
- 不删除 diagram-ascii.md rule，而是将其内容替换为指向插件的引用说明
- 这样 config.json 的 rules 列表无需变更
- harspower-agent.md 和 general-agent.md 中保留一句引用而非完全删除

## 任务

- [ ] 任务1：扩展 pre-request.sh — 注入完整画图规则（依赖：无）
- [ ] 任务2：精简 harspower-agent.md — 删除硬编码渲染流程（依赖：无）
- [ ] 任务3：精简 general-agent.md — 删除图形硬编码（依赖：无）
- [ ] 任务4：替换 diagram-ascii.md — 内容改为插件引用（依赖：无）

## 验证
- 写入后确认文件存在且内容正确
- 路径：/home/thomas/Workspace/eca-plugins/openspec/active/centralize-diagram-rules.md
