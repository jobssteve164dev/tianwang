# 天网 V2 核心架构

## 目标与不变量

用户登录后能查看真实设备与威胁数据；节点直接上报，数据持久化后产生基础告警；退出撤销会话及连接。生产只有 app 与 postgres，外部 AI 不影响这些动作。

保留既有用户、组织、设备、Agent 身份、MCP 调查与响应授权边界、域名、onex-nextterminal 节点和 Tunnel。保留 PostgreSQL 卷；旧组件卷不删除、不清空。不新建发布路径、Runner、节点或代理。前台不显示迁移过程与基础设施说明。

## 已审计事实与缺口

基线：`7e04f613930a07ff854e7424163c2b5782c9566f`，初始工作树干净。

| 基线代码证据 | 迁移结论 |
| --- | --- |
| `server/src/services/UserSessionService.js`、`middleware/auth.js`、`index.js` | 保留 PostgreSQL 访问/刷新会话与 Socket.IO 会话房间撤销 |
| `services/WebSocketService.js` → `controllers/agentController.js` | 已有直接节点通道；统一 HTTPS 与 WebSocket 的持久接收入口 |
| `services/DataStorageService.js` | InfluxDB 内存批量缓冲、失败吞掉；替换为提交后确认的 PostgreSQL 存储 |
| `services/SecurityEventService.js` | 事件与告警分开写；必须同事务，异步重放不得重复 |
| `routes/dashboard.js` | 大部分统计读真实表；性能和告警统计仍有固定示例值，必须消除 |
| `config/database.js`、`services/CacheService.js` | Redis 可等待重连；核心启动不得初始化 Redis |
| `controllers/aiModelController.js`、`routes/security.js` | 直接调用独立 Python；需逐条迁移真实消费者 |
| `src/database/migrate.js` | 正式 Umzug 入口读取 `server/migrations`，另有模型同步，新增表沿该入口迁移 |
| `.github/workflows/ci.yml` | main 推送执行验证及完整容器验收；发布前需要核对控制面的自动发布绑定 |

已读回 CloudMCP：项目仍绑定 onex-nextterminal、main 和原离线发布路径，项目及旧服务自动发布均关闭；最后读到部署 1312 在 compose_rollout 失败。tianwang.szlk.uk 仍指向既有 Tunnel c02b4438-99dd-4aaf-9cc5-012f37c6ac03，公网 /health 当时返回 404。运行清单包含旧 PostgreSQL、InfluxDB、Redis、ZooKeeper；这些记录不证明数据为空。只读存储检查因工具语义授权变化被拒绝，已提交精确项目范围授权请求，尚待批准；旧卷内容与迁移对账仍未完成。项目指定的 `agent.md` 不存在，以会话提供的规则为当前约束。

## 模块与事务

单一进程装配身份、节点、采集、检测、自动化、智能分析与展示模块。保留现有源目录和业务模型；新核心模块通过明确入口接入现有控制器，不另起应用。

1. 身份：访问令牌只在 PostgreSQL 会话有效时可用。用户 Socket.IO 入房间后复验会话；退出断开对应会话房间，独立登录不受影响。
2. 接收：鉴权先确定 Agent 和组织，载荷不能改写归属。以 Agent + 消息标识做全局幂等；旧节点使用类型、采样时间和规范化载荷摘要形成稳定标识。同标识不同内容拒绝。
3. 持久化：单事务写接收凭据、采样数据和 detection Outbox。提交后 HTTPS/WS 才回确认；写入错误返回可重试失败，不能静默成功。
4. 检测：Worker 从持久载荷执行 CPU、内存、网络可疑连接和节点安全报告规则。事件、告警与任务完成同事务提交；失败全部回滚。
5. 实时通知：持久化结果是权威，Socket.IO 是通知通道。断线后仪表盘重新查询，不依赖通知保存唯一结果。
6. AI：独立 Outbox 类型及 Provider 接口；基础检测不等待 AI。外部配置保存在现有加密配置边界，返回明确可用状态，不伪造评分或模型训练状态。

## PostgreSQL 契约

| 表 | 关键结构与约束 |
| --- | --- |
| `telemetry_receipts` | UUID 主键，Agent、组织、类型、采样时间、JSONB 载荷、摘要；Agent + message_key 唯一 |
| `telemetry_samples` | 按 sampled_at 范围分区，receipt_id + sampled_at 主键，常用指标列和 JSONB 扩展；Agent + 时间索引 |
| `outbox_jobs` | UUID、类型、载荷、唯一去重键、pending/running/completed/failed、attempts、available_at、lease_until、lease_token、last_error、finished_at |
| `application_cache` | key 主键、JSONB value、expires_at；授权仍读原会话表 |

指标采用月分区和默认分区接纳迟到数据。独立维护任务每六小时检查当前及后续两个月；遇到默认分区已有该月数据时保留原位，查询仍完整覆盖。维护失败单独记录，不阻止接收。禁止普通查询执行 DDL。历史分区不自动删除。采样查询显式限定 Agent 和时间，返回真实值，缺失用 null 表达。

Worker 用 `FOR UPDATE SKIP LOCKED` 领取 ready 或租约过期任务，递增 attempts 并赋新 lease_token。完成/失败写回须匹配租约身份；旧执行者不能覆盖新领取结果。业务写入和完成标记共用事务并锁定当前租约。重试保留错误及下次执行时间；进程重启从数据库恢复。停止时向外部请求传递取消信号，等待已领取事务结束，再关闭数据库。AI 请求记录独立提交，崩溃后的未决调用在再次领取时标记 unknown，不能伪报成功；外部接口不承诺恰好一次调用，不伪造费用统计。

## 当前实现与用户路径

