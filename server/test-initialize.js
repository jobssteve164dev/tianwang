console.log('=== 测试initialize函数 ===');

// 设置环境变量
process.env.NODE_ENV = 'development';
process.env.APP_PORT = '3001';

try {
  console.log('1. 导入主文件...');
  const { initialize } = require('./src/index.js');
  console.log('✅ 主文件导入成功');
  
  console.log('2. 调用initialize函数...');
  initialize().then(() => {
    console.log('✅ initialize函数执行成功');
  }).catch((error) => {
    console.error('❌ initialize函数执行失败:', error.message);
    console.error('错误堆栈:', error.stack);
  });
  
} catch (error) {
  console.error('❌ 测试失败:', error.message);
  console.error('错误堆栈:', error.stack);
  process.exit(1);
}
