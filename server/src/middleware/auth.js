/**
 * JWT认证中间件
 * JWT Authentication Middleware
 */

const jwt = require('jsonwebtoken');
const models = require('../models');
const config = require('../config');
const logger = require('../utils/logger');
const crypto = require('crypto');

/**
 * 验证JWT Token
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Access token required',
        code: 'MISSING_TOKEN'
      });
    }

    const token = authHeader.substring(7);
    
    const demoToken = config.app.env === 'production'
      ? process.env.DEMO_AUTH_TOKEN
      : (process.env.DEMO_AUTH_TOKEN || 'demo-token-local-development');
    const demoAllowed = config.app.env !== 'production' && demoToken &&
      token.length === demoToken.length &&
      crypto.timingSafeEqual(Buffer.from(token), Buffer.from(demoToken));
    if (demoAllowed) {
      // 演示模式 - 创建模拟用户
      req.user = {
        id: '1',
        username: 'admin',
        email: 'admin@tianwang.com',
        role: 'super_admin',
        organization_id: 'd8ca4979-0e71-409f-8944-acba9b1a9b5c', // 使用第一个组织的UUID
        status: 'active',
        isLocked: () => false
      };
      req.userId = '1';
      req.organizationId = 'd8ca4979-0e71-409f-8944-acba9b1a9b5c';
      return next();
    }
    
    try {
      const decoded = jwt.verify(token, config.jwt.secret);
      
      // 检查是否为代理token
      if (decoded.type === 'agent') {
        // 代理认证 - 验证代理是否存在且在线
        if (!models.Agent) {
          return res.status(503).json({
            error: 'Database not available',
            code: 'DB_UNAVAILABLE'
          });
        }
        
        const agentId = decoded.agent_id || decoded.agentId;
        const agent = await models.Agent.findOne({
          where: { agent_id: agentId }
        });
        
        if (!agent) {
          return res.status(401).json({
            error: 'Invalid agent token - agent not found',
            code: 'AGENT_NOT_FOUND'
          });
        }
        
        if (agent.status !== 'online') {
          return res.status(401).json({
            error: 'Agent is not online',
            code: 'AGENT_OFFLINE'
          });
        }
        
        // 为代理请求创建模拟用户（具有管理员权限）
        req.user = {
          id: 'agent-' + agentId,
          username: 'agent',
          email: 'agent@tianwang.com',
          role: 'admin',
          organization_id: agent.organization_id || 'd8ca4979-0e71-409f-8944-acba9b1a9b5c',
          status: 'active',
          isLocked: () => false,
          isAgent: true,
          agentId
        };
        req.userId = 'agent-' + agentId;
        req.organizationId = agent.organization_id || 'd8ca4979-0e71-409f-8944-acba9b1a9b5c';
        req.agentId = agentId;
        
        logger.debug('代理认证成功:', { agentId, hostname: decoded.hostname });
        return next();
      }
      
      // 用户认证逻辑
      // 检查模型是否可用
      if (!models.User) {
        return res.status(503).json({
          error: 'Database not available',
          code: 'DB_UNAVAILABLE'
        });
      }

      // 查找用户
      const user = await models.User.findByPk(decoded.userId, {
        include: ['organization']
      });
      
      if (!user) {
        return res.status(401).json({
          error: 'Invalid token - user not found',
          code: 'USER_NOT_FOUND'
        });
      }
      
      if (user.status !== 'active') {
        return res.status(401).json({
          error: 'Account is not active',
          code: 'ACCOUNT_INACTIVE'
        });
      }
      
      if (user.isLocked()) {
        return res.status(401).json({
          error: 'Account is locked',
          code: 'ACCOUNT_LOCKED'
        });
      }
      
      // 将用户信息附加到请求对象
      req.user = user;
      req.userId = user.id;
      req.organizationId = user.organization_id;
      
      next();
      
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({
          error: 'Token expired',
          code: 'TOKEN_EXPIRED'
        });
      }
      
      if (jwtError.name === 'JsonWebTokenError') {
        return res.status(401).json({
          error: 'Invalid token',
          code: 'INVALID_TOKEN'
        });
      }
      
      throw jwtError;
    }
    
  } catch (error) {
    logger.error('Authentication error:', error);
    return res.status(500).json({
      error: 'Authentication failed',
      code: 'AUTH_ERROR'
    });
  }
};

/**
 * 可选认证 - 如果有token则验证，没有则继续
 */
const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }
  
  // 如果有token，则进行验证
  return authenticate(req, res, next);
};

/**
 * 角色权限检查
 */
const authorize = (roles = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }
    
    if (roles.length === 0) {
      return next();
    }
    
    if (!roles.includes(req.user.role)) {
      logger.audit('ACCESS_DENIED', req.user.id, req.originalUrl, {
        required_roles: roles,
        user_role: req.user.role
      });
      
      return res.status(403).json({
        error: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS',
        required_roles: roles,
        user_role: req.user.role
      });
    }
    
    next();
  };
};

/**
 * 组织权限检查
 */
const requireOrganization = (req, res, next) => {
  if (!req.user.organization_id) {
    return res.status(403).json({
      error: 'Organization membership required',
      code: 'NO_ORGANIZATION'
    });
  }
  
  next();
};

/**
 * 生成JWT Token
 */
const generateTokens = (userId) => {
  const payload = { userId };
  
  const accessToken = jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn
  });
  
  const refreshToken = jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.refreshExpiresIn
  });
  
  return { accessToken, refreshToken };
};

/**
 * 验证refresh token
 */
const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, config.jwt.secret);
  } catch (error) {
    return null;
  }
};

module.exports = {
  authenticate,
  protect: authenticate, // 别名
  optionalAuth,
  authorize,
  requireOrganization,
  generateTokens,
  verifyRefreshToken
};
