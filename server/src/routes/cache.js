/**
 * 缓存管理路由
 * Cache Management Routes
 */

const express = require('express');
const router = express.Router();
const cacheService = require('../services/CacheService');
const { auth } = require('../middleware/auth');
const logger = require('../utils/logger');

/**
 * 获取缓存统计信息
 * GET /api/cache/stats
 */
router.get('/stats', auth, async (req, res) => {
  try {
    const stats = cacheService.getStats();
    const health = await cacheService.healthCheck();
    
    res.json({
      success: true,
      data: {
        ...stats,
        health: health ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('获取缓存统计失败:', error);
    res.status(500).json({
      success: false,
      error: '获取缓存统计失败'
    });
  }
});

/**
 * 重置缓存统计
 * POST /api/cache/stats/reset
 */
router.post('/stats/reset', auth, async (req, res) => {
  try {
    cacheService.resetStats();
    
    res.json({
      success: true,
      message: '缓存统计已重置'
    });
  } catch (error) {
    logger.error('重置缓存统计失败:', error);
    res.status(500).json({
      success: false,
      error: '重置缓存统计失败'
    });
  }
});

/**
 * 清空所有缓存
 * POST /api/cache/clear
 */
router.post('/clear', auth, async (req, res) => {
  try {
    await cacheService.clear();
    
    res.json({
      success: true,
      message: '所有缓存已清空'
    });
  } catch (error) {
    logger.error('清空缓存失败:', error);
    res.status(500).json({
      success: false,
      error: '清空缓存失败'
    });
  }
});

/**
 * 删除指定模式的缓存
 * DELETE /api/cache/pattern/:pattern
 */
router.delete('/pattern/:pattern', auth, async (req, res) => {
  try {
    const { pattern } = req.params;
    await cacheService.delPattern(pattern);
    
    res.json({
      success: true,
      message: `已删除匹配模式 "${pattern}" 的缓存`
    });
  } catch (error) {
    logger.error('删除缓存模式失败:', error);
    res.status(500).json({
      success: false,
      error: '删除缓存模式失败'
    });
  }
});

/**
 * 删除指定键的缓存
 * DELETE /api/cache/key/:key
 */
router.delete('/key/:key', auth, async (req, res) => {
  try {
    const { key } = req.params;
    await cacheService.del(key);
    
    res.json({
      success: true,
      message: `已删除缓存键 "${key}"`
    });
  } catch (error) {
    logger.error('删除缓存键失败:', error);
    res.status(500).json({
      success: false,
      error: '删除缓存键失败'
    });
  }
});

/**
 * 获取缓存键的TTL
 * GET /api/cache/ttl/:key
 */
router.get('/ttl/:key', auth, async (req, res) => {
  try {
    const { key } = req.params;
    const ttl = await cacheService.ttl(key);
    
    res.json({
      success: true,
      data: {
        key,
        ttl,
        exists: ttl !== -2
      }
    });
  } catch (error) {
    logger.error('获取缓存TTL失败:', error);
    res.status(500).json({
      success: false,
      error: '获取缓存TTL失败'
    });
  }
});

/**
 * 检查缓存键是否存在
 * GET /api/cache/exists/:key
 */
router.get('/exists/:key', auth, async (req, res) => {
  try {
    const { key } = req.params;
    const exists = await cacheService.exists(key);
    
    res.json({
      success: true,
      data: {
        key,
        exists
      }
    });
  } catch (error) {
    logger.error('检查缓存键存在失败:', error);
    res.status(500).json({
      success: false,
      error: '检查缓存键存在失败'
    });
  }
});

/**
 * 用户会话缓存管理
 */

/**
 * 设置用户会话
 * POST /api/cache/session
 */
router.post('/session', auth, async (req, res) => {
  try {
    const { sessionId, sessionData, ttl = 3600 } = req.body;
    
    if (!sessionId || !sessionData) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数'
      });
    }
    
    await cacheService.setUserSession(sessionId, sessionData, ttl);
    
    res.json({
      success: true,
      message: '用户会话已缓存'
    });
  } catch (error) {
    logger.error('设置用户会话缓存失败:', error);
    res.status(500).json({
      success: false,
      error: '设置用户会话缓存失败'
    });
  }
});

/**
 * 获取用户会话
 * GET /api/cache/session/:sessionId
 */
router.get('/session/:sessionId', auth, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await cacheService.getUserSession(sessionId);
    
    res.json({
      success: true,
      data: session
    });
  } catch (error) {
    logger.error('获取用户会话缓存失败:', error);
    res.status(500).json({
      success: false,
      error: '获取用户会话缓存失败'
    });
  }
});

