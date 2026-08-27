const jwt = require('jsonwebtoken');
const config = require('../config');

const ALLOWED_SCOPES = new Set([
  'nodes.read',
  'network.capture',
  'host.snapshot',
  'findings.write',
  'response.validate',
  'response.submit',
  'response.execute',
  'response.rollback',
  'evidence.read'
]);

class McpAuthService {
  mintToken({ subject, organization_id, scopes, node_ids, grant_id }) {
    if (!organization_id || !Array.isArray(node_ids) || node_ids.length === 0) {
      throw Object.assign(new Error('MCP 授权必须绑定组织和至少一个节点'), { code: 'INVALID_GRANT' });
    }
    if (!Array.isArray(scopes) || scopes.length === 0 || scopes.some(scope => !ALLOWED_SCOPES.has(scope))) {
      throw Object.assign(new Error('MCP 授权包含无效能力范围'), { code: 'INVALID_SCOPE' });
    }
    return jwt.sign({
      type: 'mcp',
      scopes,
      node_ids,
      organization_id,
      grant_id
    }, config.jwt.secret, {
      subject: String(subject),
      issuer: config.mcp.issuer,
      audience: config.mcp.audience,
      expiresIn: config.mcp.tokenTtlSeconds,
      jwtid: grant_id
    });
  }

  verifyToken(token) {
    const decoded = jwt.verify(token, config.jwt.secret, {
      issuer: config.mcp.issuer,
      audience: config.mcp.audience
    });
    if (decoded.type !== 'mcp' || !decoded.sub || !decoded.organization_id || !Array.isArray(decoded.node_ids)) {
      throw Object.assign(new Error('MCP 令牌声明不完整'), { code: 'INVALID_MCP_TOKEN' });
    }
    return {
      subject: decoded.sub,
      organization_id: decoded.organization_id,
      scopes: decoded.scopes || [],
      node_ids: decoded.node_ids,
      grant_id: decoded.grant_id || decoded.jti,
      expires_at: new Date(decoded.exp * 1000).toISOString()
    };
  }

  requireScope(context, scope) {
    if (!context.scopes.includes(scope)) {
      throw Object.assign(new Error(`缺少 MCP 能力授权: ${scope}`), { code: 'MCP_SCOPE_DENIED' });
    }
  }

  requireNode(context, nodeId) {
    if (!context.node_ids.includes(nodeId)) {
      throw Object.assign(new Error('目标节点不在当前授权范围内'), { code: 'MCP_NODE_DENIED' });
    }
  }
}

module.exports = new McpAuthService();
