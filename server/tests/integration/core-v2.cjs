const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

if (process.env.DB_HOST !== '127.0.0.1' || !process.env.DB_NAME?.endsWith('_v2_test')) {
  throw new Error('V2 verification requires an explicit loopback *_v2_test database');
}
process.env.NODE_ENV = 'test';
const { initializePostgreSQL } = require('../../src/config/database');
const models = require('../../src/models');
let db;
let agent;
before(async () => {
  execFileSync(process.execPath, [path.join(__dirname, '../../src/database/migrate.js')], { env: process.env, stdio: 'pipe' });
  db = initializePostgreSQL();
  models.initializeModels();
  await models.SystemConfig.upsert({ key: 'ai_model_config', category: 'ai_model', value: {} });
});
after(async () => { await db?.close(); });

test('formal migration installs durable ingestion, partitioned metrics and recoverable jobs', async () => {
  const [tables] = await db.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public'");
  for (const name of ['telemetry_receipts', 'telemetry_samples', 'outbox_jobs', 'application_cache']) {
    assert.ok(tables.some(row => row.tablename === name), `formal migration must create ${name}`);
  }
  const [partitions] = await db.query("SELECT partstrat FROM pg_partitioned_table WHERE partrelid = 'telemetry_samples'::regclass");
  assert.equal(partitions[0].partstrat, 'r');
});

test('cache values survive a new process and expire according to PostgreSQL time', async () => {
  const cache = require('../../src/services/CacheService');
  await cache.connect();
  const key = `fixture-cache-${process.pid}`;
  await cache.set(key, { result: 7 }, 60);
  const script = `const db=require('./server/src/config/database');db.initializePostgreSQL();const cache=require('./server/src/services/CacheService');(async()=>{const value=await cache.get(${JSON.stringify(key)});if(value?.result!==7)process.exitCode=1;await db.getSequelize().close()})().catch(()=>process.exit(1));`;
  execFileSync(process.execPath, ['-e', script], { cwd: path.resolve(__dirname, '../../..'), env: process.env, stdio: 'pipe' });
  await db.query("UPDATE application_cache SET expires_at=now()-interval '1 second' WHERE key=:key", { replacements: { key } });
  assert.equal(await cache.get(key), null);
  await cache.disconnect();
  assert.equal((await db.query('SELECT 1 AS alive'))[0][0].alive, 1, 'cache shutdown must not close the shared application pool');
});

test('optional intelligence failures retry independently and successful IP evidence is cached durably', async () => {
  const { queueIntelligence, createIntelligenceHandler } = await import('../../src/core/intelligence.js');
  const { Worker } = await import('../../src/core/worker.js');
  const encryption = require('../../src/utils/encryption');
  await models.SystemConfig.upsert({ key: 'threat_intelligence_config', category: 'threat_intelligence', value: { otx: { enabled: true, apiKey: encryption.encrypt(`fixture-${process.pid}`) } } });
  const events = require('../../src/services/SecurityEventService');
  const event = await events.record({ agent_id: `intel-${process.pid}`, type: 'network_threat', severity: 'high', title: 'IP fixture', description: 'test', details: { sourceIP: '198.51.100.23' } });
  await db.transaction(transaction => queueIntelligence(event, { db, transaction }));
  const kind = `intel-${event.id}`;
  await db.query("UPDATE outbox_jobs SET kind=:kind WHERE kind='alert.enrich' AND payload->>'event_id'=:id", { replacements: { kind, id: event.id } });
  const failed = new Worker(db, { [kind]: createIntelligenceHandler({ request: async () => { throw Object.assign(new Error('offline'), { code: 'INTELLIGENCE_UNAVAILABLE' }); } }) }, { retrySeconds: 0 });
  await failed.runOnce();
  assert.equal(await models.Alert.count({ where: { agent_id: event.agent_id } }), 1);
  const [pending] = await db.query('SELECT status FROM outbox_jobs WHERE kind=:kind', { replacements: { kind } });
  assert.equal(pending[0].status, 'pending');
  let calls = 0;
  const successful = new Worker(db, { [kind]: createIntelligenceHandler({ request: async (source, config, ip) => { calls++; return { source, value: ip, matches: 2 }; } }) });
  await successful.runOnce();
  await event.reload();
  assert.equal(event.raw_data.intelligence[0].matches, 2);
  const handler = createIntelligenceHandler({ request: async () => { throw new Error('cache miss'); } });
  await db.transaction(transaction => handler({ event_id: event.id, source: 'otx', ip: '198.51.100.23' }, { transaction }));
  assert.equal(calls, 1);
  await models.SystemConfig.upsert({ key: 'threat_intelligence_config', category: 'threat_intelligence', value: {} });
});

