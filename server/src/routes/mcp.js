const express = require('express');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const { createMcpServer } = require('../mcp/createMcpServer');
const mcpAuthService = require('../services/McpAuthService');
const logger = require('../utils/logger');

const router = express.Router();

router.use((req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ jsonrpc: '2.0', error: { code: -32001, message: 'MCP access token required' }, id: null });
  }
  try {
    req.mcpContext = mcpAuthService.verifyToken(header.substring(7));
    return next();
  } catch (error) {
    return res.status(401).json({ jsonrpc: '2.0', error: { code: -32001, message: 'Invalid or expired MCP access token' }, id: null });
  }
});

router.post('/', async (req, res) => {
  const server = createMcpServer(req.mcpContext);
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.once('close', () => {
    transport.close().catch(() => {});
    server.close().catch(() => {});
  });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    logger.error('MCP 请求处理失败', { code: error.code, message: error.message });
    if (!res.headersSent) {
      res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal MCP server error' }, id: null });
    }
  }
});

router.get('/', (req, res) => res.status(405).json({ jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed' }, id: null }));
router.delete('/', (req, res) => res.status(405).json({ jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed' }, id: null }));

module.exports = router;
