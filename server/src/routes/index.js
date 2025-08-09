/**
 * 主路由文件
 * Main Routes Entry Point
 */

const express = require('express');
const router = express.Router();

// 导入子路由
const authRoutes = require('./auth');
const userRoutes = require('./users');
const deviceRoutes = require('./devices');
const agentRoutes = require('./agents');
const securityRoutes = require('./security');
const systemRoutes = require('./system');

// API版本信息
router.get('/', (req, res) => {
  res.json({
    name: 'TianWang Security Monitoring System API',
    version: '1.0.0-alpha.1',
    description: 'AI-Powered Network Security Monitoring API',
    endpoints: {
      auth: '/api/auth',
      users: '/api/users',
      devices: '/api/devices',
      agents: '/api/agents',
      security: '/api/security',
      system: '/api/system'
    },
    documentation: '/api-docs',
    health: '/health'
  });
});

// 挂载子路由
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/devices', deviceRoutes);
router.use('/agents', agentRoutes);
router.use('/security', securityRoutes);
router.use('/system', systemRoutes);

module.exports = router; 