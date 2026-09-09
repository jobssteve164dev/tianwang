const models = require('../models');

async function requireAgentAccess(req, res, next) {
  try {
    const agent = await models.Agent.findOne({ where: { agent_id: req.params.agent_id } });
    if (!agent) return res.status(404).json({ error: '设备不存在' });
    const allowed = req.user.isAgent
      ? req.agentId === agent.agent_id
      : (agent.organization_id || null) === (req.organizationId || null);
    if (!allowed) return res.status(403).json({ error: '无权访问此设备' });
    req.agent = agent;
    next();
  } catch (error) { next(error); }
}

function requireUser(req, res, next) {
  if (req.user.isAgent) return res.status(403).json({ error: '请使用用户账号登录' });
  next();
}

module.exports = { requireAgentAccess, requireUser };
