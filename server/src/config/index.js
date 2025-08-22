/**
 * 天网安全监控系统 - 配置管理
 * Configuration Management for TianWang Security System
 */

require('dotenv').config();

const config = {
  // 应用基础配置
  app: {
    name: process.env.APP_NAME || 'tianwang',
    version: process.env.APP_VERSION || '1.0.0-alpha.1',
    env: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.APP_PORT) || 8000,
    host: process.env.APP_HOST || '0.0.0.0'
  },

  // 数据库配置
  database: {
    postgres: {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME || 'tianwang',
      username: process.env.DB_USER || 'tianwang',
      password: process.env.DB_PASSWORD || 'tianwang123',
      ssl: process.env.DB_SSL === 'true',
      pool: {
        min: parseInt(process.env.DB_POOL_MIN) || 2,
        max: parseInt(process.env.DB_POOL_MAX) || 10
      }
    },
    influxdb: {
      url: process.env.INFLUXDB_URL || 'http://localhost:8086',
      token: process.env.INFLUXDB_TOKEN || 'tianwang-super-secret-auth-token',
      org: process.env.INFLUXDB_ORG || 'tianwang',
      bucket: process.env.INFLUXDB_BUCKET || 'security_logs'
    },
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD || '',
      db: parseInt(process.env.REDIS_DB) || 0,
      ttl: parseInt(process.env.REDIS_TTL) || 3600
    }
  },

  // Kafka配置
  kafka: {
    brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
    clientId: process.env.KAFKA_CLIENT_ID || 'tianwang-server',
    groupId: process.env.KAFKA_GROUP_ID || 'tianwang-consumer-group',
    topics: {
      logs: process.env.KAFKA_TOPICS_LOGS || 'security-logs',
      alerts: process.env.KAFKA_TOPICS_ALERTS || 'security-alerts',
      actions: process.env.KAFKA_TOPICS_ACTIONS || 'protection-actions'
    }
  },

  // JWT认证配置
  jwt: {
    secret: process.env.JWT_SECRET || 'tianwang-jwt-super-secret-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d'
  },

  // 加密配置
  crypto: {
    secretKey: process.env.CRYPTO_SECRET_KEY || 'tianwang-crypto-secret-32-chars-key',
    algorithm: process.env.CRYPTO_ALGORITHM || 'aes-256-gcm'
  },

  // API限流配置
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000, // 15分钟
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    skipSuccess: process.env.RATE_LIMIT_SKIP_SUCCESS === 'true'
  },

  // 日志配置
  log: {
    level: process.env.LOG_LEVEL || 'debug',
    format: process.env.LOG_FORMAT || 'combined',
    filePath: process.env.LOG_FILE_PATH || './logs/app.log',
    maxSize: process.env.LOG_MAX_SIZE || '10m',
    maxFiles: parseInt(process.env.LOG_MAX_FILES) || 5
  },

  // AI引擎配置
  ai: {
    engineUrl: process.env.AI_ENGINE_URL || 'http://localhost:8888',
    timeout: parseInt(process.env.AI_ENGINE_TIMEOUT) || 30000,
    modelPath: process.env.AI_MODEL_PATH || './models',
    confidenceThreshold: parseFloat(process.env.AI_CONFIDENCE_THRESHOLD) || 0.8
  },

  // 外部API配置
  externalAPIs: {
    openai: {
      apiKey: process.env.OPENAI_API_KEY
    },
    claude: {
      apiKey: process.env.CLAUDE_API_KEY
    },
    gemini: {
      apiKey: process.env.GEMINI_API_KEY
    }
  },

  // 威胁情报配置
  threatIntelligence: {
    misp: {
      url: process.env.MISP_URL,
      apiKey: process.env.MISP_API_KEY
    },
    otx: {
      apiKey: process.env.OTX_API_KEY
    }
  },

  // 邮件通知配置
  email: {
    smtp: {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    },
    from: process.env.EMAIL_FROM || 'tianwang-alerts@your-domain.com'
  },

  // 短信通知配置
  sms: {
    aliyun: {
      accessKey: process.env.ALIYUN_SMS_ACCESS_KEY,
      secretKey: process.env.ALIYUN_SMS_SECRET_KEY,
      signName: process.env.ALIYUN_SMS_SIGN_NAME || '天网安全',
      templateCode: process.env.ALIYUN_SMS_TEMPLATE_CODE
    }
  },

  // Webhook配置
  webhook: {
    timeout: parseInt(process.env.WEBHOOK_TIMEOUT) || 10000,
    retryTimes: parseInt(process.env.WEBHOOK_RETRY_TIMES) || 3,
    retryDelay: parseInt(process.env.WEBHOOK_RETRY_DELAY) || 1000
  },

  // 文件上传配置
  upload: {
    path: process.env.UPLOAD_PATH || './uploads',
    maxSize: process.env.MAX_FILE_SIZE || '100mb',
    allowedTypes: (process.env.ALLOWED_FILE_TYPES || '.log,.txt,.json,.xml,.csv').split(',')
  },

  // CORS配置
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: process.env.CORS_CREDENTIALS === 'true'
  },

  // SSL配置
  ssl: {
    enabled: process.env.SSL_ENABLED === 'true',
    keyPath: process.env.SSL_KEY_PATH || './ssl/private.key',
    certPath: process.env.SSL_CERT_PATH || './ssl/certificate.crt'
  },

  // 监控配置
  monitoring: {
    healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL) || 30000,
    metricsEnabled: process.env.METRICS_ENABLED === 'true',
    metricsPort: parseInt(process.env.METRICS_PORT) || 9090
  },

  // 开发工具配置
  development: {
    debugEnabled: process.env.DEBUG_ENABLED === 'true',
    profilerEnabled: process.env.PROFILER_ENABLED === 'true'
  },

  // Swagger文档配置
  swagger: {
    enabled: process.env.SWAGGER_ENABLED !== 'false' // 默认启用
  }
};

// 配置验证
function validateConfig() {
  const required = [
    'JWT_SECRET',
    'DB_PASSWORD',
    'REDIS_PASSWORD'
  ];

  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0 && config.app.env === 'production') {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

// 在生产环境中验证配置
if (config.app.env === 'production') {
  validateConfig();
}

module.exports = config; 