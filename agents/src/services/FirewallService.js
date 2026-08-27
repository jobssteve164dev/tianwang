const EventEmitter = require('events');
const os = require('os');
const { exec, execFile } = require('child_process');
const net = require('net');
const logger = require('../utils/logger');

class FirewallService extends EventEmitter {
    constructor(options = {}) {
        super();
        this.platform = os.platform();
        this.isEnabled = false;
        this.rules = new Map();
        this.blockedIPs = new Set();
        this.allowedIPs = new Set();
        this.executions = new Map();
        this.executionStore = options.executionStore || null;
        this.config = {
            autoBlock: false,
            blockDuration: 3600000, // 1小时
            maxBlockedIPs: 1000,
            whitelistIPs: ['127.0.0.1', '::1', '192.168.1.1'],
            logLevel: 'info'
        };
    }

    // 初始化防火墙服务
    async initialize(config = {}) {
        Object.assign(this.config, config);
        
        logger.info('初始化防火墙服务...', { platform: this.platform });

        try {
            // 检查平台特定权限
            if (this.platform === 'darwin') {
                const hasPermissions = await this.checkMacOSPermissions();
                if (!hasPermissions) {
                    logger.warn('macOS权限不足，防火墙功能将受限');
                    this.isEnabled = false;
                    return false;
                }
            }
            
            // 检查防火墙状态
            await this.checkFirewallStatus();
            
            // 加载现有规则
            await this.loadExistingRules();

            if (this.platform === 'darwin') {
                const anchor = 'table <tianwang_blocked> persist\nblock drop quick from <tianwang_blocked> to any\nblock drop quick to <tianwang_blocked>\n';
                const anchorResult = await this.executeFile('pfctl', ['-a', 'tianwang', '-f', '-'], 10000, anchor);
                if (!anchorResult.success) {
                    throw new Error(`无法初始化天网 pf 锚点: ${anchorResult.error || anchorResult.stderr}`);
                }
            }

            await this.restoreExecutions();
            
            // 初始化白名单
            this.config.whitelistIPs.forEach(ip => {
                this.allowedIPs.add(ip);
            });

            this.isEnabled = true;
            logger.info('防火墙服务初始化成功');
            
            return true;
        } catch (error) {
            logger.error('防火墙服务初始化失败:', error);
            return false;
        }
    }

    // 检查macOS权限
    async checkMacOSPermissions() {
        try {
            // 检查是否有执行sudo命令的权限
            const result = await this.executeCommand('sudo -n true', 5000);
            if (!result.success) {
                logger.warn('无法执行sudo命令，需要管理员权限');
                return false;
            }
            
            // 检查pfctl是否可用
            const pfctlResult = await this.executeCommand('which pfctl', 5000);
            if (!pfctlResult.success) {
                logger.warn('pfctl命令不可用');
                return false;
            }
            
            return true;
        } catch (error) {
            logger.error('权限检查失败:', error);
            return false;
        }
    }

    // 检查防火墙状态
    async checkFirewallStatus() {
        let command;
        
        switch (this.platform) {
            case 'win32':
                command = 'netsh advfirewall show allprofiles state';
                break;
            case 'linux':
                command = 'ufw status || iptables -L -n | head -5';
                break;
            case 'darwin':
                // macOS需要特殊处理权限问题
                command = 'sudo pfctl -s info';
                break;
            default:
                throw new Error(`不支持的平台: ${this.platform}`);
        }

        return new Promise((resolve, reject) => {
            exec(command, (error, stdout, stderr) => {
                if (error) {
                    logger.warn('防火墙状态检查失败:', error.message);
                    // 对于macOS，记录权限问题
                    if (this.platform === 'darwin') {
                        logger.warn('macOS防火墙需要管理员权限，请确保应用已获得必要权限');
                        logger.warn('建议: 1. 在系统偏好设置中授予应用完全磁盘访问权限');
                        logger.warn('建议: 2. 在安全性与隐私中允许应用控制其他应用');
                    }
                    // 不抛出错误，允许服务继续运行
                    resolve(false);
                } else {
                    logger.debug('防火墙状态:', stdout);
                    resolve(true);
                }
            });
        });
    }

