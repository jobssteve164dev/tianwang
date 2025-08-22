const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const logger = require('../utils/logger');
const models = require('../models');

// GET /api/devices - 获取设备列表
router.get('/', authenticate, async (req, res) => {
  try {
    const { page = 1, limit = 20, status, platform, search } = req.query;
    
    // 构建查询条件
    const whereClause = {};
    
    // 状态过滤
    if (status && status !== 'all') {
      whereClause.status = status;
    }
    
    // 平台过滤
    if (platform && platform !== 'all') {
      whereClause.platform = platform;
    }
    
    // 搜索过滤
    if (search) {
      whereClause[models.Sequelize.Op.or] = [
        { name: { [models.Sequelize.Op.iLike]: `%${search}%` } },
        { hostname: { [models.Sequelize.Op.iLike]: `%${search}%` } },
        { agent_id: { [models.Sequelize.Op.iLike]: `%${search}%` } }
      ];
    }
    
    // 组织过滤
    if (req.user?.organization_id) {
      whereClause.organization_id = req.user.organization_id;
    }

    // 检查Agent模型是否可用
    if (!models.Agent) {
      logger.error('Agent模型不可用');
      return res.status(503).json({
        success: false,
        message: '数据库服务不可用',
        error: 'DB_UNAVAILABLE'
      });
    }

    // 查询代理数据
    const agents = await models.Agent.findAll({
      where: whereClause,
      order: [['last_seen', 'DESC']],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
      attributes: [
        'id', 'agent_id', 'name', 'hostname', 'platform', 'arch', 'version',
        'status', 'last_seen', 'registered_at', 'capabilities', 'system_info'
      ]
    });

    // 获取总数
    const total = await models.Agent.count({ where: whereClause });

    // 转换为设备格式
    const devices = agents.map(agent => ({
      id: agent.id,
      name: agent.name || agent.hostname,
      hostname: agent.hostname,
      ip_address: agent.system_info?.networkInterfaces?.[0]?.ip || 'N/A',
      mac_address: agent.system_info?.networkInterfaces?.[0]?.mac || 'N/A',
      platform: agent.platform,
      type: agent.platform, // 兼容前端
      status: agent.status,
      last_seen_at: agent.last_seen,
      last_seen: agent.last_seen, // 兼容前端
      agent_version: agent.version,
      version: agent.version, // 兼容前端
      capabilities: agent.capabilities || {},
      os: agent.system_info?.os ? 
        (typeof agent.system_info.os === 'object' ? 
          `${agent.system_info.os.distro || ''} ${agent.system_info.os.release || ''}`.trim() || agent.system_info.os.platform || agent.platform :
          agent.system_info.os) : 
        agent.platform,
      architecture: agent.arch,
      registered_at: agent.registered_at
    }));

    res.json({
      success: true,
      data: devices,
      count: total,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error('获取设备列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取设备列表失败',
      error: error.message
    });
  }
});

// GET /api/devices/:id - 获取设备详情
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    // 检查Agent模型是否可用
    if (!models.Agent) {
      logger.error('Agent模型不可用');
      return res.status(503).json({
        success: false,
        message: '数据库服务不可用',
        error: 'DB_UNAVAILABLE'
      });
    }

    const agent = await models.Agent.findByPk(id);
    if (!agent) {
      return res.status(404).json({
        success: false,
        message: '设备不存在'
      });
    }

    // 转换为设备详情格式
    const device = {
      id: agent.id,
      name: agent.name || agent.hostname,
      hostname: agent.hostname,
      ip_address: agent.system_info?.networkInterfaces?.[0]?.ip || 'N/A',
      mac_address: agent.system_info?.networkInterfaces?.[0]?.mac || 'N/A',
      platform: agent.platform,
      type: agent.platform,
      status: agent.status,
      last_seen_at: agent.last_seen,
      last_seen: agent.last_seen,
      agent_version: agent.version,
      version: agent.version,
      capabilities: agent.capabilities || {},
      os: agent.system_info?.os ? 
        (typeof agent.system_info.os === 'object' ? 
          `${agent.system_info.os.distro || ''} ${agent.system_info.os.release || ''}`.trim() || agent.system_info.os.platform || agent.platform :
          agent.system_info.os) : 
        agent.platform,
      architecture: agent.arch,
      registered_at: agent.registered_at,
      hardware_info: {
        cpu: agent.system_info?.cpu || {},
        memory: agent.system_info?.memory || {},
        disk: agent.system_info?.diskInfo || []
      },
      network_info: {
        interfaces: agent.system_info?.networkInterfaces || []
      },
      system_info: agent.system_info || {}
    };

    res.json({
      success: true,
      data: device
    });
  } catch (error) {
    logger.error('获取设备详情失败:', error);
    res.status(500).json({
      success: false,
      message: '获取设备详情失败',
      error: error.message
    });
  }
});

