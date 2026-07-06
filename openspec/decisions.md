# 架构决策日志

本文件记录 eca-plantuml-plugin 仓库的重大架构决策。

---

## 2025-07-19 — 采用 ECA 多插件仓库标准布局

**决策**：将仓库从单插件扁平结构迁移为 ECA 规范的多插件仓库格式。

**理由**：
- ECA 插件规范要求 marketplace.json 使用 `source` 字段指向插件目录
- skills 目录需符合 agentskills.io 规范（`skills/<name>/SKILL.md`）
- 多插件布局（`.eca-plugin/marketplace.json` + `plugins/<name>/`）是未来扩展的前提

**影响**：
- marketplace.json 字段 `path` → `source`
- skills 目录重组：`skills/SKILL.md` → `skills/plantuml-render/SKILL.md`
- Readme.org 结构图需更新
