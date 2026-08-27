const express = require('express');
const request = require('supertest');

jest.mock('../../middleware/auth', () => ({
  protect: (req, _res, next) => {
    req.user = { id: 'analyst-1', role: 'analyst', organization_id: 'org-1' };
    next();
  },
  authorize: () => (_req, _res, next) => next()
}));

jest.mock('../../config', () => ({
  ai: { engineUrl: 'http://ai-engine:8888/' }
}));

const securityRoutes = require('../security');

const app = express();
app.use(express.json());
app.use('/security', securityRoutes);

describe('security rule pipeline', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    delete global.fetch;
  });

  test('routes rule status through the configured AI engine endpoint', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({ success: true, status: { rules_loaded: 12 } })
    });

    const response = await request(app).get('/security/rules/status').expect(200);

    expect(global.fetch).toHaveBeenCalledWith('http://ai-engine:8888/api/rules/status', undefined);
    expect(response.body.status.rules_loaded).toBe(12);
  });

  test('does not report success when the AI engine rejects the request', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 503,
      json: jest.fn().mockResolvedValue({ detail: '规则引擎不可用' })
    });

    const response = await request(app).get('/security/rules/status').expect(500);

    expect(response.body.success).toBe(false);
    expect(response.body.error).toContain('规则引擎不可用');
  });
});
