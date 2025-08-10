const crypto = require('crypto');
const logger = require('../utils/logger');

class RegistrationCodeService {
  constructor() {
    this.codeCache = new Map();
    this.cacheExpiry = 60 * 60 * 1000; // 1小时缓存
    this.defaultExpiry = 24 * 60 * 60 * 1000; // 24小时默认过期时间
    this.maxUses = 1; // 默认每个注册码只能使用一次
  }

  // 生成注册码
  generateRegistrationCode(options = {}) {
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
        usedBy: [],
        createdAt: new Date()
      };

      // 缓存注册码
      this.cacheCode(registrationCode);

      logger.info('注册码生成成功:', { 
        code, 
        expiry: new Date(registrationCode.expiry),
        permissions 
      });

      return registrationCode;
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

  // 缓存注册码
  cacheCode(registrationCode) {
    this.codeCache.set(registrationCode.code, {
      ...registrationCode,
      cacheTimestamp: Date.now()
    });

    // 清理过期缓存
    this.cleanupExpiredCache();
  }

  // 清理过期缓存
  cleanupExpiredCache() {
    const now = Date.now();
    for (const [code, data] of this.codeCache.entries()) {
      if (now > data.expiry || now - data.cacheTimestamp > this.cacheExpiry) {
        this.codeCache.delete(code);
      }
    }
  }

