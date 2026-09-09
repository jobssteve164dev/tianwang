const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { mkdtempSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');

if (process.env.DB_HOST !== '127.0.0.1' || !process.env.DB_NAME?.endsWith('_v2_test')) throw new Error('Requires isolated loopback V2 database');
const root = path.resolve(__dirname, '../../..');
const runtime = mkdtempSync(path.join(tmpdir(), 'tianwang-v2-'));
const port = Number(process.env.V2_TEST_PORT || 55417);
const base = `http://127.0.0.1:${port}`;
const code = `try { const path=require('path');
  const keys=require(${JSON.stringify(path.join(root, 'server/src/services/KeyManagementService.js'))});
  keys.keysPath=path.join(process.cwd(),'keys'); keys.publicKeyPath=path.join(keys.keysPath,'public.pem'); keys.privateKeyPath=path.join(keys.keysPath,'private.pem');
  require(${JSON.stringify(path.join(root, 'server/src/index.js'))}).initialize(); } catch(error) { console.error(error.message); process.exitCode=1; }`;
let output = '';
let db;
let testUser;
let agentSocketUrl;
const child = spawn(process.execPath, ['-e', code], {
  cwd: runtime,
  env: {
    PATH: process.env.PATH, NODE_ENV: 'production', APP_HOST: '127.0.0.1', APP_PORT: String(port), LOG_LEVEL: 'error',
    DB_HOST: '127.0.0.1', DB_PORT: process.env.DB_PORT, DB_NAME: process.env.DB_NAME, DB_USER: process.env.DB_USER, DB_PASSWORD: process.env.DB_PASSWORD,
    JWT_SECRET: 'v2-isolated-test-signing-secret', ENCRYPTION_KEY: 'v2-isolated-encryption-key',
    CLIENT_BUILD_PATH: process.env.CLIENT_BUILD_PATH || path.join(root, 'client/build'),
    AI_ENGINE_URL: 'http://127.0.0.1:1', REDIS_HOST: '127.0.0.1', REDIS_PORT: '1', REDIS_PASSWORD: 'fixture',
    INFLUXDB_URL: 'http://127.0.0.1:1', INFLUXDB_TOKEN: 'fixture', KAFKA_BROKERS: '127.0.0.1:1',
    SMTP_USER: '', SMTP_PASS: ''
  }, stdio: ['ignore', 'pipe', 'pipe']
});
child.stdout.on('data', data => { output = (output + data).slice(-8000); });
child.stderr.on('data', data => { output = (output + data).slice(-8000); });
after(async () => {
  if (child.exitCode === null && child.signalCode === null) {
    const exited = new Promise(resolve => child.once('exit', resolve));
    child.kill('SIGTERM');
    const timer = setTimeout(() => child.kill('SIGKILL'), 3000);
    await exited;
    clearTimeout(timer);
  }
  await db?.close();
});

test('the production app serves health, protected APIs and React with only PostgreSQL', async () => {
  let health;
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline && child.exitCode === null) {
    try { health = await fetch(`${base}/health`); if (health.ok) break; } catch { /* Await this isolated process only. */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(health?.ok, `Isolated application never became ready (exit=${child.exitCode}, signal=${child.signalCode}): ${output}`);
  assert.equal((await health.json()).service, 'tianwang');
  const ready = await fetch(`${base}/ready`);
  assert.equal(ready.status, 200);
  assert.equal((await ready.json()).database, 'ok');
  assert.equal((await fetch(`${base}/api/dashboard/security-metrics`)).status, 401);
  const page = await fetch(`${base}/login`);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /<div id="root"><\/div>/);
  assert.equal((await fetch(`${base}/api/does-not-exist`)).status, 404);
});

test('login, real dashboard counts, authenticated Socket.IO and logout share one session', async () => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'v2-isolated-test-signing-secret';
  db = require('../../src/config/database').initializePostgreSQL();
  const models = require('../../src/models');
  models.initializeModels();
  const user = await models.User.create({ username: `v2admin${process.pid}`, email: `v2admin${process.pid}@example.test`, full_name: 'Fixture', role: 'super_admin', password_hash: 'FixturePassword1!' });
  testUser = user;
  const loginResponse = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: user.username, password: 'FixturePassword1!' }) });
  assert.equal(loginResponse.status, 200);
  const session = await loginResponse.json();
  const headers = { Authorization: `Bearer ${session.accessToken}` };
  const { io } = require('socket.io-client');
  const socket = io(base, { auth: { token: session.accessToken }, reconnection: false, transports: ['websocket'] });
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Socket.IO authentication not acknowledged')), 5000);
      socket.once('authenticated', () => { clearTimeout(timer); resolve(); });
      socket.once('connect_error', error => { clearTimeout(timer); reject(error); });
    });
    const statsResponse = await fetch(`${base}/api/dashboard/alert-stats`, { headers });
    assert.equal(statsResponse.status, 200);
    const [ownCounts] = await db.query('SELECT count(*)::int AS total FROM alerts WHERE agent_id IN (SELECT agent_id FROM agents WHERE organization_id IS NULL)');
    assert.equal((await statsResponse.json()).data.totalAlerts, ownCounts[0].total);
    const logout = await fetch(`${base}/api/auth/logout`, { method: 'POST', headers });
    assert.equal(logout.status, 200);
    assert.equal((await fetch(`${base}/api/auth/me`, { headers })).status, 401);
    assert.equal(socket.connected, false);
  } finally { socket.disconnect(); }
});

