const crypto = require('crypto');
const logger = require('../utils/logger');
const models = require('../models');
const { Op } = require('sequelize');

class RegistrationCodeService {
  constructor() {
    this.defaultExpiry = 24 * 60 * 60 * 1000; // 24小时默认过期时间
    this.maxUses = 1; // 默认每个注册码只能使用一次
  }

  // 生成注册码
  async generateRegistrationCode(options = {}) {
    try {
      const {
        prefix = 'TW',
        length = 16,
        expiry = this.defaultExpiry,
        maxUses = this.maxUses,
        permissions = ['basic'],
        description = '',
        createdBy = 'system'
      } = options;

      // 生成随机部分
      const randomPart = crypto.randomBytes(length).toString('hex').toUpperCase();
      
      // 生成时间戳
      const timestamp = Date.now();
      
      // 组合注册码
      const code = `${prefix}-${randomPart}`;
      
      // 生成签名
      const signature = this.generateCodeSignature(code, timestamp);
      
      // 创建注册码对象
      const registrationCode = {
        code,
        signature,
        timestamp,
        expiry: timestamp + expiry,
        maxUses,
        usedCount: 0,
        permissions,
        description,
        createdBy,
        isActive: true,
        used_by: [],
        createdAt: new Date()
      };

      // 保存到数据库
      const savedCode = await this.saveToDatabase(registrationCode);

      logger.info('注册码生成成功:', { 
        code, 
        expiry: new Date(registrationCode.expiry),
        permissions 
      });

      return savedCode;
    } catch (error) {
      logger.error('生成注册码失败:', error);
      throw error;
    }
  }

  // 生成注册码签名
  generateCodeSignature(code, timestamp) {
    try {
      const data = `${code}:${timestamp}`;
      const hash = crypto.createHash('sha256');
      hash.update(data);
      return hash.digest('hex');
    } catch (error) {
      logger.error('生成注册码签名失败:', error);
      throw error;
    }
  }

  // 验证注册码签名
  verifyCodeSignature(code, timestamp, signature) {
    try {
      const expectedSignature = this.generateCodeSignature(code, timestamp);
      return signature === expectedSignature;
    } catch (error) {
      logger.error('验证注册码签名失败:', error);
      return false;
    }
  }

  // 保存注册码到数据库
  async saveToDatabase(registrationCode) {
    try {
      if (!models.RegistrationCode) {
        logger.warn('数据库未初始化，注册码将保存到内存缓存');
        // 如果数据库不可用，暂时保存到内存缓存
        this.memoryCache = this.memoryCache || new Map();
        this.memoryCache.set(registrationCode.code, {
          ...registrationCode,
          id: Date.now(),
          created_at: new Date(),
          updated_at: new Date()
        });
        return this.memoryCache.get(registrationCode.code);
      }

      const savedCode = await models.RegistrationCode.create({
        code: registrationCode.code,
        signature: registrationCode.signature,
        timestamp: registrationCode.timestamp,
        expiry: registrationCode.expiry,
        max_uses: registrationCode.max_uses || registrationCode.maxUses,
        used_count: registrationCode.used_count || registrationCode.usedCount || 0,
        permissions: registrationCode.permissions,
        description: registrationCode.description,
        created_by: registrationCode.created_by || registrationCode.createdBy,
        is_active: registrationCode.is_active !== undefined ? registrationCode.is_active : (registrationCode.isActive !== undefined ? registrationCode.isActive : true),
        used_by: registrationCode.used_by || []
      });

      return {
        ...registrationCode,
        id: savedCode.id,
        created_at: savedCode.created_at,
        updated_at: savedCode.updated_at
      };
    } catch (error) {
      logger.error('保存注册码到数据库失败:', error);
      throw error;
    }
  }

