const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const url = require('url');
const logger = require('../utils/logger');
const models = require('../models');
const keyManagementService = require('./KeyManagementService');
const config = require('../config');
const { randomUUID } = require('crypto');

class WebSocketService {
  constructor() {
    this.wss = null;
    this.clients = new Map(); // agent_id -> WebSocket
    this.heartbeatInterval = 30000; // 30秒心跳
    this.heartbeatTimers = new Map();
    this.pendingTasks = new Map();
  }

  // 初始化WebSocket服务器
  initialize(server) {
    this.wss = new WebSocket.Server({
      server,
      path: '/ws',
      verifyClient: async (info, callback) => {
        try {
          const isValid = await this.verifyClient(info);
          callback(isValid);
        } catch (error) {
          logger.error('WebSocket验证过程中发生错误:', error);
          callback(false);
        }
      }
    });

    this.wss.on('connection', this.handleConnection.bind(this));
        
    logger.info('WebSocket服务器已启动');
    return this.wss;
  }

  // 验证客户端连接
  async verifyClient(info) {
    try {
      const query = url.parse(info.req.url, true).query;
      const token = query.token;
      // 确保连接密钥正确解码
      const rawConnectionKey = query.connectionKey;
      const connectionKey = rawConnectionKey ? decodeURIComponent(rawConnectionKey) : null;

      logger.debug('WebSocket验证开始:', {
        hasToken: !!token,
        hasConnectionKey: !!connectionKey,
        tokenLength: token?.length,
        connectionKeyLength: connectionKey?.length,
        rawConnectionKeyLength: rawConnectionKey?.length
      });

      // 增加URL解码调试信息
      if (rawConnectionKey && connectionKey) {
        logger.debug('URL解码调试:', {
          rawLength: rawConnectionKey.length,
          decodedLength: connectionKey.length,
          hasPlusInRaw: rawConnectionKey.includes('+'),
          hasPlusInDecoded: connectionKey.includes('+'),
          hasSpaceInRaw: rawConnectionKey.includes(' '),
          hasSpaceInDecoded: connectionKey.includes(' ')
        });
      }

      if (!token) {
        logger.warn('WebSocket连接缺少token');
        return false;
      }

      // 验证JWT token
      const decoded = jwt.verify(token, config.jwt.secret);
      
      logger.debug('JWT token解码成功:', {
        agent_id: decoded.agent_id,
        hostname: decoded.hostname,
        type: decoded.type,
        hasConnectionKey: !!decoded.connectionKey,
        connectionKeyLength: decoded.connectionKey?.length
      });
            
      if (decoded.type !== 'agent') {
        logger.warn('WebSocket连接token类型错误:', decoded.type);
        return false;
      }

      // 检查模型是否可用
      if (!models.Agent) {
        logger.warn('Database not available for agent verification');
        return false;
      }

      // 验证代理是否存在
      const agent = await models.Agent.findOne({ where: { agent_id: decoded.agent_id } });
      if (!agent) {
        logger.warn('WebSocket连接的代理不存在:', decoded.agent_id);
        return false;
      }

      logger.debug('代理验证成功:', {
        agent_id: decoded.agent_id,
        hostname: agent.hostname,
        platform: agent.platform,
        status: agent.status
      });

      // 将代理信息附加到请求对象 - 在连接密钥验证之前就设置
      info.req.agent = agent;
      info.req.agent_id = decoded.agent_id;

      if (connectionKey && decoded.connectionKey) {
        logger.debug('开始验证连接密钥:', {
          agent_id: decoded.agent_id,
          providedLength: connectionKey.length,
          expectedLength: decoded.connectionKey.length
        });

        try {
          // 验证连接密钥 - 比较客户端提供的连接密钥与JWT中存储的连接密钥
          // 两者都应该是完整的连接密钥字符串格式：key:timestamp:signature
          const keyValidation = keyManagementService.verifyConnectionKeyMatch(connectionKey, decoded.connectionKey);
          
          logger.debug('连接密钥验证结果:', {
            agent_id: decoded.agent_id,
            isValid: keyValidation.isValid,
            error: keyValidation.error || '无错误'
          });
          
          if (!keyValidation.isValid) {
            logger.warn('WebSocket连接密钥验证失败:', {
              agent_id: decoded.agent_id,
              reason: keyValidation.error || '未知错误',
              providedLength: connectionKey.length,
              expectedLength: decoded.connectionKey.length
            });
            return false;
          } else {
            logger.debug('WebSocket连接密钥验证成功:', { 
              agent_id: decoded.agent_id 
            });
          }
        } catch (keyError) {
          logger.warn('WebSocket连接密钥验证失败:', keyError.message);
          return false;
        }
      } else {
        logger.warn('WebSocket连接缺少连接密钥:', {
          hasConnectionKey: !!connectionKey, 
          hasDecodedKey: !!decoded.connectionKey,
          agent_id: decoded.agent_id 
        });
        return false;
      }

      return true;
    } catch (error) {
      logger.error('WebSocket客户端验证失败:', error);
      return false;
    }
  }

