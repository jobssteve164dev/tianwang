# 天网全仓逻辑管线审计与闭环报告

审计日期：2026-08-27

## 1. 审计结论

本轮没有推翻现有架构，而是在原有持续监测、规则检测、AI 分析、告警、仪表盘和节点主动防护路径上，补齐 MCP 外部智能体调查与响应主路径，并修复阻断真实运行的配置、鉴权、数据、构建和部署缺口。

当前仓库统一验证入口 `npm run verify` 已全绿：代码检查和类型检查通过，5 个测试域共 219 项测试通过，服务端、Web 管理端和桌面 Agent 的生产构建通过。根工作区和 Agent 的生产依赖审计均为 0 项漏洞。

本报告中的“已闭环”指代码路径、自动化契约与最终构建物均已连通；不把缺少真实外部基础设施的本机模拟结果冒充实机验收。真实 Linux 抓包与防火墙、PostgreSQL 迁移和容器运行仍按第 5 节的发布门禁执行。

## 2. 审计范围与方法

审计覆盖：

- 服务端路由、鉴权、数据模型、数据库迁移、WebSocket、MCP、AI 配置、规则、情报、通知和报表。
- Web 管理端登录态、API 刷新、管理页面、设置页面和生产构建。
- `agents/src` 当前节点执行器的注册、重连、监测、抓包、结构化任务、验证、回滚和桌面操作入口。
- AI 引擎 API、外部模型、规则引擎、威胁情报、训练任务和本地检测降级。
- Docker Compose、Nginx、镜像构建、开发脚本、数据库迁移入口和 GitHub Actions。
- Node 与 Python 依赖可安装性、生产漏洞和锁文件一致性。

判断口径：

- **Observed in code**：可绑定到当前文件、测试或命令结果的事实。
- **Inference**：需要真实部署环境才能最终确认的运行判断，不写成“已经生产可用”。

## 3. 逻辑管线矩阵

| 管线 | Observed in code | 本轮闭环结果 | 状态 |
| --- | --- | --- | --- |
| 用户登录与会话 | `authController`、`auth` 路由、前端 `api.ts` 与 `authSlice` | 区分 access/refresh token；刷新请求只携带 refresh token；退出和改密会撤销会话；WebSocket 不再复用错误令牌语义 | 已闭环 |
| 管理端 API | `users`、`system`、`reports`、`notifications`、`data` 路由 | 去除伪成功和静态示例响应；用户、系统、报表和通知走真实服务与数据库查询；失败返回可定位错误 | 已闭环 |
| 节点接入 | `AgentService`、`agentController`、`WebSocketService` | 注册冲突后真实重认证；连接密钥和节点令牌双校验；心跳、遥测、断线状态与任务回执进入当前协议 | 已闭环 |
| 节点本地操作 | `preload.js`、`main.js`、`agents/scripts/build.js` | 网络诊断和事件详情按钮接入真实 IPC；默认服务端端口统一为 8000；事件详情转义，CSV 防公式注入 | 已闭环 |
| MCP 授权与接入 | `McpAuthService`、MCP 路由与 Nginx `/mcp` | 短期令牌绑定 subject、组织、节点、scope、issuer、audience 和 grant；反向代理支持 Streamable HTTP | 已闭环 |
| MCP 调查取证 | `InvestigationService`、`PacketCaptureService`、`EvidenceStorageService` | 指定节点受限抓包/主机快照，经签名任务信封下发；证据带 SHA-256、TTL、清单和授权资源读取 | 已闭环 |
| Finding 与处置 | `ResponsePlanService`、`TaskExecutionService`、`FirewallService` | Finding 必须引用本次调查证据；首版只接受精确 IP 临时阻断；幂等执行后重新采集连接验证，可按句柄精确回滚 | 已闭环 |
| 事件与审计回流 | `SecurityEventService`、`AuditTrailService` | 调查、Finding、处置和验证写入既有安全事件与审计模型，不另造一套用户需要理解的前台对象 | 已闭环 |
| 安全规则 | `security` 路由、Sigma 管理器、共享规则卷 | 规则写入使用事务式文件替换；AI 重载失败会回滚；禁用规则不会继续参与匹配；容器共享同一规则目录 | 已闭环 |
| 外部 AI 提供方 | `aiModelController`、AI `external_api_service` | 密钥加密持久化且响应掩码；保存前先热同步 AI；AI 拒绝则不落库；服务重启重放已保存配置；连接测试真实调用提供方 | 已闭环 |
| 本地 AI 与训练 | AI `ai_service`、`local_model_service`、训练 API | 外部提供方不可用时执行真实本地基线检测，不返回伪造模型结论；训练任务有真实状态、失败和结果 | 已闭环 |
| 威胁情报 | `ThreatIntelligenceConfigService`、AI `rule_engine` | MISP/OTX 配置加密、校验、真实连接测试、运行时热同步与重启重放；AI 规则引擎原子替换情报管理器 | 已闭环 |
| 缓存、消息与数据 | `CacheService`、Kafka 配置、`DataStorageService` | Redis v4 调用方式统一；Kafka 生命周期显式；InfluxDB/持久层失败不再伪装成功 | 已闭环 |
| 通知与报表 | `NotificationService`、`ReportService` | 邮件、阿里云短信走真实 SDK；报表使用真实事件、设备和审计查询，并输出 JSON/CSV/HTML | 已闭环 |
| 数据库迁移 | `server/src/database/migrate.js`、迁移测试、CI PostgreSQL | 单一迁移入口按序执行并记录；服务镜像启动先迁移后启动；CI 使用 PostgreSQL 15 验证 | 代码闭环，CI 实例验收 |
| 开发与发布 | 根脚本、Compose、Dockerfiles、Nginx、CI | `setup/dev/test/verify/build` 入口统一；Node 基线为 20；健康检查、端口、就绪条件和共享卷一致 | 已闭环 |

