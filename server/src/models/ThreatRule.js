const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ThreatRule = sequelize.define('ThreatRule', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: { type: DataTypes.STRING(100), allowNull: false },
    rule_type: { type: DataTypes.ENUM('sigma', 'yara', 'suricata', 'custom'), allowNull: false },
    content: { type: DataTypes.TEXT, allowNull: false },
    enabled: { type: DataTypes.BOOLEAN, defaultValue: true },
    severity: { type: DataTypes.ENUM('low', 'medium', 'high', 'critical'), allowNull: false },
    tags: { type: DataTypes.ARRAY(DataTypes.STRING), defaultValue: [] },
    metadata: { type: DataTypes.JSONB, defaultValue: {} }
  }, { tableName: 'threat_rules' });

  return ThreatRule;
}; 