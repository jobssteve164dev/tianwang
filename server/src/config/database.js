/**
 * 数据库连接配置
 * Database Connection Configuration
 */

const { Sequelize } = require('sequelize');
const config = require('./index');
const logger = require('../utils/logger');

let sequelize = null;

/**
 * PostgreSQL连接配置
 */
function initializePostgreSQL() {
  if (sequelize) {
    return sequelize;
  }

  const { postgres } = config.database;
  
  sequelize = new Sequelize({
    database: postgres.database,
    username: postgres.username,
    password: postgres.password,
    host: postgres.host,
    port: postgres.port,
    dialect: 'postgres',
    logging: config.app.env === 'development' ? 
      (msg) => logger.debug(`[PostgreSQL] ${msg}`) : false,
    pool: postgres.pool,
    dialectOptions: {
      ssl: postgres.ssl ? {
        require: true,
        rejectUnauthorized: false
      } : false
    },
    define: {
      timestamps: true,
      underscored: true,
      freezeTableName: true
    }
  });

  return sequelize;
}

/**
 * 连接所有数据库
 */
async function connectDatabases() {
  try {
    // 检查是否跳过数据库连接（开发环境）
    if (process.env.NODE_ENV === 'development' && process.env.SKIP_DB === 'true') {
      logger.warn('⚠️ Skipping database connection in development mode');
      return;
    }

    // 初始化PostgreSQL
    logger.info('📊 Initializing PostgreSQL...');
    initializePostgreSQL();
    await sequelize.authenticate();
    logger.info('✅ PostgreSQL connected successfully');

    // 同步数据库模型（仅在开发环境）
    if (config.app.env === 'development') {
      logger.info('🔄 Syncing database models...');
      await sequelize.sync({ alter: true });
      logger.info('✅ Database models synced');
    }

  } catch (error) {
    logger.error('❌ Database connection failed:', error);
    throw error;
  }
}

/**
 * 关闭所有数据库连接
 */
async function closeDatabases() {
  try {
    if (sequelize) {
      await sequelize.close();
      logger.info('✅ PostgreSQL connection closed');
    }

    logger.info('✅ All database connections closed');

  } catch (error) {
    logger.error('❌ Error closing database connections:', error);
  }
}

/**
 * 获取数据库实例
 */
function getSequelize() {
  if (!sequelize) {
    // 在开发环境下，如果没有初始化数据库，返回null而不是抛出错误
    if (process.env.NODE_ENV === 'development' && process.env.SKIP_DB === 'true') {
      console.log('⚠️  Skipping database initialization in development mode');
      return null;
    }
    throw new Error('PostgreSQL not initialized. Call connectDatabases() first.');
  }
  return sequelize;
}

/**
 * 数据库健康检查
 */
async function healthCheck() {
  const status = {
    postgres: 'unknown'
  };

  try {
    // PostgreSQL健康检查
    await sequelize.authenticate();
    status.postgres = 'healthy';
  } catch (error) {
    status.postgres = 'unhealthy';
    logger.error('PostgreSQL health check failed:', error.message);
  }

  return status;
}

module.exports = {
  initializePostgreSQL,
  connectDatabases,
  closeDatabases,
  getSequelize,
  healthCheck
};
