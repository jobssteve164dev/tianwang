const models = require('../models');
const { logger } = require('../utils/logger');
const { encrypt, decrypt } = require('../utils/encryption');

/**
 * AI模型配置控制器
 * 处理外部AI模型的API密钥配置和使用量统计
 */
class AIModelController {
  /**
   * 获取AI模型配置
   */
  async getConfig(req, res) {
    try {
      console.log('🔍 开始获取AI模型配置...');
      
      // 确保数据库模型已初始化
      const { initializeModels } = models;
      const result = initializeModels();

      // 如果数据库被跳过，直接返回默认配置
      if (!result || !result.models) {
        console.log('⚠️  Skipping database initialization in development mode');
        // 返回默认配置
        return res.json({
          success: true,
          config: {
            openai: {
              enabled: false,
              api_key: '',
              default_model: 'gpt-3.5-turbo',
              models: ['gpt-4', 'gpt-3.5-turbo', 'gpt-4-turbo']
            },
            claude: {
              enabled: false,
              api_key: '',
              default_model: 'claude-3-haiku',
              models: ['claude-3-haiku', 'claude-3-sonnet', 'claude-3-opus']
            },
            openrouter: {
              enabled: false,
              api_key: '',
              default_model: 'openai/gpt-4',
              models: [
                'openai/gpt-4',
                'anthropic/claude-3-haiku',
                'google/gemini-pro',
                'meta-llama/llama-2-70b-chat',
                'mistralai/mixtral-8x7b-instruct'
              ]
            },
            deepseek: {
              enabled: false,
              api_key: '',
              default_model: 'deepseek-chat',
              models: ['deepseek-chat', 'deepseek-coder']
            }
          }
        });
      }

      const SystemConfig = models.SystemConfig;
      if (!SystemConfig) {
        throw new Error('SystemConfig model not initialized');
      }

      console.log('🔍 查询数据库中的AI模型配置...');
      const systemConfig = await SystemConfig.findOne({
        where: { key: 'ai_model_config' }
      });

      if (!systemConfig) {
        console.log('🔍 未找到配置，返回默认配置');
        // 返回默认配置
        return res.json({
          success: true,
          config: {
            openai: {
              enabled: false,
              api_key: '',
              default_model: 'gpt-3.5-turbo',
              models: ['gpt-4', 'gpt-3.5-turbo', 'gpt-4-turbo']
            },
            claude: {
              enabled: false,
              api_key: '',
              default_model: 'claude-3-haiku',
              models: ['claude-3-haiku', 'claude-3-sonnet', 'claude-3-opus']
            },
            openrouter: {
              enabled: false,
              api_key: '',
              default_model: 'openai/gpt-4',
              models: [
                'openai/gpt-4',
                'anthropic/claude-3-haiku',
                'google/gemini-pro',
                'meta-llama/llama-2-70b-chat',
                'mistralai/mixtral-8x7b-instruct'
              ]
            },
            deepseek: {
              enabled: false,
              api_key: '',
              default_model: 'deepseek-chat',
              models: ['deepseek-chat', 'deepseek-coder']
            }
          }
        });
      }

      console.log('🔍 找到配置，解密API密钥...');
      // 解密API密钥
      const decryptedConfig = this.decryptApiKeys(systemConfig.value);

      console.log('🔍 返回解密后的配置');
      res.json({
        success: true,
        config: decryptedConfig
      });

    } catch (error) {
      console.error('🔍 获取AI模型配置失败 - 详细错误:', error);
      console.error('🔍 错误堆栈:', error.stack);
      
      // 使用更安全的错误处理
      try {
        logger.error('获取AI模型配置失败:', {
          message: error.message,
          stack: error.stack,
          name: error.name
        });
      } catch (logError) {
        console.error('🔍 日志记录失败:', logError);
      }
      
      // 如果是数据库表不存在，返回默认配置
      if (error.message.includes('relation "system_configs" does not exist')) {
        console.log('🔍 数据库表不存在，返回默认配置');
        return res.json({
          success: true,
          config: {
            openai: {
              enabled: false,
              api_key: '',
              default_model: 'gpt-3.5-turbo',
              models: ['gpt-4', 'gpt-3.5-turbo', 'gpt-4-turbo']
            },
            claude: {
              enabled: false,
              api_key: '',
              default_model: 'claude-3-haiku',
              models: ['claude-3-haiku', 'claude-3-sonnet', 'claude-3-opus']
            },
            openrouter: {
              enabled: false,
              api_key: '',
              default_model: 'openai/gpt-4',
              models: [
                'openai/gpt-4',
                'anthropic/claude-3-haiku',
                'google/gemini-pro',
                'meta-llama/llama-2-70b-chat',
                'mistralai/mixtral-8x7b-instruct'
              ]
            },
            deepseek: {
              enabled: false,
              api_key: '',
              default_model: 'deepseek-chat',
              models: ['deepseek-chat', 'deepseek-coder']
            }
          }
        });
      }
      
      res.status(500).json({
        success: false,
        message: '获取配置失败',
        error: error.message
      });
    }
  }

