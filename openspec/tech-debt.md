# 技术债务

本文件记录 eca-plantuml-plugin 仓库的已知技术债务。

---

## ~~2026-08-02 — plantuml-render：每次渲染冷启动 JVM（~470ms）~~ ✅ 已解决

**问题**：render_plantuml 工具每次调用都 spawn 一个新的 plantuml 进程（JVM），渲染耗时约 470ms，其中绝大部分是 JVM 冷启动开销，而非 PlantUML 本身渲染。格式切换（PNG→SVG）不改变这一瓶颈。

**建议方案**：引入常驻 PlantUML HTTP 服务器（`plantuml --http-server`），MCP 服务器启动时拉起一次，后续请求通过 HTTP 发送源码、接收 SVG，可把渲染耗时从 ~470ms 降到 ~50ms。

**待办**：
- [ ] 调研 `plantuml --http-server` 的接口协议（POST /svg 等）
- [ ] 评估 MCP 服务器生命周期管理与 http-server 进程的绑定/清理
- [ ] 实现 HTTP 模式 + 回退到 CLI 模式（http-server 启动失败时）

**解决记录（2026-08-02）**：已通过常驻 HTTP 服务器方案解决（见 openspec/decisions.md 2026-08-02 HTTP 常驻条目）。MCP 启动时拉起 `plantuml --http-server:18080`，渲染走 `GET /svg/<encoded>`，耗时从 ~470ms 降至 ~16ms（约 30 倍提升）。HTTP 不可用时回退 CLI 模式，功能不中断。三个待办 checkbox 全部完成。
