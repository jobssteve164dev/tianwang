import database from '../config/database.js';

function time(value, fallback) {
  if (!value) return new Date(Date.now() - fallback);
  if (value === 'now()') return new Date();
  const relative = /^-(\d+)([smhdw])$/.exec(value);
  const result = relative
    ? new Date(Date.now() - Number(relative[1]) * { s: 1000, m: 60000, h: 3600000, d: 86400000, w: 604800000 }[relative[2]])
    : new Date(value);
  if (!Number.isFinite(result.getTime())) throw new Error('Invalid metric query time');
  return result;
}

export async function query(agentId, type, start, end, limit = 1000) {
  const db = database.getSequelize();
  const replacements = { agentId, type, start: time(start, 3600000), end: time(end, 0), limit: Math.min(10000, Math.max(1, Number.parseInt(limit, 10) || 1000)) };
  if (replacements.end < replacements.start) throw new Error('Invalid metric time range');
  const [rows] = await db.query(`SELECT sampled_at AS timestamp, agent_id, cpu_load,
    memory_usage AS memory_usage_percent, payload FROM telemetry_samples
    WHERE agent_id = :agentId AND data_type = :type AND sampled_at >= :start AND sampled_at <= :end
    ORDER BY sampled_at DESC LIMIT :limit`, { replacements });
  return rows;
}

export async function securityEvents(agentId, start, end, limit = 1000) {
  const [rows] = await database.getSequelize().query(`SELECT * FROM security_events
    WHERE agent_id = :agentId AND created_at >= :start AND created_at <= :end
    ORDER BY created_at DESC LIMIT :limit`, {
    replacements: { agentId, start: time(start, 86400000), end: time(end, 0), limit: Math.min(10000, Math.max(1, Number.parseInt(limit, 10) || 1000)) }
  });
  return rows;
}

export async function systemStats(agentId, range = '1h') {
  if (!/^\d+[smhdw]$/.test(range)) throw new Error('Invalid metric time range');
  const [rows] = await database.getSequelize().query(`SELECT avg(cpu_load) AS avg_cpu_load,
    max(cpu_load) AS max_cpu_load, avg(memory_usage) AS avg_memory_usage, max(memory_usage) AS max_memory_usage
    FROM telemetry_samples WHERE agent_id = :agentId AND data_type = 'system' AND sampled_at >= :start`, {
    replacements: { agentId, start: time(`-${range}`, 3600000) }
  });
  return rows[0];
}
