const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const agentController = require('../controllers/agentController');

// 注册码管理 - 仅限管理端访问
// 需要认证且需要管理员权限
router.post('/registration-codes', authenticate, authorize(['admin', 'super_admin']), agentController.generateRegistrationCode);
router.get('/registration-codes', authenticate, authorize(['admin', 'super_admin']), agentController.getRegistrationCodes);
router.get('/registration-codes/stats', authenticate, authorize(['admin', 'super_admin']), agentController.getRegistrationCodeStats);
router.delete('/registration-codes/:code', authenticate, authorize(['admin', 'super_admin']), agentController.disableRegistrationCode);
router.patch('/registration-codes/:code/extend', authenticate, authorize(['admin', 'super_admin']), agentController.extendRegistrationCode);

module.exports = router;
