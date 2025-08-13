const EventEmitter = require('events');
const WebSocket = require('ws');
const axios = require('axios');
const crypto = require('crypto');
const os = require('os');
const logger = require('../utils/logger');
const Store = require('electron-store');

class AgentService extends EventEmitter {
    constructor() {
        super();
        this.ws = null;
        this.store = new Store();
        
        // 从持久化存储加载配置，如果没有则使用默认值
        this.config = {
            serverUrl: this.store.get('serverUrl', 'ws://localhost:5555'),
            apiUrl: this.store.get('apiUrl', 'http://localhost:5555/api'),
            reconnectInterval: this.store.get('reconnectInterval', 5000),
            maxReconnectAttempts: this.store.get('maxReconnectAttempts', 10),
            heartbeatInterval: this.store.get('heartbeatInterval', 30000)
        };
        
        this.reconnectAttempts = 0;
        this.isConnected = false;
        this.heartbeatTimer = null;
        this.agentId = this.generateAgentId();
        this.authToken = null;
        this.registrationCode = null; // 注册码
        this.deviceFingerprint = null; // 设备指纹
        this.connectionKey = null; // 连接密钥
        this.publicKey = null; // 服务器公钥
        this.dataBuffer = [];
        this.maxBufferSize = 1000;
    }

    // 更新服务器配置
    updateServerConfig(serverConfig) {
        logger.info('更新服务器配置:', serverConfig);
        
        // 验证配置
        if (!serverConfig.serverUrl || !serverConfig.apiUrl) {
            throw new Error('服务器URL和API URL不能为空');
        }
        
        // 更新配置
        this.config.serverUrl = serverConfig.serverUrl;
        this.config.apiUrl = serverConfig.apiUrl;
        
        // 保存到持久化存储
        this.store.set('serverUrl', this.config.serverUrl);
        this.store.set('apiUrl', this.config.apiUrl);
        
        // 如果配置了其他参数，也保存
        if (serverConfig.reconnectInterval) {
            this.config.reconnectInterval = serverConfig.reconnectInterval;
            this.store.set('reconnectInterval', this.config.reconnectInterval);
        }
        
        if (serverConfig.maxReconnectAttempts) {
            this.config.maxReconnectAttempts = serverConfig.maxReconnectAttempts;
            this.store.set('maxReconnectAttempts', this.config.maxReconnectAttempts);
        }
        
        if (serverConfig.heartbeatInterval) {
            this.config.heartbeatInterval = serverConfig.heartbeatInterval;
            this.store.set('heartbeatInterval', this.config.heartbeatInterval);
        }
        
        logger.info('服务器配置已更新并保存');
        
        // 如果当前已连接，需要重新连接
        if (this.isConnected) {
            logger.info('检测到配置变更，重新连接服务器...');
            this.disconnect().then(() => {
                this.connect().catch(error => {
                    logger.error('重新连接失败:', error);
                });
            });
        }
        
        return true;
    }

    // 获取当前服务器配置
    getServerConfig() {
        return {
            serverUrl: this.config.serverUrl,
            apiUrl: this.config.apiUrl,
            reconnectInterval: this.config.reconnectInterval,
            maxReconnectAttempts: this.config.maxReconnectAttempts,
            heartbeatInterval: this.config.heartbeatInterval
        };
    }

    // 测试服务器连接
    async testServerConnection() {
        try {
            logger.info('测试服务器连接...', { apiUrl: this.config.apiUrl });
            
            // 构建健康检查URL - 使用基础URL而不是API路径
            const baseUrl = this.config.apiUrl.replace('/api', '');
            const healthUrl = `${baseUrl}/health`;
            
            logger.info('健康检查URL:', healthUrl);
            
            // 测试健康检查连接
            const response = await axios.get(healthUrl, {
                timeout: 10000
            });
            
            if (response.status === 200) {
                logger.info('服务器连接测试成功');
                return {
                    success: true,
                    message: '连接成功',
                    serverInfo: response.data
                };
            } else {
                throw new Error(`服务器响应异常: ${response.status}`);
            }
        } catch (error) {
            logger.error('服务器连接测试失败:', error.message);
            return {
                success: false,
                message: error.message,
                error: error.code || 'UNKNOWN_ERROR'
            };
        }
    }

