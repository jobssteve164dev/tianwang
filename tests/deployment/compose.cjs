const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
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
test('production deployment contains only the application and PostgreSQL without host source mounts', () => {
  assert.deepEqual(Object.keys(config.services).sort(), ['app','postgres']);
  for (const service of Object.values(config.services)) {
    assert.ok(!(service.volumes || []).some(volume => volume.type === 'bind'), 'Release must run from its packaged files and durable volumes');
  }
});
test('only the dashboard gateway publishes a host port and has a declared identity', () => {
  const entries = Object.entries(config.services).filter(([,s])=>s.ports?.length);
  assert.deepEqual(entries.map(([name])=>name), ['app']);
  assert.equal(entries[0][1].ports[0].published, '18080');
  assert.equal(config['x-gitops']?.public_entry?.service, 'app');
  assert.equal(config['x-gitops'].public_entry.healthcheck.expected_json.service, 'tianwang');
});
test('the effective runtime uses injected credentials and production settings', () => {
  const s = config.services;
  assert.equal(s.app.environment.NODE_ENV, 'production');
  assert.equal(s.app.environment.BOOTSTRAP_ADMIN_PASSWORD, env.BOOTSTRAP_ADMIN_PASSWORD);
  assert.equal(s.postgres.environment.POSTGRES_PASSWORD, env.DB_PASSWORD);
  assert.equal(s.app.environment.DB_PASSWORD, env.DB_PASSWORD);
  assert.equal(s.app.environment.LOG_LEVEL, 'info');
});
test('the application has no dependency or environment for the retired runtime services', () => {
  assert.deepEqual(Object.keys(config.services.app.depends_on), ['postgres']);
  assert.ok(!Object.keys(config.services.app.environment).some(key => /KAFKA|REDIS|INFLUX|AI_ENGINE|AI_INTERNAL/.test(key)));
  assert.equal(config['x-gitops'].public_entry.container_port, 8000);
});
test('V2 initializes PostgreSQL in a separate volume without reusing retired data', () => {
  const data = config.services.postgres.volumes.find(volume => volume.target === '/var/lib/postgresql/data');
  assert.equal(data.source, 'postgres_v2_data');
  const source = require('node:fs').readFileSync('docker-compose.yml', 'utf8');
  assert.match(source, /^  postgres_data:$/m, 'Keep the old volume declaration until its exact physical cleanup is verified');
  for (const service of Object.values(config.services)) {
    assert.ok(!(service.volumes || []).some(volume => volume.source === 'postgres_data'));
  }
});
