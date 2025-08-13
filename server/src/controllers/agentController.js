const models = require('../models');
const SecurityEvent = require('../models/SecurityEvent');
const logger = require('../utils/logger');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const keyManagementService = require('../services/KeyManagementService');
const deviceFingerprintService = require('../services/DeviceFingerprintService');
const registrationCodeService = require('../services/RegistrationCodeService');

class AgentController {
  // 注册代理
  async registerAgent(req, res) {
    try {
      const {
        agentId,
        hostname,
        platform,
        arch,
        version,
        capabilities,
        systemInfo,
        registrationCode,
        deviceFingerprint
      } = req.body;

      console.log('代理注册请求:', {
        agentId,
        hostname,
        platform,
        hasRegistrationCode: !!registrationCode,
        hasFingerprint: !!deviceFingerprint,
        fingerprint: deviceFingerprint?.substring(0, 16) + '...'
      });

      // 验证必需字段
      if (!agentId || !hostname || !platform) {
        console.warn('代理注册缺少必需字段:', { agentId, hostname, platform });
        return res.status(400).json({
          success: false,
          message: '缺少必需字段: agentId, hostname, platform'
        });
      }

      // 验证注册码（如果提供）
      if (registrationCode) {
        console.log('验证注册码:', registrationCode.substring(0, 8) + '...');
        const deviceInfo = {
          agentId,
          hostname,
          platform,
          fingerprint: deviceFingerprint
        };

        const codeValidation = await registrationCodeService.validateRegistrationCode(registrationCode, deviceInfo);
        console.log('注册码验证结果:', { isValid: codeValidation.isValid, error: codeValidation.error });
        
        if (!codeValidation.isValid) {
          console.warn('注册码验证失败:', codeValidation.error);
          return res.status(400).json({
            success: false,
            message: codeValidation.error,
            code: codeValidation.code
          });
        }

        // 增加注册码使用次数
        await registrationCodeService.incrementCodeUsage(registrationCode, agentId, deviceFingerprint);
        console.log('注册码使用次数已增加');
      }

      // 检查代理是否已存在
      console.log('检查代理是否已存在:', { agentId });
      
      // 检查模型是否可用
      if (!models.Agent) {
        console.error('Agent模型不可用');
        return res.status(503).json({
          error: 'Database not available',
          code: 'DB_UNAVAILABLE'
        });
      }

      let agent = await models.Agent.findOne({ agentId });
            
      if (agent) {
        console.log('代理已存在，更新信息:', { agentId, hostname });
        
        // 更新现有代理信息
        agent.hostname = hostname;
        agent.platform = platform;
        agent.arch = arch;
        agent.version = version;
        agent.capabilities = capabilities;
        agent.systemInfo = systemInfo;
        agent.deviceFingerprint = deviceFingerprint;
        agent.lastSeen = new Date();
        agent.status = 'online';
                
        await agent.save();
                
        console.log('代理信息已更新:', { agentId, hostname });
        logger.info('代理信息已更新:', { agentId, hostname });
                
        return res.status(409).json({
          success: false,
          message: '代理已存在，请使用认证接口获取token',
          agentId
        });
      }

      console.log('代理不存在，创建新代理');

      // 生成设备指纹（如果未提供）
      let fingerprint = deviceFingerprint;
      if (!fingerprint && systemInfo) {
        console.log('生成设备指纹...');
        const fingerprintResult = deviceFingerprintService.generateFingerprint({
          hostname,
          platform,
          arch,
          ...systemInfo
        });
        fingerprint = fingerprintResult.fingerprint;
        console.log('生成的设备指纹:', fingerprint.substring(0, 16) + '...');
      }

      // 创建新代理
      agent = new models.Agent({
        agentId,
        name: hostname, // 使用hostname作为name
        hostname,
        platform,
        arch,
        version: version || '1.0.0',
        capabilities: capabilities || [],
        systemInfo: systemInfo || {},
        deviceFingerprint: fingerprint,
        status: 'online',
        registeredAt: new Date(),
        lastSeen: new Date(),
        organizationId: req.user?.organizationId // 如果用户已认证
      });

      await agent.save();
      console.log('新代理已保存到数据库:', { agentId, hostname });

      // 使用注册码（如果提供）
      if (registrationCode) {
        console.log('使用注册码...');
        const deviceInfo = {
          agentId,
          hostname,
          platform,
          fingerprint
        };
        await registrationCodeService.useRegistrationCode(registrationCode, deviceInfo);
        console.log('注册码使用完成');
      }

      // 生成连接密钥
      const connectionKey = keyManagementService.generateConnectionKey();
      console.log('连接密钥已生成');

      // 生成JWT token
      const token = jwt.sign(
        { 
          agentId, 
          hostname,
          type: 'agent',
          connectionKey: connectionKey.key
        },
        process.env.JWT_SECRET || 'tianwang-secret',
        { expiresIn: '7d' }
      );

      console.log('JWT token已生成');

      console.log('新代理注册成功:', { agentId, hostname, platform });
      logger.info('新代理注册成功:', { agentId, hostname, platform });

      res.status(201).json({
        success: true,
        message: '代理注册成功',
        agent: {
          agentId: agent.agentId,
          hostname: agent.hostname,
          platform: agent.platform,
          status: agent.status,
          registeredAt: agent.registeredAt,
          deviceFingerprint: fingerprint
        },
        token,
        connectionKey,
        publicKey: keyManagementService.getPublicKey()
      });

    } catch (error) {
      console.error('代理注册失败:', error);
      logger.error('代理注册失败:', error);
      res.status(500).json({
        success: false,
        message: '代理注册失败',
        error: error.message
      });
    }
  }

