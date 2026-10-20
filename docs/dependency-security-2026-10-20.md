# 依赖安全整改（2026-10-20）

## 范围与状态

基线为 `da4a7bf4d5d4f4f8839e8b142bc7db403017acc8`，起始工作树干净。核查用户列出的 37 条 Dependabot 告警，不修改业务架构、认证协议、数据库 schema、路线图或发布路径，也不 dismiss 告警。本文记录本次核查快照，不代替实时扫描。

以下依赖已在锁文件或 Python 清单中更新。版本来自最终依赖图，包含嵌套副本；同一漏洞在不同清单中的告警合并列出。

| 告警编号 | 依赖 | 本次版本 |
| --- | --- | --- |
| 597 | source-map-js | 1.2.2 |
| 596 | compression | 1.8.2 |
| 594 | @modelcontextprotocol/sdk | 1.32.1 |
| 593、592 | shell-quote | 两棵依赖树均为 1.12.0 |
| 588、586、601、600、591、590 | brace-expansion | 保留各主版本：1.1.21、2.1.7、5.0.12 |
| 585 | http-cache-semantics | 4.3.0；适用性与实测见下文 |
| 582、581、575、574、578、577、570、568、567、566 | nodemailer | 10.0.9 |
| 573、595 | joi | 17.13.8 |
| 571 | engine.io | 6.6.11 |
| 564、563 | fast-uri | 两棵依赖树均为 3.1.9 |
| 604 | postcss-selector-parser | 7.1.6，通过根 override 覆盖构建链中的 6.x 副本 |
| 584 | hono | 4.13.13 |
| 583 | GitPython | 3.1.62 |
| 580、565 | ip-address | 10.7.4 |
| 576 | serialize-javascript | 7.1.2，更新既有 override |
| 572 | moment | 2.31.0 |
| 569 | morgan | 1.12.1 |
| 599、598 | sprintf-js | 无可升级版本；CVE 已撤销，详见下文 |

同一轮扫描还修复了能通过兼容补丁更新消除的 `proxy-addr` 严重漏洞（2.0.8）、Agent 构建依赖 `sharp`（0.35.5）及 `yaml`（2.9.1）。没有使用 `npm audit fix --force`，没有降级或移除现有功能。

首次推送触发的 Python 依赖图更新另检出 aiohttp 告警 607、609（high）和 608（low），均由 3.14.4 修复。因此同轮将保留 AI 引擎的 `aiohttp` 从 3.14.3 定向升级至 3.14.4，补入版本回归。实际 aiohttp 3.14.3 的共享 Secure Cookie 在 HTTP 请求中泄漏已复现；3.14.4 拒绝 HTTP 发送、保留 HTTPS Cookie，真实 ClientSession 本地 JSON POST 也通过。当前正式生产 Compose 不运行独立 Python 服务，本次不改变该边界。

## 两类需区分的上游记录

