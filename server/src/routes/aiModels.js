const express = require('express');
const router = express.Router();
const aiModelController = require('../controllers/aiModelController');
const auth = require('../middleware/auth');

// @route   GET api/ai-models/status
// @desc    Get local AI models status
// @access  Private
router.get(
  '/status',
  auth,
  (req, res, next) => {
    // #swagger.tags = ['AI Models']
    // #swagger.description = '获取所有本地AI模型的状态、性能指标和系统概览。'
    // #swagger.responses[200] = { description: '成功获取模型状态', schema: { $ref: '#/definitions/AIModelsStatusResponse' } }
    // #swagger.responses[500] = { description: '服务器错误' }
    next();
  },
  aiModelController.getAIModelsStatus
);

module.exports = router;
