const models = require('../models');
const logger = require('../utils/logger');
const jwt = require('jsonwebtoken');
const keyManagementService = require('../services/KeyManagementService');
const registrationCodeService = require('../services/RegistrationCodeService');
const deviceFingerprintService = require('../services/DeviceFingerprintService');
const securityEventService = require('../services/SecurityEventService');
const config = require('../config');

class AgentController {
  // 注册代理
  async registerAgent(req, res) {
    try {
      const { enroll } = await import('../core/enrollment.js');
      const agent = await enroll(req.body);
      const agent_id = agent.agent_id;
      const hostname = agent.hostname;
      const platform = agent.platform;
      const fingerprint = agent.device_fingerprint;

      // 生成连接密钥
      const connectionKey = keyManagementService.generateConnectionKey();
      console.log('连接密钥已生成');

      // 生成JWT token
      const token = jwt.sign(
        { 
          agent_id: agent_id, 
          hostname,
          type: 'agent',
          connectionKey: `${connectionKey.key}:${connectionKey.timestamp}:${connectionKey.signature}`
        },
        config.jwt.secret,
        { expiresIn: '7d' }
      );

      console.log('JWT token已生成');

      console.log('新代理注册成功:', { agent_id: agent_id, hostname, platform });
      logger.info('新代理注册成功:', { agent_id: agent_id, hostname, platform });

      res.status(201).json({
        success: true,
        message: '代理注册成功',
        agent: {
          agent_id: agent.agent_id,
          hostname: agent.hostname,
          platform: agent.platform,
          status: agent.status,
          registered_at: agent.registered_at,
          device_fingerprint: fingerprint
        },
        token,
        connectionKey,
        publicKey: keyManagementService.getPublicKey()
      });

    } catch (error) {
      logger.warn('代理注册失败', { reason: error.statusCode || error.name });
      res.status(error.statusCode || 500).json({ success: false,
        message: error.statusCode ? error.message : '代理注册失败' });
    }
  }

  // 记录安全事件
  async recordSecurityEvent(agent, eventType, severity, details = {}) {
    try {
      console.log('记录安全事件:', { eventType, severity, agent_id: agent.agent_id, details });
      
      await securityEventService.record({
        type: eventType,
        alert_type: 'authentication-anomaly',
        severity,
        title: `代理安全事件: ${eventType}`,
        description: `代理 ${agent.agent_id} (${agent.hostname}) 发生安全事件: ${eventType}`,
        details: { hostname: agent.hostname, platform: agent.platform, ...details },
        device_id: agent.device_id,
        agent_id: agent.agent_id,
        organization_id: agent.organization_id,
        source: 'agent-auth',
        tags: ['agent', 'authentication']
      });

      console.log('安全事件记录成功:', { eventType, agent_id: agent.agent_id });
    } catch (error) {
      console.error('记录安全事件失败:', error);
      // 不抛出错误，避免影响主要流程
    }
  }

  // 代理认证
  async authenticateAgent(req, res) {
    try {
      const agent_id = req.body.agent_id || req.body.agentId;
      const hostname = req.body.hostname;
      const device_fingerprint = req.body.device_fingerprint || req.body.deviceFingerprint;

      console.log('代理认证请求:', { agent_id: agent_id, hostname, hasFingerprint: !!device_fingerprint });

      if (!agent_id || !hostname) {
        console.warn('代理认证缺少必需字段:', { agent_id: agent_id, hostname });
        return res.status(400).json({
          success: false,
          message: '缺少必需字段: agent_id, hostname'
        });
      }

      // 查找代理
      console.log('查找代理:', { agent_id: agent_id, hostname });
      const agent = await models.Agent?.findOne({ where: { agent_id, hostname } });
            
      if (!agent) {
        console.warn('代理不存在:', { agent_id: agent_id, hostname });
        return res.status(404).json({
          success: false,
          message: '代理不存在，请先注册'
        });
      }

      console.log('找到代理:', { 
        agent_id: agent.agent_id, 
        hostname: agent.hostname, 
        platform: agent.platform,
        hasStoredFingerprint: !!agent.device_fingerprint 
      });

      if (!agent.device_fingerprint || device_fingerprint !== agent.device_fingerprint) {
        return res.status(401).json({ success: false, message: '设备认证失败', code: 'DEVICE_FINGERPRINT_MISMATCH' });
      }

      // 更新最后活跃时间
      agent.last_seen = new Date();
      agent.status = 'online';
      await agent.save();

      console.log('代理状态已更新:', { agent_id, hostname, status: agent.status });

      // 生成连接密钥
      const connectionKey = keyManagementService.generateConnectionKey();

      console.log('连接密钥生成详情:', {
        keyLength: connectionKey.key.length,
        timestamp: connectionKey.timestamp,
        signatureLength: connectionKey.signature.length,
        expiresAt: connectionKey.expiresAt
      });

      // 构建完整的连接密钥字符串
      const fullConnectionKey = `${connectionKey.key}:${connectionKey.timestamp}:${connectionKey.signature}`;

      console.log('完整连接密钥字符串:', {
        fullConnectionKeyLength: fullConnectionKey.length,
        timestamp: connectionKey.timestamp
      });

      // 生成新的JWT token
      const token = jwt.sign(
        { 
          agent_id: agent.agent_id, 
          hostname: agent.hostname,
          type: 'agent',
          connectionKey: fullConnectionKey
        },
        config.jwt.secret,
        { expiresIn: '7d' }
      );

      console.log('JWT token生成详情:', {
        agent_id: agent.agent_id,
        hostname: agent.hostname,
        type: 'agent',
        connectionKeyLength: fullConnectionKey.length,
        tokenLength: token.length
      });

      console.log('代理认证成功:', { agent_id, hostname });

      res.json({
        success: true,
        message: '代理认证成功',
        agent: {
          agent_id: agent.agent_id,
          hostname: agent.hostname,
          platform: agent.platform,
          status: agent.status,
          last_seen: agent.last_seen,
          device_fingerprint: agent.device_fingerprint
        },
        token,
        connectionKey,
        publicKey: keyManagementService.getPublicKey()
      });

    } catch (error) {
      console.error('代理认证失败:', error);
      logger.error('代理认证失败:', error);
      res.status(500).json({
        success: false,
        message: '代理认证失败',
        error: error.message
      });
    }
  }

