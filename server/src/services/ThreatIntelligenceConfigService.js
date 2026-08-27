const fetch = require('node-fetch');
const models = require('../models');
const encryption = require('../utils/encryption');
const appConfig = require('../config');

const CONFIG_KEY = 'threat_intelligence_config';

class ThreatIntelligenceConfigService {
  async load() {
    if (!models.SystemConfig) throw new Error('威胁情报配置数据库不可用');
    const stored = await models.SystemConfig.findOne({ where: { key: CONFIG_KEY } });
    if (stored) return stored.value;
    return {
      misp: {
        enabled: !!(process.env.MISP_URL && process.env.MISP_API_KEY),
        url: process.env.MISP_URL || '',
        apiKey: process.env.MISP_API_KEY ? encryption.encrypt(process.env.MISP_API_KEY) : null,
        status: 'unknown',
        lastTestedAt: null
      },
      otx: {
        enabled: !!process.env.OTX_API_KEY,
        apiKey: process.env.OTX_API_KEY ? encryption.encrypt(process.env.OTX_API_KEY) : null,
        status: 'unknown',
        lastTestedAt: null
      }
    };
  }

  publicConfig(config) {
    return {
      misp: {
        enabled: !!config.misp?.enabled,
        url: config.misp?.url || '',
        apiKey: config.misp?.apiKey ? '***' : '',
        status: config.misp?.status || 'unknown',
        lastTestedAt: config.misp?.lastTestedAt || null
      },
      otx: {
        enabled: !!config.otx?.enabled,
        apiKey: config.otx?.apiKey ? '***' : '',
        status: config.otx?.status || 'unknown',
        lastTestedAt: config.otx?.lastTestedAt || null
      }
    };
  }

  async save(input) {
    const current = await this.load();
    const next = {
      misp: {
        ...current.misp,
        ...(input.misp || {}),
        apiKey: input.misp?.apiKey && input.misp.apiKey !== '***'
          ? encryption.encrypt(input.misp.apiKey)
          : current.misp?.apiKey || null,
        status: 'unknown',
        lastTestedAt: null
      },
      otx: {
        ...current.otx,
        ...(input.otx || {}),
        apiKey: input.otx?.apiKey && input.otx.apiKey !== '***'
          ? encryption.encrypt(input.otx.apiKey)
          : current.otx?.apiKey || null,
        status: 'unknown',
        lastTestedAt: null
      }
    };
    if (next.misp.enabled && (!next.misp.url || !next.misp.apiKey)) throw new Error('MISP配置不完整');
    if (next.otx.enabled && !next.otx.apiKey) throw new Error('OTX配置不完整');
    if (next.misp.url && !/^https?:\/\//i.test(next.misp.url)) throw new Error('MISP服务器地址必须使用HTTP或HTTPS协议');
    await this.syncToAIEngine(next);
    try {
      await models.SystemConfig.upsert({ key: CONFIG_KEY, value: next, category: 'threat_intelligence' });
    } catch (error) {
      await this.syncToAIEngine(current).catch(() => {});
      throw error;
    }
    return next;
  }

  runtimeConfig(config) {
    return {
      misp: {
        enabled: !!config.misp?.enabled,
        url: config.misp?.url || '',
        api_key: config.misp?.apiKey ? encryption.decrypt(config.misp.apiKey) : ''
      },
      otx: {
        enabled: !!config.otx?.enabled,
        api_key: config.otx?.apiKey ? encryption.decrypt(config.otx.apiKey) : ''
      }
    };
  }

  async syncToAIEngine(config) {
    const response = await fetch(`${appConfig.ai.engineUrl}/api/threat-intelligence/config`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Token': process.env.AI_INTERNAL_TOKEN || 'tianwang-local-ai-internal'
      },
      body: JSON.stringify(this.runtimeConfig(config))
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`AI引擎拒绝威胁情报配置: ${response.status} ${body}`);
    }
  }

  async restoreRuntimeConfig() {
    if (!models.SystemConfig) throw new Error('威胁情报配置数据库不可用');
    const stored = await models.SystemConfig.findOne({ where: { key: CONFIG_KEY } });
    if (!stored) return false;
    await this.syncToAIEngine(stored.value);
    return true;
  }

  async request(url, headers) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    timer.unref?.();
    try {
      const response = await fetch(url, { headers, signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response;
    } finally {
      clearTimeout(timer);
    }
  }

  async test(source) {
    const config = await this.load();
    if (!['misp', 'otx'].includes(source)) throw new Error('不支持的威胁情报源');
    const sourceConfig = config[source];
    if (!sourceConfig?.enabled || !sourceConfig.apiKey) throw new Error(`${source.toUpperCase()}尚未启用或配置不完整`);
    const apiKey = encryption.decrypt(sourceConfig.apiKey);
    try {
      if (source === 'misp') {
        const baseUrl = sourceConfig.url.replace(/\/$/, '');
        await this.request(`${baseUrl}/servers/getVersion`, { Authorization: apiKey, Accept: 'application/json' });
      } else {
        await this.request('https://otx.alienvault.com/api/v1/user/me', { 'X-OTX-API-KEY': apiKey, Accept: 'application/json' });
      }
      sourceConfig.status = 'connected';
      sourceConfig.lastTestedAt = new Date().toISOString();
      await models.SystemConfig.upsert({ key: CONFIG_KEY, value: config, category: 'threat_intelligence' });
      return this.publicConfig(config)[source];
    } catch (error) {
      sourceConfig.status = 'error';
      sourceConfig.lastTestedAt = new Date().toISOString();
      await models.SystemConfig.upsert({ key: CONFIG_KEY, value: config, category: 'threat_intelligence' });
      throw new Error(`${source.toUpperCase()}连接测试失败: ${error.message}`);
    }
  }
}

module.exports = new ThreatIntelligenceConfigService();