`sprintf-js`：CVE 官方记录显示 [CVE-2026-97058](https://www.cve.org/CVERecord?id=CVE-2026-97058) 于 2026-10-12 被 CNA 撤销；GitHub 的 [GHSA-hp3w-g68c-fv3c](https://github.com/advisories/GHSA-hp3w-g68c-fv3c) 尚未同步。依赖来自 YAML/命令行帮助和 Electron 下载器的日志链，不是项目新增的模板入口。没有以改名、伪造版本、屏蔽扫描或 dismiss 告警制造“零漏洞”。这两条扫描提示仍可能保留。

`http-cache-semantics`：上游维护者在 [issue 56](https://github.com/kornelski/http-cache-semantics/issues/56) 中质疑告警，但 CVE 当前仍为 published。4.3.0 位于告警列出的版本范围之外，**并未修复告警描述的 `max-stale` 语义**。实际分支为 `app-builder-lib@26.15.3 → @electron/get@3.1.0 → got@11.8.6 → cacheable-request → http-cache-semantics`，仅用于构建下载。Got 默认不启用 HTTP 缓存，现有打包配置和下载器也没有启用它；Electron 本体使用的另一个 @electron/get 版本则走 FetchDownloader。未发现项目当前存在可利用的 HTTP 共享缓存路径。

专项验证使用该嵌套下载器实际解析到的 Got：同一 URL 的两个用户依次请求，分别覆盖原始告警中的 `Set-Cookie`（没有 private/public）与 `proxy-revalidate`；第二个用户附带 `max-stale` 仍取得自己的响应及 Cookie。另测 `cacheable-request` 的私有响应不入库与公共缓存命中，后者仅为组件兼容验证，不能当作原始告警已修复的证明。若未来显式启用下载 HTTP 缓存或将其用于共享代理，必须重新评估该风险。

## 验证与影响面

- 两套锁文件均经过 `npm ci` 安装；`npm run security:test` 在补入 aiohttp 回归后共 30 项通过，覆盖全部已更新依赖的安全版本下限、两套 Shell 引用入口、真实下载器与缓存组件的适用条件及通知服务的真实 MIME 生成。
- 修改前已观察到版本下限和 Shell 注入用例失败；邮件 MIME 用例在更新前后均通过。初版缓存用例直接调用未入库策略、初版 YAML 条件误覆盖未受影响旧版本，两者已纠正，不计入有效漏洞复现证据。
- PostgreSQL 隔离实例的正式迁移、`npm run core:test` 30 项、登录会话测试 7 项通过。
- 在独立 Python 环境安装 GitPython 3.1.62，实际调用 `Submodule.update(init=True)`：越界路径被拒绝，仓库外目标没有创建。当前生产 Compose 已不运行旧 AI 引擎，仍修复保留源码的依赖清单。
- `npm run verify` 包含安全检查、服务端/Web/Agent 的 lint、类型检查、测试与构建。Web 构建会消费 selector parser、source map 和序列化依赖；通知、MCP、Socket.IO、迁移与报表分别消费本次服务端依赖。
- 完整 `npm run verify` 已通过：当时 28 项安全检查、168 项既有测试及三端构建通过；随后补入 Got 下载器与 aiohttp 用例的安全套件已单独复验，最终容器验收由 CI 承担。所有生成的浏览器 JS 均通过语法校验；隔离生产模式应用的真实浏览器登录、仪表盘图表与数据展示通过，无横向溢出。正式健康/就绪入口返回 200、未授权 API 返回 401，认证后的三个仪表盘 API 返回 200；既有 Socket.IO 客户端成功连接更新后的服务端。该本机验收覆盖 Node 22，不能替代 Node 20 容器验收。
- 服务端生产依赖扫描：0 high、0 critical，剩余 4 moderate 依赖链条均源自已撤销的 sprintf-js 记录。Agent 生产依赖扫描为 0。
- Agent 图标生成器使用的 sharp 0.35.5 已在本机 Linux arm64 实际加载，内存 SVG 经 native/libvips 转换为 PNG，并复验 PNG 签名与 32×32 尺寸；未改写产品图标。未运行跨平台安装包发布。

## 剩余风险与验收边界

完整开发依赖扫描仍有告警，不能宣称整个仓库“零漏洞”：根工作区 61 项（54 high、7 moderate），Agent 41 项（29 high、12 moderate）。数量包含同一底层漏洞沿父依赖传播，并非独立风险数量。尚存的根漏洞集中于 `braces`、`node-forge`、`webpack-dev-middleware`、`webpack-dev-server`，另有已撤销的 sprintf-js。

`braces` 3.0.3 和 `node-forge` 1.4.0 均无已发布的修复版本。旧 CRA 开发服务器依赖升级涉及主版本及启动配置兼容，不能用审计建议中的 `react-scripts@0.0.0` 替换现有功能。上述工具不属于生产服务端或 Agent 运行依赖，但仍应视为开发工具链风险，不能仅凭生产扫描无高危认定所有告警已闭合。

主分支 push/PR 会触发 `.github/workflows/ci.yml` 的仓库验证与隔离生产容器构建/导出/加载/迁移/运行验收；它不是生产部署工作流。桌面发布仅由 `client-v*` 标签或手动触发，本轮不创建发布标签。本地环境无法运行 Docker；用户已明确授权由既有 CI 承担最终容器验收。本轮先在 PR 的隔离 CI 验证待提交代码，全部成功后才推进主分支，并跟踪主分支对应提交的 CI 终态。容器验收缺口不再要求本地补齐，也不改用生产环境验证。

本轮临时 PostgreSQL、浏览器及应用进程已结束；隔离目录与日志仅作为本地验证证据保留，不进入产品仓库。PR 作为本次 CI 验证与提交审计记录保留。本次对话适合仅保留在 Solo，不修改路线图。
