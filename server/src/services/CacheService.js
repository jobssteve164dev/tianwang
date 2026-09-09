/**
 * 缓存服务
 * Cache Service - PostgreSQL 持久缓存
 */

const logger = require('../utils/logger');
const { getSequelize } = require('../config/database');

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
    await getSequelize().authenticate();
    this.isConnected = true;
  }

  async disconnect() { this.isConnected = false; }

  async get(key, fetchFunction = null, ttl = 3600) {
    const [rows] = await getSequelize().query('SELECT value FROM application_cache WHERE key=:key AND expires_at>now()', { replacements: { key } });
    if (rows.length) { this.cacheStats.hits++; return rows[0].value; }
    this.cacheStats.misses++;
    if (!fetchFunction) return null;
    const value = await fetchFunction();
    if (value !== undefined && value !== null) await this.set(key, value, ttl);
    return value;
  }

  async set(key, value, ttl = 3600) {
    if (!Number.isFinite(ttl) || ttl <= 0) throw new Error('Cache lifetime must be positive');
    await getSequelize().query(`INSERT INTO application_cache(key,value,expires_at)
      VALUES (:key,CAST(:value AS jsonb),now() + :ttl * interval '1 second')
      ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,expires_at=EXCLUDED.expires_at`, {
      replacements: { key, value: JSON.stringify(value), ttl }
    });
    this.cacheStats.sets++;
  }

  async del(key) {
    await getSequelize().query('UPDATE application_cache SET expires_at=now() WHERE key=:key', { replacements: { key } });
    this.cacheStats.deletes++;
  }

  async delPattern(pattern) {
    const like = pattern.replace(/[\\%_]/g, character => `\\${character}`).replace(/\*/g, '%');
    await getSequelize().query('UPDATE application_cache SET expires_at=now() WHERE key LIKE :like', { replacements: { like } });
  }

  async exists(key) { return (await this.ttl(key)) >= 0; }

  async ttl(key) {
    const [rows] = await getSequelize().query('SELECT floor(extract(epoch FROM expires_at-now()))::int AS ttl FROM application_cache WHERE key=:key AND expires_at>now()', { replacements: { key } });
    return rows[0]?.ttl ?? -2;
  }

  async clear() { await getSequelize().query('UPDATE application_cache SET expires_at=now()'); }

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
    try { await getSequelize().authenticate(); return true; }
    catch (error) { logger.warn('缓存数据库不可用', { reason: error.name }); return false; }
  }

}

// 创建单例实例
const cacheService = new CacheService();

module.exports = cacheService;
