/**
 * 数据库同步脚本
 * Database Sync Script
 */

const { connectDatabases, getSequelize } = require('./src/config/database');
const logger = require('./src/utils/logger');

async function syncDatabase() {
  try {
    console.log('🔄 开始同步数据库模型...');
    logger.info('🔄 开始同步数据库模型...');

    // 先连接数据库
    console.log('🔄 连接数据库...');
    logger.info('🔄 连接数据库...');
    await connectDatabases();

    // 获取Sequelize实例
    const sequelize = getSequelize();
    
    if (!sequelize) {
      console.error('❌ 无法获取数据库连接');
      logger.error('❌ 无法获取数据库连接');
      return;
    }

    // 测试数据库连接
    await sequelize.authenticate();
    console.log('✅ 数据库连接成功');
    logger.info('✅ 数据库连接成功');

    // 同步所有模型
    console.log('🔄 同步模型到数据库...');
    logger.info('🔄 同步模型到数据库...');
    
    await sequelize.sync({ alter: true, force: false });
    
    console.log('✅ 数据库模型同步完成');
    logger.info('✅ 数据库模型同步完成');

    // 显示所有表
    const tables = await sequelize.showAllSchemas();
    console.log('📋 数据库中的表:');
    logger.info('📋 数据库中的表:');
    
    for (const table of tables) {
      console.log(`  - ${table.name}`);
      logger.info(`  - ${table.name}`);
    }

  } catch (error) {
    console.error('❌ 数据库同步失败:', error.message);
    logger.error('❌ 数据库同步失败:', error);
    throw error;
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  syncDatabase()
    .then(() => {
      console.log('✅ 数据库同步脚本执行完成');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ 数据库同步脚本执行失败:', error);
      process.exit(1);
    });
}

module.exports = { syncDatabase };
