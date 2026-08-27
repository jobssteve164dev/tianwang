const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

const mockAgentModel = jest.fn();
mockAgentModel.findOne = jest.fn();
mockAgentModel.findAll = jest.fn();
mockAgentModel.count = jest.fn();

jest.mock('../../src/models', () => ({ Agent: mockAgentModel }));
jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn()
}));
jest.mock('../../src/services/KeyManagementService', () => ({
  generateConnectionKey: jest.fn(() => ({
    key: 'connection-key', timestamp: 1700000000000, signature: 'signature', expiresAt: 1700003600000
  })),
  getPublicKey: jest.fn(() => 'public-key')
}));
jest.mock('../../src/services/DeviceFingerprintService', () => ({
  generateFingerprint: jest.fn(() => ({ fingerprint: 'fingerprint', components: {} }))
}));
jest.mock('../../src/services/RegistrationCodeService', () => ({
  validateRegistrationCode: jest.fn(), incrementCodeUsage: jest.fn(), useRegistrationCode: jest.fn(),
  disableRegistrationCode: jest.fn(), extendRegistrationCode: jest.fn()
}));
jest.mock('../../src/services/SecurityEventService', () => ({ record: jest.fn() }));

const agentController = require('../../src/controllers/agentController');
const config = require('../../src/config');
const logger = require('../../src/utils/logger');

const app = express();
app.use(express.json());
app.post('/register', agentController.registerAgent);
app.post('/auth', agentController.authenticateAgent);
app.get('/', agentController.getAgents);
app.get('/:agent_id', agentController.getAgent);
app.patch('/:agent_id/status', agentController.updateAgentStatus);
app.delete('/:agent_id', agentController.deleteAgent);
app.post('/:agent_id/heartbeat', agentController.heartbeat);
app.post('/:agent_id/data', agentController.receiveData);
app.delete('/registration-codes/:code', agentController.disableRegistrationCode);
app.patch('/registration-codes/:code/extend', agentController.extendRegistrationCode);

function storedAgent(overrides = {}) {
  return {
    agent_id: 'agent-123', hostname: 'test-host', platform: 'linux', status: 'offline',
    registered_at: new Date('2026-01-01T00:00:00Z'), last_seen: null, device_fingerprint: null,
    save: jest.fn().mockResolvedValue(undefined), destroy: jest.fn().mockResolvedValue(undefined),
    ...overrides
  };
}

