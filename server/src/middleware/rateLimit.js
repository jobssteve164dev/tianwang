/**
 * 速率限制中间件
 */

const rateLimit = require('express-rate-limit');
const config = require('../config');

// 认证接口限流 - 更严格
const rateLimitAuth = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 5, // 限制5次尝试
  message: {
    error: 'Too many authentication attempts',
    code: 'AUTH_RATE_LIMIT',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true
});

// API接口限流 - 一般限制
const rateLimitAPI = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: {
    error: 'Too many requests from this IP',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// 上传接口限流 - 较宽松
const rateLimitUpload = rateLimit({
  windowMs: 60 * 1000, // 1分钟
  max: 10, // 10次上传
  message: {
    error: 'Too many upload requests',
    code: 'UPLOAD_RATE_LIMIT'
  }
});

module.exports = {
  rateLimitAuth,
  rateLimitAPI,
  rateLimitUpload
}; 