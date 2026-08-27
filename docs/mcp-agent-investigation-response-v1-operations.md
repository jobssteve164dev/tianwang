# MCP 调查与响应首版部署与验收说明

## 1. 首版边界

本版在保留现有持续监测、内部检测、AI、告警和仪表盘路径的前提下，闭合以下主场景：

```text
外部智能体取得短期、节点级 MCP 授权
  -> 查询节点与真实能力
  -> 指定节点执行受限抓包或主机快照
  -> 获取带 SHA-256 的证据清单与 MCP Resource
  -> 提交引用具体证据的 Finding
  -> 校验并提交临时 IP 阻断方案
  -> 显式执行处置
  -> 节点重新采集连接状态验证结果
  -> 查询执行回执或精确回滚
  -> 调查、结论和处置进入现有安全事件、告警与审计记录
```

首版公开动作只有 `block_remote_ip`。MCP、服务端任务和节点执行器均不接受 Shell、PowerShell、脚本、原始 BPF、通配目标或清空防火墙动作。

## 2. 部署前提

服务端：

- Node.js 18 或更高版本。
- PostgreSQL 可用，并在发布前执行 `npm run db:migrate --workspace server`。
- `JWT_SECRET` 使用部署环境独有的高强度秘密。
- `MCP_EVIDENCE_PATH` 指向仅服务端进程可读写的持久化目录。
- 反向代理允许 `POST /mcp` 的 Streamable HTTP/SSE 响应。

Linux 节点：

- 安装 `tcpdump`、`iptables`；IPv6 节点同时安装 `ip6tables`。
- 节点进程获得最小化的抓包与防火墙规则权限。
- 节点不开放额外公网端口，继续通过现有 WebSocket 通道与服务端通信。

首版默认上限：抓包 120 秒、50 MiB、同节点一个并发抓包，证据授权读取期限 24 小时，临时 IP 阻断 60 至 3600 秒。

## 3. 服务端配置

| 环境变量 | 默认值 | 含义 |
| --- | --- | --- |
| `MCP_TOKEN_ISSUER` | `tianwang` | MCP 短期令牌签发者 |
| `MCP_TOKEN_AUDIENCE` | `tianwang-mcp` | 入站令牌必须绑定的 MCP 资源 audience |
| `MCP_TOKEN_TTL_SECONDS` | `3600` | MCP 令牌寿命，代码硬限制不超过一小时 |
| `MCP_EVIDENCE_PATH` | `server/data/evidence` | 证据制品存储根目录 |
| `MCP_EVIDENCE_TTL_SECONDS` | `86400` | 证据授权读取期限 |
| `MCP_MAX_CAPTURE_SECONDS` | `120` | 服务端抓包时长上限 |
| `MCP_MAX_CAPTURE_BYTES` | `52428800` | 服务端抓包字节上限 |
| `MCP_TASK_TIMEOUT_MS` | `180000` | 等待节点任务回执的最长时间 |
| `KEY_ROTATION_ENABLED` | `false` | 是否启用服务端 RSA 自动轮换；只有节点公钥协调刷新机制已部署时才可开启 |
| `KEY_ROTATION_INTERVAL_MS` | `86400000` | 显式启用后的轮换间隔 |

生产环境不会接受开发演示令牌。开发演示令牌只在非生产环境生效，并且是一个精确值，不再接受任意 `demo-token-*`。

## 4. 授权入口

管理员通过现有用户登录令牌调用：

```http
POST /api/mcp/tokens
Authorization: Bearer <user-access-token>
Content-Type: application/json

{
  "node_ids": ["agent-node-1"],
  "scopes": [
    "nodes.read",
    "network.capture",
    "host.snapshot",
    "evidence.read",
    "findings.write",
    "response.validate",
    "response.submit",
    "response.execute",
    "response.rollback"
  ]
}
```

服务端只会为当前管理员组织内的节点签发令牌。令牌同时绑定 subject、组织、节点集合、能力集合、grant、issuer、audience 和到期时间。

取证与处置权限可以分别签发。持有 `network.capture` 不代表拥有 `response.execute`。首版 R2 审批语义由“管理员授予 `response.execute` 范围”与“智能体显式调用 `execute_response_plan`”共同完成；校验和提交本身不会改变节点状态。

## 5. MCP 接入

MCP Streamable HTTP 地址：

