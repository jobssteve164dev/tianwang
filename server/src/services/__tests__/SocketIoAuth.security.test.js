const jwt = require('jsonwebtoken');
const config = require('../../config');
const { authenticateSocket } = require('../../index');

describe('Socket.IO authentication', () => {
  test('rejects unauthenticated and agent connections', async () => {
    const unauthenticatedNext = jest.fn();
    await authenticateSocket({ handshake: { auth: {} } }, unauthenticatedNext);
    expect(unauthenticatedNext.mock.calls[0][0]).toBeInstanceOf(Error);

    const agentToken = jwt.sign({ type: 'agent', agent_id: 'node-1' }, config.jwt.secret);
    const agentNext = jest.fn();
    await authenticateSocket({ handshake: { auth: { token: agentToken } } }, agentNext);
    expect(agentNext.mock.calls[0][0]).toBeInstanceOf(Error);
  });

  test('accepts an active human user and binds organization identity', async () => {
    const userId = 'd8ca4979-0e71-409f-8944-acba9b1a9b5c';
    const organizationId = '7766f65c-1cf5-40f1-bd24-8a527862b460';
    const modelRegistry = {
      User: {
        findByPk: jest.fn().mockResolvedValue({
          id: userId,
          organization_id: organizationId,
          role: 'admin',
          status: 'active',
          isLocked: () => false
        })
      }
    };
    const token = jwt.sign({ userId }, config.jwt.secret);
    const socket = { handshake: { auth: { token } } };
    const next = jest.fn();

    await authenticateSocket(socket, next, modelRegistry);

    expect(next).toHaveBeenCalledWith();
    expect(socket.user).toEqual({ id: userId, organization_id: organizationId, role: 'admin' });
  });
});