    // 生成唯一的代理ID
    generateAgentId() {
        const machineId = crypto.createHash('sha256')
            .update(os.hostname() + os.platform() + os.arch())
            .digest('hex');
        return `agent-${machineId.substring(0, 16)}`;
    }

    // 初始化服务
    async initialize() {
        logger.info('初始化代理服务...', { agentId: this.agentId });
        
        try {
            // 注册代理
            await this.registerAgent();
            logger.info('代理注册成功');
        } catch (error) {
            logger.error('代理注册失败:', error);
            throw error;
        }
    }

    // 注册代理到服务器
    async registerAgent(registrationCode = null) {
        try {
            console.log('开始代理注册...', {
                agentId: this.agentId,
                hostname: os.hostname(),
                hasRegistrationCode: !!(registrationCode || this.registrationCode)
            });

            // 生成设备指纹
            if (!this.deviceFingerprint) {
                console.log('生成设备指纹...');
                this.deviceFingerprint = await this.generateDeviceFingerprint();
            } else {
                console.log('使用现有设备指纹:', this.deviceFingerprint.substring(0, 16) + '...');
            }

            const agentInfo = {
                agentId: this.agentId,
                hostname: os.hostname(),
                platform: os.platform(),
                arch: os.arch(),
                version: process.env.npm_package_version || '1.0.0',
                capabilities: this.getCapabilities(),
                systemInfo: await this.getSystemInfo(),
                registrationCode: registrationCode || this.registrationCode,
                deviceFingerprint: this.deviceFingerprint
            };

            console.log('发送代理注册请求:', {
                agentId: agentInfo.agentId,
                hostname: agentInfo.hostname,
                platform: agentInfo.platform,
                hasFingerprint: !!agentInfo.deviceFingerprint,
                fingerprint: agentInfo.deviceFingerprint?.substring(0, 16) + '...'
            });

            const response = await axios.post(`${this.config.apiUrl}/agents/register`, agentInfo);
            
            console.log('代理注册成功:', {
                agentId: this.agentId,
                hostname: os.hostname(),
                hasToken: !!response.data.token,
                hasConnectionKey: !!response.data.connectionKey
            });
            
            // 保存认证信息
            this.authToken = response.data.token;
            this.connectionKey = response.data.connectionKey;
            this.publicKey = response.data.publicKey;
            
            logger.info('代理注册成功', { agentId: this.agentId });
            return response.data;
        } catch (error) {
            console.error('代理注册失败:', {
                agentId: this.agentId,
                hostname: os.hostname(),
                error: error.message,
                status: error.response?.status,
                data: error.response?.data
            });

            if (error.response?.status === 409) {
                // 代理已存在，尝试获取token
                console.log('代理已存在，尝试重新认证...');
                logger.info('代理已存在，尝试重新认证...');
                return await this.authenticateAgent();
            }
            throw error;
        }
    }

    // 代理认证
    async authenticateAgent() {
        try {
            console.log('开始代理认证...', {
                agentId: this.agentId,
                hostname: os.hostname(),
                hasFingerprint: !!this.deviceFingerprint
            });

            const response = await axios.post(`${this.config.apiUrl}/agents/auth`, {
                agentId: this.agentId,
                hostname: os.hostname(),
                deviceFingerprint: this.deviceFingerprint
            });
            
            console.log('代理认证成功:', {
                agentId: this.agentId,
                hostname: os.hostname(),
                hasToken: !!response.data.token,
                hasConnectionKey: !!response.data.connectionKey
            });
            
            // 保存认证信息
            this.authToken = response.data.token;
            this.connectionKey = response.data.connectionKey;
            this.publicKey = response.data.publicKey;
            
            return response.data;
        } catch (error) {
            console.error('代理认证失败:', {
                agentId: this.agentId,
                hostname: os.hostname(),
                error: error.message,
                status: error.response?.status,
                data: error.response?.data
            });
            logger.error('代理认证失败:', error);
            throw error;
        }
    }

