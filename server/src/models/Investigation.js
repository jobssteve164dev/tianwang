const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('Investigation', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  case_id: {
    type: DataTypes.UUID,
    allowNull: false
  },
  node_id: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  source: {
    type: DataTypes.STRING(30),
    allowNull: false,
    defaultValue: 'mcp'
  },
  requested_by: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  authorization_grant_id: DataTypes.STRING(255),
  organization_id: DataTypes.UUID,
  request_scope: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {}
  },
  status: {
    type: DataTypes.STRING(30),
    allowNull: false,
    defaultValue: 'requested'
  },
  task_id: DataTypes.UUID,
  evidence_manifest: DataTypes.JSONB,
  result: DataTypes.JSONB,
  started_at: DataTypes.DATE,
  deadline_at: DataTypes.DATE,
  finished_at: DataTypes.DATE,
  expires_at: DataTypes.DATE,
  error_code: DataTypes.STRING(100),
  error_message: DataTypes.TEXT
}, {
  tableName: 'investigations',
  underscored: true,
  indexes: [
    { fields: ['node_id', 'created_at'] },
    { fields: ['case_id'] },
    { fields: ['organization_id', 'created_at'] },
    { fields: ['status'] }
  ]
});
