/**
 * 审计日志模型
 * Audit Log Model - 支持用户操作审计和合规要求
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const AuditLog = sequelize.define('AuditLog', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: true, // 允许匿名操作
      references: {
        model: 'users',
        key: 'id'
      }
    },
    session_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'user_sessions',
        key: 'id'
      }
    },
    action: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: '操作类型，如login, logout, create, update, delete等'
    },
    resource_type: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: '资源类型，如user, device, alert等'
    },
    resource_id: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: '资源ID'
    },
    resource_name: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: '资源名称，便于查询'
    },
    details: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: '操作详情，包含变更前后的数据'
    },
    ip_address: {
      type: DataTypes.INET,
      allowNull: true
    },
    user_agent: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'success',
      validate: {
        isIn: [['success', 'failure', 'error']]
      }
    },
    error_message: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: '错误信息（如果操作失败）'
    },
    risk_level: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'low',
      validate: {
        isIn: [['low', 'medium', 'high', 'critical']]
      },
      comment: '操作风险等级'
    },
    organization_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'organizations',
        key: 'id'
      }
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'audit_logs',
    indexes: [
      // 用户操作查询索引
      {
        name: 'idx_audit_logs_user_action',
        fields: ['user_id', 'action', 'created_at']
      },
      // 资源操作查询索引
      {
        name: 'idx_audit_logs_resource',
        fields: ['resource_type', 'resource_id', 'created_at']
      },
      // 时间范围查询索引
      {
        name: 'idx_audit_logs_created_at',
        fields: ['created_at']
      },
      // 风险等级查询索引
      {
        name: 'idx_audit_logs_risk_level',
        fields: ['risk_level', 'created_at']
      },
      // 状态查询索引
      {
        name: 'idx_audit_logs_status',
        fields: ['status', 'created_at']
      },
      // 组织查询索引
      {
        name: 'idx_audit_logs_organization',
        fields: ['organization_id', 'created_at']
      },
      // IP地址查询索引（安全分析）
      {
        name: 'idx_audit_logs_ip_address',
        fields: ['ip_address', 'created_at']
      },
      // 会话查询索引
      {
        name: 'idx_audit_logs_session',
        fields: ['session_id', 'created_at']
      }
    ]
  });

  AuditLog.associate = (models) => {
    AuditLog.belongsTo(models.User, { 
      foreignKey: 'user_id', 
      as: 'user'
    });
    
    AuditLog.belongsTo(models.UserSession, { 
      foreignKey: 'session_id', 
      as: 'session'
    });
    
    AuditLog.belongsTo(models.Organization, { 
      foreignKey: 'organization_id', 
      as: 'organization'
    });
  };

  return AuditLog;
};
