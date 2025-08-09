/**
 * 请求验证中间件
 */

const { validationResult } = require('express-validator');
const logger = require('../utils/logger');

/**
 * 验证请求数据
 */
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    logger.warn('Validation failed:', {
      url: req.originalUrl,
      method: req.method,
      errors: errors.array(),
      body: req.body
    });
    
    return res.status(400).json({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: errors.array()
    });
  }
  
  next();
};

module.exports = {
  validateRequest
}; 