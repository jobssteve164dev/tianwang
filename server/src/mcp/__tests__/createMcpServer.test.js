const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { InMemoryTransport } = require('@modelcontextprotocol/sdk/inMemory.js');
const { createMcpServer } = require('../createMcpServer');

describe('TianWang MCP protocol surface', () => {
  let client;
  let server;

  afterEach(async () => {
    await client?.close();
    await server?.close();
  });

  test('negotiates MCP and exposes node, investigation, finding and response tools', async () => {
    const investigations = {
      listNodes: jest.fn().mockResolvedValue([{ agent_id: 'node-1', status: 'online' }]),
      getNode: jest.fn().mockResolvedValue({ agent_id: 'node-1', hostname: 'node', platform: 'linux', status: 'online', capabilities: [] }),
      getCapabilities: jest.fn().mockReturnValue({ node_id: 'node-1' })
    };
    const responses = {};
    server = createMcpServer({ subject: 'agent', scopes: [], node_ids: [], organization_id: 'org' }, { investigations, responses });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    client = new Client({ name: 'test-client', version: '1.0.0' });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const tools = await client.listTools();
    expect(tools.tools.map(tool => tool.name)).toEqual(expect.arrayContaining([
      'list_nodes',
      'capture_network',
      'submit_finding',
      'validate_response_plan',
      'execute_response_plan',
      'rollback_response_plan'
    ]));
    const response = await client.callTool({ name: 'list_nodes', arguments: {} });
    expect(response.structuredContent).toEqual({ nodes: [{ agent_id: 'node-1', status: 'online' }] });
  });
});
