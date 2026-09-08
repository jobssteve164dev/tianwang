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
  for (const path of scripts) assert.equal((await fetch(base + path)).status, 200);
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
    const socket = new WebSocket('ws://nginx/socket.io/?EIO=4&transport=websocket');
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
  execFileSync('docker', ['compose', 'exec', '-T', 'server', 'node', '-e', socketCheck], { input: session.accessToken });
  await json('/api/auth/logout', { method: 'POST', headers });
  assert.equal((await fetch(base + '/api/auth/me', { headers })).status, 401);
});
test('runtime images exclude local secrets and development dependencies', () => {
  const check = "const fs=require('fs');if(fs.existsSync('/app/.env')||fs.existsSync('/app/.git')||fs.existsSync('/app/node_modules/jest'))process.exit(1)";
  execFileSync('docker', ['compose','exec','-T','server','node','-e',check]);
  execFileSync('docker', ['compose','exec','-T','ai-engine','python','-c',"import importlib.util; assert importlib.util.find_spec('pytest') is None"]);
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
test('packaged AI and backend share their Kafka topics', () => {
  const backend = JSON.parse(execFileSync('docker', ['compose', 'exec', '-T', 'server', 'node', '-e', "process.stdout.write(JSON.stringify(require('./src/config').kafka.topics))"], { encoding: 'utf8' }));
  const ai = JSON.parse(execFileSync('docker', ['compose', 'exec', '-T', 'ai-engine', 'python', '-c', 'import json; from src.config import config; print(json.dumps(config.kafka_topics))'], { encoding: 'utf8' }));
  assert.deepEqual(ai, backend);
});
