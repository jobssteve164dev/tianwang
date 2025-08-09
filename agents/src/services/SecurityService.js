const EventEmitter = require('events');
const os = require('os');
const path = require('path');
const { exec, spawn } = require('child_process');
const fs = require('fs');
const logger = require('../utils/logger');

class SecurityService extends EventEmitter {
    constructor() {
        super();
        this.isRunning = false;
        this.config = {
            enableFirewall: true,
            enableThreatDetection: true,
            autoBlock: false,
            blockDuration: 3600000, // 1小时
            whitelistIPs: ['127.0.0.1', '::1'],
            blacklistIPs: [],
            suspiciousProcesses: [
                'nc', 'netcat', 'nmap', 'masscan', 'hping3',
                'tcpdump', 'wireshark', 'tshark'
            ],
            dangerousCommands: [
                'rm -rf', 'del /f /s /q', 'format',
                'mkfs', 'dd if=', 'fdisk'
            ]
        };
        this.platform = os.platform();
        this.blockedIPs = new Map();
        this.threatCache = new Map();
        this.firewallRules = new Map();
    }

    // 初始化安全服务
    async initialize() {
        logger.info('初始化安全服务...');
        
        try {
            // 检查防火墙状态
            await this.checkFirewallStatus();
            
            // 加载现有规则
            await this.loadFirewallRules();
            
            logger.info('安全服务初始化完成');
        } catch (error) {
            logger.error('安全服务初始化失败:', error);
            throw error;
        }
    }

    // 检查防火墙状态
    async checkFirewallStatus() {
        try {
            let command;
            switch (this.platform) {
                case 'linux':
                    command = 'iptables -L -n';
                    break;
                case 'darwin':
                    command = 'pfctl -s rules';
                    break;
                case 'win32':
                    command = 'netsh advfirewall show allprofiles state';
                    break;
                default:
                    logger.warn('不支持的平台:', this.platform);
                    return;
            }

            const result = await this.executeCommand(command);
            logger.info('防火墙状态检查完成');
            return result;
        } catch (error) {
            logger.error('防火墙状态检查失败:', error);
            return null;
        }
    }

    // 加载防火墙规则
    async loadFirewallRules() {
        try {
            switch (this.platform) {
                case 'linux':
                    await this.loadLinuxFirewallRules();
                    break;
                case 'darwin':
                    await this.loadMacFirewallRules();
                    break;
                case 'win32':
                    await this.loadWindowsFirewallRules();
                    break;
            }
            
            logger.info(`已加载 ${this.firewallRules.size} 条防火墙规则`);
        } catch (error) {
            logger.error('加载防火墙规则失败:', error);
        }
    }

    // 加载Linux防火墙规则
    async loadLinuxFirewallRules() {
        const result = await this.executeCommand('iptables -L -n --line-numbers');
        if (result.success && result.stdout) {
            const lines = result.stdout.split('\n');
            lines.forEach((line, index) => {
                if (line.includes('DROP') || line.includes('REJECT')) {
                    this.firewallRules.set(`iptables-${index}`, {
                        platform: 'linux',
                        rule: line.trim(),
                        type: 'block'
                    });
                }
            });
        }
    }

    // 加载macOS防火墙规则
    async loadMacFirewallRules() {
        const result = await this.executeCommand('pfctl -s rules');
        if (result.success && result.stdout) {
            const lines = result.stdout.split('\n');
            lines.forEach((line, index) => {
                if (line.includes('block')) {
                    this.firewallRules.set(`pf-${index}`, {
                        platform: 'darwin',
                        rule: line.trim(),
                        type: 'block'
                    });
                }
            });
        }
    }

    // 加载Windows防火墙规则
    async loadWindowsFirewallRules() {
        const result = await this.executeCommand('netsh advfirewall firewall show rule name=all');
        if (result.success && result.stdout) {
            // Windows防火墙规则解析较复杂，这里简化处理
            const rules = result.stdout.split('\n\n');
            rules.forEach((rule, index) => {
                if (rule.includes('Action:') && rule.includes('Block')) {
                    this.firewallRules.set(`windows-${index}`, {
                        platform: 'win32',
                        rule: rule.trim(),
                        type: 'block'
                    });
                }
            });
        }
    }

