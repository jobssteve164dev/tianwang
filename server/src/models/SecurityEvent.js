const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const SecurityEvent = sequelize.define('SecurityEvent', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    event_type: { type: DataTypes.STRING(50), allowNull: false },
    severity: { type: DataTypes.ENUM('low', 'medium', 'high', 'critical'), allowNull: false },
    title: { type: DataTypes.STRING(255), allowNull: false },
    description: { type: DataTypes.TEXT },
    raw_data: { type: DataTypes.JSONB },
    status: { type: DataTypes.ENUM('open', 'investigating', 'resolved', 'false_positive'), defaultValue: 'open' },
    device_id: { type: DataTypes.UUID, references: { model: 'devices', key: 'id' } },
    created_by: { type: DataTypes.UUID, references: { model: 'users', key: 'id' } }
  }, { tableName: 'security_events' });

  SecurityEvent.associate = (models) => {
    SecurityEvent.belongsTo(models.Device, { foreignKey: 'device_id', as: 'device' });
    SecurityEvent.belongsTo(models.User, { foreignKey: 'created_by', as: 'creator' });
  };

  return SecurityEvent;
}; 