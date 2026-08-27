const mockStoreValues = new Map();
jest.mock('electron-store', () => class MockStore {
    get(key, fallback) { return mockStoreValues.has(key) ? mockStoreValues.get(key) : fallback; }
    set(key, value) { mockStoreValues.set(key, value); }
});

const mockSockets = [];
jest.mock('ws', () => jest.fn().mockImplementation(url => {
    const EventEmitter = require('events');
    const socket = new EventEmitter();
    socket.url = url;
    socket.send = jest.fn();
    socket.close = jest.fn();
    mockSockets.push(socket);
    return socket;
}));

jest.mock('os', () => ({
    hostname: jest.fn(() => 'node-host'),
    platform: jest.fn(() => 'linux'),
    arch: jest.fn(() => 'x64')
}));
jest.mock('systeminformation', () => ({
    cpu: jest.fn(async () => ({ brand: 'CPU', manufacturer: 'Vendor', cores: 4, physicalCores: 2, speed: 3 })),
    mem: jest.fn(async () => ({ total: 1024, available: 512 })),
    osInfo: jest.fn(async () => ({ distro: 'Linux', release: '1', kernel: '1', arch: 'x64' })),
    networkInterfaces: jest.fn(async () => [{ iface: 'eth0', mac: 'AA:BB:CC:DD:EE:FF', type: 'wired', internal: false }]),
    diskLayout: jest.fn(async () => [{ serial: 'disk-1', model: 'disk', size: 1000 }]),
    system: jest.fn(async () => ({ uuid: 'system-uuid', manufacturer: 'Vendor', version: '1' }))
}));
jest.mock('axios', () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock('../../src/utils/logger', () => ({
    info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn()
}));

const axios = require('axios');
const AgentService = require('../../src/services/AgentService');

function credentialResponse() {
    return {
        data: {
            success: true,
            token: 'jwt-token',
            connectionKey: { key: 'base64+key', timestamp: 1700000000000, signature: 'signed+value' },
            publicKey: 'public-key'
        }
    };
}

describe('AgentService current secure node contract', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockStoreValues.clear();
        mockSockets.length = 0;
        delete global.eventService;
    });

    test('builds a stable machine identity and loads persisted connection settings', () => {
        mockStoreValues.set('apiUrl', 'https://control.example/api');
        const service = new AgentService();
        expect(service.getAgentId()).toMatch(/^agent-[a-f0-9]{16}$/);
        expect(service.getServerConfig().apiUrl).toBe('https://control.example/api');
        expect(service.getCapabilities()).toEqual(expect.arrayContaining([
            'network-capture', 'host-snapshot', 'response-plan-v1', 'iptables'
        ]));
    });

    test('persists server configuration without assuming disconnect is asynchronous', async () => {
        const service = new AgentService();
        service.isConnected = true;
        service.disconnect = jest.fn();
        service.connect = jest.fn().mockResolvedValue(undefined);
        expect(service.updateServerConfig({ serverUrl: 'wss://control.example', apiUrl: 'https://control.example/api' })).toBe(true);
        await new Promise(resolve => setImmediate(resolve));
        expect(service.disconnect).toHaveBeenCalled();
        expect(service.connect).toHaveBeenCalled();
        expect(mockStoreValues.get('serverUrl')).toBe('wss://control.example');
    });

    test('checks the public health endpoint derived from the API URL', async () => {
        const service = new AgentService();
        service.config.apiUrl = 'https://control.example/api';
        axios.get.mockResolvedValue({ status: 200, data: { status: 'healthy' } });
        await expect(service.testServerConnection()).resolves.toMatchObject({ success: true });
        expect(axios.get).toHaveBeenCalledWith('https://control.example/health', { timeout: 10000 });
    });

    test('registers with normalized identity, capabilities and fingerprint, then stores credentials', async () => {
        const service = new AgentService();
        service.config.apiUrl = 'https://control.example/api';
        axios.post.mockResolvedValue(credentialResponse());
        const result = await service.registerAgent('registration-code');
        expect(axios.post).toHaveBeenCalledWith('https://control.example/api/agents/register', expect.objectContaining({
            agent_id: service.agentId,
            hostname: 'node-host',
            platform: 'linux',
            registrationCode: 'registration-code',
            device_fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
            capabilities: expect.arrayContaining(['network-capture'])
        }));
        expect(result.token).toBe('jwt-token');
        expect(service.getConnectionInfo()).toMatchObject({ hasAuthToken: true, hasConnectionKey: true });
    });

    test('falls back to authentication when registration reports an existing node', async () => {
        const service = new AgentService();
        service.generateDeviceFingerprint = jest.fn().mockResolvedValue('fingerprint');
        service.getSystemInfo = jest.fn().mockResolvedValue({});
        service.authenticateAgent = jest.fn().mockResolvedValue({ token: 'existing-token' });
        axios.post.mockRejectedValue({ response: { status: 409 }, message: 'conflict' });
        await expect(service.registerAgent()).resolves.toEqual({ token: 'existing-token' });
        expect(service.authenticateAgent).toHaveBeenCalled();
    });

    test('authenticates with the same node identity and fingerprint', async () => {
        const service = new AgentService();
        service.config.apiUrl = 'https://control.example/api';
        service.deviceFingerprint = 'fingerprint';
        axios.post.mockResolvedValue(credentialResponse());
        await service.authenticateAgent();
        expect(axios.post).toHaveBeenCalledWith('https://control.example/api/agents/auth', {
            agent_id: service.agentId, hostname: 'node-host', device_fingerprint: 'fingerprint'
        });
        expect(service.authToken).toBe('jwt-token');
    });

    test('opens WebSocket only with the complete URL-encoded connection key', async () => {
        const service = new AgentService();
        service.config.serverUrl = 'wss://control.example';
        service.authToken = 'jwt-token';
        service.connectionKey = credentialResponse().data.connectionKey;
        const connected = service.connect();
        expect(mockSockets[0].url).toBe(
            'wss://control.example/ws?token=jwt-token&connectionKey=base64%2Bkey%3A1700000000000%3Asigned%2Bvalue'
        );
        mockSockets[0].emit('open');
        await expect(connected).resolves.toBeUndefined();
        expect(service.isConnected).toBe(true);
        service.disconnect();
    });

    test('rejects a credential response that cannot satisfy the server security boundary', async () => {
        const service = new AgentService();
        service.authToken = 'jwt-token';
        service.connectionKey = { signature: 'legacy-only' };
        await expect(service.connect()).rejects.toThrow('完整连接密钥');
        expect(mockSockets).toHaveLength(0);
    });

    test('reports socket errors without crashing when no special error listener is installed', async () => {
        const service = new AgentService();
        service.authToken = 'jwt-token';
        service.connectionKey = credentialResponse().data.connectionKey;
        const connectionError = jest.fn();
        service.on('connection-error', connectionError);
        const pending = service.connect();
        const error = Object.assign(new Error('refused'), { code: 'ECONNREFUSED' });
        mockSockets[0].emit('error', error);
        await expect(pending).rejects.toBe(error);
        expect(connectionError).toHaveBeenCalledWith(error);
    });

    test('handles ping and structured task messages', () => {
        const service = new AgentService();
        service.sendMessage = jest.fn();
        const taskListener = jest.fn();
        service.on('task', taskListener);
        service.handleMessage({ type: 'ping' });
        service.handleMessage({ type: 'task', data: { task_id: 'task-1' } });
        expect(service.sendMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'pong' }));
        expect(taskListener).toHaveBeenCalledWith({ task_id: 'task-1' });
    });

    test('buffers offline messages and keeps failed flushes for the next connection', () => {
        const service = new AgentService();
        service.sendMessage({ type: 'data', data: 1 });
        expect(service.dataBuffer).toHaveLength(1);
        service.isConnected = true;
        service.ws = { send: jest.fn(() => { throw new Error('write failed'); }), close: jest.fn() };
        service.flushDataBuffer();
        expect(service.dataBuffer).toHaveLength(1);
        service.disconnect();
    });

    test('disconnect clears heartbeat and pending reconnect work', () => {
        jest.useFakeTimers();
        const service = new AgentService();
        service.config.reconnectInterval = 100;
        service.scheduleReconnect();
        service.startHeartbeat();
        expect(service.reconnectTimer).not.toBeNull();
        expect(service.heartbeatTimer).not.toBeNull();
        service.disconnect();
        expect(service.reconnectTimer).toBeNull();
        expect(service.heartbeatTimer).toBeNull();
        jest.useRealTimers();
    });
});
