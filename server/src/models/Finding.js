const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('Finding', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  case_id: {
    type: DataTypes.UUID,
    allowNull: false
  },
  investigation_id: {
    type: DataTypes.UUID,
    allowNull: false
  },
  node_id: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  classification: {
    type: DataTypes.STRING(40),
    allowNull: false
  },
  confidence: {
    type: DataTypes.FLOAT,
    allowNull: false
  },
  evidence_refs: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: []
  },
  observations: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: []
  },
  limitations: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: []
  },
  submitted_by: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  organization_id: DataTypes.UUID
}, {
  tableName: 'findings',
  underscored: true,
  indexes: [
    { fields: ['case_id'] },
    { fields: ['investigation_id'] },
    { fields: ['node_id', 'created_at'] }
  ]
});
