const models = require('../models');
const logger = require('../utils/logger');
const jwt = require('jsonwebtoken');
const keyManagementService = require('../services/KeyManagementService');
const deviceFingerprintService = require('../services/DeviceFingerprintService');
const registrationCodeService = require('../services/RegistrationCodeService');
const securityEventService = require('../services/SecurityEventService');
const config = require('../config');

class AgentController {
  // 注册代理
  async registerAgent(req, res) {
    try {
      const {
        agent_id: agent_idRaw,
        hostname,
        platform,
        arch,
        version,
        capabilities,
        system_info: systemInfoRaw,
        registrationCode,
        device_fingerprint: deviceFingerprintRaw
      } = req.body;
      const agent_id = agent_idRaw || req.body.agentId;
      const system_info = systemInfoRaw || req.body.systemInfo;
      const device_fingerprint = deviceFingerprintRaw || req.body.deviceFingerprint;

      console.log('代理注册请求:', {
        agent_id: agent_id,
        hostname,
        platform,
        hasRegistrationCode: !!registrationCode,
        hasFingerprint: !!device_fingerprint
      });

      // 验证必需字段
      if (!agent_id || !hostname || !platform) {
        console.warn('代理注册缺少必需字段:', { agent_id: agent_id, hostname, platform });
        return res.status(400).json({
          success: false,
          message: '缺少必需字段: agent_id, hostname, platform'
        });
      }

      // 验证注册码（如果提供）
      if (registrationCode) {
        console.log('验证注册码');
        const deviceInfo = {
          agent_id: agent_id,
          hostname,
          platform,
          fingerprint: device_fingerprint
        };

        const codeValidation = await registrationCodeService.validateRegistrationCode(registrationCode, deviceInfo);
        console.log('注册码验证结果:', { isValid: codeValidation.isValid, error: codeValidation.error || '无错误' });
        
        if (!codeValidation.isValid) {
          console.warn('注册码验证失败:', codeValidation.error || '未知错误');
          return res.status(400).json({
            success: false,
            message: codeValidation.error || '注册码验证失败',
            code: codeValidation.code
          });
        }

        // 增加注册码使用次数
        await registrationCodeService.incrementCodeUsage(registrationCode, agent_id, device_fingerprint);
        console.log('注册码使用次数已增加');
      }

      // 检查代理是否已存在
      console.log('检查代理是否已存在:', { agent_id: agent_id });
      
      // 检查模型是否可用
      if (!models.Agent) {
        console.error('Agent模型不可用');
        return res.status(503).json({
          error: 'Database not available',
          code: 'DB_UNAVAILABLE'
        });
      }

      let agent = await models.Agent?.findOne({ where: { agent_id } });
            
      if (agent) {
        console.log('代理已存在，更新信息:', { agent_id: agent_id, hostname });
        
        // 更新现有代理信息
        agent.hostname = hostname;
        agent.platform = platform;
        agent.arch = arch;
        agent.version = version;
        agent.capabilities = capabilities;
        agent.system_info = system_info;
        agent.device_fingerprint = device_fingerprint;
        agent.last_seen = new Date();
        agent.status = 'online';
                
        await agent.save();
                
        console.log('代理信息已更新:', { agent_id: agent_id, hostname });
        logger.info('代理信息已更新:', { agent_id: agent_id, hostname });
                
        return res.status(409).json({
          success: false,
          message: '代理已存在，请使用认证接口获取token',
          agent_id: agent_id
        });
      }

      console.log('代理不存在，创建新代理');

      // 生成设备指纹（如果未提供）
      let fingerprint = device_fingerprint;
      if (!fingerprint && system_info) {
        console.log('生成设备指纹...');
        const fingerprintResult = deviceFingerprintService.generateFingerprint({
          hostname,
          platform,
          arch,
          ...system_info
        });
        fingerprint = fingerprintResult.fingerprint;
        console.log('设备指纹生成完成');
      }

      // 创建新代理
      agent = new models.Agent({
        agent_id,
        name: hostname, // 使用hostname作为name
        hostname,
        platform,
        arch,
        version: version || '1.0.0',
        capabilities: capabilities || [],
        system_info: system_info || {},
        device_fingerprint: fingerprint,
        status: 'online',
        registered_at: new Date(),
        last_seen: new Date(),
        organization_id: req.user?.organization_id // 如果用户已认证
      });

      await agent.save();
      console.log('新代理已保存到数据库:', { agent_id: agent_id, hostname });

      // 使用注册码（如果提供）
      if (registrationCode) {
        console.log('使用注册码...');
        const deviceInfo = {
          agent_id: agent_id,
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

      if (agent.device_fingerprint && !device_fingerprint) {
        return res.status(401).json({
          success: false,
          message: '设备指纹不能为空',
          error: 'DEVICE_FINGERPRINT_REQUIRED'
        });
      }

      // 验证设备指纹
      if (device_fingerprint && agent.device_fingerprint) {
        console.log('开始设备指纹验证');

        // 构建完整的设备信息用于指纹验证
        const deviceInfoForVerification = {
          hostname: hostname,
          platform: agent.platform,
          arch: agent.arch,
          // 从存储的系统信息中提取其他必要信息
          macAddresses: agent.system_info?.macAddresses || [],
          cpuInfo: agent.system_info?.cpu || {},
          memoryInfo: agent.system_info?.memory || {},
          diskInfo: agent.system_info?.diskInfo || [],
          networkInterfaces: agent.system_info?.networkInterfaces || [],
          systemUuid: agent.system_info?.systemUuid || '',
          biosInfo: agent.system_info?.biosInfo || {}
        };

        console.log('设备信息用于验证:', {
          hostname: deviceInfoForVerification.hostname,
          platform: deviceInfoForVerification.platform,
          arch: deviceInfoForVerification.arch,
          macCount: deviceInfoForVerification.macAddresses.length,
          diskCount: deviceInfoForVerification.diskInfo.length
        });

        // 生成当前设备指纹
        console.log('开始生成设备指纹:', { 
          hostname: deviceInfoForVerification.hostname, 
          platform: deviceInfoForVerification.platform, 
          arch: deviceInfoForVerification.arch 
        });
        
        const fingerprintValidation = deviceFingerprintService.generateFingerprint(deviceInfoForVerification);
        
        console.log('指纹数据构建完成:', {
          hostname: fingerprintValidation.components.hostname,
          platform: fingerprintValidation.components.platform,
          macCount: fingerprintValidation.components.macAddresses.length,
          diskCount: fingerprintValidation.components.diskInfo.length,
          networkCount: fingerprintValidation.components.networkInterfaces.length
        });
        
        console.log('设备指纹生成成功:', {
          hostname: fingerprintValidation.components.hostname,
          platform: fingerprintValidation.components.platform,
          dataLength: JSON.stringify(fingerprintValidation.components).length
        });

        // 验证指纹
        const fingerprintValidationResult = {
          isValid: fingerprintValidation.fingerprint === agent.device_fingerprint,
          expected: agent.device_fingerprint,
          actual: device_fingerprint,
          currentGenerated: fingerprintValidation.fingerprint
        };

        console.log('设备指纹验证结果:', {
          isValid: fingerprintValidationResult.isValid,
          match: fingerprintValidationResult.isValid ? '匹配' : '不匹配'
        });

        if (!fingerprintValidationResult.isValid) {
          console.log('设备指纹验证失败:', {
            agent_id, 
            hostname
          });
          
          // 记录安全事件
          try {
            await this.recordSecurityEvent(agent, 'fingerprint_mismatch', 'high', {
              expected: agent.device_fingerprint,
              actual: device_fingerprint,
              currentGenerated: fingerprintValidation.fingerprint
            });
          } catch (securityEventError) {
            console.error('记录安全事件失败:', securityEventError);
          }
          
          // 设备指纹验证失败，拒绝认证
          return res.status(401).json({
            success: false,
            message: '设备指纹验证失败',
            error: 'DEVICE_FINGERPRINT_MISMATCH'
          });
        } else {
          console.log('设备指纹验证成功:', { agent_id, hostname });
        }
      } else {
        console.log('跳过设备指纹验证:', { 
          hasProvidedFingerprint: !!device_fingerprint, 
          hasStoredFingerprint: !!agent.device_fingerprint 
        });
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

      // 更新代理最后活跃时间
      agent.last_seen = new Date();
      agent.dataReceivedAt = new Date();
      await agent.save();

      // 处理不同类型的数据
      await this.processAgentData(agent, type, data, timestamp);

      logger.debug('接收代理数据:', { agent_id, type, dataSize: JSON.stringify(data).length });

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
        agent_id: agent.agent_id,
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
      const dataStorageService = require('../services/DataStorageService');
      await dataStorageService.storeSystemData(data.agent_id, data.data);
            
      // 检查系统异常
      if (data.data.system) {
        const system = data.data.system;
                
        // 检查CPU使用率
        if (system.cpu && system.cpu.load > 90) {
          await this.createSecurityEvent({
            agent_id: data.agent_id,
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
            agent_id: data.agent_id,
            type: 'system_alert',
            severity: 'medium',
            title: '内存使用率过高',
            description: `内存使用率达到 ${system.memory.usage}%`,
            metadata: { memory_usage: system.memory.usage }
          });
        }
      }
            
      logger.debug('系统数据处理完成:', { agent_id: data.agent_id });
    } catch (error) {
      logger.error('处理系统数据失败:', error);
    }
  }

  // 处理网络数据
  async processNetworkData(data) {
    try {
      // 存储网络流量数据
      const dataStorageService = require('../services/DataStorageService');
      await dataStorageService.storeNetworkData(data.agent_id, data.data);
            
      // 检查网络异常
      if (data.data.suspicious && data.data.suspicious.length > 0) {
        for (const suspicious of data.data.suspicious) {
          await this.createSecurityEvent({
            agent_id: data.agent_id,
            type: 'network_threat',
            severity: this.mapSeverity(suspicious.severity),
            title: suspicious.type,
            description: suspicious.message,
            metadata: suspicious
          });
        }
      }
            
      logger.debug('网络数据处理完成:', { agent_id: data.agent_id });
    } catch (error) {
      logger.error('处理网络数据失败:', error);
    }
  }

  // 处理日志数据
  async processLogData(data) {
    try {
      // 存储日志数据
      const dataStorageService = require('../services/DataStorageService');
      await dataStorageService.storeLogData(data.agent_id, data.data);
            
      logger.debug('日志数据处理完成:', { agent_id: data.agent_id });
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
            agent_id: data.agent_id,
            type: threat.type,
            severity: this.mapSeverity(threat.severity),
            title: threat.type,
            description: threat.description,
            metadata: threat
          });
        }
      }
            
      logger.debug('安全数据处理完成:', { agent_id: data.agent_id });
    } catch (error) {
      logger.error('处理安全数据失败:', error);
    }
  }

  // 威胁检测
  async detectThreats(data) {
    try {
      // TODO: 实现AI威胁检测逻辑
      // 这里可以集成机器学习模型或规则引擎
            
      logger.debug('威胁检测完成:', { agent_id: data.agent_id });
    } catch (error) {
      logger.error('威胁检测失败:', error);
    }
  }

  // 创建安全事件
  async createSecurityEvent(eventData) {
    try {
      const agent = await models.Agent.findOne({ where: { agent_id: eventData.agent_id } });
      const event = await securityEventService.record({
        type: eventData.type,
        alert_type: eventData.type === 'network_threat' ? 'suspicious-connection' : 'high-cpu-usage',
        severity: eventData.severity,
        title: eventData.title || `安全事件: ${eventData.type}`,
        description: eventData.description || `代理 ${eventData.agent_id} 发生安全事件: ${eventData.type}`,
        details: eventData.metadata || {},
        device_id: eventData.deviceId || agent?.device_id,
        agent_id: eventData.agent_id,
        organization_id: agent?.organization_id,
        source: 'internal-monitor',
        tags: ['internal-monitor', eventData.type]
      });

      // 同时存储到InfluxDB
      const dataStorageService = require('../services/DataStorageService');
      await dataStorageService.storeSecurityEvent(eventData.agent_id, {
        ...eventData,
        timestamp: new Date(),
        status: 'open'
      });

      logger.info('安全事件已创建:', { 
        agent_id: eventData.agent_id, 
        type: eventData.type,
        severity: eventData.severity 
      });
            
      return event;
    } catch (error) {
      logger.error('创建安全事件失败:', error);
      return null;
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
      if (req.user?.organization_id) {
        filter.organization_id = req.user.organization_id;
      }

      const agents = await models.Agent?.findAll({
        where: filter,
        order: [['last_seen', 'DESC']],
        limit: limit * 1,
        offset: (page - 1) * limit,
        attributes: { exclude: ['system_info'] } // 排除敏感系统信息
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

      if (!['online', 'offline', 'maintenance'].includes(status)) {
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
