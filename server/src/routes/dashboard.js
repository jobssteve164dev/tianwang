/**
 * Dashboard 路由
 * Dashboard Routes
 */

const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');

/**
 * 获取安全指标数据
 * GET /api/dashboard/security-metrics
 */
router.get('/security-metrics', async (req, res) => {
  try {
    // 模拟安全指标数据
    const securityMetrics = {
      totalThreats: 156,
      activeAlerts: 23,
      connectedDevices: 1247,
      threatTrend: 12.5,
      systemHealth: 'healthy',
      lastUpdated: new Date().toISOString(),
      metrics: {
        malwareDetections: 45,
        networkIntrusions: 67,
        suspiciousActivities: 34,
        policyViolations: 10
      },
      trends: {
        daily: [12, 15, 8, 20, 18, 14, 16],
        weekly: [89, 102, 78, 95, 88, 76, 92]
      }
    };

    res.json({
      success: true,
      data: securityMetrics
    });
  } catch (error) {
    logger.error('Error fetching security metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch security metrics'
    });
  }
});

/**
 * 获取威胁趋势数据
 * GET /api/dashboard/threat-trends
 */
router.get('/threat-trends', async (req, res) => {
  try {
    const { range = '7d' } = req.query;
    
    // 根据时间范围生成模拟数据
    let dataPoints = 7;
    let labels = [];
    
    if (range === '30d') {
      dataPoints = 30;
    } else if (range === '90d') {
      dataPoints = 90;
    }

    // 生成日期标签
    for (let i = dataPoints - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      labels.push(date.toISOString().split('T')[0]);
    }

    const threatTrends = {
      labels,
      datasets: [
        {
          label: '恶意软件',
          data: Array.from({ length: dataPoints }, () => Math.floor(Math.random() * 50) + 10),
          borderColor: '#ff6384',
          backgroundColor: 'rgba(255, 99, 132, 0.1)'
        },
        {
          label: '网络入侵',
          data: Array.from({ length: dataPoints }, () => Math.floor(Math.random() * 30) + 5),
          borderColor: '#36a2eb',
          backgroundColor: 'rgba(54, 162, 235, 0.1)'
        },
        {
          label: '可疑活动',
          data: Array.from({ length: dataPoints }, () => Math.floor(Math.random() * 20) + 3),
          borderColor: '#ffcd56',
          backgroundColor: 'rgba(255, 205, 86, 0.1)'
        }
      ]
    };

    res.json({
      success: true,
      data: threatTrends
    });
  } catch (error) {
    logger.error('Error fetching threat trends:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch threat trends'
    });
  }
});

/**
 * 获取威胁分布数据
 * GET /api/dashboard/threat-distribution
 */
router.get('/threat-distribution', async (req, res) => {
  try {
    const threatDistribution = {
      categories: [
        { name: '恶意软件', value: 35, color: '#ff6384' },
        { name: '网络入侵', value: 28, color: '#36a2eb' },
        { name: '钓鱼攻击', value: 18, color: '#ffcd56' },
        { name: 'DDoS攻击', value: 12, color: '#4bc0c0' },
        { name: '其他', value: 7, color: '#9966ff' }
      ],
      total: 156,
      lastUpdated: new Date().toISOString()
    };

    res.json({
      success: true,
      data: threatDistribution
    });
  } catch (error) {
    logger.error('Error fetching threat distribution:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch threat distribution'
    });
  }
});

/**
 * 获取设备统计信息
 * GET /api/dashboard/device-stats
 */
router.get('/device-stats', async (req, res) => {
  try {
    const deviceStats = {
      totalDevices: 1247,
      onlineDevices: 1189,
      offlineDevices: 58,
      protectedDevices: 1201,
      unprotectedDevices: 46,
      deviceTypes: {
        servers: 89,
        workstations: 856,
        mobileDevices: 234,
        networkDevices: 68
      },
      lastUpdated: new Date().toISOString()
    };

    res.json({
      success: true,
      data: deviceStats
    });
  } catch (error) {
    logger.error('Error fetching device stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch device stats'
    });
  }
});

/**
 * 获取系统性能指标
 * GET /api/dashboard/performance-metrics
 */
router.get('/performance-metrics', async (req, res) => {
  try {
    const performanceMetrics = {
      cpuUsage: 45.2,
      memoryUsage: 67.8,
      diskUsage: 23.4,
      networkTraffic: {
        incoming: 125.6, // MB/s
        outgoing: 89.3   // MB/s
      },
      responseTime: 125, // ms
      uptime: 86400, // seconds
      lastUpdated: new Date().toISOString()
    };

    res.json({
      success: true,
      data: performanceMetrics
    });
  } catch (error) {
    logger.error('Error fetching performance metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch performance metrics'
    });
  }
});

/**
 * 获取实时告警统计
 * GET /api/dashboard/alert-stats
 */
router.get('/alert-stats', async (req, res) => {
  try {
    const alertStats = {
      totalAlerts: 234,
      criticalAlerts: 12,
      highAlerts: 45,
      mediumAlerts: 89,
      lowAlerts: 88,
      resolvedAlerts: 156,
      pendingAlerts: 78,
      lastUpdated: new Date().toISOString()
    };

    res.json({
      success: true,
      data: alertStats
    });
  } catch (error) {
    logger.error('Error fetching alert stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch alert stats'
    });
  }
});

module.exports = router;
