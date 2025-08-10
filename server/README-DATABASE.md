# 数据库初始化指南

## 概述

天网安全监控系统使用PostgreSQL作为主数据库。本文档说明如何在开发环境中初始化数据库。

## 前提条件

1. 安装PostgreSQL (推荐版本 12+)
2. 确保PostgreSQL服务正在运行
3. 确保有创建数据库的权限

## 快速开始

### 1. 自动初始化（推荐）

```bash
# 在server目录下运行
npm run db:init
```

这个命令会：
- 连接到PostgreSQL服务器
- 检查数据库是否存在
- 如果不存在，创建 `tianwang_dev` 数据库

### 2. 手动初始化

如果自动初始化失败，可以手动创建数据库：

```sql
-- 连接到PostgreSQL
psql -U postgres

-- 创建数据库
CREATE DATABASE tianwang_dev;

-- 创建用户（如果需要）
CREATE USER tianwang WITH PASSWORD 'tianwang123';

-- 授权
GRANT ALL PRIVILEGES ON DATABASE tianwang_dev TO tianwang;

-- 退出
\q
```

## 配置说明

数据库配置在 `dev.local` 文件中：

```bash
# PostgreSQL 数据库配置
DB_HOST=localhost
DB_PORT=5432
DB_NAME=tianwang_dev
DB_USER=tianwang
DB_PASSWORD=tianwang123
DB_SSL=false
```

## 开发模式

在开发环境中，可以通过设置 `SKIP_DB=true` 来跳过数据库连接：

```bash
# 在 dev.local 中设置
SKIP_DB=true
```

这样系统会启动但不会尝试连接数据库，适用于：
- 数据库服务未启动
- 只想测试API功能
- 快速开发调试

## 故障排除

### 1. 连接被拒绝

```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**解决方案：**
- 确保PostgreSQL服务正在运行
- 检查端口配置是否正确
- 检查防火墙设置

### 2. 认证失败

```
Error: password authentication failed
```

**解决方案：**
- 检查用户名和密码是否正确
- 确保用户有访问数据库的权限
- 检查 `pg_hba.conf` 配置

### 3. 数据库不存在

```
Error: database "tianwang_dev" does not exist
```

**解决方案：**
- 运行 `npm run db:init` 创建数据库
- 或手动创建数据库

### 4. 权限不足

```
Error: permission denied to create database
```

**解决方案：**
- 使用有创建数据库权限的用户
- 或手动创建数据库

## 生产环境

在生产环境中：

1. 不要设置 `SKIP_DB=true`
2. 使用强密码
3. 启用SSL连接
4. 配置适当的连接池大小
5. 定期备份数据库

## 相关命令

```bash
# 初始化数据库
npm run db:init

# 运行数据库迁移
npm run db:migrate

# 填充测试数据
npm run db:seed

# 重置数据库（迁移 + 填充数据）
npm run db:reset
```
