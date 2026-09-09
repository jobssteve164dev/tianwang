const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const http = require('node:http');
const base = 'http://127.0.0.1:18080';
const json = async (path, options) => {
  const response = await fetch(base + path, options);
  assert.equal(response.status, 200, path);
  return response.json();
};
test('packaged gateway serves the dashboard and real authenticated data', async () => {
  assert.equal((await json('/health')).service, 'tianwang');
  const page = await (await fetch(base + '/login')).text();
  assert.match(page, /天网/);
  const scripts = [...page.matchAll(/src="([^"]+\.js)"/g)].map(match => match[1]);
  assert.ok(scripts.length);
  for (const path of scripts) {
    const response = await fetch(base + path);
    assert.equal(response.status, 200);
    new (require('node:vm').Script)(await response.text(), { filename: path });
  }
  assert.equal((await fetch(base + '/api/auth/me')).status, 401);
  const session = await json('/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: process.env.BOOTSTRAP_ADMIN_USERNAME, password: process.env.BOOTSTRAP_ADMIN_PASSWORD })
  });
  const headers = { Authorization: 'Bearer ' + session.accessToken };
  assert.equal((await json('/api/auth/me', { headers })).user.role, 'super_admin');
  for (const path of ['/api/dashboard/security-metrics','/api/dashboard/threat-trends','/api/dashboard/device-stats']) await json(path, { headers });
  const socketCheck = `
    const WebSocket = require('ws');
    const token = require('fs').readFileSync(0, 'utf8');
    const socket = new WebSocket('ws://app:8000/socket.io/?EIO=4&transport=websocket');
    const deadline = setTimeout(() => { console.error('Socket.IO authentication did not complete'); socket.terminate(); process.exitCode = 1; }, 10000);
    socket.on('message', data => {
      const frame = data.toString();
      if (frame.startsWith('0')) socket.send('40' + JSON.stringify({ token }));
      if (frame.startsWith('40')) { clearTimeout(deadline); socket.close(); }
      if (frame.startsWith('44')) { console.error('Socket.IO authentication rejected'); process.exitCode = 1; clearTimeout(deadline); socket.close(); }
      if (frame === '2') socket.send('3');
    });
    socket.on('error', error => { console.error(error.message); clearTimeout(deadline); process.exitCode = 1; });
  `;
  execFileSync('docker', ['compose', 'exec', '-T', 'app', 'node', '-e', socketCheck], { input: session.accessToken });
  await json('/api/auth/logout', { method: 'POST', headers });
  assert.equal((await fetch(base + '/api/auth/me', { headers })).status, 401);
});
test('runtime images exclude local secrets and development dependencies', () => {
  const check = "const fs=require('fs');if(fs.existsSync('/app/.env')||fs.existsSync('/app/.git')||fs.existsSync('/app/node_modules/jest'))process.exit(1)";
  execFileSync('docker', ['compose','exec','-T','app','node','-e',check]);

});
test('agent WebSocket connections reach backend authentication', async () => {
  const status = await new Promise((resolve, reject) => {
    const request = http.get(base + '/ws', { headers: {
      Connection: 'Upgrade', Upgrade: 'websocket',
      'Sec-WebSocket-Version': '13', 'Sec-WebSocket-Key': 'dGhlIHNhbXBsZSBub25jZQ=='
    } }, response => { response.resume(); resolve(response.statusCode); });
    request.on('error', reject);
  });
  assert.equal(status, 401, 'Unauthenticated agents must reach the backend, not the dashboard HTML');
});
test('packaged application is ready after its explicit database migration', async () => {
  assert.equal((await json('/ready')).database, 'ok');
});

