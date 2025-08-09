/**
 * 日志工具配置
 * Logger Configuration using Winston
 */

const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const fs = require('fs');

// 确保日志目录存在
const logDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// 自定义日志格式
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss.SSS'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let log = `${timestamp} [${level.toUpperCase()}]`;
    
    // 添加服务名称
    if (meta.service) {
      log += ` [${meta.service}]`;
    }
    
    log += `: ${message}`;
    
    // 如果有错误堆栈，添加到日志中
    if (stack) {
      log += `\n${stack}`;
    }
    
    // 添加其他元数据
    const metaKeys = Object.keys(meta).filter(key => key !== 'service');
    if (metaKeys.length > 0) {
      log += ` ${JSON.stringify(meta)}`;
    }
    
    return log;
  })
);

// 控制台输出格式（开发环境使用彩色输出）
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'HH:mm:ss'
  }),
  winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
    let log = `${timestamp} ${level}`;
    
    if (service) {
      log += ` [${service}]`;
    }
    
    log += `: ${message}`;
    
    // 在开发环境中显示元数据
    const metaKeys = Object.keys(meta).filter(key => 
      !['timestamp', 'level', 'message', 'service', 'stack'].includes(key)
    );
    
    if (metaKeys.length > 0) {
      log += ` ${JSON.stringify(meta)}`;
    }
    
    return log;
  })
);

// 创建传输器
const transports = [
  // 控制台输出
  new winston.transports.Console({
    format: consoleFormat,
    level: process.env.LOG_LEVEL || 'debug'
  }),

  // 所有日志文件（按日期轮转）
  new DailyRotateFile({
    filename: path.join(logDir, 'app-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize: process.env.LOG_MAX_SIZE || '10m',
    maxFiles: process.env.LOG_MAX_FILES || '14d',
    format: logFormat,
    level: 'debug'
  }),

  // 错误日志文件
  new DailyRotateFile({
    filename: path.join(logDir, 'error-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize: process.env.LOG_MAX_SIZE || '10m',
    maxFiles: process.env.LOG_MAX_FILES || '30d',
    format: logFormat,
    level: 'error'
  }),

  // 安全事件日志文件
  new DailyRotateFile({
    filename: path.join(logDir, 'security-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize: process.env.LOG_MAX_SIZE || '10m',
    maxFiles: process.env.LOG_MAX_FILES || '90d',
    format: logFormat,
    level: 'info'
  })
];

// 创建主logger实例
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'debug',
  format: logFormat,
  defaultMeta: {
    service: 'tianwang-server'
  },
  transports,
  // 退出时不退出进程
  exitOnError: false
});

// 创建专门的安全日志记录器
const securityLogger = winston.createLogger({
  level: 'info',
  format: logFormat,
  defaultMeta: {
    service: 'tianwang-security'
  },
  transports: [
    new winston.transports.Console({
      format: consoleFormat
    }),
    new DailyRotateFile({
      filename: path.join(logDir, 'security-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '10m',
      maxFiles: '90d',
      format: logFormat
    })
  ]
});

// 创建审计日志记录器
const auditLogger = winston.createLogger({
  level: 'info',
  format: logFormat,
  defaultMeta: {
    service: 'tianwang-audit'
  },
  transports: [
    new DailyRotateFile({
      filename: path.join(logDir, 'audit-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '10m',
      maxFiles: '365d', // 审计日志保留1年
      format: logFormat
    })
  ]
});

// 扩展logger功能
logger.security = (message, meta = {}) => {
  securityLogger.info(message, {
    ...meta,
    category: 'security',
    timestamp: new Date().toISOString()
  });
};

logger.audit = (action, user, resource, meta = {}) => {
  auditLogger.info(`${action} on ${resource}`, {
    ...meta,
    user,
    resource,
    action,
    category: 'audit',
    timestamp: new Date().toISOString()
  });
};

logger.threat = (threatType, severity, details, meta = {}) => {
  securityLogger.warn(`Threat detected: ${threatType}`, {
    ...meta,
    threatType,
    severity,
    details,
    category: 'threat',
    timestamp: new Date().toISOString()
  });
};

logger.performance = (operation, duration, meta = {}) => {
  logger.info(`Performance: ${operation} took ${duration}ms`, {
    ...meta,
    operation,
    duration,
    category: 'performance',
    timestamp: new Date().toISOString()
  });
};

// 处理未捕获的异常和Promise拒绝
logger.exceptions.handle(
  new winston.transports.File({
    filename: path.join(logDir, 'exceptions.log')
  })
);

logger.rejections.handle(
  new winston.transports.File({
    filename: path.join(logDir, 'rejections.log')
  })
);

// 在生产环境中，减少控制台输出的详细程度
if (process.env.NODE_ENV === 'production') {
  logger.remove(logger.transports.find(t => t.name === 'console'));
  logger.add(new winston.transports.Console({
    format: winston.format.simple(),
    level: 'info'
  }));
}

// 导出日志流，供Morgan使用
logger.stream = {
  write: (message) => {
    logger.info(message.trim());
  }
};

module.exports = logger; 