test('Agent retries commit exactly one sample and detection job, and reject changed content', async () => {
  agent = await models.Agent.create({ agent_id: `v2-${process.pid}`, name: 'V2 test', hostname: 'test-host', platform: 'linux' });
  const controller = require('../../src/controllers/agentController');
  const timestamp = Date.now();
  const payload = { system: { cpu: { load: 95 }, memory: { usage: '40' } } };
  await Promise.all(Array.from({ length: 3 }, () => controller.processAgentData(agent, 'system', payload, timestamp, 'sample-1')));
  const [receipts] = await db.query('SELECT * FROM telemetry_receipts WHERE agent_id = :agent', { replacements: { agent: agent.agent_id } });
  assert.equal(receipts.length, 1, 'acknowledged data must survive in PostgreSQL exactly once');
  const [samples] = await db.query('SELECT * FROM telemetry_samples WHERE agent_id = :agent', { replacements: { agent: agent.agent_id } });
  assert.equal(samples.length, 1);
  assert.equal(samples[0].cpu_load, 95);
  const [jobs] = await db.query("SELECT * FROM outbox_jobs WHERE payload->>'receipt_id' = :id", { replacements: { id: receipts[0].id } });
  assert.equal(jobs.filter(job => job.kind === 'telemetry.detect').length, 1);
  await assert.rejects(() => controller.processAgentData(agent, 'system', { system: { cpu: { load: 12 } } }, timestamp, 'sample-1'), { code: 'IDEMPOTENCY_CONFLICT' });
});

test('invalid telemetry fails without committing a receipt or a job', async () => {
  const controller = require('../../src/controllers/agentController');
  await assert.rejects(() => controller.processAgentData(agent, 'other', {}, Date.now(), 'invalid'), { code: 'INVALID_TELEMETRY' });
  const [rows] = await db.query('SELECT count(*)::int AS count FROM telemetry_receipts WHERE message_key = :key', { replacements: { key: 'invalid' } });
  assert.equal(rows[0].count, 0);
  await assert.rejects(() => controller.processAgentData(agent, 'security', { threats: [null, { type: 'malware-activity', severity: 'high' }] }, Date.now(), 'invalid-nested'), { code: 'INVALID_TELEMETRY' });
  await assert.rejects(() => controller.processAgentData(agent, 'security', { threats: [{ type: 'malware-activity', sourceIP: 'unknown' }] }, Date.now(), 'invalid-nested'), { code: 'INVALID_TELEMETRY' });
  const [nested] = await db.query('SELECT count(*)::int AS count FROM telemetry_receipts WHERE message_key = :key AND agent_id = :agent', { replacements: { key: 'invalid-nested', agent: agent.agent_id } });
  assert.equal(nested[0].count, 0);
});

test('alert failure rolls back its security event', async () => {
  const events = require('../../src/services/SecurityEventService');
  const beforeCount = await models.SecurityEvent.count({ where: { agent_id: agent.agent_id } });
  await assert.rejects(() => events.record({ agent_id: agent.agent_id, type: 'system_alert', severity: 'medium', title: 'atomic test', description: 'test', alert_type: 'not-a-valid-alert' }));
  assert.equal(await models.SecurityEvent.count({ where: { agent_id: agent.agent_id } }), beforeCount);
});