    // 生成设备指纹
    async generateDeviceFingerprint() {
        try {
            console.log('代理端开始生成设备指纹...');
            const si = require('systeminformation');
            
            const [cpu, mem, osInfo, network, disk, system] = await Promise.all([
                si.cpu(),
                si.mem(),
                si.osInfo(),
                si.networkInterfaces(),
                si.diskLayout(),
                si.system()
            ]);

            console.log('系统信息获取完成:', {
                hostname: os.hostname(),
                platform: os.platform(),
                networkCount: network.length,
                diskCount: disk.length
            });

            // 构建设备指纹数据 - 与服务器端保持一致
            const deviceInfo = {
                hostname: os.hostname(),
                platform: os.platform(),
                arch: os.arch(),
                // 标准化MAC地址 - 与服务器端保持一致
                macAddresses: network
                    .filter(iface => iface && iface.mac && !iface.internal)
                    .map(iface => iface.mac.toLowerCase().replace(/[:-]/g, ''))
                    .sort(),
                cpuInfo: {
                    model: cpu.brand || '',
                    cores: cpu.cores || 0,
                    architecture: os.arch(),
                    vendor: cpu.manufacturer || ''
                },
                memoryInfo: {
                    total: mem.total || 0,
                    type: 'Unknown'
                },
                // 标准化磁盘信息 - 与服务器端保持一致
                diskInfo: disk
                    .filter(d => d && d.serial)
                    .map(d => ({
                        serial: d.serial || '',
                        model: d.model || '',
                        size: d.size || 0
                    }))
                    .sort((a, b) => a.serial.localeCompare(b.serial)),
                // 标准化网络接口信息 - 与服务器端保持一致
                networkInterfaces: network
                    .filter(iface => iface && iface.iface)
                    .map(iface => ({
                        name: iface.iface || '',
                        mac: iface.mac ? iface.mac.toLowerCase().replace(/[:-]/g, '') : '',
                        type: iface.type || ''
                    }))
                    .sort((a, b) => a.name.localeCompare(b.name)),
                systemUuid: system.uuid || '',
                biosInfo: {
                    vendor: system.manufacturer || '',
                    version: system.version || '',
                    releaseDate: ''
                }
            };

            console.log('设备信息构建完成:', {
                hostname: deviceInfo.hostname,
                platform: deviceInfo.platform,
                macCount: deviceInfo.macAddresses.length,
                diskCount: deviceInfo.diskInfo.length,
                networkCount: deviceInfo.networkInterfaces.length
            });

            // 生成指纹哈希 - 与服务器端使用相同的算法
            const crypto = require('crypto');
            const dataString = JSON.stringify(deviceInfo, Object.keys(deviceInfo).sort());
            const hash = crypto.createHash('sha256');
            hash.update(dataString);
            const fingerprint = hash.digest('hex');
            
            console.log('设备指纹生成成功:', {
                hostname: deviceInfo.hostname,
                platform: deviceInfo.platform,
                fingerprint: fingerprint.substring(0, 16) + '...',
                dataLength: dataString.length
            });
            
            return fingerprint;
        } catch (error) {
            console.error('生成设备指纹失败:', error);
            logger.error('生成设备指纹失败:', error);
            // 返回基于基本信息的简单指纹
            const basicInfo = `${os.hostname()}-${os.platform()}-${os.arch()}`;
            const crypto = require('crypto');
            const fallbackFingerprint = crypto.createHash('sha256').update(basicInfo).digest('hex');
            console.log('使用备用指纹:', { basicInfo, fingerprint: fallbackFingerprint.substring(0, 16) + '...' });
            return fallbackFingerprint;
        }
    }

