# PlantUML 渲染优化：常驻 HTTP 服务器消除 JVM 冷启动

## 目标
plantuml-render 插件当前每次渲染都 spawn 新 JVM 进程（~470ms 冷启动），高频率使用场景下成为瓶颈。本次引入常驻 `plantuml --http-server` 复用 JVM，将渲染耗时从 ~470ms 降至 ~16ms（约 30 倍提升），失败时回退 CLI 模式保证可用性。

## 设计
- MCP 服务器启动时 spawn `plantuml --http-server:18080`（后台常驻，JVM 只启动一次）
- 渲染路径：源码 → deflateRaw + 自定义 base64 编码 → `GET http://localhost:18080/svg/<encoded>` → 读 SVG → base64 返回
- 编码算法：deflateRawSync + 字母表 `0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_`（PlantUML 官方 encodeurl 算法）
- 生命周期：MCP 启动时异步拉起服务器（轮询端口就绪，不阻塞握手）；MCP 退出（SIGINT/SIGTERM/exit）时 kill http-server 进程
- 容错回退：http-server 启动失败/运行崩溃 → 回退 `plantuml -pipe -tsvg`（CLI 模式），渲染功能永不中断
- 错误检测：HTTP 400 → 返回错误（含错误提示 SVG 中的信息）；200 → 正常返回

关键事实（Phase 1 已验证）：
- HTTP 渲染 avg=16ms（min 13 / max 22），CLI 冷启动 ~470ms
- GET /svg/<encoded> 返回有效 SVG；GET /png/<encoded> 返回 PNG；POST /svg raw body 返回 PNG 错误图（不可用）
- 语法错误返回 HTTP 400 + 错误提示 SVG（比 CLI 退出码 100 更精确）
- 中文以 SVG 实体编码无损；未闭合 @startuml 容错渲染 200 正常图
- 服务器日志输出 webPort=18080 与 webAddress=0.0.0.0

## 任务
- [x] 任务1：在 src/index.mjs 实现 PlantUML 官方编码函数（deflateRawSync + 自定义 base64）（依赖：无）
- [x] 任务2：实现 http-server 生命周期管理（spawn 常驻进程 + 端口就绪轮询 + 退出清理）（依赖：任务1）
- [x] 任务3：渲染路径改造（优先 HTTP GET /svg/<encoded>，失败回退 -pipe -tsvg CLI）（依赖：任务2）
- [x] 任务4：错误检测（HTTP 400 → 返回错误信息）（依赖：任务3）
- [x] 任务5：更新 Readme.org 工作原理（HTTP 模式 + 回退）（依赖：任务3）
- [x] 任务6：更新 CHANGELOG.md 新增 0.5.0 节（依赖：任务3-5）
- [x] 任务7：更新 openspec/decisions.md 追加 HTTP 常驻决策（依赖：任务3）
- [x] 任务8：更新 openspec/tech-debt.md 标记 JVM 冷启动条目为已解决（依赖：任务3）
- [x] 任务9：codegraph index 更新索引 + 冒烟测试（依赖：任务4）

## 文档清单
| 文档 | 路径 | 本次命中 |
|------|------|---------|
| 插件说明 | plugins/plantuml-render/Readme.org | ✅ 工作原理增加 HTTP 模式 |
| 变更日志 | CHANGELOG.md | ✅ 新增 0.5.0 节 |
| 决策日志 | openspec/decisions.md | ✅ 追加 HTTP 常驻决策 |
| 技术债 | openspec/tech-debt.md | ✅ JVM 冷启动标记已解决 |
| 插件元数据 | plugins/plantuml-render/eca.json | ⏭ description 已含 SVG，不涉及 HTTP |
| 包描述 | plugins/plantuml-render/package.json | ⏭ 同上 |
| 画图规则 | plugins/plantuml-render/hooks/rules.md | ⏭ 工具行为不变（仍返回 SVG），不涉及实现细节 |

## 验证标准
- L1 语法：node --check src/index.mjs 通过
- L2 功能：启动 MCP 服务器后调用 render_plantuml，返回 SVG 且耗时 < 100ms（HTTP 模式生效）；杀掉 http-server 后再次调用仍成功（回退 CLI）
- L3 不变量：http-server 进程在 MCP 退出后被清理（无僵尸进程）；无端口泄漏（18080 释放）

## 注意事项
- 端口 18080 固定，若被其他进程占用则回退 CLI 并记录日志，不强制占用
- http-server 启动失败/崩溃时静默回退 CLI，不向用户暴露内部错误
- 所有文档使用简体中文
- 本次只创建 openspec 计划文件这一个文件，不要修改其他任何文件
