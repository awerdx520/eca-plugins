# 多插件仓库规范对齐计划

## 目标

根据 ECA 插件规范（https://eca.dev/config/plugins/），将仓库从单插件扁平结构对齐为多插件仓库标准格式，确保 plugin 可被 ECA 正确发现和加载。

## 设计

- `marketplace.json` 字段：`path` → `source`（ECA 规范字段名）
- `skills/` 目录：按 agentskills.io 规范重组为 `skills/<name>/SKILL.md`
- `eca.json`：填充基本插件元数据
- `Readme.org`：更新项目结构图以反映多插件仓库布局

## 任务

- [x] 任务1：修正 marketplace.json（字段 path → source，路径 plugins/plantuml → plugins/plantuml-render）（依赖：无）
- [x] 任务2：重组 skills 目录（skills/SKILL.md → skills/plantuml-render/SKILL.md）（依赖：无）
- [x] 任务3：填充 eca.json 插件元数据（依赖：无）
- [x] 任务4：更新 Readme.org 项目结构图（依赖：任务1、任务2、任务3全部完成）

## 变更文件

| 文件 | 操作 |
|------|------|
| .eca-plugin/marketplace.json | 修改 |
| plugins/plantuml-render/skills/plantuml-render/SKILL.md | 新建（从 skills/SKILL.md 移动） |
| plugins/plantuml-render/skills/SKILL.md | 删除 |
| plugins/plantuml-render/eca.json | 修改 |
| plugins/plantuml-render/Readme.org | 修改 |
