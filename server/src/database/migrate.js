const { getSequelize } = require('../config/database');
const { Umzug, SequelizeStorage } = require('umzug');
const path = require('path');
const logger = require('../utils/logger');

const runMigrations = async () => {
  let sequelize;
  try {
    logger.info('🚀 [DB Migration] Starting migration process...');
    sequelize = getSequelize();

    const umzug = new Umzug({
      migrations: {
        glob: path.join(__dirname, '../../migrations/*.js'),
        resolve: ({ name, path, context }) => {
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
  } finally {
    if (sequelize) {
      await sequelize.close();
      logger.info('🚪 [DB Migration] Database connection closed.');
    }
  }
};

runMigrations();

