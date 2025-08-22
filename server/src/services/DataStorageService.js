/**
 * 数据存储服务
 * Data Storage Service - 负责时序数据和结构化数据的存储管理
 */

const { InfluxDB, Point } = require('@influxdata/influxdb-client');
const config = require('../config/index');
const logger = require('../utils/logger');

class DataStorageService {
  constructor() {
    this.influxDB = null;
    this.writeApi = null;
    this.queryApi = null;
    this.isInitialized = false;
    this.batchSize = 1000;
    this.batchTimeout = 5000; // 5秒
    this.batchBuffer = [];
    this.batchTimer = null;
  }

  /**
   * 初始化数据存储服务
   */
  async initialize() {
    try {
      if (this.isInitialized) {
        logger.warn('DataStorageService already initialized');
        return;
      }

      // 检查InfluxDB配置
      if (!config.database.influxdb.url || !config.database.influxdb.token) {
        logger.warn('⚠️ InfluxDB configuration not found, running in mock mode');
        this.mockMode = true;
        this.isInitialized = true;
        logger.info('✅ DataStorageService initialized in mock mode');
        return;
      }

      try {
        // 初始化InfluxDB连接
        this.influxDB = new InfluxDB({
          url: config.database.influxdb.url,
          token: config.database.influxdb.token
        });

        // 创建写入API
        this.writeApi = this.influxDB.getWriteApi(
          config.database.influxdb.org,
          config.database.influxdb.bucket,
          'ms'
        );

        // 创建查询API
        this.queryApi = this.influxDB.getQueryApi(config.database.influxdb.org);

        // 设置写入API配置
        this.writeApi.useDefaultTags({
          service: 'tianwang-server',
          version: config.app.version
        });

        // 启动批处理定时器
        this.startBatchTimer();

        this.isInitialized = true;
        logger.info('✅ DataStorageService initialized successfully');

      } catch (influxError) {
        logger.warn('⚠️ InfluxDB connection failed, running in mock mode:', influxError.message);
        this.mockMode = true;
        this.isInitialized = true;
        logger.info('✅ DataStorageService initialized in mock mode');
      }

    } catch (error) {
      logger.error('❌ Failed to initialize DataStorageService:', error);
      throw error;
    }
  }

  /**
   * 启动批处理定时器
   */
  startBatchTimer() {
    this.batchTimer = setInterval(() => {
      this.flushBatch();
    }, this.batchTimeout);
  }

