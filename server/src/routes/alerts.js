/**
 * 告警路由
 * Alerts Routes
 */

const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const models = require('../models');
const { Op } = require('sequelize');

/**
 * 获取告警列表
 * GET /api/alerts
 */
router.get('/', async (req, res) => {
  try {
    // 检查Alert模型是否可用
    const Alert = models.Alert;
    logger.info(`Alert模型状态: ${Alert ? '已初始化' : '未初始化'}`);
    if (!Alert) {
      logger.error('Alert model is null - database may not be initialized');
      return res.status(500).json({
        success: false,
        error: 'Database not initialized'
      });
    }

    const { 
      page = 1, 
      pageSize = 20, 
      status,
      severity,
      type,
      search,
      startDate,
      endDate,
      deviceId,
      agentId
    } = req.query;

    // 构建查询条件
    const query = {};
    
    if (status && status !== 'all') {
      query.status = status;
    }
    
    if (severity && severity !== 'all') {
      query.severity = severity;
    }
    
    if (type && type !== 'all') {
      query.type = type;
    }
    
    if (deviceId) {
      query.deviceId = deviceId;
    }
    
    if (agentId) {
      query.agentId = agentId;
    }
    
    if (search) {
      query[Op.or] = [
        { title: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } },
        { source: { [Op.iLike]: `%${search}%` } }
      ];
    }
    
    if (startDate && endDate) {
      query.timestamp = {
        [Op.gte]: new Date(startDate),
        [Op.lte]: new Date(endDate)
      };
    }

    // 执行查询
    const offset = (parseInt(page) - 1) * parseInt(pageSize);
    const limit = parseInt(pageSize);
    
    const [alerts, total] = await Promise.all([
      Alert.findAll({
        where: query,
        order: [['timestamp', 'DESC']],
        offset,
        limit,
        raw: true
      }),
      Alert.count({ where: query })
    ]);

    res.json({
      success: true,
      data: {
        alerts: alerts.map(alert => ({
          id: alert.id,
          title: alert.title,
          description: alert.description,
          type: alert.type,
          severity: alert.severity,
          status: alert.status,
          source: alert.source,
          sourceIP: alert.sourceIP,
          targetIP: alert.targetIP,
          deviceId: alert.deviceId,
          agentId: alert.agentId,
          timestamp: alert.timestamp,
          lastUpdated: alert.lastUpdated,
          assignedTo: alert.assignedTo,
          tags: alert.tags,
          threatDetails: alert.threatDetails,
          autoResponse: alert.autoResponse
        })),
        pagination: {
          page: parseInt(page),
          pageSize: parseInt(pageSize),
          total,
          totalPages: Math.ceil(total / parseInt(pageSize))
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

    const alert = await Alert.findById(id);
    if (!alert) {
      return res.status(404).json({
        success: false,
        error: 'Alert not found'
      });
    }

    res.json({
      success: true,
      data: {
        id: alert._id,
        title: alert.title,
        description: alert.description,
        type: alert.type,
        severity: alert.severity,
        status: alert.status,
        source: alert.source,
        sourceIP: alert.sourceIP,
        targetIP: alert.targetIP,
        deviceId: alert.deviceId,
        agentId: alert.agentId,
        timestamp: alert.timestamp,
        lastUpdated: alert.lastUpdated,
        assignedTo: alert.assignedTo,
        tags: alert.tags,
        threatDetails: alert.threatDetails,
        evidence: alert.evidence,
        autoResponse: alert.autoResponse
      }
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

    const alert = await Alert.findById(id);
    if (!alert) {
      return res.status(404).json({
        success: false,
        error: 'Alert not found'
      });
    }

    // 更新告警
    if (status) alert.status = status;
    if (assignedTo) alert.assignedTo = assignedTo;
    if (notes) alert.notes = notes;
    alert.lastUpdated = new Date();

    await alert.save();

    res.json({
      success: true,
      data: {
        id: alert._id,
        status: alert.status,
        assignedTo: alert.assignedTo,
        notes: alert.notes,
        lastUpdated: alert.lastUpdated
      },
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
 * 更新告警状态
 * PATCH /api/alerts/:id/status
 */
router.patch('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const alert = await Alert.findById(id);
    if (!alert) {
      return res.status(404).json({
        success: false,
        error: 'Alert not found'
      });
    }

    alert.status = status;
    alert.lastUpdated = new Date();

    await alert.save();

    res.json({
      success: true,
      data: {
        id: alert._id,
        status: alert.status,
        lastUpdated: alert.lastUpdated
      },
      message: 'Alert status updated successfully'
    });
  } catch (error) {
    logger.error('Error updating alert status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update alert status'
    });
  }
});

/**
 * 确认告警
 * POST /api/alerts/:id/acknowledge
 */
router.post('/:id/acknowledge', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId = 'system' } = req.body;

    const alert = await Alert.findById(id);
    if (!alert) {
      return res.status(404).json({
        success: false,
        error: 'Alert not found'
      });
    }

    await alert.acknowledge(userId);

    res.json({
      success: true,
      data: {
        id: alert._id,
        status: alert.status,
        assignedTo: alert.assignedTo,
        lastUpdated: alert.lastUpdated
      },
      message: 'Alert acknowledged successfully'
    });
  } catch (error) {
    logger.error('Error acknowledging alert:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to acknowledge alert'
    });
  }
});

/**
 * 解决告警
 * POST /api/alerts/:id/resolve
 */
router.post('/:id/resolve', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId = 'system', notes } = req.body;

    const alert = await Alert.findByPk(id);
    if (!alert) {
      return res.status(404).json({
        success: false,
        error: 'Alert not found'
      });
    }

    await alert.resolve(userId, notes);

    res.json({
      success: true,
      data: {
        id: alert.id,
        status: alert.status,
        assignedTo: alert.assignedTo,
        notes: alert.notes,
        resolvedAt: alert.resolvedAt,
        lastUpdated: alert.lastUpdated
      },
      message: 'Alert resolved successfully'
    });
  } catch (error) {
    logger.error('Error resolving alert:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to resolve alert'
    });
  }
});