  // 处理新连接
  async handleConnection(ws, req) {
    const agent_id = req.agent_id;
    const agent = req.agent;

    logger.debug('WebSocket连接处理开始:', { 
      agent_id, 
      hasAgent: !!agent,
      hostname: agent?.hostname || 'unknown',
      platform: agent?.platform || 'unknown',
      agentStatus: agent?.status || 'unknown'
    });

    try {
      // 检查agent_id是否有效
      if (!agent_id) {
        logger.error('WebSocket连接缺少有效的agent_id');
        ws.close(1008, '无效的agent_id');
        return;
      }

      // 存储连接
      this.clients.set(agent_id, ws);
      logger.debug('WebSocket连接已存储:', { 
        agent_id, 
        totalClients: this.clients.size 
      });

      // 更新代理状态
      if (agent) {
        agent.status = 'online';
        agent.last_seen = new Date();
        await agent.save();
        logger.debug('代理状态已更新为在线:', { 
          agent_id, 
          hostname: agent.hostname,
          status: agent.status,
          last_seen: agent.last_seen
        });
      } else {
        logger.warn('代理对象为空，无法更新状态:', { agent_id });
      }

      logger.info('代理WebSocket连接已建立:', { 
        agent_id, 
        hostname: agent?.hostname || 'unknown',
        platform: agent?.platform || 'unknown',
        totalConnections: this.clients.size
      });

      // 发送欢迎消息
      const welcomeMessage = {
        type: 'welcome',
        message: 'WebSocket连接已建立',
        timestamp: Date.now(),
        agent_id: agent_id
      };
      
      this.sendToAgent(agent_id, welcomeMessage);
      logger.debug('欢迎消息已发送:', { agent_id, messageType: welcomeMessage.type });

      // 设置心跳
      this.setupHeartbeat(agent_id, ws);
      logger.debug('心跳机制已设置:', { agent_id, interval: this.heartbeatInterval });

      // 设置消息处理 - 使用闭包确保agent_id正确传递
      ws.on('message', (message) => {
        logger.debug('收到WebSocket消息:', { 
          agent_id, 
          messageLength: message.length
        });
        this.handleMessage(agent_id, message);
      });

      // 设置连接关闭处理 - 使用闭包确保agent_id正确传递
      ws.on('close', (code, reason) => {
        logger.debug('WebSocket连接即将关闭:', { 
          agent_id, 
          code, 
          reason: reason.toString() 
        });
        this.handleDisconnection(agent_id, code, reason);
      });

      // 设置错误处理
      ws.on('error', (error) => {
        logger.error('WebSocket连接错误:', { 
          agent_id, 
          error: error.message,
          errorCode: error.code,
          errorType: error.type
        });
      });

    } catch (error) {
      logger.error('处理WebSocket连接失败:', { 
        agent_id, 
        error: error.message,
        stack: error.stack
      });
      ws.close(1011, '服务器错误');
    }
  }

  // 处理消息
  async handleMessage(agent_id, message) {
    try {
      // 检查agent_id是否有效
      if (!agent_id) {
        logger.warn('收到消息但agent_id无效:', { agent_id });
        return;
      }

      logger.debug('开始处理WebSocket消息:', { 
        agent_id, 
        messageLength: message.length,
        messageType: typeof message
      });

      const data = JSON.parse(message.toString());
      
      logger.debug('消息解析成功:', { 
        agent_id, 
        messageType: data.type,
        hasAgentId: !!data.agent_id,
        dataKeys: Object.keys(data)
      });
      
      // 确保消息中包含agent_id
      if (!data.agent_id) {
        data.agent_id = agent_id;
        logger.debug('为消息添加agent_id:', { agent_id });
      }
            
      logger.debug('收到代理消息:', { agent_id, type: data.type });

      switch (data.type) {
      case 'heartbeat':
        logger.debug('处理心跳消息:', { agent_id, status: data.status });
        await this.handleHeartbeat(agent_id, data);
        break;
                    
      case 'data':
        logger.debug('处理数据消息:', { agent_id, dataType: data.dataType });
        await this.handleData(agent_id, data);
        break;
                    
      case 'pong':
        logger.debug('处理pong消息:', { agent_id });
        // 心跳响应，重置心跳计时器
        this.resetHeartbeat(agent_id);
        break;
                    
      case 'status':
        logger.debug('处理状态更新消息:', { agent_id, status: data.status });
        await this.handleStatusUpdate(agent_id, data);
        break;

      case 'task-progress':
        this.handleTaskProgress(agent_id, data);
        break;

      case 'task-result':
        this.handleTaskResult(agent_id, data);
        break;
                    
      default:
        logger.warn('未知消息类型:', { agent_id, type: data.type, availableTypes: ['heartbeat', 'data', 'pong', 'status', 'task-progress', 'task-result'] });
      }

    } catch (error) {
      logger.error('处理WebSocket消息失败:', { 
        agent_id, 
        error: error.message,
        messageLength: message?.length,
        stack: error.stack
      });
    }
  }

