const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const url = require('url');
const logger = require('../utils/logger');
const Agent = require('../models/Agent');
const keyManagementService = require('./KeyManagementService');

class WebSocketService {
  constructor() {
    this.wss = null;
    this.clients = new Map(); // agentId -> WebSocket
    this.heartbeatInterval = 30000; // 30秒心跳
    this.heartbeatTimers = new Map();
  }

  // 初始化WebSocket服务器
  initialize(server) {
    this.wss = new WebSocket.Server({
      server,
      path: '/ws',
      verifyClient: this.verifyClient.bind(this)
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
      const connectionKey = query.connectionKey;

      if (!token) {
        logger.warn('WebSocket连接缺少token');
        return false;
      }

      // 验证JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'tianwang-secret');
            
      if (decoded.type !== 'agent') {
        logger.warn('WebSocket连接token类型错误:', decoded.type);
        return false;
      }

      // 验证连接密钥（如果提供）
      if (connectionKey && decoded.connectionKey) {
        const keyValidation = keyManagementService.verifyConnectionKey({
          key: decoded.connectionKey,
          timestamp: Date.now(),
          signature: connectionKey,
          expiresAt: Date.now() + (60 * 60 * 1000) // 1小时有效期
        });

        if (!keyValidation) {
          logger.warn('WebSocket连接密钥验证失败:', decoded.agentId);
          return false;
        }
      }

      // 验证代理是否存在
      const agent = await Agent.findOne({ agentId: decoded.agentId });
      if (!agent) {
        logger.warn('WebSocket连接的代理不存在:', decoded.agentId);
        return false;
      }

      // 将代理信息附加到请求对象
      info.req.agent = agent;
      info.req.agentId = decoded.agentId;

      return true;
    } catch (error) {
      logger.error('WebSocket客户端验证失败:', error);
      return false;
    }
  }

  // 处理新连接
  async handleConnection(ws, req) {
    const agentId = req.agentId;
    const agent = req.agent;

    try {
      // 存储连接
      this.clients.set(agentId, ws);

      // 更新代理状态
      agent.status = 'online';
      agent.lastSeen = new Date();
      await agent.save();

      logger.info('代理WebSocket连接已建立:', { 
        agentId, 
        hostname: agent.hostname,
        platform: agent.platform 
      });

      // 发送欢迎消息
      this.sendToAgent(agentId, {
        type: 'welcome',
        message: 'WebSocket连接已建立',
        timestamp: Date.now()
      });

      // 设置心跳
      this.setupHeartbeat(agentId, ws);

      // 设置消息处理
      ws.on('message', (message) => {
        this.handleMessage(agentId, message);
      });

      // 设置连接关闭处理
      ws.on('close', (code, reason) => {
        this.handleDisconnection(agentId, code, reason);
      });

      // 设置错误处理
      ws.on('error', (error) => {
        logger.error('WebSocket连接错误:', { agentId, error: error.message });
      });

    } catch (error) {
      logger.error('处理WebSocket连接失败:', error);
      ws.close(1011, '服务器错误');
    }
  }

  // 处理消息
  async handleMessage(agentId, message) {
    try {
      const data = JSON.parse(message.toString());
            
      logger.debug('收到代理消息:', { agentId, type: data.type });

      switch (data.type) {
      case 'heartbeat':
        await this.handleHeartbeat(agentId, data);
        break;
                    
      case 'data':
        await this.handleData(agentId, data);
        break;
                    
      case 'pong':
        // 心跳响应，重置心跳计时器
        this.resetHeartbeat(agentId);
        break;
                    
      case 'status':
        await this.handleStatusUpdate(agentId, data);
        break;
                    
      default:
        logger.warn('未知消息类型:', { agentId, type: data.type });
      }

    } catch (error) {
      logger.error('处理WebSocket消息失败:', { agentId, error: error.message });
    }
  }

  // 处理心跳
  async handleHeartbeat(agentId, data) {
    try {
      // 更新代理最后活跃时间
      await Agent.findOneAndUpdate(
        { agentId },
        { 
          lastSeen: new Date(),
          status: data.status || 'online'
        }
      );

      // 发送心跳响应
      this.sendToAgent(agentId, {
        type: 'heartbeat_ack',
        timestamp: Date.now()
      });

    } catch (error) {
      logger.error('处理心跳失败:', { agentId, error: error.message });
    }
  }

  // 处理数据消息
  async handleData(agentId, data) {
    try {
      // 这里可以直接调用AgentController的数据处理逻辑
      const agentController = require('../controllers/agentController');
      const agent = await Agent.findOne({ agentId });
            
      if (agent) {
        await agentController.processAgentData(
          agent,
          data.dataType,
          data.data,
          data.timestamp
        );
      }

    } catch (error) {
      logger.error('处理数据消息失败:', { agentId, error: error.message });
    }
  }

  // 处理状态更新
  async handleStatusUpdate(agentId, data) {
    try {
      await Agent.findOneAndUpdate(
        { agentId },
        { 
          status: data.status,
          lastSeen: new Date()
        }
      );

      logger.info('代理状态已更新:', { agentId, status: data.status });

    } catch (error) {
      logger.error('处理状态更新失败:', { agentId, error: error.message });
    }
  }

  // 处理连接断开
  async handleDisconnection(agentId, code, reason) {
    try {
      // 移除连接
      this.clients.delete(agentId);

      // 清除心跳定时器
      this.clearHeartbeat(agentId);

      // 更新代理状态
      await Agent.findOneAndUpdate(
        { agentId },
        { 
          status: 'offline',
          lastSeen: new Date()
        }
      );

      logger.info('代理WebSocket连接已断开:', { 
        agentId, 
        code, 
        reason: reason.toString() 
      });

    } catch (error) {
      logger.error('处理连接断开失败:', error);
    }
  }

  // 设置心跳
  setupHeartbeat(agentId, ws) {
    const timer = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        // 发送ping消息
        this.sendToAgent(agentId, {
          type: 'ping',
          timestamp: Date.now()
        });
      } else {
        // 连接已关闭，清除定时器
        this.clearHeartbeat(agentId);
      }
    }, this.heartbeatInterval);

    this.heartbeatTimers.set(agentId, timer);
  }

  // 重置心跳
  resetHeartbeat(agentId) {
    const timer = this.heartbeatTimers.get(agentId);
    if (timer) {
      clearInterval(timer);
      const ws = this.clients.get(agentId);
      if (ws) {
        this.setupHeartbeat(agentId, ws);
      }
    }
  }

  // 清除心跳
  clearHeartbeat(agentId) {
    const timer = this.heartbeatTimers.get(agentId);
    if (timer) {
      clearInterval(timer);
      this.heartbeatTimers.delete(agentId);
    }
  }

  // 发送消息给特定代理
  sendToAgent(agentId, message) {
    const ws = this.clients.get(agentId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(message));
        return true;
      } catch (error) {
        logger.error('发送消息给代理失败:', { agentId, error: error.message });
        return false;
      }
    }
    return false;
  }

  // 发送命令给代理
  sendCommandToAgent(agentId, command) {
    return this.sendToAgent(agentId, {
      type: 'command',
      data: command,
      timestamp: Date.now()
    });
  }

  // 发送配置更新给代理
  sendConfigUpdate(agentId, config) {
    return this.sendToAgent(agentId, {
      type: 'config-update',
      data: config,
      timestamp: Date.now()
    });
  }

  // 发送策略更新给代理
  sendPolicyUpdate(agentId, policy) {
    return this.sendToAgent(agentId, {
      type: 'policy-update',
      data: policy,
      timestamp: Date.now()
    });
  }

  // 广播消息给所有在线代理
  broadcast(message) {
    let successCount = 0;
    for (const [agentId, ws] of this.clients.entries()) {
      if (this.sendToAgent(agentId, message)) {
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
  sendToClient(agentId, message) {
    return this.sendToAgent(agentId, message);
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

      // 关闭WebSocket服务器
      this.wss.close();
      logger.info('WebSocket服务器已关闭');
    }
  }
}

module.exports = new WebSocketService(); 