const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const aiModelController = require('../controllers/aiModelController');
const fs = require('fs').promises;
const path = require('path');
const config = require('../config');
const models = require('../models');
const logger = require('../utils/logger');

function requireModel(model, res) {
  if (model) return true;
  res.status(503).json({ success: false, message: '系统数据库不可用' });
  return false;
}

// 系统配置路由
router.get('/config', authenticate, authorize(['admin', 'super_admin']), async (req, res) => {
  try {
    if (!requireModel(models.SystemConfig, res)) return;
    const where = req.query.category ? { category: req.query.category } : {};
    const entries = await models.SystemConfig.findAll({ where, order: [['category', 'ASC'], ['key', 'ASC']] });
    res.json({ success: true, entries });
  } catch (error) {
    logger.error('读取系统配置失败', { error: error.message });
    res.status(500).json({ success: false, message: '读取系统配置失败' });
  }
});

router.put('/config', authenticate, authorize(['super_admin']), async (req, res) => {
  try {
    if (!requireModel(models.SystemConfig, res)) return;
    const rawEntries = Array.isArray(req.body.entries)
      ? req.body.entries
      : Object.entries(req.body).map(([key, value]) => ({ key, value, category: 'general' }));
    if (rawEntries.length === 0 || rawEntries.some(entry => !entry.key || entry.value === undefined)) {
      return res.status(400).json({ success: false, message: '至少需要一个包含 key 和 value 的配置项' });
    }
    const entries = [];
    for (const entry of rawEntries) {
      const [saved] = await models.SystemConfig.upsert({
        key: entry.key,
        value: entry.value,
        category: entry.category || 'general',
        description: entry.description || null
      }, { returning: true });
      entries.push(saved);
    }
    res.json({ success: true, entries });
  } catch (error) {
    logger.error('更新系统配置失败', { error: error.message });
    res.status(500).json({ success: false, message: '更新系统配置失败' });
  }
});

router.get('/stats', authenticate, async (req, res) => {
  try {
    const required = [models.User, models.Agent, models.Alert, models.SecurityEvent];
    if (required.some(model => !model)) return res.status(503).json({ success: false, message: '系统数据库不可用' });
    const [users, agents, onlineAgents, alerts, activeAlerts, securityEvents] = await Promise.all([
      models.User.count(),
      models.Agent.count(),
      models.Agent.count({ where: { status: 'online' } }),
      models.Alert.count(),
      models.Alert.count({ where: { status: 'active' } }),
      models.SecurityEvent.count()
    ]);
    res.json({ success: true, stats: { users, agents, onlineAgents, alerts, activeAlerts, securityEvents } });
  } catch (error) {
    logger.error('读取系统统计失败', { error: error.message });
    res.status(500).json({ success: false, message: '读取系统统计失败' });
  }
});

router.get('/info', authenticate, (req, res) => {
  res.json({
    success: true,
    system: {
      name: config.app.name,
      version: config.app.version,
      environment: config.app.env,
      nodeVersion: process.version,
      uptimeSeconds: Math.floor(process.uptime())
    }
  });
});

router.get('/health', authenticate, async (req, res) => {
  const sequelize = models.sequelize;
  if (!sequelize) return res.status(503).json({ success: false, status: 'unhealthy', database: 'unavailable' });
  try {
    await sequelize.authenticate();
    res.json({ success: true, status: 'healthy', database: 'connected', timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(503).json({ success: false, status: 'unhealthy', database: 'disconnected', timestamp: new Date().toISOString() });
  }
});

router.get('/logs', authenticate, authorize(['admin', 'super_admin']), async (req, res) => {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const pageSize = Math.min(200, Math.max(1, Number.parseInt(req.query.pageSize, 10) || 50));
  const logPath = path.resolve(config.log.filePath);
  try {
    const content = await fs.readFile(logPath, 'utf8');
    let lines = content.split(/\r?\n/).filter(Boolean).reverse();
    if (req.query.level) lines = lines.filter(line => line.toLowerCase().includes(req.query.level.toLowerCase()));
    const total = lines.length;
    const logs = lines.slice((page - 1) * pageSize, page * pageSize);
    res.json({ success: true, logs, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } });
  } catch (error) {
    if (error.code === 'ENOENT') return res.json({ success: true, logs: [], pagination: { page, pageSize, total: 0, totalPages: 0 } });
    logger.error('读取系统日志失败', { error: error.message });
    res.status(500).json({ success: false, message: '读取系统日志失败' });
  }
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
router.get('/ai-models/training-data/export', authenticate, authorize(['admin', 'super_admin']), aiModelController.exportTrainingData);
router.get('/ai-models/training-data/:data_id', authenticate, authorize(['admin', 'super_admin']), aiModelController.getTrainingDataDetail);
router.delete('/ai-models/training-data/:data_id', authenticate, authorize(['super_admin']), aiModelController.deleteTrainingData);

// 资源管理路由
router.get('/ai-models/resources', authenticate, authorize(['admin', 'super_admin']), aiModelController.getResourceList);
router.post('/ai-models/resources/download', authenticate, authorize(['super_admin']), aiModelController.downloadResource);
router.delete('/ai-models/resources/:resource_id', authenticate, authorize(['super_admin']), aiModelController.deleteResource);

// 模型管理路由
router.get('/ai-models/loaded-models', authenticate, authorize(['admin', 'super_admin']), aiModelController.getLoadedModels);
router.post('/ai-models/toggle-model', authenticate, authorize(['super_admin']), aiModelController.toggleModel);
router.post('/ai-models/reload-model/:model_id', authenticate, authorize(['super_admin']), aiModelController.reloadModel);

// 性能监控路由
router.get('/ai-models/performance', authenticate, authorize(['admin', 'super_admin']), aiModelController.getModelPerformance);
router.get('/ai-models/performance/history', authenticate, authorize(['admin', 'super_admin']), aiModelController.getPerformanceHistory);
router.get('/ai-models/performance/overview', authenticate, authorize(['admin', 'super_admin']), aiModelController.getSystemPerformanceOverview);

module.exports = router;
