const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

const mockUserModel = { findOne: jest.fn(), findByPk: jest.fn(), create: jest.fn() };
jest.mock('../../models', () => ({ User: mockUserModel }));
jest.mock('../../utils/logger', () => ({
  info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(), audit: jest.fn()
}));

const config = require('../../config');
const authRoutes = require('../auth');

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);

function user(overrides = {}) {
  return {
    id: '8eea13dd-c4cb-43de-9938-a5143b79cceb',
    username: 'analyst',
    status: 'active',
    organization_id: 'org-1',
    password_hash: 'hash',
    validatePassword: jest.fn().mockResolvedValue(true),
    incrementFailedLogins: jest.fn().mockResolvedValue(undefined),
    resetFailedLogins: jest.fn().mockResolvedValue(undefined),
    isLocked: jest.fn(() => false),
    save: jest.fn().mockResolvedValue(undefined),
    toJSON: jest.fn(() => ({ id: '8eea13dd-c4cb-43de-9938-a5143b79cceb', username: 'analyst', role: 'analyst' })),
    ...overrides
  };
}

describe('auth route end-to-end token contract', () => {
  beforeEach(() => jest.clearAllMocks());

  test('login issues distinct typed access and refresh tokens', async () => {
    const stored = user();
    mockUserModel.findOne.mockResolvedValue(stored);
    const response = await request(app).post('/api/auth/login').send({
      username: 'analyst', password: 'Correct1'
    }).expect(200);
    expect(stored.validatePassword).toHaveBeenCalledWith('Correct1');
    expect(jwt.verify(response.body.accessToken, config.jwt.secret)).toMatchObject({
      userId: stored.id, tokenUse: 'access'
    });
    expect(jwt.verify(response.body.refreshToken, config.jwt.secret)).toMatchObject({
      userId: stored.id, tokenUse: 'refresh'
    });
  });

  test('refresh accepts only a refresh token for an active account', async () => {
    const stored = user();
    mockUserModel.findByPk.mockResolvedValue(stored);
    mockUserModel.findOne.mockResolvedValue(stored);
    const login = await request(app).post('/api/auth/login').send({
      username: 'analyst', password: 'Correct1'
    });
    const refreshed = await request(app).post('/api/auth/refresh').send({
      refreshToken: login.body.refreshToken
    }).expect(200);
    expect(jwt.verify(refreshed.body.accessToken, config.jwt.secret).tokenUse).toBe('access');
    await request(app).post('/api/auth/refresh').send({ refreshToken: login.body.accessToken }).expect(401);
  });

  test('current-user endpoint is protected and rejects refresh-token substitution', async () => {
    const stored = user();
    mockUserModel.findByPk.mockResolvedValue(stored);
    const accessToken = jwt.sign({ userId: stored.id, tokenUse: 'access' }, config.jwt.secret, { expiresIn: 60 });
    const refreshToken = jwt.sign({ userId: stored.id, tokenUse: 'refresh' }, config.jwt.secret, { expiresIn: 60 });
    await request(app).get('/api/auth/me').expect(401);
    await request(app).get('/api/auth/me').set('Authorization', `Bearer ${refreshToken}`).expect(401);
    const response = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${accessToken}`).expect(200);
    expect(response.body.user.username).toBe('analyst');
  });

  test('password change validates the current secret before persisting the new one', async () => {
    const stored = user();
    mockUserModel.findByPk.mockResolvedValue(stored);
    const accessToken = jwt.sign({ userId: stored.id, tokenUse: 'access' }, config.jwt.secret, { expiresIn: 60 });
    await request(app).post('/api/auth/change-password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ current_password: 'Correct1', new_password: 'NewSecret2' })
      .expect(200);
    expect(stored.validatePassword).toHaveBeenCalledWith('Correct1');
    expect(stored.password_hash).toBe('NewSecret2');
    expect(stored.save).toHaveBeenCalled();
  });

  test('invalid credentials never issue tokens', async () => {
    const stored = user({ validatePassword: jest.fn().mockResolvedValue(false) });
    mockUserModel.findOne.mockResolvedValue(stored);
    const response = await request(app).post('/api/auth/login').send({
      username: 'analyst', password: 'Wrong12'
    }).expect(401);
    expect(response.body).not.toHaveProperty('accessToken');
    expect(stored.incrementFailedLogins).toHaveBeenCalled();
  });
});