    // 阻止IP地址
    async blockIP(ip, reason = 'Security threat detected', duration = null) {
        if (this.config.whitelistIPs.includes(ip)) {
            logger.warn(`IP ${ip} 在白名单中，跳过阻止`);
            return false;
        }

        if (this.blockedIPs.has(ip)) {
            logger.warn(`IP ${ip} 已被阻止`);
            return true;
        }

        logger.warn(`阻止IP地址: ${ip}, 原因: ${reason}`);

        try {
            const success = await this.addFirewallRule('block', ip, reason);
            if (success) {
                const blockInfo = {
                    ip,
                    reason,
                    timestamp: Date.now(),
                    duration: duration || this.config.blockDuration
                };
                
                this.blockedIPs.set(ip, blockInfo);
                this.config.blacklistIPs.push(ip);

                // 设置自动解除阻止
                if (blockInfo.duration > 0) {
                    setTimeout(() => {
                        this.unblockIP(ip, 'Automatic unblock after duration');
                    }, blockInfo.duration);
                }

                this.emit('ip-blocked', blockInfo);
                return true;
            }
        } catch (error) {
            logger.error(`阻止IP ${ip} 失败:`, error);
        }

        return false;
    }

    // 解除IP阻止
    async unblockIP(ip, reason = 'Manual unblock') {
        if (!this.blockedIPs.has(ip)) {
            logger.warn(`IP ${ip} 未被阻止`);
            return false;
        }

        logger.info(`解除IP阻止: ${ip}, 原因: ${reason}`);

        try {
            const success = await this.removeFirewallRule('block', ip);
            if (success) {
                this.blockedIPs.delete(ip);
                const index = this.config.blacklistIPs.indexOf(ip);
                if (index > -1) {
                    this.config.blacklistIPs.splice(index, 1);
                }

                this.emit('ip-unblocked', { ip, reason, timestamp: Date.now() });
                return true;
            }
        } catch (error) {
            logger.error(`解除IP阻止 ${ip} 失败:`, error);
        }

        return false;
    }

    // 添加防火墙规则
    async addFirewallRule(action, target, reason) {
        try {
            let command;
            const ruleId = `tianwang-${Date.now()}`;

            switch (this.platform) {
                case 'linux':
                    if (action === 'block') {
                        command = `iptables -A INPUT -s ${target} -j DROP -m comment --comment "${reason}"`;
                    }
                    break;
                    
                case 'darwin':
                    if (action === 'block') {
                        command = `pfctl -t tianwang_blocked -T add ${target}`;
                    }
                    break;
                    
                case 'win32':
                    if (action === 'block') {
                        command = `netsh advfirewall firewall add rule name="${ruleId}" dir=in action=block remoteip=${target}`;
                    }
                    break;
                    
                default:
                    logger.warn('不支持的平台防火墙操作:', this.platform);
                    return false;
            }

            if (command) {
                const result = await this.executeCommand(command);
                if (result.success) {
                    this.firewallRules.set(ruleId, {
                        platform: this.platform,
                        action,
                        target,
                        reason,
                        command,
                        timestamp: Date.now()
                    });
                    return true;
                }
            }
        } catch (error) {
            logger.error('添加防火墙规则失败:', error);
        }

        return false;
    }

    // 移除防火墙规则
    async removeFirewallRule(action, target) {
        try {
            let command;
            
            switch (this.platform) {
                case 'linux':
                    if (action === 'block') {
                        command = `iptables -D INPUT -s ${target} -j DROP`;
                    }
                    break;
                    
                case 'darwin':
                    if (action === 'block') {
                        command = `pfctl -t tianwang_blocked -T delete ${target}`;
                    }
                    break;
                    
                case 'win32':
                    // Windows需要根据规则名称删除
                    const rulesToRemove = Array.from(this.firewallRules.entries())
                        .filter(([id, rule]) => rule.target === target && rule.action === action);
                    
                    for (const [ruleId] of rulesToRemove) {
                        command = `netsh advfirewall firewall delete rule name="${ruleId}"`;
                        await this.executeCommand(command);
                        this.firewallRules.delete(ruleId);
                    }
                    return true;
                    
                default:
                    logger.warn('不支持的平台防火墙操作:', this.platform);
                    return false;
            }

            if (command) {
                const result = await this.executeCommand(command);
                return result.success;
            }
        } catch (error) {
            logger.error('移除防火墙规则失败:', error);
        }

        return false;
    }

