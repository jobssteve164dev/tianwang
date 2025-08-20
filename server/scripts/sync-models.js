/**
 * 同步数据库模型
 * Sync Database Models
 */

const { connectDatabases } = require('../src/config/database');
const { initializeModels } = require('../src/models');
const logger = require('../src/utils/logger');

const syncModels = async () => {
  try {
    logger.info('🚀 [Model Sync] Starting model synchronization...');
    
    // 首先连接数据库
    await connectDatabases();
    
    // 初始化模型
    const { sequelize, models } = initializeModels();
    if (!sequelize || !models) {
      throw new Error('Failed to initialize models');
    }
    
    logger.info('✅ [Model Sync] Models initialized successfully');
    
    // 同步所有模型到数据库
    logger.info('🔄 [Model Sync] Syncing models to database...');
    await sequelize.sync({ alter: true, force: false });
    
    logger.info('✅ [Model Sync] All models synced successfully');
    
    // 显示同步的表
    const tables = await sequelize.showAllSchemas();
    logger.info(`📊 [Model Sync] Database contains ${tables.length} tables`);
    
    // 检查新创建的表
    const expectedTables = [
      'users', 'organizations', 'devices', 'agents', 'threat_rules',
      'security_events', 'alert_policies', 'system_configs', 
      'registration_codes', 'alerts', 'ai_resources',
      'user_permissions', 'user_sessions', 'audit_logs'
    ];
    
    for (const tableName of expectedTables) {
      try {
        const tableExists = await sequelize.getQueryInterface().showAllTables();
        if (tableExists.includes(tableName)) {
          logger.info(`✅ [Model Sync] Table '${tableName}' exists`);
        } else {
          logger.warn(`⚠️ [Model Sync] Table '${tableName}' not found`);
        }
      } catch (error) {
        logger.error(`❌ [Model Sync] Error checking table '${tableName}':`, error.message);
      }
    }
    
    logger.info('🎉 [Model Sync] Model synchronization completed successfully!');
    
  } catch (error) {
    logger.error('❌ [Model Sync] Model synchronization failed:', error);
    process.exit(1);
  }
};

syncModels();

