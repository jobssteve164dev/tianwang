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

describe('ThreatIntelligenceConfigService runtime synchronization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fetch.mockResolvedValue({ ok: true });
    mockSystemConfig.upsert.mockResolvedValue([{}, true]);
  });

  test('saving configuration updates the running AI rule engine before persistence', async () => {
    mockSystemConfig.findOne.mockResolvedValue(null);

    await service.save({
      misp: { enabled: true, url: 'https://misp.example', apiKey: 'misp-key' },
      otx: { enabled: false }
    });

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:8888/api/threat-intelligence/config',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({
          misp: { enabled: true, url: 'https://misp.example', api_key: 'misp-key' },
          otx: { enabled: false, api_key: '' }
        })
      })
    );
    expect(mockSystemConfig.upsert).toHaveBeenCalledWith(expect.objectContaining({
      key: 'threat_intelligence_config',
      value: expect.objectContaining({ misp: expect.objectContaining({ apiKey: 'encrypted:misp-key' }) })
    }));
  });

  test('AI engine rejection prevents configuration persistence', async () => {
    mockSystemConfig.findOne.mockResolvedValue(null);
    fetch.mockResolvedValue({ ok: false, status: 503, text: jest.fn().mockResolvedValue('not ready') });

    await expect(service.save({ otx: { enabled: true, apiKey: 'otx-key' } }))
      .rejects.toThrow('AI引擎拒绝威胁情报配置');
    expect(mockSystemConfig.upsert).not.toHaveBeenCalled();
  });

  test('persisted configuration is replayed to the AI engine on startup', async () => {
    mockSystemConfig.findOne.mockResolvedValue({
      value: {
        misp: { enabled: false, url: '', apiKey: null },
        otx: { enabled: true, apiKey: 'encrypted:otx-key' }
      }
    });

    await expect(service.restoreRuntimeConfig()).resolves.toBe(true);

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:8888/api/threat-intelligence/config',
      expect.objectContaining({
        body: JSON.stringify({
          misp: { enabled: false, url: '', api_key: '' },
          otx: { enabled: true, api_key: 'otx-key' }
        })
      })
    );
  });
});
