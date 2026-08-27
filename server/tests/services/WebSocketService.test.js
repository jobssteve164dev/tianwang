const EventEmitter = require('events');
const WebSocket = require('ws');
const jwt = require('jsonwebtoken');

const mockAgentModel = { findOne: jest.fn() };
jest.mock('../../src/models', () => ({ Agent: mockAgentModel }));
jest.mock('../../src/services/KeyManagementService', () => ({
  verifyConnectionKeyMatch: jest.fn((provided, expected) => ({
    isValid: provided === expected,
    error: provided === expected ? null : '连接密钥不匹配'
  }))
}));
jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn()
}));

const service = require('../../src/services/WebSocketService');
const logger = require('../../src/utils/logger');
const config = require('../../src/config');

function agent(overrides = {}) {
  return {
    agent_id: 'node-1', hostname: 'node', platform: 'linux', status: 'offline',
    save: jest.fn().mockResolvedValue(undefined), ...overrides
  };
}

function socket() {
  const ws = new EventEmitter();
  ws.readyState = WebSocket.OPEN;
  ws.send = jest.fn();
  ws.close = jest.fn();
  return ws;
}

function credentials(overrides = {}) {
  const connectionKey = 'key:1700000000000:signature';
  const token = jwt.sign({
    agent_id: 'node-1', hostname: 'node', type: 'agent', connectionKey, ...overrides
  }, config.jwt.secret, { expiresIn: 60 });
  return { token, connectionKey };
}

describe('WebSocketService current node contract', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    service.clients.clear();
    service.pendingTasks.clear();
    for (const timer of service.heartbeatTimers.values()) clearInterval(timer);
    service.heartbeatTimers.clear();
    service.heartbeatInterval = 30000;
  });

  afterEach(() => {
    for (const timer of service.heartbeatTimers.values()) clearInterval(timer);
    service.heartbeatTimers.clear();
  });

  test('accepts only an agent token with the exact connection key', async () => {
    const stored = agent();
    mockAgentModel.findOne.mockResolvedValue(stored);
    const { token, connectionKey } = credentials();
    const req = { url: `/ws?token=${encodeURIComponent(token)}&connectionKey=${encodeURIComponent(connectionKey)}` };

    await expect(service.verifyClient({ req })).resolves.toBe(true);
    expect(req.agent_id).toBe('node-1');
    expect(req.agent).toBe(stored);
  });

  test.each([
    ['missing key', credentials().token, null],
    ['mismatched key', credentials().token, 'wrong'],
    ['invalid token', 'invalid-token', 'key']
  ])('rejects %s', async (_name, token, connectionKey) => {
    mockAgentModel.findOne.mockResolvedValue(agent());
    const suffix = connectionKey ? `&connectionKey=${encodeURIComponent(connectionKey)}` : '';
    await expect(service.verifyClient({ req: { url: `/ws?token=${encodeURIComponent(token)}${suffix}` } })).resolves.toBe(false);
  });

  test('rejects a valid credential for a node that no longer exists', async () => {
    mockAgentModel.findOne.mockResolvedValue(null);
    const { token, connectionKey } = credentials();
    await expect(service.verifyClient({
      req: { url: `/ws?token=${encodeURIComponent(token)}&connectionKey=${encodeURIComponent(connectionKey)}` }
    })).resolves.toBe(false);
  });

  test('tracks a connected node, marks it online and sends a welcome message', async () => {
    const stored = agent();
    const ws = socket();
    await service.handleConnection(ws, { agent_id: 'node-1', agent: stored });

    expect(service.getConnectedClients()).toEqual(['node-1']);
    expect(stored.status).toBe('online');
    expect(stored.save).toHaveBeenCalled();
    expect(JSON.parse(ws.send.mock.calls[0][0])).toMatchObject({ type: 'welcome', agent_id: 'node-1' });
  });

  test('handles heartbeat and acknowledges the same node', async () => {
    const stored = agent();
    const ws = socket();
    service.clients.set('node-1', ws);
    mockAgentModel.findOne.mockResolvedValue(stored);

    await service.handleMessage('node-1', Buffer.from(JSON.stringify({ type: 'heartbeat', status: 'online' })));
    expect(stored.status).toBe('online');
    expect(stored.save).toHaveBeenCalled();
    expect(JSON.parse(ws.send.mock.calls[0][0]).type).toBe('heartbeat_ack');
  });

  test('logs malformed and unknown messages without tearing down the channel', async () => {
    await service.handleMessage('node-1', Buffer.from('{broken'));
    await service.handleMessage('node-1', Buffer.from(JSON.stringify({ type: 'unknown' })));
    expect(logger.error).toHaveBeenCalledWith('处理WebSocket消息失败:', expect.objectContaining({ agent_id: 'node-1' }));
    expect(logger.warn).toHaveBeenCalledWith('未知消息类型:', expect.objectContaining({ agent_id: 'node-1', type: 'unknown' }));
  });

  test('broadcasts only through online sockets', () => {
    const open = socket();
    const closed = socket();
    closed.readyState = WebSocket.CLOSED;
    service.clients.set('node-1', open);
    service.clients.set('node-2', closed);
    expect(service.broadcast({ type: 'policy-update' })).toBe(1);
    expect(open.send).toHaveBeenCalled();
    expect(closed.send).not.toHaveBeenCalled();
  });

  test('resolves a dispatched task only from the addressed node receipt', async () => {
    const ws = socket();
    service.clients.set('node-1', ws);
    const pending = service.dispatchTask('node-1', { task_id: 'task-1', action: 'snapshot' }, { timeoutMs: 1000 });
    service.handleTaskResult('node-2', { task_id: 'task-1', status: 'succeeded' });
    expect(service.pendingTasks.has('task-1')).toBe(true);
    service.handleTaskResult('node-1', { task_id: 'task-1', status: 'succeeded', result: { ok: true } });
    await expect(pending).resolves.toMatchObject({ result: { ok: true } });
  });

  test('fails dispatch immediately when the target node is offline', async () => {
    await expect(service.dispatchTask('missing', { task_id: 'task-offline' }, { timeoutMs: 1000 }))
      .rejects.toMatchObject({ code: 'NODE_OFFLINE' });
    expect(service.pendingTasks.has('task-offline')).toBe(false);
  });

  test('removes a disconnected node and marks it offline', async () => {
    const stored = agent({ status: 'online' });
    service.clients.set('node-1', socket());
    mockAgentModel.findOne.mockResolvedValue(stored);
    await service.handleDisconnection('node-1', 1000, Buffer.from('done'));
    expect(service.clients.has('node-1')).toBe(false);
    expect(stored.status).toBe('offline');
    expect(stored.save).toHaveBeenCalled();
  });
});
