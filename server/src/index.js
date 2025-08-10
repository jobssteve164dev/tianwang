/**
 * 天网安全监控系统 - 服务器主入口文件
 * TianWang Security Monitoring System - Server Entry Point
 */

require('express-async-errors');

// 加载环境变量 - 优先加载 dev.local，然后加载 .env
const path = require('path');
const fs = require('fs');

// 检查是否存在 dev.local 文件
const devLocalPath = path.join(__dirname, '../../dev.local');
if (fs.existsSync(devLocalPath)) {
  require('dotenv').config({ path: devLocalPath });
  console.log('Loaded environment variables from dev.local');
} else {
  require('dotenv').config();
  console.log('Loaded environment variables from .env');
}

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

// 导入自定义模块
const logger = require('./utils/logger');
const config = require('./config');
const { connectDatabases } = require('./config/database');
const { initializeKafka } = require('./config/kafka');
const { router: routes, setServices: setRouteServices } = require('./routes');
const errorHandler = require('./middleware/errorHandler');
const { setupSwagger } = require('./config/swagger');
const WebSocketService = require('./services/WebSocketService');
const NotificationService = require('./services/NotificationService');
const ReportService = require('./services/ReportService');
const keyManagementService = require('./services/KeyManagementService');
const deviceFingerprintService = require('./services/DeviceFingerprintService');
const registrationCodeService = require('./services/RegistrationCodeService');

// 创建Express应用
const app = express();
const server = http.createServer(app);

// 创建Socket.IO实例
const io = new Server(server, {
  cors: {
    origin: config.cors.origin,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// 基础中间件
app.use(helmet({
  contentSecurityPolicy: false // 开发环境禁用CSP
}));

app.use(cors({
  origin: config.cors.origin,
  credentials: config.cors.credentials
}));

app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// API限流
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  skipSuccessfulRequests: config.rateLimit.skipSuccess,
  message: {
    error: 'Too many requests, please try again later.',
    retryAfter: Math.ceil(config.rateLimit.windowMs / 1000)
  }
});

app.use('/api', limiter);

// 请求日志中间件
app.use(require('morgan')(config.log.format, {
  stream: {
    write: (message) => logger.info(message.trim())
  }
}));

// 健康检查端点
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: config.app.version,
    environment: config.app.env
  });
});

// API路由
app.use('/api', routes);

// 设置Swagger文档
if (config.swagger.enabled) {
  setupSwagger(app);
}

