/**
 * 用户模型
 * User Model
 */

const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');

module.exports = (sequelize) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    username: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      validate: {
        len: [3, 50],
        isAlphanumeric: true
      }
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true
      }
    },
    password_hash: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    full_name: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    role: {
      type: DataTypes.ENUM('super_admin', 'admin', 'analyst', 'viewer'),
      allowNull: false,
      defaultValue: 'viewer'
    },
    status: {
      type: DataTypes.ENUM('active', 'inactive', 'suspended'),
      allowNull: false,
      defaultValue: 'active'
    },
    last_login_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    last_login_ip: {
      type: DataTypes.INET,
      allowNull: true
    },
    failed_login_attempts: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    locked_until: {
      type: DataTypes.DATE,
      allowNull: true
    },
    two_factor_enabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    two_factor_secret: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    preferences: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {}
    },
    organization_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'organizations',
        key: 'id'
      }
    }
  }, {
    tableName: 'users',
    indexes: [
      { fields: ['username'] },
      { fields: ['email'] },
      { fields: ['organization_id'] },
      { fields: ['role'] },
      { fields: ['status'] }
    ],
    hooks: {
      beforeCreate: async (user) => {
        if (user.password_hash) {
          user.password_hash = await bcrypt.hash(user.password_hash, 12);
        }
      },
      beforeUpdate: async (user) => {
        if (user.changed('password_hash')) {
          user.password_hash = await bcrypt.hash(user.password_hash, 12);
        }
      }
    }
  });

  // 实例方法
  User.prototype.validatePassword = async function(password) {
    return await bcrypt.compare(password, this.password_hash);
  };

  User.prototype.incrementFailedLogins = async function() {
    this.failed_login_attempts += 1;
    
    // 5次失败后锁定30分钟
    if (this.failed_login_attempts >= 5) {
      this.locked_until = new Date(Date.now() + 30 * 60 * 1000);
    }
    
    await this.save();
  };

  User.prototype.resetFailedLogins = async function() {
    this.failed_login_attempts = 0;
    this.locked_until = null;
    this.last_login_at = new Date();
    await this.save();
  };

  User.prototype.isLocked = function() {
    return this.locked_until && this.locked_until > new Date();
  };

  User.prototype.toJSON = function() {
    const values = { ...this.get() };
    delete values.password_hash;
    delete values.two_factor_secret;
    return values;
  };

  // 关联关系
  User.associate = function(models) {
    User.belongsTo(models.Organization, {
      foreignKey: 'organization_id',
      as: 'organization'
    });
    
    User.hasMany(models.SecurityEvent, {
      foreignKey: 'created_by',
      as: 'created_events'
    });
    
    User.hasMany(models.AlertPolicy, {
      foreignKey: 'created_by',
      as: 'created_policies'
    });
    
    // 新增的关联关系
    User.hasMany(models.UserPermission, {
      foreignKey: 'user_id',
      as: 'permissions'
    });
    
    User.hasMany(models.UserSession, {
      foreignKey: 'user_id',
      as: 'sessions'
    });
    
    User.hasMany(models.AuditLog, {
      foreignKey: 'user_id',
      as: 'audit_logs'
    });
    
    User.hasMany(models.SecurityEvent, {
      foreignKey: 'resolved_by',
      as: 'resolved_events'
    });
  };

  return User;
}; 