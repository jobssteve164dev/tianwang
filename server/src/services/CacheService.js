/**
 * 缓存服务
 * Cache Service - 多级缓存策略实现
 */

const redis = require('redis');
const { promisify } = require('util');
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
      this.client = redis.createClient({
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD,
        retry_strategy: (options) => {
          if (options.error && options.error.code === 'ECONNREFUSED') {
            logger.error('Redis连接被拒绝');
            return new Error('Redis连接失败');
          }
          if (options.total_retry_time > 1000 * 60 * 60) {
            logger.error('Redis重连超时');
            return new Error('Redis重连超时');
          }
          if (options.attempt > 10) {
            logger.error('Redis重连次数过多');
            return undefined;
          }
          return Math.min(options.attempt * 100, 3000);
        }
      });

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

      // 转换为Promise接口
      this.get = promisify(this.client.get).bind(this.client);
      this.set = promisify(this.client.set).bind(this.client);
      this.del = promisify(this.client.del).bind(this.client);
      this.exists = promisify(this.client.exists).bind(this.client);
      this.expire = promisify(this.client.expire).bind(this.client);
      this.ttl = promisify(this.client.ttl).bind(this.client);
      this.keys = promisify(this.client.keys).bind(this.client);
      this.flushdb = promisify(this.client.flushdb).bind(this.client);

    } catch (error) {
      logger.error('Redis初始化失败:', error);
      throw error;
    }
  }

  async disconnect() {
    if (this.client) {
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
      if (!this.isConnected) {
        if (fetchFunction) {
          return await fetchFunction();
        }
        return null;
      }

      const cached = await this.get(key);
      
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
      if (!this.isConnected) return;

      const serialized = JSON.stringify(value);
      await this.set(key, serialized);
      await this.expire(key, ttl);
      
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
      if (!this.isConnected) return;

      await this.del(key);
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
      if (!this.isConnected) return;

      const keys = await this.keys(pattern);
      if (keys.length > 0) {
        await this.del(keys);
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
      if (!this.isConnected) return false;

      const result = await this.exists(key);
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
      if (!this.isConnected) return -2;

      return await this.ttl(key);
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
      if (!this.isConnected) return;

      await this.flushdb();
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
}

// 创建单例实例
const cacheService = new CacheService();

module.exports = cacheService;
