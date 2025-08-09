const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Agent = sequelize.define('Agent', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: { type: DataTypes.STRING(100), allowNull: false },
    version: { type: DataTypes.STRING(20), allowNull: false },
    status: { type: DataTypes.ENUM('running', 'stopped', 'error'), defaultValue: 'stopped' },
    last_heartbeat: { type: DataTypes.DATE },
    configuration: { type: DataTypes.JSONB, defaultValue: {} },
    device_id: { type: DataTypes.UUID, references: { model: 'devices', key: 'id' } }
  }, { tableName: 'agents' });

  Agent.associate = (models) => {
    Agent.belongsTo(models.Device, { foreignKey: 'device_id', as: 'device' });
  };

  return Agent;
}; 