  /**
   * 更新AI模型配置
   */
  async updateConfig(req, res) {
    try {
      const { config } = req.body;

      if (!config) {
        return res.status(400).json({
          success: false,
          message: '配置数据不能为空'
        });
      }

      // 加密API密钥
      const encryptedConfig = this.encryptApiKeys(config);

      // 保存或更新配置
      const SystemConfig = models.SystemConfig;
      if (!SystemConfig) {
        throw new Error('SystemConfig model not initialized');
      }
      
      const [systemConfig, created] = await SystemConfig.findOrCreate({
        where: { key: 'ai_model_config' },
        defaults: {
          key: 'ai_model_config',
          value: encryptedConfig,
          category: 'ai_model',
          description: 'AI模型配置'
        }
      });

      if (!created) {
        await systemConfig.update({
          value: encryptedConfig
        });
      }

      // 同步更新AI引擎配置
      await this.syncToAIEngine(encryptedConfig);

      res.json({
        success: true,
        message: '配置更新成功'
      });

    } catch (error) {
      logger.error('更新AI模型配置失败:', error);
      res.status(500).json({
        success: false,
        message: '更新配置失败'
      });
    }
  }

  /**
   * 获取API使用量统计
   */
  async getUsageStats(req, res) {
    try {
      // 从AI引擎获取API状态统计
      const aiEngineUrl = process.env.AI_ENGINE_URL || 'http://localhost:8888';
      
      const response = await fetch(`${aiEngineUrl}/api/api-status?detailed=true`);
      
      if (!response.ok) {
        // 如果AI引擎不可用，返回默认统计
        logger.warn(`AI引擎响应错误: ${response.status}，返回默认统计`);
        const defaultStats = {
          total_requests: 0,
          total_cost: 0,
          daily_cost: 0,
          monthly_cost: 0,
          providers: {
            openai: { status: 'unavailable', request_count: 0, failure_count: 0, daily_cost: 0, monthly_cost: 0 },
            claude: { status: 'unavailable', request_count: 0, failure_count: 0, daily_cost: 0, monthly_cost: 0 },
            openrouter: { status: 'unavailable', request_count: 0, failure_count: 0, daily_cost: 0, monthly_cost: 0 },
            deepseek: { status: 'unavailable', request_count: 0, failure_count: 0, daily_cost: 0, monthly_cost: 0 }
          }
        };
        
        return res.json({
          success: true,
          stats: defaultStats
        });
      }

      let data;
      try {
        data = await response.json();
      } catch (parseError) {
        logger.error('解析AI引擎响应失败:', parseError);
        throw new Error('AI引擎响应格式错误');
      }
      
      if (!data || !data.success) {
        throw new Error('AI引擎返回错误');
      }

      const externalApis = data.status?.external_apis || {};
      
      // 如果external_apis为空，返回默认统计
      if (!externalApis || Object.keys(externalApis).length === 0) {
        logger.warn('AI引擎返回的external_apis为空，返回默认统计');
        const defaultStats = {
          total_requests: 0,
          total_cost: 0,
          daily_cost: 0,
          monthly_cost: 0,
          providers: {
            openai: { status: 'unavailable', request_count: 0, failure_count: 0, daily_cost: 0, monthly_cost: 0 },
            claude: { status: 'unavailable', request_count: 0, failure_count: 0, daily_cost: 0, monthly_cost: 0 },
            openrouter: { status: 'unavailable', request_count: 0, failure_count: 0, daily_cost: 0, monthly_cost: 0 },
            deepseek: { status: 'unavailable', request_count: 0, failure_count: 0, daily_cost: 0, monthly_cost: 0 }
          }
        };
        
        return res.json({
          success: true,
          stats: defaultStats
        });
      }
      
      // 格式化统计数据
      const stats = {
        total_requests: 0,
        total_cost: 0,
        daily_cost: 0,
        monthly_cost: 0,
        providers: {}
      };

      // 处理各提供商的统计
      Object.entries(externalApis).forEach(([provider, providerData]) => {
        if (provider === 'api_status' || provider === 'failure_counts' || provider === 'request_counts' || provider === 'cost_tracking') {
          return;
        }

        const requestCount = externalApis.request_counts?.[provider] || 0;
        const costData = externalApis.cost_tracking || {};
        
        stats.total_requests += requestCount;
        stats.total_cost += costData.daily_cost || 0;
        stats.daily_cost = costData.daily_cost || 0;
        stats.monthly_cost = costData.monthly_cost || 0;

        stats.providers[provider] = {
          status: externalApis.api_status?.[provider] || 'unknown',
          request_count: requestCount,
          failure_count: externalApis.failure_counts?.[provider] || 0,
          daily_cost: costData.daily_cost || 0,
          monthly_cost: costData.monthly_cost || 0
        };
      });

      res.json({
        success: true,
        stats
      });

    } catch (error) {
      logger.error('获取API使用量统计失败:', error);
      res.status(500).json({
        success: false,
        message: '获取统计信息失败',
        error: error.message
      });
    }
  }

