/**
 * 数据查询API路由
 * Data Query API Routes - 提供对InfluxDB中存储数据的访问接口
 */

const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const dataStorageService = require('../services/DataStorageService');
const logger = require('../utils/logger');

/**
 * GET /api/data/system/:agent_id
 * 获取代理的系统性能数据
 */
router.get('/system/:agent_id', authenticate, async (req, res) => {
  try {
    const { agent_id } = req.params;
    const { start, end, limit = 1000 } = req.query;

    // 验证时间范围
    const startTime = start ? new Date(start).toISOString() : '-1h';
    const endTime = end ? new Date(end).toISOString() : 'now()';

    const data = await dataStorageService.querySystemData(agent_id, startTime, endTime, parseInt(limit));

    res.json({
      success: true,
      data: {
        agent_id,
        metrics: data,
        count: data.length,
        timeRange: { start: startTime, end: endTime }
      }
    });

  } catch (error) {
    logger.error('获取系统数据失败:', error);
    res.status(500).json({
      success: false,
      error: '获取系统数据失败',
      message: error.message
    });
  }
});

/**
 * GET /api/data/network/:agent_id
 * 获取代理的网络流量数据
 */
router.get('/network/:agent_id', authenticate, async (req, res) => {
  try {
    const { agent_id } = req.params;
    const { start, end, limit = 1000 } = req.query;

    // 验证时间范围
    const startTime = start ? new Date(start).toISOString() : '-1h';
    const endTime = end ? new Date(end).toISOString() : 'now()';

    const data = await dataStorageService.queryNetworkData(agent_id, startTime, endTime, parseInt(limit));

    res.json({
      success: true,
      data: {
        agent_id,
        metrics: data,
        count: data.length,
        timeRange: { start: startTime, end: endTime }
      }
    });

  } catch (error) {
    logger.error('获取网络数据失败:', error);
    res.status(500).json({
      success: false,
      error: '获取网络数据失败',
      message: error.message
    });
  }
});

/**
 * GET /api/data/security/:agent_id
 * 获取代理的安全事件数据
 */
router.get('/security/:agent_id', authenticate, async (req, res) => {
  try {
    const { agent_id } = req.params;
    const { start, end, limit = 1000 } = req.query;

    // 验证时间范围
    const startTime = start ? new Date(start).toISOString() : '-24h';
    const endTime = end ? new Date(end).toISOString() : 'now()';

    const data = await dataStorageService.querySecurityEvents(agent_id, startTime, endTime, parseInt(limit));

    res.json({
      success: true,
      data: {
        agent_id,
        events: data,
        count: data.length,
        timeRange: { start: startTime, end: endTime }
      }
    });

  } catch (error) {
    logger.error('获取安全事件数据失败:', error);
    res.status(500).json({
      success: false,
      error: '获取安全事件数据失败',
      message: error.message
    });
  }
});

/**
 * GET /api/data/stats/:agent_id
 * 获取代理的系统性能统计
 */
router.get('/stats/:agent_id', authenticate, async (req, res) => {
  try {
    const { agent_id } = req.params;
    const { timeRange = '1h' } = req.query;

    const stats = await dataStorageService.getSystemStats(agent_id, timeRange);

    res.json({
      success: true,
      data: {
        agent_id,
        stats,
        timeRange
      }
    });

  } catch (error) {
    logger.error('获取系统统计失败:', error);
    res.status(500).json({
      success: false,
      error: '获取系统统计失败',
      message: error.message
    });
  }
});

/**
 * GET /api/data/agents/:agent_id/summary
 * 获取代理的数据摘要
 */
router.get('/agents/:agent_id/summary', authenticate, async (req, res) => {
  try {
    const { agent_id } = req.params;
    const { timeRange = '24h' } = req.query;

    // 获取系统统计
    const systemStats = await dataStorageService.getSystemStats(agent_id, timeRange);
    
    // 获取安全事件统计
    const securityEvents = await dataStorageService.querySecurityEvents(agent_id, `-${timeRange}`, 'now()', 100);

    // 计算摘要数据
    const summary = {
      agent_id,
      timeRange,
      system: {
        avgCpuLoad: 0,
        avgMemoryUsage: 0,
        maxCpuLoad: 0,
        maxMemoryUsage: 0
      },
      security: {
        totalEvents: securityEvents.length,
        criticalEvents: securityEvents.filter(e => e.severity === 'critical').length,
        highEvents: securityEvents.filter(e => e.severity === 'high').length,
        mediumEvents: securityEvents.filter(e => e.severity === 'medium').length,
        lowEvents: securityEvents.filter(e => e.severity === 'low').length
      },
      lastUpdated: new Date().toISOString()
    };

    // 计算系统指标
    if (systemStats.length > 0) {
      const cpuLoads = systemStats.filter(s => s._field === 'cpu_load').map(s => s._value);
      const memoryUsages = systemStats.filter(s => s._field === 'memory_usage_percent').map(s => s._value);

      if (cpuLoads.length > 0) {
        summary.system.avgCpuLoad = cpuLoads.reduce((a, b) => a + b, 0) / cpuLoads.length;
        summary.system.maxCpuLoad = Math.max(...cpuLoads);
      }

      if (memoryUsages.length > 0) {
        summary.system.avgMemoryUsage = memoryUsages.reduce((a, b) => a + b, 0) / memoryUsages.length;
        summary.system.maxMemoryUsage = Math.max(...memoryUsages);
      }
    }

    res.json({
      success: true,
      data: summary
    });

  } catch (error) {
    logger.error('获取代理数据摘要失败:', error);
    res.status(500).json({
      success: false,
      error: '获取代理数据摘要失败',
      message: error.message
    });
  }
});

/**
 * GET /api/data/health
 * 检查数据存储服务健康状态
 */
router.get('/health', authenticate, async (req, res) => {
  try {
    const isInitialized = dataStorageService.isInitialized;
    
    res.json({
      success: true,
      data: {
        service: 'data-storage',
        status: isInitialized ? 'healthy' : 'unhealthy',
        initialized: isInitialized,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('检查数据存储服务健康状态失败:', error);
    res.status(500).json({
      success: false,
      error: '检查数据存储服务健康状态失败',
      message: error.message
    });
  }
});

module.exports = router;
