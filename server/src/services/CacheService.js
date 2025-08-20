/**
 * 缓存服务
 * Cache Service - 多级缓存策略实现
 * 兼容Redis v4.x
 */

const redis = require('redis');
const logger = require('../utils/logger');

class CacheService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.cacheStats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0
    };
  }

  async connect() {
    try {
      const redisConfig = {
        socket: {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT) || 6379
        },
        database: parseInt(process.env.REDIS_DB) || 0
      };

      // 只有在配置了密码时才添加密码
      if (process.env.REDIS_PASSWORD && process.env.REDIS_PASSWORD.trim() !== '') {
        redisConfig.password = process.env.REDIS_PASSWORD;
      }

      this.client = redis.createClient(redisConfig);

      // 监听连接事件
      this.client.on('connect', () => {
        logger.info('Redis连接成功');
        this.isConnected = true;
      });

      this.client.on('error', (err) => {
        logger.error('Redis连接错误:', err);
        this.isConnected = false;
      });

      this.client.on('end', () => {
        logger.warn('Redis连接断开');
        this.isConnected = false;
      });

      this.client.on('ready', () => {
        logger.info('Redis准备就绪');
        this.isConnected = true;
      });

      // 连接到Redis
      await this.client.connect();

    } catch (error) {
      logger.error('Redis初始化失败:', error);
      throw error;
    }
  }

  async disconnect() {
    if (this.client && this.isConnected) {
      await this.client.quit();
      this.isConnected = false;
    }
  }

  /**
   * 获取缓存
   * @param {string} key 缓存键
   * @param {Function} fetchFunction 数据获取函数（当缓存未命中时调用）
   * @param {number} ttl 过期时间（秒）
   * @returns {Promise<any>} 缓存数据
   */
  async get(key, fetchFunction = null, ttl = 3600) {
    try {
      if (!this.isConnected || !this.client) {
        if (fetchFunction) {
          return await fetchFunction();
        }
        return null;
      }

      const cached = await this.client.get(key);
      
      if (cached) {
        this.cacheStats.hits++;
        return JSON.parse(cached);
      }

      this.cacheStats.misses++;
      
      if (fetchFunction) {
        const data = await fetchFunction();
        if (data !== null && data !== undefined) {
          await this.set(key, data, ttl);
        }
        return data;
      }

      return null;
    } catch (error) {
      logger.error('缓存获取失败:', error);
      if (fetchFunction) {
        return await fetchFunction();
      }
      return null;
    }
  }

  /**
   * 设置缓存
   * @param {string} key 缓存键
   * @param {any} value 缓存值
   * @param {number} ttl 过期时间（秒）
   */
  async set(key, value, ttl = 3600) {
    try {
      if (!this.isConnected || !this.client) return;

      const serialized = JSON.stringify(value);
      await this.client.setEx(key, ttl, serialized);
      
      this.cacheStats.sets++;
    } catch (error) {
      logger.error('缓存设置失败:', error);
    }
  }

  /**
   * 删除缓存
   * @param {string} key 缓存键
   */
  async del(key) {
    try {
      if (!this.isConnected || !this.client) return;

      await this.client.del(key);
      this.cacheStats.deletes++;
    } catch (error) {
      logger.error('缓存删除失败:', error);
    }
  }

  /**
   * 批量删除缓存
   * @param {string} pattern 匹配模式
   */
  async delPattern(pattern) {
    try {
      if (!this.isConnected || !this.client) return;

      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(keys);
        this.cacheStats.deletes += keys.length;
      }
    } catch (error) {
      logger.error('批量缓存删除失败:', error);
    }
  }

  /**
   * 检查缓存是否存在
   * @param {string} key 缓存键
   * @returns {Promise<boolean>}
   */
  async exists(key) {
    try {
      if (!this.isConnected || !this.client) return false;

      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      logger.error('缓存存在检查失败:', error);
      return false;
    }
  }

  /**
   * 获取缓存剩余时间
   * @param {string} key 缓存键
   * @returns {Promise<number>} 剩余秒数，-1表示永不过期，-2表示不存在
   */
  async ttl(key) {
    try {
      if (!this.isConnected || !this.client) return -2;

      return await this.client.ttl(key);
    } catch (error) {
      logger.error('缓存TTL获取失败:', error);
      return -2;
    }
  }

  /**
   * 清空所有缓存
   */
  async clear() {
    try {
      if (!this.isConnected || !this.client) return;

      await this.client.flushDb();
      logger.info('缓存已清空');
    } catch (error) {
      logger.error('缓存清空失败:', error);
    }
  }

  /**
   * 获取缓存统计信息
   * @returns {Object} 缓存统计
   */
  getStats() {
    const total = this.cacheStats.hits + this.cacheStats.misses;
    const hitRate = total > 0 ? (this.cacheStats.hits / total * 100).toFixed(2) : 0;
    
    return {
      ...this.cacheStats,
      hitRate: `${hitRate}%`,
      isConnected: this.isConnected
    };
  }

  /**
   * 重置缓存统计
   */
  resetStats() {
    this.cacheStats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0
    };
  }

  /**
   * 用户会话缓存相关方法
   */
  
  /**
   * 设置用户会话
   * @param {string} sessionId 会话ID
   * @param {Object} sessionData 会话数据
   * @param {number} ttl 过期时间（秒）
   */
  async setUserSession(sessionId, sessionData, ttl = 3600) {
    const key = `session:${sessionId}`;
    await this.set(key, sessionData, ttl);
  }

  /**
   * 获取用户会话
   * @param {string} sessionId 会话ID
   * @returns {Promise<Object|null>} 会话数据
   */
  async getUserSession(sessionId) {
    const key = `session:${sessionId}`;
    return await this.get(key);
  }

  /**
   * 删除用户会话
   * @param {string} sessionId 会话ID
   */
  async deleteUserSession(sessionId) {
    const key = `session:${sessionId}`;
    await this.del(key);
  }

  /**
   * 系统配置缓存相关方法
   */

  /**
   * 设置系统配置
   * @param {string} configKey 配置键
   * @param {any} configValue 配置值
   * @param {number} ttl 过期时间（秒）
   */
  async setSystemConfig(configKey, configValue, ttl = 7200) {
    const key = `config:${configKey}`;
    await this.set(key, configValue, ttl);
  }

  /**
   * 获取系统配置
   * @param {string} configKey 配置键
   * @param {Function} fetchFunction 数据获取函数
   * @returns {Promise<any>} 配置值
   */
  async getSystemConfig(configKey, fetchFunction = null) {
    const key = `config:${configKey}`;
    return await this.get(key, fetchFunction, 7200);
  }

  /**
   * 删除系统配置
   * @param {string} configKey 配置键
   */
  async deleteSystemConfig(configKey) {
    const key = `config:${configKey}`;
    await this.del(key);
  }

  /**
   * 威胁检测结果缓存相关方法
   */

  /**
   * 设置威胁检测结果
   * @param {string} threatId 威胁ID
   * @param {Object} threatData 威胁数据
   * @param {number} ttl 过期时间（秒）
   */
  async setThreatDetection(threatId, threatData, ttl = 1800) {
    const key = `threat:${threatId}`;
    await this.set(key, threatData, ttl);
  }

  /**
   * 获取威胁检测结果
   * @param {string} threatId 威胁ID
   * @returns {Promise<Object|null>} 威胁数据
   */
  async getThreatDetection(threatId) {
    const key = `threat:${threatId}`;
    return await this.get(key);
  }

  /**
   * 删除威胁检测结果
   * @param {string} threatId 威胁ID
   */
  async deleteThreatDetection(threatId) {
    const key = `threat:${threatId}`;
    await this.del(key);
  }

  /**
   * 批量删除威胁检测结果
   * @param {string} pattern 匹配模式
   */
  async deleteThreatDetectionPattern(pattern) {
    const keyPattern = `threat:${pattern}`;
    await this.delPattern(keyPattern);
  }

  /**
   * 健康检查
   * @returns {Promise<boolean>} 是否健康
   */
  async healthCheck() {
    try {
      if (!this.isConnected || !this.client) return false;
      await this.client.ping();
      return true;
    } catch (error) {
      logger.error('Redis健康检查失败:', error);
      return false;
    }
  }
}

// 创建单例实例
const cacheService = new CacheService();

module.exports = cacheService;
