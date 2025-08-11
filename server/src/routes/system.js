const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const aiModelController = require('../controllers/aiModelController');

// 系统配置路由
router.get('/config', authenticate, authorize(['admin', 'super_admin']), (req, res) => {
  res.json({ message: 'Get system config - TODO: Implement' });
});

router.put('/config', authenticate, authorize(['super_admin']), (req, res) => {
  res.json({ message: 'Update system config - TODO: Implement' });
});

router.get('/stats', authenticate, (req, res) => {
  res.json({ message: 'Get system stats - TODO: Implement' });
});

// AI模型配置路由
router.get('/ai-model/config', authenticate, authorize(['admin', 'super_admin']), aiModelController.getConfig);
router.put('/ai-model/config', authenticate, authorize(['super_admin']), aiModelController.updateConfig);
router.get('/ai-model/usage-stats', authenticate, authorize(['admin', 'super_admin']), aiModelController.getUsageStats);
router.post('/ai-model/test-connection', authenticate, authorize(['admin', 'super_admin']), aiModelController.testConnection);

module.exports = router; 