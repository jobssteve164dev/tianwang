console.log('=== 开始调试测试 ===');

try {
  console.log('1. 测试基本模块导入...');
  const express = require('express');
  console.log('✅ Express 导入成功');
  
  const logger = require('./src/utils/logger');
  console.log('✅ Logger 导入成功');
  
  const config = require('./src/config');
  console.log('✅ Config 导入成功');
  console.log('Config:', {
    app: config.app,
    database: config.database ? '已配置' : '未配置'
  });
  
  console.log('2. 测试安全服务导入...');
  const keyManagementService = require('./src/services/KeyManagementService');
  console.log('✅ KeyManagementService 导入成功');
  
  const deviceFingerprintService = require('./src/services/DeviceFingerprintService');
  console.log('✅ DeviceFingerprintService 导入成功');
  
  const registrationCodeService = require('./src/services/RegistrationCodeService');
  console.log('✅ RegistrationCodeService 导入成功');
  
  console.log('3. 测试数据库连接...');
  const { connectDatabases } = require('./src/config/database');
  console.log('✅ Database 模块导入成功');
  
  console.log('4. 测试路由模块...');
  const { router: routes, setServices: setRouteServices } = require('./src/routes');
  console.log('✅ Routes 模块导入成功');
  
  console.log('=== 所有模块导入成功 ===');
  
} catch (error) {
  console.error('❌ 调试测试失败:', error.message);
  console.error('错误堆栈:', error.stack);
  process.exit(1);
}
