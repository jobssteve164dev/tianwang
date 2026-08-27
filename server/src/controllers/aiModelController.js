const models = require('../models');
const logger = require('../utils/logger');
const { encrypt, decrypt } = require('../utils/encryption');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const crypto = require('crypto');
const appConfig = require('../config');

const trainingDataDir = path.resolve(__dirname, '../../data/training');
const defaultProviderConfig = {
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
};

function trainingDataPath(dataId) {
  if (!/^data_[a-f0-9]{32}$/.test(dataId)) throw new Error('训练数据ID无效');
  return path.join(trainingDataDir, `${dataId}.json`);
}

async function readTrainingRecords() {
  await fs.promises.mkdir(trainingDataDir, { recursive: true });
  const files = (await fs.promises.readdir(trainingDataDir)).filter(file => /^data_[a-f0-9]{32}\.json$/.test(file));
  return Promise.all(files.map(async file => JSON.parse(await fs.promises.readFile(path.join(trainingDataDir, file), 'utf8'))));
}

/**
 * AI模型配置控制器
 * 处理外部AI模型的API密钥配置和使用量统计
 */
class AIModelController {
  constructor() {
    for (const methodName of Object.getOwnPropertyNames(AIModelController.prototype)) {
      if (methodName !== 'constructor' && typeof this[methodName] === 'function') {
        this[methodName] = this[methodName].bind(this);
      }
    }
  }

