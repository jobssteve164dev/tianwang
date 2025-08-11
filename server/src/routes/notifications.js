const express = require('express');
const { body, validationResult } = require('express-validator');
const logger = require('../utils/logger');
const { protect, authorize } = require('../middleware/auth');
const nodemailer = require('nodemailer');

const router = express.Router();

// 通知服务实例（将在主应用中初始化）
let notificationService = null;
let reportService = null;

// 设置服务实例的方法
function setServices(notification, report) {
  notificationService = notification;
  reportService = report;
}

/**
 * @swagger
 * components:
 *   schemas:
 *     NotificationRequest:
 *       type: object
 *       required:
 *         - type
 *         - template
 *         - recipients
 *       properties:
 *         type:
 *           type: string
 *           enum: [email, sms, webhook, all]
 *           description: 通知类型
 *         template:
 *           type: string
 *           enum: [threat_alert, system_alert, weekly_report]
 *           description: 通知模板
 *         data:
 *           type: object
 *           description: 模板数据
 *         recipients:
 *           type: array
 *           items:
 *             type: string
 *           description: 接收者列表
 *         options:
 *           type: object
 *           description: 额外选项
 */

/**
 * @swagger
 * /api/notifications/send:
 *   post:
 *     summary: 发送通知
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/NotificationRequest'
 *     responses:
 *       200:
 *         description: 通知发送成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 notificationId:
 *                   type: string
 *                 message:
 *                   type: string
 *       400:
 *         description: 请求参数错误
 *       401:
 *         description: 未授权
 *       500:
 *         description: 服务器错误
 */
