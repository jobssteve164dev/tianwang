import models from '../models/index.js';
import registrationCodes from '../services/RegistrationCodeService.js';
import fingerprints from '../services/DeviceFingerprintService.js';

function rejected(message, statusCode = 400) { return Object.assign(new Error(message), { statusCode }); }

export async function enroll(input) {
  const agentId = input.agent_id || input.agentId;
  const systemInfo = input.system_info || input.systemInfo || {};
  if (!agentId || !input.hostname || !input.platform || !input.registrationCode) throw rejected('请提供设备信息和注册码');
  return models.sequelize.transaction(async transaction => {
    await models.sequelize.query('SELECT pg_advisory_xact_lock(hashtext(:agentId))', { replacements: { agentId }, transaction });
    const existing = await models.Agent.findOne({ where: { agent_id: agentId }, transaction });
    if (existing) throw rejected('代理已存在，请使用认证接口', 409);
    const code = await models.RegistrationCode.findOne({ where: { code: input.registrationCode }, transaction, lock: transaction.LOCK.UPDATE });
    if (!code || !code.is_active || Number(code.expiry) <= Date.now() || code.used_count >= code.max_uses ||
      !registrationCodes.verifyCodeSignature(code.code, code.timestamp, code.signature)) throw rejected('注册码无效、已过期或已用完');
    const owner = await models.User.findOne({ where: { username: code.created_by }, transaction });
    if (!owner) throw rejected('注册码创建者不可用');
    const fingerprint = input.device_fingerprint || input.deviceFingerprint || fingerprints.generateFingerprint({ hostname: input.hostname, platform: input.platform, arch: input.arch, ...systemInfo }).fingerprint;
    const agent = await models.Agent.create({ agent_id: agentId, name: input.hostname, hostname: input.hostname,
      platform: input.platform, arch: input.arch, version: input.version || '1.0.0', capabilities: input.capabilities || [],
      system_info: systemInfo, device_fingerprint: fingerprint, status: 'online', last_seen: new Date(),
      organization_id: owner.organization_id }, { transaction });
    await code.update({ used_count: code.used_count + 1,
      used_by: [...(code.used_by || []), { agent_id: agentId, device_fingerprint: fingerprint, usedAt: new Date() }] }, { transaction });
    return agent;
  });
}
