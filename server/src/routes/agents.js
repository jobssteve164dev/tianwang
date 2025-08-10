const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const agentController = require('../controllers/agentController');

// 代理注册 (公开接口，不需要认证)
router.post('/register', agentController.registerAgent);

// 代理认证 (公开接口，不需要认证)
router.post('/auth', agentController.authenticateAgent);

// 注册码管理 (需要认证)
router.post('/registration-codes', authenticate, agentController.generateRegistrationCode);
router.get('/registration-codes', authenticate, agentController.getRegistrationCodes);
router.get('/registration-codes/stats', authenticate, agentController.getRegistrationCodeStats);
router.delete('/registration-codes/:code', authenticate, agentController.disableRegistrationCode);
router.patch('/registration-codes/:code/extend', authenticate, agentController.extendRegistrationCode);

// 安全状态 (需要认证)
router.get('/security-status', authenticate, agentController.getSecurityStatus);

// 以下接口需要认证
router.use(authenticate);

// 获取代理列表
router.get('/', agentController.getAgents);

// 获取代理详情
router.get('/:agentId', agentController.getAgent);

// 更新代理状态
router.patch('/:agentId/status', agentController.updateAgentStatus);

// 删除代理
router.delete('/:agentId', agentController.deleteAgent);

// 代理心跳
router.post('/:agentId/heartbeat', agentController.heartbeat);

// 接收代理数据
router.post('/:agentId/data', agentController.receiveData);

module.exports = router; 