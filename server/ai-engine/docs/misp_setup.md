# MISP威胁情报配置指南

## 概述

MISP (Malware Information Sharing Platform) 是一个开源的威胁情报共享平台，用于收集、存储、分发和共享网络安全威胁信息。本AI引擎支持与MISP服务器集成，获取真实的威胁情报数据。

## 配置步骤

### 1. 获取MISP服务器访问权限

#### 选项A: 使用公共MISP服务器
- **MISP社区服务器**: https://www.misp-project.org/communities/
- **CIRCL MISP**: https://www.circl.lu/services/misp-malware-information-sharing-platform/
- **其他公共实例**: 查看MISP官方网站获取更多公共实例

#### 选项B: 搭建私有MISP服务器
参考官方文档: https://www.misp-project.org/installation/

### 2. 获取API密钥

1. 登录MISP服务器
2. 进入用户设置页面
3. 生成新的API密钥
4. 记录API密钥和服务器URL

### 3. 配置环境变量

在 `server/ai-engine/.env` 文件中添加以下配置:

```bash
# MISP威胁情报配置
AI_MISP_URL=https://your-misp-instance.com
AI_MISP_API_KEY=your-misp-api-key-here

# 备选威胁情报源 - OTX
AI_OTX_API_KEY=your-otx-api-key-here
```

### 4. 验证配置

启动AI引擎后，检查日志确认MISP连接状态:

```bash
# 查看AI引擎日志
tail -f server/ai-engine/logs/ai-engine.log
```

成功连接时应该看到:
```
[INFO] MISP连接测试成功
[INFO] 成功获取MISP威胁情报数据
```

## 备选威胁情报源

### OTX (AlienVault Open Threat Exchange)

如果无法配置MISP，可以使用OTX作为备选威胁情报源:

1. 注册OTX账户: https://otx.alienvault.com/
2. 获取API密钥
3. 配置环境变量: `AI_OTX_API_KEY=your-otx-api-key`

### 其他威胁情报源

AI引擎还支持以下威胁情报源:
- **VirusTotal**: 恶意软件分析
- **AbuseIPDB**: IP信誉数据库
- **URLVoid**: URL信誉检查

## 故障排除

### 常见问题

1. **连接超时**
   - 检查网络连接
   - 验证MISP服务器URL是否正确
   - 确认防火墙设置

2. **认证失败**
   - 验证API密钥是否正确
   - 检查API密钥是否过期
   - 确认用户权限

3. **数据获取失败**
   - 检查MISP服务器状态
   - 验证API端点是否可用
   - 查看MISP服务器日志

### 调试命令

```bash
# 测试MISP连接
curl -H "Authorization: your-api-key" \
     -H "Accept: application/json" \
     https://your-misp-instance.com/servers/getVersion

# 检查AI引擎配置
cd server/ai-engine
python -c "from src.config import config; print(f'MISP URL: {config.misp_url}'); print(f'MISP Configured: {config.misp_configured}')"
```

## 安全注意事项

1. **API密钥安全**
   - 不要在代码中硬编码API密钥
   - 使用环境变量或配置文件
   - 定期轮换API密钥

2. **网络安全**
   - 使用HTTPS连接MISP服务器
   - 验证SSL证书
   - 限制网络访问

3. **数据隐私**
   - 了解MISP数据共享政策
   - 遵守相关法律法规
   - 保护敏感信息

## 性能优化

1. **缓存配置**
   - 启用Redis缓存
   - 设置合适的缓存TTL
   - 监控缓存命中率

2. **并发控制**
   - 限制并发请求数
   - 实现请求限流
   - 监控API使用量

3. **数据更新**
   - 设置定期更新策略
   - 增量更新数据
   - 监控数据新鲜度