/**
 * 删除用户会话
 * DELETE /api/cache/session/:sessionId
 */
router.delete('/session/:sessionId', auth, async (req, res) => {
  try {
    const { sessionId } = req.params;
    await cacheService.deleteUserSession(sessionId);
    
    res.json({
      success: true,
      message: '用户会话已删除'
    });
  } catch (error) {
    logger.error('删除用户会话缓存失败:', error);
    res.status(500).json({
      success: false,
      error: '删除用户会话缓存失败'
    });
  }
});

/**
 * 系统配置缓存管理
 */

/**
 * 设置系统配置
 * POST /api/cache/config
 */
router.post('/config', auth, async (req, res) => {
  try {
    const { configKey, configValue, ttl = 7200 } = req.body;
    
    if (!configKey || configValue === undefined) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数'
      });
    }
    
    await cacheService.setSystemConfig(configKey, configValue, ttl);
    
    res.json({
      success: true,
      message: '系统配置已缓存'
    });
  } catch (error) {
    logger.error('设置系统配置缓存失败:', error);
    res.status(500).json({
      success: false,
      error: '设置系统配置缓存失败'
    });
  }
});

/**
 * 获取系统配置
 * GET /api/cache/config/:configKey
 */
router.get('/config/:configKey', auth, async (req, res) => {
  try {
    const { configKey } = req.params;
    const config = await cacheService.getSystemConfig(configKey);
    
    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    logger.error('获取系统配置缓存失败:', error);
    res.status(500).json({
      success: false,
      error: '获取系统配置缓存失败'
    });
  }
});

/**
 * 删除系统配置
 * DELETE /api/cache/config/:configKey
 */
router.delete('/config/:configKey', auth, async (req, res) => {
  try {
    const { configKey } = req.params;
    await cacheService.deleteSystemConfig(configKey);
    
    res.json({
      success: true,
      message: '系统配置已删除'
    });
  } catch (error) {
    logger.error('删除系统配置缓存失败:', error);
    res.status(500).json({
      success: false,
      error: '删除系统配置缓存失败'
    });
  }
});

/**
 * 威胁检测结果缓存管理
 */

/**
 * 设置威胁检测结果
 * POST /api/cache/threat
 */
router.post('/threat', auth, async (req, res) => {
  try {
    const { threatId, threatData, ttl = 1800 } = req.body;
    
    if (!threatId || !threatData) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数'
      });
    }
    
    await cacheService.setThreatDetection(threatId, threatData, ttl);
    
    res.json({
      success: true,
      message: '威胁检测结果已缓存'
    });
  } catch (error) {
    logger.error('设置威胁检测缓存失败:', error);
    res.status(500).json({
      success: false,
      error: '设置威胁检测缓存失败'
    });
  }
});

/**
 * 获取威胁检测结果
 * GET /api/cache/threat/:threatId
 */
router.get('/threat/:threatId', auth, async (req, res) => {
  try {
    const { threatId } = req.params;
    const threatData = await cacheService.getThreatDetection(threatId);
    
    res.json({
      success: true,
      data: threatData
    });
  } catch (error) {
    logger.error('获取威胁检测缓存失败:', error);
    res.status(500).json({
      success: false,
      error: '获取威胁检测缓存失败'
    });
  }
});

/**
 * 删除威胁检测结果
 * DELETE /api/cache/threat/:threatId
 */
router.delete('/threat/:threatId', auth, async (req, res) => {
  try {
    const { threatId } = req.params;
    await cacheService.deleteThreatDetection(threatId);
    
    res.json({
      success: true,
      message: '威胁检测结果已删除'
    });
  } catch (error) {
    logger.error('删除威胁检测缓存失败:', error);
    res.status(500).json({
      success: false,
      error: '删除威胁检测缓存失败'
    });
  }
});

/**
 * 批量删除威胁检测结果
 * DELETE /api/cache/threat/pattern/:pattern
 */
router.delete('/threat/pattern/:pattern', auth, async (req, res) => {
  try {
    const { pattern } = req.params;
    await cacheService.deleteThreatDetectionPattern(pattern);
    
    res.json({
      success: true,
      message: `已删除匹配模式 "${pattern}" 的威胁检测缓存`
    });
  } catch (error) {
    logger.error('批量删除威胁检测缓存失败:', error);
    res.status(500).json({
      success: false,
      error: '批量删除威胁检测缓存失败'
    });
  }
});

module.exports = router;
