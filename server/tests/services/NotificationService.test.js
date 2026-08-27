const NotificationService = require('../../src/services/NotificationService');
const logger = require('../../src/utils/logger');

// Mock logger
jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

// Mock nodemailer
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    verify: jest.fn().mockResolvedValue(true),
    sendMail: jest.fn().mockResolvedValue({ messageId: 'test-message-id' }),
    close: jest.fn()
  }))
}));

// Mock axios
jest.mock('axios', () => ({
  post: jest.fn((url) => Promise.resolve(url.includes('dysmsapi')
    ? { status: 200, data: { Code: 'OK', RequestId: 'sms-request-id', Message: 'OK' } }
    : { status: 200 }))
}));

describe('NotificationService', () => {
  let notificationService;
  let mockConfig;

  beforeEach(() => {
    // 重置所有mock
    jest.clearAllMocks();
    
    // Mock配置
    mockConfig = {
      email: {
        smtp: {
          host: 'smtp.test.com',
          port: 587,
          secure: false,
          auth: {
            user: 'test@test.com',
            pass: 'password'
          }
        },
        from: 'test@test.com'
      },
      sms: {
        aliyun: {
          accessKey: 'test-key',
          secretKey: 'test-secret',
          signName: '天网安全',
          templateCode: 'SMS_123456'
        }
      },
      webhook: {
        timeout: 10000,
        retryTimes: 3,
        retryDelay: 1000
      }
    };

    notificationService = new NotificationService();
    notificationService.config = {
      ...notificationService.config,
      ...mockConfig
    };
  });

  afterEach(async () => {
    if (notificationService && notificationService.isInitialized) {
      await notificationService.cleanup();
    }
  });

  describe('初始化', () => {
    test('应该成功初始化通知服务', async () => {
      await notificationService.initialize();
      
      expect(notificationService.isInitialized).toBe(true);
      expect(logger.info).toHaveBeenCalledWith('通知服务初始化完成');
    });

    test('应该在没有邮件配置时发出警告', async () => {
      notificationService.config.email.smtp.auth.user = null;
      
      await notificationService.initialize();
      
      expect(logger.warn).toHaveBeenCalledWith('邮件配置不完整，邮件通知功能将不可用');
      expect(notificationService.isInitialized).toBe(true);
    });

    test('应该在没有短信配置时发出警告', async () => {
      notificationService.config.sms.aliyun.accessKey = null;
      
      await notificationService.initialize();
      
      expect(logger.warn).toHaveBeenCalledWith('短信配置不完整，短信通知功能将不可用');
      expect(notificationService.isInitialized).toBe(true);
    });
  });

  describe('发送通知', () => {
    beforeEach(async () => {
      await notificationService.initialize();
    });

    test('应该成功发送邮件通知', async () => {
      const notification = {
        type: 'email',
        template: 'threat_alert',
        data: {
          threatType: 'malware',
          severity: 'high',
          source: '192.168.1.100',
          timestamp: new Date()
        },
        recipients: ['admin@test.com']
      };

      const sent = new Promise(resolve => notificationService.once('notification_sent', resolve));
      const notificationId = await notificationService.sendNotification(notification);
      await sent;
      
      expect(notificationId).toBeTruthy();
      expect(notificationService.stats.emailSent).toBe(1);
    });

    test('应该成功发送短信通知', async () => {
      const notification = {
        type: 'sms',
        template: 'threat_alert',
        data: {
          threatType: 'intrusion',
          severity: 'medium'
        },
        recipients: ['13800138000']
      };

      const sent = new Promise(resolve => notificationService.once('notification_sent', resolve));
      const notificationId = await notificationService.sendNotification(notification);
      await sent;
      
      expect(notificationId).toBeTruthy();
      expect(notificationService.stats.smsSent).toBe(1);
    });

    test('应该成功发送Webhook通知', async () => {
      const notification = {
        type: 'webhook',
        template: 'system_alert',
        data: {
          alertType: 'system_error',
          description: '系统异常'
        },
        recipients: ['http://webhook.test.com'],
        options: {
          webhookUrl: 'http://webhook.test.com'
        }
      };

      const sent = new Promise(resolve => notificationService.once('notification_sent', resolve));
      const notificationId = await notificationService.sendNotification(notification);
      await sent;
      
      expect(notificationId).toBeTruthy();
      expect(notificationService.stats.webhookSent).toBe(1);
    });

    test('应该在服务未初始化时抛出错误', async () => {
      notificationService.isInitialized = false;
      
      const notification = {
        type: 'email',
        template: 'threat_alert',
        data: {},
        recipients: ['test@test.com']
      };

      await expect(notificationService.sendNotification(notification))
        .rejects.toThrow('通知服务未初始化');
    });

    test('应该在队列满时返回false', async () => {
      notificationService.config.maxQueueSize = 1;
      notificationService.notificationQueue.push({ id: 'existing' });

      const notification = {
        type: 'email',
        template: 'threat_alert',
        data: {},
        recipients: ['test@test.com']
      };

      const result = await notificationService.sendNotification(notification);
      
      expect(result).toBe(false);
      expect(logger.warn).toHaveBeenCalledWith('通知队列已满，丢弃新通知');
    });
  });

  describe('模板渲染', () => {
    test('应该正确渲染邮件模板', async () => {
      const template = 'threat-alert-email.html';
      const data = {
        threatType: 'malware',
        severity: 'high',
        source: '192.168.1.100',
        timestamp: new Date('2023-01-01T00:00:00Z')
      };

      const result = await notificationService.renderEmailTemplate(template, data);
      
      expect(result).toContain('天网安全警报');
      expect(result).toContain('malware');
      expect(result).toContain('high');
      expect(result).toContain('192.168.1.100');
    });

    test('应该正确渲染短信模板', async () => {
      const template = 'threat-alert-sms.txt';
      const data = {
        threatType: 'intrusion',
        severity: 'medium'
      };

      const result = await notificationService.renderSMSTemplate(template, data);
      
      expect(result).toContain('天网安全警报');
      expect(result).toContain('intrusion');
      expect(result).toContain('medium');
    });
  });

  describe('服务状态', () => {
    test('应该返回正确的服务状态', async () => {
      await notificationService.initialize();
      
      const status = notificationService.getStatus();
      
      expect(status.initialized).toBe(true);
      expect(status.queueSize).toBe(0);
      expect(status.processing).toBe(true);
      expect(status.stats).toBeDefined();
      expect(status.config).toBeDefined();
    });
  });

  describe('清理资源', () => {
    test('应该正确清理资源', async () => {
      await notificationService.initialize();
      
      await notificationService.cleanup();
      
      expect(notificationService.processingQueue).toBe(false);
      expect(logger.info).toHaveBeenCalledWith('通知服务已清理');
    });
  });

  describe('事件处理', () => {
    test('应该发出通知发送成功事件', async () => {
      await notificationService.initialize();
      
      const mockListener = jest.fn();
      notificationService.on('notification_sent', mockListener);

      const notification = {
        type: 'email',
        template: 'threat_alert',
        data: {},
        recipients: ['test@test.com']
      };

      await notificationService.sendNotification(notification);
      
      // 等待队列处理
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(mockListener).toHaveBeenCalled();
    });

    test('应该发出通知失败事件', async () => {
      await notificationService.initialize();
      
      const mockListener = jest.fn();
      notificationService.on('notification_failed', mockListener);

      // 模拟发送失败
      notificationService.config.retryAttempts = 0;
      notificationService.emailTransporter.sendMail.mockRejectedValue(new Error('Send failed'));

      const notification = {
        type: 'email',
        template: 'threat_alert',
        data: {},
        recipients: ['test@test.com']
      };

      await notificationService.sendNotification(notification);
      
      // 等待队列处理
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(mockListener).toHaveBeenCalled();
    });
  });
});
