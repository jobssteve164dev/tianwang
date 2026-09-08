const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const request = require('supertest');
const express = require('express');

if (!process.env.DB_NAME?.endsWith('_auth_test') || process.env.DB_HOST !== '127.0.0.1') {
  throw new Error('Auth verification requires an explicit loopback *_auth_test database');
}
process.env.NODE_ENV = 'test';
process.env.BOOTSTRAP_ADMIN_USERNAME = `authadmin${process.pid}`;
process.env.BOOTSTRAP_ADMIN_PASSWORD = 'AuthTestPassword1!';
process.env.BOOTSTRAP_ADMIN_EMAIL = `${process.env.BOOTSTRAP_ADMIN_USERNAME}@example.test`;
const { initializePostgreSQL } = require('../../src/config/database');
const models = require('../../src/models');
const app = express();
app.use(express.json());
app.use('/api/auth', require('../../src/routes/auth'));
const migrate = () => execFileSync(process.execPath, [path.join(__dirname, '../../src/database/migrate.js')], { env: process.env, stdio: 'pipe' });
const login = async () => (await request(app).post('/api/auth/login').send({ username: process.env.BOOTSTRAP_ADMIN_USERNAME, password: process.env.BOOTSTRAP_ADMIN_PASSWORD }).expect(200)).body;
let db;
before(async () => { migrate(); db = initializePostgreSQL(); models.initializeModels(); });
after(async () => { if (db) await db.close(); });

test('migration initializes a usable administrator and preserves changed credentials on rerun', async () => {
  const admin = await models.User.findOne({ where: { username: process.env.BOOTSTRAP_ADMIN_USERNAME } });
  assert.ok(admin, 'Configured administrator must exist after the formal migration');
  assert.equal(admin.role, 'super_admin');
  assert.ok(admin.organization_id);
  assert.ok(await admin.validatePassword(process.env.BOOTSTRAP_ADMIN_PASSWORD));
  const hash = admin.password_hash;
  migrate();
  await admin.reload();
  assert.equal(admin.password_hash, hash, 'Restart must not reset existing credentials');
  assert.equal(await models.User.count({ where: { username: process.env.BOOTSTRAP_ADMIN_USERNAME } }), 1);
});

test('logout invalidates access and refresh credentials while preserving another login', async () => {
  const first = await login(), second = await login();
  assert.notEqual(first.accessToken, second.accessToken, 'Independent logins must have distinct credentials');
  await request(app).post('/api/auth/logout').set('Authorization', `Bearer ${first.accessToken}`).expect(200);
  await request(app).get('/api/auth/me').set('Authorization', `Bearer ${first.accessToken}`).expect(401);
  await request(app).post('/api/auth/refresh').send({ refreshToken: first.refreshToken }).expect(401);
  await request(app).get('/api/auth/me').set('Authorization', `Bearer ${second.accessToken}`).expect(200);
});

test('refresh replaces the old credential pair and cannot accept an access token', async () => {
  const session = await login();
  await request(app).post('/api/auth/refresh').send({ refreshToken: session.accessToken }).expect(401);
  const renewed = await request(app).post('/api/auth/refresh').send({ refreshToken: session.refreshToken }).expect(200);
  await request(app).post('/api/auth/refresh').send({ refreshToken: session.refreshToken }).expect(401);
  await request(app).get('/api/auth/me').set('Authorization', `Bearer ${renewed.body.accessToken}`).expect(200);
});

test('logout revokes the authenticated session even if refresh wins the race', async () => {
  const first = await login(), second = await login();
  let renewed, disconnectedRoom;
  const racingApp = express();
  racingApp.set('io', { in: room => ({ disconnectSockets: () => { disconnectedRoom = room; } }) });
  racingApp.post('/logout', require('../../src/middleware/auth').authenticate, async (req, res) => {
    renewed = await require('../../src/services/UserSessionService').rotateSession(first.refreshToken, req.userId);
    await require('../../src/controllers/authController').logout(req, res);
  });
  const { createHash } = require('node:crypto');
  const row = await models.UserSession.findOne({ where: { session_token: createHash('sha256').update(first.accessToken).digest('hex') } });
  await request(racingApp).post('/logout').set('Authorization', `Bearer ${first.accessToken}`).expect(200);
  await request(app).get('/api/auth/me').set('Authorization', `Bearer ${renewed.accessToken}`).expect(401);
  await request(app).post('/api/auth/refresh').send({ refreshToken: renewed.refreshToken }).expect(401);
  await request(app).get('/api/auth/me').set('Authorization', `Bearer ${second.accessToken}`).expect(200);
  assert.equal(disconnectedRoom, `session:${row.id}`, 'Only the logged-out session should lose its socket');
});

