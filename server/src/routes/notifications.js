const express = require('express');
const { body, validationResult } = require('express-validator');
const logger = require('../utils/logger');
const { protect, authorize } = require('../middleware/auth');

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

module.exports = { router, setServices };