    // 加载现有防火墙规则
    async loadExistingRules() {
        try {
            let command;
            
            switch (this.platform) {
                case 'win32':
                    command = 'netsh advfirewall firewall show rule name=all dir=in';
                    break;
                case 'linux':
                    command = 'iptables -L INPUT -n --line-numbers';
                    break;
                case 'darwin':
                    command = 'pfctl -s rules';
                    break;
                default:
                    return;
            }

            const result = await this.executeCommand(command);
            if (result.success) {
                this.parseExistingRules(result.stdout);
            }
        } catch (error) {
            logger.error('加载现有防火墙规则失败:', error);
        }
    }

    // 解析现有规则
    parseExistingRules(output) {
        try {
            const lines = output.split('\n').filter(line => line.trim().length > 0);
            let tianwangRules = 0;
            
            // 解析不同平台的规则输出
            switch (this.platform) {
                case 'win32':
                    // Windows防火墙规则格式
                    lines.forEach(line => {
                        if (line.includes('tianwang_block_') && line.includes('Block')) {
                            tianwangRules++;
                            // 提取IP地址和规则ID
                            const ipMatch = line.match(/RemoteIP:\s*([^\s]+)/);
                            const ruleMatch = line.match(/Rule Name:\s*([^\s]+)/);
                            if (ipMatch && ruleMatch) {
                                const ip = ipMatch[1];
                                const ruleId = ruleMatch[1];
                                this.blockedIPs.add(ip);
                                this.rules.set(ruleId, {
                                    ip,
                                    reason: 'Existing rule',
                                    platform: this.platform,
                                    timestamp: Date.now(),
                                    duration: this.config.blockDuration
                                });
                            }
                        }
                    });
                    break;
                    
                case 'linux':
                    // Linux iptables规则格式
                    lines.forEach(line => {
                        if (line.includes('tianwang_block_') && line.includes('DROP')) {
                            tianwangRules++;
                            // 提取IP地址
                            const ipMatch = line.match(/--source\s+([^\s]+)/);
                            if (ipMatch) {
                                const ip = ipMatch[1];
                                const ruleId = `existing_rule_${tianwangRules}`;
                                this.blockedIPs.add(ip);
                                this.rules.set(ruleId, {
                                    ip,
                                    reason: 'Existing rule',
                                    platform: this.platform,
                                    timestamp: Date.now(),
                                    duration: this.config.blockDuration
                                });
                            }
                        }
                    });
                    break;
                    
                case 'darwin':
                    // macOS pfctl规则格式
                    lines.forEach(line => {
                        if (line.includes('block drop from') && line.includes('tianwang')) {
                            tianwangRules++;
                            // 提取IP地址
                            const ipMatch = line.match(/from\s+([^\s]+)\s+to/);
                            if (ipMatch) {
                                const ip = ipMatch[1];
                                const ruleId = `existing_rule_${tianwangRules}`;
                                this.blockedIPs.add(ip);
                                this.rules.set(ruleId, {
                                    ip,
                                    reason: 'Existing rule',
                                    platform: this.platform,
                                    timestamp: Date.now(),
                                    duration: this.config.blockDuration
                                });
                            }
                        }
                    });
                    break;
            }
            
            logger.info(`加载了 ${tianwangRules} 条现有的TianWang防火墙规则`);
        } catch (error) {
            logger.error('解析现有防火墙规则失败:', error);
        }
    }

