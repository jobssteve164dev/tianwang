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
const RegistrationCode = require('./RegistrationCode');
const Alert = require('./Alert');
const AIResource = require('./AIResource');
const UserPermission = require('./UserPermission');
const UserSession = require('./UserSession');
const AuditLog = require('./AuditLog');
const Investigation = require('./Investigation');
const Finding = require('./Finding');
const ResponsePlan = require('./ResponsePlan');

// 延迟初始化模型
let sequelize = null;
let models = null;

function initializeModels() {
  if (!sequelize) {
    try {
      sequelize = getSequelize();
    } catch (error) {
      console.warn('⚠️ 数据库未初始化，模型暂时不可用:', error.message);
      return { sequelize: null, models: null };
    }
  }
  
  if (!models && sequelize) {
    try {
      console.log('🔄 开始初始化模型...');
      models = {
        User: User(sequelize),
        Organization: Organization(sequelize),
        Device: Device(sequelize),
        Agent: Agent(sequelize),
        ThreatRule: ThreatRule(sequelize),
        SecurityEvent: SecurityEvent(sequelize),
        AlertPolicy: AlertPolicy(sequelize),
        SystemConfig: SystemConfig(sequelize),
        RegistrationCode: RegistrationCode(sequelize),
        AIResource: AIResource(sequelize),
        UserPermission: UserPermission(sequelize),
        UserSession: UserSession(sequelize),
        AuditLog: AuditLog(sequelize),
        Investigation: Investigation(sequelize),
        Finding: Finding(sequelize),
        ResponsePlan: ResponsePlan(sequelize)
      };
      
      console.log('🔄 初始化Alert模型...');
      try {
        models.Alert = Alert(sequelize);
        console.log('✅ Alert模型初始化成功');
      } catch (alertError) {
        console.error('❌ Alert模型初始化失败:', alertError);
        throw alertError;
      }

      // 设置模型关联关系
      Object.keys(models).forEach(modelName => {
        if (models[modelName].associate) {
          models[modelName].associate(models);
        }
      });
    } catch (error) {
      console.error('❌ 模型初始化失败:', error.message);
      return { sequelize, models: null };
    }
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
  },
  get RegistrationCode() { 
    const result = initializeModels();
    return result.models ? result.models.RegistrationCode : null;
  },
  get Alert() { 
    const result = initializeModels();
    return result.models ? result.models.Alert : null;
  },
  get AIResource() { 
    const result = initializeModels();
    return result.models ? result.models.AIResource : null;
  },
  get UserPermission() { 
    const result = initializeModels();
    return result.models ? result.models.UserPermission : null;
  },
  get UserSession() { 
    const result = initializeModels();
    return result.models ? result.models.UserSession : null;
  },
  get AuditLog() { 
    const result = initializeModels();
    return result.models ? result.models.AuditLog : null;
  },
  get Investigation() {
    const result = initializeModels();
    return result.models ? result.models.Investigation : null;
  },
  get Finding() {
    const result = initializeModels();
    return result.models ? result.models.Finding : null;
  },
  get ResponsePlan() {
    const result = initializeModels();
    return result.models ? result.models.ResponsePlan : null;
  }
};