describe('AgentController current Sequelize contract', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAgentModel.mockImplementation(data => storedAgent(data));
  });

  test('registers a new agent and returns credentials', async () => {
    mockAgentModel.findOne.mockResolvedValue(null);
    const response = await request(app).post('/register').send({
      agent_id: 'agent-123', hostname: 'test-host', platform: 'linux', capabilities: ['network-capture']
    }).expect(201);
    expect(response.body.success).toBe(true);
    expect(response.body.agent.agent_id).toBe('agent-123');
    expect(response.body.connectionKey.key).toBe('connection-key');
    expect(jwt.verify(response.body.token, config.jwt.secret)).toMatchObject({ agent_id: 'agent-123', type: 'agent' });
  });

  test('requires the stable node identity fields', async () => {
    const response = await request(app).post('/register').send({ hostname: 'test-host' }).expect(400);
    expect(response.body.message).toContain('agent_id, hostname, platform');
  });

  test('returns conflict for an existing agent after refreshing its metadata', async () => {
    const existing = storedAgent();
    mockAgentModel.findOne.mockResolvedValue(existing);
    const response = await request(app).post('/register').send({
      agent_id: 'agent-123', hostname: 'renamed-host', platform: 'linux'
    }).expect(409);
    expect(existing.save).toHaveBeenCalled();
    expect(existing.hostname).toBe('renamed-host');
    expect(response.body.agent_id).toBe('agent-123');
  });

  test('surfaces registration persistence errors', async () => {
    mockAgentModel.findOne.mockResolvedValue(null);
    mockAgentModel.mockImplementation(data => storedAgent({ ...data, save: jest.fn().mockRejectedValue(new Error('db down')) }));
    const response = await request(app).post('/register').send({
      agent_id: 'agent-123', hostname: 'test-host', platform: 'linux'
    }).expect(500);
    expect(response.body.success).toBe(false);
    expect(logger.error).toHaveBeenCalled();
  });

  test('authenticates an existing agent and returns a WebSocket credential pair', async () => {
    const agent = storedAgent();
    mockAgentModel.findOne.mockResolvedValue(agent);
    const response = await request(app).post('/auth').send({ agent_id: 'agent-123', hostname: 'test-host' }).expect(200);
    expect(agent.status).toBe('online');
    expect(agent.save).toHaveBeenCalled();
    expect(response.body).toMatchObject({ success: true, publicKey: 'public-key' });
    expect(response.body.token).toBeTruthy();
  });

  test('rejects authentication for an unknown agent', async () => {
    mockAgentModel.findOne.mockResolvedValue(null);
    const response = await request(app).post('/auth').send({ agent_id: 'missing', hostname: 'test-host' }).expect(404);
    expect(response.body.success).toBe(false);
  });

  test('lists agents with filters and finite pagination', async () => {
    mockAgentModel.findAll.mockResolvedValue([storedAgent()]);
    mockAgentModel.count.mockResolvedValue(1);
    const response = await request(app).get('/?status=online&platform=linux&page=2&limit=10').expect(200);
    expect(mockAgentModel.findAll).toHaveBeenCalledWith(expect.objectContaining({
      where: { status: 'online', platform: 'linux' }, limit: 10, offset: 10
    }));
    expect(response.body.data.pagination).toEqual({ page: 2, limit: 10, total: 1, pages: 1 });
  });

  test('surfaces list query errors', async () => {
    mockAgentModel.findAll.mockRejectedValue(new Error('db down'));
    await request(app).get('/').expect(500);
  });

  test('gets one agent by agent_id', async () => {
    mockAgentModel.findOne.mockResolvedValue(storedAgent());
    const response = await request(app).get('/agent-123').expect(200);
    expect(mockAgentModel.findOne).toHaveBeenCalledWith({ where: { agent_id: 'agent-123' } });
    expect(response.body.data.agent.agent_id).toBe('agent-123');
  });

  test('returns 404 for an unknown agent', async () => {
    mockAgentModel.findOne.mockResolvedValue(null);
    await request(app).get('/missing').expect(404);
  });

  test('updates a valid agent status', async () => {
    const agent = storedAgent();
    mockAgentModel.findOne.mockResolvedValue(agent);
    const response = await request(app).patch('/agent-123/status').send({ status: 'maintenance' }).expect(200);
    expect(agent.status).toBe('maintenance');
    expect(agent.save).toHaveBeenCalled();
    expect(response.body.success).toBe(true);
  });

  test('rejects an invalid agent status', async () => {
    await request(app).patch('/agent-123/status').send({ status: 'compromised' }).expect(400);
    expect(mockAgentModel.findOne).not.toHaveBeenCalled();
  });

  test('deletes the addressed agent', async () => {
    const agent = storedAgent();
    mockAgentModel.findOne.mockResolvedValue(agent);
    await request(app).delete('/agent-123').expect(200);
    expect(agent.destroy).toHaveBeenCalled();
  });

  test('updates heartbeat liveness', async () => {
    const agent = storedAgent();
    mockAgentModel.findOne.mockResolvedValue(agent);
    const response = await request(app).post('/agent-123/heartbeat').expect(200);
    expect(agent.status).toBe('online');
    expect(agent.save).toHaveBeenCalled();
    expect(response.body.timestamp).toEqual(expect.any(Number));
  });

  test('validates incoming telemetry envelope', async () => {
    const response = await request(app).post('/agent-123/data').send({ type: 'network' }).expect(400);
    expect(response.body.message).toContain('type, data');
  });

  test('waits for registration-code disable and extension persistence', async () => {
    const registrationService = require('../../src/services/RegistrationCodeService');
    registrationService.disableRegistrationCode.mockResolvedValue({ success: true, message: '已停用' });
    registrationService.extendRegistrationCode.mockResolvedValue({ success: true, newExpiry: 1800000000000 });

    await request(app).delete('/registration-codes/TW-001').expect(200);
    const extended = await request(app).patch('/registration-codes/TW-001/extend')
      .send({ additionalExpiry: 3600000 }).expect(200);

    expect(registrationService.disableRegistrationCode).toHaveBeenCalledWith('TW-001');
    expect(registrationService.extendRegistrationCode).toHaveBeenCalledWith('TW-001', 3600000);
    expect(extended.body.newExpiry).toBe(1800000000000);
  });
});
