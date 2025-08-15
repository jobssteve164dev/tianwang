/**
 * 认证控制器
 */

const models = require('../models');
const { generateTokens, verifyRefreshToken } = require('../middleware/auth');
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
    const tokens = generateTokens(user.id);
    
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
  res.json({ message: 'Refresh token - TODO: Implement' });
};

/**
 * 用户登出
 */
const logout = async (req, res) => {
  res.json({ message: 'Logout - TODO: Implement' });
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
  res.json({ message: 'Change password - TODO: Implement' });
};

module.exports = {
  login,
  register,
  refreshToken,
  logout,
  getCurrentUser,
  changePassword
}; 