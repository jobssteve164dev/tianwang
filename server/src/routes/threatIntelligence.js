const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const logger = require('../utils/logger');
const threatConfigService = require('../services/ThreatIntelligenceConfigService');

router.get('/config', protect, authorize(['admin', 'super_admin']), async (_req, res) => {
  try {
    const config = await threatConfigService.load();
    res.json({ success: true, data: threatConfigService.publicConfig(config) });
  } catch (error) {
    logger.error('获取威胁情报配置失败', { error: error.message });
    res.status(error.message.includes('数据库不可用') ? 503 : 500).json({ success: false, message: error.message });
  }
});

router.put('/config', protect, authorize(['super_admin']), async (req, res) => {
  try {
    const config = await threatConfigService.save(req.body || {});
    res.json({ success: true, message: '威胁情报配置已保存', data: threatConfigService.publicConfig(config) });
  } catch (error) {
    logger.error('更新威胁情报配置失败', { error: error.message });
    const invalid = /不完整|必须使用/.test(error.message);
    res.status(invalid ? 400 : error.message.includes('数据库不可用') ? 503 : 500).json({ success: false, message: error.message });
  }
});

router.post('/test/:source', protect, authorize(['admin', 'super_admin']), async (req, res) => {
  try {
    const status = await threatConfigService.test(req.params.source);
    res.json({ success: true, message: `${req.params.source.toUpperCase()}连接测试成功`, data: status });
  } catch (error) {
    logger.warn('威胁情报连接测试失败', { source: req.params.source, error: error.message });
    const invalid = /不支持|尚未启用/.test(error.message);
    res.status(invalid ? 400 : 502).json({ success: false, message: error.message });
  }
});

router.get('/status', protect, authorize(['admin', 'super_admin']), async (_req, res) => {
  try {
    const config = await threatConfigService.load();
    res.json({ success: true, data: threatConfigService.publicConfig(config) });
  } catch (error) {
    logger.error('获取威胁情报状态失败', { error: error.message });
    res.status(error.message.includes('数据库不可用') ? 503 : 500).json({ success: false, message: error.message });
  }
});

module.exports = router;
