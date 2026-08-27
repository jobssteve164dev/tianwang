const express = require('express');
const request = require('supertest');

const userRecord = {
  id: 'user-2',
  role: 'viewer',
  update: jest.fn(),
  destroy: jest.fn()
};

jest.mock('../../middleware/auth', () => ({
  authenticate: (req, _res, next) => {
    req.user = { id: 'admin-1', role: 'super_admin', organization_id: 'org-1' };
    next();
  },
  authorize: () => (_req, _res, next) => next()
}));

jest.mock('../../models', () => ({
  User: {
    findAndCountAll: jest.fn(),
    findByPk: jest.fn(),
    create: jest.fn(),
    count: jest.fn()
  },
  Agent: { count: jest.fn() },
  Alert: { count: jest.fn() },
  SecurityEvent: { count: jest.fn() },
  SystemConfig: { findAll: jest.fn(), upsert: jest.fn() },
  sequelize: { authenticate: jest.fn() }
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

const models = require('../../models');
const userRoutes = require('../users');
const systemRoutes = require('../system');

function createApp(route, prefix) {
  const app = express();
  app.use(express.json());
  app.use(prefix, route);
  return app;
}

describe('management routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    userRecord.update.mockResolvedValue(userRecord);
    userRecord.destroy.mockResolvedValue(undefined);
    models.User.findByPk.mockResolvedValue(userRecord);
    models.User.findAndCountAll.mockResolvedValue({ rows: [userRecord], count: 1 });
    models.User.create.mockResolvedValue(userRecord);
    models.SystemConfig.findAll.mockResolvedValue([{ key: 'locale', value: 'zh-CN', category: 'general' }]);
    models.SystemConfig.upsert.mockResolvedValue([{ key: 'locale', value: 'zh-CN', category: 'general' }, true]);
    models.User.count.mockResolvedValue(2);
    models.Agent.count.mockResolvedValueOnce(3).mockResolvedValueOnce(1);
    models.Alert.count.mockResolvedValueOnce(4).mockResolvedValueOnce(2);
    models.SecurityEvent.count.mockResolvedValue(5);
    models.sequelize.authenticate.mockResolvedValue(undefined);
  });

  test('用户管理使用真实模型完成查询、创建、更新和删除', async () => {
    const app = createApp(userRoutes, '/users');
    const list = await request(app).get('/users?page=1&pageSize=10');
    expect(list.status).toBe(200);
    expect(list.body.pagination.total).toBe(1);

    const created = await request(app).post('/users').send({
      username: 'analyst1', email: 'analyst1@example.com', password: 'secure-password', full_name: '分析员'
    });
    expect(created.status).toBe(201);
    expect(models.User.create).toHaveBeenCalledWith(expect.objectContaining({ password_hash: 'secure-password' }));

    expect((await request(app).patch('/users/user-2').send({ status: 'inactive' })).status).toBe(200);
    expect(userRecord.update).toHaveBeenCalledWith({ status: 'inactive' });
    expect((await request(app).delete('/users/user-2')).status).toBe(204);
    expect(userRecord.destroy).toHaveBeenCalled();
  });

  test('系统配置、统计、信息和健康接口返回真实状态', async () => {
    const app = createApp(systemRoutes, '/system');
    expect((await request(app).get('/system/config')).body.entries).toHaveLength(1);
    expect((await request(app).put('/system/config').send({ locale: 'zh-CN' })).status).toBe(200);
    expect(models.SystemConfig.upsert).toHaveBeenCalledWith(expect.objectContaining({ key: 'locale', value: 'zh-CN' }), { returning: true });

    const stats = await request(app).get('/system/stats');
    expect(stats.body.stats).toEqual({ users: 2, agents: 3, onlineAgents: 1, alerts: 4, activeAlerts: 2, securityEvents: 5 });
    expect((await request(app).get('/system/info')).body.system.version).toBeTruthy();
    expect((await request(app).get('/system/health')).body.status).toBe('healthy');
  });
});
