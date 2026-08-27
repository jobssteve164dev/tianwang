const models = require('../models');

class AuditTrailService {
  async record(action, resourceType, resourceId, context, details = {}, riskLevel = 'low') {
    if (!models.AuditLog) return null;
    return models.AuditLog.create({
      user_id: null,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      resource_name: resourceId,
      details: { actor: context.subject, grant_id: context.grant_id, ...details },
      organization_id: context.organization_id || null,
      status: 'success',
      risk_level: riskLevel
    });
  }
}

module.exports = new AuditTrailService();