  // 验证注册码
  async validateRegistrationCode(code, deviceInfo = {}) {
    try {
      let registrationCode = null;

      // 首先尝试从数据库获取注册码
      if (models.RegistrationCode) {
        try {
          registrationCode = await models.RegistrationCode.findOne({
            where: { code }
          });
        } catch (dbError) {
          logger.warn('数据库查询失败，尝试从内存缓存获取:', dbError.message);
        }
      }

      // 如果数据库不可用或查询失败，尝试从内存缓存获取
      if (!registrationCode && this.memoryCache) {
        registrationCode = this.memoryCache.get(code);
        if (registrationCode) {
          logger.info('从内存缓存获取注册码');
        }
      }
      
      if (!registrationCode) {
        logger.warn('注册码不存在');
        return {
          isValid: false,
          error: '注册码不存在',
          code: 'CODE_NOT_FOUND'
        };
      }

      // 检查是否过期
      if (Date.now() > registrationCode.expiry) {
        logger.warn('注册码已过期');
        return {
          isValid: false,
          error: '注册码已过期',
          code: 'CODE_EXPIRED'
        };
      }

      // 检查是否已停用
      if (!registrationCode.is_active) {
        logger.warn('注册码已停用');
        return {
          isValid: false,
          error: '注册码已停用',
          code: 'CODE_DISABLED'
        };
      }

      // 检查设备指纹（如果设备信息提供）
      if (deviceInfo.fingerprint) {
        const fingerprintValidation = await this.validateDeviceFingerprint(code, deviceInfo.fingerprint);
        if (!fingerprintValidation.isValid) {
          return fingerprintValidation;
        }
        
        // 如果是同一设备重复使用，允许通过
        if (fingerprintValidation.isReuse) {
          logger.info('同一设备重复使用注册码，允许通过:', { 
            reused: true
          });
          return {
            isValid: true,
            permissions: registrationCode.permissions,
            description: registrationCode.description,
            expiry: registrationCode.expiry,
            remainingUses: registrationCode.max_uses - registrationCode.used_count,
            isReuse: true
          };
        }
      }

      // 检查使用次数限制（仅对新设备）
      if (registrationCode.used_count >= registrationCode.max_uses) {
        logger.warn('注册码使用次数已达上限');
        return {
          isValid: false,
          error: '注册码使用次数已达上限',
          code: 'CODE_USAGE_LIMIT_EXCEEDED'
        };
      }

      // 验证签名
      if (!this.verifyCodeSignature(registrationCode.code, registrationCode.timestamp, registrationCode.signature)) {
        logger.warn('注册码签名验证失败');
        return {
          isValid: false,
          error: '注册码签名验证失败',
          code: 'CODE_SIGNATURE_INVALID'
        };
      }



      logger.info('注册码验证成功:', { permissions: registrationCode.permissions });

      return {
        isValid: true,
        permissions: registrationCode.permissions,
        description: registrationCode.description,
        expiry: registrationCode.expiry,
        remainingUses: registrationCode.max_uses - registrationCode.used_count
      };
    } catch (error) {
      logger.error('验证注册码失败:', error);
      return {
        isValid: false,
        error: '验证注册码时发生错误',
        code: 'VALIDATION_ERROR'
      };
    }
  }

  // 增加注册码使用次数
  async incrementCodeUsage(code, agent_id, device_fingerprint) {
    try {
      if (!models.RegistrationCode) {
        throw new Error('RegistrationCode model not available');
      }

      const registrationCode = await models.RegistrationCode.findOne({
        where: { code }
      });
      
      if (!registrationCode) {
        logger.warn('注册码不存在，无法增加使用次数');
        return false;
      }

      await registrationCode.incrementUsage(agent_id, device_fingerprint);

      logger.info('注册码使用次数已增加:', { usedCount: registrationCode.used_count });
      return true;
    } catch (error) {
      logger.error('增加注册码使用次数失败:', error);
      return false;
    }
  }

