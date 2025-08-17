/**
 * Dashboard 路由
 * Dashboard Routes
 */

const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const models = require('../models');
const { Op } = require('sequelize');

/**
 * 获取安全指标数据
 * GET /api/dashboard/security-metrics
 */
router.get('/security-metrics', async (req, res) => {
  try {
    // 检查模型是否可用
    if (!models.Alert || !models.Agent) {
      logger.error('Alert或Agent模型不可用');
      return res.status(503).json({
        success: false,
        error: 'Database not initialized'
      });
    }

    // 并行查询各种统计数据
    const [
      totalThreats,
      activeAlerts,
      totalDevices,
      onlineDevices,
      recentAlerts,
      previousAlerts
    ] = await Promise.all([
      // 总威胁数（所有告警）
      models.Alert.count(),
      
      // 活跃告警数
      models.Alert.count({ where: { status: 'active' } }),
      
      // 总设备数
      models.Agent.count(),
      
      // 在线设备数
      models.Agent.count({ where: { status: 'online' } }),
      
      // 最近7天的告警数
      models.Alert.count({
        where: {
          timestamp: {
            [Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          }
        }
      }),
      
      // 之前7天的告警数（用于计算趋势）
      models.Alert.count({
        where: {
          timestamp: {
            [Op.gte]: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
            [Op.lt]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          }
        }
      })
    ]);

    // 计算威胁趋势百分比
    const threatTrend = previousAlerts > 0 
      ? ((recentAlerts - previousAlerts) / previousAlerts * 100).toFixed(1)
      : recentAlerts > 0 ? 100 : 0;

    // 定义威胁类型映射（与威胁分布API保持一致）
    const threatTypeMap = {
      // 恶意软件相关
      'malware-activity': { name: '恶意软件', color: '#ff6384', category: 'malware' },
      
      // 网络入侵相关
      'network-intrusion': { name: '网络入侵', color: '#36a2eb', category: 'network-intrusion' },
      'suspicious-connection': { name: '网络入侵', color: '#36a2eb', category: 'network-intrusion' },
      'connection-flood': { name: '网络入侵', color: '#36a2eb', category: 'network-intrusion' },
      'unknown-process-connection': { name: '网络入侵', color: '#36a2eb', category: 'network-intrusion' },
      
      // 可疑活动相关
      'suspicious-process': { name: '可疑活动', color: '#9966ff', category: 'suspicious-activity' },
      'dangerous-command': { name: '可疑活动', color: '#9966ff', category: 'suspicious-activity' },
      'high-cpu-process': { name: '可疑活动', color: '#9966ff', category: 'suspicious-activity' },
      'high-memory-usage': { name: '可疑活动', color: '#9966ff', category: 'suspicious-activity' },
      'high-cpu-usage': { name: '可疑活动', color: '#9966ff', category: 'suspicious-activity' },
      'high-temperature': { name: '可疑活动', color: '#9966ff', category: 'suspicious-activity' },
      
      // DDoS攻击
      'ddos-attack': { name: 'DDoS攻击', color: '#4bc0c0', category: 'ddos' },
      
      // 数据泄露
      'data-leak': { name: '数据泄露', color: '#ff9f40', category: 'data-leak' },
      
      // 认证异常
      'authentication-anomaly': { name: '认证异常', color: '#ffcd56', category: 'authentication-anomaly' }
    };

    // 按类型统计告警
    const alertTypeStats = await models.Alert.findAll({
      attributes: [
        'type',
        [models.sequelize.fn('COUNT', models.sequelize.col('id')), 'count']
      ],
      group: ['type'],
      raw: true
    });

    const metrics = {
      malwareDetections: 0,
      networkIntrusions: 0,
      suspiciousActivities: 0,
      policyViolations: 0
    };

    alertTypeStats.forEach(stat => {
      const count = parseInt(stat.count);
      const threatType = threatTypeMap[stat.type];
      if (threatType) {
        switch (threatType.category) {
          case 'malware':
            metrics.malwareDetections += count;
            break;
          case 'network-intrusion':
            metrics.networkIntrusions += count;
            break;
          case 'suspicious-activity':
            metrics.suspiciousActivities += count;
            break;
          case 'data-leak':
            metrics.policyViolations += count;
            break;
        }
      }
    });

    // 获取最近7天的每日告警趋势
    const dailyTrends = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
      
      const dailyCount = await models.Alert.count({
        where: {
          timestamp: {
            [Op.gte]: startOfDay,
            [Op.lt]: endOfDay
          }
        }
      });
      dailyTrends.push(dailyCount);
    }

    // 获取最近4周的每周告警趋势
    const weeklyTrends = [];
    for (let i = 3; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i * 7);
      const startOfWeek = new Date(date.getFullYear(), date.getMonth(), date.getDate() - date.getDay());
      const endOfWeek = new Date(startOfWeek.getTime() + 7 * 24 * 60 * 60 * 1000);
      
      const weeklyCount = await models.Alert.count({
        where: {
          timestamp: {
            [Op.gte]: startOfWeek,
            [Op.lt]: endOfWeek
          }
        }
      });
      weeklyTrends.push(weeklyCount);
    }

    const securityMetrics = {
      totalThreats,
      activeAlerts,
      connectedDevices: onlineDevices,
      threatTrend: parseFloat(threatTrend),
      systemHealth: onlineDevices > 0 && (onlineDevices / totalDevices) > 0.8 ? 'healthy' : 'warning',
      lastUpdated: new Date().toISOString(),
      metrics,
      trends: {
        daily: dailyTrends,
        weekly: weeklyTrends
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
    // 检查Alert模型是否可用
    if (!models.Alert) {
      logger.error('Alert模型不可用');
      return res.status(503).json({
        success: false,
        error: 'Database not initialized'
      });
    }

    const { range = '7d' } = req.query;
    
    // 根据时间范围确定数据点数量
    let dataPoints = 7;
    if (range === '30d') {
      dataPoints = 30;
    } else if (range === '90d') {
      dataPoints = 90;
    }

    // 生成日期标签
    const labels = [];
    for (let i = dataPoints - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      labels.push(date.toISOString().split('T')[0]);
    }

    // 定义威胁类型映射（与威胁分布API保持一致）
    const threatTypeMap = {
      // 恶意软件相关
      'malware-activity': { name: '恶意软件', color: '#ff6384', category: 'malware' },
      
      // 网络入侵相关
      'network-intrusion': { name: '网络入侵', color: '#36a2eb', category: 'network-intrusion' },
      'suspicious-connection': { name: '网络入侵', color: '#36a2eb', category: 'network-intrusion' },
      'connection-flood': { name: '网络入侵', color: '#36a2eb', category: 'network-intrusion' },
      'unknown-process-connection': { name: '网络入侵', color: '#36a2eb', category: 'network-intrusion' },
      
      // 可疑活动相关
      'suspicious-process': { name: '可疑活动', color: '#9966ff', category: 'suspicious-activity' },
      'dangerous-command': { name: '可疑活动', color: '#9966ff', category: 'suspicious-activity' },
      'high-cpu-process': { name: '可疑活动', color: '#9966ff', category: 'suspicious-activity' },
      'high-memory-usage': { name: '可疑活动', color: '#9966ff', category: 'suspicious-activity' },
      'high-cpu-usage': { name: '可疑活动', color: '#9966ff', category: 'suspicious-activity' },
      'high-temperature': { name: '可疑活动', color: '#9966ff', category: 'suspicious-activity' },
      
      // DDoS攻击
      'ddos-attack': { name: 'DDoS攻击', color: '#4bc0c0', category: 'ddos' },
      
      // 数据泄露
      'data-leak': { name: '数据泄露', color: '#ff9f40', category: 'data-leak' },
      
      // 认证异常
      'authentication-anomaly': { name: '认证异常', color: '#ffcd56', category: 'authentication-anomaly' }
    };

    // 定义威胁类型和颜色
    const threatCategories = [
      { category: 'malware', label: '恶意软件', borderColor: '#ff6384', backgroundColor: 'rgba(255, 99, 132, 0.1)' },
      { category: 'network-intrusion', label: '网络入侵', borderColor: '#36a2eb', backgroundColor: 'rgba(54, 162, 235, 0.1)' },
      { category: 'suspicious-activity', label: '可疑活动', borderColor: '#9966ff', backgroundColor: 'rgba(153, 102, 255, 0.1)' }
    ];

    // 为每种威胁类型生成时间序列数据
    const datasets = await Promise.all(threatCategories.map(async (threatCategory) => {
      const data = [];
      
      // 获取该分类下的所有具体类型
      const specificTypes = Object.keys(threatTypeMap).filter(key => 
        threatTypeMap[key].category === threatCategory.category
      );
      
      for (let i = dataPoints - 1; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
        
        const count = await models.Alert.count({
          where: {
            type: {
              [Op.in]: specificTypes
            },
            timestamp: {
              [Op.gte]: startOfDay,
              [Op.lt]: endOfDay
            }
          }
        });
        
        data.push(count);
      }
      
      return {
        label: threatCategory.label,
        data,
        borderColor: threatCategory.borderColor,
        backgroundColor: threatCategory.backgroundColor
      };
    }));

    const threatTrends = {
      labels,
      datasets
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
    // 检查Alert模型是否可用
    if (!models.Alert) {
      logger.error('Alert模型不可用');
      return res.status(503).json({
        success: false,
        error: 'Database not initialized'
      });
    }

    // 按类型统计告警数量
    const alertTypeStats = await models.Alert.findAll({
      attributes: [
        'type',
        [models.sequelize.fn('COUNT', models.sequelize.col('id')), 'count']
      ],
      group: ['type'],
      raw: true
    });

    // 定义威胁类型映射和颜色
    const threatTypeMap = {
      // 恶意软件相关
      'malware-activity': { name: '恶意软件', color: '#ff6384', category: 'malware' },
      
      // 网络入侵相关
      'network-intrusion': { name: '网络入侵', color: '#36a2eb', category: 'network-intrusion' },
      'suspicious-connection': { name: '网络入侵', color: '#36a2eb', category: 'network-intrusion' },
      'connection-flood': { name: '网络入侵', color: '#36a2eb', category: 'network-intrusion' },
      'unknown-process-connection': { name: '网络入侵', color: '#36a2eb', category: 'network-intrusion' },
      
      // 可疑活动相关
      'suspicious-process': { name: '可疑活动', color: '#9966ff', category: 'suspicious-activity' },
      'dangerous-command': { name: '可疑活动', color: '#9966ff', category: 'suspicious-activity' },
      'high-cpu-process': { name: '可疑活动', color: '#9966ff', category: 'suspicious-activity' },
      'high-memory-usage': { name: '可疑活动', color: '#9966ff', category: 'suspicious-activity' },
      'high-cpu-usage': { name: '可疑活动', color: '#9966ff', category: 'suspicious-activity' },
      'high-temperature': { name: '可疑活动', color: '#9966ff', category: 'suspicious-activity' },
      
      // DDoS攻击
      'ddos-attack': { name: 'DDoS攻击', color: '#4bc0c0', category: 'ddos' },
      
      // 数据泄露
      'data-leak': { name: '数据泄露', color: '#ff9f40', category: 'data-leak' },
      
      // 认证异常
      'authentication-anomaly': { name: '认证异常', color: '#ffcd56', category: 'authentication-anomaly' }
    };

    // 构建分类数据
    const categoryMap = new Map();
    let total = 0;

    alertTypeStats.forEach(stat => {
      const count = parseInt(stat.count);
      total += count;
      
      const threatType = threatTypeMap[stat.type];
      if (threatType) {
        const categoryName = threatType.name;
        if (categoryMap.has(categoryName)) {
          categoryMap.set(categoryName, categoryMap.get(categoryName) + count);
        } else {
          categoryMap.set(categoryName, count);
        }
      }
    });

    // 转换为数组格式
    const categories = Array.from(categoryMap.entries()).map(([name, value]) => {
      const threatType = Object.values(threatTypeMap).find(t => t.name === name);
      return {
        name,
        value,
        color: threatType ? threatType.color : '#e0e0e0'
      };
    });

    // 如果没有数据，返回默认结构
    if (categories.length === 0) {
      categories.push({
        name: '暂无威胁',
        value: 0,
        color: '#e0e0e0'
      });
    }

    const threatDistribution = {
      categories,
      total,
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
    // 检查Agent模型是否可用
    if (!models.Agent) {
      logger.error('Agent模型不可用');
      return res.status(503).json({
        success: false,
        error: 'Database not initialized'
      });
    }

    // 并行查询设备统计数据
    const [
      totalDevices,
      onlineDevices,
      offlineDevices,
      platformStats
    ] = await Promise.all([
      // 总设备数
      models.Agent.count(),
      
      // 在线设备数
      models.Agent.count({ where: { status: 'online' } }),
      
      // 离线设备数
      models.Agent.count({ where: { status: 'offline' } }),
      
      // 按平台统计设备数量
      models.Agent.findAll({
        attributes: [
          'platform',
          [models.sequelize.fn('COUNT', models.sequelize.col('id')), 'count']
        ],
        group: ['platform'],
        raw: true
      })
    ]);

    // 构建设备类型统计 - 与设备管理页面保持一致
    const deviceTypes = {
      windows: 0,
      linux: 0,
      macos: 0,
      openwrt: 0
    };

    platformStats.forEach(stat => {
      const count = parseInt(stat.count);
      const platform = stat.platform?.toLowerCase();
      if (deviceTypes.hasOwnProperty(platform)) {
        deviceTypes[platform] = count;
      }
    });

    // 计算保护状态（假设所有在线设备都是受保护的）
    const protectedDevices = onlineDevices;
    const unprotectedDevices = totalDevices - protectedDevices;

    const deviceStats = {
      totalDevices,
      onlineDevices,
      offlineDevices,
      protectedDevices,
      unprotectedDevices,
      deviceTypes,
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
 * 获取威胁IP统计
 * GET /api/dashboard/threat-ips
 */
router.get('/threat-ips', async (req, res) => {
  try {
    // 检查Alert模型是否可用
    if (!models.Alert) {
      logger.error('Alert模型不可用');
      return res.status(503).json({
        success: false,
        error: 'Database not initialized'
      });
    }

    // 统计威胁IP
    const threatIPStats = await models.Alert.findAll({
      attributes: [
        'sourceIP',
        'severity',
        [models.sequelize.fn('COUNT', models.sequelize.col('id')), 'count'],
        [models.sequelize.fn('MAX', models.sequelize.col('timestamp')), 'lastSeen']
      ],
      where: {
        sourceIP: {
          [Op.not]: null,
          [Op.ne]: ''
        }
      },
      group: ['sourceIP', 'severity'],
      order: [[models.sequelize.fn('COUNT', models.sequelize.col('id')), 'DESC']],
      limit: 20,
      raw: true
    });

    // 处理数据
    const threatIPs = threatIPStats.map(stat => ({
      ip: stat.sourceIP,
      count: parseInt(stat.count),
      severity: stat.severity,
      lastSeen: stat.lastSeen
    }));

    const totalThreatIPs = threatIPs.reduce((sum, item) => sum + item.count, 0);

    res.json({
      success: true,
      data: {
        threatIPs,
        totalThreatIPs,
        lastUpdated: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Error fetching threat IP stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch threat IP stats'
    });
  }
});

/**
 * 获取网络攻击统计
 * GET /api/dashboard/network-attacks
 */
router.get('/network-attacks', async (req, res) => {
  try {
    // 检查Alert模型是否可用
    if (!models.Alert) {
      logger.error('Alert模型不可用');
      return res.status(503).json({
        success: false,
        error: 'Database not initialized'
      });
    }

    // 定义网络攻击类型
    const networkAttackTypes = [
      'network-intrusion',
      'suspicious-connection',
      'connection-flood',
      'unknown-process-connection',
      'ddos-attack'
    ];

    // 统计网络攻击类型
    const attackTypeStats = await models.Alert.findAll({
      attributes: [
        'type',
        'severity',
        [models.sequelize.fn('COUNT', models.sequelize.col('id')), 'count'],
        [models.sequelize.fn('MAX', models.sequelize.col('timestamp')), 'lastOccurrence']
      ],
      where: {
        type: {
          [Op.in]: networkAttackTypes
        }
      },
      group: ['type', 'severity'],
      order: [[models.sequelize.fn('COUNT', models.sequelize.col('id')), 'DESC']],
      raw: true
    });

    // 处理数据
    const attackTypes = attackTypeStats.map(stat => ({
      type: stat.type,
      count: parseInt(stat.count),
      severity: stat.severity,
      lastOccurrence: stat.lastOccurrence
    }));

    const totalAttacks = attackTypes.reduce((sum, item) => sum + item.count, 0);

    res.json({
      success: true,
      data: {
        attackTypes,
        totalAttacks,
        lastUpdated: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Error fetching network attack stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch network attack stats'
    });
  }
});

/**
 * 获取可疑活动统计
 * GET /api/dashboard/suspicious-activities
 */
router.get('/suspicious-activities', async (req, res) => {
  try {
    // 检查Alert模型是否可用
    if (!models.Alert) {
      logger.error('Alert模型不可用');
      return res.status(503).json({
        success: false,
        error: 'Database not initialized'
      });
    }

    // 定义可疑活动类型
    const suspiciousActivityTypes = [
      'suspicious-process',
      'dangerous-command',
      'high-cpu-process',
      'high-memory-usage',
      'high-cpu-usage',
      'high-temperature'
    ];

    // 统计可疑活动类型
    const activityTypeStats = await models.Alert.findAll({
      attributes: [
        'type',
        'severity',
        [models.sequelize.fn('COUNT', models.sequelize.col('id')), 'count'],
        [models.sequelize.fn('MAX', models.sequelize.col('timestamp')), 'lastOccurrence']
      ],
      where: {
        type: {
          [Op.in]: suspiciousActivityTypes
        }
      },
      group: ['type', 'severity'],
      order: [[models.sequelize.fn('COUNT', models.sequelize.col('id')), 'DESC']],
      raw: true
    });

    // 处理数据
    const activityTypes = activityTypeStats.map(stat => ({
      type: stat.type,
      count: parseInt(stat.count),
      severity: stat.severity,
      lastOccurrence: stat.lastOccurrence
    }));

    const totalActivities = activityTypes.reduce((sum, item) => sum + item.count, 0);

    res.json({
      success: true,
      data: {
        activityTypes,
        totalActivities,
        lastUpdated: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Error fetching suspicious activity stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch suspicious activity stats'
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