// Socket.IO事件处理
io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}`);

  // 客户端认证
  socket.on('authenticate', (token) => {
    // TODO: 实现JWT token验证
    logger.info(`Client ${socket.id} authenticated`);
    socket.emit('authenticated', { status: 'success' });
  });

  // 实时威胁数据订阅
  socket.on('subscribe-threats', (data) => {
    socket.join('threats');
    logger.info(`Client ${socket.id} subscribed to threat updates`);
  });

  // 实时系统状态订阅
  socket.on('subscribe-system-status', (data) => {
    socket.join('system-status');
    logger.info(`Client ${socket.id} subscribed to system status`);
  });

  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
});

// 将io实例附加到app，供其他模块使用
app.set('io', io);

// 初始化服务实例
let notificationService = null;
let reportService = null;

// 错误处理中间件（必须在最后）
app.use(errorHandler);

// 404处理
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Resource not found',
    path: req.originalUrl,
    method: req.method
  });
});

// 初始化函数
async function initialize() {
  try {
    console.log('🚀 Starting TianWang Security Monitoring System...');
    logger.info('🚀 Starting TianWang Security Monitoring System...');

    // 连接数据库
    console.log('📊 Connecting to databases...');
    logger.info('📊 Connecting to databases...');
    try {
      await connectDatabases();
      console.log('✅ Databases connected successfully');
      logger.info('✅ Databases connected successfully');
    } catch (dbError) {
      console.error('❌ Database connection failed:', dbError.message);
      logger.error('❌ Database connection failed:', dbError);
      // 继续执行，不阻塞启动
    }

    // 初始化Kafka（暂时跳过）
    console.log('📨 Skipping Kafka initialization for now...');
    logger.info('📨 Skipping Kafka initialization for now...');
    console.log('✅ Kafka initialization skipped');
    logger.info('✅ Kafka initialization skipped');

    // 初始化WebSocket服务
    console.log('🔗 Initializing WebSocket service...');
    logger.info('🔗 Initializing WebSocket service...');
    try {
      WebSocketService.initialize(server);
      console.log('✅ WebSocket service initialized successfully');
      logger.info('✅ WebSocket service initialized successfully');
    } catch (wsError) {
      console.error('❌ WebSocket service initialization failed:', wsError.message);
      logger.error('❌ WebSocket service initialization failed:', wsError);
    }

    // 初始化通知服务
    console.log('📧 Initializing notification service...');
    logger.info('📧 Initializing notification service...');
    try {
      notificationService = new NotificationService();
      await notificationService.initialize();
      console.log('✅ Notification service initialized successfully');
      logger.info('✅ Notification service initialized successfully');
    } catch (notifyError) {
      console.error('❌ Notification service initialization failed:', notifyError.message);
      logger.error('❌ Notification service initialization failed:', notifyError);
    }

    // 初始化报告服务
    console.log('📊 Initializing report service...');
    logger.info('📊 Initializing report service...');
    try {
      reportService = new ReportService();
      await reportService.initialize();
      console.log('✅ Report service initialized successfully');
      logger.info('✅ Report service initialized successfully');
    } catch (reportError) {
      console.error('❌ Report service initialization failed:', reportError.message);
      logger.error('❌ Report service initialization failed:', reportError);
    }

    // 初始化安全服务
    console.log('🔐 Initializing security services...');
    logger.info('🔐 Initializing security services...');
    try {
      await keyManagementService.initialize();
      console.log('✅ Key management service initialized successfully');
      logger.info('✅ Key management service initialized successfully');
      console.log('✅ Device fingerprint service initialized successfully');
      logger.info('✅ Device fingerprint service initialized successfully');
      console.log('✅ Registration code service initialized successfully');
      logger.info('✅ Registration code service initialized successfully');
    } catch (securityError) {
      console.error('❌ Security services initialization failed:', securityError.message);
      logger.error('❌ Security services initialization failed:', securityError);
    }

    // 设置路由服务实例
    console.log('🔧 Setting up route services...');
    try {
      setRouteServices(notificationService, reportService);
      console.log('✅ Route services configured successfully');
    } catch (routeError) {
      console.error('❌ Route services configuration failed:', routeError.message);
      logger.error('❌ Route services configuration failed:', routeError);
    }

    // 启动服务器
    const port = config.app.port;
    console.log(`🚀 Starting server on ${config.app.host}:${port}...`);
    logger.info(`🚀 Starting server on ${config.app.host}:${port}...`);
    
    try {
      server.listen(port, config.app.host, () => {
        console.log(`🌟 Server running on ${config.app.host}:${port}`);
        logger.info(`🌟 Server running on ${config.app.host}:${port}`);
        console.log(`📖 API Documentation: http://${config.app.host}:${port}/api-docs`);
        logger.info(`📖 API Documentation: http://${config.app.host}:${port}/api-docs`);
        console.log(`🔍 Health Check: http://${config.app.host}:${port}/health`);
        logger.info(`🔍 Health Check: http://${config.app.host}:${port}/health`);
        console.log(`🔗 WebSocket Endpoint: ws://${config.app.host}:${port}/ws`);
        logger.info(`🔗 WebSocket Endpoint: ws://${config.app.host}:${port}/ws`);
        console.log(`🌍 Environment: ${config.app.env}`);
        logger.info(`🌍 Environment: ${config.app.env}`);
      });
    } catch (serverError) {
      console.error('❌ Server startup failed:', serverError.message);
      logger.error('❌ Server startup failed:', serverError);
      throw serverError;
    }

  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    console.error('Stack trace:', error.stack);
    logger.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// 优雅关闭处理
process.on('SIGTERM', () => {
  logger.info('🛑 SIGTERM received, shutting down gracefully...');
  WebSocketService.close();
  if (notificationService) notificationService.cleanup();
  if (reportService) reportService.cleanup();
  server.close(() => {
    logger.info('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('🛑 SIGINT received, shutting down gracefully...');
  WebSocketService.close();
  if (notificationService) notificationService.cleanup();
  if (reportService) reportService.cleanup();
  server.close(() => {
    logger.info('✅ Server closed');
    process.exit(0);
  });
});

// 未捕获异常处理
process.on('uncaughtException', (error) => {
  logger.error('💥 Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// 启动应用
if (require.main === module) {
  console.log('🚀 Starting application...');
  console.log('Environment:', process.env.NODE_ENV);
  console.log('Port:', process.env.APP_PORT || 8000);
  
  // 添加未捕获异常处理
  process.on('uncaughtException', (error) => {
    console.error('💥 Uncaught Exception:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
  });

  initialize().catch((error) => {
    console.error('💥 Failed to initialize application:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  });
}

module.exports = { app, server, io, initialize }; 