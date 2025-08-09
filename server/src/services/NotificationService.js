const EventEmitter = require('events');
const nodemailer = require('nodemailer');
const axios = require('axios');
const crypto = require('crypto');
const logger = require('../utils/logger');
const config = require('../config');

/**
 * 通知服务
 * 统一处理邮件、短信、Webhook等多种通知方式
 */
class NotificationService extends EventEmitter {
  constructor() {
    super();
    this.isInitialized = false;
    this.emailTransporter = null;
    this.notificationQueue = [];
    this.processingQueue = false;
        
    // 通知配置
    this.config = {
      email: config.email,
      sms: config.sms,
      webhook: config.webhook,
      retryAttempts: 3,
      retryDelay: 1000,
      maxQueueSize: 1000
    };
        
    // 通知模板
    this.templates = {
      threat_alert: {
        email: {
          subject: '天网安全警报 - 检测到安全威胁',
          template: 'threat-alert-email.html'
        },
        sms: {
          template: 'threat-alert-sms.txt'
        }
      },
      system_alert: {
        email: {
          subject: '天网系统警报',
          template: 'system-alert-email.html'
        },
        sms: {
          template: 'system-alert-sms.txt'
        }
      },
      weekly_report: {
        email: {
          subject: '天网安全周报',
          template: 'weekly-report-email.html'
        }
      }
    };
        
    // 统计信息
    this.stats = {
      totalSent: 0,
      emailSent: 0,
      smsSent: 0,
      webhookSent: 0,
      failedAttempts: 0,
      lastSentTime: null
    };
  }
    
  /**
     * 初始化通知服务
     */
  async initialize() {
    try {
      logger.info('正在初始化通知服务...');
            
      // 初始化邮件传输器
      if (this.config.email.smtp.auth.user && this.config.email.smtp.auth.pass) {
        this.emailTransporter = nodemailer.createTransporter({
          host: this.config.email.smtp.host,
          port: this.config.email.smtp.port,
          secure: this.config.email.smtp.secure,
          auth: this.config.email.smtp.auth
        });
                
        // 验证邮件配置
        await this.emailTransporter.verify();
        logger.info('邮件服务初始化成功');
      } else {
        logger.warn('邮件配置不完整，邮件通知功能将不可用');
      }
            
      // 验证短信配置
      if (this.config.sms.aliyun.accessKey && this.config.sms.aliyun.secretKey) {
        logger.info('短信服务配置验证通过');
      } else {
        logger.warn('短信配置不完整，短信通知功能将不可用');
      }
            
      this.isInitialized = true;
      logger.info('通知服务初始化完成');
            
      // 启动队列处理
      this.startQueueProcessing();
            
    } catch (error) {
      logger.error('通知服务初始化失败:', error);
      throw error;
    }
  }
    
  /**
     * 发送通知
     * @param {Object} notification 通知对象
     * @param {string} notification.type 通知类型 (email|sms|webhook)
     * @param {string} notification.template 模板名称
     * @param {Object} notification.data 模板数据
     * @param {Array} notification.recipients 接收者列表
     * @param {Object} notification.options 额外选项
     */
  async sendNotification(notification) {
    if (!this.isInitialized) {
      throw new Error('通知服务未初始化');
    }
        
    // 添加到队列
    if (this.notificationQueue.length >= this.config.maxQueueSize) {
      logger.warn('通知队列已满，丢弃新通知');
      return false;
    }
        
    const notificationItem = {
      id: crypto.randomUUID(),
      ...notification,
      timestamp: Date.now(),
      attempts: 0
    };
        
    this.notificationQueue.push(notificationItem);
    logger.debug(`通知已加入队列: ${notificationItem.id}`);
        
    return notificationItem.id;
  }
    
  /**
     * 启动队列处理
     */
  startQueueProcessing() {
    if (this.processingQueue) return;
        
    this.processingQueue = true;
    this.processQueue();
  }
    
  /**
     * 处理通知队列
     */
  async processQueue() {
    while (this.processingQueue && this.notificationQueue.length > 0) {
      const notification = this.notificationQueue.shift();
            
      try {
        await this.processNotification(notification);
      } catch (error) {
        logger.error(`处理通知失败: ${notification.id}`, error);
                
        // 重试逻辑
        if (notification.attempts < this.config.retryAttempts) {
          notification.attempts++;
          setTimeout(() => {
            this.notificationQueue.unshift(notification);
          }, this.config.retryDelay * notification.attempts);
        } else {
          this.stats.failedAttempts++;
          this.emit('notification_failed', notification, error);
        }
      }
    }
        
    // 继续处理队列
    if (this.processingQueue) {
      setTimeout(() => this.processQueue(), 100);
    }
  }
    
  /**
     * 处理单个通知
     */
  async processNotification(notification) {
    logger.debug(`处理通知: ${notification.id}, 类型: ${notification.type}`);
        
    switch (notification.type) {
    case 'email':
      await this.sendEmail(notification);
      break;
    case 'sms':
      await this.sendSMS(notification);
      break;
    case 'webhook':
      await this.sendWebhook(notification);
      break;
    case 'all':
      await Promise.all([
        this.sendEmail(notification),
        this.sendSMS(notification),
        this.sendWebhook(notification)
      ]);
      break;
    default:
      throw new Error(`不支持的通知类型: ${notification.type}`);
    }
        
    this.stats.totalSent++;
    this.stats.lastSentTime = Date.now();
    this.emit('notification_sent', notification);
  }
    
