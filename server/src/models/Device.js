/**
 * 设备模型
 * Device Model - 管理被监控的设备
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Device = sequelize.define('Device', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    hostname: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    ip_address: {
      type: DataTypes.INET,
      allowNull: false
    },
    mac_address: {
      type: DataTypes.STRING(17),
      allowNull: true,
      validate: {
        is: /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/
      }
    },
    platform: {
      type: DataTypes.ENUM('windows', 'linux', 'macos', 'openwrt'),
      allowNull: false
    },
    os_version: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    architecture: {
      type: DataTypes.STRING(20),
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM('online', 'offline', 'maintenance', 'error'),
      allowNull: false,
      defaultValue: 'offline'
    },
    last_seen_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    agent_version: {
      type: DataTypes.STRING(20),
      allowNull: true
    },
    capabilities: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {
        log_collection: true,
        network_monitoring: true,
        process_monitoring: true,
        file_monitoring: false,
        firewall_control: false
      }
    },
    configuration: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {
        log_level: 'info',
        collection_interval: 60,
        max_log_size: 100,
        excluded_paths: [],
        monitoring_rules: []
      }
    },
    hardware_info: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {}
    },
    network_info: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {}
    },
    tags: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      defaultValue: []
    },
    location: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    organization_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'organizations',
        key: 'id'
      }
    },
    created_by: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    }
  }, {
    tableName: 'devices',
    indexes: [
      // 复合索引：按组织和状态查询（最常用）
      {
        name: 'idx_devices_org_status',
        fields: ['organization_id', 'status']
      },
      // 复合索引：按组织和平台查询
      {
        name: 'idx_devices_org_platform',
        fields: ['organization_id', 'platform']
      },
      // 复合索引：按状态和最后在线时间查询
      {
        name: 'idx_devices_status_lastseen',
        fields: ['status', 'last_seen_at']
      },
      // 单列索引
      { name: 'idx_devices_hostname', fields: ['hostname'] },
      { name: 'idx_devices_ip_address', fields: ['ip_address'] },
      { name: 'idx_devices_mac_address', fields: ['mac_address'] },
      { name: 'idx_devices_platform', fields: ['platform'] },
      { name: 'idx_devices_status', fields: ['status'] },
      { name: 'idx_devices_organization_id', fields: ['organization_id'] },
      { name: 'idx_devices_last_seen_at', fields: ['last_seen_at'] },
      // GIN索引用于数组字段
      { name: 'idx_devices_tags_gin', fields: ['tags'], using: 'gin' }
    ]
  });

  // 实例方法
  Device.prototype.updateLastSeen = async function() {
    this.last_seen_at = new Date();
    this.status = 'online';
    await this.save();
  };

  Device.prototype.setOffline = async function() {
    this.status = 'offline';
    await this.save();
  };

  Device.prototype.updateConfiguration = async function(newConfig) {
    this.configuration = {
      ...this.configuration,
      ...newConfig
    };
    await this.save();
  };

  Device.prototype.addTag = async function(tag) {
    if (!this.tags.includes(tag)) {
      this.tags = [...this.tags, tag];
      await this.save();
    }
  };

  Device.prototype.removeTag = async function(tag) {
    this.tags = this.tags.filter(t => t !== tag);
    await this.save();
  };

  Device.prototype.isOnline = function() {
    if (!this.last_seen_at) return false;
    
    // 如果超过5分钟没有心跳，认为离线
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    return this.last_seen_at > fiveMinutesAgo && this.status === 'online';
  };

  // 静态方法
  Device.getOnlineDevices = async function(organizationId = null) {
    const where = {
      status: 'online'
    };
    
    if (organizationId) {
      where.organization_id = organizationId;
    }
    
    return await this.findAll({ where });
  };

  Device.getByPlatform = async function(platform, organizationId = null) {
    const where = { platform };
    
    if (organizationId) {
      where.organization_id = organizationId;
    }
    
    return await this.findAll({ where });
  };

  // 关联关系
  Device.associate = function(models) {
    Device.belongsTo(models.Organization, {
      foreignKey: 'organization_id',
      as: 'organization'
    });
    
    Device.belongsTo(models.User, {
      foreignKey: 'created_by',
      as: 'creator'
    });
    
    Device.hasMany(models.Agent, {
      foreignKey: 'device_id',
      as: 'agents'
    });
    
    Device.hasMany(models.SecurityEvent, {
      foreignKey: 'device_id',
      as: 'security_events'
    });
  };

  return Device;
}; 