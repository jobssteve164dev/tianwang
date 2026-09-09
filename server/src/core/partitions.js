import logger from '../utils/logger.js';

export async function preparePartitions(db, anchor) {
  const [clock] = await db.query('SELECT date_trunc(\'month\', now() AT TIME ZONE \'UTC\') AS month');
  const date = new Date(anchor || clock[0].month);
  if (!Number.isFinite(date.getTime())) throw new Error('Invalid partition month');
  return db.transaction(async transaction => {
    await db.query('SELECT pg_advisory_xact_lock(hashtext(\'telemetry-partitions\'))', { transaction });
    const result = { created: [], deferred: [] };
    for (let offset = 0; offset <= 2; offset++) {
      const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + offset, 1)).toISOString();
      const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + offset + 1, 1)).toISOString();
      const name = `telemetry_samples_${start.slice(0, 7).replace('-', '')}`;
      const [existing] = await db.query('SELECT to_regclass(:name) AS name', { replacements: { name }, transaction });
      if (existing[0].name) continue;
      const [early] = await db.query('SELECT 1 FROM telemetry_samples_default WHERE sampled_at >= :start AND sampled_at < :end LIMIT 1', { replacements: { start, end }, transaction });
      // Existing default-partition samples remain queryable; never move or discard history implicitly.
      if (early.length) { result.deferred.push(name); continue; }
      await db.query(`CREATE TABLE ${name} PARTITION OF telemetry_samples FOR VALUES FROM ('${start}') TO ('${end}')`, { transaction });
      result.created.push(name);
    }
    return result;
  });
}

export function startPartitionMaintenance(db) {
  let active;
  const run = () => {
    if (active) return;
    active = preparePartitions(db).catch(error => logger.warn('Metric partition maintenance deferred', { reason: error.name })).finally(() => { active = null; });
  };
  run();
  const timer = setInterval(run, 6 * 60 * 60 * 1000);
  timer.unref();
  return async () => { clearInterval(timer); await active; };
}
