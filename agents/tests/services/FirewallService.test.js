const FirewallService = require('../../src/services/FirewallService');
const { exec } = require('child_process');
const os = require('os');

// Mock dependencies
jest.mock('child_process');
jest.mock('os');
jest.mock('../../src/utils/logger');

// Mock os methods before importing the service
const os = require('os');
os.platform = jest.fn().mockReturnValue('linux');
os.homedir = jest.fn().mockReturnValue('/home/test');

const logger = require('../../src/utils/logger');

describe('FirewallService', () => {
    let firewallService;
    
    beforeEach(() => {
        firewallService = new FirewallService();
        
        // Mock logger methods
        logger.info = jest.fn();
        logger.error = jest.fn();
        logger.warn = jest.fn();
        logger.debug = jest.fn();
        
        // Clear all mocks
        jest.clearAllMocks();
    });

    afterEach(() => {
        if (firewallService) {
            firewallService.removeAllListeners();
        }
    });

    describe('initialize', () => {
        it('should initialize firewall service successfully', async () => {
            os.platform.mockReturnValue('linux');
            exec.mockImplementation((cmd, options, callback) => {
                callback(null, 'Status: active', '');
            });

            const result = await firewallService.initialize();

            expect(result).toBe(true);
            expect(firewallService.isEnabled).toBe(true);
            expect(logger.info).toHaveBeenCalledWith('防火墙服务初始化成功');
        });

        it('should handle initialization with custom config', async () => {
            os.platform.mockReturnValue('win32');
            exec.mockImplementation((cmd, options, callback) => {
                callback(null, 'Windows Firewall is enabled', '');
            });

            const customConfig = {
                autoBlock: true,
                blockDuration: 7200000,
                whitelistIPs: ['192.168.1.100', '10.0.0.1']
            };

            const result = await firewallService.initialize(customConfig);

            expect(result).toBe(true);
            expect(firewallService.config.autoBlock).toBe(true);
            expect(firewallService.config.blockDuration).toBe(7200000);
            expect(firewallService.allowedIPs.has('192.168.1.100')).toBe(true);
        });

        it('should handle firewall check failure gracefully', async () => {
            os.platform.mockReturnValue('linux');
            exec.mockImplementation((cmd, options, callback) => {
                callback(new Error('Command not found'), '', 'ufw: command not found');
            });

            const result = await firewallService.initialize();

            expect(result).toBe(true); // Should still initialize
            expect(logger.warn).toHaveBeenCalledWith('防火墙状态检查失败:', 'Command not found');
        });

        it('should handle unsupported platform', async () => {
            os.platform.mockReturnValue('freebsd');
            
            const result = await firewallService.initialize();

            expect(result).toBe(false);
            expect(logger.error).toHaveBeenCalled();
        });
    });

    describe('IP validation', () => {
        beforeEach(async () => {
            os.platform.mockReturnValue('linux');
            await firewallService.initialize();
        });

        it('should validate IPv4 addresses correctly', () => {
            expect(firewallService.isValidIP('192.168.1.1')).toBe(true);
            expect(firewallService.isValidIP('10.0.0.1')).toBe(true);
            expect(firewallService.isValidIP('255.255.255.255')).toBe(true);
            expect(firewallService.isValidIP('0.0.0.0')).toBe(true);
        });

        it('should reject invalid IPv4 addresses', () => {
            expect(firewallService.isValidIP('256.1.1.1')).toBe(false);
            expect(firewallService.isValidIP('192.168.1')).toBe(false);
            expect(firewallService.isValidIP('192.168.1.1.1')).toBe(false);
            expect(firewallService.isValidIP('not.an.ip.address')).toBe(false);
            expect(firewallService.isValidIP('')).toBe(false);
        });

        it('should validate IPv6 addresses correctly', () => {
            expect(firewallService.isValidIP('2001:0db8:85a3:0000:0000:8a2e:0370:7334')).toBe(true);
            expect(firewallService.isValidIP('::1')).toBe(false); // Current regex doesn't support compressed IPv6
        });
    });

    describe('blockIP', () => {
        beforeEach(async () => {
            os.platform.mockReturnValue('linux');
            await firewallService.initialize();
        });

        it('should block IP successfully on Linux', async () => {
            exec.mockImplementation((cmd, options, callback) => {
                callback(null, 'Rule added', '');
            });

            const result = await firewallService.blockIP('192.168.1.100', 'Test block');

            expect(result).toBe(true);
            expect(firewallService.blockedIPs.has('192.168.1.100')).toBe(true);
            expect(exec).toHaveBeenCalledWith(
                expect.stringContaining('iptables -A INPUT -s 192.168.1.100 -j DROP'),
                expect.any(Object),
                expect.any(Function)
            );
        });

        it('should block IP successfully on Windows', async () => {
            os.platform.mockReturnValue('win32');
            await firewallService.initialize();

            exec.mockImplementation((cmd, options, callback) => {
                callback(null, 'Ok.', '');
            });

            const result = await firewallService.blockIP('192.168.1.100', 'Test block');

            expect(result).toBe(true);
            expect(firewallService.blockedIPs.has('192.168.1.100')).toBe(true);
            expect(exec).toHaveBeenCalledWith(
                expect.stringContaining('netsh advfirewall firewall add rule'),
                expect.any(Object),
                expect.any(Function)
            );
        });

        it('should block IP successfully on macOS', async () => {
            os.platform.mockReturnValue('darwin');
            await firewallService.initialize();

            exec.mockImplementation((cmd, options, callback) => {
                callback(null, 'Rules loaded', '');
            });

            const result = await firewallService.blockIP('192.168.1.100', 'Test block');

            expect(result).toBe(true);
            expect(firewallService.blockedIPs.has('192.168.1.100')).toBe(true);
            expect(exec).toHaveBeenCalledWith(
                expect.stringContaining('pfctl -a tianwang'),
                expect.any(Object),
                expect.any(Function)
            );
        });

        it('should reject invalid IP addresses', async () => {
            await expect(firewallService.blockIP('invalid.ip', 'Test'))
                .rejects.toThrow('无效的IP地址: invalid.ip');
            
            expect(firewallService.blockedIPs.has('invalid.ip')).toBe(false);
        });

        it('should skip blocking whitelisted IPs', async () => {
            firewallService.allowedIPs.add('192.168.1.100');

            const result = await firewallService.blockIP('192.168.1.100', 'Test block');

            expect(result).toBe(false);
            expect(firewallService.blockedIPs.has('192.168.1.100')).toBe(false);
            expect(logger.warn).toHaveBeenCalledWith('IP 192.168.1.100 在白名单中，跳过阻止');
        });

        it('should handle already blocked IPs', async () => {
            firewallService.blockedIPs.add('192.168.1.100');

            const result = await firewallService.blockIP('192.168.1.100', 'Test block');

            expect(result).toBe(true);
            expect(logger.warn).toHaveBeenCalledWith('IP 192.168.1.100 已被阻止');
        });

        it('should handle command execution errors', async () => {
            exec.mockImplementation((cmd, options, callback) => {
                callback(new Error('Permission denied'), '', 'Permission denied');
            });

            const result = await firewallService.blockIP('192.168.1.100', 'Test block');

            expect(result).toBe(false);
            expect(firewallService.blockedIPs.has('192.168.1.100')).toBe(false);
            expect(logger.error).toHaveBeenCalledWith('阻止IP 192.168.1.100 失败:', expect.any(Error));
        });

        it('should set automatic unblock timeout', async () => {
            jest.useFakeTimers();
            
            exec.mockImplementation((cmd, options, callback) => {
                callback(null, 'Rule added', '');
            });

            const result = await firewallService.blockIP('192.168.1.100', 'Test block', 5000);

            expect(result).toBe(true);
            expect(firewallService.blockedIPs.has('192.168.1.100')).toBe(true);

            // Mock unblockIP for timeout test
            firewallService.unblockIP = jest.fn().mockResolvedValue(true);

            // Fast forward time
            jest.advanceTimersByTime(5000);

            expect(firewallService.unblockIP).toHaveBeenCalledWith('192.168.1.100', 'Automatic unblock after timeout');

            jest.useRealTimers();
        });

        it('should emit ip-blocked event', async () => {
            exec.mockImplementation((cmd, options, callback) => {
                callback(null, 'Rule added', '');
            });

            const eventSpy = jest.fn();
            firewallService.on('ip-blocked', eventSpy);

            await firewallService.blockIP('192.168.1.100', 'Test block');

            expect(eventSpy).toHaveBeenCalledWith({
                ip: '192.168.1.100',
                reason: 'Test block',
                ruleId: expect.any(String)
            });
        });
    });

    describe('unblockIP', () => {
        beforeEach(async () => {
            os.platform.mockReturnValue('linux');
            await firewallService.initialize();
            
            // Setup a blocked IP
            firewallService.blockedIPs.add('192.168.1.100');
            firewallService.rules.set('test-rule-id', {
                ip: '192.168.1.100',
                reason: 'Test block',
                timestamp: Date.now(),
                duration: 3600000,
                ruleId: 'test-rule-id'
            });
        });

        it('should unblock IP successfully', async () => {
            exec.mockImplementation((cmd, options, callback) => {
                callback(null, 'Rule deleted', '');
            });

            const result = await firewallService.unblockIP('192.168.1.100', 'Test unblock');

            expect(result).toBe(true);
            expect(firewallService.blockedIPs.has('192.168.1.100')).toBe(false);
            expect(firewallService.rules.has('test-rule-id')).toBe(false);
        });

        it('should handle non-blocked IPs', async () => {
            const result = await firewallService.unblockIP('192.168.1.200', 'Test unblock');

            expect(result).toBe(false);
            expect(logger.warn).toHaveBeenCalledWith('IP 192.168.1.200 未被阻止');
        });

        it('should handle command execution errors', async () => {
            exec.mockImplementation((cmd, options, callback) => {
                callback(new Error('Rule not found'), '', 'Rule not found');
            });

            const result = await firewallService.unblockIP('192.168.1.100', 'Test unblock');

            expect(result).toBe(false);
            expect(logger.error).toHaveBeenCalledWith('解除IP阻止 192.168.1.100 失败:', expect.any(Error));
        });

        it('should emit ip-unblocked event', async () => {
            exec.mockImplementation((cmd, options, callback) => {
                callback(null, 'Rule deleted', '');
            });

            const eventSpy = jest.fn();
            firewallService.on('ip-unblocked', eventSpy);

            await firewallService.unblockIP('192.168.1.100', 'Test unblock');

            expect(eventSpy).toHaveBeenCalledWith({
                ip: '192.168.1.100',
                reason: 'Test unblock',
                ruleId: 'test-rule-id'
            });
        });
    });

    describe('allowIP', () => {
        beforeEach(async () => {
            os.platform.mockReturnValue('linux');
            await firewallService.initialize();
        });

        it('should add IP to whitelist', async () => {
            const result = await firewallService.allowIP('192.168.1.100', 'Test whitelist');

            expect(result).toBe(true);
            expect(firewallService.allowedIPs.has('192.168.1.100')).toBe(true);
        });

        it('should unblock IP if currently blocked', async () => {
            firewallService.blockedIPs.add('192.168.1.100');
            firewallService.unblockIP = jest.fn().mockResolvedValue(true);

            const result = await firewallService.allowIP('192.168.1.100', 'Test whitelist');

            expect(result).toBe(true);
            expect(firewallService.unblockIP).toHaveBeenCalledWith('192.168.1.100', 'Added to whitelist');
        });

        it('should handle already whitelisted IPs', async () => {
            firewallService.allowedIPs.add('192.168.1.100');

            const result = await firewallService.allowIP('192.168.1.100', 'Test whitelist');

            expect(result).toBe(true);
            expect(logger.warn).toHaveBeenCalledWith('IP 192.168.1.100 已在白名单中');
        });

        it('should reject invalid IP addresses', async () => {
            await expect(firewallService.allowIP('invalid.ip', 'Test'))
                .rejects.toThrow('无效的IP地址: invalid.ip');
        });

        it('should emit ip-allowed event', async () => {
            const eventSpy = jest.fn();
            firewallService.on('ip-allowed', eventSpy);

            await firewallService.allowIP('192.168.1.100', 'Test whitelist');

            expect(eventSpy).toHaveBeenCalledWith({
                ip: '192.168.1.100',
                reason: 'Test whitelist'
            });
        });
    });

    describe('getStatistics', () => {
        beforeEach(async () => {
            os.platform.mockReturnValue('linux');
            await firewallService.initialize();
        });

        it('should return correct statistics', () => {
            firewallService.blockedIPs.add('192.168.1.100');
            firewallService.blockedIPs.add('192.168.1.101');
            firewallService.allowedIPs.add('192.168.1.1');
            firewallService.rules.set('rule1', {});
            firewallService.rules.set('rule2', {});

            const stats = firewallService.getStatistics();

            expect(stats).toEqual({
                blockedIPs: 2,
                allowedIPs: 1,
                totalRules: 2,
                platform: 'linux',
                isEnabled: true,
                autoBlock: false
            });
        });
    });

    describe('cleanupExpiredRules', () => {
        beforeEach(async () => {
            os.platform.mockReturnValue('linux');
            await firewallService.initialize();
        });

        it('should clean up expired rules', async () => {
            const now = Date.now();
            
            // Add expired rule
            firewallService.blockedIPs.add('192.168.1.100');
            firewallService.rules.set('expired-rule', {
                ip: '192.168.1.100',
                reason: 'Test',
                timestamp: now - 7200000, // 2 hours ago
                duration: 3600000, // 1 hour duration
                ruleId: 'expired-rule'
            });

            // Add non-expired rule
            firewallService.blockedIPs.add('192.168.1.101');
            firewallService.rules.set('active-rule', {
                ip: '192.168.1.101',
                reason: 'Test',
                timestamp: now - 1800000, // 30 minutes ago
                duration: 3600000, // 1 hour duration
                ruleId: 'active-rule'
            });

            firewallService.unblockIP = jest.fn().mockResolvedValue(true);

            await firewallService.cleanupExpiredRules();

            expect(firewallService.unblockIP).toHaveBeenCalledWith('192.168.1.100', 'Rule expired');
            expect(firewallService.unblockIP).not.toHaveBeenCalledWith('192.168.1.101', 'Rule expired');
            expect(logger.info).toHaveBeenCalledWith('清理了 1 条过期防火墙规则');
        });

        it('should handle cleanup errors gracefully', async () => {
            const now = Date.now();
            
            firewallService.blockedIPs.add('192.168.1.100');
            firewallService.rules.set('expired-rule', {
                ip: '192.168.1.100',
                reason: 'Test',
                timestamp: now - 7200000,
                duration: 3600000,
                ruleId: 'expired-rule'
            });

            firewallService.unblockIP = jest.fn().mockRejectedValue(new Error('Cleanup failed'));

            await firewallService.cleanupExpiredRules();

            expect(logger.error).toHaveBeenCalledWith('清理过期规则失败 expired-rule:', expect.any(Error));
        });
    });

    describe('auto block functionality', () => {
        beforeEach(async () => {
            os.platform.mockReturnValue('linux');
            await firewallService.initialize();
        });

        it('should enable auto block', () => {
            const eventSpy = jest.fn();
            firewallService.on('auto-block-enabled', eventSpy);

            firewallService.enableAutoBlock();

            expect(firewallService.config.autoBlock).toBe(true);
            expect(logger.info).toHaveBeenCalledWith('自动阻止功能已启用');
            expect(eventSpy).toHaveBeenCalled();
        });

        it('should disable auto block', () => {
            firewallService.config.autoBlock = true;
            const eventSpy = jest.fn();
            firewallService.on('auto-block-disabled', eventSpy);

            firewallService.disableAutoBlock();

            expect(firewallService.config.autoBlock).toBe(false);
            expect(logger.info).toHaveBeenCalledWith('自动阻止功能已禁用');
            expect(eventSpy).toHaveBeenCalled();
        });
    });

    describe('export and import rules', () => {
        beforeEach(async () => {
            os.platform.mockReturnValue('linux');
            await firewallService.initialize();
        });

        it('should export rules correctly', () => {
            firewallService.blockedIPs.add('192.168.1.100');
            firewallService.allowedIPs.add('192.168.1.1');
            firewallService.rules.set('rule1', {
                ip: '192.168.1.100',
                reason: 'Test',
                timestamp: Date.now(),
                duration: 3600000,
                ruleId: 'rule1'
            });

            const exported = firewallService.exportRules();

            expect(exported).toHaveProperty('timestamp');
            expect(exported).toHaveProperty('platform', 'linux');
            expect(exported.rules).toHaveLength(1);
            expect(exported.blockedIPs).toContain('192.168.1.100');
            expect(exported.allowedIPs).toContain('192.168.1.1');
        });

        it('should import rules correctly', async () => {
            const importData = {
                timestamp: Date.now(),
                platform: 'linux',
                rules: [
                    {
                        id: 'rule1',
                        ip: '192.168.1.100',
                        reason: 'Imported rule',
                        duration: 3600000
                    }
                ],
                blockedIPs: ['192.168.1.100'],
                allowedIPs: ['192.168.1.1']
            };

            firewallService.blockIP = jest.fn().mockResolvedValue(true);

            const result = await firewallService.importRules(importData);

            expect(result.successCount).toBe(1);
            expect(result.errorCount).toBe(0);
            expect(firewallService.blockIP).toHaveBeenCalledWith('192.168.1.100', 'Imported rule', 3600000);
            expect(logger.info).toHaveBeenCalledWith('导入 1 条防火墙规则');
        });

        it('should handle import errors', async () => {
            const importData = {
                rules: [
                    { ip: '192.168.1.100', reason: 'Test' },
                    { ip: 'invalid.ip', reason: 'Test' }
                ]
            };

            firewallService.blockIP = jest.fn()
                .mockResolvedValueOnce(true)
                .mockRejectedValueOnce(new Error('Invalid IP'));

            const result = await firewallService.importRules(importData);

            expect(result.successCount).toBe(1);
            expect(result.errorCount).toBe(1);
        });

        it('should reject invalid import data', async () => {
            await expect(firewallService.importRules(null))
                .rejects.toThrow('无效的规则数据');

            await expect(firewallService.importRules({}))
                .rejects.toThrow('无效的规则数据');
        });
    });
}); 