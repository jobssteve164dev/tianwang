# 首个市场与 MVP 范围决策

## 决策结论

天网首版服务的用户是：**没有专职安全运营中心、由一名 IT 管理员或运维负责人兼管安全的 10～100 人技术团队**。这类团队通常维护 5～50 台 Linux 服务器，需要先知道哪台机器正在发生明显的高风险行为，并能把告警从发现推进到处理完成。

首版不以“全平台 AI 安全平台”为验收目标。首版只证明一个结果：管理员能够在自己的 Linux 服务器上发现扫描工具进程，看到可追溯的告警，并完成确认和解决。

## 首个部署环境

- 单一组织、单一管理员团队，不提供公网多租户 SaaS。
- 一台 Linux x86_64 主机以 Docker Compose 运行 `app` 与 PostgreSQL；管理端只通过受信内网或 VPN 访问。
- 被监控端限定为 Ubuntu 22.04/24.04 x86_64，安装 TianWang Agent，并通过注册码接入同一组织。
- 首版允许单机部署，不承诺高可用；数据库持久化、备份和恢复步骤必须在正式试用前经过演练。
- AI 分析与外部威胁情报可以关闭。它们只能增强告警内容，不能阻断基础检测和告警生成。

选择这一环境，是因为当前生产 Compose 已收敛为应用与 PostgreSQL 两个核心服务，持续集成与核心集成测试也以 Linux、PostgreSQL 为主要验证环境。Windows、macOS 安装包已经可以构建，但不因此进入首版安全效果承诺。

## 必须跑通的一条闭环

首个场景是：**Linux 端点出现 `nmap`、`masscan` 等扫描工具进程，管理员收到“可疑进程”高危告警并完成处置闭环。**

完整链路必须同时成立：

1. Agent 每 30 秒采集一次进程信息，识别配置内的扫描工具名称，并生成包含设备、进程名、PID、命令和发生时间的高危发现。
2. Agent 将发现作为 `security` 遥测上报；断线时保留待发送数据，服务端只有在数据持久化后才返回回执。
3. 服务端把遥测写入 PostgreSQL，后台检测任务在同一事务内创建安全事件和活动告警；可选 AI 或威胁情报失败不得删除基础告警。
4. 管理员在“威胁告警管理”中能看到设备、类型、级别、描述和发生时间，并将状态依次更新为“已确认”和“已解决”。刷新页面或重新登录后，最终状态仍为“已解决”。
5. 同一进程在相邻采样周期内不得制造多条同时活动的重复告警。自动封禁 IP、终止进程和防火墙改动保持关闭，首版只告警、不自动执行破坏性动作。

一次受控演练的通过标准是：测试扫描进程持续超过一个采样周期后，60 秒内出现告警；告警归属正确；断线重连不丢失、不重复；确认与解决状态可持久化；其他组织无法读取或修改该告警。

## 当前实现依据

Observed in code:

- `agents/src/services/SystemMonitor.js` 采集进程列表；`agents/src/services/SecurityService.js` 将扫描工具识别为 `suspicious-process`；`agents/src/services/AgentService.js` 将发现放入可重试的 `security` 遥测队列。
- `server/src/core/telemetry.js` 对遥测做幂等持久化并创建检测任务；`server/src/core/detection.js`、`server/src/services/SecurityEventService.js` 创建安全事件和告警。
- `server/src/routes/alerts.js` 按可访问设备约束告警读写；`client/src/pages/alerts/AlertsPage.tsx` 提供查看、确认和解决动作。
- `docker-compose.yml` 的生产主路径为 Linux/amd64 的应用与 PostgreSQL；`server/tests/integration/core-v2.cjs` 和 `tests/deployment/runtime.cjs` 已覆盖持久遥测、后台检测和基础告警生成。

Inference:

- 进程扫描工具检测是当前最接近真实 Agent、服务端持久化和管理员动作的一条安全链，适合用来约束首版；但现有测试尚未把已打包 Agent、扫描进程、Web 告警和状态闭合放进同一次演练，因此目前不能宣称该场景已经通过产品验收。

## 暂不进入首版

- Windows、macOS、OpenWrt 的安全效果验收，以及跨平台一致性承诺。
- 公网多租户 SaaS、跨组织关联分析、托管式安全运营和高可用集群。
- 恶意软件查杀、文件完整性监控、DDoS 检测、数据泄露检测和未知威胁发现。
- Kafka、InfluxDB、Redis 等扩展数据链路，以及大规模设备容量承诺。
- 以外部 AI、威胁情报或第三方通知作为告警成立的必要条件。
- 自动封禁、自动杀进程、设备隔离和无人值守响应。
- 合规认证、审计报告和“满足 GDPR、网络安全法”等对外承诺。

## 验收命令

以下命令必须在同一提交上全部通过：

```bash
npm run db:migrate
npm run core:test
npm --prefix agents test -- --runInBand services/AgentService.test.js
CI=true npm --prefix client test -- --runInBand --watchAll=false AlertsPage.test.tsx
docker compose build
docker compose up -d --no-build --wait
node --test tests/deployment/runtime.cjs
docker compose stop
```

这些命令验证当前的持久化、检测任务、基础告警、Agent 上报队列和告警界面行为，但不能替代上述扫描进程演练。首版发布前还必须把这次演练固化为自动化整链测试；在该测试存在并通过以前，本决策文档可以完成，本 MVP 不能标记为验收完成。

## 主要风险与停止条件

- **漏检：**进程采集只保留 CPU 或内存占用超过 1% 的前 20 个进程，短命或低占用扫描工具可能不进入检测输入。正式试用前必须用真实 Ubuntu Agent 量化漏检，无法稳定复现即停止发布。
- **重复告警：**遥测消息具备幂等键，但相邻采样会产生新消息；目前没有证据证明同一进程会合并到一条活动告警。重复告警未收敛前不得扩大设备数量。
- **识别强度：**仅凭进程名属于启发式发现，既可能误报，也可能被改名绕过。界面和对外材料必须称为“可疑进程”，不得称为已确认入侵。
- **整链证据不足：**现有部署测试使用构造的高 CPU 遥测，不是打包 Agent 产生的扫描进程发现。缺少同一场景的 Agent 到 Web 端证据时，不得宣称闭环已跑通。
- **处置审计不足：**告警状态接口和界面已有确认、解决能力，但成功路径、操作者和处置备注尚未形成完整整链验收。状态不可持久回读或无法追溯操作者时停止试用。
- **部署边界：**单机部署没有高可用承诺，且管理入口只允许受信内网或 VPN。备份恢复、TLS 或访问边界未验证时不得直接暴露公网。
- **主动响应风险：**防火墙和进程终止代码不属于本轮可信闭环。任何自动响应在独立安全审计、授权边界和回滚演练完成前都必须保持关闭。
