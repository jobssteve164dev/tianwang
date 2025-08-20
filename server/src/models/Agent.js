const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Agent = sequelize.define('Agent', {
    id: { 
      type: DataTypes.UUID, 
      defaultValue: DataTypes.UUIDV4, 
      primaryKey: true 
    },
    agent_id: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: '代理唯一标识符'
    },
    name: { 
      type: DataTypes.STRING(100), 
      allowNull: false,
      comment: '代理名称'
    },
    hostname: {
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: '主机名'
    },
    platform: {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: '操作系统平台'
    },
    arch: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: '系统架构'
    },
    version: { 
      type: DataTypes.STRING(20), 
      allowNull: false,
      defaultValue: '1.0.0',
      comment: '代理版本'
    },
    status: { 
      type: DataTypes.STRING(20), 
      allowNull: false,
      defaultValue: 'offline',
      validate: {
        isIn: [['online', 'offline', 'error']]
      },
      comment: '代理状态'
    },
    capabilities: {
      type: DataTypes.JSONB,
      defaultValue: [],
      comment: '代理能力列表'
    },
    system_info: {
      type: DataTypes.JSONB,
      defaultValue: {},
      comment: '系统信息'
    },
    device_fingerprint: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: '设备指纹'
    },
    last_seen: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: '最后在线时间'
    },
    registered_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      comment: '注册时间'
    },
    organization_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'organizations', key: 'id' },
      comment: '所属组织ID'
    },
    last_heartbeat: { 
      type: DataTypes.DATE,
      allowNull: true,
      comment: '最后心跳时间'
    },
    configuration: { 
      type: DataTypes.JSONB, 
      defaultValue: {},
      comment: '代理配置'
    },
    device_id: { 
      type: DataTypes.UUID, 
      references: { model: 'devices', key: 'id' },
      allowNull: true,
      comment: '关联设备ID'
    }
  }, { 
    tableName: 'agents',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        unique: true,
        fields: ['agent_id']
      },
      {
        fields: ['organization_id']
      },
      {
        fields: ['device_id']
      },
      {
        fields: ['status']
      },
      {
        fields: ['last_seen']
      }
    ]
  });

  Agent.associate = (models) => {
    Agent.belongsTo(models.Device, { foreignKey: 'device_id', as: 'device' });
    Agent.belongsTo(models.Organization, { foreignKey: 'organization_id', as: 'organization' });
  };

  return Agent;
}; 