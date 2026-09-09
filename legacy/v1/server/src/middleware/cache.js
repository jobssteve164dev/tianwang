/**
 * 缓存中间件
 * Cache Middleware - 自动缓存API响应
 */

const cacheService = require('../services/CacheService');
const logger = require('../utils/logger');

/**
 * 缓存中间件工厂函数
 * @param {Object} options 缓存选项
 * @param {number} options.ttl 缓存时间（秒）
 * @param {string} options.prefix 缓存键前缀
 * @param {Function} options.keyGenerator 缓存键生成函数
 * @param {Function} options.shouldCache 是否应该缓存的判断函数
 * @returns {Function} Express中间件
 */
function cacheMiddleware(options = {}) {
  const {
    ttl = 3600,
    prefix = 'api',
    keyGenerator = null,
    shouldCache = null
  } = options;

  return async (req, res, next) => {
    // 跳过非GET请求
    if (req.method !== 'GET') {
      return next();
    }

    // 检查是否应该缓存
    if (shouldCache && !shouldCache(req)) {
      return next();
    }

    // 生成缓存键
    const cacheKey = keyGenerator ? keyGenerator(req) : generateDefaultKey(req, prefix);

    try {
      // 尝试从缓存获取
      const cached = await cacheService.get(cacheKey);
      if (cached) {
        logger.debug(`缓存命中: ${cacheKey}`);
        return res.json(cached);
      }

      // 缓存未命中，继续处理请求
      logger.debug(`缓存未命中: ${cacheKey}`);
      
      // 重写res.json方法以缓存响应
      const originalJson = res.json;
      res.json = function(data) {
        // 缓存响应数据
        cacheService.set(cacheKey, data, ttl).catch(err => {
          logger.error('缓存响应失败:', err);
        });
        
        // 调用原始方法
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
 * @param {Object} req Express请求对象
 * @param {string} prefix 前缀
 * @returns {string} 缓存键
 */
function generateDefaultKey(req, prefix) {
  const url = req.originalUrl || req.url;
  const query = JSON.stringify(req.query);
  const user = req.user ? req.user.id : 'anonymous';
  
  return `${prefix}:${user}:${url}:${query}`;
}

/**
 * 用户会话缓存中间件
 */
function sessionCacheMiddleware() {
  return async (req, res, next) => {
    const sessionId = req.headers['x-session-id'] || req.cookies?.sessionId;
    
    if (!sessionId) {
      return next();
    }

    try {
      // 尝试从缓存获取会话
      const session = await cacheService.getUserSession(sessionId);
      if (session) {
        req.cachedSession = session;
        logger.debug(`会话缓存命中: ${sessionId}`);
      }
    } catch (error) {
      logger.error('会话缓存获取失败:', error);
    }

    next();
  };
}

/**
 * 系统配置缓存中间件
 */
function configCacheMiddleware() {
  return async (req, res, next) => {
    const configKey = req.params.configKey || req.query.configKey;
    
    if (!configKey) {
      return next();
    }

    try {
      // 尝试从缓存获取配置
      const config = await cacheService.getSystemConfig(configKey);
      if (config) {
        req.cachedConfig = config;
        logger.debug(`配置缓存命中: ${configKey}`);
      }
    } catch (error) {
      logger.error('配置缓存获取失败:', error);
    }

    next();
  };
}

/**
 * 威胁检测结果缓存中间件
 */
function threatCacheMiddleware() {
  return async (req, res, next) => {
    const threatId = req.params.threatId || req.query.threatId;
    
    if (!threatId) {
      return next();
    }

    try {
      // 尝试从缓存获取威胁检测结果
      const threatData = await cacheService.getThreatDetection(threatId);
      if (threatData) {
        req.cachedThreatData = threatData;
        logger.debug(`威胁检测缓存命中: ${threatId}`);
      }
    } catch (error) {
      logger.error('威胁检测缓存获取失败:', error);
    }

    next();
  };
}

/**
 * 缓存清理中间件
 */
function cacheClearMiddleware() {
  return async (req, res, next) => {
    const originalJson = res.json;
    
    res.json = function(data) {
      // 如果是POST/PUT/DELETE请求，清理相关缓存
      if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
        const pattern = `${req.baseUrl || ''}${req.path}`;
        cacheService.delPattern(pattern).catch(err => {
          logger.error('缓存清理失败:', err);
        });
      }
      
      return originalJson.call(this, data);
    };

    next();
  };
}

/**
 * 缓存统计中间件
 */
function cacheStatsMiddleware() {
  return async (req, res, next) => {
    if (req.path === '/api/cache/stats') {
      try {
        const stats = cacheService.getStats();
        const health = await cacheService.healthCheck();
        
        return res.json({
          success: true,
          data: {
            ...stats,
            health: health ? 'healthy' : 'unhealthy'
          }
        });
      } catch (error) {
        logger.error('获取缓存统计失败:', error);
        return res.status(500).json({
          success: false,
          error: '获取缓存统计失败'
        });
      }
    }
    
    next();
  };
}

module.exports = {
  cacheMiddleware,
  sessionCacheMiddleware,
  configCacheMiddleware,
  threatCacheMiddleware,
  cacheClearMiddleware,
  cacheStatsMiddleware
};
