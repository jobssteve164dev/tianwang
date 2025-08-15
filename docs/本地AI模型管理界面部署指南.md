# 本地AI模型管理界面部署指南

## 概述

本文档提供了天网网络安全监控系统中本地AI模型管理界面的完整部署指南，包括环境准备、安装配置、启动验证和故障排除等内容。

## 系统要求

### 硬件要求

- **CPU**: 4核心以上，支持AVX指令集
- **内存**: 8GB以上（推荐16GB）
- **存储**: 50GB以上可用空间
- **网络**: 稳定的网络连接

### 软件要求

- **操作系统**: Linux (Ubuntu 18.04+, CentOS 7+) 或 Windows 10+
- **Node.js**: 16.x 或 18.x
- **Python**: 3.8 或 3.9
- **数据库**: MySQL 8.0+ 或 PostgreSQL 12+
- **Redis**: 6.0+
- **Docker**: 20.10+ (可选)

## 环境准备

### 1. 安装Node.js

```bash
# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# CentOS/RHEL
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs

# 验证安装
node --version
npm --version
```

### 2. 安装Python

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install python3 python3-pip python3-venv

# CentOS/RHEL
sudo yum install python3 python3-pip

# 验证安装
python3 --version
pip3 --version
```

### 3. 安装数据库

#### MySQL安装

```bash
# Ubuntu/Debian
sudo apt-get install mysql-server

# CentOS/RHEL
sudo yum install mysql-server
sudo systemctl start mysqld
sudo systemctl enable mysqld

# 安全配置
sudo mysql_secure_installation
```

#### PostgreSQL安装

```bash
# Ubuntu/Debian
sudo apt-get install postgresql postgresql-contrib

# CentOS/RHEL
sudo yum install postgresql-server postgresql-contrib
sudo postgresql-setup initdb
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### 4. 安装Redis

```bash
# Ubuntu/Debian
sudo apt-get install redis-server

# CentOS/RHEL
sudo yum install redis
sudo systemctl start redis
sudo systemctl enable redis

# 验证安装
redis-cli ping
```

## 项目部署

### 1. 克隆项目

```bash
git clone https://github.com/your-org/tianwang.git
cd tianwang
```

### 2. 后端部署

#### 2.1 安装依赖

```bash
cd server
npm install
```

#### 2.2 配置环境变量

创建 `.env` 文件：

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```env
# 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_NAME=tianwang
DB_USER=tianwang_user
DB_PASSWORD=your_secure_password

# Redis配置
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT配置
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=7d

# 服务器配置
PORT=3000
NODE_ENV=production

# AI引擎配置
AI_ENGINE_URL=http://localhost:8000
AI_ENGINE_API_KEY=your_ai_engine_api_key

# 外部AI服务配置
OPENAI_API_KEY=your_openai_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key
```

#### 2.3 数据库初始化

```bash
# 创建数据库
mysql -u root -p -e "CREATE DATABASE tianwang CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u root -p -e "CREATE USER 'tianwang_user'@'localhost' IDENTIFIED BY 'your_secure_password';"
mysql -u root -p -e "GRANT ALL PRIVILEGES ON tianwang.* TO 'tianwang_user'@'localhost';"
mysql -u root -p -e "FLUSH PRIVILEGES;"

# 运行数据库迁移
npm run migrate
```

#### 2.4 启动后端服务

```bash
# 开发模式
npm run dev

# 生产模式
npm run build
npm start
```

### 3. AI引擎部署

#### 3.1 安装Python依赖

```bash
cd server/ai-engine
python3 -m venv venv
source venv/bin/activate  # Linux/Mac
# 或
venv\Scripts\activate  # Windows

pip install -r requirements.txt
```

#### 3.2 配置AI引擎

编辑 `config/hybrid-engine-config.yml`：

```yaml
scheduler:
  max_concurrent_tasks: 4
  task_timeout: 3600

local_models:
  models_path: "./models"
  cache_size: 1000

rule_engine:
  rules_path: "./rules"
  update_interval: 3600

external_apis:
  openai:
    api_key: "your_openai_api_key"
    base_url: "https://api.openai.com/v1"
    timeout: 30
  anthropic:
    api_key: "your_anthropic_api_key"
    base_url: "https://api.anthropic.com"
    timeout: 30
```

#### 3.3 启动AI引擎

