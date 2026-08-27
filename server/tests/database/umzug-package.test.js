describe('database migration package contract', () => {
  test('provides the Umzug v3 runner and Sequelize storage adapter', () => {
    const { Umzug, SequelizeStorage } = require('umzug');

    expect(typeof Umzug).toBe('function');
    expect(typeof SequelizeStorage).toBe('function');
  });
});
