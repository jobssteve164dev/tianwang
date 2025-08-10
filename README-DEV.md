# 天网安全监控系统 - 开发环境快速指南

## 🚀 快速开始

### 1. 启动开发环境
```bash
npm run dev
```

### 2. 查看服务状态
```bash
npm run dev:status
```

### 3. 停止所有服务
```bash
npm run dev:stop
```

### 4. 清理环境（解决端口冲突等）
```bash
npm run dev:cleanup
```

### 5. 测试环境
```bash
npm run dev:test
```

## 📋 可用脚本

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动完整的开发环境 |
| `npm run dev:stop` | 停止所有开发服务 |
| `npm run dev:status` | 查看服务运行状态 |
| `npm run dev:cleanup` | 清理端口占用和残留进程 |
| `npm run dev:test` | 测试开发环境是否正常 |
| `npm run dev:legacy` | 使用旧版启动方式 |

## 🌐 访问地址

启动成功后，可以访问以下地址：

- **前端应用**: http://localhost:3333
- **后端API**: http://localhost:5555/api
- **API文档**: http://localhost:5555/api-docs
- **AI引擎**: http://localhost:8888

## ⚙️ 环境配置

开发环境配置在 `dev.local` 文件中，包含：

- 数据库连接配置
- Redis 配置
- JWT 密钥
- 外部 API 密钥（可选）
- 其他服务配置

## 🔧 故障排除

### 端口被占用
```bash
# 查看端口占用
lsof -i :5555

# 清理环境
npm run dev:cleanup
```

### 服务启动失败
```bash
# 查看状态
npm run dev:status

# 查看日志
tail -f server/logs/dev.log
```

### 依赖问题
```bash
# 重新安装依赖
rm -rf node_modules server/node_modules client/node_modules
npm install
```

## 📚 详细文档

更多详细信息请查看：[docs/development-setup.md](docs/development-setup.md)