  // 记录安全事件
  async recordSecurityEvent(agent, eventType, severity, details = {}) {
    try {
      console.log('记录安全事件:', { eventType, severity, agentId: agent.agentId, details });
      
      // 检查SecurityEvent模型是否可用
      if (!models.SecurityEvent) {
        console.warn('SecurityEvent模型不可用，跳过安全事件记录');
        return;
      }

      await models.SecurityEvent.create({
        event_type: eventType,
        severity: severity,
        title: `代理安全事件: ${eventType}`,
        description: `代理 ${agent.agentId} (${agent.hostname}) 发生安全事件: ${eventType}`,
        raw_data: {
          agentId: agent.agentId,
          hostname: agent.hostname,
          platform: agent.platform,
          ...details
        },
        device_id: agent.id,
        status: 'open'
      });

      console.log('安全事件记录成功:', { eventType, agentId: agent.agentId });
    } catch (error) {
      console.error('记录安全事件失败:', error);
      // 不抛出错误，避免影响主要流程
    }
  }

  // 代理认证
  async authenticateAgent(req, res) {
    try {
      const { agentId, hostname, deviceFingerprint } = req.body;

      console.log('代理认证请求:', { agentId, hostname, hasFingerprint: !!deviceFingerprint });

      if (!agentId || !hostname) {
        console.warn('代理认证缺少必需字段:', { agentId, hostname });
        return res.status(400).json({
          success: false,
          message: '缺少必需字段: agentId, hostname'
        });
      }

      // 查找代理
      console.log('查找代理:', { agentId, hostname });
      const agent = await models.Agent.findOne({ agentId, hostname });
            
      if (!agent) {
        console.warn('代理不存在:', { agentId, hostname });
        return res.status(404).json({
          success: false,
          message: '代理不存在，请先注册'
        });
      }

      console.log('找到代理:', { 
        agentId: agent.agentId, 
        hostname: agent.hostname, 
        platform: agent.platform,
        hasStoredFingerprint: !!agent.deviceFingerprint 
      });

      // 验证设备指纹（如果提供）
      if (deviceFingerprint && agent.deviceFingerprint) {
        console.log('开始设备指纹验证:', {
          providedFingerprint: deviceFingerprint.substring(0, 16) + '...',
          storedFingerprint: agent.deviceFingerprint.substring(0, 16) + '...'
        });

        // 构建完整的设备信息用于指纹验证
        const deviceInfoForVerification = {
          hostname: hostname,
          platform: agent.platform,
          arch: agent.arch,
          // 从存储的系统信息中提取其他必要信息
          macAddresses: agent.systemInfo?.macAddresses || [],
          cpuInfo: agent.systemInfo?.cpu || {},
          memoryInfo: agent.systemInfo?.memory || {},
          diskInfo: agent.systemInfo?.diskInfo || [],
          networkInterfaces: agent.systemInfo?.networkInterfaces || [],
          systemUuid: agent.systemInfo?.systemUuid || '',
          biosInfo: agent.systemInfo?.biosInfo || {}
        };

        console.log('设备信息用于验证:', {
          hostname: deviceInfoForVerification.hostname,
          platform: deviceInfoForVerification.platform,
          arch: deviceInfoForVerification.arch,
          macCount: deviceInfoForVerification.macAddresses.length,
          diskCount: deviceInfoForVerification.diskInfo.length
        });

        const fingerprintValidation = deviceFingerprintService.verifyFingerprint(
          agent.deviceFingerprint, 
          deviceInfoForVerification
        );
        
        console.log('设备指纹验证结果:', {
          isValid: fingerprintValidation.isValid,
          expected: agent.deviceFingerprint.substring(0, 16) + '...',
          actual: deviceFingerprint.substring(0, 16) + '...',
          currentGenerated: fingerprintValidation.currentFingerprint?.substring(0, 16) + '...'
        });
        
        if (!fingerprintValidation.isValid) {
          console.warn('设备指纹验证失败:', { 
            agentId, 
            hostname,
            expected: agent.deviceFingerprint.substring(0, 16) + '...',
            actual: deviceFingerprint.substring(0, 16) + '...',
            currentGenerated: fingerprintValidation.currentFingerprint?.substring(0, 16) + '...'
          });
          
          // 记录安全事件
          await this.recordSecurityEvent(agent, 'fingerprint_mismatch', 'high', {
            expected: agent.deviceFingerprint,
            actual: deviceFingerprint,
            currentGenerated: fingerprintValidation.currentFingerprint
          });
        }
      } else {
        console.log('跳过设备指纹验证:', { 
          hasProvidedFingerprint: !!deviceFingerprint, 
          hasStoredFingerprint: !!agent.deviceFingerprint 
        });
      }

      // 更新最后活跃时间
      agent.lastSeen = new Date();
      agent.status = 'online';
      await agent.save();

      console.log('代理状态已更新:', { agentId, hostname, status: agent.status });

      // 生成连接密钥
      const connectionKey = keyManagementService.generateConnectionKey();

      // 生成新的JWT token
      const token = jwt.sign(
        { 
          agentId: agent.agentId, 
          hostname: agent.hostname,
          type: 'agent',
          connectionKey: connectionKey.key
        },
        process.env.JWT_SECRET || 'tianwang-secret',
        { expiresIn: '7d' }
      );

      console.log('代理认证成功:', { agentId, hostname });

      res.json({
        success: true,
        message: '代理认证成功',
        agent: {
          agentId: agent.agentId,
          hostname: agent.hostname,
          platform: agent.platform,
          status: agent.status,
          lastSeen: agent.lastSeen,
          deviceFingerprint: agent.deviceFingerprint
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
      const { agentId } = req.params;
      const { type, data, timestamp } = req.body;

      if (!type || !data) {
        return res.status(400).json({
          success: false,
          message: '缺少必需字段: type, data'
        });
      }

      // 验证代理存在
      const agent = await models.Agent.findOne({ agentId });
      if (!agent) {
        return res.status(404).json({
          success: false,
          message: '代理不存在'
        });
      }

      // 更新代理最后活跃时间
      agent.lastSeen = new Date();
      agent.dataReceivedAt = new Date();
      await agent.save();

      // 处理不同类型的数据
      await this.processAgentData(agent, type, data, timestamp);

      logger.debug('接收代理数据:', { agentId, type, dataSize: JSON.stringify(data).length });

      res.json({
        success: true,
        message: '数据接收成功',
        timestamp: Date.now()
      });

    } catch (error) {
      logger.error('接收代理数据失败:', error);
      res.status(500).json({
        success: false,
        message: '数据接收失败',
        error: error.message
      });
    }
  }

  // 处理代理数据
  async processAgentData(agent, type, data, timestamp) {
    try {
      const processedData = {
        agentId: agent.agentId,
        hostname: agent.hostname,
        platform: agent.platform,
        type,
        data,
        timestamp: timestamp || Date.now(),
        receivedAt: new Date()
      };

      switch (type) {
      case 'system':
        await this.processSystemData(processedData);
        break;
                    
      case 'network':
        await this.processNetworkData(processedData);
        break;
                    
      case 'logs':
        await this.processLogData(processedData);
        break;
                    
      case 'security':
        await this.processSecurityData(processedData);
        break;
                    
      default:
        logger.warn('未知数据类型:', type);
      }

      // 检测安全威胁
      await this.detectThreats(processedData);

    } catch (error) {
      logger.error('处理代理数据失败:', error);
    }
  }

  // 处理系统数据
  async processSystemData(data) {
    try {
      // 存储系统性能数据到时序数据库
      // TODO: 实现InfluxDB存储逻辑
            
      // 检查系统异常
      if (data.data.system) {
        const system = data.data.system;
                
        // 检查CPU使用率
        if (system.cpu && system.cpu.load > 90) {
          await this.createSecurityEvent({
            agentId: data.agentId,
            type: 'system_alert',
            severity: 'medium',
            title: 'CPU使用率过高',
            description: `CPU使用率达到 ${system.cpu.load}%`,
            metadata: { cpu_load: system.cpu.load }
          });
        }
                
        // 检查内存使用率
        if (system.memory && parseFloat(system.memory.usage) > 90) {
          await this.createSecurityEvent({
            agentId: data.agentId,
            type: 'system_alert',
            severity: 'medium',
            title: '内存使用率过高',
            description: `内存使用率达到 ${system.memory.usage}%`,
            metadata: { memory_usage: system.memory.usage }
          });
        }
      }
            
      logger.debug('系统数据处理完成:', { agentId: data.agentId });
    } catch (error) {
      logger.error('处理系统数据失败:', error);
    }
  }

  // 处理网络数据
  async processNetworkData(data) {
    try {
      // 存储网络流量数据
      // TODO: 实现InfluxDB存储逻辑
            
      // 检查网络异常
      if (data.data.suspicious && data.data.suspicious.length > 0) {
        for (const suspicious of data.data.suspicious) {
          await this.createSecurityEvent({
            agentId: data.agentId,
            type: 'network_threat',
            severity: this.mapSeverity(suspicious.severity),
            title: suspicious.type,
            description: suspicious.message,
            metadata: suspicious
          });
        }
      }
            
      logger.debug('网络数据处理完成:', { agentId: data.agentId });
    } catch (error) {
      logger.error('处理网络数据失败:', error);
    }
  }

  // 处理日志数据
  async processLogData(data) {
    try {
      // 存储日志数据
      // TODO: 实现日志存储和分析逻辑
            
      logger.debug('日志数据处理完成:', { agentId: data.agentId });
    } catch (error) {
      logger.error('处理日志数据失败:', error);
    }
  }

  // 处理安全数据
  async processSecurityData(data) {
    try {
      // 处理安全威胁数据
      if (data.data.threats && data.data.threats.length > 0) {
        for (const threat of data.data.threats) {
          await this.createSecurityEvent({
            agentId: data.agentId,
            type: threat.type,
            severity: this.mapSeverity(threat.severity),
            title: threat.type,
            description: threat.description,
            metadata: threat
          });
        }
      }
            
      logger.debug('安全数据处理完成:', { agentId: data.agentId });
    } catch (error) {
      logger.error('处理安全数据失败:', error);
    }
  }

  // 威胁检测
  async detectThreats(data) {
    try {
      // TODO: 实现AI威胁检测逻辑
      // 这里可以集成机器学习模型或规则引擎
            
      logger.debug('威胁检测完成:', { agentId: data.agentId });
    } catch (error) {
      logger.error('威胁检测失败:', error);
    }
  }

  // 创建安全事件
  async createSecurityEvent(eventData) {
    try {
      const event = new SecurityEvent({
        agentId: eventData.agentId,
        type: eventData.type,
        severity: eventData.severity,
        title: eventData.title,
        description: eventData.description,
        metadata: eventData.metadata,
        timestamp: new Date(),
        status: 'open'
      });

      await event.save();
      logger.info('安全事件已创建:', { 
        agentId: eventData.agentId, 
        type: eventData.type,
        severity: eventData.severity 
      });
            
      return event;
    } catch (error) {
      logger.error('创建安全事件失败:', error);
    }
  }

  // 映射严重程度
  mapSeverity(severity) {
    const severityMap = {
      'low': 'low',
      'medium': 'medium',
      'high': 'high',
      'critical': 'critical'
    };
    return severityMap[severity] || 'medium';
  }

  // 获取代理列表
  async getAgents(req, res) {
    try {
      const { page = 1, limit = 20, status, platform } = req.query;
            
      const filter = {};
      if (status) filter.status = status;
      if (platform) filter.platform = platform;
            
      // 添加组织过滤
      if (req.user?.organizationId) {
        filter.organizationId = req.user.organizationId;
      }

      const agents = await Agent.find(filter)
        .sort({ lastSeen: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .select('-systemInfo.sensitive'); // 排除敏感系统信息

      const total = await Agent.countDocuments(filter);

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
        createdBy: options.createdBy,
        codes: codes.map(c => c.code)
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

      const result = registrationCodeService.disableRegistrationCode(code);

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

      const result = registrationCodeService.extendRegistrationCode(code, additionalExpiry);

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
          deviceFingerprint: fingerprintStatus,
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
      const { agentId } = req.params;
            
      const agent = await Agent.findOne({ agentId });
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
      const { agentId } = req.params;
      const { status } = req.body;

      if (!['online', 'offline', 'maintenance'].includes(status)) {
        return res.status(400).json({
          success: false,
          message: '无效的状态值'
        });
      }

      const agent = await Agent.findOneAndUpdate(
        { agentId },
        { status, lastSeen: new Date() },
        { new: true }
      );

      if (!agent) {
        return res.status(404).json({
          success: false,
          message: '代理不存在'
        });
      }

      logger.info('代理状态已更新:', { agentId, status });

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
      const { agentId } = req.params;
            
      const agent = await Agent.findOneAndDelete({ agentId });
      if (!agent) {
        return res.status(404).json({
          success: false,
          message: '代理不存在'
        });
      }

      logger.info('代理已删除:', { agentId });

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
      const { agentId } = req.params;
            
      const agent = await Agent.findOneAndUpdate(
        { agentId },
        { 
          lastSeen: new Date(),
          status: 'online'
        },
        { new: true }
      );

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