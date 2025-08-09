const winston = require('winston');
const path = require('path');
const fs = require('fs');
const os = require('os');

// 确保日志目录存在
const logDir = path.join(os.homedir(), '.tianwang', 'logs');
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

// 自定义日志格式
const logFormat = winston.format.combine(
    winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.prettyPrint()
);

// 控制台格式
const consoleFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({
        format: 'HH:mm:ss'
    }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
        let msg = `${timestamp} [${level}]: ${message}`;
        if (Object.keys(meta).length > 0) {
            msg += '\n' + JSON.stringify(meta, null, 2);
        }
        return msg;
    })
);

// 创建logger实例
const logger = winston.createLogger({
    level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
    format: logFormat,
    defaultMeta: {
        service: 'tianwang-agent',
        platform: os.platform(),
        arch: os.arch(),
        hostname: os.hostname()
    },
    transports: [
        // 错误日志文件
        new winston.transports.File({
            filename: path.join(logDir, 'error.log'),
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 5,
            tailable: true
        }),
        // 组合日志文件
        new winston.transports.File({
            filename: path.join(logDir, 'combined.log'),
            maxsize: 5242880, // 5MB
            maxFiles: 10,
            tailable: true
        }),
        // 控制台输出
        new winston.transports.Console({
            format: consoleFormat,
            level: process.env.NODE_ENV === 'development' ? 'debug' : 'warn'
        })
    ],
    exceptionHandlers: [
        new winston.transports.File({
            filename: path.join(logDir, 'exceptions.log')
        })
    ],
    rejectionHandlers: [
        new winston.transports.File({
            filename: path.join(logDir, 'rejections.log')
        })
    ]
});

// 添加性能监控
logger.profile = function(name, meta = {}) {
    const start = Date.now();
    return {
        done: function(message = 'Operation completed') {
            const duration = Date.now() - start;
            logger.info(message, {
                ...meta,
                operation: name,
                duration: `${duration}ms`
            });
        }
    };
};

// 添加内存使用监控
logger.memory = function(label = 'Memory Usage') {
    const usage = process.memoryUsage();
    logger.debug(label, {
        rss: `${Math.round(usage.rss / 1024 / 1024 * 100) / 100} MB`,
        heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024 * 100) / 100} MB`,
        heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024 * 100) / 100} MB`,
        external: `${Math.round(usage.external / 1024 / 1024 * 100) / 100} MB`
    });
};

// 系统信息日志
logger.system = function(message, data = {}) {
    logger.info(message, {
        category: 'system',
        ...data
    });
};

// 网络信息日志
logger.network = function(message, data = {}) {
    logger.info(message, {
        category: 'network',
        ...data
    });
};

// 安全信息日志
logger.security = function(message, data = {}) {
    logger.warn(message, {
        category: 'security',
        ...data
    });
};

module.exports = logger; 