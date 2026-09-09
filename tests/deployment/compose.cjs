const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { execFile } = require('node:child_process');
const net = require('node:net');
const { promisify } = require('node:util');
const execFileAsync = promisify(execFile);
const env = { ...process.env };
for (const key of ['DB_PASSWORD','REDIS_PASSWORD','JWT_SECRET','ENCRYPTION_KEY','AI_INTERNAL_TOKEN','INFLUXDB_PASSWORD','INFLUXDB_TOKEN','BOOTSTRAP_ADMIN_PASSWORD']) env[key] = `fixture-${key}-password-long-enough`;
env.BOOTSTRAP_ADMIN_USERNAME = 'fixtureadmin';
env.BOOTSTRAP_ADMIN_EMAIL = 'fixture@example.test';
const config = JSON.parse(execFileSync('docker', ['compose','--env-file','/dev/null','-f','docker-compose.yml','config','--format','json'], { env, encoding: 'utf8' }));
test('the whole-project release packages every image needed for offline startup', () => {
  const packaged = Object.entries(config.services).filter(([,service]) => service.build).map(([name]) => name).sort();
  assert.deepEqual(packaged, Object.keys(config.services).sort());
  for (const service of Object.values(config.services)) assert.equal(service.platform, 'linux/amd64');
});
test('production deployment preserves every service without host source mounts', () => {
  assert.deepEqual(Object.keys(config.services).sort(), ['postgres','influxdb','redis','zookeeper','kafka','server','client','ai-engine','nginx'].sort());
  for (const service of Object.values(config.services)) {
    assert.ok(!(service.volumes || []).some(volume => volume.type === 'bind'), 'Release must run from its packaged files and durable volumes');
  }
});
test('only the dashboard gateway publishes a host port and has a declared identity', () => {
  const entries = Object.entries(config.services).filter(([,s])=>s.ports?.length);
  assert.deepEqual(entries.map(([name])=>name), ['nginx']);
  assert.equal(entries[0][1].ports[0].published, '18080');
  assert.equal(config['x-gitops']?.public_entry?.service, 'nginx');
  assert.equal(config['x-gitops'].public_entry.healthcheck.expected_json.service, 'tianwang');
});
test('the effective runtime uses injected credentials and production settings', () => {
  const s = config.services;
  assert.equal(s.server.environment.NODE_ENV, 'production');
  assert.equal(s.server.environment.BOOTSTRAP_ADMIN_PASSWORD, env.BOOTSTRAP_ADMIN_PASSWORD);
  assert.equal(s.postgres.environment.POSTGRES_PASSWORD, env.DB_PASSWORD);
  assert.equal(s.server.environment.DB_PASSWORD, env.DB_PASSWORD);
  assert.equal(s.server.environment.INFLUXDB_TOKEN, env.INFLUXDB_TOKEN);
  assert.equal(s['ai-engine'].environment.AI_INTERNAL_TOKEN, env.AI_INTERNAL_TOKEN);
  assert.equal(s.server.environment.LOG_LEVEL, 'info');
});
test('backend producers and AI consumers use the same production topics', () => {
  const path = require('node:path');
  const backend = JSON.parse(execFileSync('node', ['-e', `process.stdout.write(JSON.stringify(require(${JSON.stringify(path.resolve('server/src/config'))}).kafka.topics))`], {
    env: { ...env, ...config.services.server.environment }, encoding: 'utf8'
  }));
  const python = process.env.PYTHON || path.resolve('.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
  const ai = JSON.parse(execFileSync(python, ['-c', `import sys,json; sys.path.insert(0,${JSON.stringify(path.resolve('server/ai-engine'))}); from src.config import config; print(json.dumps(config.kafka_topics))`], {
    cwd: require('node:os').tmpdir(), env: { ...env, ...config.services['ai-engine'].environment }, encoding: 'utf8'
  }));
  assert.deepEqual(ai, backend);
});
test('the Kafka health check completes against a listening broker without starting a Java CLI', async () => {
  const command = config.services.kafka.healthcheck.test[1];
  assert.equal(command, "bash -c '</dev/tcp/127.0.0.1/9092'");
  const broker = net.createServer(socket => socket.end());
  await new Promise((resolve, reject) => broker.listen(0, '127.0.0.1', resolve).once('error', reject));
  const port = broker.address().port;
  const probe = command.replace('/9092', `/${port}`);
  try {
    await execFileAsync('/bin/bash', ['-c', probe], { timeout: 5000 });
  } finally {
    await new Promise(resolve => broker.close(resolve));
  }
  await assert.rejects(execFileAsync('/bin/bash', ['-c', probe], { timeout: 5000 }));
});