## 4. 本轮关闭的主要缺口

1. **协议主路径缺失**：补齐 MCP token、Tools、Resources、调查模型、Finding、ResponsePlan、签名任务、节点执行、验证和回滚。
2. **配置只保存不生效**：外部 AI 和威胁情报现在保存前热同步，服务重启时重放；失败不会把“数据库已保存、运行时未生效”包装成成功。
3. **前台展示伪能力**：移除外部模型资源管理伪动作和性能趋势“开发中”状态；无真实数据时明确显示空状态。
4. **节点按钮未接线**：网络诊断与事件详情进入真实 IPC 和服务调用；历史 5555 端口从当前路径清除。
5. **报表、通知与数据伪成功**：替换静态报表、模拟通知和存储成功分支，外部依赖失败向调用方暴露真实失败。
6. **规则与配置一致性**：规则文件、数据库、AI 引擎和容器卷形成提交/回滚关系；禁用状态影响实际匹配。
7. **验证入口分裂**：当前测试发现范围只包含现行契约；旧契约保留为迁移参考但不再冒充当前实现测试。
8. **依赖风险**：升级 React Router、ECharts、Nodemailer、UUID、`path-to-regexp` 和 `minimatch`，同步 Node 20 运行时；两个生产依赖审计均归零。
9. **历史模拟代码污染审计**：删除威胁情报路由内已失效的大段模拟处理器，保留的源文件只包含当前真实实现。

## 5. 验证结果与发布门禁

### 5.1 已完成自动化验证

| 验证域 | 结果 |
| --- | --- |
| 服务端 Jest | 20 suites，128 tests passed |
| Web 管理端 Jest | 2 suites，10 tests passed |
| 桌面 Agent Jest | 6 suites，31 tests passed |
| WebSocket 集成 | 1 suite，5 tests passed |
| AI 引擎 pytest | 45 tests passed |
| 合计 | 29 suites，219 tests passed |
| ESLint | 0 errors；历史 warning 仍存在，见第 6 节 |
| TypeScript | `tsc --noEmit` passed |
| 生产构建 | server/client/agent passed |
| 生产依赖审计 | 根工作区 0；Agent 0 |

此外，Python 虚拟环境使用完整依赖安装，不再用降级测试依赖代替真实运行依赖；Compose 主配置与构建配置均纳入 CI 静态校验。

### 5.2 必须在发布环境执行的真实验收

以下项目依赖当前机器不存在的基础设施，不能用模拟结果替代：

- 在真实 Linux 节点以生产服务账户执行 `tcpdump`，核验接口、过滤、120 秒和 50 MiB 限制。
- 对受控测试 IP 执行入站/出站临时阻断，确认目标连接消失、非目标连接不受影响、TTL 和精确回滚成立。
- 使用 PostgreSQL 15 执行全量迁移并启动服务；本地环境没有可连接 PostgreSQL，由推送后的 CI 服务容器完成这一门禁。
- 当前宿主机 Docker daemon 不可用，因此镜像实际构建和容器启动需由具备 Docker daemon 的 CI/发布环境确认；本地已完成 Compose 解析与应用生产构建。

## 6. 已知非阻断债务

- ESLint 当前为 0 error，但服务端仍有 154 条 warning，前端仍有类型 `any`、Hook 依赖等历史 warning。它们没有阻断本轮逻辑与构建，但不能描述为“零告警代码库”。
- 前端 gzip 后主包约 933 KiB，生产构建提示体积偏大。建议后续按页面拆分 AI 模型、规则编辑和报表模块；这属于性能优化，不影响当前主路径正确性。
- `agents/openwrt` 是未完成的历史 C 原型，不在支持矩阵。当前可发布节点实现以 `agents/src` 为准。
- MCP 首版使用短期 Bearer token，尚未实现完整 OAuth 动态客户端注册；调查调用保留 `investigation_id` 查询，但尚未接入 MCP Tasks 扩展和运行中取消。
- 证据到期会停止授权读取，物理清理由独立生命周期任务负责；不得在调查请求里顺带执行删除。

## 7. 项目判断

这套系统的差异化不应停留在“又一个带 AI 的安全仪表盘”，而应落在一个清晰闭环：任何兼容 MCP 的外部智能体都能在授权边界内调用现有节点完成真实取证，拿到可验证证据，给出可追溯结论，并把结构化措施交回节点执行、验证和回滚。

现有持续监测、告警和仪表盘是必要底座；MCP 路径不是替代它们，而是把底座变成外部智能体可调用的安全执行网络。下一阶段最有价值的优化不是增加更多模型或页面，而是完成首批真实节点演练、证据生命周期对账、OAuth 接入和更多经过严格约束的响应动作，并用调查成功率、平均取证时长、验证通过率和误处置回滚率衡量产品价值。