test('worker creates one basic alert and completes the durable job', async () => {
  const { Worker } = await import('../../src/core/worker.js');
  const { detect } = await import('../../src/core/detection.js');
  const worker = new Worker(db, { 'telemetry.detect': detect });
  while (await worker.runOnce()) { /* Drain only the isolated fixture database. */ }
  const alerts = await models.Alert.findAll({ where: { agent_id: agent.agent_id } });
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].type, 'high-cpu-usage');
  assert.equal(await models.SecurityEvent.count({ where: { agent_id: agent.agent_id } }), 1);
  const [jobs] = await db.query("SELECT status FROM outbox_jobs WHERE payload->>'receipt_id' IN (SELECT id::text FROM telemetry_receipts WHERE agent_id = :agent)", { replacements: { agent: agent.agent_id } });
  assert.deepEqual(jobs.map(job => job.status), ['completed']);
  assert.equal(await worker.runOnce(), false);
});

test('job failures roll back effects, retry, and exhaust into a visible failure', async () => {
  const { Worker } = await import('../../src/core/worker.js');
  const { randomUUID } = require('node:crypto');
  const id = randomUUID(), kind = `fixture-${id}`;
  await db.query('INSERT INTO outbox_jobs (id,kind,dedupe_key,payload) VALUES (:id,:kind,:id,\'{}\')', { replacements: { id, kind } });
  const worker = new Worker(db, { [kind]: async (_, { transaction }) => {
    await db.query("INSERT INTO application_cache(key,value,expires_at) VALUES (:id,'{}',now())", { replacements: { id }, transaction });
    throw Object.assign(new Error('fixture'), { code: 'FIXTURE_FAILED' });
  } }, { maxAttempts: 2, retrySeconds: 0 });
  const claims = await Promise.all([worker.claim(), worker.claim()]);
  assert.equal(claims.filter(Boolean).length, 1, 'concurrent claims cannot share a job');
  await worker.execute(claims.find(Boolean));
  let [rows] = await db.query('SELECT * FROM outbox_jobs WHERE id=:id', { replacements: { id } });
  assert.equal(rows[0].status, 'pending');
  assert.equal(rows[0].last_error, 'FIXTURE_FAILED');
  const [effects] = await db.query('SELECT * FROM application_cache WHERE key=:id', { replacements: { id } });
  assert.equal(effects.length, 0);
  await worker.runOnce();
  [rows] = await db.query('SELECT * FROM outbox_jobs WHERE id=:id', { replacements: { id } });
  assert.equal(rows[0].status, 'failed');
  assert.equal(rows[0].attempts, 2);
  assert.ok(rows[0].finished_at);
});

test('a new process recovers an expired lease and stale execution cannot write', async () => {
  const { Worker } = await import('../../src/core/worker.js');
  const { randomUUID } = require('node:crypto');
  const id = randomUUID(), kind = `restart-${id}`;
  await db.query('INSERT INTO outbox_jobs (id,kind,dedupe_key,payload) VALUES (:id,:kind,:id,\'{}\')', { replacements: { id, kind } });
  const code = `const {initializePostgreSQL}=require('./server/src/config/database');
    (async()=>{const db=initializePostgreSQL(); const {Worker}=await import('./server/src/core/worker.js');
    const worker=new Worker(db,{[process.env.V2_TEST_KIND]:async()=>{}});
    if(process.env.V2_TEST_EXECUTE==='1') await worker.runOnce(); else await worker.claim(); await db.close();})();`;
  execFileSync(process.execPath, ['-e', code], { env: { ...process.env, V2_TEST_KIND: kind }, stdio: 'pipe' });
  const [rows] = await db.query('SELECT * FROM outbox_jobs WHERE id=:id', { replacements: { id } });
  assert.equal(rows[0].status, 'running');
  await db.query("UPDATE outbox_jobs SET lease_until=now()-interval '1 second' WHERE id=:id", { replacements: { id } });
  execFileSync(process.execPath, ['-e', code], { env: { ...process.env, V2_TEST_KIND: kind, V2_TEST_EXECUTE: '1' }, stdio: 'pipe' });
  const [recovered] = await db.query('SELECT * FROM outbox_jobs WHERE id=:id', { replacements: { id } });
  assert.equal(recovered[0].status, 'completed');
  assert.equal(recovered[0].attempts, 2);
  let invoked = false;
  assert.equal(await new Worker(db, { [kind]: async () => { invoked = true; } }).execute(rows[0]), false);
  assert.equal(invoked, false);
});

