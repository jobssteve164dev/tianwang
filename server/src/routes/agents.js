const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { requireAgentAccess, requireUser } = require('../middleware/agentAccess');
const agentController = require('../controllers/agentController');

// 代理注册 (公开接口，不需要认证)
router.post('/register', agentController.registerAgent);

// 代理认证 (公开接口，不需要认证)
router.post('/auth', agentController.authenticateAgent);

// 安全状态 (需要认证)
router.get('/security-status', authenticate, requireUser, authorize(['admin', 'super_admin']), agentController.getSecurityStatus);

// 以下接口需要认证
router.use(authenticate);

// 获取代理列表
router.get('/', requireUser, agentController.getAgents);

// 获取代理详情
router.get('/:agent_id', requireAgentAccess, agentController.getAgent);

// 更新代理状态
router.patch('/:agent_id/status', requireUser, authorize(['admin', 'super_admin']), requireAgentAccess, agentController.updateAgentStatus);

// 删除代理
router.delete('/:agent_id', requireUser, authorize(['admin', 'super_admin']), requireAgentAccess, agentController.deleteAgent);

// 代理心跳
router.post('/:agent_id/heartbeat', requireAgentAccess, agentController.heartbeat);

// 接收代理数据
router.post('/:agent_id/data', requireAgentAccess, agentController.receiveData.bind(agentController));

module.exports = router;
