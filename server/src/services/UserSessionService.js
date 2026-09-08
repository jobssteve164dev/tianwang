const { createHash, randomUUID } = require('crypto');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const models = require('../models');
const config = require('../config');

const digest = token => createHash('sha256').update(token).digest('hex');

const generateTokens = userId => {
  const sessionId = randomUUID();
  return {
    accessToken: jwt.sign({ userId, sessionId, tokenUse: 'access' }, config.jwt.secret, { expiresIn: config.jwt.expiresIn }),
    refreshToken: jwt.sign({ userId, sessionId, tokenUse: 'refresh' }, config.jwt.secret, { expiresIn: config.jwt.refreshExpiresIn })
  };
};

const sessionValues = tokens => ({
  session_token: digest(tokens.accessToken),
  refresh_token: digest(tokens.refreshToken),
  expires_at: new Date(jwt.decode(tokens.refreshToken).exp * 1000)
});

const issueSession = async (userId, request, verifiedPasswordHash) => models.sequelize.transaction(async transaction => {
  // Serialize session creation with password changes; never issue from a stale password check.
  const user = await models.User.findByPk(userId, { transaction, lock: true });
  if (!user || user.password_hash !== verifiedPasswordHash || user.status !== 'active' || user.isLocked()) return null;
  const tokens = generateTokens(userId);
  await models.UserSession.create({
    ...sessionValues(tokens), user_id: userId,
    ip_address: request.ip, user_agent: request.get('User-Agent')
  }, { transaction });
  return tokens;
});

const findAccessSession = async (token, userId, registry = models) => registry.UserSession.findOne({
  where: {
    user_id: userId, session_token: digest(token), is_active: true,
    expires_at: { [Op.gt]: new Date() }
  }
});

const rotateSession = async (refreshToken, userId) => {
  const tokens = generateTokens(userId);
  // Atomic replacement prevents replay, concurrent refresh and a late refresh after logout.
  const [changed] = await models.UserSession.update(sessionValues(tokens), {
    where: {
      user_id: userId, refresh_token: digest(refreshToken), is_active: true,
      expires_at: { [Op.gt]: new Date() }
    }
  });
  return changed === 1 ? tokens : null;
};

const revokeSession = async (sessionId, userId) => models.UserSession.update({
  is_active: false, logout_at: new Date(), logout_reason: 'user_logout'
}, { where: { id: sessionId, user_id: userId, is_active: true } });

const revokeUserSessions = async (userId, transaction) => models.UserSession.update({
  is_active: false, logout_at: new Date(), logout_reason: 'security_violation'
}, { where: { user_id: userId, is_active: true }, transaction });

module.exports = { generateTokens, issueSession, findAccessSession, rotateSession, revokeSession, revokeUserSessions };
