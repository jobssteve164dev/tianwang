console.log('=== 最简单的测试 ===');

try {
  console.log('1. 测试基本语法...');
  const express = require('express');
  console.log('✅ Express 导入成功');
  
  console.log('2. 测试配置文件...');
  const config = require('./src/config');
  console.log('✅ Config 导入成功:', config.app);
  
  console.log('3. 测试日志器...');
  const logger = require('./src/utils/logger');
  console.log('✅ Logger 导入成功');
  
  console.log('4. 测试数据库配置...');
  const { connectDatabases } = require('./src/config/database');
  console.log('✅ Database 配置导入成功');
  
  console.log('5. 测试安全服务...');
  const keyManagementService = require('./src/services/KeyManagementService');
  console.log('✅ KeyManagementService 导入成功');
  
  console.log('6. 测试路由...');
  const { router } = require('./src/routes');
  console.log('✅ Routes 导入成功');
  
  console.log('=== 所有测试通过 ===');
  
} catch (error) {
  console.error('❌ 测试失败:', error.message);
  console.error('错误堆栈:', error.stack);
  process.exit(1);
}
