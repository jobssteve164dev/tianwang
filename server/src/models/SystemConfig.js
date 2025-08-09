const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const SystemConfig = sequelize.define('SystemConfig', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    key: { type: DataTypes.STRING(100), allowNull: false, unique: true },
    value: { type: DataTypes.JSONB, allowNull: false },
    category: { type: DataTypes.STRING(50), allowNull: false },
    description: { type: DataTypes.TEXT }
  }, { tableName: 'system_configs' });

  return SystemConfig;
}; 