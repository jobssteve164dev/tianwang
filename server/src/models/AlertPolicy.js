const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const AlertPolicy = sequelize.define('AlertPolicy', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: { type: DataTypes.STRING(100), allowNull: false },
    conditions: { type: DataTypes.JSONB, allowNull: false },
    actions: { type: DataTypes.JSONB, allowNull: false },
    enabled: { type: DataTypes.BOOLEAN, defaultValue: true },
    created_by: { type: DataTypes.UUID, references: { model: 'users', key: 'id' } }
  }, { tableName: 'alert_policies' });

  AlertPolicy.associate = (models) => {
    AlertPolicy.belongsTo(models.User, { foreignKey: 'created_by', as: 'creator' });
  };

  return AlertPolicy;
}; 