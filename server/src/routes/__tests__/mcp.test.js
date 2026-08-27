const crypto = require('crypto');
const request = require('supertest');
const { app } = require('../../index');
const mcpAuthService = require('../../services/McpAuthService');

describe('POST /mcp', () => {
  test('requires a bearer token before protocol handling', async () => {
    const response = await request(app)
      .post('/mcp')
      .send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} });
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe(-32001);
  });

  test('negotiates Streamable HTTP with an audience-bound MCP token', async () => {
    const token = mcpAuthService.mintToken({
      subject: 'protocol-test',
      organization_id: crypto.randomUUID(),
      scopes: ['nodes.read'],
      node_ids: ['node-1'],
      grant_id: crypto.randomUUID()
    });
    const response = await request(app)
      .post('/mcp')
      .set('Authorization', `Bearer ${token}`)
      .set('Accept', 'application/json, text/event-stream')
      .send({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-11-25',
          capabilities: {},
          clientInfo: { name: 'test-client', version: '1.0.0' }
        }
      });
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/event-stream');
    expect(response.text).toContain('tianwang-security');
  });
});