  // 验证注册码
  async validateRegistrationCode(code, deviceInfo = {}) {
    try {
      // 从缓存获取注册码
      const registrationCode = this.codeCache.get(code);
      
      if (!registrationCode) {
        logger.warn('注册码不存在:', code);
        return {
          isValid: false,
          error: '注册码不存在',
          code: 'CODE_NOT_FOUND'
        };
      }

      // 检查是否过期
      if (Date.now() > registrationCode.expiry) {
        logger.warn('注册码已过期:', code);
        return {
          isValid: false,
          error: '注册码已过期',
          code: 'CODE_EXPIRED'
        };
      }

      // 检查是否已停用
      if (!registrationCode.isActive) {
        logger.warn('注册码已停用:', code);
        return {
          isValid: false,
          error: '注册码已停用',
          code: 'CODE_DISABLED'
        };
      }

      // 检查使用次数限制
      if (registrationCode.usedCount >= registrationCode.maxUses) {
        logger.warn('注册码使用次数已达上限:', code);
        return {
          isValid: false,
          error: '注册码使用次数已达上限',
          code: 'CODE_USAGE_LIMIT_EXCEEDED'
        };
      }

      // 验证签名
      if (!this.verifyCodeSignature(registrationCode.code, registrationCode.timestamp, registrationCode.signature)) {
        logger.warn('注册码签名验证失败:', code);
        return {
          isValid: false,
          error: '注册码签名验证失败',
          code: 'CODE_SIGNATURE_INVALID'
        };
      }

      // 检查设备指纹（如果设备信息提供）
      if (deviceInfo.fingerprint) {
        const fingerprintValidation = await this.validateDeviceFingerprint(code, deviceInfo.fingerprint);
        if (!fingerprintValidation.isValid) {
          return fingerprintValidation;
        }
      }

      logger.info('注册码验证成功:', { code, permissions: registrationCode.permissions });

      return {
        isValid: true,
        permissions: registrationCode.permissions,
        description: registrationCode.description,
        expiry: registrationCode.expiry,
        remainingUses: registrationCode.maxUses - registrationCode.usedCount
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

  // 验证设备指纹
  async validateDeviceFingerprint(code, fingerprint) {
    try {
      const registrationCode = this.codeCache.get(code);
      
      if (!registrationCode) {
        return {
          isValid: false,
          error: '注册码不存在',
          code: 'CODE_NOT_FOUND'
        };
      }

      // 检查是否已被其他设备使用
      const existingDevice = registrationCode.usedBy.find(device => device.fingerprint === fingerprint);
      
      if (existingDevice) {
        // 同一设备重复使用
        return {
          isValid: true,
          permissions: registrationCode.permissions,
          isReuse: true
        };
      }

      // 检查是否已被其他设备使用（如果限制单设备使用）
      if (registrationCode.maxUses === 1 && registrationCode.usedBy.length > 0) {
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
      const registrationCode = this.codeCache.get(code);
      
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
      registrationCode.usedCount++;
      registrationCode.usedBy.push({
        agentId: deviceInfo.agentId,
        hostname: deviceInfo.hostname,
        fingerprint: deviceInfo.fingerprint,
        platform: deviceInfo.platform,
        usedAt: new Date()
      });

      // 更新缓存
      this.cacheCode(registrationCode);

      logger.info('注册码使用成功:', { 
        code, 
        agentId: deviceInfo.agentId,
        remainingUses: registrationCode.maxUses - registrationCode.usedCount 
      });

      return {
        success: true,
        permissions: registrationCode.permissions,
        remainingUses: registrationCode.maxUses - registrationCode.usedCount,
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
  generateBatchRegistrationCodes(count, options = {}) {
    try {
      const codes = [];
      
      for (let i = 0; i < count; i++) {
        const code = this.generateRegistrationCode(options);
        codes.push(code);
      }

      logger.info('批量生成注册码完成:', { count, codes: codes.map(c => c.code) });

      return codes;
    } catch (error) {
      logger.error('批量生成注册码失败:', error);
      throw error;
    }
  }

  // 停用注册码
  disableRegistrationCode(code) {
    try {
      const registrationCode = this.codeCache.get(code);
      
      if (!registrationCode) {
        return {
          success: false,
          error: '注册码不存在',
          code: 'CODE_NOT_FOUND'
        };
      }

      registrationCode.isActive = false;
      this.cacheCode(registrationCode);

      logger.info('注册码已停用:', code);

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
  extendRegistrationCode(code, additionalExpiry) {
    try {
      const registrationCode = this.codeCache.get(code);
      
      if (!registrationCode) {
        return {
          success: false,
          error: '注册码不存在',
          code: 'CODE_NOT_FOUND'
        };
      }

      registrationCode.expiry += additionalExpiry;
      this.cacheCode(registrationCode);

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
  getRegistrationCodeStats() {
    try {
      const stats = {
        total: 0,
        active: 0,
        expired: 0,
        disabled: 0,
        used: 0,
        unused: 0
      };

      const now = Date.now();

      for (const [code, data] of this.codeCache.entries()) {
        stats.total++;
        
        if (!data.isActive) {
          stats.disabled++;
        } else if (now > data.expiry) {
          stats.expired++;
        } else {
          stats.active++;
        }

        if (data.usedCount > 0) {
          stats.used++;
        } else {
          stats.unused++;
        }
      }

      return stats;
    } catch (error) {
      logger.error('获取注册码统计信息失败:', error);
      return null;
    }
  }

  // 获取注册码列表
  getRegistrationCodes(filters = {}) {
    try {
      const {
        status = 'all', // all, active, expired, disabled
        createdBy = null,
        limit = 100
      } = filters;

      const codes = [];
      const now = Date.now();

      for (const [code, data] of this.codeCache.entries()) {
        // 状态过滤
        if (status !== 'all') {
          if (status === 'active' && (!data.isActive || now > data.expiry)) continue;
          if (status === 'expired' && now <= data.expiry) continue;
          if (status === 'disabled' && data.isActive) continue;
        }

        // 创建者过滤
        if (createdBy && data.createdBy !== createdBy) continue;

        codes.push({
          code: data.code,
          status: this.getCodeStatus(data, now),
          permissions: data.permissions,
          description: data.description,
          createdBy: data.createdBy,
          createdAt: data.createdAt,
          expiry: data.expiry,
          usedCount: data.usedCount,
          maxUses: data.maxUses,
          remainingUses: data.maxUses - data.usedCount
        });
      }

      // 按创建时间排序
      codes.sort((a, b) => b.createdAt - a.createdAt);

      return codes.slice(0, limit);
    } catch (error) {
      logger.error('获取注册码列表失败:', error);
      return [];
    }
  }

  // 获取注册码状态
  getCodeStatus(registrationCode, now = Date.now()) {
    if (!registrationCode.isActive) {
      return 'disabled';
    }
    if (now > registrationCode.expiry) {
      return 'expired';
    }
    if (registrationCode.usedCount >= registrationCode.maxUses) {
      return 'exhausted';
    }
    return 'active';
  }

  // 清理过期注册码
  cleanupExpiredCodes() {
    try {
      const now = Date.now();
      let cleanedCount = 0;

      for (const [code, data] of this.codeCache.entries()) {
        if (now > data.expiry) {
          this.codeCache.delete(code);
          cleanedCount++;
        }
      }

      logger.info('清理过期注册码完成:', { cleanedCount });
      return cleanedCount;
    } catch (error) {
      logger.error('清理过期注册码失败:', error);
      return 0;
    }
  }

  // 获取服务状态
  getStatus() {
    return {
      initialized: true,
      cacheStats: {
        size: this.codeCache.size,
        expiry: this.cacheExpiry
      },
      codeStats: this.getRegistrationCodeStats(),
      timestamp: Date.now()
    };
  }
}

module.exports = new RegistrationCodeService();