test('packaged Agent ingestion, metrics, detection and worker recovery use PostgreSQL', async () => {
  const session = await json('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: process.env.BOOTSTRAP_ADMIN_USERNAME, password: process.env.BOOTSTRAP_ADMIN_PASSWORD }) });
  const headers = { Authorization: `Bearer ${session.accessToken}`, 'Content-Type': 'application/json' };
  try {
    const issued = await json('/api/admin/registration-codes', { method: 'POST', headers, body: JSON.stringify({ maxUses: 1 }) });
    const agentId = `packaged-${process.pid}`;
    const response = await fetch(base + '/api/agents/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ agent_id: agentId, hostname: agentId, platform: 'linux', registrationCode: issued.data.codes[0].code }) });
    assert.equal(response.status, 201);
    const credentials = await response.json();
    const payload = { messageId: 'packaged-sample', type: 'system', timestamp: Date.now(), data: { system: { cpu: { load: 97 }, memory: { usage: 42 } } } };
    const agentHeaders = { Authorization: `Bearer ${credentials.token}`, 'Content-Type': 'application/json' };
    const first = await json(`/api/agents/${agentId}/data`, { method: 'POST', headers: agentHeaders, body: JSON.stringify(payload) });
    const socketCheck = `
      const WebSocket=require('ws');
      const {credentials,payload,receipt}=JSON.parse(require('fs').readFileSync(0,'utf8'));
      const key=credentials.connectionKey;
      const url=new URL('ws://app:8000/ws');
      url.searchParams.set('token',credentials.token);
      url.searchParams.set('connectionKey',key.key+':'+key.timestamp+':'+key.signature);
      const socket=new WebSocket(url);
      const timer=setTimeout(()=>{socket.terminate();process.exitCode=1},10000);
      socket.on('open',()=>socket.send(JSON.stringify({...payload,type:'data',dataType:'system'})));
      socket.on('message',bytes=>{const msg=JSON.parse(bytes);if(msg.type==='data_ack'){if(msg.receiptId!==receipt||!msg.duplicate)process.exitCode=1;clearTimeout(timer);socket.close()}});
      socket.on('error',()=>{clearTimeout(timer);process.exitCode=1});
    `;
    execFileSync('docker', ['compose','exec','-T','app','node','-e',socketCheck], { input: JSON.stringify({ credentials,payload,receipt:first.receiptId }), stdio: ['pipe','pipe','pipe'] });
    const summary = await json(`/api/data/agents/${agentId}/summary`, { headers });
    assert.equal(summary.data.system.avgCpuLoad, 97);
    let alerts;
    for (let i=0;i<50;i++) {
      alerts = (await json(`/api/alerts?agent_id=${agentId}`, { headers })).data.alerts;
      if (alerts.length) break;
      await new Promise(resolve => setTimeout(resolve,100));
    }
    assert.equal(alerts.length,1);
    assert.equal(alerts[0].type,'high-cpu-usage');
    const recovery = `
      const assert=require('node:assert/strict');const {randomUUID}=require('node:crypto');
      const db=require('./server/src/config/database').initializePostgreSQL();
      (async()=>{const {Worker}=await import('./server/src/core/worker.js');const id=randomUUID();const kind='packaged-'+id;
        await db.query("INSERT INTO outbox_jobs(id,kind,dedupe_key,payload) VALUES (:id,:kind,:id,'{}')",{replacements:{id,kind}});
        const failed=new Worker(db,{[kind]:async()=>{throw Object.assign(new Error('fixture'),{code:'FIXTURE_UNAVAILABLE'})}},{retrySeconds:0});
        await failed.runOnce();let [rows]=await db.query('SELECT status,attempts FROM outbox_jobs WHERE id=:id',{replacements:{id}});assert.equal(rows[0].status,'pending');
        const claimed=await failed.claim();assert.equal(claimed.attempts,2);
        await db.query("UPDATE outbox_jobs SET lease_until=now()-interval '1 second' WHERE id=:id",{replacements:{id}});
        const recovered=new Worker(db,{[kind]:async()=>{}});await recovered.runOnce();
        [rows]=await db.query('SELECT status,attempts FROM outbox_jobs WHERE id=:id',{replacements:{id}});assert.equal(rows[0].status,'completed');assert.equal(rows[0].attempts,3);
      })().catch(error=>{console.error(error.code||error.name);process.exitCode=1}).finally(()=>db.close());
    `;
    execFileSync('docker',['compose','exec','-T','-w','/app','app','node','-e',recovery],{stdio:'pipe'});
  } finally { await json('/api/auth/logout', { method:'POST',headers }); }
});