// DELETE /api/devices/:id - 删除设备
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    // 检查Agent模型是否可用
    if (!models.Agent) {
      logger.error('Agent模型不可用');
      return res.status(503).json({
        success: false,
        message: '数据库服务不可用',
        error: 'DB_UNAVAILABLE'
      });
    }

    const agent = await models.Agent.findByPk(id);
    if (!agent) {
      return res.status(404).json({
        success: false,
        message: '设备不存在'
      });
    }

    // 删除代理
    await agent.destroy();

    logger.info('设备删除成功:', { agent_id: agent.agent_id, hostname: agent.hostname });

    res.json({
      success: true,
      message: '设备删除成功'
    });
  } catch (error) {
    logger.error('删除设备失败:', error);
    res.status(500).json({
      success: false,
      message: '删除设备失败',
      error: error.message
    });
  }
});

// PUT /api/devices/:id - 更新设备
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, status } = req.body;

    // 检查Agent模型是否可用
    if (!models.Agent) {
      logger.error('Agent模型不可用');
      return res.status(503).json({
        success: false,
        message: '数据库服务不可用',
        error: 'DB_UNAVAILABLE'
      });
    }

    const agent = await models.Agent.findByPk(id);
    if (!agent) {
      return res.status(404).json({
        success: false,
        message: '设备不存在'
      });
    }

    // 更新设备信息
    if (name) {
      agent.name = name;
    }
    
    if (status && ['online', 'offline', 'error'].includes(status)) {
      agent.status = status;
    }

    await agent.save();

    logger.info('设备更新成功:', { agent_id: agent.agent_id, hostname: agent.hostname });

    res.json({
      success: true,
      message: '设备更新成功',
      data: {
        id: agent.id,
        name: agent.name,
        hostname: agent.hostname,
        status: agent.status
      }
    });
  } catch (error) {
    logger.error('更新设备失败:', error);
    res.status(500).json({
      success: false,
      message: '更新设备失败',
      error: error.message
    });
  }
});

// GET /api/devices/stats - 获取设备统计信息
router.get('/stats/overview', authenticate, async (req, res) => {
  try {
    // 检查Agent模型是否可用
    if (!models.Agent) {
      logger.error('Agent模型不可用');
      return res.status(503).json({
        success: false,
        message: '数据库服务不可用',
        error: 'DB_UNAVAILABLE'
      });
    }

    const whereClause = {};
    if (req.user?.organization_id) {
      whereClause.organization_id = req.user.organization_id;
    }

    // 获取各种状态的设备数量
    const total = await models.Agent.count({ where: whereClause });
    const online = await models.Agent.count({ 
      where: { ...whereClause, status: 'online' } 
    });
    const offline = await models.Agent.count({ 
      where: { ...whereClause, status: 'offline' } 
    });
    const error = await models.Agent.count({ 
      where: { ...whereClause, status: 'error' } 
    });

    // 按平台统计 - 修复Sequelize引用
    const { Sequelize } = require('sequelize');
    const platformStats = await models.Agent.findAll({
      where: whereClause,
      attributes: [
        'platform',
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']
      ],
      group: ['platform']
    });

    // 最近注册的设备
    const recentDevices = await models.Agent.findAll({
      where: whereClause,
      order: [['registered_at', 'DESC']],
      limit: 5,
      attributes: ['id', 'name', 'hostname', 'platform', 'status', 'registered_at']
    });

    res.json({
      success: true,
      data: {
        overview: {
          total,
          online,
          offline,
          error,
          onlineRate: total > 0 ? Math.round((online / total) * 100) : 0
        },
        platformStats: platformStats.map(stat => ({
          platform: stat.platform,
          count: parseInt(stat.dataValues.count)
        })),
        recentDevices: recentDevices.map(device => ({
          id: device.id,
          name: device.name || device.hostname,
          hostname: device.hostname,
          platform: device.platform,
          status: device.status,
          registered_at: device.registered_at
        }))
      }
    });
  } catch (error) {
    logger.error('获取设备统计失败:', error);
    res.status(500).json({
      success: false,
      message: '获取设备统计失败',
      error: error.message
    });
  }
});

module.exports = router; 