    // 阻止IP地址
    async blockIP(ip, reason = 'Security threat detected', duration = null) {
        if (!this.isValidIP(ip)) {
            throw new Error(`无效的IP地址: ${ip}`);
        }

        if (this.isProtectedIP(ip)) {
            logger.warn(`IP ${ip} 属于本地保护范围，跳过阻止`);
            return false;
        }

        if (this.blockedIPs.has(ip)) {
            logger.warn(`IP ${ip} 已被阻止`);
            return true;
        }

        logger.warn(`阻止IP地址: ${ip}, 原因: ${reason}`);

        try {
            const ruleId = await this.addBlockRule(ip, reason);
            
            if (ruleId) {
                // 设置自动解除阻止
                if (duration || this.config.blockDuration > 0) {
                    const timeout = duration || this.config.blockDuration;
                    setTimeout(() => {
                        this.unblockIP(ip, 'Automatic unblock after timeout');
                    }, timeout);
                }

                this.emit('ip-blocked', { ip, reason, ruleId });
                return true;
            }
        } catch (error) {
            logger.error(`阻止IP ${ip} 失败:`, error);
        }

        return false;
    }

    async blockIPWithReceipt(ip, reason, duration, idempotencyKey) {
        if (!idempotencyKey || typeof idempotencyKey !== 'string') {
            throw new Error('防火墙动作缺少幂等键');
        }
        if (this.executions.has(idempotencyKey)) {
            return this.executions.get(idempotencyKey);
        }
        if (!this.isValidIP(ip) || this.isProtectedIP(ip)) {
            throw new Error('阻断目标无效或属于本地保护地址');
        }

        const ruleId = await this.addBlockRule(ip, reason);
        const receipt = {
            execution_id: idempotencyKey,
            rule_id: ruleId,
            target: ip,
            applied_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + duration).toISOString(),
            rollback_available: true
        };
        this.executions.set(idempotencyKey, receipt);
        this.persistExecutions();

