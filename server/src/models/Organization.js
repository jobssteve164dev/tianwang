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
      type: DataTypes.ENUM('active', 'inactive', 'suspended'),
      allowNull: false,
      defaultValue: 'active'
    },
    plan: {
      type: DataTypes.ENUM('free', 'basic', 'professional', 'enterprise'),
      allowNull: false,
      defaultValue: 'free'
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
  };

  return Organization;
}; 