const jwt = require('jsonwebtoken');
const config = require('../../config');

jest.mock('../../models', () => ({
  Agent: {
    findOne: jest.fn().mockResolvedValue({ agent_id: 'node-1', hostname: 'node', platform: 'linux', status: 'online' })
  }
}));
jest.mock('../KeyManagementService', () => ({
  verifyConnectionKeyMatch: jest.fn((provided, expected) => ({ isValid: provided === expected, error: provided === expected ? null : 'mismatch' }))
}));

const webSocketService = require('../WebSocketService');

describe('WebSocketService node identity boundary', () => {
  const connectionKey = 'key:123:signature';
  const token = jwt.sign({ agent_id: 'node-1', hostname: 'node', type: 'agent', connectionKey }, config.jwt.secret, { expiresIn: 60 });

  test('rejects missing and mismatched connection keys', async () => {
    await expect(webSocketService.verifyClient({ req: { url: `/ws?token=${encodeURIComponent(token)}` } })).resolves.toBe(false);
    await expect(webSocketService.verifyClient({ req: { url: `/ws?token=${encodeURIComponent(token)}&connectionKey=wrong` } })).resolves.toBe(false);
  });

  test('accepts only the signed agent token and its exact connection key', async () => {
    const req = { url: `/ws?token=${encodeURIComponent(token)}&connectionKey=${encodeURIComponent(connectionKey)}` };
    await expect(webSocketService.verifyClient({ req })).resolves.toBe(true);
    expect(req.agent_id).toBe('node-1');
  });
});
