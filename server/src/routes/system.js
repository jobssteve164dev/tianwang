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

// 本地AI模型管理路由
router.get('/ai-models/status', authenticate, authorize(['admin', 'super_admin']), aiModelController.getLocalModelStatus);
router.get('/ai-models/:model_name/status', authenticate, authorize(['admin', 'super_admin']), aiModelController.getModelStatus);
router.post('/ai-models/train', authenticate, authorize(['super_admin']), aiModelController.trainModel);
router.get('/ai-models/training/:task_id/status', authenticate, authorize(['admin', 'super_admin']), aiModelController.getTrainingStatus);
router.post('/ai-models/test', authenticate, authorize(['admin', 'super_admin']), aiModelController.testModel);

// 训练数据管理路由
router.post('/ai-models/training-data', authenticate, authorize(['super_admin']), aiModelController.uploadTrainingData);
router.get('/ai-models/training-data', authenticate, authorize(['admin', 'super_admin']), aiModelController.getTrainingDataList);
router.get('/ai-models/training-data/:data_id', authenticate, authorize(['admin', 'super_admin']), aiModelController.getTrainingDataDetail);
router.delete('/ai-models/training-data/:data_id', authenticate, authorize(['super_admin']), aiModelController.deleteTrainingData);
router.get('/ai-models/training-data/export', authenticate, authorize(['admin', 'super_admin']), aiModelController.exportTrainingData);

// 性能监控路由
router.get('/ai-models/performance', authenticate, authorize(['admin', 'super_admin']), aiModelController.getModelPerformance);
router.get('/ai-models/performance/history', authenticate, authorize(['admin', 'super_admin']), aiModelController.getPerformanceHistory);
router.get('/ai-models/performance/overview', authenticate, authorize(['admin', 'super_admin']), aiModelController.getSystemPerformanceOverview);

module.exports = router; 