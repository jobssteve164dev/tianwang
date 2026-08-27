const fetch = require('node-fetch');

const mockSystemConfigModel = {
  findOne: jest.fn(),
  findOrCreate: jest.fn()
};

jest.mock('node-fetch', () => jest.fn());
jest.mock('../../src/models', () => ({
  get SystemConfig() {
    return mockSystemConfigModel;
  }
}));
jest.mock('../../src/utils/encryption', () => ({
  encrypt: jest.fn(value => `encrypted:${value}`),
  decrypt: jest.fn(value => value.replace(/^encrypted:/, ''))
}));
jest.mock('../../src/utils/logger', () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn()
}));

const controller = require('../../src/controllers/aiModelController');

function responseRecorder() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };
}

describe('AIModelController provider configuration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('route handlers retain their controller context', async () => {
    mockSystemConfigModel.findOne.mockResolvedValue(null);
    const res = responseRecorder();

    const handler = controller.getConfig;
    await handler({}, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.config.openai).toMatchObject({ api_key: '', has_api_key: false });
  });

  test('stored secrets are masked but their presence is exposed', async () => {
    mockSystemConfigModel.findOne.mockResolvedValue({
      value: {
        openai: { enabled: true, api_key: 'encrypted:secret-key' }
      }
    });
    const res = responseRecorder();

    await controller.getConfig({}, res);

    expect(res.body.config.openai).toMatchObject({
      enabled: true,
      api_key: '',
      has_api_key: true
    });
  });

  test('database failures are not reported as a successful default configuration', async () => {
    mockSystemConfigModel.findOne.mockRejectedValue(new Error('database unavailable'));
    const res = responseRecorder();

    await controller.getConfig({}, res);

    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({ success: false, message: '获取配置失败' });
  });

  test('blank incoming secrets preserve existing provider keys without mutating the inputs', () => {
    const existing = { openai: { enabled: true, api_key: 'stored-key' } };
    const incoming = {
      openai: { enabled: false, api_key: '' },
      claude: { enabled: true, api_key: 'new-key' }
    };

    const merged = controller.mergeProviderConfig(incoming, existing);
    const encrypted = controller.encryptApiKeys(merged);

    expect(merged.openai.api_key).toBe('stored-key');
    expect(merged.claude.api_key).toBe('new-key');
    expect(encrypted.openai.api_key).toBe('encrypted:stored-key');
    expect(merged.openai.api_key).toBe('stored-key');
    expect(incoming.claude.api_key).toBe('new-key');
  });

  test('configuration is synchronized to the running AI engine before success is returned', async () => {
    mockSystemConfigModel.findOne.mockResolvedValue(null);
    mockSystemConfigModel.findOrCreate.mockResolvedValue([{}, true]);
    fetch.mockResolvedValue({ ok: true });
    const res = responseRecorder();

    await controller.updateConfig({
      body: { config: { openai: { enabled: true, api_key: 'secret-key' } } }
    }, res);

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:8888/api/external-apis/config',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ providers: { openai: { enabled: true, api_key: 'secret-key' } } })
      })
    );
    expect(mockSystemConfigModel.findOrCreate).toHaveBeenCalledWith(expect.objectContaining({
      defaults: expect.objectContaining({
        value: { openai: { enabled: true, api_key: 'encrypted:secret-key' } }
      })
    }));
    expect(res.body).toEqual({ success: true, message: '配置更新成功' });
  });

  test('AI engine rejection prevents persistent configuration from being written', async () => {
    mockSystemConfigModel.findOne.mockResolvedValue(null);
    fetch.mockResolvedValue({
      ok: false,
      status: 503,
      text: jest.fn().mockResolvedValue('not ready')
    });
    const res = responseRecorder();

    await controller.updateConfig({
      body: { config: { openai: { enabled: true, api_key: 'secret-key' } } }
    }, res);

    expect(mockSystemConfigModel.findOrCreate).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ success: false, message: '更新配置失败' });
  });

  test('persisted provider configuration is replayed after an AI engine restart', async () => {
    mockSystemConfigModel.findOne.mockResolvedValue({
      value: { openai: { enabled: true, api_key: 'encrypted:stored-key' } }
    });
    fetch.mockResolvedValue({ ok: true });

    await expect(controller.restoreRuntimeConfig()).resolves.toBe(true);

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:8888/api/external-apis/config',
      expect.objectContaining({
        body: JSON.stringify({ providers: { openai: { enabled: true, api_key: 'stored-key' } } })
      })
    );
  });
});
