/**
 * 认证控制器
 */

const models = require('../models');
const { verifyRefreshToken } = require('../middleware/auth');
const { issueSession, rotateSession, revokeSession, revokeUserSessions } = require('../services/UserSessionService');
const logger = require('../utils/logger');

/**
 * 用户登录
 */
const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    // 检查模型是否可用
    if (!models.User) {
      return res.status(503).json({
        error: 'Database not available',
        code: 'DB_UNAVAILABLE'
      });
    }

    // 查找用户
    const user = await models.User.findOne({
      where: { username },
      include: ['organization']
    });

    if (!user) {
      return res.status(401).json({
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // 检查账户状态
    if (user.status !== 'active') {
      return res.status(401).json({
        error: 'Account is not active',
        code: 'ACCOUNT_INACTIVE'
      });
    }

    if (user.isLocked()) {
      return res.status(401).json({
        error: 'Account is locked due to too many failed login attempts',
        code: 'ACCOUNT_LOCKED'
      });
    }

    // 验证密码
    const isValidPassword = await user.validatePassword(password);
    if (!isValidPassword) {
      await user.incrementFailedLogins();

      logger.audit('LOGIN_FAILED', user.id, 'login', {
        reason: 'invalid_password',
        ip: req.ip
      });

      return res.status(401).json({
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // 登录成功
    await user.resetFailedLogins();
    user.last_login_ip = req.ip;
    await user.save();

    // 生成JWT tokens
    const tokens = await issueSession(user.id, req, user.password_hash);
    if (!tokens) return res.status(401).json({ error: 'Invalid credentials', code: 'INVALID_CREDENTIALS' });

    logger.audit('LOGIN_SUCCESS', user.id, 'login', {
      ip: req.ip,
      user_agent: req.get('User-Agent')
    });

    res.json({
      message: 'Login successful',
      user: user.toJSON(),
      ...tokens
    });

  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({
      error: 'Login failed',
      code: 'LOGIN_ERROR'
    });
  }
};

/**
 * 用户注册
 */
const register = async (req, res) => {
  try {
    const { username, email, password, full_name } = req.body;

    // 检查用户是否已存在
    const existingUser = await models.User?.findOne({
      where: {
        $or: [{ username }, { email }]
      }
    });

    if (existingUser) {
      return res.status(409).json({
        error: 'Username or email already exists',
        code: 'USER_EXISTS'
      });
    }

    // 创建用户
    const user = await models.User?.create({
      username,
      email,
      password_hash: password, // 将在模型的beforeCreate钩子中加密
      full_name,
      role: 'viewer' // 默认角色
    });

    logger.audit('USER_REGISTERED', user.id, 'register', {
      username,
      email,
      ip: req.ip
    });

    res.status(201).json({
      message: 'User registered successfully',
      user: user.toJSON()
    });

  } catch (error) {
    logger.error('Registration error:', error);
    res.status(500).json({
      error: 'Registration failed',
      code: 'REGISTRATION_ERROR'
    });
  }
};

/**
 * 刷新访问令牌
 */
const refreshToken = async (req, res) => {
  try {
    const token = req.body.refreshToken;
    if (!token) {
      return res.status(400).json({ error: 'Refresh token is required', code: 'MISSING_REFRESH_TOKEN' });
    }
    const decoded = verifyRefreshToken(token);
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid refresh token', code: 'INVALID_REFRESH_TOKEN' });
    }
    const user = await models.User?.findByPk(decoded.userId);
    if (!user || user.status !== 'active' || user.isLocked()) {
      return res.status(401).json({ error: 'Account cannot refresh tokens', code: 'REFRESH_DENIED' });
    }
    const tokens = await rotateSession(token, user.id);
    if (!tokens) return res.status(401).json({ error: 'Session expired; sign in again', code: 'SESSION_EXPIRED' });
    return res.json(tokens);
  } catch (error) {
    logger.error('Refresh token error:', error);
    return res.status(500).json({ error: 'Token refresh failed', code: 'REFRESH_ERROR' });
  }
};

/**
 * 用户登出
 */
const logout = async (req, res) => {
  try {
    await revokeSession(req.sessionId, req.userId);
    req.app.get('io')?.in(`session:${req.sessionId}`).disconnectSockets(true);
    res.json({ message: 'Logout successful' });
  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed; retry', code: 'LOGOUT_ERROR' });
  }
};

/**
 * 获取当前用户信息
 */
const getCurrentUser = async (req, res) => {
  try {
    const user = await models.User?.findByPk(req.userId, {
      include: ['organization']
    });

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    res.json({
      user: user.toJSON()
    });

  } catch (error) {
    logger.error('Get current user error:', error);
    res.status(500).json({
      error: 'Failed to get user info',
      code: 'GET_USER_ERROR'
    });
  }
};

/**
 * 修改密码
 */
const changePassword = async (req, res) => {
  try {
    const user = await models.User?.findByPk(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found', code: 'USER_NOT_FOUND' });
    }
    const valid = await user.validatePassword(req.body.current_password);
    if (!valid) {
      return res.status(400).json({ error: 'Current password is incorrect', code: 'INVALID_CURRENT_PASSWORD' });
    }
    const changed = await models.sequelize.transaction(async transaction => {
      const current = await models.User.findByPk(req.userId, { transaction, lock: true });
      if (!current || current.password_hash !== user.password_hash) return false;
      current.password_hash = req.body.new_password;
      await current.save({ transaction });
      await revokeUserSessions(current.id, transaction);
      return true;
    });
    if (!changed) return res.status(400).json({ error: 'Current password is incorrect', code: 'INVALID_CURRENT_PASSWORD' });
    req.app.get('io')?.in(`user:${req.userId}`).disconnectSockets(true);
    logger.audit('PASSWORD_CHANGED', user.id, 'change-password', { ip: req.ip });
    return res.json({ message: 'Password changed successfully' });
  } catch (error) {
    logger.error('Change password error:', error);
    return res.status(500).json({ error: 'Password change failed', code: 'PASSWORD_CHANGE_ERROR' });
  }
};

module.exports = {
  login,
  register,
  refreshToken,
  logout,
  getCurrentUser,
  changePassword
};
