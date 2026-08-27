const http = require('http');
const WebSocket = require('ws');
const jwt = require('jsonwebtoken');

let mockAgentRecord;
const mockProcessAgentData = jest.fn();

jest.mock('../../server/src/models', () => ({
  Agent: {
    findOne: jest.fn(() => Promise.resolve(mockAgentRecord))
  }
}));

jest.mock('../../server/src/controllers/agentController', () => ({
  processAgentData: (...args) => mockProcessAgentData(...args)
}));

jest.mock('../../server/src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

const config = require('../../server/src/config');
const models = require('../../server/src/models');
const webSocketService = require('../../server/src/services/WebSocketService');

describe('WebSocket current integration contract', () => {
  let server;
  let port;
  const clients = new Set();

  const connectionKey = 'integration-key:1700000000000:signature';

  function createToken(agentId = 'node-integration') {
    return jwt.sign({
      agent_id: agentId,
      hostname: 'integration-host',
      type: 'agent',
      connectionKey
    }, config.jwt.secret, { expiresIn: '5m' });
  }

  function connect({ token = createToken(), key = connectionKey } = {}) {
    const query = new URLSearchParams({ token, connectionKey: key });
    const client = new WebSocket(`ws://127.0.0.1:${port}/ws?${query.toString()}`);
    clients.add(client);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('WebSocket 连接超时')), 3000);
      client.once('open', () => {
        clearTimeout(timer);
        resolve(client);
      });
      client.once('error', error => {
        clearTimeout(timer);
        reject(error);
      });
    });
  }

  function waitForMessage(client, predicate = () => true) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('等待 WebSocket 消息超时')), 3000);
      const handler = payload => {
        const message = JSON.parse(payload.toString());
        if (!predicate(message)) return;
        clearTimeout(timer);
        client.off('message', handler);
        resolve(message);
      };
      client.on('message', handler);
    });
  }

  async function waitUntil(predicate, message) {
    const deadline = Date.now() + 3000;
    while (!predicate()) {
      if (Date.now() >= deadline) throw new Error(message);
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  beforeAll(async () => {
    server = http.createServer();
    webSocketService.initialize(server);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    port = server.address().port;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockAgentRecord = {
      agent_id: 'node-integration',
      hostname: 'integration-host',
      platform: 'linux',
      status: 'offline',
      last_seen: null,
      save: jest.fn().mockResolvedValue(undefined)
    };
  });

  afterEach(async () => {
    const closures = [];
    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN || client.readyState === WebSocket.CONNECTING) {
        closures.push(new Promise(resolve => {
          client.once('close', resolve);
          client.close();
        }));
      }
    }
    await Promise.all(closures);
    clients.clear();
  });

  afterAll(async () => {
    webSocketService.close();
    await new Promise(resolve => server.close(resolve));
  });

  test('使用代理令牌和连接密钥建立真实连接', async () => {
    const client = await connect();
    expect(client.readyState).toBe(WebSocket.OPEN);
    expect(webSocketService.getConnectedClients()).toContain('node-integration');
    expect(mockAgentRecord.status).toBe('online');
    expect(mockAgentRecord.save).toHaveBeenCalled();
  });

  test('拒绝无效令牌和错误连接密钥', async () => {
    const invalidToken = new WebSocket(`ws://127.0.0.1:${port}/ws?token=invalid&connectionKey=x`);
    clients.add(invalidToken);
    await expect(new Promise((resolve, reject) => {
      invalidToken.once('open', () => reject(new Error('无效令牌不应连接成功')));
      invalidToken.once('error', () => resolve('rejected'));
      invalidToken.once('close', () => resolve('rejected'));
    })).resolves.toBe('rejected');

    const wrongKey = new WebSocket(`ws://127.0.0.1:${port}/ws?token=${encodeURIComponent(createToken())}&connectionKey=wrong`);
    clients.add(wrongKey);
    await expect(new Promise((resolve, reject) => {
      wrongKey.once('open', () => reject(new Error('错误连接密钥不应连接成功')));
      wrongKey.once('error', () => resolve('rejected'));
      wrongKey.once('close', () => resolve('rejected'));
    })).resolves.toBe('rejected');
  });

  test('心跳和遥测消息进入当前处理管线', async () => {
    const client = await connect();
    const heartbeatAck = waitForMessage(client, message => message.type === 'heartbeat_ack');
    client.send(JSON.stringify({ type: 'heartbeat', status: 'online' }));
    await expect(heartbeatAck).resolves.toMatchObject({ type: 'heartbeat_ack' });

    client.send(JSON.stringify({
      type: 'data',
      dataType: 'network',
      data: { connections: 3 },
      timestamp: Date.now()
    }));
    await waitUntil(() => mockProcessAgentData.mock.calls.length === 1, '遥测消息未进入处理管线');
    expect(mockProcessAgentData).toHaveBeenCalledWith(
      mockAgentRecord,
      'network',
      { connections: 3 },
      expect.any(Number)
    );
  });

  test('服务端任务下发由节点回执完成', async () => {
    const client = await connect();
    const taskMessage = waitForMessage(client, message => message.type === 'task');
    const resultPromise = webSocketService.dispatchTask('node-integration', {
      task_id: 'integration-task-1',
      action: 'capture_network'
    }, { timeoutMs: 2000 });

    const task = await taskMessage;
    expect(task.data).toMatchObject({ task_id: 'integration-task-1', action: 'capture_network' });
    client.send(JSON.stringify({
      type: 'task-result',
      task_id: 'integration-task-1',
      status: 'succeeded',
      result: { packets: 2 }
    }));
    await expect(resultPromise).resolves.toMatchObject({ result: { packets: 2 } });
  });

  test('节点断线后连接状态与数据库状态同步', async () => {
    const client = await connect();
    client.close();
    await new Promise(resolve => client.once('close', resolve));
    await waitUntil(() => mockAgentRecord.status === 'offline', '节点离线状态未同步');
    expect(webSocketService.getConnectedClients()).not.toContain('node-integration');
    expect(models.Agent.findOne).toHaveBeenCalledWith({ where: { agent_id: 'node-integration' } });
  });
});
