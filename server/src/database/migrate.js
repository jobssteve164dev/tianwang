const { initializePostgreSQL } = require('../config/database');
const { Umzug, SequelizeStorage } = require('umzug');
const path = require('path');
const logger = require('../utils/logger');
const models = require('../models');

const runMigrations = async () => {
  let sequelize;
  try {
    logger.info('🚀 [DB Migration] Starting migration process...');
    sequelize = initializePostgreSQL();

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
      logger.info('✅ [DB Migration] No pending migrations found.');
    } else {
      logger.info(`⏳ [DB Migration] Found ${pendingMigrations.length} pending migrations. Applying...`);
      pendingMigrations.forEach(mig => logger.info(`  -> ${mig.name}`));
      await umzug.up();
      logger.info('✅ [DB Migration] All pending migrations have been applied successfully.');
    }

    const initialized = models.initializeModels();
    if (!initialized.models) {
      throw new Error('Database models failed to initialize after migrations');
    }
    await sequelize.sync();
    logger.info('✅ [DB Migration] Model schema synchronization completed.');

  } catch (error) {
    logger.error('❌ [DB Migration] Migration failed:', error);
    throw error;
  } finally {
    if (sequelize) {
      await sequelize.close();
      logger.info('🚪 [DB Migration] Database connection closed.');
    }
  }
};

if (require.main === module) {
  runMigrations().catch(() => {
    process.exitCode = 1;
  });
}

module.exports = { runMigrations };
