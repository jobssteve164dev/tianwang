/**
 * 告警路由
 * Alerts Routes
 */

const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const models = require('../models');
const { Op } = require('sequelize');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

async function accessibleAgentIds(req) {
  if (req.user?.isAgent) return [req.agentId];
  const agents = await models.Agent.findAll({
    where: { organization_id: req.organizationId },
    attributes: ['agent_id'],
    raw: true
  });
  return agents.map(agent => agent.agent_id);
}

async function findAccessibleAlert(req, id) {
  const Alert = models.Alert;
  return Alert.findOne({ where: { id, agent_id: { [Op.in]: await accessibleAgentIds(req) } } });
}

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
      agent_id
    } = req.query;

    // 构建查询条件
    const allowedAgents = await accessibleAgentIds(req);
    const query = { agent_id: { [Op.in]: allowedAgents } };
    
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
    
    if (agent_id) {
      if (!allowedAgents.includes(agent_id)) return res.status(403).json({ error: '无权访问此设备' });
      query.agent_id = agent_id;
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
          agent_id: alert.agent_id,
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

    const alert = await findAccessibleAlert(req, id);
    if (!alert) {
      return res.status(404).json({
        success: false,
        error: 'Alert not found'
      });
    }

    res.json({
      success: true,
      data: {
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
        agent_id: alert.agent_id,
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

    const alert = await findAccessibleAlert(req, id);
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
        id: alert.id,
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

    const alert = await findAccessibleAlert(req, id);
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
        id: alert.id,
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

    const alert = await findAccessibleAlert(req, id);
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
        id: alert.id,
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

    const alert = await findAccessibleAlert(req, id);
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
 * 获取告警统计信息
 * GET /api/alerts/stats/overview
 */
router.get('/stats/overview', async (req, res) => {
  try {
    const Alert = models.Alert;
    const allAlerts = await Alert.findAll({
      where: { agent_id: { [Op.in]: await accessibleAgentIds(req) } }
    });
    const alertStats = allAlerts.reduce((stats, alert) => {
      stats.total++;
      if (Object.prototype.hasOwnProperty.call(stats, alert.status)) stats[alert.status]++;
      if (Object.prototype.hasOwnProperty.call(stats, alert.severity)) stats[alert.severity]++;
      return stats;
    }, {
      total: 0,
      active: 0,
      resolved: 0,
      acknowledged: 0,
      critical: 0,
      high: 0,
      medium: 0,
      low: 0
    });

    // 计算平均解决时间
    const resolvedAlerts = allAlerts.filter(alert => alert.status === 'resolved');
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