test('Agent HTTP and WebSocket share committed receipts and expose real metric summaries', async () => {
  const login = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: testUser.username, password: 'FixturePassword1!' }) });
  const userSession = await login.json();
  const userHeaders = { Authorization: `Bearer ${userSession.accessToken}`, 'Content-Type': 'application/json' };
  try {
    const registration = await fetch(`${base}/api/admin/registration-codes`, { method: 'POST', headers: userHeaders, body: JSON.stringify({ maxUses: 2 }) });
    assert.equal(registration.status, 200);
    const registrationCode = (await registration.json()).data.codes[0].code;
    const agentId = `transport-${process.pid}`;
    const registered = await fetch(`${base}/api/agents/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ agent_id: agentId, hostname: agentId, platform: 'linux', registrationCode }) });
    assert.equal(registered.status, 201);
    const credentials = await registered.json();
    const headers = { Authorization: `Bearer ${credentials.token}`, 'Content-Type': 'application/json' };
    const payload = { messageId: 'transport-1', type: 'system', timestamp: Date.now(), data: { system: { cpu: { load: 96 }, memory: { usage: '42' } } } };
    const first = await fetch(`${base}/api/agents/${agentId}/data`, { method: 'POST', headers, body: JSON.stringify(payload) });
    assert.equal(first.status, 200);
    const firstReceipt = (await first.json()).receiptId;
    assert.ok(firstReceipt);
    const conflict = await fetch(`${base}/api/agents/${agentId}/data`, { method: 'POST', headers, body: JSON.stringify({ ...payload, data: { system: { cpu: { load: 10 } } } }) });
    assert.equal(conflict.status, 409);
    const WebSocket = require('ws');
    const key = credentials.connectionKey;
    const url = new URL('/ws', base.replace('http:', 'ws:'));
    url.searchParams.set('token', credentials.token);
    url.searchParams.set('connectionKey', `${key.key}:${key.timestamp}:${key.signature}`);
    agentSocketUrl = url.toString();
    const ws = new WebSocket(url);
    try {
      await new Promise((resolve, reject) => { ws.once('open', resolve); ws.once('error', () => reject(new Error('Agent handshake failed'))); });
      const acknowledged = new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Committed data was not acknowledged')), 3000);
        ws.on('message', bytes => {
          const message = JSON.parse(bytes);
          if (message.type === 'data_ack') { clearTimeout(timer); resolve(message); }
        });
      });
      ws.send(JSON.stringify({ ...payload, type: 'data', dataType: 'system' }));
      const ack = await acknowledged;
      assert.equal(ack.receiptId, firstReceipt);
      assert.equal(ack.duplicate, true);
    } finally { ws.terminate(); }
    const summary = await fetch(`${base}/api/data/agents/${agentId}/summary`, { headers: userHeaders });
    assert.equal(summary.status, 200);
    const metrics = (await summary.json()).data.system;
    assert.equal(metrics.avgCpuLoad, 96);
    assert.equal(metrics.maxCpuLoad, 96);
    assert.equal(metrics.avgMemoryUsage, 42);
    assert.equal((await fetch(`${base}/api/data/health`, { headers: userHeaders })).status, 200);
  } finally { await fetch(`${base}/api/auth/logout`, { method: 'POST', headers: userHeaders }); }
});

test('external AI and intelligence configuration persist without a Python runtime', async () => {
  const login = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: testUser.username, password: 'FixturePassword1!' }) });
  const session = await login.json();
  const headers = { Authorization: `Bearer ${session.accessToken}`, 'Content-Type': 'application/json' };
  try {
    const saved = await fetch(`${base}/api/system/ai-model/config`, { method: 'PUT', headers, body: JSON.stringify({ config: { openai: { enabled: false, api_key: 'fixture-ai-secret', default_model: 'fixture-model' } } }) });
    assert.equal(saved.status, 200);
    const read = await fetch(`${base}/api/system/ai-model/config`, { headers });
    const config = await read.json();
    assert.equal(config.config.openai.has_api_key, true);
    assert.equal(config.config.openai.api_key, '');
    assert.equal(JSON.stringify(config).includes('fixture-ai-secret'), false);
    assert.equal((await fetch(`${base}/health`)).status, 200);
  } finally { await fetch(`${base}/api/auth/logout`, { method: 'POST', headers }); }
});

test('AI usage comes from PostgreSQL and retired training endpoints are absent', async () => {
  const login = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: testUser.username, password: 'FixturePassword1!' }) });
  const session = await login.json();
  const headers = { Authorization: `Bearer ${session.accessToken}` };
  try {
    const usage = await fetch(`${base}/api/system/ai-model/usage-stats`, { headers });
    assert.equal(usage.status, 200);
    const [rows] = await db.query('SELECT count(*)::int AS total FROM provider_requests');
    assert.equal((await usage.json()).stats.total_requests, rows[0].total);
    assert.equal((await fetch(`${base}/api/system/ai-models/status`, { headers })).status, 404);
  } finally { await fetch(`${base}/api/auth/logout`, { method: 'POST', headers }); }
});

test('saved rules run in the app and produce alerts from actual telemetry', async () => {
  const login = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: testUser.username, password: 'FixturePassword1!' }) });
  const session = await login.json();
  const headers = { Authorization: `Bearer ${session.accessToken}`, 'Content-Type': 'application/json' };
  try {
    const title = `Rule fixture ${process.pid}`;
    const saved = await fetch(`${base}/api/security/rules/custom`, { method: 'POST', headers, body: JSON.stringify({ title, level: 'high', logsource: { product: 'linux' }, detection: { selection: { 'message|contains': `suspicious-${process.pid}` }, condition: 'selection' } }) });
    assert.equal(saved.status, 200);
    const rule = (await saved.json()).data;
    const tested = await fetch(`${base}/api/security/rules/custom/${rule.id}/test`, { method: 'POST', headers, body: JSON.stringify({ test_data: { product: 'linux', message: `suspicious-${process.pid}` } }) });
    assert.equal((await tested.json()).data.matched, true);
    const models = require('../../src/models');
    const agent = await models.Agent.findOne({ where: { agent_id: `transport-${process.pid}` } });
    await require('../../src/controllers/agentController').processAgentData(agent, 'logs', { lines: [`suspicious-${process.pid}`] }, Date.now(), `rule-${process.pid}`);
    let alert;
    for (let i = 0; i < 30; i++) { alert = await models.Alert.findOne({ where: { agent_id: agent.agent_id, title } }); if (alert) break; await new Promise(resolve => setTimeout(resolve, 100)); }
    assert.ok(alert, 'saved rule must execute against incoming Agent logs');
    assert.equal(alert.severity, 'high');
    const disabled = await fetch(`${base}/api/security/rules/custom/${rule.id}`, { method: 'PUT', headers, body: JSON.stringify({ enabled: false }) });
    assert.equal(disabled.status, 200);
  } finally { await fetch(`${base}/api/auth/logout`, { method: 'POST', headers }); }
});

test('single-use registration is atomic and another Agent cannot write for a device', async () => {
  const login = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: testUser.username, password: 'FixturePassword1!' }) });
  const session = await login.json();
  const userHeaders = { Authorization: `Bearer ${session.accessToken}`, 'Content-Type': 'application/json' };
  try {
    const issued = await fetch(`${base}/api/admin/registration-codes`, { method: 'POST', headers: userHeaders, body: JSON.stringify({ maxUses: 1 }) });
    const registrationCode = (await issued.json()).data.codes[0].code;
    const body = { hostname: `single-${process.pid}`, platform: 'linux', device_fingerprint: 'fixture-fingerprint', registrationCode };
    const registered = await fetch(`${base}/api/agents/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, agent_id: `single-${process.pid}` }) });
    assert.equal(registered.status, 201);
    const credentials = await registered.json();
    const models = require('../../src/models');
    const code = await models.RegistrationCode.findOne({ where: { code: registrationCode } });
    assert.equal(code.used_count, 1);
    const withoutCode = await fetch(`${base}/api/agents/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ agent_id: `no-code-${process.pid}`, hostname: 'none', platform: 'linux' }) });
    assert.equal(withoutCode.status, 400);
    const denied = await fetch(`${base}/api/agents/transport-${process.pid}/data`, { method: 'POST', headers: { Authorization: `Bearer ${credentials.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'logs', timestamp: Date.now(), data: { lines: ['forged'] } }) });
    assert.equal(denied.status, 403);
    const reauth = await fetch(`${base}/api/agents/auth`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ agent_id: `single-${process.pid}`, hostname: body.hostname, device_fingerprint: 'wrong' }) });
    assert.equal(reauth.status, 401);
    const valid = await fetch(`${base}/api/agents/auth`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ agent_id: `single-${process.pid}`, hostname: body.hostname, device_fingerprint: body.device_fingerprint }) });
    assert.equal(valid.status, 200);
    const concurrentCode = (await (await fetch(`${base}/api/admin/registration-codes`, { method: 'POST', headers: userHeaders, body: JSON.stringify({ maxUses: 1 }) })).json()).data.codes[0].code;
    const attempts = await Promise.all([0, 1].map(index => fetch(`${base}/api/agents/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, registrationCode: concurrentCode, agent_id: `concurrent-${process.pid}-${index}` }) })));
    assert.deepEqual(attempts.map(response => response.status).sort(), [201, 400]);
    const quota = await models.RegistrationCode.findOne({ where: { code: concurrentCode } });
    assert.equal(quota.used_count, 1);

  } finally { await fetch(`${base}/api/auth/logout`, { method: 'POST', headers: userHeaders }); }
});

test('dashboard, metric queries and alert filters preserve device ownership', async () => {
  const models = require('../../src/models');
  const organization = await models.Organization.create({ name: `Other fixture ${process.pid}`, slug: `other-${process.pid}` });
  const other = await models.Agent.create({ agent_id: `other-${process.pid}`, name: 'Other fixture', hostname: 'other', platform: 'linux', organization_id: organization.id });
  await require('../../src/services/SecurityEventService').record({ agent_id: other.agent_id, organization_id: organization.id, type: 'system_alert', severity: 'high', title: 'private fixture', description: 'test', alert_type: 'high-cpu-usage' });
  const login = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: testUser.username, password: 'FixturePassword1!' }) });
  const session = await login.json();
  const headers = { Authorization: `Bearer ${session.accessToken}` };
  try {
    const [count] = await db.query('SELECT count(*)::int AS total FROM alerts WHERE agent_id IN (SELECT agent_id FROM agents WHERE organization_id IS NULL)');
    const stats = await (await fetch(`${base}/api/dashboard/alert-stats`, { headers })).json();
    assert.equal(stats.data.totalAlerts, count[0].total);
    assert.equal((await fetch(`${base}/api/data/agents/${other.agent_id}/summary`, { headers })).status, 403);
    assert.equal((await fetch(`${base}/api/alerts?agent_id=${other.agent_id}`, { headers })).status, 403);
    assert.equal((await fetch(`${base}/api/agents/${other.agent_id}`, { headers })).status, 403);
    const devices = await (await fetch(`${base}/api/agents?limit=1000`, { headers })).json();
    assert.ok(devices.data.agents.every(agent => agent.organization_id === null));
    const threat = await fetch(`${base}/api/alerts/threat`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ agent_id: other.agent_id, deviceId: other.agent_id, title: 'cross organization', description: 'test', type: 'high-cpu-usage', severity: 'high', source: 'agent' }) });
    assert.equal(threat.status, 404, 'retired direct-alert ingestion has no active consumer');
    const foreignRule = await models.ThreatRule.create({ name: `Foreign rule ${process.pid}`, organization_id: organization.id,
      rule_type: 'sigma', severity: 'high', content: `title: Foreign rule\nlevel: high\ndetection:\n  selection:\n    message: foreign-${process.pid}\n  condition: selection\n` });
    const rules = await (await fetch(`${base}/api/security/rules/custom`, { headers })).json();
    assert.ok(!rules.data.some(rule => rule.id === foreignRule.id));
    assert.equal((await fetch(`${base}/api/security/rules/custom/${foreignRule.id}`, { method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: false }) })).status, 404);
  } finally { await fetch(`${base}/api/auth/logout`, { method: 'POST', headers }); }
});

test('closing a superseded Agent connection preserves the replacement and its acknowledgements', async () => {
  const WebSocket = require('ws');
  const opened = ws => new Promise((resolve, reject) => { ws.once('open', resolve); ws.once('error', reject); });
  const first = new WebSocket(agentSocketUrl);
  await opened(first);
  const superseded = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Superseded connection was not closed')), 2000);
    first.once('close', () => { clearTimeout(timer); resolve(); });
  });
  const replacement = new WebSocket(agentSocketUrl);
  await opened(replacement);
  try {
    await superseded;
    const ack = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Replacement connection lost its receipt')), 2000);
      replacement.on('message', bytes => {
        const message = JSON.parse(bytes);
        if (message.type === 'data_ack') { clearTimeout(timer); resolve(message); }
      });
    });
    replacement.send(JSON.stringify({ type: 'data', dataType: 'system', messageId: 'replacement', timestamp: Date.now(), data: { system: { cpu: { load: 10 } } } }));
    assert.ok((await ack).receiptId);
  } finally { first.terminate(); replacement.terminate(); }
});
