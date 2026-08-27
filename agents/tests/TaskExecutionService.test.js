const crypto = require('crypto');
const TaskExecutionService = require('../src/services/TaskExecutionService');

function canonicalize(value) {
    if (Array.isArray(value)) return value.map(canonicalize);
    if (value && typeof value === 'object') {
        return Object.keys(value).sort().reduce((result, key) => {
            result[key] = canonicalize(value[key]);
            return result;
        }, {});
    }
    return value;
}

describe('TaskExecutionService', () => {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const sign = task => {
        const signer = crypto.createSign('SHA256');
        signer.update(JSON.stringify(canonicalize(task)));
        return { ...task, signature: signer.sign(privateKey, 'base64') };
    };
    const baseTask = {
        protocol_version: 1,
        task_id: crypto.randomUUID(),
        case_id: crypto.randomUUID(),
        node_id: 'node-1',
        issued_at: new Date().toISOString(),
        deadline_at: new Date(Date.now() + 60000).toISOString(),
        idempotency_key: 'case-action-1'
    };

    test('executes only a signed structured block action and returns its receipt', async () => {
        const firewall = {
            blockIPWithReceipt: jest.fn().mockResolvedValue({ execution_id: 'case-action-1', rule_id: 'rule-1' })
        };
        const service = new TaskExecutionService({
            packetCapture: {},
            networkMonitor: {},
            systemMonitor: {},
            firewall,
            publicKeyProvider: () => publicKey
        });
        const task = sign({
            ...baseTask,
            task_type: 'block-remote-ip',
            authorization: { allowed_capability: 'response.block_ip' },
            params: { target: '203.0.113.10', ttl_seconds: 900, reason: 'temporary containment' }
        });
        await expect(service.execute(task)).resolves.toMatchObject({ rule_id: 'rule-1' });
        expect(firewall.blockIPWithReceipt).toHaveBeenCalledWith('203.0.113.10', 'temporary containment', 900000, 'case-action-1');
    });

    test('rejects unsigned, expired and command-bearing tasks before execution', async () => {
        const service = new TaskExecutionService({
            packetCapture: {}, networkMonitor: {}, systemMonitor: {}, firewall: {}, publicKeyProvider: () => publicKey
        });
        const unsigned = { ...baseTask, task_type: 'capture-network', authorization: { allowed_capability: 'network.capture' }, params: {} };
        await expect(service.execute(unsigned)).rejects.toMatchObject({ code: 'INVALID_TASK_SIGNATURE' });
        const commandTask = sign({ ...unsigned, params: { command: 'id' } });
        await expect(service.execute(commandTask)).rejects.toMatchObject({ code: 'FORBIDDEN_TASK_PARAMETER' });
        const expired = sign({ ...unsigned, deadline_at: new Date(Date.now() - 1000).toISOString() });
        await expect(service.execute(expired)).rejects.toMatchObject({ code: 'TASK_EXPIRED' });
    });
});