test('the existing metric query reads the committed PostgreSQL sample', async () => {
  const storage = require('../../src/services/DataStorageService');
  const samples = await storage.querySystemData(agent.agent_id, '-1h', 'now()', 10);
  assert.equal(samples.length, 1);
  assert.equal(samples[0].cpu_load, 95);
  assert.equal(samples[0].memory_usage_percent, 40);
  assert.deepEqual(await storage.querySystemData('absent-agent', '-1h', 'now()', 10), []);
});

test('optional AI failures preserve basic alerts and restartable analysis jobs', async () => {
  const { createAnalyzeHandler, queueAnalysis } = await import('../../src/core/analysis.js');
  const { Worker } = await import('../../src/core/worker.js');
  const encryption = require('../../src/utils/encryption');
  await models.SystemConfig.upsert({ key: 'ai_model_config', category: 'ai_model', value: { openai: { enabled: true, api_key: encryption.encrypt('fixture'), default_model: 'fixture-model' } } });
  const event = await models.SecurityEvent.findOne({ where: { agent_id: agent.agent_id } });
  await db.transaction(transaction => queueAnalysis(event, { db, transaction }));
  const kind = `analysis-${event.id}`;
  await db.query("UPDATE outbox_jobs SET kind=:kind WHERE payload->>'event_id'=:id", { replacements: { kind, id: event.id } });
  const handler = createAnalyzeHandler({ request: async () => { throw Object.assign(new Error('fixture outage'), { code: 'PROVIDER_UNAVAILABLE' }); } });
  const worker = new Worker(db, { [kind]: handler }, { retrySeconds: 0 });
  const claimed = await worker.claim();
  assert.ok(claimed);
  await worker.execute(claimed);
  assert.equal(await models.Alert.count({ where: { agent_id: agent.agent_id } }), 1);
  const [jobs] = await db.query('SELECT status,last_error FROM outbox_jobs WHERE id=:id', { replacements: { id: claimed.id } });
  assert.equal(jobs[0].status, 'pending');
  assert.equal(jobs[0].last_error, 'PROVIDER_UNAVAILABLE');
  const success = new Worker(db, { [kind]: createAnalyzeHandler({ request: async () => ({ text: '检查高负载进程', provider: 'openai', model: 'fixture-model', inputTokens: 2, outputTokens: 3 }) }) });
  await success.runOnce();
  await event.reload();
  assert.equal(event.raw_data.ai.text, '检查高负载进程');
  const alert = await models.Alert.findOne({ where: { agent_id: agent.agent_id } });
  assert.equal(alert.threatDetails.ai.text, '检查高负载进程');
  const [usage] = await db.query('SELECT status FROM provider_requests WHERE event_id=:id ORDER BY created_at', { replacements: { id: event.id } });
  assert.deepEqual(usage.map(row => row.status), ['failed', 'completed']);
  await models.SystemConfig.upsert({ key: 'ai_model_config', category: 'ai_model', value: { openai: { enabled: false } } });
});

