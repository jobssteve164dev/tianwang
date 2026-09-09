require('express-async-errors');
const express = require('express');
const mockRules = { findAll: jest.fn() };
jest.mock('../../models', () => ({ ThreatRule: mockRules }));
const request = require('supertest');

jest.mock('../../middleware/auth', () => ({
  protect: (req, _res, next) => {
    req.user = { id: 'analyst-1', role: 'admin', organization_id: 'org-1' };
    req.organizationId = 'org-1';
    next();
  },
  authorize: () => (_req, _res, next) => next()
}));

const securityRoutes = require('../security');

const app = express();
app.use(express.json());
app.use('/security', securityRoutes);
app.use((error, req, res, next) => res.status(500).json({ success: false }));

describe('security rule pipeline', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    delete global.fetch;
  });

  test('reads persisted rules for the authenticated organization without contacting Python', async () => {
    mockRules.findAll.mockResolvedValue([{ id: 'rule-1', enabled: true, content: 'title: Rule one', metadata: {} }]);
    const response = await request(app).get('/security/rules/custom').expect(200);
    expect(response.body.data[0].title).toBe('Rule one');
    expect(mockRules.findAll).toHaveBeenCalledWith(expect.objectContaining({ where: { rule_type: 'sigma', organization_id: 'org-1' } }));
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('does not report successful rule data when PostgreSQL rejects the query', async () => {
    mockRules.findAll.mockRejectedValue(new Error('database unavailable'));
    const response = await request(app).get('/security/rules/custom').expect(500);
    expect(response.body.success).toBe(false);
  });
});
