const models = require('../models');
const logger = require('../utils/logger');
const encryption = require('../utils/encryption');
const defaultProviderConfig = Object.fromEntries(['openai', 'claude', 'openrouter', 'deepseek'].map(provider => [provider, {
  enabled: false, api_key: '', default_model: ''
}]));

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

      if (!config || typeof config !== 'object' || Array.isArray(config)) {
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
      for (const [provider, value] of Object.entries(mergedConfig)) {
        if (!['openai', 'claude', 'openrouter', 'deepseek'].includes(provider) || !value || typeof value !== 'object' ||
          typeof value.enabled !== 'boolean' || (value.enabled &&
          (typeof value.api_key !== 'string' || !value.api_key.trim() || typeof value.default_model !== 'string' || !value.default_model.trim()))) {
          return res.status(400).json({ success: false, message: '请选择支持的服务商，并填写密钥与模型名称' });
        }
      }

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
    const [rows] = await models.sequelize.query(`SELECT provider, count(*)::int AS request_count,
      count(*) FILTER(WHERE status='failed')::int AS failure_count,
      count(*) FILTER(WHERE status='running')::int AS running_count,
      sum(input_tokens)::float AS input_tokens, sum(output_tokens)::float AS output_tokens
      FROM provider_requests GROUP BY provider`);
    const providers = Object.fromEntries(rows.map(row => [row.provider, {
      ...row, status: row.failure_count ? (row.failure_count === row.request_count ? 'unhealthy' : 'degraded') : row.running_count ? 'unknown' : 'healthy'
    }]));
    res.json({ success: true, stats: { total_requests: rows.reduce((sum, row) => sum + row.request_count, 0),
      input_tokens: rows.reduce((sum, row) => sum + (row.input_tokens || 0), 0),
      output_tokens: rows.reduce((sum, row) => sum + (row.output_tokens || 0), 0), providers } });
  }

  async testConnection(req, res) {
    const { provider, api_key, model } = req.body;
    const { providerNames } = await import('../core/providers.js');
    if (!providerNames.includes(provider)) return res.status(400).json({ success: false, message: '请选择有效的提供商' });
    const { loadProviders, invokeProvider } = await import('../core/analysis.js');
    const saved = (await loadProviders())[provider];
    const config = { api_key: api_key || (saved?.api_key ? encryption.decrypt(saved.api_key) : ''), default_model: model || saved?.default_model };
    if (!config.api_key || !config.default_model) return res.status(400).json({ success: false, message: '请填写密钥和模型' });
    try {
      const result = await invokeProvider(provider, config, '请回复：连接成功');
      res.json({ success: true, message: '连接成功', provider, model: result.model });
    } catch {
      res.status(503).json({ success: false, message: '连接失败，请检查密钥、模型及服务状态' });
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
        encryptedConfig[provider].api_key = encryption.encrypt(encryptedConfig[provider].api_key);
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
          decryptedConfig[provider].api_key = encryption.decrypt(decryptedConfig[provider].api_key);
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

}

module.exports = new AIModelController();