  // 验证设备指纹
  async validateDeviceFingerprint(code, fingerprint) {
    try {
      if (!models.RegistrationCode) {
        throw new Error('RegistrationCode model not available');
      }

      const registrationCode = await models.RegistrationCode.findOne({
        where: { code }
      });
      
      if (!registrationCode) {
        return {
          isValid: false,
          error: '注册码不存在',
          code: 'CODE_NOT_FOUND'
        };
      }

      // 检查是否已被其他设备使用
      const usedBy = registrationCode.used_by || [];
      const existingDevice = usedBy.find(device => device.fingerprint === fingerprint);
      
      if (existingDevice) {
        // 同一设备重复使用
        return {
          isValid: true,
          permissions: registrationCode.permissions,
          isReuse: true
        };
      }

      // 检查是否已被其他设备使用（如果限制单设备使用）
      if (registrationCode.max_uses === 1 && usedBy.length > 0) {
        return {
          isValid: false,
          error: '注册码已被其他设备使用',
          code: 'CODE_ALREADY_USED'
        };
      }

      return {
        isValid: true,
        permissions: registrationCode.permissions,
        isReuse: false
      };
    } catch (error) {
      logger.error('验证设备指纹失败:', error);
      return {
        isValid: false,
        error: '验证设备指纹时发生错误',
        code: 'FINGERPRINT_VALIDATION_ERROR'
      };
    }
  }

  // 使用注册码
  async useRegistrationCode(code, deviceInfo) {
    try {
      if (!models.RegistrationCode) {
        throw new Error('RegistrationCode model not available');
      }

      const registrationCode = await models.RegistrationCode.findOne({
        where: { code }
      });
      
      if (!registrationCode) {
        return {
          success: false,
          error: '注册码不存在',
          code: 'CODE_NOT_FOUND'
        };
      }

      // 验证注册码
      const validation = await this.validateRegistrationCode(code, deviceInfo);
      if (!validation.isValid) {
        return validation;
      }

      // 更新使用信息
      await registrationCode.incrementUsage(deviceInfo.agent_id, deviceInfo.fingerprint);

      logger.info('注册码使用成功:', { 
        code, 
        agent_id: deviceInfo.agent_id,
        remainingUses: registrationCode.getRemainingUses()
      });

      return {
        success: true,
        permissions: registrationCode.permissions,
        remainingUses: registrationCode.getRemainingUses(),
        expiry: registrationCode.expiry
      };
    } catch (error) {
      logger.error('使用注册码失败:', error);
      return {
        success: false,
        error: '使用注册码时发生错误',
        code: 'USAGE_ERROR'
      };
    }
  }

  // 批量生成注册码
  async generateBatchRegistrationCodes(count, options = {}) {
    try {
      const codes = [];
      
      for (let i = 0; i < count; i++) {
        const code = await this.generateRegistrationCode(options);
        codes.push(code);
      }

      logger.info('批量生成注册码完成:', { count });

      return codes;
    } catch (error) {
      logger.error('批量生成注册码失败:', error);
      throw error;
    }
  }

  // 停用注册码
  async disableRegistrationCode(code) {
    try {
      if (!models.RegistrationCode) {
        throw new Error('RegistrationCode model not available');
      }

      const registrationCode = await models.RegistrationCode.findOne({
        where: { code }
      });
      
      if (!registrationCode) {
        return {
          success: false,
          error: '注册码不存在',
          code: 'CODE_NOT_FOUND'
        };
      }

      await registrationCode.disable();

      logger.info('注册码已停用');

      return {
        success: true,
        message: '注册码已停用'
      };
    } catch (error) {
      logger.error('停用注册码失败:', error);
      return {
        success: false,
        error: '停用注册码时发生错误',
        code: 'DISABLE_ERROR'
      };
    }
  }

