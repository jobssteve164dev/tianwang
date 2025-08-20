/**
 * 用户权限模型
 * User Permission Model - 支持细粒度权限控制
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const UserPermission = sequelize.define('UserPermission', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    resource_type: {
      type: DataTypes.ENUM(
        'dashboard', 'devices', 'agents', 'alerts', 'reports', 
        'users', 'organizations', 'system_config', 'threat_rules',
        'security_events', 'ai_models', 'logs', 'analytics'
      ),
      allowNull: false
    },
    resource_id: {
      type: DataTypes.UUID,
      allowNull: true, // null表示所有资源
      comment: '特定资源ID，null表示所有资源'
    },
    action: {
      type: DataTypes.ENUM('create', 'read', 'update', 'delete', 'execute'),
      allowNull: false
    },
    granted: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    conditions: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: '权限条件，如时间限制、IP限制等'
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: '权限过期时间'
    },
    created_by: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
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
    tableName: 'user_permissions',
    indexes: [
      // 用户权限查询索引
      {
        name: 'idx_user_permissions_user_resource',
        fields: ['user_id', 'resource_type', 'resource_id']
      },
      // 权限验证索引
      {
        name: 'idx_user_permissions_user_action',
        fields: ['user_id', 'action', 'granted']
      },
      // 过期权限清理索引
      {
        name: 'idx_user_permissions_expires_at',
        fields: ['expires_at']
      },
      // 创建者索引
      {
        name: 'idx_user_permissions_created_by',
        fields: ['created_by']
      }
    ]
  });

  UserPermission.associate = (models) => {
    UserPermission.belongsTo(models.User, { 
      foreignKey: 'user_id', 
      as: 'user',
      onDelete: 'CASCADE'
    });
    
    UserPermission.belongsTo(models.User, { 
      foreignKey: 'created_by', 
      as: 'creator'
    });
  };

  return UserPermission;
};