        setTimeout(() => {
            this.rollbackExecution(idempotencyKey, 'TTL expired').catch(error => {
                logger.error('防火墙规则到期回滚失败:', error);
            });
        }, duration);
        this.emit('ip-blocked', { ip, reason, ruleId });
        return receipt;
    }

    async rollbackExecution(executionId, reason = 'Response plan rollback') {
        const receipt = this.executions.get(executionId);
        if (!receipt) {
            return { execution_id: executionId, status: 'already_absent' };
        }

        const removed = await this.removeBlockRule(receipt.rule_id, receipt.target);
        if (!removed) {
            throw new Error(`无法精确回滚防火墙执行对象: ${executionId}`);
        }
        this.executions.delete(executionId);
        this.persistExecutions();
        this.emit('ip-unblocked', { ip: receipt.target, reason, ruleId: receipt.rule_id });
        return {
            execution_id: executionId,
            status: 'rolled_back',
            rolled_back_at: new Date().toISOString()
        };
    }

    // 解除IP阻止
    async unblockIP(ip, reason = 'Manual unblock') {
        if (!this.blockedIPs.has(ip)) {
            logger.warn(`IP ${ip} 未被阻止`);
            return false;
        }

        logger.info(`解除IP阻止: ${ip}, 原因: ${reason}`);

        try {
            // 查找对应的规则ID
            let ruleId = null;
            for (const [id, rule] of this.rules.entries()) {
                if (rule.ip === ip) {
                    ruleId = id;
                    break;
                }
            }

            if (ruleId && await this.removeBlockRule(ruleId, ip)) {
                this.emit('ip-unblocked', { ip, reason, ruleId });
                return true;
            }
        } catch (error) {
            logger.error(`解除IP阻止 ${ip} 失败:`, error);
        }

        return false;
    }

    // 添加阻止规则（平台特定实现）
    async addBlockRule(ip, reason) {
        let systemRules;
        const ruleId = `tianwang_block_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        switch (this.platform) {
            case 'win32':
                systemRules = [
                    { executable: 'netsh', args: ['advfirewall', 'firewall', 'add', 'rule', `name=${ruleId}_in`, 'dir=in', 'action=block', `remoteip=${ip}`] },
                    { executable: 'netsh', args: ['advfirewall', 'firewall', 'add', 'rule', `name=${ruleId}_out`, 'dir=out', 'action=block', `remoteip=${ip}`] }
                ];
                break;
            case 'linux':
                systemRules = [
                    { executable: net.isIP(ip) === 6 ? 'ip6tables' : 'iptables', args: ['-A', 'INPUT', '-s', ip, '-j', 'DROP', '-m', 'comment', '--comment', `${ruleId}_in`] },
                    { executable: net.isIP(ip) === 6 ? 'ip6tables' : 'iptables', args: ['-A', 'OUTPUT', '-d', ip, '-j', 'DROP', '-m', 'comment', '--comment', `${ruleId}_out`] }
                ];
                break;
            case 'darwin':
                systemRules = [
                    { executable: 'pfctl', args: ['-a', 'tianwang', '-t', 'tianwang_blocked', '-T', 'add', ip] }
                ];
                break;
            default:
                throw new Error(`不支持的平台: ${this.platform}`);
        }

        const appliedRules = [];
        for (const systemRule of systemRules) {
            const result = await this.executeFile(systemRule.executable, systemRule.args);
            if (!result.success) {
                const compensationFailures = [];
                for (const applied of appliedRules.reverse()) {
                    const rollback = await this.executeFile(applied.executable, this.toRemovalArgs(applied.args));
                    if (!rollback.success) compensationFailures.push(applied);
                }
                if (compensationFailures.length > 0) {
                    this.rules.set(ruleId, {
                        ip,
                        reason: `${reason} (partial application requires reconciliation)`,
                        platform: this.platform,
                        systemRules: compensationFailures,
                        timestamp: Date.now(),
                        duration: this.config.blockDuration
                    });
                    this.blockedIPs.add(ip);
                }
                const error = new Error(`添加防火墙规则失败: ${result.error || result.stderr}`);
                error.code = compensationFailures.length > 0 ? 'FIREWALL_PARTIAL_APPLICATION' : 'FIREWALL_RULE_FAILED';
                error.ruleId = compensationFailures.length > 0 ? ruleId : null;
                throw error;
            }
            appliedRules.push(systemRule);
        }

        if (appliedRules.length === systemRules.length) {
            // 将规则存储到Map中，用于统计
            this.rules.set(ruleId, {
                ip,
                reason,
                platform: this.platform,
                systemRules,
                timestamp: Date.now(),
                duration: this.config.blockDuration
            });
            
            // 添加到阻止IP集合
            this.blockedIPs.add(ip);
            
            logger.debug(`防火墙规则已添加: ${ruleId}`);
            this.emit('rule-added', { ruleId, ip, reason });
            return ruleId;
        }
    }

    // 移除阻止规则（平台特定实现）
    async removeBlockRule(ruleId, ip) {
        const rule = this.rules.get(ruleId);
        if (!rule || rule.ip !== ip) {
            logger.warn('拒绝移除不属于该执行对象的规则', { ruleId, ip });
            return false;
        }

        const systemRules = rule.systemRules || [];
        if (systemRules.length === 0) return false;
        const remainingRules = [];
        for (const systemRule of [...systemRules].reverse()) {
            const result = await this.executeFile(systemRule.executable, this.toRemovalArgs(systemRule.args));
            if (!result.success) remainingRules.push(systemRule);
        }
        if (remainingRules.length === 0) {
            // 从Map中移除规则
            this.rules.delete(ruleId);
            
            // 从阻止IP集合中移除
            this.blockedIPs.delete(ip);
            
            logger.debug(`防火墙规则已移除: ${ruleId}`);
            this.emit('rule-removed', { ruleId, ip });
            return true;
        }
        rule.systemRules = remainingRules;
        this.rules.set(ruleId, rule);
        logger.error(`移除防火墙规则失败: ${ruleId}`);
        return false;
    }

    toRemovalArgs(args) {
        if (this.platform === 'win32') {
            const name = args.find(arg => arg.startsWith('name='));
            return ['advfirewall', 'firewall', 'delete', 'rule', name];
        }
        if (this.platform === 'linux') {
            return ['-D', ...args.slice(1)];
        }
        if (this.platform === 'darwin') {
            return args.map(arg => arg === 'add' ? 'delete' : arg);
        }
        throw new Error(`不支持的平台: ${this.platform}`);
    }

    async restoreExecutions() {
        if (!this.executionStore) return;
        const persisted = this.executionStore.get('responseExecutions', {});
        for (const [executionId, entry] of Object.entries(persisted)) {
            if (!entry?.receipt || !entry?.rule?.systemRules) continue;
            this.executions.set(executionId, entry.receipt);
            this.rules.set(entry.receipt.rule_id, entry.rule);
            this.blockedIPs.add(entry.receipt.target);
            const remainingMs = Date.parse(entry.receipt.expires_at) - Date.now();
            if (remainingMs <= 0) {
                await this.rollbackExecution(executionId, 'TTL expired while agent was offline');
            } else {
                setTimeout(() => {
                    this.rollbackExecution(executionId, 'TTL expired').catch(error => {
                        logger.error('恢复的防火墙规则到期回滚失败:', error);
                    });
                }, remainingMs);
            }
        }
    }

    persistExecutions() {
        if (!this.executionStore) return;
        const persisted = {};
        for (const [executionId, receipt] of this.executions.entries()) {
            const rule = this.rules.get(receipt.rule_id);
            if (rule) persisted[executionId] = { receipt, rule };
        }
        this.executionStore.set('responseExecutions', persisted);
    }

    // 允许IP地址（添加到白名单）
    async allowIP(ip, reason = 'Whitelist addition') {
        if (!this.isValidIP(ip)) {
            throw new Error(`无效的IP地址: ${ip}`);
        }

        if (this.allowedIPs.has(ip)) {
            logger.warn(`IP ${ip} 已在白名单中`);
            return true;
        }

        logger.info(`添加IP到白名单: ${ip}, 原因: ${reason}`);

        // 如果IP当前被阻止，先解除阻止
        if (this.blockedIPs.has(ip)) {
            await this.unblockIP(ip, 'Added to whitelist');
        }

        this.allowedIPs.add(ip);
        this.emit('ip-allowed', { ip, reason });
        return true;
    }

    // 从白名单移除IP
    async disallowIP(ip, reason = 'Whitelist removal') {
        if (!this.allowedIPs.has(ip)) {
            logger.warn(`IP ${ip} 不在白名单中`);
            return false;
        }

        // 保护系统关键IP
        if (['127.0.0.1', '::1'].includes(ip)) {
            logger.error(`无法从白名单移除系统关键IP: ${ip}`);
            return false;
        }

        logger.info(`从白名单移除IP: ${ip}, 原因: ${reason}`);
        this.allowedIPs.delete(ip);
        this.emit('ip-disallowed', { ip, reason });
        return true;
    }

    // 获取被阻止的IP列表
    getBlockedIPs() {
        return Array.from(this.blockedIPs).map(ip => {
            const rule = Array.from(this.rules.values()).find(r => r.ip === ip);
            return {
                ip,
                reason: rule?.reason || 'Unknown',
                timestamp: rule?.timestamp || 0,
                duration: rule?.duration || 0
            };
        });
    }

    // 获取白名单IP列表
    getAllowedIPs() {
        return Array.from(this.allowedIPs);
    }

    // 获取防火墙统计信息
    getStatistics() {
        return {
            blockedIPs: this.blockedIPs.size,
            allowedIPs: this.allowedIPs.size,
            totalRules: this.rules.size,
            platform: this.platform,
            isEnabled: this.isEnabled,
            autoBlock: this.config.autoBlock
        };
    }

    // 清理过期规则
    async cleanupExpiredRules() {
        const now = Date.now();
        const expiredRules = [];

        for (const [ruleId, rule] of this.rules.entries()) {
            if (rule.duration > 0 && (now - rule.timestamp) > rule.duration) {
                expiredRules.push({ ruleId, rule });
            }
        }

        for (const { ruleId, rule } of expiredRules) {
            try {
                await this.unblockIP(rule.ip, 'Rule expired');
                logger.debug(`清理过期规则: ${ruleId}`);
            } catch (error) {
                logger.error(`清理过期规则失败 ${ruleId}:`, error);
            }
        }

        if (expiredRules.length > 0) {
            logger.info(`清理了 ${expiredRules.length} 条过期防火墙规则`);
        }
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

    async executeFile(executable, args, timeout = 10000, input = null) {
        return new Promise((resolve) => {
            const child = execFile(executable, args, { timeout }, (error, stdout, stderr) => {
                resolve({
                    success: !error,
                    stdout: stdout || '',
                    stderr: stderr || '',
                    error: error?.message
                });
            });
            if (input !== null) {
                child.stdin.end(input);
            }
        });
    }

    // 验证IP地址格式
    isValidIP(ip) {
        return net.isIP(ip) !== 0;
    }

    isProtectedIP(ip) {
        if (this.allowedIPs.has(ip)) return true;
        const version = net.isIP(ip);
        if (version === 4) {
            const first = Number(ip.split('.')[0]);
            return first === 0 || first === 127 || first >= 224 || ip === '255.255.255.255';
        }
        if (version === 6) {
            const normalized = ip.toLowerCase();
            return normalized === '::' || normalized === '::1' || normalized.startsWith('ff');
        }
        return true;
    }

    // 启用自动阻止
    enableAutoBlock() {
        this.config.autoBlock = true;
        logger.info('自动阻止功能已启用');
        this.emit('auto-block-enabled');
    }

    // 禁用自动阻止
    disableAutoBlock() {
        this.config.autoBlock = false;
        logger.info('自动阻止功能已禁用');
        this.emit('auto-block-disabled');
    }

    // 更新配置
    updateConfig(newConfig) {
        Object.assign(this.config, newConfig);
        logger.info('防火墙配置已更新:', newConfig);
        this.emit('config-updated', this.config);
    }

    // 导出规则
    exportRules() {
        const rules = Array.from(this.rules.entries()).map(([id, rule]) => ({
            id,
            ...rule
        }));

        return {
            timestamp: Date.now(),
            platform: this.platform,
            rules,
            blockedIPs: Array.from(this.blockedIPs),
            allowedIPs: Array.from(this.allowedIPs),
            config: this.config
        };
    }

    // 导入规则
    async importRules(data) {
        if (!data || !data.rules) {
            throw new Error('无效的规则数据');
        }

        logger.info(`导入 ${data.rules.length} 条防火墙规则`);

        let successCount = 0;
        let errorCount = 0;

        for (const rule of data.rules) {
            try {
                if (rule.ip && !this.blockedIPs.has(rule.ip)) {
                    await this.blockIP(rule.ip, rule.reason || 'Imported rule', rule.duration);
                    successCount++;
                }
            } catch (error) {
                logger.error(`导入规则失败 ${rule.ip}:`, error);
                errorCount++;
            }
        }

        logger.info(`规则导入完成: 成功 ${successCount}, 失败 ${errorCount}`);
        return { successCount, errorCount };
    }

    // 关闭防火墙服务
    async shutdown() {
        logger.info('关闭防火墙服务...');

        // 清理定时器
        // 这里可以添加清理定时器的逻辑

        // 可选：清理所有由此服务创建的规则
        // await this.clearAllRules();

        this.isEnabled = false;
        this.emit('shutdown');
        logger.info('防火墙服务已关闭');
    }

    // 清理所有规则（谨慎使用）
    async clearAllRules() {
        logger.warn('清理所有防火墙规则...');

        const ips = Array.from(this.blockedIPs);
        for (const ip of ips) {
            try {
                await this.unblockIP(ip, 'Service shutdown cleanup');
            } catch (error) {
                logger.error(`清理规则失败 ${ip}:`, error);
            }
        }

        logger.info(`清理完成，移除了 ${ips.length} 条规则`);
    }
}

module.exports = FirewallService;