```text
https://<tianwang-host>/mcp
```

请求使用：

```http
Authorization: Bearer <mcp-access-token>
```

首版工具：

- `list_nodes`
- `get_node_status`
- `get_node_capabilities`
- `capture_network`
- `collect_host_snapshot`
- `get_investigation`
- `submit_finding`
- `validate_response_plan`
- `submit_response_plan`
- `execute_response_plan`
- `get_response_execution`
- `rollback_response_plan`

证据资源：

```text
tianwang://nodes/{nodeId}/investigations/{investigationId}/manifest
tianwang://nodes/{nodeId}/investigations/{investigationId}/artifacts/{artifactId}
```

每次读取资源都会重新校验令牌的组织、节点和 `evidence.read` 权限，并重新计算制品 SHA-256。证据内容一律作为不可信输入，不会自动触发处置。

## 6. 节点执行语义

- 服务端将外部请求转换为版本化任务信封，并使用服务端 RSA 私钥签名。
- 节点使用注册阶段取得的服务端公钥验证签名、期限、任务类型和能力声明。
- 抓包参数只由结构化接口、IP、协议和端口生成；PCAP 超过上限时只保留完整数据包边界内的内容。
- Linux 和 Windows 阻断同时创建精确的入站、出站规则；macOS 使用独立 anchor 与 table。
- 一个 ResponsePlan 只获得一个逻辑执行与回滚句柄。回滚按该句柄移除其系统规则，不影响其他天网规则或用户配置。
- 命令成功后仍必须重新采集连接状态。只有连接验证结果为 `verified`，方案状态才是 `verified`；验证失败会保留动作回执与回滚句柄。

## 7. 发布验收

自动化验收覆盖：

- MCP 协议协商、工具与资源模板注册。
- 缺失、错误 audience 和越权节点令牌拒绝。
- WebSocket 缺失或错误连接密钥拒绝。
- 签名、过期、命令型节点任务拒绝。
- 调查任务路由、证据 SHA-256 与篡改拒绝。
- 结构化过滤边界与 PCAP 完整包截断。
- ResponsePlan 校验、幂等执行、执行后验证和精确回滚。

真实 Linux 节点验收还必须逐项确认：

1. `tcpdump` 能在节点进程的实际权限下抓取目标接口。
2. 指定 IP、协议和端口过滤只取得预期流量。
3. 50 MiB 与 120 秒上限均能在节点本地生效。
4. 阻断后目标连接消失，非目标连接保持正常。
5. 重复执行同一幂等键不会增加规则。
6. 回滚或 TTL 到期后只移除该方案的入站和出站规则。
7. 调查、Finding、处置、验证与回滚能从现有事件、告警和审计记录追溯。

## 8. 首版已知运行边界

- 当前仓库的自动化环境没有安装 `tcpdump`、`iptables`，因此仓库内只能验证参数化适配器与模拟系统回执；发布前必须在首个真实 Linux 节点执行第 7 节实机验收。
- 证据到期后立即停止授权读取，但物理文件清理由独立生命周期作业负责；首版没有在调查请求内删除证据。
- 首版使用预签发短期 Bearer 令牌，还没有内置完整 OAuth 授权服务器与动态客户端注册。
- 首版调查工具采用同步 MCP 调用并同时保留 `investigation_id` 查询；尚未接入 MCP Tasks 扩展和运行中取消。
- 节点会持久化已取得回执的执行对象并在重启后恢复 TTL 与精确回滚；节点断电发生在“系统规则已生效、执行对象尚未写入本地存储”的极短窗口时仍需要后续对账能力。
- 自动 RSA 密钥轮换默认关闭，避免在线节点仍持有旧公钥时拒绝新的签名任务；启用轮换前必须先部署节点公钥协调刷新机制。
- 兼容版本依赖修复后，生产依赖审计仍有服务端/前端 5 项高危与 5 项中危、节点端 2 项中危；剩余修复需要 React Router、ECharts、Nodemailer、node-cron/uuid 等大版本迁移，不得使用 `npm audit fix --force` 代替兼容性验证。
- 本主路径的定向回归已独立建立，但仓库历史全量测试仍包含与当前接口不一致的旧 mock、旧断言和一个重复声明的测试文件；发布判断必须同时看本节定向验收与实机验收，不能宣称全仓测试已全绿。