  /**
   * 测试API连接
   */
  async testConnection(req, res) {
    try {
      const { provider, api_key, model } = req.body;

      if (!provider || !api_key) {
        return res.status(400).json({
          success: false,
          message: '提供商和API密钥不能为空'
        });
      }

      // 调用AI引擎的测试接口
      const aiEngineUrl = process.env.AI_ENGINE_URL || 'http://localhost:8888';
      
      const response = await fetch(`${aiEngineUrl}/llm-analysis`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content: 'Hello, this is a test message.',
          analysis_type: 'test',
          preferred_provider: provider,
          use_cache: false
        })
      });

      if (!response.ok) {
        throw new Error(`AI引擎响应错误: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        res.json({
          success: true,
          message: 'API连接测试成功',
          provider: data.results.provider,
          model: data.results.model
        });
      } else {
        res.json({
          success: false,
          message: 'API连接测试失败',
          error: data.results.error
        });
      }

    } catch (error) {
      logger.error('API连接测试失败:', error);
      res.status(500).json({
        success: false,
        message: '连接测试失败',
        error: error.message
      });
    }
  }

  /**
   * 加密API密钥
   */
  encryptApiKeys(config) {
    const encryptedConfig = { ...config };
    
    Object.keys(encryptedConfig).forEach(provider => {
      if (encryptedConfig[provider] && encryptedConfig[provider].api_key) {
        encryptedConfig[provider].api_key = encrypt(encryptedConfig[provider].api_key);
      }
    });

    return encryptedConfig;
  }

  /**
   * 解密API密钥
   */
  decryptApiKeys(config) {
    const decryptedConfig = { ...config };
    
    Object.keys(decryptedConfig).forEach(provider => {
      if (decryptedConfig[provider] && decryptedConfig[provider].api_key) {
        try {
          decryptedConfig[provider].api_key = decrypt(decryptedConfig[provider].api_key);
        } catch (error) {
          logger.warn(`解密${provider} API密钥失败:`, error);
          decryptedConfig[provider].api_key = '';
        }
      }
    });

    return decryptedConfig;
  }

  /**
   * 同步配置到AI引擎
   */
  async syncToAIEngine(config) {
    try {
      const aiEngineUrl = process.env.AI_ENGINE_URL || 'http://localhost:8888';
      
      // 这里可以调用AI引擎的配置更新接口
      // 目前AI引擎通过环境变量读取配置，所以这里只是记录日志
      logger.info('AI模型配置已更新，需要重启AI引擎以应用新配置');
      
    } catch (error) {
      logger.error('同步配置到AI引擎失败:', error);
    }
  }
}

module.exports = new AIModelController();
