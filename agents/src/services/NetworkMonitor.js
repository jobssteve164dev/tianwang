const EventEmitter = require('events');
const os = require('os');
const { exec, spawn } = require('child_process');
const si = require('systeminformation');
const logger = require('../utils/logger');

class NetworkMonitor extends EventEmitter {
    constructor() {
        super();
        this.isRunning = false;
        this.intervalId = null;
        this.config = {
            interval: 60000, // 1分钟
            collectConnections: true,
            collectTraffic: true,
            collectInterfaces: true,
            monitorPorts: true,
            suspiciousPortThreshold: 10000,
            maxConnections: 200
        };
        this.platform = os.platform();
        this.previousStats = new Map();
        this.suspiciousActivities = [];
    }

    // 开始监控
    async start() {
        if (this.isRunning) {
            logger.warn('网络监控已在运行');
            return;
        }

        logger.info('启动网络监控...');
        this.isRunning = true;

        // 立即收集一次数据
        await this.collectData();

        // 设置定期收集
        this.intervalId = setInterval(async () => {
            try {
                await this.collectData();
            } catch (error) {
                logger.error('网络数据收集失败:', error);
            }
        }, this.config.interval);

        logger.info('网络监控已启动');
    }

    // 停止监控
    async stop() {
        if (!this.isRunning) {
            logger.warn('网络监控未运行');
            return;
        }

        logger.info('停止网络监控...');
        this.isRunning = false;

        // 清除定时器
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }

