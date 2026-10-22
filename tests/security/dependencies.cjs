const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const semver = require('semver');

const root = path.resolve(__dirname, '../..');
const minimums = {
  '@modelcontextprotocol/sdk': '1.31.0',
  'brace-expansion': { 1: '1.1.21', 2: '2.1.7', 5: '5.0.12' },
  compression: '1.8.2',
  'engine.io': '6.6.10',
  'fast-uri': '3.1.8',
  hono: '4.13.7',
  'http-cache-semantics': '4.3.0',
  'ip-address': '10.7.1',
  joi: '17.13.8',
  moment: '2.31.0',
  morgan: '1.12.1',
  nodemailer: '10.0.9',
  'postcss-selector-parser': '7.1.6',
  'proxy-addr': '2.0.8',
  'serialize-javascript': '7.1.2',
  sharp: '0.35.5',
  'shell-quote': '1.11.0',
  'source-map-js': '1.2.2',
  yaml: { 1: '1.10.3', 2: '2.8.3' },
};
const safeRanges = {
  'follow-redirects': '>=1.16.1',
  'webpack-dev-middleware': '>=7.4.6 <8.0.0 || >=8.3.0',
};
const forbiddenDependencies = ['node-forge', 'sprintf-js'];

for (const manifest of ['package-lock.json', 'agents/package-lock.json']) {
  const lock = JSON.parse(fs.readFileSync(path.join(root, manifest), 'utf8'));
  for (const [name, minimum] of Object.entries(minimums)) {
    const entries = Object.entries(lock.packages).filter(([entry]) => entry.endsWith(`node_modules/${name}`));
    if (!entries.length) continue;
    test(`${manifest}: every installed ${name} excludes the known vulnerable releases`, () => {
      for (const [entry, pkg] of entries) {
        // The YAML advisory affects stable 2.x releases, not swagger-jsdoc's 2.0.0 prerelease.
        if (name === 'yaml' && semver.prerelease(pkg.version)) continue;
        const floor = typeof minimum === 'string' ? minimum : minimum[semver.major(pkg.version)];
        assert.ok(floor, `Unreviewed ${name} release line: ${pkg.version}`);
        assert.ok(semver.gte(pkg.version, floor), `${entry}: ${pkg.version} < ${floor}`);
      }
    });
  }
  for (const [name, safeRange] of Object.entries(safeRanges)) {
    const entries = Object.entries(lock.packages).filter(([entry]) => entry.endsWith(`node_modules/${name}`));
    if (!entries.length) continue;
    test(`${manifest}: every installed ${name} excludes the known vulnerable releases`, () => {
      for (const [entry, pkg] of entries) {
        assert.ok(semver.satisfies(pkg.version, safeRange), `${entry}: ${pkg.version} is outside ${safeRange}`);
      }
    });
  }
  for (const name of forbiddenDependencies) {
    test(`${manifest}: ${name} is absent because no patched release exists`, () => {
      const entries = Object.keys(lock.packages).filter(entry => entry.endsWith(`node_modules/${name}`));
      assert.deepEqual(entries, []);
    });
  }
}

for (const manifest of ['package.json', 'agents/package.json']) {
  const consumer = createRequire(path.join(root, manifest));
  test(`${manifest}: shell quoting rejects command injection after a comment`, () => {
    const { quote } = consumer('shell-quote');
    for (const newline of ['\n', '\r', '\u2028', '\u2029']) {
      assert.throws(() => quote(['echo', 'ok', { comment: 'x' }, `a${newline}printf injected;#`]), TypeError);
    }
    assert.equal(quote(['echo', 'hello world']), "echo 'hello world'");
  });
}

