const { Sequelize } = require('sequelize');
const config = require('./src/config');

async function debugRegistrationCodes() {
  const sequelize = new Sequelize({
    database: config.database.postgres.database,
    username: config.database.postgres.username,
    password: config.database.postgres.password,
    host: config.database.postgres.host,
    port: config.database.postgres.port,
    dialect: 'postgres',
    logging: false
  });

  try {
    await sequelize.authenticate();
    console.log('✅ Connected to database');

    // 查询注册码数据
    const [results] = await sequelize.query(`
      SELECT 
        code,
        timestamp,
        expiry,
        created_at,
        updated_at,
        used_count,
        max_uses,
        is_active
      FROM registration_codes 
      ORDER BY created_at DESC 
      LIMIT 10
    `);

    console.log('\n📊 Registration Codes Data:');
    console.log('='.repeat(100));
    
    results.forEach((row, index) => {
      console.log(`\n${index + 1}. Code: ${row.code}`);
      console.log(`   Timestamp: ${row.timestamp} (${new Date(row.timestamp)})`);
      console.log(`   Expiry: ${row.expiry} (${new Date(row.expiry)})`);
      console.log(`   Created: ${row.created_at}`);
      console.log(`   Updated: ${row.updated_at}`);
      console.log(`   Used: ${row.used_count}/${row.max_uses}`);
      console.log(`   Active: ${row.is_active}`);
      
      // 计算时间差
      const now = Date.now();
      const expiryDiff = row.expiry - now;
      const createdDiff = now - row.timestamp;
      
      console.log(`   Expiry from now: ${Math.floor(expiryDiff / (1000 * 60 * 60 * 24))} days`);
      console.log(`   Created from now: ${Math.floor(createdDiff / (1000 * 60 * 60 * 24))} days`);
    });

    // 检查是否有异常的expiry值
    const [anomalies] = await sequelize.query(`
      SELECT 
        code,
        timestamp,
        expiry,
        created_at
      FROM registration_codes 
      WHERE expiry < timestamp
      ORDER BY created_at DESC
    `);

    if (anomalies.length > 0) {
      console.log('\n🚨 ANOMALIES FOUND - Expiry before timestamp:');
      console.log('='.repeat(100));
      anomalies.forEach((row, index) => {
        console.log(`\n${index + 1}. Code: ${row.code}`);
        console.log(`   Timestamp: ${row.timestamp} (${new Date(row.timestamp)})`);
        console.log(`   Expiry: ${row.expiry} (${new Date(row.expiry)})`);
        console.log(`   Created: ${row.created_at}`);
        console.log(`   Difference: ${row.expiry - row.timestamp} ms`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await sequelize.close();
  }
}

debugRegistrationCodes();
