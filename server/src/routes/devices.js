const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const logger = require('../utils/logger');

// GET /api/devices - 获取设备列表
router.get('/', authenticate, async (req, res) => {
  try {
    // 模拟设备数据
    const devices = [
      {
        id: '1',
        name: 'Web服务器-01',
        hostname: 'web-server-01',
        ip_address: '192.168.1.100',
        platform: 'linux',
        status: 'online',
        last_seen_at: new Date().toISOString(),
        agent_version: '1.0.0',
        capabilities: {
          log_collection: true,
          network_monitoring: true,
          process_monitoring: true
        }
      },
      {
        id: '2',
        name: '数据库服务器-01',
        hostname: 'db-server-01',
        ip_address: '192.168.1.101',
        platform: 'linux',
        status: 'online',
        last_seen_at: new Date().toISOString(),
        agent_version: '1.0.0',
        capabilities: {
          log_collection: true,
          network_monitoring: true,
          process_monitoring: true
        }
      },
      {
        id: '3',
        name: '开发工作站-01',
        hostname: 'dev-workstation-01',
        ip_address: '192.168.1.102',
        platform: 'windows',
        status: 'offline',
        last_seen_at: new Date(Date.now() - 3600000).toISOString(),
        agent_version: '1.0.0',
        capabilities: {
          log_collection: true,
          network_monitoring: true,
          process_monitoring: false
        }
      }
    ];

    res.json({
      success: true,
      data: devices,
      count: devices.length
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

// POST /api/devices - 添加设备
router.post('/', authenticate, async (req, res) => {
  try {
    const { name, hostname, ip_address, platform, description } = req.body;

    // 验证必需字段
    if (!name || !hostname || !ip_address || !platform) {
      return res.status(400).json({
        success: false,
        message: '缺少必需字段: name, hostname, ip_address, platform'
      });
    }

    // 模拟创建设备
    const newDevice = {
      id: Date.now().toString(),
      name,
      hostname,
      ip_address,
      platform,
      status: 'offline',
      last_seen_at: null,
      agent_version: null,
      capabilities: {
        log_collection: true,
        network_monitoring: true,
        process_monitoring: true
      },
      description,
      created_at: new Date().toISOString()
    };

    logger.info('设备创建成功:', { deviceId: newDevice.id, name: newDevice.name });

    res.status(201).json({
      success: true,
      message: '设备创建成功',
      data: newDevice
    });
  } catch (error) {
    logger.error('创建设备失败:', error);
    res.status(500).json({
      success: false,
      message: '创建设备失败',
      error: error.message
    });
  }
});

// GET /api/devices/:id - 获取设备详情
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    // 模拟设备详情数据
    const device = {
      id,
      name: `设备-${id}`,
      hostname: `host-${id}`,
      ip_address: `192.168.1.${100 + parseInt(id)}`,
      platform: 'linux',
      status: 'online',
      last_seen_at: new Date().toISOString(),
      agent_version: '1.0.0',
      capabilities: {
        log_collection: true,
        network_monitoring: true,
        process_monitoring: true
      },
      hardware_info: {
        cpu: 'Intel Xeon E5-2680',
        memory: '32GB',
        disk: '1TB SSD'
      },
      network_info: {
        interfaces: [
          { name: 'eth0', ip: '192.168.1.100', mac: '00:11:22:33:44:55' }
        ]
      }
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

// PUT /api/devices/:id - 更新设备
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    logger.info('设备更新成功:', { deviceId: id, updates: updateData });

    res.json({
      success: true,
      message: '设备更新成功',
      data: { id, ...updateData }
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

// DELETE /api/devices/:id - 删除设备
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    logger.info('设备删除成功:', { deviceId: id });

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

module.exports = router; 