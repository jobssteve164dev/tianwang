const fetch = require('node-fetch');

const mockSystemConfig = {
  findOne: jest.fn(),
  upsert: jest.fn()
};

jest.mock('node-fetch', () => jest.fn());
jest.mock('../../src/models', () => ({
  get SystemConfig() {
    return mockSystemConfig;
  }
}));
jest.mock('../../src/utils/encryption', () => ({
  encrypt: jest.fn(value => `encrypted:${value}`),
  decrypt: jest.fn(value => value.replace(/^encrypted:/, ''))
}));

const service = require('../../src/services/ThreatIntelligenceConfigService');

describe('ThreatIntelligenceConfigService PostgreSQL configuration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fetch.mockResolvedValue({ ok: true });
    mockSystemConfig.upsert.mockResolvedValue([{}, true]);
  });

  test('saving configuration persists encrypted keys without an external runtime', async () => {
    mockSystemConfig.findOne.mockResolvedValue(null);

    await service.save({
      misp: { enabled: true, url: 'https://misp.example', apiKey: 'misp-key' },
      otx: { enabled: false }
    });

    expect(fetch).not.toHaveBeenCalled();
    expect(mockSystemConfig.upsert).toHaveBeenCalledWith(expect.objectContaining({
      key: 'threat_intelligence_config',
      value: expect.objectContaining({ misp: expect.objectContaining({ apiKey: 'encrypted:misp-key' }) })
    }));
  });

  test('external runtime failure does not prevent saving', async () => {
    mockSystemConfig.findOne.mockResolvedValue(null);
    fetch.mockResolvedValue({ ok: false, status: 503, text: jest.fn().mockResolvedValue('not ready') });

    await service.save({ otx: { enabled: true, apiKey: 'otx-key' } });
    expect(mockSystemConfig.upsert).toHaveBeenCalled();
  });

  test('stored keys are read from PostgreSQL and are masked for the user', async () => {
    mockSystemConfig.findOne.mockResolvedValue({ value: { otx: { enabled: true, apiKey: 'encrypted:otx-key' } } });
    const stored = await service.load();
    expect(service.runtimeConfig(stored).otx.api_key).toBe('otx-key');
    expect(service.publicConfig(stored).otx.apiKey).toBe('***');
    expect(fetch).not.toHaveBeenCalled();
  });
});
