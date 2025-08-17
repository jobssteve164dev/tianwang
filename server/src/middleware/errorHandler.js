/**
 * 错误处理中间件
 */

const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  // 添加详细的调试信息
  console.log('=== 错误处理中间件调试信息 ===');
  console.log('错误对象类型:', typeof err);
  console.log('错误对象:', err);
  console.log('错误对象键:', Object.keys(err || {}));
  console.log('错误消息:', err?.message);
  console.log('错误堆栈:', err?.stack);
  console.log('错误名称:', err?.name);
  console.log('错误代码:', err?.code);
  console.log('错误状态码:', err?.statusCode);
  console.log('================================');

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
  if (err.name === 'SequelizeValidationError' && err.errors && Array.isArray(err.errors)) {
    const message = err.errors.map(validationError => validationError.message).join(', ');
    return res.status(400).json({
      success: false,
      error: 'Validation Error',
      message,
      code: 'VALIDATION_ERROR'
    });
  }

  // Sequelize唯一约束错误
  if (err.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json({
      success: false,
      error: 'Resource already exists',
      message: 'A record with this information already exists',
      code: 'DUPLICATE_RESOURCE'
    });
  }

  // JWT错误
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      error: 'Invalid token',
      code: 'INVALID_TOKEN'
    });
  }

  // 默认错误响应
  const statusCode = err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production' && statusCode === 500 
    ? 'Internal server error' 
    : err.message;

  res.status(statusCode).json({
    success: false,
    error: message,
    code: err.code || 'INTERNAL_ERROR',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

module.exports = errorHandler; 