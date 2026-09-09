import models from '../models/index.js';
import securityEvents from '../services/SecurityEventService.js';
import { queueAnalysis } from './analysis.js';
import yaml from 'js-yaml';
import { compileRule } from './rules.js';
import { queueIntelligence } from './intelligence.js';

function severity(value) {
  if (['low', 'medium', 'high', 'critical'].includes(value)) return value;
  if (typeof value === 'number') return value >= 9 ? 'critical' : value >= 7 ? 'high' : value >= 4 ? 'medium' : 'low';
  return 'medium';
}

export async function detect({ receipt_id }, { db, transaction }) {
  const [rows] = await db.query('SELECT * FROM telemetry_receipts WHERE id = :id', { replacements: { id: receipt_id }, transaction });
  if (!rows.length) throw Object.assign(new Error('Telemetry receipt missing'), { code: 'RECEIPT_MISSING' });
  const receipt = rows[0];
  const agent = await models.Agent.findOne({ where: { agent_id: receipt.agent_id }, transaction });
  if (!agent) throw Object.assign(new Error('Agent missing'), { code: 'AGENT_MISSING' });
  const payload = receipt.payload;
  const findings = [];
  if (receipt.data_type === 'system') {
    const cpu = Number(payload.system?.cpu?.load);
    const memory = Number(payload.system?.memory?.usage);
    if (cpu > 90) findings.push({ type: 'system_alert', alert_type: 'high-cpu-usage', title: 'CPU使用率过高', description: `CPU使用率达到 ${cpu}%`, severity: 'medium' });
    if (memory > 90) findings.push({ type: 'system_alert', alert_type: 'high-memory-usage', title: '内存使用率过高', description: `内存使用率达到 ${memory}%`, severity: 'medium' });
  }
  const reports = receipt.data_type === 'network' ? payload.suspicious : receipt.data_type === 'security' ? payload.threats : [];
  if (Array.isArray(reports)) {
    for (const report of reports) {
      const type = report.type || 'suspicious-connection';
      const allowed = models.Alert.rawAttributes.type.validate.isIn[0];
      findings.push({
        type: receipt.data_type === 'network' ? 'network_threat' : String(type).slice(0, 50),
        alert_type: allowed.includes(type) ? type : 'suspicious-connection',
        title: String(report.title || '检测到可疑连接').slice(0, 255),
        source_ip: report.sourceIP || report.source_ip,
        target_ip: report.targetIP || report.target_ip,
        description: report.description || report.message || '检测到可疑活动', severity: severity(report.severity), details: report
      });
    }
  }
  const rules = await models.ThreatRule.findAll({ where: { enabled: true, rule_type: 'sigma', organization_id: receipt.organization_id }, transaction });
  const records = receipt.data_type === 'logs' && Array.isArray(payload.lines)
    ? payload.lines.map(message => ({ ...payload, product: agent.platform, message }))
    : [{ ...payload, product: agent.platform }];
  for (const row of rules) {
    let match;
    try { match = compileRule(yaml.load(row.content)); }
    catch {
      await row.update({ metadata: { ...row.metadata, validation_error: '规则条件无法执行，请检查后保存' } }, { transaction });
      continue;
    }
    if (records.some(match)) findings.push({ type: 'rule_match', alert_type: 'suspicious-process', title: row.name,
      description: yaml.load(row.content).description || '采集数据命中安全规则', severity: row.severity, details: { rule_id: row.id } });
  }
  for (const finding of findings) {
    const event = await securityEvents.record({
      ...finding, agent_id: agent.agent_id, device_id: agent.device_id,
      organization_id: receipt.organization_id, source: '设备监测',
      details: { ...(finding.details || {}), receipt_id }, tags: []
    }, { transaction });
    await queueAnalysis(event, { db, transaction });
    await queueIntelligence(event, { db, transaction });
  }
}
