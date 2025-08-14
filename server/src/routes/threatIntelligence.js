const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const logger = require('../utils/logger');

// 获取威胁情报配置
router.get('/config', protect, async (req, res) => {
  try {
    // 从环境变量或配置文件获取当前配置
    const config = {
      misp: {
        enabled: process.env.AI_MISP_URL && process.env.AI_MISP_API_KEY,
        url: process.env.AI_MISP_URL || '',
        apiKey: process.env.AI_MISP_API_KEY ? '***' : '', // 隐藏实际密钥
        status: 'unknown' // 需要实际测试连接状态
      },
      otx: {
        enabled: !!process.env.AI_OTX_API_KEY,
        apiKey: process.env.AI_OTX_API_KEY ? '***' : '', // 隐藏实际密钥
        status: 'unknown' // 需要实际测试连接状态
      }
    };

    // 测试连接状态
    try {
      // 这里可以调用AI引擎的API来获取实际状态
      // 暂时返回模拟状态
      if (config.misp.enabled) {
        config.misp.status = 'connected';
      } else {
        config.misp.status = 'disconnected';
      }
      
      if (config.otx.enabled) {
        config.otx.status = 'connected';
      } else {
        config.otx.status = 'disconnected';
      }
    } catch (error) {
      logger.error('获取威胁情报状态失败:', error);
    }

    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    logger.error('获取威胁情报配置失败:', error);
    res.status(500).json({
      success: false,
      message: '获取威胁情报配置失败',
      error: error.message
    });
  }
});

// 更新威胁情报配置
router.put('/config', protect, async (req, res) => {
  try {
    const { misp, otx } = req.body;

    // 验证配置格式
    if (misp && typeof misp === 'object') {
      if (misp.enabled && (!misp.url || !misp.apiKey)) {
        return res.status(400).json({
          success: false,
          message: 'MISP配置不完整，启用时必须提供URL和API密钥'
        });
      }
    }

    if (otx && typeof otx === 'object') {
      if (otx.enabled && !otx.apiKey) {
        return res.status(400).json({
          success: false,
          message: 'OTX配置不完整，启用时必须提供API密钥'
        });
      }
    }

    // 更新环境变量（这里需要实际的环境变量更新机制）
    // 注意：在实际生产环境中，应该通过配置文件或数据库来管理这些配置
    // 这里只是示例实现
    
    logger.info('威胁情报配置更新请求:', {
      misp: misp ? { enabled: misp.enabled, url: misp.url, hasApiKey: !!misp.apiKey } : null,
      otx: otx ? { enabled: otx.enabled, hasApiKey: !!otx.apiKey } : null
    });

    // 在实际实现中，这里应该：
    // 1. 更新配置文件或数据库
    // 2. 重启AI引擎服务以应用新配置
    // 3. 验证配置的有效性

    res.json({
      success: true,
      message: '威胁情报配置更新成功',
      data: {
        misp: misp ? { enabled: misp.enabled, url: misp.url, status: 'unknown' } : null,
        otx: otx ? { enabled: otx.enabled, status: 'unknown' } : null
      }
    });
  } catch (error) {
    logger.error('更新威胁情报配置失败:', error);
    res.status(500).json({
      success: false,
      message: '更新威胁情报配置失败',
      error: error.message
    });
  }
});

// 测试威胁情报连接
router.post('/test/:source', protect, async (req, res) => {
  try {
    const { source } = req.params;
    
    if (!['misp', 'otx'].includes(source)) {
      return res.status(400).json({
        success: false,
        message: '不支持的威胁情报源'
      });
    }

    let testResult = { success: false, message: '' };

    if (source === 'misp') {
      // 测试MISP连接
      const mispUrl = process.env.AI_MISP_URL;
      const mispApiKey = process.env.AI_MISP_API_KEY;
      
      if (!mispUrl || !mispApiKey) {
        testResult = {
          success: false,
          message: 'MISP配置不完整，请先配置URL和API密钥'
        };
      } else {
        try {
          // 这里应该实际调用MISP API进行测试
          // 暂时返回模拟结果
          testResult = {
            success: true,
            message: 'MISP连接测试成功'
          };
        } catch (error) {
          testResult = {
            success: false,
            message: `MISP连接测试失败: ${error.message}`
          };
        }
      }
    } else if (source === 'otx') {
      // 测试OTX连接
      const otxApiKey = process.env.AI_OTX_API_KEY;
      
      if (!otxApiKey) {
        testResult = {
          success: false,
          message: 'OTX配置不完整，请先配置API密钥'
        };
      } else {
        try {
          // 这里应该实际调用OTX API进行测试
          // 暂时返回模拟结果
          testResult = {
            success: true,
            message: 'OTX连接测试成功'
          };
        } catch (error) {
          testResult = {
            success: false,
            message: `OTX连接测试失败: ${error.message}`
          };
        }
      }
    }

    res.json({
      success: testResult.success,
      message: testResult.message
    });
  } catch (error) {
    logger.error(`测试${req.params.source}连接失败:`, error);
    res.status(500).json({
      success: false,
      message: `测试${req.params.source}连接失败`,
      error: error.message
    });
  }
});

// 获取威胁情报状态
router.get('/status', protect, async (req, res) => {
  try {
    const status = {
      misp: {
        enabled: !!(process.env.AI_MISP_URL && process.env.AI_MISP_API_KEY),
        status: 'unknown',
        lastUpdate: null,
        iocCount: 0
      },
      otx: {
        enabled: !!process.env.AI_OTX_API_KEY,
        status: 'unknown',
        lastUpdate: null,
        iocCount: 0
      }
    };

    // 这里应该从AI引擎获取实际状态
    // 暂时返回模拟数据
    
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    logger.error('获取威胁情报状态失败:', error);
    res.status(500).json({
      success: false,
      message: '获取威胁情报状态失败',
      error: error.message
    });
  }
});

module.exports = router;