/**
 * 接收代理端威胁告警
 * POST /api/alerts/threat
 */
router.post('/threat', async (req, res) => {
  try {
    // 检查Alert模型是否可用
    const Alert = models.Alert;
    if (!Alert) {
      logger.error('Alert model is null - database may not be initialized');
      return res.status(500).json({
        success: false,
        error: 'Database not initialized'
      });
    }

    const {
      title,
      description,
      type,
      severity,
      source,
      sourceIP,
      sourcePort,
      targetIP,
      targetPort,
      deviceId,
      agentId,
      threatDetails,
      evidence
    } = req.body;

    // 验证必需字段
    if (!title || !description || !type || !severity || !source || !deviceId || !agentId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    // 创建新的告警
    const alert = await Alert.create({
      title,
      description,
      type,
      severity,
      source,
      sourceIP,
      sourcePort,
      targetIP,
      targetPort,
      deviceId,
      agentId,
      threatDetails,
      evidence,
      tags: [type, severity, 'agent-detected']
    });

    logger.info(`New threat alert created: ${alert.id} - ${title} from ${deviceId}`);

    // 通过WebSocket广播新告警
    if (req.app.locals.io) {
      req.app.locals.io.emit('new-alert', {
        id: alert.id,
        title: alert.title,
        severity: alert.severity,
        deviceId: alert.deviceId,
        timestamp: alert.timestamp
      });
    }

    res.json({
      success: true,
      data: {
        id: alert.id,
        message: 'Alert created successfully'
      }
    });
  } catch (error) {
    logger.error('Error creating threat alert:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create alert',
      details: error.message
    });
  }
});

/**
 * 获取告警统计信息
 * GET /api/alerts/stats/overview
 */
router.get('/stats/overview', async (req, res) => {
  try {
    const stats = await Alert.getAlertStats();
    const alertStats = stats[0] || {
      total: 0,
      active: 0,
      resolved: 0,
      acknowledged: 0,
      critical: 0,
      high: 0,
      medium: 0,
      low: 0
    };

    // 计算平均解决时间
    const resolvedAlerts = await Alert.find({ status: 'resolved' });
    let averageResolutionTime = 0;
    
    if (resolvedAlerts.length > 0) {
      const totalTime = resolvedAlerts.reduce((sum, alert) => {
        if (alert.resolvedAt && alert.timestamp) {
          return sum + (alert.resolvedAt.getTime() - alert.timestamp.getTime());
        }
        return sum;
      }, 0);
      averageResolutionTime = totalTime / resolvedAlerts.length / (1000 * 60 * 60); // 转换为小时
    }

    res.json({
      success: true,
      data: {
        ...alertStats,
        averageResolutionTime: Math.round(averageResolutionTime * 100) / 100,
        lastUpdated: new Date().toISOString()
      }
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
