const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('ResponsePlan', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  version: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1
  },
  case_id: {
    type: DataTypes.UUID,
    allowNull: false
  },
  node_id: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  finding_ref: {
    type: DataTypes.UUID,
    allowNull: false
  },
  evidence_refs: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: []
  },
  idempotency_key: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  actions: {
    type: DataTypes.JSONB,
    allowNull: false
  },
  verification: {
    type: DataTypes.JSONB,
    allowNull: false
  },
  rollback: {
    type: DataTypes.JSONB,
    allowNull: false
  },
  validation: DataTypes.JSONB,
  execution: DataTypes.JSONB,
  status: {
    type: DataTypes.STRING(40),
    allowNull: false,
    defaultValue: 'validated'
  },
  submitted_by: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  organization_id: DataTypes.UUID,
  executed_at: DataTypes.DATE,
  expires_at: DataTypes.DATE,
  rolled_back_at: DataTypes.DATE
}, {
  tableName: 'response_plans',
  underscored: true,
  indexes: [
    { unique: true, fields: ['organization_id', 'idempotency_key'] },
    { fields: ['case_id'] },
    { fields: ['node_id', 'created_at'] },
    { fields: ['status'] }
  ]
});
