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
    created_by: { type: DataTypes.UUID, references: { model: 'users', key: 'id' } },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
  }, { 
    tableName: 'security_events',
    indexes: [
      // 复合索引：按设备ID和时间范围查询（最常用）
      {
        name: 'idx_security_events_device_time',
        fields: ['device_id', 'created_at']
      },
      // 复合索引：按严重程度和状态查询
      {
        name: 'idx_security_events_severity_status',
        fields: ['severity', 'status']
      },
      // 复合索引：按事件类型和时间查询
      {
        name: 'idx_security_events_type_time',
        fields: ['event_type', 'created_at']
      },
      // 单列索引：状态查询
      {
        name: 'idx_security_events_status',
        fields: ['status']
      },
      // 单列索引：严重程度查询
      {
        name: 'idx_security_events_severity',
        fields: ['severity']
      },
      // 单列索引：事件类型查询
      {
        name: 'idx_security_events_type',
        fields: ['event_type']
      },
      // 时间范围查询索引
      {
        name: 'idx_security_events_created_at',
        fields: ['created_at']
      }
    ]
  });

  SecurityEvent.associate = (models) => {
    SecurityEvent.belongsTo(models.Device, { foreignKey: 'device_id', as: 'device' });
    SecurityEvent.belongsTo(models.User, { foreignKey: 'created_by', as: 'creator' });
  };

  return SecurityEvent;
}; 