    // 分析威胁
    async analyzeThreat(data) {
        const threats = [];

        try {
            // 分析网络连接威胁
            if (data.connections) {
                const networkThreats = this.analyzeNetworkThreats(data.connections);
                threats.push(...networkThreats);
            }

            // 分析进程威胁
            if (data.processes) {
                const processThreats = this.analyzeProcessThreats(data.processes);
                threats.push(...processThreats);
            }

            // 分析系统威胁
            if (data.system) {
                const systemThreats = this.analyzeSystemThreats(data.system);
                threats.push(...systemThreats);
            }

            // 处理检测到的威胁
            for (const threat of threats) {
                await this.handleThreat(threat);
            }

        } catch (error) {
            logger.error('威胁分析失败:', error);
        }

        return threats;
    }

    // 分析网络威胁
    analyzeNetworkThreats(connections) {
        const threats = [];

        try {
            // 检查可疑连接
            connections.connections?.forEach(conn => {
                // 检查高端口连接
                if (conn.localPort > 49152 && conn.state === 'ESTABLISHED') {
                    threats.push({
                        type: 'suspicious-connection',
                        severity: 'medium',
                        source: conn.peerAddress,
                        target: conn.localAddress,
                        port: conn.localPort,
                        process: conn.process,
                        description: `可疑高端口连接: ${conn.peerAddress}:${conn.peerPort} -> ${conn.localAddress}:${conn.localPort}`
                    });
                }

                // 检查未知进程连接
                if (!conn.process || conn.process === 'unknown') {
                    threats.push({
                        type: 'unknown-process-connection',
                        severity: 'high',
                        source: conn.peerAddress,
                        port: conn.localPort,
                        description: `未知进程的网络连接: ${conn.peerAddress}:${conn.peerPort}`
                    });
                }
            });

            // 检查连接数异常
            if (connections.total > 500) {
                threats.push({
                    type: 'connection-flood',
                    severity: 'high',
                    count: connections.total,
                    description: `检测到连接数异常: ${connections.total} 个活动连接`
                });
            }

        } catch (error) {
            logger.error('网络威胁分析失败:', error);
        }

        return threats;
    }

    // 分析进程威胁
    analyzeProcessThreats(processes) {
        const threats = [];

        try {
            processes.list?.forEach(proc => {
                // 检查可疑进程名称
                const procName = proc.name?.toLowerCase() || '';
                if (this.config.suspiciousProcesses.some(sus => procName.includes(sus))) {
                    threats.push({
                        type: 'suspicious-process',
                        severity: 'high',
                        pid: proc.pid,
                        name: proc.name,
                        command: proc.command,
                        user: proc.user,
                        description: `检测到可疑进程: ${proc.name} (PID: ${proc.pid})`
                    });
                }

                // 检查高CPU使用率进程
                if (proc.cpu > 80) {
                    threats.push({
                        type: 'high-cpu-process',
                        severity: 'medium',
                        pid: proc.pid,
                        name: proc.name,
                        cpu: proc.cpu,
                        description: `进程CPU使用率异常: ${proc.name} (${proc.cpu}%)`
                    });
                }

                // 检查危险命令
                const command = proc.command?.toLowerCase() || '';
                if (this.config.dangerousCommands.some(cmd => command.includes(cmd))) {
                    threats.push({
                        type: 'dangerous-command',
                        severity: 'critical',
                        pid: proc.pid,
                        name: proc.name,
                        command: proc.command,
                        user: proc.user,
                        description: `检测到危险命令执行: ${proc.command}`
                    });
                }
            });

        } catch (error) {
            logger.error('进程威胁分析失败:', error);
        }

        return threats;
    }

    // 分析系统威胁
    analyzeSystemThreats(system) {
        const threats = [];

        try {
            // 检查内存使用率
            if (system.memory?.usage > 90) {
                threats.push({
                    type: 'high-memory-usage',
                    severity: 'medium',
                    usage: system.memory.usage,
                    description: `系统内存使用率过高: ${system.memory.usage}%`
                });
            }

            // 检查CPU使用率
            if (system.cpu?.load > 90) {
                threats.push({
                    type: 'high-cpu-usage',
                    severity: 'medium',
                    load: system.cpu.load,
                    description: `系统CPU使用率过高: ${system.cpu.load}%`
                });
            }

            // 检查系统温度
            if (system.temperature?.cpu > 85) {
                threats.push({
                    type: 'high-temperature',
                    severity: 'high',
                    temperature: system.temperature.cpu,
                    description: `CPU温度过高: ${system.temperature.cpu}°C`
                });
            }

        } catch (error) {
            logger.error('系统威胁分析失败:', error);
        }

        return threats;
    }

