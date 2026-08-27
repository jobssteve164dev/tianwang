const crypto = require('crypto');
const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const models = require('../models');
const mcpAuthService = require('../services/McpAuthService');
const config = require('../config');

const router = express.Router();

function requireHumanAdministrator(req, res, next) {
  if (req.user?.isAgent || req.agentId) {
    return res.status(403).json({
      success: false,
      code: 'HUMAN_ADMIN_REQUIRED',
      message: 'MCP 授权只能由用户管理员签发'
    });
  }
  return next();
}

router.post('/tokens', authenticate, requireHumanAdministrator, authorize(['admin', 'super_admin']), async (req, res) => {
  const { scopes, node_ids } = req.body;
  if (!Array.isArray(node_ids) || node_ids.length === 0) {
    return res.status(400).json({ success: false, code: 'NODE_SCOPE_REQUIRED', message: '必须选择至少一个授权节点' });
  }
  const count = await models.Agent.count({
    where: { agent_id: node_ids, organization_id: req.organizationId }
  });
  if (count !== new Set(node_ids).size) {
    return res.status(403).json({ success: false, code: 'NODE_SCOPE_DENIED', message: '授权列表包含不属于当前组织的节点' });
  }

  const grantId = crypto.randomUUID();
  const token = mcpAuthService.mintToken({
    subject: req.userId,
    organization_id: req.organizationId,
    scopes,
    node_ids: [...new Set(node_ids)],
    grant_id: grantId
  });
  res.status(201).json({
    success: true,
    access_token: token,
    token_type: 'Bearer',
    expires_in: config.mcp.tokenTtlSeconds,
    audience: config.mcp.audience,
    grant_id: grantId,
    scopes,
    node_ids: [...new Set(node_ids)]
  });
});

module.exports = router;
module.exports.requireHumanAdministrator = requireHumanAdministrator;