test('worker shutdown cancels its active provider request and preserves retry state', async () => {
  const { createAnalyzeHandler, queueAnalysis } = await import('../../src/core/analysis.js');
  const { Worker } = await import('../../src/core/worker.js');
  const encryption = require('../../src/utils/encryption');
  await models.SystemConfig.upsert({ key: 'ai_model_config', category: 'ai_model', value: { openai: { enabled: true, api_key: encryption.encrypt('fixture'), default_model: 'fixture-model' } } });
  const event = await require('../../src/services/SecurityEventService').record({ agent_id: agent.agent_id, type: 'system_alert', severity: 'medium', title: 'shutdown fixture', description: 'test', alert_type: 'high-cpu-usage' });
  await db.transaction(transaction => queueAnalysis(event, { db, transaction }));
  const kind = `analysis-${event.id}`;
  await db.query("UPDATE outbox_jobs SET kind=:kind WHERE payload->>'event_id'=:id", { replacements: { kind, id: event.id } });
  let started;
  const ready = new Promise(resolve => { started = resolve; });
  const worker = new Worker(db, { [kind]: createAnalyzeHandler({ request: async (_provider, _config, _prompt, { signal }) => {
    started();
    await new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(Object.assign(new Error('stopped'), { code: 'PROVIDER_UNAVAILABLE' })), { once: true }));
  } }) });
  worker.start();
  await ready;
  await worker.stop();
  const [jobs] = await db.query("SELECT status FROM outbox_jobs WHERE payload->>'event_id'=:id", { replacements: { id: event.id } });
  assert.equal(jobs[0].status, 'pending');
  await models.SystemConfig.upsert({ key: 'ai_model_config', category: 'ai_model', value: { openai: { enabled: false } } });
});

test('process loss during AI records an unknown prior attempt when its job recovers', async () => {
  const { randomUUID } = require('node:crypto');
  const id = randomUUID(), kind = `ai-crash-${id}`;
  const event = await require('../../src/services/SecurityEventService').record({ agent_id: agent.agent_id, type: 'system_alert', severity: 'medium', title: 'crash fixture', description: 'test', alert_type: 'high-cpu-usage' });
  const encryption = require('../../src/utils/encryption');
  await models.SystemConfig.upsert({ key: 'ai_model_config', category: 'ai_model', value: { openai: { enabled: true, api_key: encryption.encrypt('fixture'), default_model: 'fixture-model' } } });
  await db.query('INSERT INTO outbox_jobs(id,kind,dedupe_key,payload) VALUES (:id,:kind,:id,CAST(:payload AS jsonb))', { replacements: { id, kind, payload: JSON.stringify({ event_id: event.id, provider: 'openai' }) } });
  const code = `(async()=>{const db=require('./server/src/config/database').initializePostgreSQL();require('./server/src/models').initializeModels();
    const {Worker}=await import('./server/src/core/worker.js');const {createAnalyzeHandler}=await import('./server/src/core/analysis.js');
    const handler=createAnalyzeHandler({request:async()=>{if(process.env.V2_CRASH==='1')process.exit(23);return {text:'恢复建议',inputTokens:1,outputTokens:1};}});
    await new Worker(db,{[process.env.V2_TEST_KIND]:handler}).runOnce();await db.close();})();`;
  assert.throws(() => execFileSync(process.execPath, ['-e', code], { env: { ...process.env, V2_TEST_KIND: kind, V2_CRASH: '1' }, stdio: 'pipe' }), error => error.status === 23);
  await db.query("UPDATE outbox_jobs SET lease_until=now()-interval '1 second' WHERE id=:id", { replacements: { id } });
  execFileSync(process.execPath, ['-e', code], { env: { ...process.env, V2_TEST_KIND: kind }, stdio: 'pipe' });
  const [requests] = await db.query('SELECT status FROM provider_requests WHERE event_id=:id ORDER BY created_at', { replacements: { id: event.id } });
  assert.deepEqual(requests.map(row => row.status), ['unknown', 'completed']);
  await models.SystemConfig.upsert({ key: 'ai_model_config', category: 'ai_model', value: { openai: { enabled: false } } });
});

