/**
 * 数据库初始化脚本
 * Database Initialization Script
 */

const { Client } = require('pg');
const config = require('../src/config');

async function createDatabase() {
  const client = new Client({
    host: config.database.postgres.host,
    port: config.database.postgres.port,
    user: config.database.postgres.username,
    password: config.database.postgres.password,
    database: 'postgres' // 连接到默认数据库
  });

  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL');

    // 检查数据库是否存在
    const result = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [config.database.postgres.database]
    );

    if (result.rows.length === 0) {
      // 创建数据库
      await client.query(`CREATE DATABASE "${config.database.postgres.database}"`);
      console.log(`✅ Database "${config.database.postgres.database}" created successfully`);
    } else {
      console.log(`✅ Database "${config.database.postgres.database}" already exists`);
    }

  } catch (error) {
    console.error('❌ Error creating database:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  createDatabase()
    .then(() => {
      console.log('✅ Database initialization completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Database initialization failed:', error);
      process.exit(1);
    });
}

module.exports = { createDatabase };