  handleTaskProgress(agent_id, data) {
    const pending = this.pendingTasks.get(data.task_id);
    if (!pending || pending.agent_id !== agent_id) return;
    pending.onProgress?.(data.progress || {});
  }

  handleTaskResult(agent_id, data) {
    const pending = this.pendingTasks.get(data.task_id);
    if (!pending || pending.agent_id !== agent_id) {
      logger.warn('收到未知或节点不匹配的任务回执', { agent_id, task_id: data.task_id });
      return;
    }

    clearTimeout(pending.timer);
    this.pendingTasks.delete(data.task_id);
    if (data.status === 'succeeded') {
      pending.resolve(data);
    } else {
      const error = new Error(data.error?.message || '节点任务执行失败');
      error.code = data.error?.code || 'NODE_TASK_FAILED';
      error.result = data;
      pending.reject(error);
    }
  }

  dispatchTask(agent_id, task, options = {}) {
    const task_id = task.task_id || randomUUID();
    const timeoutMs = options.timeoutMs || config.mcp.taskTimeoutMs;
    if (this.pendingTasks.has(task_id)) {
      return Promise.reject(Object.assign(new Error('任务 ID 已在执行'), { code: 'TASK_ALREADY_PENDING' }));
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingTasks.delete(task_id);
        reject(Object.assign(new Error('等待节点任务回执超时'), { code: 'NODE_TASK_TIMEOUT' }));
      }, timeoutMs);

      this.pendingTasks.set(task_id, { agent_id, resolve, reject, timer, onProgress: options.onProgress });
      const sent = this.sendToAgent(agent_id, {
        type: 'task',
        data: { ...task, task_id },
        timestamp: Date.now()
      });