    // 获取系统信息
    async getSystemInfo() {
        const si = require('systeminformation');
        
        try {
            console.log('获取系统信息...');
            const [cpu, mem, osInfo, network, disk, system] = await Promise.all([
                si.cpu(),
                si.mem(),
                si.osInfo(),
                si.networkInterfaces(),
                si.diskLayout(),
                si.system()
            ]);

            console.log('系统信息获取完成:', {
                hostname: os.hostname(),
                platform: os.platform(),
                networkCount: network.length,
                diskCount: disk.length
            });

            // 构建与设备指纹生成一致的系统信息结构
            const systemInfo = {
                // 基础系统信息
                hostname: os.hostname(),
                platform: os.platform(),
                arch: os.arch(),
                
                // 硬件信息
                macAddresses: network
                    .filter(iface => iface && iface.mac && !iface.internal)
                    .map(iface => iface.mac),
                cpuInfo: {
                    model: cpu.brand || '',
                    cores: cpu.cores || 0,
                    architecture: os.arch(),
                    vendor: cpu.manufacturer || ''
                },
                memoryInfo: {
                    total: mem.total || 0,
                    type: 'Unknown'
                },
                diskInfo: disk
                    .filter(d => d && d.serial)
                    .map(d => ({
                        serial: d.serial || '',
                        model: d.model || '',
                        size: d.size || 0
                    })),
                
                // 网络信息
                networkInterfaces: network
                    .filter(iface => iface && iface.iface)
                    .map(iface => ({
                        name: iface.iface || '',
                        mac: iface.mac || '',
                        type: iface.type || ''
                    })),
                
                // 系统标识
                systemUuid: system.uuid || '',
                biosInfo: {
                    vendor: system.manufacturer || '',
                    version: system.version || '',
                    releaseDate: ''
                },

                // 兼容性字段（保持向后兼容）
                cpu: {
                    manufacturer: cpu.manufacturer || '',
                    brand: cpu.brand || '',
                    cores: cpu.cores || 0,
                    physicalCores: cpu.physicalCores || 0,
                    speed: cpu.speed || 0
                },
                memory: {
                    total: mem.total || 0,
                    available: mem.available || 0
                },
                os: {
                    platform: osInfo.platform || '',
                    distro: osInfo.distro || '',
                    release: osInfo.release || '',
                    kernel: osInfo.kernel || '',
                    arch: osInfo.arch || ''
                },
                network: network
                    .filter(iface => iface && !iface.internal)
                    .map(iface => ({
                        iface: iface.iface || '',
                        type: iface.type || '',
                        mac: iface.mac || '',
                        ip4: iface.ip4 || '',
                        ip6: iface.ip6 || ''
                    }))
            };

            console.log('系统信息构建完成:', {
                hostname: systemInfo.hostname,
                platform: systemInfo.platform,
                macCount: systemInfo.macAddresses.length,
                diskCount: systemInfo.diskInfo.length,
                networkCount: systemInfo.networkInterfaces.length
            });

            return systemInfo;
        } catch (error) {
            console.error('获取系统信息失败:', error);
            logger.error('获取系统信息失败:', error);
            // 返回基本的系统信息
            return {
                hostname: os.hostname(),
                platform: os.platform(),
                arch: os.arch(),
                macAddresses: [],
                cpuInfo: { model: '', cores: 0, architecture: os.arch(), vendor: '' },
                memoryInfo: { total: 0, type: 'Unknown' },
                diskInfo: [],
                networkInterfaces: [],
                systemUuid: '',
                biosInfo: { vendor: '', version: '', releaseDate: '' },
                cpu: { manufacturer: '', brand: '', cores: 0, physicalCores: 0, speed: 0 },
                memory: { total: 0, available: 0 },
                os: { platform: os.platform(), distro: '', release: '', kernel: '', arch: os.arch() },
                network: []
            };
        }
    }

