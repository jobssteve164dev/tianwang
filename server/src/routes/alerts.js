/**
 * 告警路由
 * Alerts Routes
 */

const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');

/**
 * 获取告警列表
 * GET /api/alerts
 */
router.get('/', async (req, res) => {
  try {
    const { 
      page = 1, 
      pageSize = 10, 
      status = 'all',
      severity = 'all',
      startDate,
      endDate 
    } = req.query;

    // 模拟告警数据
    const mockAlerts = [
      {
        id: 'alert-001',
        title: '检测到恶意软件活动',
        description: '在设备 192.168.1.100 上检测到可疑的恶意软件活动',
        severity: 'high',
        status: 'active',
        category: 'malware',
        source: '192.168.1.100',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        lastUpdated: new Date().toISOString(),
        assignedTo: 'security-team',
        tags: ['malware', 'endpoint']
      },
      {
        id: 'alert-002',
        title: '网络入侵尝试',
        description: '检测到来自外部IP的暴力破解尝试',
        severity: 'critical',
        status: 'active',
        category: 'intrusion',
        source: '203.45.67.89',
        timestamp: new Date(Date.now() - 7200000).toISOString(),
        lastUpdated: new Date().toISOString(),
        assignedTo: 'network-team',
        tags: ['intrusion', 'brute-force']
      },
      {
        id: 'alert-003',
        title: '异常登录活动',
        description: '检测到用户账户的异常登录模式',
        severity: 'medium',
        status: 'resolved',
        category: 'authentication',
        source: 'user:john.doe',
        timestamp: new Date(Date.now() - 86400000).toISOString(),
        lastUpdated: new Date(Date.now() - 3600000).toISOString(),
        assignedTo: 'security-team',
        tags: ['authentication', 'user-behavior']
      },
      {
        id: 'alert-004',
        title: 'DDoS攻击检测',
        description: '检测到针对Web服务器的DDoS攻击',
        severity: 'critical',
        status: 'active',
        category: 'ddos',
        source: 'multiple-ips',
        timestamp: new Date(Date.now() - 1800000).toISOString(),
        lastUpdated: new Date().toISOString(),
        assignedTo: 'network-team',
        tags: ['ddos', 'web-server']
      },
      {
        id: 'alert-005',
        title: '数据泄露风险',
        description: '检测到敏感数据的异常访问模式',
        severity: 'high',
        status: 'investigating',
        category: 'data-leak',
        source: 'internal-user',
        timestamp: new Date(Date.now() - 5400000).toISOString(),
        lastUpdated: new Date().toISOString(),
        assignedTo: 'data-protection-team',
        tags: ['data-leak', 'sensitive-data']
      }
    ];

    // 过滤告警
    let filteredAlerts = mockAlerts;

    // 按状态过滤
    if (status !== 'all') {
      filteredAlerts = filteredAlerts.filter(alert => alert.status === status);
    }

    // 按严重程度过滤
    if (severity !== 'all') {
      filteredAlerts = filteredAlerts.filter(alert => alert.severity === severity);
    }

    // 按日期范围过滤
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      filteredAlerts = filteredAlerts.filter(alert => {
        const alertDate = new Date(alert.timestamp);
        return alertDate >= start && alertDate <= end;
      });
    }

    // 分页
    const total = filteredAlerts.length;
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + parseInt(pageSize);
    const paginatedAlerts = filteredAlerts.slice(startIndex, endIndex);

    res.json({
      success: true,
      data: {
        alerts: paginatedAlerts,
        pagination: {
          page: parseInt(page),
          pageSize: parseInt(pageSize),
          total,
          totalPages: Math.ceil(total / pageSize)
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching alerts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch alerts'
    });
  }
});

/**
 * 获取单个告警详情
 * GET /api/alerts/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // 模拟告警详情
    const alertDetail = {
      id,
      title: '检测到恶意软件活动',
      description: '在设备 192.168.1.100 上检测到可疑的恶意软件活动',
      severity: 'high',
      status: 'active',
      category: 'malware',
      source: '192.168.1.100',
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      lastUpdated: new Date().toISOString(),
      assignedTo: 'security-team',
      tags: ['malware', 'endpoint'],
      details: {
        affectedFiles: ['/tmp/suspicious.exe', '/var/log/malware.log'],
        networkConnections: ['192.168.1.100:443', '10.0.0.1:80'],
        processInfo: {
          pid: 12345,
          command: './suspicious.exe',
          user: 'unknown'
        },
        indicators: [
          'Suspicious file creation',
          'Unusual network activity',
          'Registry modifications'
        ]
      },
      timeline: [
        {
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          event: 'Alert triggered',
          description: 'Malware detection rule matched'
        },
        {
          timestamp: new Date(Date.now() - 3500000).toISOString(),
          event: 'Investigation started',
          description: 'Security team assigned to investigate'
        },
        {
          timestamp: new Date(Date.now() - 3000000).toISOString(),
          event: 'Containment initiated',
          description: 'Affected device isolated from network'
        }
      ]
    };

    res.json({
      success: true,
      data: alertDetail
    });
  } catch (error) {
    logger.error('Error fetching alert detail:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch alert detail'
    });
  }
});

/**
 * 更新告警状态
 * PUT /api/alerts/:id
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, assignedTo, notes } = req.body;

    // 模拟更新告警
    const updatedAlert = {
      id,
      status: status || 'active',
      assignedTo: assignedTo || 'security-team',
      notes: notes || '',
      lastUpdated: new Date().toISOString()
    };

    res.json({
      success: true,
      data: updatedAlert,
      message: 'Alert updated successfully'
    });
  } catch (error) {
    logger.error('Error updating alert:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update alert'
    });
  }
});

/**
 * 获取告警统计信息
 * GET /api/alerts/stats/overview
 */
router.get('/stats/overview', async (req, res) => {
  try {
    const alertStats = {
      total: 234,
      active: 45,
      resolved: 156,
      investigating: 33,
      bySeverity: {
        critical: 12,
        high: 45,
        medium: 89,
        low: 88
      },
      byCategory: {
        malware: 67,
        intrusion: 45,
        authentication: 34,
        ddos: 23,
        dataLeak: 15,
        other: 50
      },
      averageResolutionTime: 4.5, // hours
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
