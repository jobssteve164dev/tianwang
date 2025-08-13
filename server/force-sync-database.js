/**
 * 强制数据库同步脚本
 * Force Database Sync Script
 */

const { connectDatabases, getSequelize } = require('./src/config/database');
const logger = require('./src/utils/logger');

// 直接导入所有模型
const User = require('./src/models/User');
const Organization = require('./src/models/Organization');
const Device = require('./src/models/Device');
const Agent = require('./src/models/Agent');
const ThreatRule = require('./src/models/ThreatRule');
const SecurityEvent = require('./src/models/SecurityEvent');
const AlertPolicy = require('./src/models/AlertPolicy');
const SystemConfig = require('./src/models/SystemConfig');
const RegistrationCode = require('./src/models/RegistrationCode');

async function forceSyncDatabase() {
  try {
    console.log('🔄 开始强制同步数据库模型...');
    logger.info('🔄 开始强制同步数据库模型...');

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

    // 强制初始化所有模型
    console.log('🔄 初始化所有模型...');
    logger.info('🔄 初始化所有模型...');
    
    const models = {
      User: User(sequelize),
      Organization: Organization(sequelize),
      Device: Device(sequelize),
      Agent: Agent(sequelize),
      ThreatRule: ThreatRule(sequelize),
      SecurityEvent: SecurityEvent(sequelize),
      AlertPolicy: AlertPolicy(sequelize),
      SystemConfig: SystemConfig(sequelize),
      RegistrationCode: RegistrationCode(sequelize)
    };

    console.log('✅ 模型初始化完成');
    logger.info('✅ 模型初始化完成');

    // 设置模型关联关系
    Object.keys(models).forEach(modelName => {
      if (models[modelName].associate) {
        models[modelName].associate(models);
      }
    });

    // 强制同步所有模型
    console.log('🔄 强制同步模型到数据库...');
    logger.info('🔄 强制同步模型到数据库...');
    
    await sequelize.sync({ force: true });
    
    console.log('✅ 数据库模型强制同步完成');
    logger.info('✅ 数据库模型强制同步完成');

    // 显示所有表
    const tables = await sequelize.showAllSchemas();
    console.log('📋 数据库中的表:');
    logger.info('📋 数据库中的表:');
    
    for (const table of tables) {
      console.log(`  - ${table.name}`);
      logger.info(`  - ${table.name}`);
    }

    // 验证registration_codes表是否存在
    const tableExists = await sequelize.query(
      "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'registration_codes')",
      { type: sequelize.QueryTypes.SELECT }
    );
    
    if (tableExists[0].exists) {
      console.log('✅ registration_codes表创建成功');
      logger.info('✅ registration_codes表创建成功');
    } else {
      console.log('❌ registration_codes表创建失败');
      logger.error('❌ registration_codes表创建失败');
    }

  } catch (error) {
    console.error('❌ 数据库同步失败:', error.message);
    logger.error('❌ 数据库同步失败:', error);
    throw error;
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  forceSyncDatabase()
    .then(() => {
      console.log('✅ 强制数据库同步脚本执行完成');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ 强制数据库同步脚本执行失败:', error);
      process.exit(1);
    });
}

module.exports = { forceSyncDatabase };

