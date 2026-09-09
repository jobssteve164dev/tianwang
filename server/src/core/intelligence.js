import { createHash, randomUUID } from 'node:crypto';
import { isIP } from 'node:net';
import models from '../models/index.js';
import configuration from '../services/ThreatIntelligenceConfigService.js';
import encryption from '../utils/encryption.js';
import cache from '../services/CacheService.js';

export async function queueIntelligence(event, { db, transaction }) {
  const config = await configuration.load();
  const ips = [...new Set([event.source_ip, event.target_ip, event.raw_data?.sourceIP, event.raw_data?.targetIP,
    event.raw_data?.source_ip, event.raw_data?.target_ip, event.raw_data?.remoteAddress].filter(value => typeof value === 'string' && isIP(value)))];
  for (const source of ['misp', 'otx']) {
    if (!config[source]?.enabled || !config[source]?.apiKey) continue;
    for (const ip of ips) await db.query(`INSERT INTO outbox_jobs(id,kind,dedupe_key,payload)
      VALUES (:id,'alert.enrich',:key,CAST(:payload AS jsonb)) ON CONFLICT(dedupe_key) DO NOTHING`, {
      replacements: { id: randomUUID(), key: `enrich:${event.id}:${source}:${ip}`, payload: JSON.stringify({ event_id: event.id, source, ip }) }, transaction
    });
  }
}

export async function requestIntelligence(source, config, ip, { signal, endpoint } = {}) {
  const misp = source === 'misp';
  if (!['misp', 'otx'].includes(source) || !isIP(ip)) throw Object.assign(new Error('Invalid intelligence request'), { code: 'INTELLIGENCE_CONFIG_INVALID' });
  const url = endpoint || (misp ? `${config.url.replace(/\/$/, '')}/attributes/restSearch`
    : `https://otx.alienvault.com/api/v1/indicators/IPv${isIP(ip)}/${encodeURIComponent(ip)}/general`);
  try {
    const response = await fetch(url, {
      method: misp ? 'POST' : 'GET', signal, redirect: 'error',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(misp ? { Authorization: config.apiKey } : { 'X-OTX-API-KEY': config.apiKey }) },
      ...(misp ? { body: JSON.stringify({ returnFormat: 'json', value: ip, to_ids: true }) } : {})
    });
    if (!response.ok) throw new Error('Request rejected');
    const data = await response.json();
    const matches = misp ? data.response?.Attribute?.length : data.pulse_info?.count;
    if (!Number.isSafeInteger(matches) || matches < 0) throw new Error('Invalid intelligence response');
    return { source, value: ip, matches };
  } catch { throw Object.assign(new Error('情报服务暂时不可用'), { code: 'INTELLIGENCE_UNAVAILABLE' }); }
}

export function createIntelligenceHandler({ request = requestIntelligence } = {}) {
  return async ({ event_id, source, ip }, { transaction, signal }) => {
    const config = (await configuration.load())[source];
    if (!config?.enabled) return;
    const cacheKey = `intelligence:${createHash('sha256').update(JSON.stringify({ source, config, ip })).digest('hex')}`;
    const result = await cache.get(cacheKey, () => request(source, { ...config, apiKey: encryption.decrypt(config.apiKey) }, ip, { signal }), 3600);
    const event = await models.SecurityEvent.findByPk(event_id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!event) throw Object.assign(new Error('Security event missing'), { code: 'EVENT_MISSING' });
    const intelligence = [...(event.raw_data.intelligence || []).filter(item => item.source !== source || item.value !== ip), result];
    await event.update({ raw_data: { ...event.raw_data, intelligence } }, { transaction });
    const alerts = await models.Alert.findAll({ where: { agent_id: event.agent_id }, transaction });
    for (const alert of alerts) if (alert.threatDetails?.security_event_id === event.id) {
      await alert.update({ threatDetails: { ...alert.threatDetails, intelligence } }, { transaction });
    }
  };
}
