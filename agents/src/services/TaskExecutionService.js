const crypto = require('crypto');

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

class TaskExecutionService {
    constructor({ packetCapture, networkMonitor, systemMonitor, firewall, publicKeyProvider }) {
        this.packetCapture = packetCapture;
        this.networkMonitor = networkMonitor;
        this.systemMonitor = systemMonitor;
        this.firewall = firewall;
        this.publicKeyProvider = publicKeyProvider;
    }

    verifyTask(task) {
        const { signature, ...unsigned } = task;
        const publicKey = this.publicKeyProvider();
        if (!signature || !publicKey) {
            throw Object.assign(new Error('任务缺少可验证签名'), { code: 'INVALID_TASK_SIGNATURE' });
        }
        const verifier = crypto.createVerify('SHA256');
        verifier.update(JSON.stringify(canonicalize(unsigned)));
        if (!verifier.verify(publicKey, signature, 'base64')) {
            throw Object.assign(new Error('任务签名验证失败'), { code: 'INVALID_TASK_SIGNATURE' });
        }
        if (task.protocol_version !== 1 || !task.task_id || !task.idempotency_key) {
            throw Object.assign(new Error('任务信封不完整'), { code: 'INVALID_TASK_ENVELOPE' });
        }
        if (Date.now() > Date.parse(task.deadline_at)) {
            throw Object.assign(new Error('任务已过期'), { code: 'TASK_EXPIRED' });
        }
        if (task.params?.command || task.params?.shell || task.params?.script || task.params?.bpf) {
            throw Object.assign(new Error('节点不接受任意命令或原始过滤文本'), { code: 'FORBIDDEN_TASK_PARAMETER' });
        }
    }

    async execute(task, onProgress) {
        this.verifyTask(task);
        const requiredCapabilities = {
            'capture-network': 'network.capture',
            'collect-host-snapshot': 'host.snapshot',
            'block-remote-ip': 'response.block_ip',
            'verify-connection-absent': 'response.verify',
            'rollback-firewall': 'response.rollback'
        };
        if (task.authorization?.allowed_capability !== requiredCapabilities[task.task_type]) {
            throw Object.assign(new Error('任务授权能力与动作不匹配'), { code: 'CAPABILITY_NOT_AUTHORIZED' });
        }

        switch (task.task_type) {
            case 'capture-network': {
                const [artifact, context] = await Promise.all([
                    this.packetCapture.capture(task.task_id, task.params, onProgress),
                    this.collectContext(task.params.include_context || [])
                ]);
                return { artifacts: [artifact], context };
            }
            case 'collect-host-snapshot':
                return { context: await this.collectContext(task.params.include_context || []) };
            case 'block-remote-ip':
                return this.firewall.blockIPWithReceipt(
                    task.params.target,
                    task.params.reason || 'Authorized response plan',
                    task.params.ttl_seconds * 1000,
                    task.idempotency_key
                );
            case 'verify-connection-absent': {
                const snapshot = await this.networkMonitor.collectNetworkConnections();
                const connections = snapshot.connections || [];
                const present = connections.some(item => item.peerAddress === task.params.target || item.remoteAddress === task.params.target);
                return { target: task.params.target, present, verification: present ? 'not_verified' : 'verified', observed_at: new Date().toISOString() };
            }
            case 'rollback-firewall':
                return this.firewall.rollbackExecution(task.params.execution_id);
            default:
                throw Object.assign(new Error(`节点不支持任务类型: ${task.task_type}`), { code: 'TASK_TYPE_UNSUPPORTED' });
        }
    }

    async collectContext(scopes) {
        const result = {};
        if (scopes.includes('connections')) result.connections = await this.networkMonitor.collectNetworkConnections();
        if (scopes.includes('processes')) result.processes = await this.systemMonitor.collectProcessInfo();
        if (scopes.includes('system')) result.system = await this.systemMonitor.collectSystemInfo();
        if (scopes.includes('firewall')) result.firewall = this.firewall.getStatistics();
        return result;
    }
}

module.exports = TaskExecutionService;