  // 延长注册码有效期
  async extendRegistrationCode(code, additionalExpiry) {
    try {
      if (!models.RegistrationCode) {
        throw new Error('RegistrationCode model not available');
      }

      const registrationCode = await models.RegistrationCode.findOne({
        where: { code }
      });
      
      if (!registrationCode) {
        return {
          success: false,
          error: '注册码不存在',
          code: 'CODE_NOT_FOUND'
        };
      }

      await registrationCode.extendExpiry(additionalExpiry);

      logger.info('注册码有效期已延长:', { 
        code, 
        newExpiry: new Date(registrationCode.expiry) 
      });

      return {
        success: true,
        newExpiry: registrationCode.expiry
      };
    } catch (error) {
      logger.error('延长注册码有效期失败:', error);
      return {
        success: false,
        error: '延长注册码有效期时发生错误',
        code: 'EXTEND_ERROR'
      };
    }
  }

  // 获取注册码统计信息
  async getRegistrationCodeStats() {
    try {
      if (!models.RegistrationCode) {
        throw new Error('RegistrationCode model not available');
      }

      return await models.RegistrationCode.getStats();
    } catch (error) {
      logger.error('获取注册码统计信息失败:', error);
      return null;
    }
  }

  // 获取注册码列表
  async getRegistrationCodes(filters = {}) {
    try {
      if (!models.RegistrationCode) {
        throw new Error('RegistrationCode model not available');
      }

      const {
        status = 'all', // all, active, expired, disabled
        createdBy = null,
        limit = 100
      } = filters;

      const whereClause = {};
      const now = Date.now();

      // 状态过滤
      if (status !== 'all') {
        if (status === 'active') {
          whereClause.is_active = true;
          whereClause.expiry = { [Op.gt]: now };
        } else if (status === 'expired') {
          whereClause.expiry = { [Op.lte]: now };
        } else if (status === 'disabled') {
          whereClause.is_active = false;
        }
      }

      // 创建者过滤
      if (createdBy) {
        whereClause.created_by = createdBy;
      }

      const codes = await models.RegistrationCode.findAll({
        where: whereClause,
        order: [['created_at', 'DESC']],
        limit: parseInt(limit)
      });

      return codes.map(code => ({
        code: code.code,
        status: this.getCodeStatus(code, now),
        permissions: code.permissions,
        description: code.description,
        createdBy: code.created_by,
        createdAt: code.created_at.toISOString(), // 转换为ISO字符串
        expiry: Number(code.expiry), // 确保为数字类型
        usedCount: code.used_count,
        maxUses: code.max_uses,
        remainingUses: code.getRemainingUses()
      }));
    } catch (error) {
      logger.error('获取注册码列表失败:', error);
      return [];
    }
  }

  // 获取注册码状态
  getCodeStatus(registrationCode, now = Date.now()) {
    if (!registrationCode.is_active) {
      return 'disabled';
    }
    if (now > registrationCode.expiry) {
      return 'expired';
    }
    if (registrationCode.used_count >= registrationCode.max_uses) {
      return 'exhausted';
    }
    return 'active';
  }

  // 清理过期注册码
  async cleanupExpiredCodes() {
    try {
      if (!models.RegistrationCode) {
        throw new Error('RegistrationCode model not available');
      }

      const result = await models.RegistrationCode.cleanupExpired();
      const cleanedCount = result[0]?.count || 0;

      logger.info('清理过期注册码完成:', { cleanedCount });
      return cleanedCount;
    } catch (error) {
      logger.error('清理过期注册码失败:', error);
      return 0;
    }
  }

  // 获取服务状态
  async getStatus() {
    try {
      const codeStats = await this.getRegistrationCodeStats();
      return {
        initialized: true,
        databaseConnected: !!models.RegistrationCode,
        codeStats: codeStats,
        timestamp: Date.now()
      };
    } catch (error) {
      logger.error('获取服务状态失败:', error);
      return {
        initialized: false,
        databaseConnected: false,
        error: error.message,
        timestamp: Date.now()
      };
    }
  }
}

module.exports = new RegistrationCodeService();
