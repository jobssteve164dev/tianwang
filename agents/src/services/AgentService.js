const EventEmitter = require('events');
const WebSocket = require('ws');
const axios = require('axios');
const crypto = require('crypto');
const os = require('os');
const logger = require('../utils/logger');

class AgentService extends EventEmitter {
    constructor() {
        super();
        this.ws = null;
        this.config = {
            serverUrl: 'ws://localhost:3001',
            apiUrl: 'http://localhost:3001/api',
            reconnectInterval: 5000,
            maxReconnectAttempts: 10,
            heartbeatInterval: 30000
        };
        this.reconnectAttempts = 0;
        this.isConnected = false;
        this.heartbeatTimer = null;
        this.agentId = this.generateAgentId();
        this.authToken = null;
        this.dataBuffer = [];
        this.maxBufferSize = 1000;
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
    async registerAgent() {
        try {
            const agentInfo = {
                agentId: this.agentId,
                hostname: os.hostname(),
                platform: os.platform(),
                arch: os.arch(),
                version: process.env.npm_package_version || '1.0.0',
                capabilities: this.getCapabilities(),
                systemInfo: await this.getSystemInfo()
            };

            const response = await axios.post(`${this.config.apiUrl}/agents/register`, agentInfo);
            this.authToken = response.data.token;
            logger.info('代理注册成功', { agentId: this.agentId });
            return response.data;
        } catch (error) {
            if (error.response?.status === 409) {
                // 代理已存在，尝试获取token
                logger.info('代理已存在，尝试重新认证...');
                return await this.authenticateAgent();
            }
            throw error;
        }
    }

    // 代理认证
    async authenticateAgent() {
        try {
            const response = await axios.post(`${this.config.apiUrl}/agents/auth`, {
                agentId: this.agentId,
                hostname: os.hostname()
            });
            this.authToken = response.data.token;
            return response.data;
        } catch (error) {
            logger.error('代理认证失败:', error);
            throw error;
        }
    }

    // 获取系统信息
    async getSystemInfo() {
        const si = require('systeminformation');
        
        try {
            const [cpu, mem, osInfo, network] = await Promise.all([
                si.cpu(),
                si.mem(),
                si.osInfo(),
                si.networkInterfaces()
            ]);

            // 安全地提取系统信息，避免循环引用
            const safeSystemInfo = {
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
                network: []
            };

            // 安全地处理网络接口信息
            if (Array.isArray(network)) {
                safeSystemInfo.network = network
                    .filter(iface => iface && !iface.internal)
                    .map(iface => ({
                        iface: iface.iface || '',
                        type: iface.type || '',
                        mac: iface.mac || '',
                        ip4: iface.ip4 || '',
                        ip6: iface.ip6 || ''
                    }));
            }

            return safeSystemInfo;
        } catch (error) {
            logger.error('获取系统信息失败:', error);
            // 返回基本的系统信息
            return {
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
            const wsUrl = `${this.config.serverUrl}/agents/${this.agentId}?token=${this.authToken}`;
            
            logger.info('连接到服务器...', { url: wsUrl });
            
            this.ws = new WebSocket(wsUrl);

            this.ws.on('open', () => {
                logger.info('WebSocket连接已建立');
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
                logger.warn('WebSocket连接已关闭', { code, reason: reason.toString() });
                this.isConnected = false;
                this.stopHeartbeat();
                this.emit('disconnected', { code, reason });
                
                if (code !== 1000) { // 非正常关闭
                    this.scheduleReconnect();
                }
            });

            this.ws.on('error', (error) => {
                logger.error('WebSocket连接错误:', error);
                this.emit('error', error);
                reject(error);
            });

            // 连接超时
            setTimeout(() => {
                if (!this.isConnected) {
                    reject(new Error('连接超时'));
                }
            }, 10000);
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
                agentId: this.agentId,
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
            data: data
        });
    }

    // 发送心跳
    sendHeartbeat() {
        return this.sendMessage({
            type: 'heartbeat',
            status: 'active',
            timestamp: Date.now()
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
            return;
        }

        this.reconnectAttempts++;
        const delay = this.config.reconnectInterval * this.reconnectAttempts;
        
        logger.info(`计划在 ${delay}ms 后重连 (尝试 ${this.reconnectAttempts}/${this.config.maxReconnectAttempts})`);
        
        setTimeout(() => {
            this.connect().catch(error => {
                logger.error('重连失败:', error);
            });
        }, delay);
    }

    // 断开连接
    disconnect() {
        logger.info('断开服务器连接');
        this.isConnected = false;
        this.stopHeartbeat();
        
        if (this.ws) {
            this.ws.close(1000, 'Client disconnect');
            this.ws = null;
        }
    }

    // 获取连接状态
    isConnected() {
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
}

module.exports = AgentService; 