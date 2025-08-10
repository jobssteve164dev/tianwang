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

// 延迟初始化模型
let sequelize = null;
let models = null;

function initializeModels() {
  if (!sequelize) {
    sequelize = getSequelize();
  }
  
  if (!models && sequelize) {
    models = {
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
  }
  
  return { sequelize, models };
}

// 导出模型和数据库实例
module.exports = {
  initializeModels,
  get sequelize() {
    const result = initializeModels();
    return result.sequelize;
  },
  get User() { 
    const result = initializeModels();
    return result.models ? result.models.User : null;
  },
  get Organization() { 
    const result = initializeModels();
    return result.models ? result.models.Organization : null;
  },
  get Device() { 
    const result = initializeModels();
    return result.models ? result.models.Device : null;
  },
  get Agent() { 
    const result = initializeModels();
    return result.models ? result.models.Agent : null;
  },
  get ThreatRule() { 
    const result = initializeModels();
    return result.models ? result.models.ThreatRule : null;
  },
  get SecurityEvent() { 
    const result = initializeModels();
    return result.models ? result.models.SecurityEvent : null;
  },
  get AlertPolicy() { 
    const result = initializeModels();
    return result.models ? result.models.AlertPolicy : null;
  },
  get SystemConfig() { 
    const result = initializeModels();
    return result.models ? result.models.SystemConfig : null;
  }
}; 