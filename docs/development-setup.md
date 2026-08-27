# 天网安全监控系统 - 开发环境设置指南

## 概述

本文档介绍如何在本地设置和运行天网安全监控系统的开发环境。我们提供了一套完整的脚本来自动化开发环境的启动、停止和状态检查。

## 系统要求

### 必需软件
- **Node.js** >= 18.0.0
- **npm** >= 8.0.0
- **Python 3.11**
- **PostgreSQL** >= 12
- **Redis** >= 6.0

### 可选软件
- **Kafka** >= 2.8 (用于消息队列)
- **InfluxDB** >= 2.0 (用于时序数据)

## 快速开始

### 1. 克隆项目
```bash
git clone <repository-url>
cd tianwang
```

### 2. 配置环境变量
项目根目录下的 `dev.local` 文件包含了所有开发环境的配置。请根据你的本地环境修改以下关键配置：

```bash
# 数据库配置
DB_HOST=localhost
DB_PORT=5432
DB_NAME=tianwang
DB_USER=tianwang
DB_PASSWORD=tianwang123

# Redis配置
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=tianwang123
```

### 3. 安装依赖

```bash
npm run setup
```

### 4. 启动依赖服务并应用表结构

```bash
docker compose up -d postgres redis influxdb zookeeper kafka
npm run db:migrate
```

### 5. 启动开发环境

```bash
npm run dev
```

该命令同时启动 Web 管理端、服务端和 AI 引擎。依赖服务保持由 Docker Compose 管理。

### 6. 访问应用
启动成功后，你可以访问以下地址：

- **前端应用**: http://localhost:3000
- **后端API**: http://localhost:8000/api
- **API文档**: http://localhost:8000/api-docs
- **AI引擎**: http://localhost:8888

## 开发脚本使用

### 启动所有服务
```bash
npm run dev
```

该命令会在任一核心进程失败时停止整组进程，避免留下看似可用、实际断链的开发环境。

### 停止开发进程

在运行 `npm run dev` 的终端按 `Ctrl+C`。Docker 依赖服务可使用 `docker compose stop postgres redis influxdb zookeeper kafka` 停止。

### 查看服务状态
```bash
npm run dev:status
# 或
./scripts/dev-status.sh
```

这个脚本会显示：
- 环境变量文件状态
- 依赖服务状态（PostgreSQL、Redis、Kafka、InfluxDB）
- 应用服务状态（AI引擎、后端、前端）
- 端口占用情况
- 日志文件状态

## 环境变量配置

### dev.local 文件结构

`dev.local` 文件包含了所有开发环境的配置，主要分为以下几个部分：

#### 应用基础配置
```bash
APP_NAME=tianwang
APP_VERSION=1.0.0-alpha.1
NODE_ENV=development
APP_PORT=8000
APP_HOST=localhost
```

#### 数据库配置
```bash
# PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=tianwang
DB_USER=tianwang
DB_PASSWORD=tianwang123

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=tianwang123

# InfluxDB
INFLUXDB_URL=http://localhost:8086
INFLUXDB_TOKEN=tianwang-dev-token-2025
```

#### 认证与安全配置
```bash
JWT_SECRET=tianwang-jwt-dev-secret-key-2025
JWT_EXPIRES_IN=7d
CRYPTO_SECRET_KEY=tianwang-crypto-dev-secret-32-chars-key-2025
```

#### 外部API配置（可选）
```bash
# OpenAI API
OPENAI_API_KEY=your_openai_api_key

# Claude API
CLAUDE_API_KEY=your_claude_api_key

# Gemini API
GEMINI_API_KEY=your_gemini_api_key
```

## 依赖服务设置

### PostgreSQL 设置
```bash
# 创建数据库
createdb tianwang_dev

# 创建用户（如果需要）
createuser -P tianwang
# 输入密码: tianwang123

# 授权
psql -d tianwang_dev -c "GRANT ALL PRIVILEGES ON DATABASE tianwang_dev TO tianwang;"
```

### Redis 设置
```bash
# 启动Redis服务
redis-server

# 设置密码（可选）
redis-cli
> CONFIG SET requirepass "tianwang123"
```

### Kafka 设置（可选）
```bash
# 启动Zookeeper
bin/zookeeper-server-start.sh config/zookeeper.properties

# 启动Kafka
bin/kafka-server-start.sh config/server.properties

# 创建主题
bin/kafka-topics.sh --create --topic security-logs-dev --bootstrap-server localhost:9092
bin/kafka-topics.sh --create --topic security-alerts-dev --bootstrap-server localhost:9092
```

## 故障排除

### 常见问题

#### 1. 端口被占用
如果遇到端口被占用的问题，可以使用状态检查脚本查看：
```bash
./scripts/dev-status.sh
```

然后手动停止占用端口的进程：
```bash
# 查看端口占用
lsof -i :8000

# 确认目标后请求进程正常退出
kill <PID>
```

#### 2. 数据库连接失败
确保PostgreSQL服务正在运行：
```bash
# macOS
brew services start postgresql

# Ubuntu
sudo systemctl start postgresql

# 检查连接
pg_isready -h localhost -p 5432
```

#### 3. Redis连接失败
确保Redis服务正在运行：
```bash
# macOS
brew services start redis

# Ubuntu
sudo systemctl start redis

# 检查连接
redis-cli ping
```

#### 4. 依赖安装失败
如果遇到依赖安装问题，可以尝试：
```bash
# 校验缓存并根据锁文件恢复依赖
npm cache verify
npm ci
npm --prefix agents ci
npm run ai:setup
```

### 日志查看

#### 服务端日志
```bash
tail -f server/logs/dev.log
```

#### AI引擎日志
```bash
tail -f server/ai-engine/logs/app.log
```

#### 客户端日志
在浏览器开发者工具中查看控制台输出。

## 开发工作流

### 1. 日常开发
```bash
# 启动开发环境
npm run dev

# 在另一个终端查看状态
npm run dev:status

# 开发完成后在运行终端按 Ctrl+C
```

### 2. 调试模式
开发脚本会自动启用调试模式：
- 服务端：使用 nodemon 自动重启
- 客户端：使用 React 热重载
- AI引擎：使用 Python 调试模式

### 3. 数据库操作
```bash
# 运行数据库迁移
npm run db:migrate

# 反复执行也只会应用待执行迁移并对齐缺失表
npm run db:migrate
```

## 性能优化

### 开发环境优化
- 使用 `dev.local` 文件管理环境变量，避免硬编码
- 脚本会自动检查依赖服务状态，提前发现问题
- 支持优雅停止，避免进程残留

### 调试优化
- 启用详细日志记录
- 支持热重载和自动重启
- 提供完整的服务状态监控

## 安全注意事项

### 开发环境安全
- `dev.local` 文件包含敏感信息，不要提交到版本控制
- 使用强密码和密钥
- 定期更新依赖包

### 生产环境
- 不要在生产环境使用开发配置
- 使用环境变量或安全的配置管理系统
- 启用所有安全中间件

## 贡献指南

### 代码规范
- 遵循项目的代码风格指南
- 运行 linting 检查：`npm run lint`
- 运行测试：`npm test`

### 提交规范
- 使用清晰的提交信息
- 包含相关的测试
- 更新文档（如果需要）

## 支持

如果遇到问题，请：
1. 查看本文档的故障排除部分
2. 检查项目日志
3. 使用状态检查脚本诊断问题
4. 提交 Issue 到项目仓库