      if (!sent) {
        clearTimeout(timer);
        this.pendingTasks.delete(task_id);
        reject(Object.assign(new Error('目标节点不在线'), { code: 'NODE_OFFLINE' }));
      }
    });
  }

  // 处理心跳
  async handleHeartbeat(agent_id, data) {
    try {
      // 检查agent_id是否有效
      if (!agent_id) {
        logger.warn('收到心跳但agent_id无效:', { agent_id });
        return;
      }

      // 更新代理最后活跃时间
      const agent = await models.Agent.findOne({ where: { agent_id } });
      if (agent) {
        agent.last_seen = new Date();
        agent.status = data.status || 'online';
        await agent.save();
        
        logger.debug('代理心跳已处理:', { agent_id, status: agent.status });
      } else {
        logger.warn('未找到对应的代理记录:', { agent_id });
      }

      // 发送心跳响应
      this.sendToAgent(agent_id, {
        type: 'heartbeat_ack',
        timestamp: Date.now()
      });

    } catch (error) {
      logger.error('处理心跳失败:', { agent_id, error: error.message });
    }
  }

  // 处理数据消息
  async handleData(agent_id, data) {
    try {
      // 检查agent_id是否有效
      if (!agent_id) {
        logger.warn('收到数据但agent_id无效:', { agent_id });
        return;
      }

      // 这里可以直接调用AgentController的数据处理逻辑
      const agentController = require('../controllers/agentController');
      const agent = await models.Agent.findOne({ where: { agent_id } });
            
      if (agent) {
        await agentController.processAgentData(
          agent,
          data.dataType,
          data.data,
          data.timestamp
        );
        
        logger.debug('代理数据已处理:', { agent_id, dataType: data.dataType });
      } else {
        logger.warn('未找到对应的代理:', { agent_id });
      }

    } catch (error) {
      logger.error('处理数据消息失败:', { agent_id, error: error.message });
    }
  }

  // 处理状态更新
  async handleStatusUpdate(agent_id, data) {
    try {
      const agent = await models.Agent.findOne({ where: { agent_id } });
      if (agent) {
        agent.status = data.status;
        agent.last_seen = new Date();
        await agent.save();
      }

      logger.info('代理状态已更新:', { agent_id, status: data.status });

    } catch (error) {
      logger.error('处理状态更新失败:', { agent_id, error: error.message });
    }
  }

  // 处理连接断开
  async handleDisconnection(agent_id, code, reason) {
    try {
      // 检查agent_id是否有效
      if (!agent_id) {
        logger.warn('处理连接断开时agent_id无效');
        return;
      }

      // 移除连接
      this.clients.delete(agent_id);

      for (const [taskId, pending] of this.pendingTasks.entries()) {
        if (pending.agent_id === agent_id) {
          clearTimeout(pending.timer);
          this.pendingTasks.delete(taskId);
          pending.reject(Object.assign(new Error('节点在任务执行期间断开连接'), { code: 'NODE_DISCONNECTED' }));
        }
      }

      // 清除心跳定时器
      this.clearHeartbeat(agent_id);

      // 更新代理状态
      const agent = await models.Agent.findOne({ where: { agent_id } });
      if (agent) {
        agent.status = 'offline';
        agent.last_seen = new Date();
        await agent.save();
      }

      logger.info('代理WebSocket连接已断开:', { 
        agent_id, 
        code, 
        reason: reason.toString() 
      });

    } catch (error) {
      logger.error('处理连接断开失败:', { agent_id, error: error.message });
    }
  }

  // 设置心跳
  setupHeartbeat(agent_id, ws) {
    const timer = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        // 发送ping消息
        this.sendToAgent(agent_id, {
          type: 'ping',
          timestamp: Date.now()
        });
      } else {
        // 连接已关闭，清除定时器
        this.clearHeartbeat(agent_id);
      }
    }, this.heartbeatInterval);

    this.heartbeatTimers.set(agent_id, timer);
  }

  // 重置心跳
  resetHeartbeat(agent_id) {
    const timer = this.heartbeatTimers.get(agent_id);
    if (timer) {
      clearInterval(timer);
      const ws = this.clients.get(agent_id);
      if (ws) {
        this.setupHeartbeat(agent_id, ws);
      }
    }
  }

  // 清除心跳
  clearHeartbeat(agent_id) {
    const timer = this.heartbeatTimers.get(agent_id);
    if (timer) {
      clearInterval(timer);
      this.heartbeatTimers.delete(agent_id);
    }
  }

  // 发送消息给特定代理
  sendToAgent(agent_id, message) {
    const ws = this.clients.get(agent_id);
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(message));
        return true;
      } catch (error) {
        logger.error('发送消息给代理失败:', { agent_id, error: error.message });
        return false;
      }
    }
    return false;
  }

  // 发送命令给代理
  sendCommandToAgent(agent_id, command) {
    return this.sendToAgent(agent_id, {
      type: 'command',
      data: command,
      timestamp: Date.now()
    });
  }

  // 发送配置更新给代理
  sendConfigUpdate(agent_id, config) {
    return this.sendToAgent(agent_id, {
      type: 'config-update',
      data: config,
      timestamp: Date.now()
    });
  }

  // 发送策略更新给代理
  sendPolicyUpdate(agent_id, policy) {
    return this.sendToAgent(agent_id, {
      type: 'policy-update',
      data: policy,
      timestamp: Date.now()
    });
  }

  // 广播消息给所有在线代理
  broadcast(message) {
    let successCount = 0;
    for (const agent_id of this.clients.keys()) {
      if (this.sendToAgent(agent_id, message)) {
        successCount++;
      }
    }
    logger.info('广播消息完成:', { totalClients: this.clients.size, successCount });
    return successCount;
  }

  // 获取在线代理列表
  getOnlineAgents() {
    return Array.from(this.clients.keys());
  }

  // 获取连接的客户端列表
  getConnectedClients() {
    return Array.from(this.clients.keys());
  }

  // 发送消息给特定客户端
  sendToClient(agent_id, message) {
    return this.sendToAgent(agent_id, message);
  }

  // 获取连接统计
  getConnectionStats() {
    return {
      totalConnections: this.clients.size,
      onlineAgents: this.getOnlineAgents(),
      heartbeatTimers: this.heartbeatTimers.size
    };
  }

  // 关闭WebSocket服务器
  close() {
    if (this.wss) {
      // 清除所有心跳定时器
      for (const timer of this.heartbeatTimers.values()) {
        clearInterval(timer);
      }
      this.heartbeatTimers.clear();

      // 关闭所有连接
      for (const ws of this.clients.values()) {
        ws.close(1001, '服务器关闭');
      }
      this.clients.clear();
      for (const pending of this.pendingTasks.values()) {
        clearTimeout(pending.timer);
        pending.reject(Object.assign(new Error('服务正在关闭'), { code: 'SERVER_SHUTDOWN' }));
      }
      this.pendingTasks.clear();

      // 关闭WebSocket服务器
      this.wss.close();
      logger.info('WebSocket服务器已关闭');
    }
  }
}

module.exports = new WebSocketService();
