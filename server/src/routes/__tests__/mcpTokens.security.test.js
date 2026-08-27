const { requireHumanAdministrator } = require('../mcpTokens');

describe('MCP token grant security', () => {
  test('rejects agent identities even when legacy auth maps them to admin', () => {
    const req = { user: { role: 'admin', isAgent: true }, agentId: 'node-1' };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    const next = jest.fn();

    requireHumanAdministrator(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'HUMAN_ADMIN_REQUIRED' }));
    expect(next).not.toHaveBeenCalled();
  });
});