    // 处理威胁
    async handleThreat(threat) {
        logger.security('检测到安全威胁:', threat);

        // 缓存威胁信息
        const threatId = `${threat.type}-${Date.now()}`;
        this.threatCache.set(threatId, {
            ...threat,
            id: threatId,
            timestamp: Date.now(),
            handled: false
        });

        // 发出威胁事件
        this.emit('threat', threat);

        // 自动响应
        if (this.config.autoBlock && threat.source) {
            await this.blockIP(threat.source, `Auto-block: ${threat.description}`);
        }

        // 根据威胁类型执行特定操作
        switch (threat.type) {
            case 'dangerous-command':
                if (threat.pid) {
                    await this.terminateProcess(threat.pid, `Dangerous command: ${threat.command}`);
                }
                break;
                
            case 'suspicious-process':
                if (threat.severity === 'critical' && threat.pid) {
                    await this.terminateProcess(threat.pid, `Suspicious process: ${threat.name}`);
                }
                break;
        }

        // 标记为已处理
        const cachedThreat = this.threatCache.get(threatId);
        if (cachedThreat) {
            cachedThreat.handled = true;
        }
    }

    // 终止进程
    async terminateProcess(pid, reason) {
        logger.warn(`终止进程 PID ${pid}: ${reason}`);

        try {
            let command;
            switch (this.platform) {
                case 'linux':
                case 'darwin':
                    command = `kill -9 ${pid}`;
                    break;
                case 'win32':
                    command = `taskkill /PID ${pid} /F`;
                    break;
                default:
                    logger.warn('不支持的平台进程操作:', this.platform);
                    return false;
            }

            const result = await this.executeCommand(command);
            if (result.success) {
                logger.info(`进程 ${pid} 已终止`);
                this.emit('process-terminated', { pid, reason, timestamp: Date.now() });
                return true;
            }
        } catch (error) {
            logger.error(`终止进程 ${pid} 失败:`, error);
        }

        return false;
    }

    // 执行系统命令
    async executeCommand(command, timeout = 10000) {
        return new Promise((resolve) => {
            exec(command, { timeout }, (error, stdout, stderr) => {
                resolve({
                    success: !error,
                    stdout: stdout || '',
                    stderr: stderr || '',
                    error: error?.message
                });
            });
        });
    }

    // 获取威胁统计
    getThreatStatistics() {
        const stats = {
            total: this.threatCache.size,
            handled: 0,
            unhandled: 0,
            bySeverity: { low: 0, medium: 0, high: 0, critical: 0 },
            byType: {},
            blockedIPs: this.blockedIPs.size,
            firewallRules: this.firewallRules.size
        };

        for (const threat of this.threatCache.values()) {
            if (threat.handled) {
                stats.handled++;
            } else {
                stats.unhandled++;
            }

            stats.bySeverity[threat.severity] = (stats.bySeverity[threat.severity] || 0) + 1;
            stats.byType[threat.type] = (stats.byType[threat.type] || 0) + 1;
        }

        return stats;
    }

    // 清理过期威胁缓存
    cleanupThreatCache() {
        const now = Date.now();
        const maxAge = 24 * 60 * 60 * 1000; // 24小时

        for (const [id, threat] of this.threatCache.entries()) {
            if (now - threat.timestamp > maxAge) {
                this.threatCache.delete(id);
            }
        }
    }

    // 更新配置
    updateConfig(newConfig) {
        Object.assign(this.config, newConfig);
        logger.info('安全服务配置已更新:', newConfig);
    }

    // 获取阻止的IP列表
    getBlockedIPs() {
        return Array.from(this.blockedIPs.entries()).map(([ip, info]) => ({
            ip,
            ...info
        }));
    }

    // 获取防火墙规则
    getFirewallRules() {
        return Array.from(this.firewallRules.entries()).map(([id, rule]) => ({
            id,
            ...rule
        }));
    }
}

module.exports = SecurityService; 