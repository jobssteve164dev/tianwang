import { createHash, randomUUID } from 'node:crypto';
import { isIP } from 'node:net';
import database from '../config/database.js';

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  }
  return value;
}

function invalid(message) {
  return Object.assign(new Error(message), { code: 'INVALID_TELEMETRY', statusCode: 400 });
}

function metric(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export async function ingest(agent, type, payload, timestamp, messageKey) {
  if (!['system', 'network', 'logs', 'security'].includes(type) || !payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw invalid('Unsupported telemetry type or payload');
  }
  const object = value => value && typeof value === 'object' && !Array.isArray(value);
  const reports = type === 'security' ? payload.threats : type === 'network' ? payload.suspicious : undefined;
  if (reports !== undefined && (!Array.isArray(reports) || reports.some(report => !object(report) ||
    ['type', 'title', 'description', 'message'].some(key => report[key] !== undefined && typeof report[key] !== 'string') ||
    ['sourceIP', 'source_ip', 'targetIP', 'target_ip'].some(key => report[key] != null && report[key] !== '' && (typeof report[key] !== 'string' || !isIP(report[key]))) ||
    (report.severity !== undefined && !['low', 'medium', 'high', 'critical'].includes(report.severity) && !Number.isFinite(report.severity))))) {
    throw invalid('Threat reports must be an array of valid reports');
  }
  if (payload.system !== undefined && (!object(payload.system) || ['cpu', 'memory'].some(key => payload.system[key] !== undefined && !object(payload.system[key])))) {
    throw invalid('System measurements must be objects');
  }
  if (type === 'logs' && payload.lines !== undefined && (!Array.isArray(payload.lines) || payload.lines.some(line => typeof line !== 'string'))) {
    throw invalid('Log lines must be strings');
  }
  const sampledAt = new Date(timestamp ?? payload.timestamp);
  if (!Number.isFinite(sampledAt.getTime())) throw invalid('A valid sample timestamp is required');
  const normalized = JSON.stringify(canonical({ type, payload, timestamp: sampledAt.toISOString() }));
  const hash = createHash('sha256').update(normalized).digest('hex');
  const key = messageKey ?? hash;
  if (typeof key !== 'string' || !key.length || key.length > 255) throw invalid('Invalid message identifier');
  const db = database.getSequelize();
  return db.transaction(async transaction => {
    const replacements = {
      id: randomUUID(), agent: agent.agent_id, organization: agent.organization_id || null,
      key, hash, type, sampledAt, payload: JSON.stringify(payload),
      cpu: metric(payload.system?.cpu?.load), memory: metric(payload.system?.memory?.usage)
    };
    const [inserted] = await db.query(`INSERT INTO telemetry_receipts
      (id, agent_id, organization_id, message_key, payload_hash, data_type, sampled_at, payload)
      VALUES (:id, :agent, :organization, :key, :hash, :type, :sampledAt, CAST(:payload AS jsonb))
      ON CONFLICT (agent_id, message_key) DO NOTHING RETURNING id`, { replacements, transaction });
    if (!inserted.length) {
      const [existing] = await db.query('SELECT id, payload_hash FROM telemetry_receipts WHERE agent_id = :agent AND message_key = :key', { replacements, transaction });
      if (existing[0].payload_hash !== hash) {
        throw Object.assign(new Error('Message identifier was already used for different data'), { code: 'IDEMPOTENCY_CONFLICT', statusCode: 409 });
      }
      return { receiptId: existing[0].id, duplicate: true };
    }
    await db.query(`INSERT INTO telemetry_samples
      (receipt_id, sampled_at, agent_id, organization_id, data_type, cpu_load, memory_usage, payload)
      VALUES (:id, :sampledAt, :agent, :organization, :type, :cpu, :memory, CAST(:payload AS jsonb))`, { replacements, transaction });
    await db.query(`INSERT INTO outbox_jobs (id, kind, dedupe_key, payload)
      VALUES (:jobId, 'telemetry.detect', :dedupeKey, CAST(:jobPayload AS jsonb))`, {
      replacements: { jobId: randomUUID(), dedupeKey: `detect:${replacements.id}`, jobPayload: JSON.stringify({ receipt_id: replacements.id }) }, transaction
    });
    await agent.update({ last_seen: new Date() }, { transaction });
    return { receiptId: replacements.id, duplicate: false };
  });
}