test('AI completion preserves intelligence committed while the provider was running', async () => {
  const { createAnalyzeHandler } = await import('../../src/core/analysis.js');
  const encryption = require('../../src/utils/encryption');
  await models.SystemConfig.upsert({ key: 'ai_model_config', category: 'ai_model', value: { openai: { enabled: true, api_key: encryption.encrypt('fixture'), default_model: 'fixture' } } });
  const event = await require('../../src/services/SecurityEventService').record({ agent_id: `merge-${process.pid}`, type: 'network_threat', severity: 'high', title: '异常连接', description: 'test' });
  const evidence = [{ source: 'otx', value: '198.51.100.9', matches: 1 }];
  const handler = createAnalyzeHandler({ request: async () => {
    await event.update({ raw_data: { intelligence: evidence } });
    return { text: '核对连接来源', inputTokens: 1, outputTokens: 1 };
  } });
  await db.transaction(transaction => handler({ event_id: event.id, provider: 'openai' }, { transaction }));
  await event.reload();
  assert.deepEqual(event.raw_data.intelligence, evidence);
  assert.equal(event.raw_data.ai.text, '核对连接来源');
  await models.SystemConfig.upsert({ key: 'ai_model_config', category: 'ai_model', value: {} });
});

test('retry reconciles an interrupted provider attempt even when that provider was disabled', async () => {
  const { randomUUID } = require('node:crypto');
  const { createAnalyzeHandler } = await import('../../src/core/analysis.js');
  const jobId = randomUUID();
  await models.SystemConfig.upsert({ key: 'ai_model_config', category: 'ai_model', value: {} });
  await db.query("INSERT INTO provider_requests(id,provider,model,status,job_id,attempt) VALUES (:id,'openai','fixture','running',:job,1)", { replacements: { id: randomUUID(), job: jobId } });
  await db.transaction(transaction => createAnalyzeHandler()({ provider: 'openai' }, { transaction, job: { id: jobId, attempts: 2 } }));
  const [rows] = await db.query('SELECT status,error_code FROM provider_requests WHERE job_id=:job', { replacements: { job: jobId } });
  assert.deepEqual(rows[0], { status: 'unknown', error_code: 'PROCESS_INTERRUPTED' });
});

test('network reports expose source and target IPs in the alert shown to the user', async () => {
  const { detect } = await import('../../src/core/detection.js');
  const { Worker } = await import('../../src/core/worker.js');
  const controller = require('../../src/controllers/agentController');
  const receipt = await controller.processAgentData(agent, 'network', { suspicious: [{ type: 'suspicious-connection', sourceIP: '198.51.100.1', targetIP: '198.51.100.2', severity: 'high' }] }, Date.now(), 'network-ip');
  const kind = `network-${process.pid}`;
  await db.query("UPDATE outbox_jobs SET kind=:kind WHERE payload->>'receipt_id'=:receipt", { replacements: { kind, receipt: receipt.receiptId } });
  await new Worker(db, { [kind]: detect }).runOnce();
  const alert = await models.Alert.findOne({ where: { agent_id: agent.agent_id, sourceIP: '198.51.100.1' } });
  assert.ok(alert);
  assert.equal(alert.targetIP, '198.51.100.2');
  assert.equal(alert.title, '检测到可疑连接');
  assert.equal(alert.source, '设备监测');
});

test('partition maintenance prepares future months without removing late or early samples', async () => {
  const { preparePartitions } = await import('../../src/core/partitions.js');
  await require('../../src/controllers/agentController').processAgentData(agent,'system',{system:{cpu:{load:7}}},'2041-02-01T00:00:00Z', 'early-partition');
  const result = await preparePartitions(db, '2041-01-01');
  assert.ok(result.deferred.includes('telemetry_samples_204102'));
  const [rows] = await db.query("SELECT tableoid::regclass::text AS partition FROM telemetry_samples WHERE agent_id=:agent AND sampled_at='2041-02-01T00:00:00Z'",{replacements:{agent:agent.agent_id}});
  assert.equal(rows.length,1);
  assert.equal(rows[0].partition,'telemetry_samples_default');
  const [created] = await db.query("SELECT to_regclass('telemetry_samples_204103') AS name");
  assert.equal(created[0].name,'telemetry_samples_204103');
});
