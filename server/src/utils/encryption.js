/**
 * 数据加密工具
 * Encryption Utilities - 敏感数据加密
 */

const crypto = require('crypto');
const logger = require('./logger');

class EncryptionService {
  constructor() {
    this.algorithm = 'aes-256-gcm';
    this.keyLength = 32; // 256位
    this.ivLength = 16; // 128位
    this.tagLength = 16; // 128位
    this.secretKey = process.env.ENCRYPTION_KEY || process.env.CRYPTO_SECRET_KEY;
    if (!this.secretKey && process.env.NODE_ENV === 'production') {
      throw new Error('ENCRYPTION_KEY is required in production');
    }
    this.secretKey = this.secretKey || 'tianwang-local-development-encryption-key';
    this.key = crypto.createHash('sha256').update(this.secretKey).digest();
  }

  /**
   * 生成加密密钥
   */
  generateKey() {
    return crypto.randomBytes(this.keyLength).toString('hex');
  }

  /**
   * 生成随机IV
   */
  generateIV() {
    return crypto.randomBytes(this.ivLength);
  }

  /**
   * 加密数据
   * @param {string} data 要加密的数据
   * @returns {Object} 加密结果 { encrypted, iv, tag }
   */
  encrypt(data) {
    try {
      if (!data) return null;

      const iv = this.generateIV();
      const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
      cipher.setAAD(Buffer.from('tianwang-security', 'utf8'));

      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const tag = cipher.getAuthTag();

      return {
        encrypted,
        iv: iv.toString('hex'),
        tag: tag.toString('hex')
      };
    } catch (error) {
      logger.error('数据加密失败:', error);
      throw new Error('数据加密失败');
    }
  }

  /**
   * 解密数据
   * @param {Object} encryptedData 加密数据 { encrypted, iv, tag }
   * @returns {string} 解密后的数据
   */
  decrypt(encryptedData) {
    try {
      if (!encryptedData || !encryptedData.encrypted) return null;

      const { encrypted, iv, tag } = encryptedData;
      
      const decipher = crypto.createDecipheriv(this.algorithm, this.key, Buffer.from(iv, 'hex'));
      decipher.setAAD(Buffer.from('tianwang-security', 'utf8'));
      decipher.setAuthTag(Buffer.from(tag, 'hex'));

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      logger.error('数据解密失败:', error);
      throw new Error('数据解密失败');
    }
  }

  /**
   * 加密对象
   * @param {Object} obj 要加密的对象
   * @returns {Object} 加密后的对象
   */
  encryptObject(obj) {
    if (!obj || typeof obj !== 'object') return obj;

    const encrypted = {};
    for (const [key, value] of Object.entries(obj)) {
      if (this.shouldEncrypt(key, value)) {
        encrypted[key] = this.encrypt(JSON.stringify(value));
      } else if (typeof value === 'object' && value !== null) {
        encrypted[key] = this.encryptObject(value);
      } else {
        encrypted[key] = value;
      }
    }
    return encrypted;
  }

  /**
   * 解密对象
   * @param {Object} obj 要解密的对象
   * @returns {Object} 解密后的对象
   */
  decryptObject(obj) {
    if (!obj || typeof obj !== 'object') return obj;

    const decrypted = {};
    for (const [key, value] of Object.entries(obj)) {
      if (this.isEncrypted(value)) {
        try {
          const decryptedValue = this.decrypt(value);
          decrypted[key] = JSON.parse(decryptedValue);
        } catch (error) {
          logger.warn(`解密字段失败: ${key}`, error);
          decrypted[key] = value; // 保持原值
        }
      } else if (typeof value === 'object' && value !== null) {
        decrypted[key] = this.decryptObject(value);
      } else {
        decrypted[key] = value;
      }
    }
    return decrypted;
  }

