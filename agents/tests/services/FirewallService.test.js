jest.mock('os', () => ({ platform: jest.fn(() => 'linux') }));
jest.mock('../../src/utils/logger', () => ({
    info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn()
}));

const FirewallService = require('../../src/services/FirewallService');

describe('FirewallService current parameterized rule contract', () => {
    let service;

    beforeEach(() => {
        jest.clearAllMocks();
        service = new FirewallService();
        service.platform = 'linux';
    });

    test('initializes supported platform state and the protected allow-list', async () => {
        service.checkFirewallStatus = jest.fn().mockResolvedValue(true);
        service.loadExistingRules = jest.fn().mockResolvedValue(undefined);
        service.restoreExecutions = jest.fn().mockResolvedValue(undefined);
        await expect(service.initialize({ whitelistIPs: ['127.0.0.1', '::1', '10.0.0.1'] })).resolves.toBe(true);
        expect(service.isEnabled).toBe(true);
        expect(service.getAllowedIPs()).toEqual(expect.arrayContaining(['127.0.0.1', '::1', '10.0.0.1']));
        expect(service.restoreExecutions).toHaveBeenCalled();
    });

    test('does not claim initialization on an unsupported platform', async () => {
        service.platform = 'freebsd';
        await expect(service.initialize()).resolves.toBe(false);
        expect(service.isEnabled).toBe(false);
    });

    test('uses the runtime IP parser and protects loopback, multicast and allow-listed addresses', () => {
        service.allowedIPs.add('10.0.0.1');
        expect(service.isValidIP('203.0.113.10')).toBe(true);
        expect(service.isValidIP('2001:db8::1')).toBe(true);
        expect(service.isValidIP('256.0.0.1')).toBe(false);
        expect(service.isProtectedIP('127.0.0.1')).toBe(true);
        expect(service.isProtectedIP('224.0.0.1')).toBe(true);
        expect(service.isProtectedIP('ff02::1')).toBe(true);
        expect(service.isProtectedIP('10.0.0.1')).toBe(true);
        expect(service.isProtectedIP('203.0.113.10')).toBe(false);
    });

    test('blocks through parameterized inbound and outbound rules', async () => {
        jest.useFakeTimers();
        service.executeFile = jest.fn().mockResolvedValue({ success: true, stdout: '', stderr: '' });
        await expect(service.blockIP('203.0.113.10', 'containment', 1000)).resolves.toBe(true);
        expect(service.executeFile).toHaveBeenCalledTimes(2);
        expect(service.executeFile.mock.calls[0]).toEqual([
            'iptables', expect.arrayContaining(['-A', 'INPUT', '-s', '203.0.113.10', 'DROP'])
        ]);
        expect(service.blockedIPs.has('203.0.113.10')).toBe(true);
        jest.useRealTimers();
    });

    test('refuses protected and syntactically invalid targets before kernel execution', async () => {
        service.allowedIPs.add('10.0.0.1');
        service.executeFile = jest.fn();
        await expect(service.blockIP('10.0.0.1')).resolves.toBe(false);
        await expect(service.blockIP('not-an-ip')).rejects.toThrow('无效的IP地址');
        expect(service.executeFile).not.toHaveBeenCalled();
    });

    test('compensates an already-applied rule when the paired rule fails', async () => {
        service.executeFile = jest.fn()
            .mockResolvedValueOnce({ success: true })
            .mockResolvedValueOnce({ success: false, error: 'permission denied' })
            .mockResolvedValueOnce({ success: true });
        await expect(service.addBlockRule('203.0.113.20', 'containment')).rejects.toMatchObject({
            code: 'FIREWALL_RULE_FAILED', ruleId: null
        });
        expect(service.executeFile.mock.calls[2]).toEqual([
            'iptables', expect.arrayContaining(['-D', 'INPUT', '-s', '203.0.113.20'])
        ]);
        expect(service.blockedIPs.has('203.0.113.20')).toBe(false);
    });

    test('retains a reconciliation marker when compensation itself fails', async () => {
        service.executeFile = jest.fn()
            .mockResolvedValueOnce({ success: true })
            .mockResolvedValueOnce({ success: false, error: 'second rule failed' })
            .mockResolvedValueOnce({ success: false, error: 'rollback failed' });
        await expect(service.addBlockRule('203.0.113.30', 'containment')).rejects.toMatchObject({
            code: 'FIREWALL_PARTIAL_APPLICATION', ruleId: expect.any(String)
        });
        expect(service.blockedIPs.has('203.0.113.30')).toBe(true);
        expect(service.rules.size).toBe(1);
    });

    test('allows, unblocks and protects an explicitly trusted address', async () => {
        service.blockedIPs.add('203.0.113.40');
        service.unblockIP = jest.fn().mockResolvedValue(true);
        await expect(service.allowIP('203.0.113.40', 'trusted')).resolves.toBe(true);
        expect(service.unblockIP).toHaveBeenCalledWith('203.0.113.40', 'Added to whitelist');
        expect(service.isProtectedIP('203.0.113.40')).toBe(true);
    });

    test('never removes the mandatory local allow-list entries', async () => {
        service.allowedIPs.add('127.0.0.1');
        await expect(service.disallowIP('127.0.0.1')).resolves.toBe(false);
        expect(service.allowedIPs.has('127.0.0.1')).toBe(true);
    });

    test('reports live firewall state without exposing rule internals', () => {
        service.isEnabled = true;
        service.blockedIPs.add('203.0.113.50');
        service.allowedIPs.add('127.0.0.1');
        service.rules.set('rule-1', { ip: '203.0.113.50' });
        expect(service.getStatistics()).toEqual({
            blockedIPs: 1, allowedIPs: 1, totalRules: 1, platform: 'linux', isEnabled: true, autoBlock: false
        });
    });
});