  /**
   * 停止批处理定时器
   */
  stopBatchTimer() {
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
      this.batchTimer = null;
    }
  }

  /**
   * 刷新批处理缓冲区
   */
  async flushBatch() {
    if (this.batchBuffer.length === 0) {
      return;
    }

    try {
      const points = [...this.batchBuffer];
      this.batchBuffer = [];

      await this.writeApi.writePoints(points);
      await this.writeApi.flush();

      logger.debug(`✅ Flushed ${points.length} data points to InfluxDB`);

    } catch (error) {
      logger.error('❌ Failed to flush batch to InfluxDB:', error);
      // 将失败的点重新加入缓冲区
      this.batchBuffer.unshift(...this.batchBuffer);
    }
  }

  /**
   * 存储系统性能数据
   */
  async storeSystemData(agent_id, data) {
    try {
      if (!this.isInitialized) {
        logger.warn('DataStorageService not initialized, skipping system data storage');
        return;
      }

      if (this.mockMode) {
        logger.debug('📊 Mock mode: System data would be stored for agent:', agent_id);
        return;
      }

      const point = new Point('system_metrics')
        .tag('agent_id', agent_id)
        .tag('hostname', data.hostname || 'unknown')
        .tag('platform', data.platform || 'unknown')
        .timestamp(data.timestamp || Date.now());

      // CPU指标
      if (data.system?.cpu) {
        const cpu = data.system.cpu;
        point
          .floatField('cpu_load', cpu.load || 0)
          .floatField('cpu_load_user', cpu.loadUser || 0)
          .floatField('cpu_load_system', cpu.loadSystem || 0)
          .intField('cpu_cores', cpu.cores || 0)
          .floatField('cpu_speed', cpu.speed || 0);
      }

      // 内存指标
      if (data.system?.memory) {
        const memory = data.system.memory;
        point
          .intField('memory_total', memory.total || 0)
          .intField('memory_used', memory.used || 0)
          .intField('memory_free', memory.free || 0)
          .intField('memory_available', memory.available || 0)
          .floatField('memory_usage_percent', parseFloat(memory.usage) || 0);
      }

      // 系统运行时间
      if (data.system?.uptime) {
        point
          .intField('uptime_system', data.system.uptime.system || 0)
          .intField('uptime_process', data.system.uptime.process || 0);
      }

      this.addToBatch(point);

    } catch (error) {
      logger.error('❌ Failed to store system data:', error);
    }
  }

  /**
   * 存储网络流量数据
   */
  async storeNetworkData(agent_id, data) {
    try {
      if (!this.isInitialized) {
        logger.warn('DataStorageService not initialized, skipping network data storage');
        return;
      }

      if (this.mockMode) {
        logger.debug('🌐 Mock mode: Network data would be stored for agent:', agent_id);
        return;
      }

      // 存储网络接口数据
      if (data.interfaces && Array.isArray(data.interfaces)) {
        for (const iface of data.interfaces) {
          const point = new Point('network_interface_metrics')
            .tag('agent_id', agent_id)
            .tag('interface', iface.iface || 'unknown')
            .tag('operstate', iface.operstate || 'unknown')
            .timestamp(data.timestamp || Date.now())
            .intField('rx_bytes', iface.rx_bytes || 0)
            .intField('tx_bytes', iface.tx_bytes || 0)
            .intField('rx_errors', iface.rx_errors || 0)
            .intField('tx_errors', iface.tx_errors || 0)
            .intField('rx_dropped', iface.rx_dropped || 0)
            .intField('tx_dropped', iface.tx_dropped || 0);

          // 吞吐量数据
          if (iface.throughput) {
            point
              .floatField('rx_rate', iface.throughput.rxRate || 0)
              .floatField('tx_rate', iface.throughput.txRate || 0)
              .floatField('total_rate', iface.throughput.totalRate || 0);
          }

          this.addToBatch(point);
        }
      }

      // 存储网络连接数据
      if (data.connections && data.connections.connections) {
        const connectionsPoint = new Point('network_connections')
          .tag('agent_id', agent_id)
          .timestamp(data.timestamp || Date.now())
          .intField('total_connections', data.connections.total || 0)
          .intField('active_connections', data.connections.active || 0);

        this.addToBatch(connectionsPoint);
      }

    } catch (error) {
      logger.error('❌ Failed to store network data:', error);
    }
  }

  /**
   * 存储日志数据
   */
  async storeLogData(agent_id, data) {
    try {
      if (!this.isInitialized) {
        logger.warn('DataStorageService not initialized, skipping log data storage');
        return;
      }

      if (data.lines && Array.isArray(data.lines)) {
        for (const line of data.lines) {
          const point = new Point('log_entries')
            .tag('agent_id', agent_id)
            .tag('source', data.source || 'unknown')
            .tag('log_type', 'system')
            .timestamp(data.timestamp || Date.now())
            .stringField('message', line)
            .intField('line_length', line.length);

          this.addToBatch(point);
        }
      }

    } catch (error) {
      logger.error('❌ Failed to store log data:', error);
    }
  }

  /**
   * 存储安全事件数据
   */
  async storeSecurityEvent(agent_id, eventData) {
    try {
      if (!this.isInitialized) {
        logger.warn('DataStorageService not initialized, skipping security event storage');
        return;
      }

      const point = new Point('security_events')
        .tag('agent_id', agent_id)
        .tag('event_type', eventData.type || 'unknown')
        .tag('severity', eventData.severity || 'medium')
        .tag('status', eventData.status || 'open')
        .timestamp(eventData.timestamp || Date.now())
        .stringField('title', eventData.title || '')
        .stringField('description', eventData.description || '')
        .stringField('source_ip', eventData.sourceIP || '')
        .stringField('target_ip', eventData.targetIP || '')
        .intField('source_port', eventData.sourcePort || 0)
        .intField('target_port', eventData.targetPort || 0);

      this.addToBatch(point);

    } catch (error) {
      logger.error('❌ Failed to store security event:', error);
    }
  }

  /**
   * 添加数据点到批处理缓冲区
   */
  addToBatch(point) {
    this.batchBuffer.push(point);

    // 如果缓冲区满了，立即刷新
    if (this.batchBuffer.length >= this.batchSize) {
      this.flushBatch();
    }
  }

  /**
   * 查询系统性能数据
   */
  async querySystemData(agent_id, startTime, endTime, limit = 1000) {
    try {
      if (!this.isInitialized) {
        throw new Error('DataStorageService not initialized');
      }

      if (this.mockMode) {
        logger.debug('📊 Mock mode: Returning mock system data for agent:', agent_id);
        // 返回模拟数据
        return [
          {
            _time: new Date().toISOString(),
            _measurement: 'system_metrics',
            agent_id: agent_id,
            _field: 'cpu_load',
            _value: 45.2
          },
          {
            _time: new Date().toISOString(),
            _measurement: 'system_metrics',
            agent_id: agent_id,
            _field: 'memory_usage_percent',
            _value: 65.8
          }
        ];
      }

      const query = `
        from(bucket: "${config.database.influxdb.bucket}")
          |> range(start: ${startTime}, stop: ${endTime})
          |> filter(fn: (r) => r._measurement == "system_metrics")
          |> filter(fn: (r) => r.agent_id == "${agent_id}")
          |> sort(columns: ["_time"])
          |> limit(n: ${limit})
      `;

      const results = [];
      for await (const { values, tableMeta } of this.queryApi.iterateRows(query)) {
        const o = tableMeta.toObject(values);
        results.push(o);
      }

      return results;

    } catch (error) {
      logger.error('❌ Failed to query system data:', error);
      throw error;
    }
  }

  /**
   * 查询网络流量数据
   */
  async queryNetworkData(agent_id, startTime, endTime, limit = 1000) {
    try {
      if (!this.isInitialized) {
        throw new Error('DataStorageService not initialized');
      }

      if (this.mockMode) {
        logger.debug('🌐 Mock mode: Returning mock network data for agent:', agent_id);
        // 返回模拟数据
        return [
          {
            _time: new Date().toISOString(),
            _measurement: 'network_interface_metrics',
            agent_id: agent_id,
            interface: 'eth0',
            _field: 'rx_bytes',
            _value: 1024000
          },
          {
            _time: new Date().toISOString(),
            _measurement: 'network_interface_metrics',
            agent_id: agent_id,
            interface: 'eth0',
            _field: 'tx_bytes',
            _value: 512000
          }
        ];
      }

      const query = `
        from(bucket: "${config.database.influxdb.bucket}")
          |> range(start: ${startTime}, stop: ${endTime})
          |> filter(fn: (r) => r._measurement == "network_interface_metrics")
          |> filter(fn: (r) => r.agent_id == "${agent_id}")
          |> sort(columns: ["_time"])
          |> limit(n: ${limit})
      `;

      const results = [];
      for await (const { values, tableMeta } of this.queryApi.iterateRows(query)) {
        const o = tableMeta.toObject(values);
        results.push(o);
      }

      return results;

    } catch (error) {
      logger.error('❌ Failed to query network data:', error);
      throw error;
    }
  }

  /**
   * 查询安全事件数据
   */
  async querySecurityEvents(agent_id, startTime, endTime, limit = 1000) {
    try {
      if (!this.isInitialized) {
        throw new Error('DataStorageService not initialized');
      }

      if (this.mockMode) {
        logger.debug('🛡️ Mock mode: Returning mock security events for agent:', agent_id);
        // 返回模拟数据
        return [
          {
            _time: new Date().toISOString(),
            _measurement: 'security_events',
            agent_id: agent_id,
            event_type: 'suspicious_connection',
            severity: 'medium',
            _field: 'title',
            _value: '可疑网络连接'
          }
        ];
      }

      const query = `
        from(bucket: "${config.database.influxdb.bucket}")
          |> range(start: ${startTime}, stop: ${endTime})
          |> filter(fn: (r) => r._measurement == "security_events")
          |> filter(fn: (r) => r.agent_id == "${agent_id}")
          |> sort(columns: ["_time"])
          |> limit(n: ${limit})
      `;

      const results = [];
      for await (const { values, tableMeta } of this.queryApi.iterateRows(query)) {
        const o = tableMeta.toObject(values);
        results.push(o);
      }

      return results;

    } catch (error) {
      logger.error('❌ Failed to query security events:', error);
      throw error;
    }
  }

  /**
   * 获取系统性能统计
   */
  async getSystemStats(agent_id, timeRange = '1h') {
    try {
      if (!this.isInitialized) {
        throw new Error('DataStorageService not initialized');
      }

      if (this.mockMode) {
        logger.debug('📊 Mock mode: Returning mock system stats for agent:', agent_id);
        // 返回模拟数据
        return [
          {
            _time: new Date().toISOString(),
            _measurement: 'system_metrics',
            agent_id: agent_id,
            _field: 'cpu_load',
            _value: 45.2
          },
          {
            _time: new Date().toISOString(),
            _measurement: 'system_metrics',
            agent_id: agent_id,
            _field: 'memory_usage_percent',
            _value: 65.8
          }
        ];
      }

      const query = `
        from(bucket: "${config.database.influxdb.bucket}")
          |> range(start: -${timeRange})
          |> filter(fn: (r) => r._measurement == "system_metrics")
          |> filter(fn: (r) => r.agent_id == "${agent_id}")
          |> group()
          |> mean()
      `;

      const results = [];
      for await (const { values, tableMeta } of this.queryApi.iterateRows(query)) {
        const o = tableMeta.toObject(values);
        results.push(o);
      }

      return results;

    } catch (error) {
      logger.error('❌ Failed to get system stats:', error);
      throw error;
    }
  }

  /**
   * 关闭数据存储服务
   */
  async close() {
    try {
      this.stopBatchTimer();
      await this.flushBatch();

      if (this.writeApi) {
        await this.writeApi.close();
      }

      // InfluxDB客户端不需要显式关闭
      // if (this.influxDB) {
      //   await this.influxDB.close();
      // }

      this.isInitialized = false;
      logger.info('✅ DataStorageService closed successfully');

    } catch (error) {
      logger.error('❌ Failed to close DataStorageService:', error);
    }
  }
}

// 创建单例实例
const dataStorageService = new DataStorageService();

module.exports = dataStorageService;
