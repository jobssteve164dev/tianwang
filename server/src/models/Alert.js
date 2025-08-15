const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  // 告警基本信息
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  type: {
    type: String,
    required: true,
    enum: ['suspicious-process', 'dangerous-command', 'suspicious-connection', 'unknown-process-connection', 'connection-flood', 'high-cpu-process', 'high-memory-usage', 'high-cpu-usage', 'high-temperature', 'network-intrusion', 'malware-activity', 'data-leak', 'ddos-attack', 'authentication-anomaly']
  },
  severity: {
    type: String,
    required: true,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  status: {
    type: String,
    required: true,
    enum: ['active', 'acknowledged', 'resolved', 'false-positive'],
    default: 'active'
  },
  
  // 来源信息
  source: {
    type: String,
    required: true
  },
  sourceIP: String,
  sourcePort: Number,
  targetIP: String,
  targetPort: Number,
  
  // 设备信息
  deviceId: {
    type: String,
    required: true
  },
  agentId: {
    type: String,
    required: true
  },
  
  // 威胁详情
  threatDetails: {
    processName: String,
    processId: Number,
    command: String,
    user: String,
    cpu: Number,
    memory: Number,
    connections: Number,
    temperature: Number
  },
  
  // 时间信息
  timestamp: {
    type: Date,
    default: Date.now
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  resolvedAt: Date,
  
  // 处理信息
  assignedTo: String,
  notes: String,
  feedback: String,
  
  // 标签
  tags: [String],
  
  // 自动响应
  autoResponse: {
    type: String,
    enum: ['none', 'blocked-ip', 'terminated-process', 'isolated-device'],
    default: 'none'
  },
  
  // 关联信息
  relatedAlerts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Alert'
  }],
  
  // 证据数据
  evidence: {
    logs: [String],
    networkTraffic: Object,
    systemMetrics: Object,
    processList: [Object]
  }
}, {
  timestamps: true
});

// 索引
alertSchema.index({ deviceId: 1, timestamp: -1 });
alertSchema.index({ agentId: 1, timestamp: -1 });
alertSchema.index({ status: 1, severity: 1 });
alertSchema.index({ type: 1, timestamp: -1 });
alertSchema.index({ sourceIP: 1, timestamp: -1 });

// 虚拟字段
alertSchema.virtual('isActive').get(function() {
  return this.status === 'active';
});

alertSchema.virtual('isCritical').get(function() {
  return this.severity === 'critical';
});

alertSchema.virtual('ageInMinutes').get(function() {
  return Math.floor((Date.now() - this.timestamp.getTime()) / (1000 * 60));
});

// 实例方法
alertSchema.methods.acknowledge = function(userId) {
  this.status = 'acknowledged';
  this.assignedTo = userId;
  this.lastUpdated = new Date();
  return this.save();
};

alertSchema.methods.resolve = function(userId, notes) {
  this.status = 'resolved';
  this.assignedTo = userId;
  this.notes = notes;
  this.resolvedAt = new Date();
  this.lastUpdated = new Date();
  return this.save();
};

alertSchema.methods.markAsFalsePositive = function(userId, feedback) {
  this.status = 'false-positive';
  this.assignedTo = userId;
  this.feedback = feedback;
  this.lastUpdated = new Date();
  return this.save();
};

// 静态方法
alertSchema.statics.getActiveAlerts = function(deviceId = null) {
  const query = { status: 'active' };
  if (deviceId) {
    query.deviceId = deviceId;
  }
  return this.find(query).sort({ timestamp: -1 });
};

alertSchema.statics.getAlertsBySeverity = function(severity, limit = 100) {
  return this.find({ severity }).sort({ timestamp: -1 }).limit(limit);
};

alertSchema.statics.getAlertsByType = function(type, limit = 100) {
  return this.find({ type }).sort({ timestamp: -1 }).limit(limit);
};

alertSchema.statics.getRecentAlerts = function(hours = 24) {
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
  return this.find({ timestamp: { $gte: cutoff } }).sort({ timestamp: -1 });
};

alertSchema.statics.getAlertStats = function() {
  return this.aggregate([
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        active: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
        resolved: { $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] } },
        acknowledged: { $sum: { $cond: [{ $eq: ['$status', 'acknowledged'] }, 1, 0] } },
        critical: { $sum: { $cond: [{ $eq: ['$severity', 'critical'] }, 1, 0] } },
        high: { $sum: { $cond: [{ $eq: ['$severity', 'high'] }, 1, 0] } },
        medium: { $sum: { $cond: [{ $eq: ['$severity', 'medium'] }, 1, 0] } },
        low: { $sum: { $cond: [{ $eq: ['$severity', 'low'] }, 1, 0] } }
      }
    }
  ]);
};

alertSchema.statics.getAlertsByDevice = function(deviceId, limit = 50) {
  return this.find({ deviceId }).sort({ timestamp: -1 }).limit(limit);
};

// 中间件
alertSchema.pre('save', function(next) {
  this.lastUpdated = new Date();
  next();
});

module.exports = mongoose.model('Alert', alertSchema);