- `server/src/core/telemetry.js` 统一 HTTP/WS 接收，入口验证嵌套载荷与 IP；Agent 将带固定标识的数据先写本地持久队列，收到数据库提交确认才移除。
- `core/enrollment.js` 同事务消费注册码与创建设备，行锁约束并发配额；注册者组织决定归属，查询、规则管理及检测执行保持组织隔离。
- `core/detection.js` 执行基础检测与已保存规则，事件、告警和任务完成同事务。规则编辑器把输入条件解析后提交，预览使用 YAML 序列化；告警处理调用真实保存接口，失败不显示成功。
- `core/analysis.js`、`providers.js`、`intelligence.js` 直接适配外部 AI、MISP、OTX。独立任务失败不回滚基础告警；情报结果缓存进 PostgreSQL，分析与情报并发合并不覆盖已有结果。
- 应用直接托管 React；旧本地训练界面、Redis/Kafka 接口和调试日志脚本的源码归档于 `legacy/v1`，不进入应用镜像。
- `/health` 证明进程能访问 PostgreSQL，`/ready` 进一步检查 V2 必需表与列。容器启动不自动迁移；正式制品部署终态后执行 `/app/deploy/database-migrate`，再验收就绪与业务。健康检查成功本身不代表生产验收完成。

## 数据迁移与发布

PostgreSQL 原有身份和业务表保留，迁移只追加结构，不重置管理员密码。旧 InfluxDB 必须先读回 bucket、measurement、时间范围和点数；按稳定源标识分页导出、幂等导入、数量/时间范围/代表值对账后才允许切换历史查询。Redis/Kafka/ZooKeeper/AI 卷逐项核对会话、积压任务、模型及配置归属，未审计不能假设无数据。任何物理删除另列精确清单并取得确认。

| 既有发布阶段 | V2 复用与必要差异 | 发布前证据 |
| --- | --- | --- |
| 仓库主线 → GitOps 发布 | 复用 origin main、项目绑定与正式部署工具 | 授权、自动发布策略、无并发部署 |
| 离线镜像构建 | 同一构建池与签名归档，只构建 app、postgres | 两镜像列表、平台、大小、最终归档内容 |
| 制品存储与传输 | 复用 Release 存储、摘要签名、Agent 代理授权和下载器 | 精确制品身份与终态 |
| 节点导入与启动 | 复用目标节点及 Compose 消费者 | 最终生成 Compose、启动脚本、镜像直接运行 |
| 公网入口 | public_entry 指向 app:8000 /health，保留 Tunnel | 域名、天网身份、鉴权和双 WebSocket |
| 收尾 | 保留正式制品及旧数据卷，停止本轮隔离验证进程 | 无实验运行对象及未结算部署 |

生产写入前必须补齐目前缺失的控制面与旧数据审计证据。出现失败先读取精确终态日志并在隔离环境复现，不回退九服务，也不重试旧构建掩盖缺陷。

## 切片验收账

每片先观察失败回归，再实现；既有正确语义使用相同改前/改后成功基线。完成标记必须绑定实际证据。

- [x] 隔离 PostgreSQL：登录、鉴权、会话、Socket.IO 与退出回归。
- [x] 隔离验证：真实仪表盘；清除固定性能/告警数据。
- [x] 隔离验证：Agent 完整连接凭据注册及 WebSocket。
- [x] 隔离验证：幂等入库、冲突拒绝、提交后确认与失败重传。
- [x] 隔离验证：基础规则、事件与告警事务一致性。
- [x] 隔离验证：Outbox 并发领取、失败重试、租约与进程重启恢复。
- [ ] PostgreSQL 分区指标查询与历史数据对账。
- [x] 隔离验证：应用内 Provider；不可用时核心链继续。
- [ ] 单一应用镜像提供 React、REST、双 WebSocket 与健康检查。
- [ ] 两镜像 Compose、最终生成物和离线导入验证。
- [ ] 独立审查、完整影响面验证、提交及 origin main 推送。
- [ ] 正式 GitOps 两服务健康、公网真实用户与节点验收。
- [ ] 普通用户视角二次检查、临时对象归类与收尾。

### 当前验证证据（尚非生产验收）

本轮隔离证据位于任务执行目录：`core-tests-final.log` 共 30 项完整应用、PostgreSQL、Provider 与规则回归通过；`all-tests-final.log` 中服务端 108、前端 16、Agent 36、根 WebSocket 集成 5 项全部通过；`lint-complete.log` 无错误，保留既有警告。最终前端构建通过类型检查；`generated-final.json` 校验前端脚本、Agent 两页面内联脚本以及 Compose/CI YAML 可解析。`agents/tests/artifacts/generated.test.js` 已纳入正式测试，防止仅源模板正确而最终脚本无效。

真实浏览器完成规则创建和重新编辑；`browser-seed.log` 确认同一上报经过 HTTP 和 WebSocket 得到相同 receipt，只出现一条规则告警。告警保存失败保持原状态，保存成功后刷新仍为已确认；刷新保留所在页面。最终中文标签与告警类型可读，退出后旧令牌访问返回 401。Agent 生成主页在 Chromium 中使用真实 preload 接口和受控 IPC 测试数据完成初始化；真实节点通信由应用集成覆盖，此渲染检查不替代操作系统防火墙验收。

本地无 Docker daemon，完整镜像构建、导出再导入、显式迁移及运行验收必须由现有仓库 CI 执行；正式 GitOps 和旧数据对账仍待授权及运行证据，不能据本地成功宣称生产完成。隔离数据库与浏览器工作站均为本轮验收数据，不进入生产；结束时停止对应进程，保留本地证据，不删除旧数据卷。