    // 获取代理能力
    getCapabilities() {
        const platform = os.platform();
        const capabilities = ['system-monitoring', 'network-monitoring', 'log-collection'];
        
        // 平台特定能力
        switch (platform) {
            case 'win32':
                capabilities.push('windows-events', 'wmi-queries', 'windows-firewall');
                break;
            case 'linux':
                capabilities.push('syslog', 'iptables', 'systemd');
                break;
            case 'darwin':
                capabilities.push('system-log', 'pfctl', 'network-framework');
                break;
        }
        
        return capabilities;
    }

    // 连接到服务器
    async connect() {
        if (!this.authToken) {
            throw new Error('未获取到认证token，请先注册代理');
        }

        return new Promise((resolve, reject) => {
            // 构建WebSocket URL，包含token和连接密钥
            let wsUrl = `${this.config.serverUrl}/ws?token=${this.authToken}`;
            
            // 如果有连接密钥，添加到URL中
            if (this.connectionKey) {
                logger.debug('连接密钥对象详情:', {
                    hasKey: !!this.connectionKey.key,
                    hasTimestamp: !!this.connectionKey.timestamp,
                    hasSignature: !!this.connectionKey.signature,
                    keyLength: this.connectionKey.key?.length,
                    timestamp: this.connectionKey.timestamp,
                    signatureLength: this.connectionKey.signature?.length,
                    keyPreview: this.connectionKey.key?.substring(0, 16) + '...',
                    signaturePreview: this.connectionKey.signature?.substring(0, 16) + '...'
                });

                // 连接密钥应该是一个对象，包含key、timestamp、signature等字段
                // 服务器端期望的是完整的连接密钥字符串，格式为: key:timestamp:signature
                if (this.connectionKey.key && this.connectionKey.timestamp && this.connectionKey.signature) {
                    const fullConnectionKey = `${this.connectionKey.key}:${this.connectionKey.timestamp}:${this.connectionKey.signature}`;
                    wsUrl += `&connectionKey=${fullConnectionKey}`;
                    logger.debug('使用完整连接密钥:', { 
                        key: this.connectionKey.key.substring(0, 16) + '...',
                        timestamp: this.connectionKey.timestamp,
                        signature: this.connectionKey.signature.substring(0, 16) + '...',
                        fullConnectionKeyLength: fullConnectionKey.length,
                        fullConnectionKeyPreview: fullConnectionKey.substring(0, 32) + '...'
                    });
                } else if (this.connectionKey.signature) {
                    // 向后兼容：如果只有signature，使用signature作为连接密钥
                    wsUrl += `&connectionKey=${this.connectionKey.signature}`;
                    logger.warn('使用签名作为连接密钥（向后兼容）:', {
                        signatureLength: this.connectionKey.signature.length,
                        signaturePreview: this.connectionKey.signature.substring(0, 16) + '...'
                    });
                } else {
                    logger.warn('连接密钥格式不正确，无法建立安全连接:', {
                        connectionKey: this.connectionKey
                    });
                }
            } else {
                logger.warn('未提供连接密钥，连接可能被拒绝');
            }
            
            logger.info('连接到服务器...', { 
                url: wsUrl.substring(0, 100) + '...',
                urlLength: wsUrl.length,
                hasToken: wsUrl.includes('token='),
                hasConnectionKey: wsUrl.includes('connectionKey=')
            });
            
            // 如果已有连接，先关闭
            if (this.ws) {
                try {
                    this.ws.close(1000, '重新连接');
                } catch (error) {
                    logger.warn('关闭旧连接时出错:', error.message);
                }
                this.ws = null;
            }
            
            this.ws = new WebSocket(wsUrl);

            // 连接超时处理
            const connectionTimeout = setTimeout(() => {
                if (!this.isConnected) {
                    logger.error('WebSocket连接超时');
                    if (this.ws) {
                        this.ws.close();
                    }
                    reject(new Error('连接超时'));
                }
            }, 15000); // 15秒超时

            this.ws.on('open', () => {
                logger.info('WebSocket连接已建立');
                clearTimeout(connectionTimeout);
                this.isConnected = true;
                this.reconnectAttempts = 0;
                this.startHeartbeat();
                this.flushDataBuffer();
                this.emit('connected');
                resolve();
            });

            this.ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    this.handleMessage(message);
                } catch (error) {
                    logger.error('处理消息失败:', error);
                }
            });

