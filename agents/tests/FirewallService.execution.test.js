const FirewallService = require('../src/services/FirewallService');

describe('FirewallService response execution', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    test('uses parameterized exact rules, is idempotent and rolls back only its own rule', async () => {
        const service = new FirewallService();
        service.platform = 'linux';
        service.isEnabled = true;
        service.executeFile = jest.fn().mockResolvedValue({ success: true, stdout: '', stderr: '' });

        const first = await service.blockIPWithReceipt('203.0.113.10', 'case containment', 900000, 'plan-1');
        const repeated = await service.blockIPWithReceipt('203.0.113.10', 'case containment', 900000, 'plan-1');
        expect(repeated).toEqual(first);
        expect(service.executeFile).toHaveBeenCalledTimes(2);
        expect(service.executeFile.mock.calls[0]).toEqual([
            'iptables',
            ['-A', 'INPUT', '-s', '203.0.113.10', '-j', 'DROP', '-m', 'comment', '--comment', `${first.rule_id}_in`]
        ]);
        expect(service.executeFile.mock.calls[1]).toEqual([
            'iptables',
            ['-A', 'OUTPUT', '-d', '203.0.113.10', '-j', 'DROP', '-m', 'comment', '--comment', `${first.rule_id}_out`]
        ]);

        await service.rollbackExecution('plan-1');
        expect(service.executeFile.mock.calls[2]).toEqual([
            'iptables',
            ['-D', 'OUTPUT', '-d', '203.0.113.10', '-j', 'DROP', '-m', 'comment', '--comment', `${first.rule_id}_out`]
        ]);
        expect(service.executeFile.mock.calls[3]).toEqual([
            'iptables',
            ['-D', 'INPUT', '-s', '203.0.113.10', '-j', 'DROP', '-m', 'comment', '--comment', `${first.rule_id}_in`]
        ]);
        await expect(service.rollbackExecution('plan-1')).resolves.toMatchObject({ status: 'already_absent' });
        expect(service.executeFile).toHaveBeenCalledTimes(4);
    });

    test('restores idempotency receipts and precise TTL rules after an agent restart', async () => {
        let stored = {};
        const executionStore = {
            get: jest.fn(() => JSON.parse(JSON.stringify(stored))),
            set: jest.fn((_key, value) => { stored = JSON.parse(JSON.stringify(value)); })
        };
        const firstProcess = new FirewallService({ executionStore });
        firstProcess.platform = 'linux';
        firstProcess.executeFile = jest.fn().mockResolvedValue({ success: true });
        const receipt = await firstProcess.blockIPWithReceipt('203.0.113.20', 'persisted containment', 900000, 'plan-restart');

        const restarted = new FirewallService({ executionStore });
        restarted.platform = 'linux';
        restarted.executeFile = jest.fn().mockResolvedValue({ success: true });
        await restarted.restoreExecutions();
        await expect(restarted.blockIPWithReceipt('203.0.113.20', 'persisted containment', 900000, 'plan-restart')).resolves.toEqual(receipt);
        expect(restarted.executeFile).not.toHaveBeenCalled();

        await restarted.rollbackExecution('plan-restart');
        expect(restarted.executeFile).toHaveBeenCalledTimes(2);
        expect(stored).toEqual({});
    });
});
