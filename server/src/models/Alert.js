const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Alert = sequelize.define('Alert', {
    // 告警基本信息
    title: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true
      }
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    type: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        isIn: [['suspicious-process', 'dangerous-command', 'suspicious-connection', 'unknown-process-connection', 'connection-flood', 'high-cpu-process', 'high-memory-usage', 'high-cpu-usage', 'high-temperature', 'network-intrusion', 'malware-activity', 'data-leak', 'ddos-attack', 'authentication-anomaly']]
      }
    },
    severity: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'medium',
      validate: {
        isIn: [['low', 'medium', 'high', 'critical']]
      }
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'active',
      validate: {
        isIn: [['active', 'acknowledged', 'resolved', 'false-positive']]
      }
    },
    
    // 来源信息
    source: {
      type: DataTypes.STRING,
      allowNull: false
    },
    sourceIP: {
      type: DataTypes.STRING,
      field: 'source_ip'
    },
    sourcePort: {
      type: DataTypes.INTEGER,
      field: 'source_port'
    },
    targetIP: {
      type: DataTypes.STRING,
      field: 'target_ip'
    },
    targetPort: {
      type: DataTypes.INTEGER,
      field: 'target_port'
    },
    
    // 设备信息
    deviceId: {
      type: DataTypes.STRING,
      allowNull: false
    },
    agentId: {
      type: DataTypes.STRING,
      allowNull: false
    },
    
    // 威胁详情 (JSON字段)
    threatDetails: {
      type: DataTypes.JSON,
      defaultValue: {}
    },
    
    // 时间信息
    timestamp: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    lastUpdated: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    resolvedAt: {
      type: DataTypes.DATE
    },
    
    // 处理信息
    assignedTo: {
      type: DataTypes.STRING
    },
    notes: {
      type: DataTypes.TEXT
    },
    feedback: {
      type: DataTypes.TEXT
    },
    
    // 标签 (JSON数组)
    tags: {
      type: DataTypes.JSON,
      defaultValue: []
    },
    
    // 自动响应
    autoResponse: {
      type: DataTypes.STRING(30),
      defaultValue: 'none',
      validate: {
        isIn: [['none', 'blocked-ip', 'terminated-process', 'isolated-device']]
      }
    },
    
    // 证据数据 (JSON字段)
    evidence: {
      type: DataTypes.JSON,
      defaultValue: {}
    }
  }, {
    tableName: 'alerts',
    timestamps: true,
    indexes: [
      {
        fields: ['device_id', 'timestamp']
      },
      {
        fields: ['agent_id', 'timestamp']
      },
      {
        fields: ['status', 'severity']
      },
      {
        fields: ['type', 'timestamp']
      },
      {
        fields: ['source_ip', 'timestamp']
      }
    ]
  });

  // 实例方法
  Alert.prototype.acknowledge = function(userId) {
    this.status = 'acknowledged';
    this.assignedTo = userId;
    this.lastUpdated = new Date();
    return this.save();
  };

  Alert.prototype.resolve = function(userId, notes) {
    this.status = 'resolved';
    this.assignedTo = userId;
    this.notes = notes;
    this.resolvedAt = new Date();
    this.lastUpdated = new Date();
    return this.save();
  };

  Alert.prototype.markAsFalsePositive = function(userId, feedback) {
    this.status = 'false-positive';
    this.assignedTo = userId;
    this.feedback = feedback;
    this.lastUpdated = new Date();
    return this.save();
  };

  // 静态方法
  Alert.getActiveAlerts = function(deviceId = null) {
    const where = { status: 'active' };
    if (deviceId) {
      where.deviceId = deviceId;
    }
    return this.findAll({
      where,
      order: [['timestamp', 'DESC']]
    });
  };

  Alert.getAlertsBySeverity = function(severity, limit = 100) {
    return this.findAll({
      where: { severity },
      order: [['timestamp', 'DESC']],
      limit
    });
  };

  Alert.getAlertsByType = function(type, limit = 100) {
    return this.findAll({
      where: { type },
      order: [['timestamp', 'DESC']],
      limit
    });
  };

  Alert.getRecentAlerts = function(hours = 24) {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.findAll({
      where: {
        timestamp: {
          [sequelize.Op.gte]: cutoff
        }
      },
      order: [['timestamp', 'DESC']]
    });
  };

  Alert.getAlertStats = function() {
    return this.findAll({
      attributes: [
        [sequelize.fn('COUNT', sequelize.col('id')), 'total'],
        [sequelize.fn('COUNT', sequelize.literal("CASE WHEN status = 'active' THEN 1 END")), 'active'],
        [sequelize.fn('COUNT', sequelize.literal("CASE WHEN status = 'resolved' THEN 1 END")), 'resolved'],
        [sequelize.fn('COUNT', sequelize.literal("CASE WHEN status = 'acknowledged' THEN 1 END")), 'acknowledged'],
        [sequelize.fn('COUNT', sequelize.literal("CASE WHEN severity = 'critical' THEN 1 END")), 'critical'],
        [sequelize.fn('COUNT', sequelize.literal("CASE WHEN severity = 'high' THEN 1 END")), 'high'],
        [sequelize.fn('COUNT', sequelize.literal("CASE WHEN severity = 'medium' THEN 1 END")), 'medium'],
        [sequelize.fn('COUNT', sequelize.literal("CASE WHEN severity = 'low' THEN 1 END")), 'low']
      ],
      raw: true
    });
  };

  Alert.getAlertsByDevice = function(deviceId, limit = 50) {
    return this.findAll({
      where: { deviceId },
      order: [['timestamp', 'DESC']],
      limit
    });
  };

  // 钩子函数
  Alert.beforeSave((alert) => {
    alert.lastUpdated = new Date();
  });

  return Alert;
};