            this.ws.on('close', (code, reason) => {
                clearTimeout(connectionTimeout);
                logger.warn('WebSocket连接已关闭', { 
                    code, 
                    reason: reason.toString(),
                    reconnectAttempts: this.reconnectAttempts,
                    maxAttempts: this.config.maxReconnectAttempts
                });
                
                this.isConnected = false;
                this.stopHeartbeat();
                this.emit('disconnected', { code, reason });
                
                // 只有在非正常关闭且未达到最大重连次数时才重连
                if (code !== 1000 && this.reconnectAttempts < this.config.maxReconnectAttempts) {
                    this.scheduleReconnect();
                } else if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
                    logger.error('达到最大重连次数，停止重连');
                    this.emit('max-reconnect-reached');
                }
            });

            this.ws.on('error', (error) => {
                clearTimeout(connectionTimeout);
                logger.error('WebSocket连接错误:', error);
                
                // 处理特定的连接错误
                if (error.code === 'ECONNREFUSED') {
                    logger.error('服务器连接被拒绝，可能服务器未启动');
                    this.emit('connection-refused');
                } else if (error.code === 'ENOTFOUND') {
                    logger.error('无法解析服务器地址');
                    this.emit('host-not-found');
                } else if (error.code === 'ETIMEDOUT') {
                    logger.error('连接超时');
                    this.emit('connection-timeout');
                }
                
                this.emit('error', error);
                
                // 只有在连接建立失败时才reject
                if (!this.isConnected) {
                    reject(error);
                }
            });
        });
    }

    // 处理服务器消息
    handleMessage(message) {
        logger.debug('收到服务器消息:', message);
        
        switch (message.type) {
            case 'ping':
                this.sendMessage({ type: 'pong', timestamp: Date.now() });
                break;
                
            case 'command':
                this.handleCommand(message.data);
                break;
                
            case 'config-update':
                this.handleConfigUpdate(message.data);
                break;
                
            case 'policy-update':
                this.handlePolicyUpdate(message.data);
                break;
                
            default:
                logger.warn('未知消息类型:', message.type);
        }
    }

    // 处理服务器命令
    handleCommand(command) {
        logger.info('执行服务器命令:', command);
        
        switch (command.action) {
            case 'start-monitoring':
                this.emit('start-monitoring', command.params);
                break;
                
            case 'stop-monitoring':
                this.emit('stop-monitoring', command.params);
                break;
                
            case 'collect-logs':
                this.emit('collect-logs', command.params);
                break;
                
            case 'update-firewall':
                this.emit('update-firewall', command.params);
                break;
                
            case 'block-ip':
                this.emit('block-ip', command.params);
                break;
                
            case 'unblock-ip':
                this.emit('unblock-ip', command.params);
                break;
                
            default:
                logger.warn('未知命令:', command.action);
        }
    }

    // 处理配置更新
    handleConfigUpdate(config) {
        logger.info('更新配置:', config);
        Object.assign(this.config, config);
        this.emit('config-updated', config);
    }

    // 处理策略更新
    handlePolicyUpdate(policy) {
        logger.info('更新安全策略:', policy);
        this.emit('policy-updated', policy);
    }

    // 发送消息到服务器
    sendMessage(message) {
        if (!this.isConnected || !this.ws) {
            logger.warn('连接未建立，消息将被缓存');
            this.bufferData(message);
            return false;
        }

        try {
            const data = JSON.stringify({
                ...message,
                agentId: this.agentId, // 确保每个消息都包含agentId
                timestamp: Date.now()
            });
            this.ws.send(data);
            return true;
        } catch (error) {
            logger.error('发送消息失败:', error);
            this.bufferData(message);
            return false;
        }
    }

    // 发送数据到服务器
    sendData(type, data) {
        return this.sendMessage({
            type: 'data',
            dataType: type,
            data: data,
            agentId: this.agentId // 确保数据消息也包含agentId
        });
    }

    // 发送心跳
    sendHeartbeat() {
        return this.sendMessage({
            type: 'heartbeat',
            status: 'active',
            timestamp: Date.now(),
            agentId: this.agentId // 确保心跳消息也包含agentId
        });
    }

    // 缓存数据
    bufferData(data) {
        if (this.dataBuffer.length >= this.maxBufferSize) {
            this.dataBuffer.shift(); // 移除最旧的数据
        }
        this.dataBuffer.push(data);
    }

    // 刷新数据缓存
    flushDataBuffer() {
        if (this.dataBuffer.length > 0) {
            logger.info(`发送缓存数据: ${this.dataBuffer.length} 条`);
            this.dataBuffer.forEach(data => {
                this.sendMessage(data);
            });
            this.dataBuffer = [];
        }
    }

    // 开始心跳
    startHeartbeat() {
        this.heartbeatTimer = setInterval(() => {
            this.sendHeartbeat();
        }, this.config.heartbeatInterval);
    }

    // 停止心跳
    stopHeartbeat() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }

    // 计划重连
    scheduleReconnect() {
        if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
            logger.error('达到最大重连次数，停止重连');
            this.emit('max-reconnect-reached');
            return;
        }

        this.reconnectAttempts++;
        const delay = Math.min(
            this.config.reconnectInterval * Math.pow(1.5, this.reconnectAttempts - 1),
            60000 // 最大延迟60秒
        );
        
        logger.info(`计划在 ${delay}ms 后重连 (尝试 ${this.reconnectAttempts}/${this.config.maxReconnectAttempts})`);
        
        setTimeout(() => {
            // 检查是否仍然需要重连
            if (!this.isConnected && this.reconnectAttempts <= this.config.maxReconnectAttempts) {
                this.connect().catch(error => {
                    logger.error('重连失败:', error.message);
                    // 重连失败不增加重连次数，让scheduleReconnect继续处理
                    this.reconnectAttempts--;
                });
            }
        }, delay);
    }

    // 断开连接
    disconnect() {
        logger.info('断开服务器连接');
        this.isConnected = false;
        this.stopHeartbeat();
        this.reconnectAttempts = 0; // 重置重连次数
        
        if (this.ws) {
            try {
                this.ws.close(1000, 'Client disconnect');
            } catch (error) {
                logger.warn('关闭WebSocket连接时出错:', error.message);
            }
            this.ws = null;
        }
    }

    // 获取连接状态
    getConnectionStatus() {
        return this.isConnected;
    }

    // 获取代理ID
    getAgentId() {
        return this.agentId;
    }

    // 更新配置
    updateConfig(newConfig) {
        Object.assign(this.config, newConfig);
        logger.info('配置已更新:', newConfig);
    }

    // 设置注册码
    setRegistrationCode(code) {
        this.registrationCode = code;
        logger.info('注册码已设置', { code: code ? code.substring(0, 8) + '...' : 'null' });
    }

    // 获取注册码
    getRegistrationCode() {
        return this.registrationCode;
    }

    // 获取设备指纹
    getDeviceFingerprint() {
        return this.deviceFingerprint;
    }

    // 获取连接状态信息
    getConnectionInfo() {
        return {
            agentId: this.agentId,
            isConnected: this.isConnected,
            hasAuthToken: !!this.authToken,
            hasRegistrationCode: !!this.registrationCode,
            hasDeviceFingerprint: !!this.deviceFingerprint,
            hasConnectionKey: !!this.connectionKey
        };
    }
}

module.exports = AgentService; 