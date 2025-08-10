/**
 * 安全中间件
 * Security Middleware - API安全防护
 */

const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cors = require('cors');
const crypto = require('crypto');
const logger = require('../utils/logger');

/**
 * 速率限制配置
 */
const createRateLimiters = () => {
  // 通用API限制
  const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15分钟
    max: 100, // 限制每个IP 15分钟内最多100个请求
    message: {
      error: '请求过于频繁，请稍后再试',
      retryAfter: '15分钟'
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      logger.warn(`速率限制触发: ${req.ip} - ${req.path}`);
      res.status(429).json({
        success: false,
        error: '请求过于频繁，请稍后再试',
        retryAfter: Math.ceil(15 * 60 / 1000)
      });
    }
  });

  // 登录API限制
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15分钟
    max: 5, // 限制每个IP 15分钟内最多5次登录尝试
    message: {
      error: '登录尝试过于频繁，请15分钟后再试',
      retryAfter: '15分钟'
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      logger.warn(`登录速率限制触发: ${req.ip}`);
      res.status(429).json({
        success: false,
        error: '登录尝试过于频繁，请15分钟后再试',
        retryAfter: Math.ceil(15 * 60 / 1000)
      });
    }
  });

  // 敏感操作限制
  const sensitiveLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1小时
    max: 10, // 限制每个IP 1小时内最多10次敏感操作
    message: {
      error: '操作过于频繁，请稍后再试',
      retryAfter: '1小时'
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      logger.warn(`敏感操作速率限制触发: ${req.ip} - ${req.path}`);
      res.status(429).json({
        success: false,
        error: '操作过于频繁，请稍后再试',
        retryAfter: Math.ceil(60 * 60 / 1000)
      });
    }
  });

  return {
    general: generalLimiter,
    login: loginLimiter,
    sensitive: sensitiveLimiter
  };
};

/**
 * CORS配置
 */
const corsOptions = {
  origin: function (origin, callback) {
    // 允许的域名列表
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'https://tianwang.example.com',
      process.env.FRONTEND_URL
    ].filter(Boolean);

    // 允许没有origin的请求（如移动应用）
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      logger.warn(`CORS阻止请求: ${origin}`);
      callback(new Error('不允许的来源'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count']
};

/**
 * 请求验证中间件
 */
const validateRequest = (req, res, next) => {
  // 检查Content-Type
  if (req.method === 'POST' || req.method === 'PUT') {
    const contentType = req.headers['content-type'];
    if (!contentType || !contentType.includes('application/json')) {
      return res.status(400).json({
        success: false,
        error: '请求必须包含正确的Content-Type'
      });
    }
  }

  // 检查请求体大小
  const contentLength = parseInt(req.headers['content-length'] || '0');
  if (contentLength > 10 * 1024 * 1024) { // 10MB限制
    return res.status(413).json({
      success: false,
      error: '请求体过大'
    });
  }

  // 检查User-Agent
  const userAgent = req.headers['user-agent'];
  if (!userAgent || userAgent.length > 500) {
    logger.warn(`可疑User-Agent: ${userAgent}`);
  }

  next();
};

/**
 * SQL注入防护中间件
 */
const sqlInjectionProtection = (req, res, next) => {
  const sqlPatterns = [
    /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute|script)\b)/i,
    /(\b(and|or)\b\s+\d+\s*=\s*\d+)/i,
    /(\b(and|or)\b\s+['"]\w+['"]\s*=\s*['"]\w+['"])/i,
    /(--|\/\*|\*\/|xp_|sp_)/i
  ];

  const checkValue = (value) => {
    if (typeof value === 'string') {
      return sqlPatterns.some(pattern => pattern.test(value));
    }
    return false;
  };

  const checkObject = (obj) => {
    for (const key in obj) {
      if (checkValue(obj[key])) {
        return true;
      }
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        if (checkObject(obj[key])) {
          return true;
        }
      }
    }
    return false;
  };

  // 检查查询参数
  if (checkObject(req.query)) {
    logger.warn(`SQL注入尝试 - 查询参数: ${req.ip}`);
    return res.status(400).json({
      success: false,
      error: '请求包含非法字符'
    });
  }

  // 检查请求体
  if (req.body && checkObject(req.body)) {
    logger.warn(`SQL注入尝试 - 请求体: ${req.ip}`);
    return res.status(400).json({
      success: false,
      error: '请求包含非法字符'
    });
  }

  next();
};

/**
 * XSS防护中间件
 */
const xssProtection = (req, res, next) => {
  const xssPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
    /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,
    /<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi
  ];

  const sanitizeValue = (value) => {
    if (typeof value === 'string') {
      return xssPatterns.reduce((sanitized, pattern) => {
        return sanitized.replace(pattern, '');
      }, value);
    }
    return value;
  };

  const sanitizeObject = (obj) => {
    const sanitized = {};
    for (const key in obj) {
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        sanitized[key] = sanitizeObject(obj[key]);
      } else {
        sanitized[key] = sanitizeValue(obj[key]);
      }
    }
    return sanitized;
  };

  // 清理查询参数
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }

  // 清理请求体
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }

  next();
};

/**
 * 请求签名验证中间件
 */
const signatureVerification = (req, res, next) => {
  // 跳过不需要签名的路径
  const skipPaths = ['/api/health', '/api/auth/login', '/api/auth/register'];
  if (skipPaths.includes(req.path)) {
    return next();
  }

  const signature = req.headers['x-signature'];
  const timestamp = req.headers['x-timestamp'];
  const nonce = req.headers['x-nonce'];

  if (!signature || !timestamp || !nonce) {
    logger.warn(`缺少签名信息: ${req.ip} - ${req.path}`);
    return res.status(401).json({
      success: false,
      error: '缺少签名信息'
    });
  }

  // 验证时间戳（5分钟内有效）
  const now = Date.now();
  const requestTime = parseInt(timestamp);
  if (Math.abs(now - requestTime) > 5 * 60 * 1000) {
    logger.warn(`签名时间戳过期: ${req.ip}`);
    return res.status(401).json({
      success: false,
      error: '签名已过期'
    });
  }

  // 验证签名
  const secret = process.env.API_SECRET || 'default-secret';
  const data = `${req.method}${req.path}${timestamp}${nonce}`;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('hex');

  if (signature !== expectedSignature) {
    logger.warn(`签名验证失败: ${req.ip} - ${req.path}`);
    return res.status(401).json({
      success: false,
      error: '签名验证失败'
    });
  }

  next();
};

/**
 * 安全头设置中间件
 */
const securityHeaders = (req, res, next) => {
  // 设置安全头
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Content-Security-Policy', 'default-src \'self\'; script-src \'self\' \'unsafe-inline\'; style-src \'self\' \'unsafe-inline\';');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

  next();
};

/**
 * 请求日志中间件
 */
const requestLogging = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    };

    if (res.statusCode >= 400) {
      logger.warn('API请求异常', logData);
    } else {
      logger.info('API请求', logData);
    }
  });

  next();
};

module.exports = {
  createRateLimiters,
  corsOptions,
  validateRequest,
  sqlInjectionProtection,
  xssProtection,
  signatureVerification,
  securityHeaders,
  requestLogging
};
