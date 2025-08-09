/**
 * 缓存中间件
 * Cache Middleware - API响应缓存
 */

const cacheService = require('../services/CacheService');
const logger = require('../utils/logger');

/**
 * 缓存中间件工厂函数
 * @param {number} ttl 缓存时间（秒）
 * @param {Function} keyGenerator 缓存键生成函数
 * @returns {Function} 中间件函数
 */
function cacheMiddleware(ttl = 300, keyGenerator = null) {
  return async (req, res, next) => {
    // 跳过非GET请求
    if (req.method !== 'GET') {
      return next();
    }

    // 跳过需要实时数据的请求
    if (req.query.nocache === 'true' || req.headers['cache-control'] === 'no-cache') {
      return next();
    }

    try {
      // 生成缓存键
      const cacheKey = keyGenerator ? keyGenerator(req) : generateDefaultKey(req);
      
      // 尝试从缓存获取数据
      const cachedData = await cacheService.get(cacheKey);
      
      if (cachedData) {
        logger.debug(`缓存命中: ${cacheKey}`);
        return res.json({
          success: true,
          data: cachedData,
          cached: true,
          timestamp: new Date().toISOString()
        });
      }

      // 缓存未命中，继续处理请求
      logger.debug(`缓存未命中: ${cacheKey}`);
      
      // 重写res.json方法以缓存响应
      const originalJson = res.json;
      res.json = function(data) {
        // 只缓存成功的响应
        if (data && data.success !== false) {
          cacheService.set(cacheKey, data.data || data, ttl);
        }
        return originalJson.call(this, data);
      };

      next();
    } catch (error) {
      logger.error('缓存中间件错误:', error);
      next();
    }
  };
}

/**
 * 生成默认缓存键
 * @param {Object} req 请求对象
 * @returns {string} 缓存键
 */
function generateDefaultKey(req) {
  const { url, query, user } = req;
  const userId = user ? user.id : 'anonymous';
  const queryString = Object.keys(query).length > 0 ? JSON.stringify(query) : '';
  
  return `api:${userId}:${url}:${queryString}`;
}

/**
 * 清除缓存中间件
 * @param {Function} patternGenerator 缓存模式生成函数
 * @returns {Function} 中间件函数
 */
function clearCacheMiddleware(patternGenerator = null) {
  return async (req, res, next) => {
    try {
      const pattern = patternGenerator ? patternGenerator(req) : generateDefaultPattern(req);
      
      if (pattern) {
        await cacheService.delPattern(pattern);
        logger.info(`清除缓存模式: ${pattern}`);
      }
      
      next();
    } catch (error) {
      logger.error('清除缓存中间件错误:', error);
      next();
    }
  };
}

/**
 * 生成默认缓存清除模式
 * @param {Object} req 请求对象
 * @returns {string} 缓存模式
 */
function generateDefaultPattern(req) {
  const { user } = req;
  const userId = user ? user.id : 'anonymous';
  
  return `api:${userId}:*`;
}

/**
 * 设备相关缓存键生成器
 * @param {Object} req 请求对象
 * @returns {string} 缓存键
 */
function deviceCacheKey(req) {
  const { user, params, query } = req;
  const userId = user ? user.id : 'anonymous';
  const deviceId = params.deviceId || query.deviceId;
  const queryString = Object.keys(query).length > 0 ? JSON.stringify(query) : '';
  
  return `device:${userId}:${deviceId || 'all'}:${queryString}`;
}

/**
 * 安全事件缓存键生成器
 * @param {Object} req 请求对象
 * @returns {string} 缓存键
 */
function securityEventCacheKey(req) {
  const { user, params, query } = req;
  const userId = user ? user.id : 'anonymous';
  const eventId = params.eventId || query.eventId;
  const queryString = Object.keys(query).length > 0 ? JSON.stringify(query) : '';
  
  return `security_event:${userId}:${eventId || 'all'}:${queryString}`;
}

/**
 * 仪表盘数据缓存键生成器
 * @param {Object} req 请求对象
 * @returns {string} 缓存键
 */
function dashboardCacheKey(req) {
  const { user, query } = req;
  const userId = user ? user.id : 'anonymous';
  const timeRange = query.timeRange || '24h';
  const queryString = Object.keys(query).length > 0 ? JSON.stringify(query) : '';
  
  return `dashboard:${userId}:${timeRange}:${queryString}`;
}

module.exports = {
  cacheMiddleware,
  clearCacheMiddleware,
  deviceCacheKey,
  securityEventCacheKey,
  dashboardCacheKey
};
