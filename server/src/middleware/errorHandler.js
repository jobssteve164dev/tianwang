/**
 * 错误处理中间件
 */

const logger = require('../utils/logger');
const config = require('../config');

const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // 记录错误日志
  logger.error('API Error:', {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Sequelize验证错误
  if (err.name === 'SequelizeValidationError') {
    const message = err.errors.map(error => error.message).join(', ');
    return res.status(400).json({
      error: 'Validation Error',
      message,
      code: 'VALIDATION_ERROR'
    });
  }

  // Sequelize唯一约束错误
  if (err.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json({
      error: 'Resource already exists',
      message: 'A record with this information already exists',
      code: 'DUPLICATE_RESOURCE'
    });
  }

  // JWT错误
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Invalid token',
      code: 'INVALID_TOKEN'
    });
  }

  // 默认错误响应
  const statusCode = err.statusCode || 500;
  const message = config.app.env === 'production' && statusCode === 500 
    ? 'Internal server error' 
    : err.message;

  res.status(statusCode).json({
    error: message,
    code: err.code || 'INTERNAL_ERROR',
    ...(config.app.env === 'development' && { stack: err.stack })
  });
};

module.exports = errorHandler; 