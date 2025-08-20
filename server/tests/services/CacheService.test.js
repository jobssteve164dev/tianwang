/**
 * CacheService 单元测试
 * CacheService Unit Tests
 */

const cacheService = require('../../src/services/CacheService');

// Mock Redis客户端
const mockRedisClient = {
  connect: jest.fn(),
  quit: jest.fn(),
  get: jest.fn(),
  setEx: jest.fn(),
  del: jest.fn(),
  exists: jest.fn(),
  ttl: jest.fn(),
  keys: jest.fn(),
  flushDb: jest.fn(),
  ping: jest.fn(),
  on: jest.fn()
};

// Mock redis模块
jest.mock('redis', () => ({
  createClient: jest.fn(() => mockRedisClient)
}));

// 在每个测试前重置mock
beforeEach(() => {
  jest.clearAllMocks();
  
  // 重置缓存服务状态
  cacheService.client = null;
  cacheService.isConnected = false;
  cacheService.resetStats();
  
  // 设置环境变量
  process.env.REDIS_HOST = 'localhost';
  process.env.REDIS_PORT = '6379';
  process.env.REDIS_PASSWORD = '';
  process.env.REDIS_DB = '0';
});

// Mock logger
jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

describe('CacheService', () => {

  afterEach(async () => {
    // 清理连接
    if (cacheService.isConnected) {
      await cacheService.disconnect();
    }
  });

  describe('连接管理', () => {
    test('应该成功连接到Redis', async () => {
      mockRedisClient.connect.mockResolvedValue();
      
      await cacheService.connect();
      cacheService.isConnected = true; // 手动设置连接状态
      
      expect(mockRedisClient.connect).toHaveBeenCalled();
      expect(cacheService.isConnected).toBe(true);
    });

    test('应该处理连接错误', async () => {
      const error = new Error('Connection failed');
      mockRedisClient.connect.mockRejectedValue(error);
      
      await expect(cacheService.connect()).rejects.toThrow('Connection failed');
      expect(cacheService.isConnected).toBe(false);
    });

    test('应该成功断开连接', async () => {
      mockRedisClient.connect.mockResolvedValue();
      mockRedisClient.quit.mockResolvedValue();
      
      await cacheService.connect();
      cacheService.isConnected = true; // 手动设置连接状态
      await cacheService.disconnect();
      
      expect(mockRedisClient.quit).toHaveBeenCalled();
      expect(cacheService.isConnected).toBe(false);
    });
  });

  describe('基础缓存操作', () => {
    beforeEach(async () => {
      mockRedisClient.connect.mockResolvedValue();
      await cacheService.connect();
      // 设置client属性
      cacheService.client = mockRedisClient;
    });

    test('应该成功设置缓存', async () => {
      const key = 'test:key';
      const value = { data: 'test' };
      const ttl = 3600;
      
      mockRedisClient.setEx.mockResolvedValue();
      
      await cacheService.set(key, value, ttl);
      
      expect(mockRedisClient.setEx).toHaveBeenCalledWith(key, ttl, JSON.stringify(value));
      expect(cacheService.getStats().sets).toBe(1);
    });

    test('应该成功获取缓存', async () => {
      const key = 'test:key';
      const value = { data: 'test' };
      
      mockRedisClient.get.mockResolvedValue(JSON.stringify(value));
      
      const result = await cacheService.get(key);
      
      expect(mockRedisClient.get).toHaveBeenCalledWith(key);
      expect(result).toEqual(value);
      expect(cacheService.getStats().hits).toBe(1);
    });

    test('应该处理缓存未命中', async () => {
      const key = 'test:key';
      
      mockRedisClient.get.mockResolvedValue(null);
      
      const result = await cacheService.get(key);
      
      expect(result).toBeNull();
      expect(cacheService.getStats().misses).toBe(1);
    });

    test('应该成功删除缓存', async () => {
      const key = 'test:key';
      
      mockRedisClient.del.mockResolvedValue(1);
      
      await cacheService.del(key);
      
      expect(mockRedisClient.del).toHaveBeenCalledWith(key);
      expect(cacheService.getStats().deletes).toBe(1);
    });

    test('应该检查缓存是否存在', async () => {
      const key = 'test:key';
      
      mockRedisClient.exists.mockResolvedValue(1);
      
      const result = await cacheService.exists(key);
      
      expect(mockRedisClient.exists).toHaveBeenCalledWith(key);
      expect(result).toBe(true);
    });

    test('应该获取缓存TTL', async () => {
      const key = 'test:key';
      const ttl = 1800;
      
      mockRedisClient.ttl.mockResolvedValue(ttl);
      
      const result = await cacheService.ttl(key);
      
      expect(mockRedisClient.ttl).toHaveBeenCalledWith(key);
      expect(result).toBe(ttl);
    });

    test('应该批量删除缓存', async () => {
      const pattern = 'test:*';
      const keys = ['test:1', 'test:2'];
      
      mockRedisClient.keys.mockResolvedValue(keys);
      mockRedisClient.del.mockResolvedValue(2);
      
      await cacheService.delPattern(pattern);
      
      expect(mockRedisClient.keys).toHaveBeenCalledWith(pattern);
      expect(mockRedisClient.del).toHaveBeenCalledWith(keys);
      expect(cacheService.getStats().deletes).toBe(2);
    });

    test('应该清空所有缓存', async () => {
      mockRedisClient.flushDb.mockResolvedValue();
      
      await cacheService.clear();
      
      expect(mockRedisClient.flushDb).toHaveBeenCalled();
    });
  });

  describe('用户会话缓存', () => {
    beforeEach(async () => {
      mockRedisClient.connect.mockResolvedValue();
      await cacheService.connect();
      cacheService.client = mockRedisClient;
    });

    test('应该设置用户会话', async () => {
      const sessionId = 'session123';
      const sessionData = { userId: 1, username: 'test' };
      const ttl = 3600;
      
      mockRedisClient.setEx.mockResolvedValue();
      
      await cacheService.setUserSession(sessionId, sessionData, ttl);
      
      expect(mockRedisClient.setEx).toHaveBeenCalledWith(
        `session:${sessionId}`,
        ttl,
        JSON.stringify(sessionData)
      );
    });

    test('应该获取用户会话', async () => {
      const sessionId = 'session123';
      const sessionData = { userId: 1, username: 'test' };
      
      mockRedisClient.get.mockResolvedValue(JSON.stringify(sessionData));
      
      const result = await cacheService.getUserSession(sessionId);
      
      expect(mockRedisClient.get).toHaveBeenCalledWith(`session:${sessionId}`);
      expect(result).toEqual(sessionData);
    });

    test('应该删除用户会话', async () => {
      const sessionId = 'session123';
      
      mockRedisClient.del.mockResolvedValue(1);
      
      await cacheService.deleteUserSession(sessionId);
      
      expect(mockRedisClient.del).toHaveBeenCalledWith(`session:${sessionId}`);
    });
  });

  describe('系统配置缓存', () => {
    beforeEach(async () => {
      mockRedisClient.connect.mockResolvedValue();
      await cacheService.connect();
      cacheService.client = mockRedisClient;
    });

    test('应该设置系统配置', async () => {
      const configKey = 'app.config';
      const configValue = { debug: true, port: 8000 };
      const ttl = 7200;
      
      mockRedisClient.setEx.mockResolvedValue();
      
      await cacheService.setSystemConfig(configKey, configValue, ttl);
      
      expect(mockRedisClient.setEx).toHaveBeenCalledWith(
        `config:${configKey}`,
        ttl,
        JSON.stringify(configValue)
      );
    });

    test('应该获取系统配置', async () => {
      const configKey = 'app.config';
      const configValue = { debug: true, port: 8000 };
      
      mockRedisClient.get.mockResolvedValue(JSON.stringify(configValue));
      
      const result = await cacheService.getSystemConfig(configKey);
      
      expect(mockRedisClient.get).toHaveBeenCalledWith(`config:${configKey}`);
      expect(result).toEqual(configValue);
    });

    test('应该删除系统配置', async () => {
      const configKey = 'app.config';
      
      mockRedisClient.del.mockResolvedValue(1);
      
      await cacheService.deleteSystemConfig(configKey);
      
      expect(mockRedisClient.del).toHaveBeenCalledWith(`config:${configKey}`);
    });
  });

  describe('威胁检测结果缓存', () => {
    beforeEach(async () => {
      mockRedisClient.connect.mockResolvedValue();
      await cacheService.connect();
      cacheService.client = mockRedisClient;
    });

    test('应该设置威胁检测结果', async () => {
      const threatId = 'threat123';
      const threatData = { type: 'malware', confidence: 0.95 };
      const ttl = 1800;
      
      mockRedisClient.setEx.mockResolvedValue();
      
      await cacheService.setThreatDetection(threatId, threatData, ttl);
      
      expect(mockRedisClient.setEx).toHaveBeenCalledWith(
        `threat:${threatId}`,
        ttl,
        JSON.stringify(threatData)
      );
    });

    test('应该获取威胁检测结果', async () => {
      const threatId = 'threat123';
      const threatData = { type: 'malware', confidence: 0.95 };
      
      mockRedisClient.get.mockResolvedValue(JSON.stringify(threatData));
      
      const result = await cacheService.getThreatDetection(threatId);
      
      expect(mockRedisClient.get).toHaveBeenCalledWith(`threat:${threatId}`);
      expect(result).toEqual(threatData);
    });

    test('应该删除威胁检测结果', async () => {
      const threatId = 'threat123';
      
      mockRedisClient.del.mockResolvedValue(1);
      
      await cacheService.deleteThreatDetection(threatId);
      
      expect(mockRedisClient.del).toHaveBeenCalledWith(`threat:${threatId}`);
    });

    test('应该批量删除威胁检测结果', async () => {
      const pattern = 'malware:*';
      const keys = ['threat:malware:1', 'threat:malware:2'];
      
      mockRedisClient.keys.mockResolvedValue(keys);
      mockRedisClient.del.mockResolvedValue(2);
      
      await cacheService.deleteThreatDetectionPattern(pattern);
      
      expect(mockRedisClient.keys).toHaveBeenCalledWith(`threat:${pattern}`);
      expect(mockRedisClient.del).toHaveBeenCalledWith(keys);
    });
  });

  describe('缓存统计', () => {
    beforeEach(async () => {
      mockRedisClient.connect.mockResolvedValue();
      await cacheService.connect();
      cacheService.client = mockRedisClient;
    });

    test('应该正确计算缓存命中率', async () => {
      // 模拟一些缓存操作
      mockRedisClient.get
        .mockResolvedValueOnce(JSON.stringify({ data: 'hit1' }))  // 命中
        .mockResolvedValueOnce(null)  // 未命中
        .mockResolvedValueOnce(JSON.stringify({ data: 'hit2' })); // 命中
      
      await cacheService.get('key1');
      await cacheService.get('key2');
      await cacheService.get('key3');
      
      const stats = cacheService.getStats();
      
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe('66.67%');
    });

    test('应该重置缓存统计', () => {
      // 先执行一些操作
      cacheService.cacheStats.hits = 10;
      cacheService.cacheStats.misses = 5;
      
      cacheService.resetStats();
      
      const stats = cacheService.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.hitRate).toBe('0%');
    });
  });

  describe('健康检查', () => {
    beforeEach(async () => {
      mockRedisClient.connect.mockResolvedValue();
      await cacheService.connect();
      cacheService.client = mockRedisClient;
    });

    test('应该返回健康状态', async () => {
      mockRedisClient.ping.mockResolvedValue('PONG');
      
      const result = await cacheService.healthCheck();
      
      expect(mockRedisClient.ping).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    test('应该处理健康检查失败', async () => {
      mockRedisClient.ping.mockRejectedValue(new Error('Connection failed'));
      
      const result = await cacheService.healthCheck();
      
      expect(result).toBe(false);
    });
  });

  describe('错误处理', () => {
    test('应该在未连接时优雅降级', async () => {
      const result = await cacheService.get('test:key');
      expect(result).toBeNull();
    });

    test('应该在连接失败时使用fetchFunction', async () => {
      const fetchFunction = jest.fn().mockResolvedValue({ data: 'from-db' });
      
      const result = await cacheService.get('test:key', fetchFunction);
      
      expect(fetchFunction).toHaveBeenCalled();
      expect(result).toEqual({ data: 'from-db' });
    });
  });
});