test('logging out one device preserves live events on another device', async () => {
  const { io: connect } = require('socket.io-client');
  const { server, io } = require('../../src/index');
  const { once } = require('node:events');
  const first = await login(), second = await login();
  app.set('io', io);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  const sockets = [first, second].map(session => connect(url, { auth: { token: session.accessToken }, transports: ['websocket'], reconnection: false }));
  try {
    await Promise.all(sockets.map(socket => new Promise((resolve, reject) => {
      socket.once('connect', resolve);
      socket.once('connect_error', reject);
    })));
    const disconnected = once(sockets[0], 'disconnect');
    await request(app).post('/api/auth/logout').set('Authorization', `Bearer ${first.accessToken}`).expect(200);
    await disconnected;
    assert.equal(sockets[1].connected, true);
    const event = once(sockets[1], 'verification-event', { signal: AbortSignal.timeout(3000) });
    const userId = (await request(app).get('/api/auth/me').set('Authorization', `Bearer ${second.accessToken}`).expect(200)).body.user.id;
    io.to(`user:${userId}`).emit('verification-event', 'still connected');
    assert.deepEqual(await event, ['still connected']);
    const third = await login();
    const originalFind = models.User.findByPk;
    let resume, entered, paused = false;
    const gate = new Promise(resolve => { resume = resolve; });
    const ready = new Promise(resolve => { entered = resolve; });
    models.User.findByPk = async function(...args) {
      const result = await originalFind.apply(this, args);
      if (!paused) { paused = true; entered(); await gate; }
      return result;
    };
    const pendingSocket = connect(url, { auth: { token: third.accessToken }, transports: ['websocket'], reconnection: false, autoConnect: false });
    sockets.push(pendingSocket);
    const denied = new Promise(resolve => {
      pendingSocket.once('authenticated', () => resolve(false));
      pendingSocket.once('connect_error', () => resolve(true));
      pendingSocket.once('disconnect', () => resolve(true));
    });
    try {
      pendingSocket.connect();
      await ready;
      await request(app).post('/api/auth/logout').set('Authorization', `Bearer ${third.accessToken}`).expect(200);
      resume();
      assert.equal(await denied, true, 'A revoked handshake must not become an authenticated connection');
    } finally { resume(); models.User.findByPk = originalFind; }
    const fourth = await login();
    const originalSessionFind = models.UserSession.findOne;
    const { createHash } = require('node:crypto');
    const fourthHash = createHash('sha256').update(fourth.accessToken).digest('hex');
    let releaseCheck, checks = 0;
    const checkGate = new Promise(resolve => { releaseCheck = resolve; });
    models.UserSession.findOne = async function(options) {
      const result = await originalSessionFind.call(this, options);
      if (options.where.session_token === fourthHash && ++checks === 2) await checkGate;
      return result;
    };
    const eagerSocket = connect(url, { auth: { token: fourth.accessToken }, transports: ['websocket'], reconnection: false, autoConnect: false });
    sockets.push(eagerSocket);
    io.once('connection', socket => socket.on('verification-barrier', ack => ack()));
    try {
      const connected = once(eagerSocket, 'connect');
      eagerSocket.connect();
      await connected;
      eagerSocket.emit('subscribe-threats');
      await eagerSocket.timeout(3000).emitWithAck('verification-barrier');
      const authenticated = once(eagerSocket, 'authenticated');
      releaseCheck();
      await authenticated;
      const received = once(eagerSocket, 'verification-threat', { signal: AbortSignal.timeout(3000) });
      io.to(`threats:${second.user.organization_id}`).emit('verification-threat', 'subscribed immediately');
      assert.deepEqual(await received, ['subscribed immediately']);
    } finally { releaseCheck(); models.UserSession.findOne = originalSessionFind; }
  } finally {
    sockets.forEach(socket => socket.disconnect());
    await new Promise(resolve => io.close(resolve));
    app.set('io', undefined);
  }
});

test('an in-flight login cannot create a session with a password changed meanwhile', async () => {
  const session = await login();
  const validate = models.User.prototype.validatePassword;
  let release, validated, paused = false;
  const gate = new Promise(resolve => { release = resolve; });
  const ready = new Promise(resolve => { validated = resolve; });
  models.User.prototype.validatePassword = async function(password) {
    const result = await validate.call(this, password);
    if (!paused) { paused = true; validated(); await gate; }
    return result;
  };
  try {
    const pending = request(app).post('/api/auth/login').send({ username: process.env.BOOTSTRAP_ADMIN_USERNAME, password: process.env.BOOTSTRAP_ADMIN_PASSWORD }).then(response => response);
    await ready;
    await request(app).post('/api/auth/change-password').set('Authorization', `Bearer ${session.accessToken}`)
      .send({ current_password: process.env.BOOTSTRAP_ADMIN_PASSWORD, new_password: 'ConcurrentAuthPassword3!' }).expect(200);
    process.env.BOOTSTRAP_ADMIN_PASSWORD = 'ConcurrentAuthPassword3!';
    release();
    assert.equal((await pending).status, 401);
  } finally { release(); models.User.prototype.validatePassword = validate; }
});

test('changing password revokes every prior user session', async () => {
  const first = await login(), second = await login();
  await request(app).post('/api/auth/change-password').set('Authorization', `Bearer ${first.accessToken}`)
    .send({ current_password: process.env.BOOTSTRAP_ADMIN_PASSWORD, new_password: 'ChangedAuthPassword2!' }).expect(200);
  await request(app).get('/api/auth/me').set('Authorization', `Bearer ${second.accessToken}`).expect(401);
  await request(app).post('/api/auth/refresh').send({ refreshToken: first.refreshToken }).expect(401);
  await request(app).post('/api/auth/login').send({ username: process.env.BOOTSTRAP_ADMIN_USERNAME, password: process.env.BOOTSTRAP_ADMIN_PASSWORD }).expect(401);
  process.env.BOOTSTRAP_ADMIN_PASSWORD = 'ChangedAuthPassword2!';
  await login();
});
