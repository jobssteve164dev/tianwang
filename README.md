# 天网 (TianWang) - AI驱动的网络安全监控系统

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)]()
[![Version](https://img.shields.io/badge/version-v1.0.0--alpha-orange.svg)]()

## 🛡️ 项目简介

天网是一个以AI为核心能力的分布式网络安全监控与主动防护平台，通过多客户端实时收集设备日志数据，利用机器学习算法和开源安全规则自动识别网络安全威胁，并具备智能防火墙能力进行主动阻断。

## ✨ 核心特性

- 🔍 **智能威胁检测**: AI模型 + 开源规则库的混合检测引擎
- 🖥️ **多平台支持**: Windows、Linux、macOS、OpenWrt全平台覆盖
- 🛡️ **主动防护**: 实时阻断恶意IP、进程、网络连接
- 📊 **可视化仪表盘**: 实时安全态势和威胁分析
- 🚨 **智能告警**: 多渠道告警通知和响应策略
- 🔒 **合规安全**: 满足GDPR、网络安全法等合规要求

## 🏗️ 系统架构

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   多平台客户端    │───▶│   API网关层     │───▶│   AI分析引擎    │
│ Win/Linux/macOS │    │  负载均衡/认证   │    │ 威胁检测/规则引擎│
│   OpenWrt网关   │    │                │    │                │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │                       │
                                ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web仪表盘     │◀───│   消息队列      │───▶│   防护策略服务   │
│  实时监控/报告   │    │    Kafka       │    │  规则下发/阻断   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🚀 快速开始

### 环境要求

- Node.js 20+
- Python 3.9+
- Docker & Docker Compose
- PostgreSQL 14+
- InfluxDB 2.0+
- Apache Kafka 3.0+

### 安装部署

1. **克隆项目**
   ```bash
   git clone https://github.com/your-org/tianwang.git
   cd tianwang
   ```

2. **环境配置**
   ```bash
   cp config/dev/example.env config/dev/.env
   # 编辑配置文件
   ```

3. **启动服务**
   ```bash
   docker-compose up -d
   ```

4. **访问系统**
   - Web仪表盘: http://localhost:3000
   - API文档: http://localhost:8000/docs

## 📁 项目结构

```
tianwang/
├── server/           # 后端服务
│   ├── src/         # 源码目录
│   ├── tests/       # 测试文件
│   └── logs/        # 日志文件
├── client/          # 前端仪表盘
│   ├── src/         # React源码
│   └── public/      # 静态资源
├── agents/          # 多平台客户端
│   ├── windows/     # Windows客户端
│   ├── linux/       # Linux客户端
│   ├── macos/       # macOS客户端
│   └── openwrt/     # OpenWrt客户端
├── docker/          # 容器配置
├── docs/            # 项目文档
├── scripts/         # 部署脚本
└── config/          # 配置文件
```

## 🤝 开源规则库集成

天网集成了多个优秀的开源安全规则库：

- **SigmaHQ/sigma**: 3000+ Sigma检测规则
- **Suricata规则**: 网络入侵检测
- **YARA规则**: 恶意软件特征匹配
- **MISP威胁情报**: IOC指标和威胁情报

## 📖 文档

- [部署指南](docs/deployment/README.md)
- [API文档](docs/api/README.md)
- [用户手册](docs/user-guide/README.md)
- [开发指南](docs/development/README.md)

## 🤝 贡献指南

欢迎提交Issue和Pull Request！请查看 [CONTRIBUTING.md](CONTRIBUTING.md) 了解详细信息。

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🙏 致谢

感谢以下开源项目的支持：
- [SigmaHQ](https://github.com/SigmaHQ/sigma) - 安全检测规则
- [Suricata](https://suricata.io/) - 网络入侵检测
- [YARA](https://virustotal.github.io/yara/) - 恶意软件检测

## 📧 联系我们

- 项目主页: https://github.com/your-org/tianwang
- 问题反馈: https://github.com/your-org/tianwang/issues
- 邮箱: security@tianwang.ai

---

**天网 - 让网络安全变得智能化** 🛡️✨ # tianwang
# tianwang
