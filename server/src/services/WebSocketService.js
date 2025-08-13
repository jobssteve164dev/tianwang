const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const url = require('url');
const logger = require('../utils/logger');
const models = require('../models');
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

      logger.debug('WebSocket验证开始:', {
        hasToken: !!token,
        hasConnectionKey: !!connectionKey,
        tokenLength: token?.length,
        connectionKeyLength: connectionKey?.length,
        url: info.req.url
      });

      if (!token) {
        logger.warn('WebSocket连接缺少token');
        return false;
      }

      // 验证JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'tianwang-secret');
      
      logger.debug('JWT token解码成功:', {
        agentId: decoded.agentId,
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
      const agent = await models.Agent.findOne({ where: { agentId: decoded.agentId } });
      if (!agent) {
        logger.warn('WebSocket连接的代理不存在:', decoded.agentId);
        return false;
      }

      logger.debug('代理验证成功:', {
        agentId: decoded.agentId,
        hostname: agent.hostname,
        platform: agent.platform,
        status: agent.status
      });

      // 将代理信息附加到请求对象 - 在连接密钥验证之前就设置
      info.req.agent = agent;
      info.req.agentId = decoded.agentId;

      // 验证连接密钥（如果提供）- 改为更宽松的验证
      if (connectionKey && decoded.connectionKey) {
        logger.debug('开始验证连接密钥:', {
          agentId: decoded.agentId,
          providedConnectionKey: connectionKey.substring(0, 32) + '...',
          expectedConnectionKey: decoded.connectionKey.substring(0, 32) + '...',
          providedLength: connectionKey.length,
          expectedLength: decoded.connectionKey.length
        });

        try {
          // 验证连接密钥 - 比较客户端提供的连接密钥与JWT中存储的连接密钥
          // 两者都应该是完整的连接密钥字符串格式：key:timestamp:signature
          const keyValidation = keyManagementService.verifyConnectionKeyMatch(connectionKey, decoded.connectionKey);
          
          logger.debug('连接密钥验证结果:', {
            agentId: decoded.agentId,
            isValid: keyValidation.isValid,
            error: keyValidation.error
          });
          
          if (!keyValidation.isValid) {
            logger.warn('WebSocket连接密钥验证失败，但允许连接:', { 
              agentId: decoded.agentId,
              reason: keyValidation.error,
              providedSignature: connectionKey.substring(0, 16) + '...',
              expectedKey: decoded.connectionKey.substring(0, 16) + '...'
            });
            // 密钥验证失败，但不拒绝连接，只记录警告
          } else {
            logger.debug('WebSocket连接密钥验证成功:', { 
              agentId: decoded.agentId 
            });
          }
        } catch (keyError) {
          logger.warn('WebSocket连接密钥验证失败，但允许连接:', keyError.message);
          // 密钥验证过程中发生错误，但不拒绝连接，只记录警告
        }
      } else {
        // 如果没有连接密钥，记录调试信息但不拒绝连接
        logger.debug('WebSocket连接未提供连接密钥，但允许连接:', { 
          hasConnectionKey: !!connectionKey, 
          hasDecodedKey: !!decoded.connectionKey,
          agentId: decoded.agentId 
        });
      }

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

    logger.debug('WebSocket连接处理开始:', { 
      agentId, 
      hasAgent: !!agent,
      hostname: agent?.hostname || 'unknown',
      platform: agent?.platform || 'unknown',
      agentStatus: agent?.status || 'unknown'
    });

    try {
      // 检查agentId是否有效
      if (!agentId) {
        logger.error('WebSocket连接缺少有效的agentId');
        ws.close(1008, '无效的agentId');
        return;
      }

      // 存储连接
      this.clients.set(agentId, ws);
      logger.debug('WebSocket连接已存储:', { 
        agentId, 
        totalClients: this.clients.size 
      });

      // 更新代理状态
      if (agent) {
        agent.status = 'online';
        agent.lastSeen = new Date();
        await agent.save();
        logger.debug('代理状态已更新为在线:', { 
          agentId, 
          hostname: agent.hostname,
          status: agent.status,
          lastSeen: agent.lastSeen
        });
      } else {
        logger.warn('代理对象为空，无法更新状态:', { agentId });
      }

      logger.info('代理WebSocket连接已建立:', { 
        agentId, 
        hostname: agent?.hostname || 'unknown',
        platform: agent?.platform || 'unknown',
        totalConnections: this.clients.size
      });

      // 发送欢迎消息
      const welcomeMessage = {
        type: 'welcome',
        message: 'WebSocket连接已建立',
        timestamp: Date.now(),
        agentId: agentId
      };
      
      this.sendToAgent(agentId, welcomeMessage);
      logger.debug('欢迎消息已发送:', { agentId, messageType: welcomeMessage.type });

      // 设置心跳
      this.setupHeartbeat(agentId, ws);
      logger.debug('心跳机制已设置:', { agentId, interval: this.heartbeatInterval });

      // 设置消息处理 - 使用闭包确保agentId正确传递
      ws.on('message', (message) => {
        logger.debug('收到WebSocket消息:', { 
          agentId, 
          messageLength: message.length,
          messagePreview: message.toString().substring(0, 100) + '...'
        });
        this.handleMessage(agentId, message);
      });

      // 设置连接关闭处理 - 使用闭包确保agentId正确传递
      ws.on('close', (code, reason) => {
        logger.debug('WebSocket连接即将关闭:', { 
          agentId, 
          code, 
          reason: reason.toString() 
        });
        this.handleDisconnection(agentId, code, reason);
      });

      // 设置错误处理
      ws.on('error', (error) => {
        logger.error('WebSocket连接错误:', { 
          agentId, 
          error: error.message,
          errorCode: error.code,
          errorType: error.type
        });
      });

    } catch (error) {
      logger.error('处理WebSocket连接失败:', { 
        agentId, 
        error: error.message,
        stack: error.stack
      });
      ws.close(1011, '服务器错误');
    }
  }

  // 处理消息
  async handleMessage(agentId, message) {
    try {
      // 检查agentId是否有效
      if (!agentId) {
        logger.warn('收到消息但agentId无效:', { agentId });
        return;
      }

      logger.debug('开始处理WebSocket消息:', { 
        agentId, 
        messageLength: message.length,
        messageType: typeof message
      });

      const data = JSON.parse(message.toString());
      
      logger.debug('消息解析成功:', { 
        agentId, 
        messageType: data.type,
        hasAgentId: !!data.agentId,
        dataKeys: Object.keys(data)
      });
      
      // 确保消息中包含agentId
      if (!data.agentId) {
        data.agentId = agentId;
        logger.debug('为消息添加agentId:', { agentId });
      }
            
      logger.debug('收到代理消息:', { agentId, type: data.type });

      switch (data.type) {
      case 'heartbeat':
        logger.debug('处理心跳消息:', { agentId, status: data.status });
        await this.handleHeartbeat(agentId, data);
        break;
                    
      case 'data':
        logger.debug('处理数据消息:', { agentId, dataType: data.dataType });
        await this.handleData(agentId, data);
        break;
                    
      case 'pong':
        logger.debug('处理pong消息:', { agentId });
        // 心跳响应，重置心跳计时器
        this.resetHeartbeat(agentId);
        break;
                    
      case 'status':
        logger.debug('处理状态更新消息:', { agentId, status: data.status });
        await this.handleStatusUpdate(agentId, data);
        break;
                    
      default:
        logger.warn('未知消息类型:', { agentId, type: data.type, availableTypes: ['heartbeat', 'data', 'pong', 'status'] });
      }

    } catch (error) {
      logger.error('处理WebSocket消息失败:', { 
        agentId, 
        error: error.message,
        messagePreview: message?.toString().substring(0, 100) + '...',
        stack: error.stack
      });
    }
  }

  // 处理心跳
  async handleHeartbeat(agentId, data) {
    try {
      // 检查agentId是否有效
      if (!agentId) {
        logger.warn('收到心跳但agentId无效:', { agentId });
        return;
      }

      // 更新代理最后活跃时间
      const agent = await models.Agent.findOne({ where: { agentId } });
      if (agent) {
        agent.lastSeen = new Date();
        agent.status = data.status || 'online';
        await agent.save();
        
        logger.debug('代理心跳已处理:', { agentId, status: agent.status });
      } else {
        logger.warn('未找到对应的代理记录:', { agentId });
      }

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
      // 检查agentId是否有效
      if (!agentId) {
        logger.warn('收到数据但agentId无效:', { agentId });
        return;
      }

      // 这里可以直接调用AgentController的数据处理逻辑
      const agentController = require('../controllers/agentController');
      const agent = await models.Agent.findOne({ where: { agentId } });
            
      if (agent) {
        await agentController.processAgentData(
          agent,
          data.dataType,
          data.data,
          data.timestamp
        );
        
        logger.debug('代理数据已处理:', { agentId, dataType: data.dataType });
      } else {
        logger.warn('未找到对应的代理:', { agentId });
      }

    } catch (error) {
      logger.error('处理数据消息失败:', { agentId, error: error.message });
    }
  }

  // 处理状态更新
  async handleStatusUpdate(agentId, data) {
    try {
      const agent = await models.Agent.findOne({ where: { agentId } });
      if (agent) {
        agent.status = data.status;
        agent.lastSeen = new Date();
        await agent.save();
      }

      logger.info('代理状态已更新:', { agentId, status: data.status });

    } catch (error) {
      logger.error('处理状态更新失败:', { agentId, error: error.message });
    }
  }

  // 处理连接断开
  async handleDisconnection(agentId, code, reason) {
    try {
      // 检查agentId是否有效
      if (!agentId) {
        logger.warn('处理连接断开时agentId无效');
        return;
      }

      // 移除连接
      this.clients.delete(agentId);

      // 清除心跳定时器
      this.clearHeartbeat(agentId);

      // 更新代理状态
      const agent = await models.Agent.findOne({ where: { agentId } });
      if (agent) {
        agent.status = 'offline';
        agent.lastSeen = new Date();
        await agent.save();
      }

      logger.info('代理WebSocket连接已断开:', { 
        agentId, 
        code, 
        reason: reason.toString() 
      });

    } catch (error) {
      logger.error('处理连接断开失败:', { agentId, error: error.message });
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