  /**
     * 发送邮件通知
     */
  async sendEmail(notification) {
    if (!this.emailTransporter) {
      throw new Error('邮件服务未配置');
    }
        
    const template = this.templates[notification.template]?.email;
    if (!template) {
      throw new Error(`邮件模板不存在: ${notification.template}`);
    }
        
    const emailContent = await this.renderEmailTemplate(
      template.template,
      notification.data
    );
        
    const mailOptions = {
      from: this.config.email.from,
      to: notification.recipients.join(', '),
      subject: template.subject,
      html: emailContent
    };
        
    const result = await this.emailTransporter.sendMail(mailOptions);
    this.stats.emailSent++;
        
    logger.info(`邮件发送成功: ${result.messageId}`);
    return result;
  }
    
  /**
     * 发送短信通知
     */
  async sendSMS(notification) {
    if (!this.config.sms.aliyun.accessKey) {
      throw new Error('短信服务未配置');
    }
        
    const template = this.templates[notification.template]?.sms;
    if (!template) {
      throw new Error(`短信模板不存在: ${notification.template}`);
    }
        
    const smsContent = await this.renderSMSTemplate(
      template.template,
      notification.data
    );
        
    // 阿里云短信API调用
    const result = await this.callAliyunSMS({
      phoneNumbers: notification.recipients.join(','),
      signName: this.config.sms.aliyun.signName,
      templateCode: this.config.sms.aliyun.templateCode,
      templateParam: JSON.stringify(notification.data)
    });
        
    this.stats.smsSent++;
    logger.info(`短信发送成功: ${result.requestId}`);
    return result;
  }
    
  /**
     * 发送Webhook通知
     */
  async sendWebhook(notification) {
    if (!notification.options?.webhookUrl) {
      throw new Error('Webhook URL未提供');
    }
        
    const webhookData = {
      id: notification.id,
      type: notification.template,
      data: notification.data,
      timestamp: notification.timestamp,
      source: 'tianwang-security'
    };
        
    const result = await axios.post(
      notification.options.webhookUrl,
      webhookData,
      {
        timeout: this.config.webhook.timeout,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'TianWang-Security/1.0',
          ...notification.options.headers
        }
      }
    );
        
    this.stats.webhookSent++;
    logger.info(`Webhook发送成功: ${result.status}`);
    return result;
  }
    
  /**
     * 渲染邮件模板
     */
  async renderEmailTemplate(templateName, data) {
    // 这里应该从文件系统或数据库加载模板
    // 暂时使用简单的字符串替换
    const templates = {
      'threat-alert-email.html': `
                <html>
                <body>
                    <h2>天网安全警报</h2>
                    <p>检测到安全威胁:</p>
                    <ul>
                        <li>威胁类型: ${data.threatType || '未知'}</li>
                        <li>威胁级别: ${data.severity || '中等'}</li>
                        <li>来源: ${data.source || '未知'}</li>
                        <li>时间: ${new Date(data.timestamp).toLocaleString()}</li>
                    </ul>
                    <p>请及时处理此安全事件。</p>
                </body>
                </html>
            `,
      'system-alert-email.html': `
                <html>
                <body>
                    <h2>天网系统警报</h2>
                    <p>系统状态异常:</p>
                    <ul>
                        <li>警报类型: ${data.alertType || '未知'}</li>
                        <li>描述: ${data.description || '无'}</li>
                        <li>时间: ${new Date(data.timestamp).toLocaleString()}</li>
                    </ul>
                </body>
                </html>
            `,
      'weekly-report-email.html': `
                <html>
                <body>
                    <h2>天网安全周报</h2>
                    <p>本周安全概况:</p>
                    <ul>
                        <li>威胁检测次数: ${data.threatCount || 0}</li>
                        <li>防护动作次数: ${data.actionCount || 0}</li>
                        <li>系统可用性: ${data.availability || '100%'}</li>
                    </ul>
                </body>
                </html>
            `
    };
        
    return templates[templateName] || '模板不存在';
  }
    
  /**
     * 渲染短信模板
     */
  async renderSMSTemplate(templateName, data) {
    const templates = {
      'threat-alert-sms.txt': `天网安全警报:检测到${data.threatType || '未知'}威胁,级别${data.severity || '中等'},请及时处理`,
      'system-alert-sms.txt': `天网系统警报:${data.alertType || '未知'}异常,请检查系统状态`
    };
        
    return templates[templateName] || '模板不存在';
  }
    
  /**
     * 调用阿里云短信API
     */
  async callAliyunSMS(params) {
    // 这里应该实现阿里云短信API的具体调用
    // 暂时返回模拟结果
    logger.debug('调用阿里云短信API:', params);
        
    return {
      requestId: crypto.randomUUID(),
      code: 'OK',
      message: '发送成功'
    };
  }
    
  /**
     * 获取服务状态
     */
  getStatus() {
    return {
      initialized: this.isInitialized,
      queueSize: this.notificationQueue.length,
      processing: this.processingQueue,
      stats: this.stats,
      config: {
        email: !!this.emailTransporter,
        sms: !!(this.config.sms.aliyun.accessKey),
        webhook: true
      }
    };
  }
    
  /**
     * 清理资源
     */
  async cleanup() {
    this.processingQueue = false;
        
    if (this.emailTransporter) {
      this.emailTransporter.close();
    }
        
    logger.info('通知服务已清理');
  }
}

module.exports = NotificationService;
