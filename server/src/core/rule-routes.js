import express from 'express';
import yaml from 'js-yaml';
import models from '../models/index.js';
import auth from '../middleware/auth.js';
import { compileRule } from './rules.js';

const router = express.Router();
router.use(auth.protect, auth.authorize(['admin', 'super_admin']));

function view(row) {
  return { ...yaml.load(row.content), id: row.id, enabled: row.enabled,
    created_at: row.createdAt, updated_at: row.updatedAt, error: row.metadata?.validation_error || null };
}

async function find(req, res) {
  const row = await models.ThreatRule.findOne({ where: { id: req.params.id, organization_id: req.organizationId } });
  if (!row) res.status(404).json({ success: false, message: '规则不存在' });
  return row;
}

router.get('/rules/custom', async (req, res) => {
  const rows = await models.ThreatRule.findAll({ where: { rule_type: 'sigma', organization_id: req.organizationId }, order: [['updatedAt', 'DESC']] });
  res.json({ success: true, data: rows.map(view) });
});

router.post('/rules/custom', async (req, res) => {
  compileRule(req.body);
  const row = await models.ThreatRule.create({ name: req.body.title, rule_type: 'sigma', content: yaml.dump(req.body),
    severity: req.body.level || 'medium', enabled: req.body.enabled !== false, tags: req.body.tags || [], organization_id: req.organizationId });
  res.json({ success: true, data: view(row), message: '规则已保存' });
});

router.get('/rules/custom/:id', async (req, res) => {
  const row = await find(req, res);
  if (row) res.json({ success: true, data: view(row) });
});

router.put('/rules/custom/:id', async (req, res) => {
  const row = await find(req, res);
  if (!row) return;
  const rule = { ...yaml.load(row.content), ...req.body };
  compileRule(rule);
  await row.update({ name: rule.title, content: yaml.dump(rule), severity: rule.level || 'medium',
    enabled: rule.enabled !== false, tags: rule.tags || [], metadata: { ...row.metadata, validation_error: null } });
  res.json({ success: true, data: view(row), message: '规则已保存' });
});

router.delete('/rules/custom/:id', async (req, res) => {
  const row = await find(req, res);
  if (!row) return;
  await row.destroy();
  res.json({ success: true, message: '规则已删除' });
});

router.post('/rules/custom/:id/test', async (req, res) => {
  const row = await find(req, res);
  if (!row) return;
  const matched = compileRule(yaml.load(row.content))(req.body.test_data || {});
  res.json({ success: true, data: { rule_id: row.id, matched }, message: matched ? '样本命中规则' : '样本未命中规则' });
});

router.get('/rules/statistics', async (req, res) => {
  const options = { replacements: { organization: req.organizationId || null } };
  const [rows] = await models.sequelize.query(`SELECT count(*)::int AS total_rules,
    count(*) FILTER(WHERE enabled)::int AS enabled_rules, max(updated_at) AS last_update FROM threat_rules
    WHERE organization_id IS NOT DISTINCT FROM CAST(:organization AS uuid)`, options);
  const [matches] = await models.sequelize.query(`SELECT count(*)::int AS matches_found FROM security_events
    WHERE raw_data ? 'rule_id' AND organization_id IS NOT DISTINCT FROM CAST(:organization AS uuid)`, options);
  res.json({ success: true, data: { ...rows[0], ...matches[0] } });
});

router.use((error, req, res, next) => {
  if (error.code === 'RULE_INVALID') return res.status(400).json({ success: false, message: error.message });
  return next(error);
});

export default router;