router.post('/send', [
  protect,
  authorize(['admin', 'security_analyst']),
  body('type').isIn(['email', 'sms', 'webhook', 'all']).withMessage('无效的通知类型'),
  body('template').isIn(['threat_alert', 'system_alert', 'weekly_report']).withMessage('无效的模板类型'),
  body('recipients').isArray({ min: 1 }).withMessage('至少需要一个接收者'),
  body('recipients.*').isString().withMessage('接收者必须是字符串')
], async (req, res) => {
  try {
    // 验证请求
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    if (!notificationService) {
      return res.status(503).json({
        success: false,
        message: '通知服务未初始化'
      });
    }

    const { type, template, data, recipients, options } = req.body;

    // 发送通知
    const notificationId = await notificationService.sendNotification({
      type,
      template,
      data,
      recipients,
      options
    });

    logger.info(`通知已发送: ${notificationId}, 类型: ${type}, 模板: ${template}`);

    res.json({
      success: true,
      notificationId,
      message: '通知已加入发送队列'
    });

  } catch (error) {
    logger.error('发送通知失败:', error);
    res.status(500).json({
      success: false,
      message: '发送通知失败',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/notifications/status:
 *   get:
 *     summary: 获取通知服务状态
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 服务状态信息
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 status:
 *                   type: object
 *                   properties:
 *                     initialized:
 *                       type: boolean
 *                     queueSize:
 *                       type: number
 *                     processing:
 *                       type: boolean
 *                     stats:
 *                       type: object
 *                     config:
 *                       type: object
 */
router.get('/status', [
  protect,
  authorize(['admin', 'security_analyst'])
], async (req, res) => {
  try {
    if (!notificationService) {
      return res.status(503).json({
        success: false,
        message: '通知服务未初始化'
      });
    }

    const status = notificationService.getStatus();

    res.json({
      success: true,
      status
    });

  } catch (error) {
    logger.error('获取通知服务状态失败:', error);
    res.status(500).json({
      success: false,
      message: '获取服务状态失败',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/notifications/test:
 *   post:
 *     summary: 测试通知功能
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [email, sms, webhook]
 *               recipient:
 *                 type: string
 *     responses:
 *       200:
 *         description: 测试通知发送成功
 *       400:
 *         description: 请求参数错误
 *       500:
 *         description: 服务器错误
 */
router.post('/test', [
  protect,
  authorize(['admin']),
  body('type').isIn(['email', 'sms', 'webhook']).withMessage('无效的通知类型'),
  body('recipient').isString().withMessage('接收者必须是字符串')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    if (!notificationService) {
      return res.status(503).json({
        success: false,
        message: '通知服务未初始化'
      });
    }

    const { type, recipient } = req.body;

    // 发送测试通知
    const notificationId = await notificationService.sendNotification({
      type,
      template: 'system_alert',
      data: {
        alertType: 'test',
        description: '这是一条测试通知',
        timestamp: new Date()
      },
      recipients: [recipient],
      options: type === 'webhook' ? { webhookUrl: recipient } : {}
    });

    logger.info(`测试通知已发送: ${notificationId}, 类型: ${type}, 接收者: ${recipient}`);

    res.json({
      success: true,
      notificationId,
      message: '测试通知已发送'
    });

  } catch (error) {
    logger.error('发送测试通知失败:', error);
    res.status(500).json({
      success: false,
      message: '发送测试通知失败',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/notifications/config:
 *   get:
 *     summary: 获取通知配置
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 获取通知配置成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 config:
 *                   type: object
 *                   properties:
 *                     email:
 *                       type: object
 *                       properties:
 *                         smtp:
 *                           type: object
 *                           properties:
 *                             host:
 *                               type: string
 *                             port:
 *                               type: number
 *                             secure:
 *                               type: boolean
 *                             auth:
 *                               type: object
 *                               properties:
 *                                 user:
 *                                   type: string
 *                                 pass:
 *                                   type: string
 *                         from:
 *                           type: string
 *                         enabled:
 *                           type: boolean
 *                     sms:
 *                       type: object
 *                       properties:
 *                         aliyun:
 *                           type: object
 *                           properties:
 *                             accessKey:
 *                               type: string
 *                             secretKey:
 *                               type: string
 *                             signName:
 *                               type: string
 *                             templateCode:
 *                               type: string
 *                         enabled:
 *                           type: boolean
 *                     webhook:
 *                       type: object
 *                       properties:
 *                         timeout:
 *                           type: number
 *                         retryTimes:
 *                           type: number
 *                         retryDelay:
 *                           type: number
 *                         enabled:
 *                           type: boolean
 *                     general:
 *                       type: object
 *                       properties:
 *                         retryAttempts:
 *                           type: number
 *                         retryDelay:
 *                           type: number
 *                         maxQueueSize:
 *                           type: number
 *       401:
 *         description: 未授权
 *       500:
 *         description: 服务器错误
 */
router.get('/config', [
  protect,
  authorize(['admin', 'security_analyst'])
], async (req, res) => {
  try {
    if (!notificationService) {
      return res.status(503).json({
        success: false,
        message: '通知服务未初始化'
      });
    }

    // 获取当前配置，隐藏敏感信息
    const config = {
      email: {
        smtp: {
          host: notificationService.config.email.smtp.host,
          port: notificationService.config.email.smtp.port,
          secure: notificationService.config.email.smtp.secure,
          auth: {
            user: notificationService.config.email.smtp.auth.user ? '***' : '',
            pass: notificationService.config.email.smtp.auth.pass ? '***' : ''
          }
        },
        from: notificationService.config.email.from,
        enabled: !!(notificationService.config.email.smtp.auth.user && notificationService.config.email.smtp.auth.pass)
      },
      sms: {
        aliyun: {
          accessKey: notificationService.config.sms.aliyun.accessKey ? '***' : '',
          secretKey: notificationService.config.sms.aliyun.secretKey ? '***' : '',
          signName: notificationService.config.sms.aliyun.signName,
          templateCode: notificationService.config.sms.aliyun.templateCode
        },
        enabled: !!(notificationService.config.sms.aliyun.accessKey && notificationService.config.sms.aliyun.secretKey)
      },
      webhook: {
        timeout: notificationService.config.webhook.timeout,
        retryTimes: notificationService.config.webhook.retryTimes,
        retryDelay: notificationService.config.webhook.retryDelay,
        enabled: true // Webhook总是可用的
      },
      general: {
        retryAttempts: notificationService.config.retryAttempts,
        retryDelay: notificationService.config.retryDelay,
        maxQueueSize: notificationService.config.maxQueueSize
      }
    };

    res.json({
      success: true,
      config
    });

  } catch (error) {
    logger.error('获取通知配置失败:', error);
    res.status(500).json({
      success: false,
      message: '获取通知配置失败',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/notifications/config:
 *   put:
 *     summary: 更新通知配置
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: object
 *                 properties:
 *                   smtp:
 *                     type: object
 *                     properties:
 *                       host:
 *                         type: string
 *                       port:
 *                         type: number
 *                       secure:
 *                         type: boolean
 *                       auth:
 *                         type: object
 *                         properties:
 *                           user:
 *                             type: string
 *                           pass:
 *                             type: string
 *                   from:
 *                     type: string
 *               sms:
 *                 type: object
 *                 properties:
 *                   aliyun:
 *                     type: object
 *                     properties:
 *                       accessKey:
 *                         type: string
 *                       secretKey:
 *                         type: string
 *                       signName:
 *                         type: string
 *                       templateCode:
 *                         type: string
 *               webhook:
 *                 type: object
 *                 properties:
 *                   timeout:
 *                     type: number
 *                   retryTimes:
 *                     type: number
 *                   retryDelay:
 *                     type: number
 *               general:
 *                 type: object
 *                 properties:
 *                   retryAttempts:
 *                     type: number
 *                   retryDelay:
 *                     type: number
 *                   maxQueueSize:
 *                     type: number
 *     responses:
 *       200:
 *         description: 更新通知配置成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: 请求参数错误
 *       401:
 *         description: 未授权
 *       500:
 *         description: 服务器错误
 */
router.put('/config', [
  protect,
  authorize(['admin']),
  body('email.smtp.host').optional().isString().withMessage('SMTP主机必须是字符串'),
  body('email.smtp.port').optional().isInt({ min: 1, max: 65535 }).withMessage('SMTP端口必须是1-65535之间的整数'),
  body('email.smtp.secure').optional().isBoolean().withMessage('SMTP安全连接必须是布尔值'),
  body('email.smtp.auth.user').optional().isEmail().withMessage('SMTP用户名必须是有效的邮箱'),
  body('email.smtp.auth.pass').optional().isString().withMessage('SMTP密码必须是字符串'),
  body('email.from').optional().isEmail().withMessage('发件人邮箱必须是有效的邮箱'),
  body('sms.aliyun.accessKey').optional().isString().withMessage('阿里云AccessKey必须是字符串'),
  body('sms.aliyun.secretKey').optional().isString().withMessage('阿里云SecretKey必须是字符串'),
  body('sms.aliyun.signName').optional().isString().withMessage('短信签名必须是字符串'),
  body('sms.aliyun.templateCode').optional().isString().withMessage('短信模板代码必须是字符串'),
  body('webhook.timeout').optional().isInt({ min: 1000, max: 60000 }).withMessage('Webhook超时时间必须是1-60秒'),
  body('webhook.retryTimes').optional().isInt({ min: 0, max: 10 }).withMessage('Webhook重试次数必须是0-10'),
  body('webhook.retryDelay').optional().isInt({ min: 100, max: 10000 }).withMessage('Webhook重试延迟必须是100-10000毫秒'),
  body('general.retryAttempts').optional().isInt({ min: 1, max: 10 }).withMessage('重试次数必须是1-10'),
  body('general.retryDelay').optional().isInt({ min: 100, max: 10000 }).withMessage('重试延迟必须是100-10000毫秒'),
  body('general.maxQueueSize').optional().isInt({ min: 10, max: 10000 }).withMessage('队列大小必须是10-10000')
], async (req, res) => {
  try {
    // 验证请求
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    if (!notificationService) {
      return res.status(503).json({
        success: false,
        message: '通知服务未初始化'
      });
    }

    const { email, sms, webhook, general } = req.body;

    // 更新配置
    if (email) {
      if (email.smtp) {
        Object.assign(notificationService.config.email.smtp, email.smtp);
      }
      if (email.from) {
        notificationService.config.email.from = email.from;
      }
    }

    if (sms && sms.aliyun) {
      Object.assign(notificationService.config.sms.aliyun, sms.aliyun);
    }

    if (webhook) {
      Object.assign(notificationService.config.webhook, webhook);
    }

    if (general) {
      Object.assign(notificationService.config, general);
    }

    // 重新初始化邮件传输器（如果邮件配置有变化）
    if (email && notificationService.config.email.smtp.auth.user && notificationService.config.email.smtp.auth.pass) {
      try {
        notificationService.emailTransporter = nodemailer.createTransporter({
          host: notificationService.config.email.smtp.host,
          port: notificationService.config.email.smtp.port,
          secure: notificationService.config.email.smtp.secure,
          auth: notificationService.config.email.smtp.auth
        });
        
        // 验证邮件配置
        await notificationService.emailTransporter.verify();
        logger.info('邮件服务配置更新成功');
      } catch (error) {
        logger.error('邮件服务配置更新失败:', error);
        return res.status(400).json({
          success: false,
          message: '邮件配置验证失败',
          error: error.message
        });
      }
    }

    logger.info('通知配置已更新');

    res.json({
      success: true,
      message: '通知配置更新成功'
    });

  } catch (error) {
    logger.error('更新通知配置失败:', error);
    res.status(500).json({
      success: false,
      message: '更新通知配置失败',
      error: error.message
    });
  }
});

module.exports = { router, setServices };
