/**
 * 组织模型 - 多租户支持
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Organization = sequelize.define('Organization', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true
    },
    slug: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'active',
      validate: {
        isIn: [['active', 'inactive', 'suspended']]
      }
    },
    plan: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'free',
      validate: {
        isIn: [['free', 'basic', 'professional', 'enterprise']]
      }
    },
    settings: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {}
    }
  }, {
    tableName: 'organizations'
  });

  Organization.associate = function(models) {
    Organization.hasMany(models.User, {
      foreignKey: 'organization_id',
      as: 'users'
    });
    
    Organization.hasMany(models.Device, {
      foreignKey: 'organization_id',
      as: 'devices'
    });
    
    // 新增的关联关系
    Organization.hasMany(models.SecurityEvent, {
      foreignKey: 'organization_id',
      as: 'security_events'
    });
    
    Organization.hasMany(models.AuditLog, {
      foreignKey: 'organization_id',
      as: 'audit_logs'
    });
  };

  return Organization;
}; 