```bash
# 开发模式
python src/main.py

# 生产模式
gunicorn src.main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

### 4. 前端部署

#### 4.1 安装依赖

```bash
cd client
npm install
```

#### 4.2 配置环境变量

创建 `.env` 文件：

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```env
REACT_APP_API_BASE_URL=http://localhost:3000/api
REACT_APP_AI_ENGINE_URL=http://localhost:8000
REACT_APP_VERSION=1.0.0
```

#### 4.3 构建前端

```bash
npm run build
```

#### 4.4 部署到Web服务器

##### Nginx配置

创建 `/etc/nginx/sites-available/tianwang`：

```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /path/to/tianwang/client/build;
    index index.html;

    # 静态文件缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # API代理
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # AI引擎代理
    location /ai-engine/ {
        proxy_pass http://localhost:8000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # 前端路由
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

启用站点：

```bash
sudo ln -s /etc/nginx/sites-available/tianwang /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 服务管理

### 1. 使用PM2管理Node.js服务

```bash
# 安装PM2
npm install -g pm2

# 启动后端服务
cd server
pm2 start ecosystem.config.js

# 启动AI引擎
cd server/ai-engine
pm2 start ecosystem.config.js

# 查看服务状态
pm2 status

# 查看日志
pm2 logs

# 重启服务
pm2 restart all
```

### 2. 使用Systemd管理服务

创建服务文件 `/etc/systemd/system/tianwang-backend.service`：

```ini
[Unit]
Description=TianWang Backend Service
After=network.target mysql.service redis.service

[Service]
Type=simple
User=tianwang
WorkingDirectory=/path/to/tianwang/server
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

创建服务文件 `/etc/systemd/system/tianwang-ai-engine.service`：

```ini
[Unit]
Description=TianWang AI Engine Service
After=network.target

[Service]
Type=simple
User=tianwang
WorkingDirectory=/path/to/tianwang/server/ai-engine
ExecStart=/path/to/tianwang/server/ai-engine/venv/bin/python src/main.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

启动服务：

```bash
sudo systemctl daemon-reload
sudo systemctl enable tianwang-backend
sudo systemctl enable tianwang-ai-engine
sudo systemctl start tianwang-backend
sudo systemctl start tianwang-ai-engine
```

## 验证部署

### 1. 健康检查

```bash
# 检查后端服务
curl http://localhost:3000/api/health

# 检查AI引擎
curl http://localhost:8000/health

# 检查前端
curl http://your-domain.com
```

### 2. 功能测试

1. 访问前端界面
2. 登录系统
3. 进入"设置" -> "本地AI模型管理"
4. 测试各个功能模块

### 3. 性能测试

```bash
# 使用Apache Bench进行压力测试
ab -n 1000 -c 10 http://localhost:3000/api/health
```

## 监控和日志

### 1. 日志配置

#### 后端日志

```bash
# 查看后端日志
pm2 logs tianwang-backend

# 或
sudo journalctl -u tianwang-backend -f
```

#### AI引擎日志

```bash
# 查看AI引擎日志
pm2 logs tianwang-ai-engine

# 或
sudo journalctl -u tianwang-ai-engine -f
```

### 2. 监控指标

- CPU使用率
- 内存使用率
- 磁盘使用率
- 网络流量
- 响应时间
- 错误率

### 3. 告警配置

配置监控告警：

```bash
# 使用Prometheus + Grafana
# 或使用云监控服务
```

## 故障排除

### 1. 常见问题

#### 问题1: 数据库连接失败

**症状**: 后端服务启动失败，显示数据库连接错误

**解决方案**:
```bash
# 检查数据库服务状态
sudo systemctl status mysql

# 检查数据库连接
mysql -u tianwang_user -p -h localhost

# 检查防火墙设置
sudo ufw status
```

#### 问题2: AI引擎启动失败

**症状**: AI引擎服务无法启动

**解决方案**:
```bash
# 检查Python环境
python3 --version
pip3 list

# 检查依赖安装
cd server/ai-engine
pip install -r requirements.txt

# 检查配置文件
cat config/hybrid-engine-config.yml
```

#### 问题3: 前端无法访问

**症状**: 浏览器无法加载前端页面

**解决方案**:
```bash
# 检查Nginx配置
sudo nginx -t

# 检查Nginx服务状态
sudo systemctl status nginx

# 检查防火墙设置
sudo ufw status
```

### 2. 日志分析

```bash
# 查看错误日志
sudo tail -f /var/log/nginx/error.log
sudo journalctl -u tianwang-backend -f
sudo journalctl -u tianwang-ai-engine -f
```

### 3. 性能优化

#### 数据库优化

```sql
-- 优化MySQL配置
SET GLOBAL innodb_buffer_pool_size = 1073741824; -- 1GB
SET GLOBAL max_connections = 200;
```

#### 应用优化

```bash
# 启用Node.js集群模式
pm2 start ecosystem.config.js --instances max

# 启用AI引擎多进程
gunicorn src.main:app -w 4 -k uvicorn.workers.UvicornWorker
```

## 备份和恢复

### 1. 数据库备份

```bash
# 创建备份脚本
#!/bin/bash
BACKUP_DIR="/backup/mysql"
DATE=$(date +%Y%m%d_%H%M%S)
mysqldump -u root -p tianwang > $BACKUP_DIR/tianwang_$DATE.sql

# 设置定时备份
crontab -e
# 添加以下行
0 2 * * * /path/to/backup_script.sh
```

### 2. 文件备份

```bash
# 备份配置文件
tar -czf /backup/config_$(date +%Y%m%d).tar.gz \
  server/.env \
  server/ai-engine/config/ \
  client/.env
```

### 3. 恢复流程

```bash
# 恢复数据库
mysql -u root -p tianwang < backup_file.sql

# 恢复配置文件
tar -xzf backup_file.tar.gz
```

## 安全配置

### 1. 防火墙设置

```bash
# 配置UFW防火墙
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### 2. SSL证书配置

```bash
# 使用Let's Encrypt
sudo apt-get install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

### 3. 安全加固

```bash
# 更新系统
sudo apt-get update && sudo apt-get upgrade

# 配置SSH安全
sudo nano /etc/ssh/sshd_config
# 禁用root登录
# 更改默认端口
# 启用密钥认证
```

## 更新和维护

### 1. 代码更新

```bash
# 拉取最新代码
git pull origin main

# 更新依赖
cd server && npm install
cd ../client && npm install
cd ../server/ai-engine && pip install -r requirements.txt

# 重新构建
cd ../../client && npm run build
cd ../server && npm run build

# 重启服务
pm2 restart all
```

### 2. 数据库迁移

```bash
cd server
npm run migrate
```

### 3. 监控和维护

- 定期检查日志
- 监控系统资源
- 更新安全补丁
- 备份重要数据

## 联系支持

如果在部署过程中遇到问题，请联系技术支持团队：

- **邮箱**: support@tianwang.com
- **文档**: https://docs.tianwang.com
- **GitHub**: https://github.com/your-org/tianwang/issues

---

*本文档将根据系统更新持续维护，请关注最新版本。*
