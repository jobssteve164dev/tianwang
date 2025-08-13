/**
 * 注册码模型
 * Registration Code Model
 */

const { DataTypes, Op } = require('sequelize');

module.exports = (sequelize) => {
  const RegistrationCode = sequelize.define('RegistrationCode', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    code: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      comment: '注册码'
    },
    signature: {
      type: DataTypes.STRING(64),
      allowNull: false,
      comment: '注册码签名'
    },
    timestamp: {
      type: DataTypes.BIGINT,
      allowNull: false,
      comment: '生成时间戳'
    },
    expiry: {
      type: DataTypes.BIGINT,
      allowNull: false,
      comment: '过期时间戳'
    },
    max_uses: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      comment: '最大使用次数'
    },
    used_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: '已使用次数'
    },
    permissions: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: ['basic'],
      comment: '权限列表'
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: '描述'
    },
    created_by: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: '创建者'
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: '是否激活'
    },
    used_by: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
      comment: '使用记录'
    }
  }, {
    tableName: 'registration_codes',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        fields: ['code']
      },
      {
        fields: ['is_active']
      },
      {
        fields: ['expiry']
      },
      {
        fields: ['created_at']
      },
      {
        fields: ['code', 'is_active']
      }
    ]
  });

  // 实例方法：增加使用次数
  RegistrationCode.prototype.incrementUsage = function(agentId, deviceFingerprint) {
    this.used_count += 1;
    this.used_by.push({
      agentId,
      deviceFingerprint,
      usedAt: new Date()
    });
    return this.save();
  };

  // 实例方法：停用注册码
  RegistrationCode.prototype.disable = function() {
    this.is_active = false;
    return this.save();
  };

  // 实例方法：延长过期时间
  RegistrationCode.prototype.extendExpiry = function(additionalTime) {
    this.expiry += additionalTime;
    return this.save();
  };

  // 静态方法：清理过期注册码
  RegistrationCode.cleanupExpired = function() {
    return this.destroy({
      where: {
        expiry: {
          [Op.lt]: Date.now()
        }
      }
    });
  };

  // 静态方法：获取统计信息
  RegistrationCode.getStats = async function() {
    const now = Date.now();
    
    const [total, active, expired, disabled, used, unused] = await Promise.all([
      this.count(),
      this.count({
        where: {
          is_active: true,
          expiry: {
            [Op.gt]: now
          }
        }
      }),
      this.count({
        where: {
          expiry: {
            [Op.lte]: now
          }
        }
      }),
      this.count({
        where: {
          is_active: false
        }
      }),
      this.count({
        where: {
          used_count: {
            [Op.gt]: 0
          }
        }
      }),
      this.count({
        where: {
          used_count: 0
        }
      })
    ]);

    return {
      total,
      active,
      expired,
      disabled,
      used,
      unused
    };
  };

  // 虚拟字段：剩余使用次数
  RegistrationCode.prototype.getRemainingUses = function() {
    return Math.max(0, this.max_uses - this.used_count);
  };

  // 虚拟字段：是否过期
  RegistrationCode.prototype.isExpired = function() {
    return Date.now() > this.expiry;
  };

  // 虚拟字段：是否可用
  RegistrationCode.prototype.isUsable = function() {
    return this.is_active && !this.isExpired() && this.used_count < this.max_uses;
  };

  return RegistrationCode;
};
