const models = require('../models');
const logger = require('../utils/logger');

class SecurityEventService {
  constructor(modelProvider = models) {
    this.models = modelProvider;
  }

  async record(eventData) {
    const SecurityEvent = this.models.SecurityEvent;
    const Alert = this.models.Alert;
    if (!SecurityEvent || !Alert) {
      throw Object.assign(new Error('安全事件或告警模型不可用'), { code: 'EVENT_STORE_UNAVAILABLE' });
    }

    const event = await SecurityEvent.create({
      event_type: eventData.type,
      severity: eventData.severity,
      title: eventData.title,
      description: eventData.description,
      raw_data: eventData.details || {},
      device_id: eventData.device_id || null,
      agent_id: eventData.agent_id,
      organization_id: eventData.organization_id || null,
      source_ip: eventData.source_ip || null,
      target_ip: eventData.target_ip || null,
      status: 'open',
      tags: eventData.tags || []
    });

    try {
      await Alert.create({
        title: eventData.title,
        description: eventData.description,
        type: eventData.alert_type || 'suspicious-connection',
        severity: eventData.severity,
        status: 'active',
        source: eventData.source || 'tianwang',
        sourceIP: eventData.source_ip || null,
        targetIP: eventData.target_ip || null,
        deviceId: eventData.device_id || eventData.agent_id,
        agent_id: eventData.agent_id,
        threatDetails: { security_event_id: event.id, ...(eventData.details || {}) },
        evidence: eventData.evidence || {},
        tags: eventData.tags || []
      });
    } catch (error) {
      logger.error('安全事件的告警投影创建失败', { event_id: event.id, error: error.message });
      throw error;
    }
    return event;
  }
}

module.exports = new SecurityEventService();
module.exports.SecurityEventService = SecurityEventService;
