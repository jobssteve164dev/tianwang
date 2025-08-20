/**
 * 运行数据库迁移
 * Run Database Migration
 */

const { connectDatabases } = require('../src/config/database');
const { Umzug } = require('umzug');
const { SequelizeStorage } = require('umzug/lib/storage/sequelize');
const path = require('path');
const logger = require('../src/utils/logger');

const runMigrations = async () => {
  try {
    logger.info('🚀 [DB Migration] Starting migration process...');
    
    // 首先连接数据库
    await connectDatabases();
    
    const { getSequelize } = require('../src/config/database');
    const sequelize = getSequelize();

    const migrationsPath = path.join(__dirname, '../src/database/migrations/*.js');
    logger.info(`🔍 [DB Migration] Looking for migrations in: ${migrationsPath}`);

    const umzug = new Umzug({
      migrations: {
        glob: migrationsPath,
        resolve: ({ name, path, context }) => {
          logger.info(`📋 [DB Migration] Resolving migration: ${name}`);
          const migration = require(path);
          return {
            name,
            up: async () => migration.up(context, sequelize.constructor),
            down: async () => migration.down(context, sequelize.constructor),
          };
        },
      },
      context: sequelize.getQueryInterface(),
      storage: new SequelizeStorage({ sequelize }),
      logger: console,
    });

    logger.info('🔍 [DB Migration] Checking for pending migrations...');
    const pendingMigrations = await umzug.pending();
    
    logger.info(`📊 [DB Migration] Found ${pendingMigrations.length} pending migrations`);
    
    if (pendingMigrations.length === 0) {
      logger.info('✅ [DB Migration] No pending migrations found. Database is up to date.');
      return;
    }

    logger.info(`⏳ [DB Migration] Found ${pendingMigrations.length} pending migrations. Applying...`);
    pendingMigrations.forEach(mig => logger.info(`  -> ${mig.name}`));

    await umzug.up();

    logger.info('✅ [DB Migration] All pending migrations have been applied successfully.');

  } catch (error) {
    logger.error('❌ [DB Migration] Migration failed:', error);
    process.exit(1);
  }
};

runMigrations();
