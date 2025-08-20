/**
 * 用户会话模型
 * User Session Model - 支持会话管理和审计
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const UserSession = sequelize.define('UserSession', {
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
    session_token: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true
    },
    refresh_token: {
      type: DataTypes.STRING(255),
      allowNull: true,
      unique: true
    },
    ip_address: {
      type: DataTypes.INET,
      allowNull: true
    },
    user_agent: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    device_info: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: '设备信息，如浏览器、操作系统等'
    },
    location_info: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: '地理位置信息'
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    last_activity_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: false
    },
    login_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    logout_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    logout_reason: {
      type: DataTypes.ENUM('user_logout', 'session_expired', 'security_violation', 'admin_terminated'),
      allowNull: true
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
    tableName: 'user_sessions',
    indexes: [
      // 会话令牌查询索引
      {
        name: 'idx_user_sessions_token',
        fields: ['session_token'],
        unique: true
      },
      // 刷新令牌查询索引
      {
        name: 'idx_user_sessions_refresh_token',
        fields: ['refresh_token'],
        unique: true
      },
      // 用户会话查询索引
      {
        name: 'idx_user_sessions_user_active',
        fields: ['user_id', 'is_active']
      },
      // 过期会话清理索引
      {
        name: 'idx_user_sessions_expires_at',
        fields: ['expires_at']
      },
      // 最后活动时间索引
      {
        name: 'idx_user_sessions_last_activity',
        fields: ['last_activity_at']
      },
      // IP地址索引（用于安全分析）
      {
        name: 'idx_user_sessions_ip_address',
        fields: ['ip_address']
      }
    ]
  });

  UserSession.associate = (models) => {
    UserSession.belongsTo(models.User, { 
      foreignKey: 'user_id', 
      as: 'user',
      onDelete: 'CASCADE'
    });
  };

  return UserSession;
};

