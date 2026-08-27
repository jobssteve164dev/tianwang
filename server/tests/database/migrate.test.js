const mockPending = jest.fn();
const mockUp = jest.fn();
const mockSync = jest.fn();
const mockClose = jest.fn();
const mockGetQueryInterface = jest.fn(() => ({}));
const mockInitializeModels = jest.fn();

const mockSequelize = {
  constructor: function Sequelize() {},
  getQueryInterface: mockGetQueryInterface,
  sync: mockSync,
  close: mockClose
};

jest.mock('../../src/config/database', () => ({
  initializePostgreSQL: jest.fn(() => mockSequelize)
}));

jest.mock('../../src/models', () => ({
  initializeModels: (...args) => mockInitializeModels(...args)
}));

jest.mock('umzug', () => ({
  Umzug: jest.fn(() => ({ pending: mockPending, up: mockUp })),
  SequelizeStorage: jest.fn()
}));

jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn()
}));

const { runMigrations } = require('../../src/database/migrate');

describe('database migration runner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPending.mockResolvedValue([]);
    mockUp.mockResolvedValue([]);
    mockSync.mockResolvedValue(undefined);
    mockClose.mockResolvedValue(undefined);
    mockInitializeModels.mockReturnValue({ models: { User: {} } });
  });

  test('initializes and synchronizes the complete model schema when migrations are current', async () => {
    await runMigrations();

    expect(mockPending).toHaveBeenCalledTimes(1);
    expect(mockUp).not.toHaveBeenCalled();
    expect(mockInitializeModels).toHaveBeenCalledTimes(1);
    expect(mockSync).toHaveBeenCalledTimes(1);
    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  test('applies pending migrations before synchronizing models', async () => {
    mockPending.mockResolvedValue([{ name: '001-example.js' }]);

    await runMigrations();

    expect(mockUp).toHaveBeenCalledTimes(1);
    expect(mockUp.mock.invocationCallOrder[0]).toBeLessThan(mockSync.mock.invocationCallOrder[0]);
  });

  test('fails and closes the connection when models cannot initialize', async () => {
    mockInitializeModels.mockReturnValue({ models: null });

    await expect(runMigrations()).rejects.toThrow('Database models failed to initialize');
    expect(mockSync).not.toHaveBeenCalled();
    expect(mockClose).toHaveBeenCalledTimes(1);
  });
});