  // 接收代理数据
  async receiveData(req, res) {
    try {
      const { agent_id } = req.params;
      if (!req.user?.isAgent || req.agentId !== agent_id) {
        return res.status(403).json({ success: false, message: '只能上报当前设备的数据' });
      }
      const { type, data, timestamp } = req.body;

      if (!type || !data) {
        return res.status(400).json({
          success: false,
          message: '缺少必需字段: type, data'
        });
      }

      // 验证代理存在
      const agent = await models.Agent?.findOne({ where: { agent_id } });
      if (!agent) {
        return res.status(404).json({
          success: false,
          message: '代理不存在'
        });
      }

      // 处理不同类型的数据
      const receipt = await this.processAgentData(agent, type, data, timestamp, req.body.messageId ?? req.body.message_id);

      logger.debug('接收代理数据:', { agent_id, type, dataSize: JSON.stringify(data).length });

      res.json({
        success: true,
        message: '数据接收成功',
        ...receipt,
        timestamp: Date.now()
      });

    } catch (error) {
      logger.error('接收代理数据失败:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: '数据接收失败',
        code: error.code || 'TELEMETRY_WRITE_FAILED'
      });
    }
  }

  // 处理代理数据
  async processAgentData(agent, type, data, timestamp, messageId) {
    const { ingest } = await import('../core/telemetry.js');
    return ingest(agent, type, data, timestamp, messageId);
  }

  // 获取代理列表
  async getAgents(req, res) {
    try {
      const { page = 1, limit = 20, status, platform } = req.query;
            
      const filter = {};
      if (status) filter.status = status;
      if (platform) filter.platform = platform;
            
      // 添加组织过滤
      filter.organization_id = req.organizationId;

      const agents = await models.Agent?.findAll({
        where: filter,
        order: [['last_seen', 'DESC']],
        limit: limit * 1,
        offset: (page - 1) * limit,
        attributes: { exclude: ['system_info', 'device_fingerprint'] }
      });

      const total = await models.Agent?.count({ where: filter });

      res.json({
        success: true,
        data: {
          agents,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit)
          }
        }
      });

    } catch (error) {
      logger.error('获取代理列表失败:', error);
      res.status(500).json({
        success: false,
        message: '获取代理列表失败',
        error: error.message
      });
    }
  }

  // 生成注册码
  async generateRegistrationCode(req, res) {
    try {
      const {
        count = 1,
        expiry = 24 * 60 * 60 * 1000, // 24小时
        maxUses = 1,
        permissions = ['basic'],
        description = ''
      } = req.body;

      const options = {
        expiry,
        maxUses,
        permissions,
        description,
        createdBy: req.user?.username || 'system'
      };

      let codes;
      if (count === 1) {
        codes = [await registrationCodeService.generateRegistrationCode(options)];
      } else {
        codes = await registrationCodeService.generateBatchRegistrationCodes(count, options);
      }

      logger.info('注册码生成成功:', { 
        count, 
        createdBy: options.createdBy
      });

      res.json({
        success: true,
        message: '注册码生成成功',
        data: {
          codes: codes.map(code => ({
            code: code.code,
            expiry: code.expiry,
            maxUses: code.maxUses,
            permissions: code.permissions,
            description: code.description
          })),
          count: codes.length
        }
      });

    } catch (error) {
      logger.error('生成注册码失败:', error);
      res.status(500).json({
        success: false,
        message: '生成注册码失败',
        error: error.message
      });
    }
  }

  // 获取注册码列表
  async getRegistrationCodes(req, res) {
    try {
      const { status, createdBy, limit = 100 } = req.query;

      const filters = { status, createdBy, limit: parseInt(limit) };
      const codes = await registrationCodeService.getRegistrationCodes(filters);

      res.json({
        success: true,
        data: {
          codes,
          count: codes.length
        }
      });

    } catch (error) {
      logger.error('获取注册码列表失败:', error);
      res.status(500).json({
        success: false,
        message: '获取注册码列表失败',
        error: error.message
      });
    }
  }

  // 获取注册码统计
  async getRegistrationCodeStats(req, res) {
    try {
      const stats = await registrationCodeService.getRegistrationCodeStats();

      res.json({
        success: true,
        data: stats
      });

    } catch (error) {
      logger.error('获取注册码统计失败:', error);
      res.status(500).json({
        success: false,
        message: '获取注册码统计失败',
        error: error.message
      });
    }
  }

  // 停用注册码
  async disableRegistrationCode(req, res) {
    try {
      const { code } = req.params;

      const result = await registrationCodeService.disableRegistrationCode(code);

      if (result.success) {
        res.json({
          success: true,
          message: result.message
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.error,
          code: result.code
        });
      }

    } catch (error) {
      logger.error('停用注册码失败:', error);
      res.status(500).json({
        success: false,
        message: '停用注册码失败',
        error: error.message
      });
    }
  }

  // 延长注册码有效期
  async extendRegistrationCode(req, res) {
    try {
      const { code } = req.params;
      const { additionalExpiry } = req.body;

      if (!additionalExpiry) {
        return res.status(400).json({
          success: false,
          message: '缺少必需字段: additionalExpiry'
        });
      }

      const result = await registrationCodeService.extendRegistrationCode(code, additionalExpiry);

      if (result.success) {
        res.json({
          success: true,
          newExpiry: result.newExpiry
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.error,
          code: result.code
        });
      }

    } catch (error) {
      logger.error('延长注册码有效期失败:', error);
      res.status(500).json({
        success: false,
        message: '延长注册码有效期失败',
        error: error.message
      });
    }
  }

  // 获取安全服务状态
  async getSecurityStatus(req, res) {
    try {
      const keyStatus = keyManagementService.getStatus();
      const fingerprintStatus = deviceFingerprintService.getStatus();
      const registrationStatus = registrationCodeService.getStatus();

      res.json({
        success: true,
        data: {
          keyManagement: keyStatus,
          device_fingerprint: fingerprintStatus,
          registrationCode: registrationStatus
        }
      });

    } catch (error) {
      logger.error('获取安全服务状态失败:', error);
      res.status(500).json({
        success: false,
        message: '获取安全服务状态失败',
        error: error.message
      });
    }
  }

  // 获取代理详情
  async getAgent(req, res) {
    try {
      const { agent_id } = req.params;
            
      const agent = await models.Agent?.findOne({ where: { agent_id } });
      if (!agent) {
        return res.status(404).json({
          success: false,
          message: '代理不存在'
        });
      }

      res.json({
        success: true,
        data: { agent }
      });

    } catch (error) {
      logger.error('获取代理详情失败:', error);
      res.status(500).json({
        success: false,
        message: '获取代理详情失败',
        error: error.message
      });
    }
  }

  // 更新代理状态
  async updateAgentStatus(req, res) {
    try {
      const { agent_id } = req.params;
      const { status } = req.body;

      if (!['online', 'offline', 'maintenance', 'error'].includes(status)) {
        return res.status(400).json({
          success: false,
          message: '无效的状态值'
        });
      }

      const agent = await models.Agent?.findOne({ where: { agent_id } });
      if (agent) {
        agent.status = status;
        agent.last_seen = new Date();
        await agent.save();
      }

      if (!agent) {
        return res.status(404).json({
          success: false,
          message: '代理不存在'
        });
      }

      logger.info('代理状态已更新:', { agent_id, status });

      res.json({
        success: true,
        message: '代理状态已更新',
        data: { agent }
      });

    } catch (error) {
      logger.error('更新代理状态失败:', error);
      res.status(500).json({
        success: false,
        message: '更新代理状态失败',
        error: error.message
      });
    }
  }

  // 删除代理
  async deleteAgent(req, res) {
    try {
      const { agent_id } = req.params;
            
      const agent = await models.Agent?.findOne({ where: { agent_id } });
      if (agent) {
        await agent.destroy();
      }
      if (!agent) {
        return res.status(404).json({
          success: false,
          message: '代理不存在'
        });
      }

      logger.info('代理已删除:', { agent_id });

      res.json({
        success: true,
        message: '代理已删除'
      });

    } catch (error) {
      logger.error('删除代理失败:', error);
      res.status(500).json({
        success: false,
        message: '删除代理失败',
        error: error.message
      });
    }
  }

  // 代理心跳
  async heartbeat(req, res) {
    try {
      const { agent_id } = req.params;
            
      const agent = await models.Agent?.findOne({ where: { agent_id } });
      if (agent) {
        agent.last_seen = new Date();
        agent.status = 'online';
        await agent.save();
      }

      if (!agent) {
        return res.status(404).json({
          success: false,
          message: '代理不存在'
        });
      }

      res.json({
        success: true,
        message: 'Heartbeat received',
        timestamp: Date.now()
      });

    } catch (error) {
      logger.error('代理心跳处理失败:', error);
      res.status(500).json({
        success: false,
        message: '心跳处理失败',
        error: error.message
      });
    }
  }
}

module.exports = new AgentController();