  /**
   * 判断是否应该加密
   * @param {string} key 字段名
   * @param {any} value 字段值
   * @returns {boolean}
   */
  shouldEncrypt(key, value) {
    const sensitiveFields = [
      'password', 'token', 'secret', 'key', 'credential',
      'api_key', 'private_key', 'access_token', 'refresh_token',
      'ssn', 'credit_card', 'phone', 'email', 'address'
    ];

    const sensitivePatterns = [
      /password/i, /token/i, /secret/i, /key/i, /credential/i,
      /api_key/i, /private_key/i, /access_token/i, /refresh_token/i,
      /ssn/i, /credit_card/i, /phone/i, /email/i, /address/i
    ];

    // 检查字段名
    if (sensitiveFields.includes(key.toLowerCase())) {
      return true;
    }

    // 检查字段名模式
    if (sensitivePatterns.some(pattern => pattern.test(key))) {
      return true;
    }

    // 检查值类型和内容
    if (typeof value === 'string' && value.length > 0) {
      // 检查是否包含敏感信息模式
      const sensitiveValuePatterns = [
        /^\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}$/, // 信用卡号
        /^\d{3}-\d{2}-\d{4}$/, // SSN
        /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, // 邮箱
        /^\+?[\d\s\-()]{10,}$/, // 电话号码
        /^[a-fA-F0-9]{32,}$/ // 哈希值
      ];

      if (sensitiveValuePatterns.some(pattern => pattern.test(value))) {
        return true;
      }
    }

    return false;
  }

  /**
   * 判断是否为加密数据
   * @param {any} value 值
   * @returns {boolean}
   */
  isEncrypted(value) {
    return value && 
           typeof value === 'object' && 
           value.encrypted && 
           value.iv && 
           value.tag;
  }

  /**
   * 生成安全的哈希值
   * @param {string} data 要哈希的数据
   * @param {string} salt 盐值
   * @returns {string} 哈希值
   */
  hash(data, salt = null) {
    try {
      const useSalt = salt || crypto.randomBytes(16).toString('hex');
      const hash = crypto.pbkdf2Sync(data, useSalt, 10000, 64, 'sha512');
      return {
        hash: hash.toString('hex'),
        salt: useSalt
      };
    } catch (error) {
      logger.error('哈希生成失败:', error);
      throw new Error('哈希生成失败');
    }
  }

  /**
   * 验证哈希值
   * @param {string} data 原始数据
   * @param {string} hash 哈希值
   * @param {string} salt 盐值
   * @returns {boolean} 是否匹配
   */
  verifyHash(data, hash, salt) {
    try {
      const computedHash = crypto.pbkdf2Sync(data, salt, 10000, 64, 'sha512');
      return crypto.timingSafeEqual(
        Buffer.from(hash, 'hex'),
        computedHash
      );
    } catch (error) {
      logger.error('哈希验证失败:', error);
      return false;
    }
  }

  /**
   * 生成随机令牌
   * @param {number} length 令牌长度
   * @returns {string} 随机令牌
   */
  generateToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * 生成API密钥
   * @returns {string} API密钥
   */
  generateAPIKey() {
    const prefix = 'tk_'; // tianwang key prefix
    const random = crypto.randomBytes(24).toString('base64url');
    return `${prefix}${random}`;
  }

  /**
   * 加密数据库字段（用于Sequelize hooks）
   * @param {Object} instance 模型实例
   * @param {Array} fields 需要加密的字段
   */
  encryptFields(instance, fields) {
    for (const field of fields) {
      if (instance.dataValues[field] && !this.isEncrypted(instance.dataValues[field])) {
        instance.dataValues[field] = this.encrypt(instance.dataValues[field]);
      }
    }
  }

  /**
   * 解密数据库字段（用于Sequelize hooks）
   * @param {Object} instance 模型实例
   * @param {Array} fields 需要解密的字段
   */
  decryptFields(instance, fields) {
    for (const field of fields) {
      if (instance.dataValues[field] && this.isEncrypted(instance.dataValues[field])) {
        try {
          instance.dataValues[field] = this.decrypt(instance.dataValues[field]);
        } catch (error) {
          logger.warn(`解密字段失败: ${field}`, error);
        }
      }
    }
  }
}

// 创建单例实例
const encryptionService = new EncryptionService();

module.exports = encryptionService;
