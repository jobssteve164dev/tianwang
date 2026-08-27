const jwt = require('jsonwebtoken');
const config = require('../../config');
const mcpAuthService = require('../McpAuthService');

describe('McpAuthService', () => {
  test('mints a short-lived audience-bound token with node and scope grants', () => {
    const token = mcpAuthService.mintToken({
      subject: 'external-agent-1',
      organization_id: 'd8ca4979-0e71-409f-8944-acba9b1a9b5c',
      scopes: ['nodes.read', 'network.capture'],
      node_ids: ['node-1'],
      grant_id: 'grant-1'
    });
    const context = mcpAuthService.verifyToken(token);
    expect(context).toMatchObject({
      subject: 'external-agent-1',
      node_ids: ['node-1'],
      scopes: ['nodes.read', 'network.capture'],
      grant_id: 'grant-1'
    });
    expect(() => mcpAuthService.requireNode(context, 'node-2')).toThrow('授权范围');
    expect(() => mcpAuthService.requireScope(context, 'response.execute')).toThrow('能力授权');
  });

  test('rejects a token for another MCP resource audience', () => {
    const token = jwt.sign({
      type: 'mcp',
      scopes: ['nodes.read'],
      node_ids: ['node-1'],
      organization_id: 'd8ca4979-0e71-409f-8944-acba9b1a9b5c'
    }, config.jwt.secret, {
      subject: 'external-agent-1',
      issuer: config.mcp.issuer,
      audience: 'another-resource',
      expiresIn: 60
    });
    expect(() => mcpAuthService.verifyToken(token)).toThrow('audience');
  });
});
