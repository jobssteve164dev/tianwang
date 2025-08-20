const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const SecurityEvent = sequelize.define('SecurityEvent', {
    id: { 
      type: DataTypes.UUID, 
      defaultValue: DataTypes.UUIDV4, 
      primaryKey: true 
    },
    event_type: { 
      type: DataTypes.STRING(50), 
      allowNull: false 
    },
    severity: { 
      type: DataTypes.ENUM('low', 'medium', 'high', 'critical'), 
      allowNull: false 
    },
    title: { 
      type: DataTypes.STRING(255), 
      allowNull: false 
    },
    description: { 
      type: DataTypes.TEXT 
    },
    raw_data: { 
      type: DataTypes.JSONB 
    },
    status: { 
      type: DataTypes.ENUM('open', 'investigating', 'resolved', 'false_positive'), 
      defaultValue: 'open' 
    },
    device_id: { 
      type: DataTypes.UUID, 
      references: { model: 'devices', key: 'id' } 
    },
    agent_id: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: '代理ID，用于快速查询'
    },
    source_ip: {
      type: DataTypes.INET,
      allowNull: true,
      comment: '源IP地址'
    },
    target_ip: {
      type: DataTypes.INET,
      allowNull: true,
      comment: '目标IP地址'
    },
    source_port: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: '源端口'
    },
    target_port: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: '目标端口'
    },
    threat_score: {
      type: DataTypes.FLOAT,
      allowNull: true,
      comment: '威胁评分（0-100）'
    },
    confidence_score: {
      type: DataTypes.FLOAT,
      allowNull: true,
      comment: '置信度评分（0-100）'
    },
    tags: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: '事件标签，用于分类和搜索'
    },
    investigation_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: '调查笔记'
    },
    resolved_by: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      comment: '解决此事件的用户'
    },
    resolved_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: '事件解决时间'
    },
    created_by: { 
      type: DataTypes.UUID, 
      references: { model: 'users', key: 'id' } 
    },
    organization_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'organizations', key: 'id' }
    },
    created_at: { 
      type: DataTypes.DATE, 
      defaultValue: DataTypes.NOW 
    },
    updated_at: { 
      type: DataTypes.DATE, 
      defaultValue: DataTypes.NOW 
    }
  }, { 
    tableName: 'security_events',
    indexes: [
      // 复合索引：按设备ID和时间范围查询（最常用）
      {
        name: 'idx_security_events_device_time',
        fields: ['device_id', 'created_at']
      },
      // 复合索引：按代理ID和时间查询
      {
        name: 'idx_security_events_agent_time',
        fields: ['agent_id', 'created_at']
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
      // 复合索引：按组织和时间查询
      {
        name: 'idx_security_events_org_time',
        fields: ['organization_id', 'created_at']
      },
      // 复合索引：按威胁评分查询
      {
        name: 'idx_security_events_threat_score',
        fields: ['threat_score', 'created_at']
      },
      // 复合索引：按源IP查询
      {
        name: 'idx_security_events_source_ip',
        fields: ['source_ip', 'created_at']
      },
      // 复合索引：按目标IP查询
      {
        name: 'idx_security_events_target_ip',
        fields: ['target_ip', 'created_at']
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
      },
      // 解决者查询索引
      {
        name: 'idx_security_events_resolved_by',
        fields: ['resolved_by']
      }
    ]
  });

  SecurityEvent.associate = (models) => {
    SecurityEvent.belongsTo(models.Device, { 
      foreignKey: 'device_id', 
      as: 'device' 
    });
    SecurityEvent.belongsTo(models.User, { 
      foreignKey: 'created_by', 
      as: 'creator' 
    });
    SecurityEvent.belongsTo(models.User, { 
      foreignKey: 'resolved_by', 
      as: 'resolver' 
    });
    SecurityEvent.belongsTo(models.Organization, { 
      foreignKey: 'organization_id', 
      as: 'organization' 
    });
  };

  return SecurityEvent;
}; 