  /**
   * 获取AI模型配置
   */
  async getConfig(req, res) {
    try {
      const SystemConfig = models.SystemConfig;
      if (!SystemConfig) {
        throw new Error('SystemConfig model not initialized');
      }

      const systemConfig = await SystemConfig.findOne({
        where: { key: 'ai_model_config' }
      });

      if (!systemConfig) {
        return res.json({
          success: true,
          config: this.maskApiKeys(defaultProviderConfig)
        });
      }

      const decryptedConfig = this.decryptApiKeys(systemConfig.value);

      res.json({
        success: true,
        config: this.maskApiKeys(decryptedConfig)
      });

    } catch (error) {
      logger.error('获取AI模型配置失败:', error);
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

      // 保存或更新配置
      const SystemConfig = models.SystemConfig;
      if (!SystemConfig) {
        throw new Error('SystemConfig model not initialized');
      }
      
      const existingRecord = await SystemConfig.findOne({ where: { key: 'ai_model_config' } });
      const existingConfig = existingRecord ? this.decryptApiKeys(existingRecord.value) : {};
      const mergedConfig = this.mergeProviderConfig(config, existingConfig);

      await this.syncToAIEngine(mergedConfig);
      const encryptedConfig = this.encryptApiKeys(mergedConfig);

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
        return res.status(503).json({ success: false, message: 'AI引擎不可用' });
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
      
      // 格式化统计数据
      const stats = {
        total_requests: 0,
        total_cost: 0,
        daily_cost: 0,
        monthly_cost: 0,
        providers: {}
      };

      const statusMap = externalApis.api_status || {};
      Object.keys(statusMap).forEach(provider => {
        const requestCount = externalApis.request_counts?.[provider] || 0;
        const costData = externalApis.cost_tracking || {};
        
        stats.total_requests += requestCount;
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
      stats.total_cost = stats.monthly_cost;

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
      
      const response = await fetch(`${aiEngineUrl}/api/external-apis/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Token': process.env.AI_INTERNAL_TOKEN || 'tianwang-local-ai-internal'
        },
        body: JSON.stringify({
          provider,
          api_key,
          model
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
          provider: data.provider,
          model: data.model
        });
      } else {
        res.json({
          success: false,
          message: 'API连接测试失败',
          error: data.results?.error || '未知错误'
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
    const encryptedConfig = Object.fromEntries(Object.entries(config).map(([provider, providerConfig]) => [
      provider,
      { ...providerConfig }
    ]));
    
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
    const decryptedConfig = Object.fromEntries(Object.entries(config).map(([provider, providerConfig]) => [
      provider,
      { ...providerConfig }
    ]));
    
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

  maskApiKeys(config) {
    return Object.fromEntries(Object.entries(config).map(([provider, providerConfig]) => [provider, {
      ...providerConfig,
      api_key: '',
      has_api_key: !!providerConfig?.api_key
    }]));
  }

  mergeProviderConfig(incoming, existing) {
    const providers = new Set([...Object.keys(existing), ...Object.keys(incoming)]);
    return Object.fromEntries([...providers].map(provider => [provider, {
      ...(existing[provider] || {}),
      ...(incoming[provider] || {}),
      api_key: incoming[provider]?.api_key || existing[provider]?.api_key || ''
    }]));
  }

  /**
   * 同步配置到AI引擎
   */
  async syncToAIEngine(providerConfig) {
    const response = await fetch(`${appConfig.ai.engineUrl}/api/external-apis/config`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Token': process.env.AI_INTERNAL_TOKEN || 'tianwang-local-ai-internal'
      },
      body: JSON.stringify({ providers: providerConfig })
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`AI引擎拒绝配置同步: ${response.status} ${body}`);
    }
  }

  async restoreRuntimeConfig() {
    const SystemConfig = models.SystemConfig;
    if (!SystemConfig) throw new Error('SystemConfig model not initialized');
    const stored = await SystemConfig.findOne({ where: { key: 'ai_model_config' } });
    if (!stored) return false;
    await this.syncToAIEngine(this.decryptApiKeys(stored.value));
    return true;
  }

  // ==================== 本地AI模型管理API ====================

  /**
   * 获取所有本地AI模型状态
   */
  async getLocalModelStatus(req, res) {
    try {
      logger.info('🔍 开始获取本地AI模型状态...');
      
      const aiEngineUrl = process.env.AI_ENGINE_URL || 'http://localhost:8888';
      
      let data = null;
      let aiEngineAvailable = false;
      
      try {
        const response = await fetch(`${aiEngineUrl}/api/models/status`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 5000 // 5秒超时
        });

        if (response.ok) {
          data = await response.json();
          aiEngineAvailable = true;
        } else {
          logger.warn(`AI引擎响应错误: ${response.status}`);
        }
      } catch (fetchError) {
        logger.warn('AI引擎连接失败:', fetchError.message);
      }
      
      // 构建本地模型状态响应
      const localModels = {
        anomaly_detection: {
          model_name: '异常检测模型',
          status: aiEngineAvailable && data?.status?.models_loaded?.includes('anomaly_detection') ? 'trained' : 'untrained',
          last_trained: null,
          accuracy: aiEngineAvailable ? (data?.status?.metrics?.model_accuracy?.anomaly_detection ?? null) : null,
          training_samples: 0,
          version: '1.0.0',
          performance_metrics: {
            precision: null,
            recall: null,
            f1_score: null,
            inference_time: null
          }
        },
        malware_detection: {
          model_name: '恶意软件检测模型',
          status: aiEngineAvailable && data?.status?.models_loaded?.includes('malware_detection') ? 'trained' : 'untrained',
          last_trained: null,
          accuracy: aiEngineAvailable ? (data?.status?.metrics?.model_accuracy?.malware_detection ?? null) : null,
          training_samples: 0,
          version: '1.0.0',
          performance_metrics: {
            precision: null,
            recall: null,
            f1_score: null,
            inference_time: null
          }
        },
        network_intrusion: {
          model_name: '网络入侵检测模型',
          status: aiEngineAvailable && data?.status?.models_loaded?.includes('network_intrusion') ? 'trained' : 'untrained',
          last_trained: null,
          accuracy: aiEngineAvailable ? (data?.status?.metrics?.model_accuracy?.network_intrusion ?? null) : null,
          training_samples: 0,
          version: '1.0.0',
          performance_metrics: {
            precision: null,
            recall: null,
            f1_score: null,
            inference_time: null
          }
        },
        user_behavior: {
          model_name: '用户行为分析模型',
          status: aiEngineAvailable && data?.status?.models_loaded?.includes('user_behavior') ? 'trained' : 'untrained',
          last_trained: null,
          accuracy: aiEngineAvailable ? (data?.status?.metrics?.model_accuracy?.user_behavior ?? null) : null,
          training_samples: 0,
          version: '1.0.0',
          performance_metrics: {
            precision: null,
            recall: null,
            f1_score: null,
            inference_time: null
          }
        }
      };

      res.json({
        success: true,
        models: localModels,
        ai_engine_status: aiEngineAvailable ? (data?.status?.service_status === 'healthy' ? 'running' : 'stopped') : 'unavailable',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      // 添加详细的调试信息
      console.log('=== getLocalModelStatus 错误调试信息 ===');
      console.log('错误对象类型:', typeof error);
      console.log('错误对象:', error);
      console.log('错误对象键:', Object.keys(error || {}));
      console.log('错误消息:', error?.message);
      console.log('错误堆栈:', error?.stack);
      console.log('=====================================');
      
      logger.error('获取本地AI模型状态失败:', error);
      res.status(500).json({
        success: false,
        message: '获取模型状态失败',
        error: error.message
      });
    }
  }

  /**
   * 获取特定模型状态
   */
  async getModelStatus(req, res) {
    try {
      const { model_name } = req.params;
      logger.info(`🔍 开始获取模型状态: ${model_name}`);
      
      const aiEngineUrl = process.env.AI_ENGINE_URL || 'http://localhost:8888';
      
      let data = null;
      let aiEngineAvailable = false;
      
      try {
        const response = await fetch(`${aiEngineUrl}/api/models/status`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 5000 // 5秒超时
        });

        if (response.ok) {
          data = await response.json();
          aiEngineAvailable = true;
        } else {
          logger.warn(`AI引擎响应错误: ${response.status}`);
        }
      } catch (fetchError) {
        logger.warn('AI引擎连接失败:', fetchError.message);
      }
      
      const modelStatus = {
        model_name: model_name,
        status: aiEngineAvailable && data?.status?.models_loaded?.includes(model_name) ? 'trained' : 'untrained',
        last_trained: null,
        accuracy: aiEngineAvailable ? (data?.status?.metrics?.model_accuracy?.[model_name] ?? null) : null,
        training_samples: 0,
        version: '1.0.0',
        performance_metrics: {
          precision: null,
          recall: null,
          f1_score: null,
          inference_time: null
        }
      };

      res.json({
        success: true,
        model: modelStatus,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error(`获取模型状态失败 ${req.params.model_name}:`, error);
      res.status(500).json({
        success: false,
        message: '获取模型状态失败',
        error: error.message
      });
    }
  }

  /**
   * 训练指定模型
   */
  async trainModel(req, res) {
    try {
      const { model_name, training_data } = req.body;
      logger.info(`🚀 开始训练模型: ${model_name}`);
      
      const aiEngineUrl = process.env.AI_ENGINE_URL || 'http://localhost:8888';
      
      const response = await fetch(`${aiEngineUrl}/api/train`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          training_model_name: model_name,
          training_data: training_data || []
        })
      });

      if (!response.ok) {
        throw new Error(`AI引擎响应错误: ${response.status}`);
      }

      const data = await response.json();

      res.json({
        success: true,
        message: data.message || `模型 ${model_name} 训练已开始`,
        task_id: data.task_id,
        model_name: data.model_name || model_name,
        training_samples: data.training_samples ?? training_data?.length ?? 0,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error(`训练模型失败 ${req.body.model_name}:`, error);
      res.status(500).json({
        success: false,
        message: '训练模型失败',
        error: error.message
      });
    }
  }

  /**
   * 获取训练状态
   */
  async getTrainingStatus(req, res) {
    try {
      const { task_id } = req.params;
      logger.info(`🔍 获取训练状态: ${task_id}`);
      
      const aiEngineUrl = process.env.AI_ENGINE_URL || 'http://localhost:8888';
      const response = await fetch(`${aiEngineUrl}/api/training/${encodeURIComponent(task_id)}/status`);
      const data = await response.json();
      if (!response.ok) {
        return res.status(response.status).json({ success: false, message: data.detail || '获取训练状态失败' });
      }

      res.json({
        success: true,
        training_status: data.training_status,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error(`获取训练状态失败 ${req.params.task_id}:`, error);
      res.status(500).json({
        success: false,
        message: '获取训练状态失败',
        error: error.message
      });
    }
  }

  /**
   * 测试模型推理
   */
  async testModel(req, res) {
    try {
      const { model_name, test_data } = req.body;
      logger.info(`🧪 开始测试模型: ${model_name}`);
      
      const aiEngineUrl = process.env.AI_ENGINE_URL || 'http://localhost:8888';
      
      let endpoint = '';
      switch (model_name) {
      case 'anomaly_detection':
        endpoint = '/api/detect/anomaly';
        break;
      case 'malware_detection':
        endpoint = '/api/detect/malware';
        break;
      case 'network_intrusion':
        endpoint = '/api/detect/network';
        break;
      case 'user_behavior':
        endpoint = '/api/analyze/behavior';
        break;
      default:
        throw new Error(`不支持的模型类型: ${model_name}`);
      }
      
      const response = await fetch(`${aiEngineUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          data: test_data
        })
      });

      if (!response.ok) {
        throw new Error(`AI引擎响应错误: ${response.status}`);
      }

      const data = await response.json();

      res.json({
        success: true,
        model_name: model_name,
        test_result: data.result || data,
        inference_time: 0.05,
        confidence: data.result?.confidence || 0.8,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error(`测试模型失败 ${req.body.model_name}:`, error);
      res.status(500).json({
        success: false,
        message: '测试模型失败',
        error: error.message
      });
    }
  }

  // ==================== 训练数据管理API ====================

  /**
   * 上传训练数据
   */
  async uploadTrainingData(req, res) {
    try {
      const { model_name, data_type, data } = req.body;
      logger.info(`📤 开始上传训练数据: ${model_name}, 类型: ${data_type}`);
      
      // 验证数据格式
      if (!data || !Array.isArray(data)) {
        throw new Error('训练数据必须是数组格式');
      }

      if (data.length === 0) {
        throw new Error('训练数据不能为空');
      }

      const dataId = `data_${crypto.randomUUID().replace(/-/g, '')}`;
      
      // 构建训练数据记录
      const trainingDataRecord = {
        id: dataId,
        model_name: model_name,
        data_type: data_type,
        data: data,
        sample_count: data.length,
        upload_time: new Date().toISOString(),
        status: 'uploaded',
        metadata: {
          format: 'json',
          version: '1.0.0'
        }
      };

      await fs.promises.mkdir(trainingDataDir, { recursive: true });
      await fs.promises.writeFile(trainingDataPath(dataId), JSON.stringify(trainingDataRecord), { encoding: 'utf8', flag: 'wx' });

      res.status(201).json({
        success: true,
        message: '训练数据上传成功',
        data_id: dataId,
        model_name: model_name,
        sample_count: data.length,
        upload_time: trainingDataRecord.upload_time,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('上传训练数据失败:', error);
      res.status(500).json({
        success: false,
        message: '上传训练数据失败',
        error: error.message
      });
    }
  }

  /**
   * 获取训练数据列表
   */
  async getTrainingDataList(req, res) {
    try {
      const { model_name, page = 1, limit = 10 } = req.query;
      logger.info(`📋 获取训练数据列表: ${model_name || 'all'}`);
      
      const records = await readTrainingRecords();

      // 根据模型名称过滤
      const filteredData = model_name 
        ? records.filter(item => item.model_name === model_name)
        : records;

      // 分页处理
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + parseInt(limit);
      const paginatedData = filteredData.slice(startIndex, endIndex).map(({ data: _data, ...metadata }) => metadata);

      res.json({
        success: true,
        data: paginatedData,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: filteredData.length,
          total_pages: Math.ceil(filteredData.length / limit)
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('获取训练数据列表失败:', error);
      res.status(500).json({
        success: false,
        message: '获取训练数据列表失败',
        error: error.message
      });
    }
  }

  /**
   * 删除训练数据
   */
  async deleteTrainingData(req, res) {
    try {
      const { data_id } = req.params;
      logger.info(`🗑️ 删除训练数据: ${data_id}`);
      
      try {
        await fs.promises.unlink(trainingDataPath(data_id));
      } catch (error) {
        if (error.code === 'ENOENT') return res.status(404).json({ success: false, message: '训练数据不存在' });
        throw error;
      }
      res.json({
        success: true,
        message: '训练数据删除成功',
        data_id: data_id,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error(`删除训练数据失败 ${req.params.data_id}:`, error);
      res.status(500).json({
        success: false,
        message: '删除训练数据失败',
        error: error.message
      });
    }
  }

  /**
   * 获取训练数据详情
   */
  async getTrainingDataDetail(req, res) {
    try {
      const { data_id } = req.params;
      logger.info(`📄 获取训练数据详情: ${data_id}`);
      
      let record;
      try {
        record = JSON.parse(await fs.promises.readFile(trainingDataPath(data_id), 'utf8'));
      } catch (error) {
        if (error.code === 'ENOENT') return res.status(404).json({ success: false, message: '训练数据不存在' });
        throw error;
      }
      const { data, ...metadata } = record;
      const detail = { ...metadata, data_preview: data.slice(0, 10) };

      res.json({
        success: true,
        data: detail,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error(`获取训练数据详情失败 ${req.params.data_id}:`, error);
      res.status(500).json({
        success: false,
        message: '获取训练数据详情失败',
        error: error.message
      });
    }
  }

  /**
   * 获取资源列表
   */
  async getResourceList(req, res) {
    try {
      logger.info('📋 获取资源列表');
      
      if (!models.AIResource) return res.status(503).json({ success: false, message: '资源数据库不可用' });
      const resources = await models.AIResource.findAll({ order: [['updatedAt', 'DESC']] });

      res.json({
        success: true,
        data: resources,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('获取资源列表失败:', error);
      res.status(500).json({
        success: false,
        message: '获取资源列表失败',
        error: error.message
      });
    }
  }

  /**
   * 下载资源
   */
  async downloadResource(req, res) {
    try {
      const { resource_id, category, model_name } = req.body;
      logger.info(`📥 开始下载资源: ${resource_id}`);
      
      // 资源下载配置
      const resourceConfigs = {
        'nsl-kdd-dataset': {
          url: 'https://raw.githubusercontent.com/defcom17/NSL_KDD/master/KDDTrain%2B.txt',
          filename: 'nsl-kdd-dataset.csv',
          type: 'dataset'
        },
        'cicids2017-dataset': {
          url: 'https://raw.githubusercontent.com/UNB-CIC/CICFlowMeter/master/Data/CICIDS2017/MachineLearningCSV.zip',
          filename: 'cicids2017-dataset.zip',
          type: 'dataset'
        },
        'malware-api-class': {
          url: 'https://raw.githubusercontent.com/ocatak/malware_api_class/master/data/malware_api_calls.json',
          filename: 'malware-api-class.json',
          type: 'dataset'
        },
        'anomaly-detection-model': {
          url: 'https://github.com/scikit-learn/scikit-learn/raw/main/sklearn/ensemble/_iforest.py',
          filename: 'anomaly_detection_model.py',
          type: 'model'
        },
        'network-intrusion-model': {
          url: 'https://github.com/Western-OC2-Lab/OASW-Concept-Drift-Detection-and-Adaptation/raw/main/models/network_intrusion.h5',
          filename: 'network_intrusion_model.h5',
          type: 'model'
        },
        'malware-detection-model': {
          url: 'https://raw.githubusercontent.com/ocatak/malware_api_class/master/models/malware_detection.pkl',
          filename: 'malware_detection_model.pkl',
          type: 'model',
          name: '恶意软件检测模型',
          category: 'malware_detection'
        }
      };

      const config = resourceConfigs[resource_id];
      if (!config) {
        return res.status(400).json({
          success: false,
          message: '不支持的资源ID'
        });
      }

      // 创建下载目录
      const downloadDir = path.join(__dirname, '../../downloads');
      if (!fs.existsSync(downloadDir)) {
        fs.mkdirSync(downloadDir, { recursive: true });
      }

      const filePath = path.join(downloadDir, config.filename);
      
      // 开始下载
      try {
        const response = await fetch(config.url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const fileStream = fs.createWriteStream(filePath);
        response.body.pipe(fileStream);

        const controller = this; // 保存this引用
        return new Promise((resolve, reject) => {
          fileStream.on('finish', async () => {
            logger.info(`✅ 资源下载完成: ${resource_id} -> ${filePath}`);
            
            const fileSize = fs.statSync(filePath).size;

            // 更新资源状态到数据库
            await controller.updateResourceStatus(resource_id, 'downloaded', filePath, fileSize, {
              ...config,
              category: category,
              name: model_name || config.name
            });
            
            res.json({
              success: true,
              message: '资源下载成功',
              resource_id: resource_id,
              file_path: filePath,
              file_size: fileSize,
              timestamp: new Date().toISOString()
            });
            resolve();
          });

          fileStream.on('error', (error) => {
            logger.error(`❌ 资源下载失败: ${resource_id}`, error);
            // 更新数据库状态为error
            controller.updateResourceStatus(resource_id, 'error', null, null, config);
            reject(error);
          });
        });

      } catch (downloadError) {
        logger.error(`❌ 下载资源失败: ${resource_id}`, downloadError);
        
        // 更新数据库状态为error
        this.updateResourceStatus(resource_id, 'error', null, null, config);

        // --- 修改点：暴露真实错误 ---
        return res.status(500).json({
          success: false,
          message: `下载资源时发生内部错误: ${downloadError.message}`,
          error: {
            name: downloadError.name,
            message: downloadError.message,
            stack: downloadError.stack
          }
        });
        // --- 结束修改 ---
      }

    } catch (error) {
      logger.error('处理资源下载请求时出错:', error);
      res.status(500).json({
        success: false,
        message: '下载资源失败',
        error: error.message
      });
    }
  }

  /**
   * 更新资源状态
   */
  async updateResourceStatus(resourceId, status, filePath = null, fileSize = null, resourceConfig = {}) {
    try {
      logger.info(`📝 更新资源状态: ${resourceId} -> ${status}${filePath ? ` (${filePath})` : ''}`);
      
      const resourceData = {
        resource_id: resourceId,
        status: status,
        name: resourceConfig.name || resourceId,
        type: resourceConfig.type || 'model',
        category: resourceConfig.category,
        local_path: filePath,
        file_size: fileSize,
        downloaded_at: status === 'downloaded' ? new Date() : null,
        metadata: {
          source_url: resourceConfig.url
        }
      };

      // 使用upsert确保记录存在
      await models.AIResource.upsert(resourceData, {
        where: { resource_id: resourceId }
      });

    } catch (error) {
      logger.error('更新资源状态到数据库失败:', {
        message: error.message,
        stack: error.stack,
        resourceId: resourceId
      });
    }
  }

  /**
   * 删除资源
   */
  async deleteResource(req, res) {
    try {
      const { resource_id } = req.params;
      logger.info(`🗑️ 删除资源: ${resource_id}`);
      
      if (!models.AIResource) return res.status(503).json({ success: false, message: '资源数据库不可用' });
      const resource = await models.AIResource.findOne({ where: { resource_id } });
      if (!resource) return res.status(404).json({ success: false, message: '资源不存在' });
      if (resource.local_path) {
        const downloadRoot = path.resolve(__dirname, '../../downloads');
        const localPath = path.resolve(resource.local_path);
        if (localPath !== downloadRoot && localPath.startsWith(`${downloadRoot}${path.sep}`)) {
          await fs.promises.unlink(localPath).catch(error => {
            if (error.code !== 'ENOENT') throw error;
          });
        }
      }
      await resource.destroy();
      res.json({
        success: true,
        message: '资源删除成功',
        resource_id: resource_id,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('删除资源失败:', error);
      res.status(500).json({
        success: false,
        message: '删除资源失败',
        error: error.message
      });
    }
  }

  /**
   * 获取已加载的模型列表
   */
  async getLoadedModels(req, res) {
    try {
      logger.info('📋 获取已加载模型列表');
      
      const aiEngineUrl = process.env.AI_ENGINE_URL || 'http://localhost:8888';
      const response = await fetch(`${aiEngineUrl}/api/models/status`);
      const result = await response.json();
      if (!response.ok) return res.status(response.status).json({ success: false, message: result.detail || '获取模型状态失败' });
      const status = result.status || {};
      const loadedModels = (status.models_loaded || []).map(modelName => ({
        id: modelName,
        name: modelName,
        category: modelName,
        status: 'active',
        accuracy: status.metrics?.model_accuracy?.[modelName] ?? null,
        last_updated: status.timestamp
      }));

      res.json({
        success: true,
        data: loadedModels,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('获取已加载模型列表失败:', error);
      res.status(500).json({
        success: false,
        message: '获取已加载模型列表失败',
        error: error.message
      });
    }
  }

  /**
   * 切换模型状态（激活/停用）
   */
  async toggleModel(req, res) {
    try {
      const { model_id, status } = req.body;
      logger.info(`🔄 切换模型状态: ${model_id} -> ${status}`);
      
      if (!model_id || !['active', 'inactive'].includes(status)) {
        return res.status(400).json({ success: false, message: '模型ID或目标状态无效' });
      }
      const aiEngineUrl = process.env.AI_ENGINE_URL || 'http://localhost:8888';
      const response = await fetch(`${aiEngineUrl}/api/models/${encodeURIComponent(model_id)}/toggle`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: status === 'active' })
      });
      const result = await response.json();
      res.status(response.status).json(response.ok
        ? { success: true, model_id, status: result.model.status, timestamp: new Date().toISOString() }
        : { success: false, message: result.detail || '切换模型状态失败' });

    } catch (error) {
      logger.error('切换模型状态失败:', error);
      res.status(500).json({
        success: false,
        message: '切换模型状态失败',
        error: error.message
      });
    }
  }

  /**
   * 重新加载模型
   */
  async reloadModel(req, res) {
    try {
      const { model_id } = req.params;
      logger.info(`🔄 重新加载模型: ${model_id}`);
      
      const aiEngineUrl = process.env.AI_ENGINE_URL || 'http://localhost:8888';
      const response = await fetch(`${aiEngineUrl}/api/models/${encodeURIComponent(model_id)}/reload`, { method: 'POST' });
      const result = await response.json();
      res.status(response.status).json(response.ok
        ? { success: true, message: '模型重新加载成功', model_id, timestamp: new Date().toISOString() }
        : { success: false, message: result.detail || '重新加载模型失败' });

    } catch (error) {
      logger.error('重新加载模型失败:', error);
      res.status(500).json({
        success: false,
        message: '重新加载模型失败',
        error: error.message
      });
    }
  }

  /**
   * 导出训练数据
   */
  async exportTrainingData(req, res) {
    try {
      const { model_name, data_type, format = 'json' } = req.query;
      logger.info(`📤 导出训练数据: ${model_name || 'all'}, 类型: ${data_type || 'all'}, 格式: ${format}`);
      
      if (format !== 'json') {
        return res.status(400).json({ success: false, message: '当前仅支持 JSON 导出格式' });
      }
      const records = await readTrainingRecords();

      // 根据条件过滤数据
      let filteredData = records;
      if (model_name) {
        filteredData = filteredData.filter(item => item.model_name === model_name);
      }
      if (data_type) {
        filteredData = filteredData.filter(item => item.data_type === data_type);
      }

      // 构建导出数据
      const exportData = {
        export_info: {
          export_time: new Date().toISOString(),
          total_count: filteredData.length,
          model_name: model_name || 'all',
          data_type: data_type || 'all',
          format: format
        },
        data: filteredData
      };

      // 设置响应头
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="training_data_export_${new Date().toISOString().split('T')[0]}.json"`);

      res.json({
        success: true,
        data: exportData,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('导出训练数据失败:', error);
      res.status(500).json({
        success: false,
        message: '导出训练数据失败',
        error: error.message
      });
    }
  }

  // ==================== 性能监控API ====================

  /**
   * 获取模型性能指标
   */
  async getModelPerformance(req, res) {
    try {
      const { model_name } = req.query;
      logger.info(`📊 获取模型性能指标: ${model_name || 'all'}`);
      
      const aiEngineUrl = process.env.AI_ENGINE_URL || 'http://localhost:8888';
      
      let data = null;
      let aiEngineAvailable = false;
      
      try {
        const response = await fetch(`${aiEngineUrl}/api/models/status`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 5000 // 5秒超时
        });

        if (response.ok) {
          data = await response.json();
          aiEngineAvailable = true;
        } else {
          logger.warn(`AI引擎响应错误: ${response.status}`);
        }
      } catch (fetchError) {
        logger.warn('AI引擎连接失败:', fetchError.message);
      }
      if (!aiEngineAvailable) return res.status(503).json({ success: false, message: 'AI引擎不可用' });
      const engineMetrics = data?.status?.metrics || {};
      const loadedModels = data?.status?.models_loaded || [];
      
      // 构建性能指标响应
      const performanceMetrics = {
        anomaly_detection: {
          model_name: '异常检测模型',
          accuracy: engineMetrics.model_accuracy?.anomaly_detection ?? null,
          precision: null,
          recall: null,
          f1_score: null,
          inference_time: null,
          throughput: null,
          error_rate: null,
          last_updated: new Date().toISOString()
        },
        malware_detection: {
          model_name: '恶意软件检测模型',
          accuracy: engineMetrics.model_accuracy?.malware_detection ?? null,
          precision: null,
          recall: null,
          f1_score: null,
          inference_time: null,
          throughput: null,
          error_rate: null,
          last_updated: new Date().toISOString()
        },
        network_intrusion: {
          model_name: '网络入侵检测模型',
          accuracy: engineMetrics.model_accuracy?.network_intrusion ?? null,
          precision: null,
          recall: null,
          f1_score: null,
          inference_time: null,
          throughput: null,
          error_rate: null,
          last_updated: new Date().toISOString()
        },
        user_behavior: {
          model_name: '用户行为分析模型',
          accuracy: engineMetrics.model_accuracy?.user_behavior ?? null,
          precision: null,
          recall: null,
          f1_score: null,
          inference_time: null,
          throughput: null,
          error_rate: null,
          last_updated: new Date().toISOString()
        }
      };

      // 如果指定了模型名称，只返回该模型的性能指标
      const result = model_name ? { [model_name]: performanceMetrics[model_name] } : performanceMetrics;

      res.json({
        success: true,
        performance_metrics: result,
        system_overview: {
          total_models: loadedModels.length,
          predictions: engineMetrics.predictions_count || 0,
          anomalies: engineMetrics.anomalies_detected || 0,
          threats: engineMetrics.threats_identified || 0
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      // 添加详细的调试信息
      console.log('=== getModelPerformance 错误调试信息 ===');
      console.log('错误对象类型:', typeof error);
      console.log('错误对象:', error);
      console.log('错误对象键:', Object.keys(error || {}));
      console.log('错误消息:', error?.message);
      console.log('错误堆栈:', error?.stack);
      console.log('======================================');
      
      logger.error('获取模型性能指标失败:', error);
      res.status(500).json({
        success: false,
        message: '获取性能指标失败',
        error: error.message
      });
    }
  }

  /**
   * 获取性能历史记录
   */
  async getPerformanceHistory(req, res) {
    try {
      const { model_name, days = 7 } = req.query;
      logger.info(`📈 获取性能历史记录: ${model_name || 'all'}, 天数: ${days}`);
      
      const requestedDays = Math.min(90, Math.max(1, Number.parseInt(days, 10) || 7));
      const modelNames = model_name
        ? [model_name]
        : ['anomaly_detection', 'malware_detection', 'network_intrusion', 'user_behavior'];
      const historyData = Object.fromEntries(modelNames.map(name => [name, []]));

      res.json({
        success: true,
        history_data: historyData,
        query_params: {
          model_name: model_name || 'all',
          days: requestedDays
        },
        availability: '历史指标尚未持久化，未返回推测数据',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('获取性能历史记录失败:', error);
      res.status(500).json({
        success: false,
        message: '获取性能历史记录失败',
        error: error.message
      });
    }
  }

  /**
   * 获取系统性能概览
   */
  async getSystemPerformanceOverview(req, res) {
    try {
      logger.info('📊 获取系统性能概览');
      
      const aiEngineUrl = process.env.AI_ENGINE_URL || 'http://localhost:8888';
      
      let data = null;
      let aiEngineAvailable = false;
      
      try {
        const response = await fetch(`${aiEngineUrl}/api/models/status`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 5000 // 5秒超时
        });

        if (response.ok) {
          data = await response.json();
          aiEngineAvailable = true;
        } else {
          logger.warn(`AI引擎响应错误: ${response.status}`);
        }
      } catch (fetchError) {
        logger.warn('AI引擎连接失败:', fetchError.message);
      }
      if (!aiEngineAvailable) return res.status(503).json({ success: false, message: 'AI引擎不可用' });
      const engineStatus = data?.status || {};
      const metrics = engineStatus.metrics || {};
      
      const overview = {
        system_status: engineStatus.service_status === 'healthy' ? 'running' : 'stopped',
        total_models: engineStatus.models_loaded?.length || 0,
        loaded_models: engineStatus.models_loaded || [],
        total_predictions: metrics.predictions_count || 0,
        total_anomalies: metrics.anomalies_detected || 0,
        total_threats: metrics.threats_identified || 0,
        last_prediction_time: metrics.last_prediction_time || null,
        model_accuracy: metrics.model_accuracy || {}
      };

      res.json({
        success: true,
        overview: overview,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('获取系统性能概览失败:', error);
      res.status(500).json({
        success: false,
        message: '获取系统性能概览失败',
        error: error.message
      });
    }
  }
}

module.exports = new AIModelController();
