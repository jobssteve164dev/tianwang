/**
 * CacheService 单元测试
 * CacheService Unit Tests
 */

const cacheService = require('../../src/services/CacheService');

const mockDatabase = { authenticate: jest.fn(), query: jest.fn() };
jest.mock('../../src/config/database', () => ({ getSequelize: () => mockDatabase }));
jest.mock('../../src/utils/logger', () => ({ warn: jest.fn() }));

beforeEach(() => { jest.clearAllMocks(); cacheService.resetStats(); });

test('a database error cannot be reported as a successful cache write', async () => {
  mockDatabase.query.mockRejectedValue(new Error('database unavailable'));
  await expect(cacheService.set('key', { value: 1 })).rejects.toThrow('database unavailable');
  expect(cacheService.getStats().sets).toBe(0);
});

test('a cache miss invokes its real data source once and preserves its failure', async () => {
  mockDatabase.query.mockResolvedValue([[]]);
  const source = jest.fn().mockRejectedValue(new Error('source unavailable'));
  await expect(cacheService.get('key', source)).rejects.toThrow('source unavailable');
  expect(source).toHaveBeenCalledTimes(1);
});

test('cached false values are hits and never invoke the data source', async () => {
  mockDatabase.query.mockResolvedValue([[{ value: false }]]);
  const source = jest.fn();
  await expect(cacheService.get('key', source)).resolves.toBe(false);
  expect(source).not.toHaveBeenCalled();
});

test('invalid expiry cannot produce a silently immortal cache entry', async () => {
  for (const ttl of [0, -1, NaN, Infinity]) await expect(cacheService.set('key', 1, ttl)).rejects.toThrow();
  expect(mockDatabase.query).not.toHaveBeenCalled();
});