test('the CRA development server stays on WDS 4 and awaits asynchronous certificate generation', () => {
  const consumer = createRequire(path.join(root, 'client/package.json'));
  const serverPackage = consumer('webpack-dev-server/package.json');
  const serverSource = fs.readFileSync(consumer.resolve('webpack-dev-server/lib/Server.js'), 'utf8');
  assert.equal(semver.major(serverPackage.version), 4);
  assert.match(serverSource, /const pems = await selfsigned\.generate\(/);
});

test('cacheable-request never stores or reuses private responses across users', async () => {
  const http = require('node:http');
  const { once } = require('node:events');
  const CacheableRequest = createRequire(path.join(root, 'agents/package.json'))('cacheable-request');
  const storage = new Map();
  const request = new CacheableRequest(http.request, storage);
  const server = http.createServer((req, res) => {
    res.setHeader('Cache-Control', req.url === '/public' ? 'public, max-age=3600' : 'private');
    if (req.url !== '/public') res.setHeader('Set-Cookie', `session=${req.headers['x-user']}`);
    res.end(req.headers['x-user'] || 'public');
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const get = (route, headers = {}) => new Promise((resolve, reject) => {
    const call = request({ protocol: 'http:', hostname: '127.0.0.1', port: server.address().port, path: route, headers, agent: false }, response => {
      let body = '';
      response.on('data', chunk => { body += chunk; });
      response.on('end', () => resolve({ body, cached: response.fromCache, cookie: response.headers['set-cookie'] }));
      response.on('error', reject);
    });
    call.on('request', req => { req.on('error', reject); req.end(); });
    call.on('error', reject);
  });
  try {
    assert.equal((await get('/private', { 'x-user': 'alice' })).body, 'alice');
    const second = await get('/private', { 'x-user': 'bob', 'cache-control': 'max-stale=9999999' });
    assert.equal(second.body, 'bob');
    assert.deepEqual(second.cookie, ['session=bob']);
    assert.equal(second.cached, false);
    assert.equal(storage.size, 0);
    assert.equal((await get('/public')).body, 'public');
    await new Promise(setImmediate);
    assert.equal((await get('/public')).cached, true);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test('the actual Electron downloader does not reuse Set-Cookie or proxy-revalidate responses via max-stale', async () => {
  const http = require('node:http');
  const { once } = require('node:events');
  const agents = createRequire(path.join(root, 'agents/package.json'));
  const builder = createRequire(agents.resolve('app-builder-lib/package.json'));
  const downloader = createRequire(builder.resolve('@electron/get/package.json'));
  const got = downloader('got');
  const server = http.createServer((req, res) => {
    res.setHeader('Cache-Control', req.url === '/cookie' ? 'max-age=3600' : 'proxy-revalidate, max-age=0');
    res.setHeader('Set-Cookie', `session=${req.headers['x-user']}`);
    res.end(req.headers['x-user']);
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    for (const route of ['/cookie', '/proxy']) {
      const url = `http://127.0.0.1:${server.address().port}${route}`;
      assert.equal((await got(url, { headers: { 'x-user': 'alice' } })).body, 'alice');
      const second = await got(url, { headers: { 'x-user': 'bob', 'cache-control': 'max-stale=9999999' } });
      assert.equal(second.body, 'bob');
      assert.deepEqual(second.headers['set-cookie'], ['session=bob']);
    }
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test('notification delivery still produces a real MIME message with the upgraded mailer', async () => {
  const consumer = createRequire(path.join(root, 'server/package.json'));
  const NotificationService = consumer('./src/services/NotificationService.js');
  const service = new NotificationService();
  service.config.email.from = 'alerts@example.test';
  service.emailTransporter = consumer('nodemailer').createTransport({ streamTransport: true, buffer: true, newline: 'unix' });
  try {
    const result = await service.sendEmail({ template: 'threat_alert', recipients: ['admin@example.test'], data: { threatType: 'malware', severity: 'high' } });
    assert.deepEqual(result.envelope.to, ['admin@example.test']);
    assert.equal(result.envelope.from, 'alerts@example.test');
    assert.match(result.message.toString(), /Content-Type: text\/html/);
    assert.equal(service.stats.emailSent, 1);
  } finally {
    service.emailTransporter.close();
  }
});

test('the AI rule importer pins a GitPython release with submodule path validation', () => {
  const requirements = fs.readFileSync(path.join(root, 'server/ai-engine/requirements.txt'), 'utf8');
  const version = requirements.match(/^GitPython==([^\s]+)$/m)?.[1];
  assert.ok(version && semver.gte(version, '3.1.62'), `Vulnerable GitPython pin: ${version}`);
});

test('the AI HTTP client pins an aiohttp release with resource and cookie fixes', () => {
  const requirements = fs.readFileSync(path.join(root, 'server/ai-engine/requirements.txt'), 'utf8');
  const version = requirements.match(/^aiohttp==([^\s]+)$/m)?.[1];
  assert.ok(version && semver.gte(version, '3.14.4'), `Vulnerable aiohttp pin: ${version}`);
});