        logger.info('网络监控已停止');
    }

    // 收集网络数据
    async collectData() {
        const data = {
            timestamp: Date.now(),
            hostname: os.hostname(),
            platform: this.platform
        };

        try {
            // 收集网络接口信息
            if (this.config.collectInterfaces) {
                data.interfaces = await this.collectNetworkInterfaces();
            }

            // 收集网络流量统计
            if (this.config.collectTraffic) {
                data.traffic = await this.collectTrafficStats();
            }

            // 收集网络连接
            if (this.config.collectConnections) {
                data.connections = await this.collectNetworkConnections();
            }

            // 监控端口活动
            if (this.config.monitorPorts) {
                data.portActivity = await this.monitorPortActivity();
            }

            // 检测可疑活动
            const suspicious = this.detectSuspiciousActivity(data);
            if (suspicious.length > 0) {
                data.suspicious = suspicious;
                this.emit('suspicious-activity', suspicious);
            }

            this.emit('data', data);
            logger.debug('网络数据收集完成');
        } catch (error) {
            logger.error('网络数据收集失败:', error);
        }
    }

    // 收集网络接口信息
    async collectNetworkInterfaces() {
        try {
            const interfaces = await si.networkInterfaces();
            return interfaces.map(iface => ({
                iface: iface.iface,
                ifaceName: iface.ifaceName,
                ip4: iface.ip4,
                ip6: iface.ip6,
                mac: iface.mac,
                internal: iface.internal,
                virtual: iface.virtual,
                operstate: iface.operstate,
                type: iface.type,
                duplex: iface.duplex,
                mtu: iface.mtu,
                speed: iface.speed,
                dhcp: iface.dhcp,
                dnsSuffix: iface.dnsSuffix,
                ieee8021xAuth: iface.ieee8021xAuth,
                ieee8021xState: iface.ieee8021xState
            }));
        } catch (error) {
            logger.error('收集网络接口信息失败:', error);
            return [];
        }
    }

    // 收集流量统计
    async collectTrafficStats() {
        try {
            const stats = await si.networkStats();
            const currentTime = Date.now();
            
            const trafficData = stats.map(stat => {
                const interfaceName = stat.iface;
                const previous = this.previousStats.get(interfaceName);
                
                let throughput = {
                    rxRate: 0,
                    txRate: 0,
                    totalRate: 0
                };

                if (previous) {
                    const timeDiff = (currentTime - previous.timestamp) / 1000; // 秒
                    const rxDiff = stat.rx_bytes - previous.rx_bytes;
                    const txDiff = stat.tx_bytes - previous.tx_bytes;
                    
                    throughput = {
                        rxRate: Math.max(0, rxDiff / timeDiff), // 字节/秒
                        txRate: Math.max(0, txDiff / timeDiff),
                        totalRate: Math.max(0, (rxDiff + txDiff) / timeDiff)
                    };
                }

                // 保存当前统计数据
                this.previousStats.set(interfaceName, {
                    timestamp: currentTime,
                    rx_bytes: stat.rx_bytes,
                    tx_bytes: stat.tx_bytes
                });

                return {
                    iface: stat.iface,
                    operstate: stat.operstate,
                    rx_bytes: stat.rx_bytes,
                    rx_dropped: stat.rx_dropped,
                    rx_errors: stat.rx_errors,
                    tx_bytes: stat.tx_bytes,
                    tx_dropped: stat.tx_dropped,
                    tx_errors: stat.tx_errors,
                    rx_sec: stat.rx_sec,
                    tx_sec: stat.tx_sec,
                    ms: stat.ms,
                    throughput
                };
            });

            return trafficData;
        } catch (error) {
            logger.error('收集流量统计失败:', error);
            return [];
        }
    }

    // 收集网络连接
    async collectNetworkConnections() {
        try {
            const connections = await si.networkConnections();
            
            // 过滤和限制连接数量
            const filteredConnections = connections
                .filter(conn => conn.state !== 'CLOSE_WAIT' && conn.state !== 'TIME_WAIT')
                .slice(0, this.config.maxConnections)
                .map(conn => ({
                    protocol: conn.protocol,
                    localAddress: conn.localAddress,
                    localPort: conn.localPort,
                    peerAddress: conn.peerAddress,
                    peerPort: conn.peerPort,
                    state: conn.state,
                    pid: conn.pid,
                    process: conn.process
                }));

            // 统计连接状态
            const connectionStats = this.analyzeConnections(filteredConnections);

            return {
                total: connections.length,
                active: filteredConnections.length,
                connections: filteredConnections,
                stats: connectionStats
            };
        } catch (error) {
            logger.error('收集网络连接失败:', error);
            return { total: 0, active: 0, connections: [], stats: {} };
        }
    }

    // 分析网络连接
    analyzeConnections(connections) {
        const stats = {
            byState: {},
            byProtocol: {},
            byPort: {},
            topProcesses: {},
            suspiciousPorts: []
        };

        connections.forEach(conn => {
            // 按状态统计
            stats.byState[conn.state] = (stats.byState[conn.state] || 0) + 1;
            
            // 按协议统计
            stats.byProtocol[conn.protocol] = (stats.byProtocol[conn.protocol] || 0) + 1;
            
            // 按端口统计
            if (conn.localPort) {
                stats.byPort[conn.localPort] = (stats.byPort[conn.localPort] || 0) + 1;
            }
            
            // 按进程统计
            if (conn.process) {
                stats.topProcesses[conn.process] = (stats.topProcesses[conn.process] || 0) + 1;
            }
            
            // 检测可疑端口
            if (conn.localPort && conn.localPort > this.config.suspiciousPortThreshold) {
                stats.suspiciousPorts.push({
                    port: conn.localPort,
                    process: conn.process,
                    protocol: conn.protocol,
                    state: conn.state
                });
            }
        });

        return stats;
    }

    // 监控端口活动
    async monitorPortActivity() {
        try {
            let portData = {};
            
            switch (this.platform) {
                case 'linux':
                    portData = await this.getLinuxPortActivity();
                    break;
                case 'darwin':
                    portData = await this.getMacPortActivity();
                    break;
                case 'win32':
                    portData = await this.getWindowsPortActivity();
                    break;
            }
            
            return portData;
        } catch (error) {
            logger.error('监控端口活动失败:', error);
            return {};
        }
    }

    // Linux端口活动监控
    async getLinuxPortActivity() {
        return new Promise((resolve) => {
            exec('ss -tuln', (error, stdout) => {
                if (error) {
                    logger.error('Linux端口查询失败:', error);
                    resolve({});
                    return;
                }

                const ports = this.parseLinuxPorts(stdout);
                resolve({
                    listening: ports,
                    totalListening: ports.length
                });
            });
        });
    }

    // macOS端口活动监控
    async getMacPortActivity() {
        return new Promise((resolve) => {
            exec('netstat -an | grep LISTEN', (error, stdout) => {
                if (error) {
                    logger.error('macOS端口查询失败:', error);
                    resolve({});
                    return;
                }

                const ports = this.parseMacPorts(stdout);
                resolve({
                    listening: ports,
                    totalListening: ports.length
                });
            });
        });
    }

    // Windows端口活动监控
    async getWindowsPortActivity() {
        return new Promise((resolve) => {
            exec('netstat -an | findstr LISTENING', (error, stdout) => {
                if (error) {
                    logger.error('Windows端口查询失败:', error);
                    resolve({});
                    return;
                }

                const ports = this.parseWindowsPorts(stdout);
                resolve({
                    listening: ports,
                    totalListening: ports.length
                });
            });
        });
    }

    // 解析Linux端口信息
    parseLinuxPorts(output) {
        const ports = [];
        const lines = output.split('\n').slice(1); // 跳过标题行
        
        lines.forEach(line => {
            const parts = line.trim().split(/\s+/);
            if (parts.length >= 5) {
                const [netid, state, recvq, sendq, localAddr, peerAddr] = parts;
                if (state === 'LISTEN' || state === 'UNCONN') {
                    const [ip, port] = localAddr.split(':');
                    ports.push({
                        protocol: netid,
                        ip: ip === '*' ? '0.0.0.0' : ip,
                        port: parseInt(port) || 0,
                        state: state
                    });
                }
            }
        });
        
        return ports;
    }

    // 解析macOS端口信息
    parseMacPorts(output) {
        const ports = [];
        const lines = output.split('\n');
        
        lines.forEach(line => {
            const parts = line.trim().split(/\s+/);
            if (parts.length >= 4) {
                const [protocol, recvq, sendq, localAddr] = parts;
                const [ip, port] = localAddr.split('.');
                const portNum = parseInt(port);
                if (portNum) {
                    ports.push({
                        protocol: protocol,
                        ip: ip || '0.0.0.0',
                        port: portNum,
                        state: 'LISTEN'
                    });
                }
            }
        });
        
        return ports;
    }

    // 解析Windows端口信息
    parseWindowsPorts(output) {
        const ports = [];
        const lines = output.split('\n');
        
        lines.forEach(line => {
            const parts = line.trim().split(/\s+/);
            if (parts.length >= 3) {
                const [protocol, localAddr, state] = parts;
                if (state === 'LISTENING') {
                    const [ip, port] = localAddr.split(':');
                    ports.push({
                        protocol: protocol,
                        ip: ip || '0.0.0.0',
                        port: parseInt(port) || 0,
                        state: state
                    });
                }
            }
        });
        
        return ports;
    }

    // 检测可疑活动
    detectSuspiciousActivity(data) {
        const suspicious = [];
        
        try {
            // 检测异常流量
            if (data.traffic) {
                data.traffic.forEach(iface => {
                    if (iface.throughput.totalRate > 100 * 1024 * 1024) { // 100MB/s
                        suspicious.push({
                            type: 'high-traffic',
                            interface: iface.iface,
                            rate: iface.throughput.totalRate,
                            severity: 'medium',
                            message: `接口 ${iface.iface} 流量异常: ${(iface.throughput.totalRate / 1024 / 1024).toFixed(2)} MB/s`
                        });
                    }
                });
            }

            // 检测可疑端口
            if (data.connections?.stats?.suspiciousPorts) {
                data.connections.stats.suspiciousPorts.forEach(port => {
                    suspicious.push({
                        type: 'suspicious-port',
                        port: port.port,
                        process: port.process,
                        protocol: port.protocol,
                        severity: 'high',
                        message: `检测到可疑端口活动: ${port.port} (进程: ${port.process})`
                    });
                });
            }

            // 检测连接数异常
            if (data.connections?.total > 1000) {
                suspicious.push({
                    type: 'high-connection-count',
                    count: data.connections.total,
                    severity: 'medium',
                    message: `网络连接数异常: ${data.connections.total}`
                });
            }

        } catch (error) {
            logger.error('可疑活动检测失败:', error);
        }

        return suspicious;
    }

    // 获取运行状态
    isRunning() {
        return this.isRunning;
    }

    // 更新配置
    updateConfig(newConfig) {
        Object.assign(this.config, newConfig);
        logger.info('网络监控配置已更新:', newConfig);
        
        // 如果正在运行，重启以应用新配置
        if (this.isRunning) {
            this.stop().then(() => this.start());
        }
    }

    // 获取网络摘要
    async getNetworkSummary() {
        try {
            const [interfaces, connections] = await Promise.all([
                this.collectNetworkInterfaces(),
                this.collectNetworkConnections()
            ]);

            return {
                timestamp: Date.now(),
                hostname: os.hostname(),
                platform: this.platform,
                interfaces: interfaces.length,
                activeConnections: connections.active,
                totalConnections: connections.total,
                interfaceDetails: interfaces.filter(iface => !iface.internal).map(iface => ({
                    name: iface.iface,
                    ip4: iface.ip4,
                    operstate: iface.operstate,
                    type: iface.type
                }))
            };
        } catch (error) {
            logger.error('获取网络摘要失败:', error);
            return null;
        }
    }

    // 执行网络诊断
    async runNetworkDiagnostics() {
        const diagnostics = {
            timestamp: Date.now(),
            tests: {}
        };

        try {
            // DNS解析测试
            diagnostics.tests.dns = await this.testDNSResolution();
            
            // 连通性测试
            diagnostics.tests.connectivity = await this.testConnectivity();
            
            // 延迟测试
            diagnostics.tests.latency = await this.testLatency();
            
        } catch (error) {
            logger.error('网络诊断失败:', error);
        }

        return diagnostics;
    }

    // DNS解析测试
    async testDNSResolution() {
        return new Promise((resolve) => {
            const testDomains = ['google.com', 'cloudflare.com', 'github.com'];
            const results = [];
            let completed = 0;

            testDomains.forEach(domain => {
                const start = Date.now();
                require('dns').resolve4(domain, (err, addresses) => {
                    results.push({
                        domain,
                        success: !err,
                        addresses: addresses || [],
                        responseTime: Date.now() - start,
                        error: err?.message
                    });
                    
                    completed++;
                    if (completed === testDomains.length) {
                        resolve(results);
                    }
                });
            });
        });
    }

    // 连通性测试
    async testConnectivity() {
        return new Promise((resolve) => {
            const command = this.platform === 'win32' ? 'ping -n 4 8.8.8.8' : 'ping -c 4 8.8.8.8';
            
            exec(command, { timeout: 10000 }, (error, stdout) => {
                resolve({
                    target: '8.8.8.8',
                    success: !error,
                    output: stdout,
                    error: error?.message
                });
            });
        });
    }

    // 延迟测试
    async testLatency() {
        return new Promise((resolve) => {
            const targets = ['8.8.8.8', '1.1.1.1'];
            const results = [];
            let completed = 0;

            targets.forEach(target => {
                const command = this.platform === 'win32' 
                    ? `ping -n 1 ${target}` 
                    : `ping -c 1 ${target}`;
                
                exec(command, { timeout: 5000 }, (error, stdout) => {
                    let latency = null;
                    if (!error) {
                        const match = stdout.match(/time[<=](\d+\.?\d*)/i);
                        if (match) {
                            latency = parseFloat(match[1]);
                        }
                    }
                    
                    results.push({
                        target,
                        success: !error,
                        latency,
                        error: error?.message
                    });
                    
                    completed++;
                    if (completed === targets.length) {
                        resolve(results);
                    }
                });
            });
        });
    }
}

module.exports = NetworkMonitor; 