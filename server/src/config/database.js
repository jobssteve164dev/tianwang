/**
 * 数据库连接配置
 * Database Connection Configuration
 */

const { Sequelize } = require('sequelize');
const { InfluxDB } = require('@influxdata/influxdb-client');
const Redis = require('redis');
const config = require('./index');
const logger = require('../utils/logger');

let sequelize = null;
let influxDB = null;
let redisClient = null;

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
 * InfluxDB连接配置
 */
function initializeInfluxDB() {
  const { influxdb } = config.database;
  
  influxDB = new InfluxDB({
    url: influxdb.url,
    token: influxdb.token
  });

  return influxDB;
}

/**
 * Redis连接配置
 */
function initializeRedis() {
  logger.debug('🔍 database.js: initializeRedis() 开始执行');
  const { redis } = config.database;
  
  logger.debug('🔍 database.js: Redis配置检查:');
  logger.debug(`   host: ${redis.host}`);
  logger.debug(`   port: ${redis.port}`);
  logger.debug(`   db: ${redis.db}`);
  logger.debug(`   password: ${redis.password ? '已设置' : '未设置'}`);
  
  const redisConfig = {
    socket: {
      host: redis.host,
      port: redis.port
    },
    database: redis.db
  };
  
  // 只有在配置了密码时才添加密码
  if (redis.password && redis.password.trim() !== '') {
    redisConfig.password = redis.password;
    logger.debug('🔍 database.js: 添加了Redis密码配置');
  } else {
    logger.debug('🔍 database.js: 未添加Redis密码配置');
  }
  
  logger.debug('🔍 database.js: Redis配置对象:', JSON.stringify(redisConfig, null, 2));
  logger.debug('🔍 database.js: 创建Redis客户端...');
  
  redisClient = Redis.createClient(redisConfig);

  // Redis事件监听
  redisClient.on('connect', () => {
    logger.info('✅ database.js: Redis connected');
  });

  redisClient.on('error', (error) => {
    logger.error('❌ database.js: Redis connection error:', error);
    logger.error('❌ database.js: 错误详情:', {
      message: error.message,
      code: error.code,
      stack: error.stack
    });
  });

  redisClient.on('ready', () => {
    logger.info('🚀 database.js: Redis ready');
  });

  redisClient.on('end', () => {
    logger.info('🔌 database.js: Redis connection ended');
  });

  logger.debug('🔍 database.js: Redis客户端创建完成');
  return redisClient;
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

    // 初始化InfluxDB（可选）
    logger.info('📈 Initializing InfluxDB...');
    try {
      initializeInfluxDB();
      
      // 测试InfluxDB连接
      const health = await influxDB.health();
      if (health.status === 'pass') {
        logger.info('✅ InfluxDB connected successfully');
      } else {
        logger.warn('⚠️ InfluxDB health check failed, continuing without InfluxDB');
      }
    } catch (error) {
      logger.warn('⚠️ InfluxDB initialization failed, continuing without InfluxDB:', error.message);
    }

    // 初始化Redis
    logger.info('🔄 Initializing Redis...');
    try {
      initializeRedis();
      await redisClient.connect();
      logger.info('✅ Redis connected successfully');
    } catch (error) {
      logger.warn('⚠️ Redis initialization failed, continuing without Redis:', error.message);
    }

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

    if (redisClient && redisClient.isOpen) {
      await redisClient.quit();
      logger.info('✅ Redis connection closed');
    }

    // InfluxDB客户端会自动关闭连接
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

function getInfluxDB() {
  if (!influxDB) {
    throw new Error('InfluxDB not initialized. Call connectDatabases() first.');
  }
  return influxDB;
}

function getRedisClient() {
  if (!redisClient) {
    throw new Error('Redis not initialized. Call connectDatabases() first.');
  }
  return redisClient;
}

/**
 * 数据库健康检查
 */
async function healthCheck() {
  const status = {
    postgres: 'unknown',
    influxdb: 'unknown',
    redis: 'unknown'
  };

  try {
    // PostgreSQL健康检查
    await sequelize.authenticate();
    status.postgres = 'healthy';
  } catch (error) {
    status.postgres = 'unhealthy';
    logger.error('PostgreSQL health check failed:', error.message);
  }

  try {
    // InfluxDB健康检查
    const health = await influxDB.health();
    status.influxdb = health.status === 'pass' ? 'healthy' : 'unhealthy';
  } catch (error) {
    status.influxdb = 'unhealthy';
    logger.error('InfluxDB health check failed:', error.message);
  }

  try {
    // Redis健康检查
    await redisClient.ping();
    status.redis = 'healthy';
  } catch (error) {
    status.redis = 'unhealthy';
    logger.error('Redis health check failed:', error.message);
  }

  return status;
}

module.exports = {
  initializePostgreSQL,
  connectDatabases,
  closeDatabases,
  getSequelize,
  getInfluxDB,
  getRedisClient,
  healthCheck
};
