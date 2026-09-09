/**
 * 数据存储服务
 * Data Storage Service - 负责时序数据和结构化数据的存储管理
 */

const { getSequelize } = require('../config/database');

class DataStorageService {
  constructor() {
    this.isInitialized = false;
  }

  async initialize() {
    await getSequelize().authenticate();
    this.isInitialized = true;
  }

  async querySystemData(agent_id, start, end, limit) {
    return (await import('../core/metrics.js')).query(agent_id, 'system', start, end, limit);
  }

  /**
   * 查询网络流量数据
   */
  async queryNetworkData(agent_id, start, end, limit) {
    return (await import('../core/metrics.js')).query(agent_id, 'network', start, end, limit);
  }

  /**
   * 查询安全事件数据
   */
  async querySecurityEvents(agent_id, start, end, limit) {
    return (await import('../core/metrics.js')).securityEvents(agent_id, start, end, limit);
  }

  /**
   * 获取系统性能统计
   */
  async getSystemStats(agent_id, range) {
    return (await import('../core/metrics.js')).systemStats(agent_id, range);
  }

  /**
   * 关闭数据存储服务
   */
  async close() {
    this.isInitialized = false;
  }

}

// 创建单例实例
const dataStorageService = new DataStorageService();

module.exports = dataStorageService;
