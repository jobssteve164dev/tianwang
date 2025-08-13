const { Sequelize } = require('sequelize');
const config = require('./src/config/index');

async function resetRegistrationCode() {
  try {
    // 初始化数据库连接
    const sequelize = new Sequelize({
      database: config.database.postgres.database,
      username: config.database.postgres.username,
      password: config.database.postgres.password,
      host: config.database.postgres.host,
      port: config.database.postgres.port,
      dialect: 'postgres',
      logging: false
    });

    await sequelize.authenticate();
    console.log('✅ 数据库连接成功');

    // 定义RegistrationCode模型
    const RegistrationCode = sequelize.define('RegistrationCode', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      code: {
        type: Sequelize.STRING(50),
        allowNull: false,
        unique: true
      },
      used_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      max_uses: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1
      }
    }, {
      tableName: 'registration_codes',
      timestamps: true,
      underscored: true
    });

    // 查找并重置注册码
    const targetCode = 'TW-739884CF59B7ADA964AE7F845C1FF56D';
    const registrationCode = await RegistrationCode.findOne({
      where: { code: targetCode }
    });

    if (registrationCode) {
      // 重置使用次数并增加最大使用次数
      await registrationCode.update({
        used_count: 0,
        used_by: [],
        max_uses: 10
      });
      console.log(`✅ 注册码 ${targetCode} 使用次数已重置为0，最大使用次数设置为10`);
    } else {
      console.log(`❌ 未找到注册码 ${targetCode}`);
    }

    await sequelize.close();
    console.log('✅ 数据库连接已关闭');

  } catch (error) {
    console.error('❌ 重置注册码失败:', error.message);
    process.exit(1);
  }
}

resetRegistrationCode();
