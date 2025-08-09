/**
 * 数据库模型入口文件
 * Database Models Entry Point
 */

const { getSequelize } = require('../config/database');

// 导入所有模型
const User = require('./User');
const Organization = require('./Organization');
const Device = require('./Device');
const Agent = require('./Agent');
const ThreatRule = require('./ThreatRule');
const SecurityEvent = require('./SecurityEvent');
const AlertPolicy = require('./AlertPolicy');
const SystemConfig = require('./SystemConfig');

// 获取数据库实例
const sequelize = getSequelize();

// 初始化所有模型
const models = {
  User: User(sequelize),
  Organization: Organization(sequelize),
  Device: Device(sequelize),
  Agent: Agent(sequelize),
  ThreatRule: ThreatRule(sequelize),
  SecurityEvent: SecurityEvent(sequelize),
  AlertPolicy: AlertPolicy(sequelize),
  SystemConfig: SystemConfig(sequelize)
};

// 设置模型关联关系
Object.keys(models).forEach(modelName => {
  if (models[modelName].associate) {
    models[modelName].associate(models);
  }
});

// 导出模型和数据库实例
module.exports = {
  sequelize,
  ...models
}; 