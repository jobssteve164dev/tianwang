const express = require('express');
const { body, query, validationResult } = require('express-validator');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// 报告服务实例（将在主应用中初始化）
let reportService = null;

// 设置服务实例的方法
function setServices(report) {
  reportService = report;
}

/**
 * @swagger
 * components:
 *   schemas:
 *     ReportRequest:
 *       type: object
 *       required:
 *         - type
 *       properties:
 *         type:
 *           type: string
 *           enum: [threat_summary, system_health, weekly_security, monthly_audit, incident_report]
 *           description: 报告类型
 *         data:
 *           type: object
 *           description: 报告数据
 *         format:
 *           type: string
 *           enum: [html, json, csv]
 *           default: html
 *           description: 输出格式
 *         filters:
 *           type: object
 *           description: 数据过滤条件
 */

/**
 * @swagger
 * /api/reports/generate:
 *   post:
 *     summary: 生成报告
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ReportRequest'
 *     responses:
 *       200:
 *         description: 报告生成成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 report:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     fileName:
 *                       type: string
 *                     filePath:
 *                       type: string
 *                     size:
 *                       type: number
 *                     generatedAt:
 *                       type: string
 *       400:
 *         description: 请求参数错误
 *       401:
 *         description: 未授权
 *       500:
 *         description: 服务器错误
 */
router.post('/generate', [
  protect,
  authorize(['admin', 'analyst', 'super_admin']),
  body('type').isIn(['threat_summary', 'system_health', 'weekly_security', 'monthly_audit', 'incident_report'])
    .withMessage('无效的报告类型'),
  body('format').optional().isIn(['html', 'json', 'csv']).withMessage('无效的输出格式')
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

    if (!reportService) {
      return res.status(503).json({
        success: false,
        message: '报告服务未初始化'
      });
    }

    const { type, data, format = 'html', filters = {} } = req.body;

    // 生成报告
    const report = await reportService.generateReport({
      type,
      data,
      format,
      filters
    });

    logger.info(`报告生成成功: ${report.fileName}, 类型: ${type}, 格式: ${format}`);

    res.json({
      success: true,
      report: {
        id: report.id,
        fileName: report.fileName,
        filePath: report.filePath,
        size: report.size,
        generatedAt: report.generatedAt
      }
    });

  } catch (error) {
    logger.error('生成报告失败:', error);
    res.status(500).json({
      success: false,
      message: '生成报告失败',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/reports/export:
 *   post:
 *     summary: 导出数据
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - type
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [threats, events, alerts]
 *                 description: 数据类型
 *               format:
 *                 type: string
 *                 enum: [json, csv]
 *                 default: json
 *                 description: 导出格式
 *               filters:
 *                 type: object
 *                 description: 过滤条件
 *               fields:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: 导出字段
 *     responses:
 *       200:
 *         description: 数据导出成功
 *       400:
 *         description: 请求参数错误
 *       500:
 *         description: 服务器错误
 */
router.post('/export', [
  protect,
  authorize(['admin', 'analyst', 'super_admin']),
  body('type').isIn(['threats', 'events', 'alerts']).withMessage('无效的数据类型'),
  body('format').optional().isIn(['json', 'csv']).withMessage('无效的导出格式')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    if (!reportService) {
      return res.status(503).json({
        success: false,
        message: '报告服务未初始化'
      });
    }

    const { type, format = 'json', filters = {}, fields = [] } = req.body;

    // 导出数据
    const exportInfo = await reportService.exportData({
      type,
      format,
      filters,
      fields
    });

    logger.info(`数据导出成功: ${exportInfo.fileName}, 类型: ${type}, 格式: ${format}`);

    res.json({
      success: true,
      export: {
        id: exportInfo.id,
        fileName: exportInfo.fileName,
        filePath: exportInfo.filePath,
        size: exportInfo.size,
        exportedAt: exportInfo.exportedAt,
        recordCount: exportInfo.recordCount
      }
    });

  } catch (error) {
    logger.error('导出数据失败:', error);
    res.status(500).json({
      success: false,
      message: '导出数据失败',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/reports/download/{fileName}:
 *   get:
 *     summary: 下载报告文件
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: fileName
 *         required: true
 *         schema:
 *           type: string
 *         description: 文件名
 *     responses:
 *       200:
 *         description: 文件下载成功
 *       404:
 *         description: 文件不存在
 *       500:
 *         description: 服务器错误
 */
router.get('/download/:fileName', [
  protect,
  authorize(['admin', 'analyst', 'super_admin'])
], async (req, res) => {
  try {
    const { fileName } = req.params;
        
    if (!reportService) {
      return res.status(503).json({
        success: false,
        message: '报告服务未初始化'
      });
    }

    const filePath = path.join(reportService.config.outputPath, fileName);

    // 检查文件是否存在
    try {
      await fs.access(filePath);
    } catch (error) {
      return res.status(404).json({
        success: false,
        message: '文件不存在'
      });
    }

    // 获取文件信息
    const stats = await fs.stat(filePath);
    const ext = path.extname(fileName).toLowerCase();

    // 设置响应头
    res.setHeader('Content-Type', getContentType(ext));
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', stats.size);

    // 发送文件
    res.sendFile(filePath);

    logger.info(`文件下载: ${fileName}`);

  } catch (error) {
    logger.error('文件下载失败:', error);
    res.status(500).json({
      success: false,
      message: '文件下载失败',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/reports/list:
 *   get:
 *     summary: 获取报告列表
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *         description: 报告类型过滤
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *         description: 格式过滤
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: 返回数量限制
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: 偏移量
 *     responses:
 *       200:
 *         description: 报告列表
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 reports:
 *                   type: array
 *                   items:
 *                     type: object
 *                 total:
 *                   type: number
 */
router.get('/list', [
  protect,
  authorize(['admin', 'analyst', 'super_admin']),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('限制数量必须在1-100之间'),
  query('offset').optional().isInt({ min: 0 }).withMessage('偏移量必须大于等于0')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    if (!reportService) {
      return res.status(503).json({
        success: false,
        message: '报告服务未初始化'
      });
    }

    const { type, format, limit = 20, offset = 0 } = req.query;

    // 获取报告列表
    const reports = await getReportList(type, format, parseInt(limit), parseInt(offset));

    res.json({
      success: true,
      reports: reports.files,
      total: reports.total
    });

  } catch (error) {
    logger.error('获取报告列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取报告列表失败',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/reports/status:
 *   get:
 *     summary: 获取报告服务状态
 *     tags: [Reports]
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
 */
router.get('/status', [
  protect,
  authorize(['admin', 'analyst', 'super_admin'])
], async (req, res) => {
  try {
    if (!reportService) {
      return res.status(503).json({
        success: false,
        message: '报告服务未初始化'
      });
    }

    const status = reportService.getStatus();

    res.json({
      success: true,
      status
    });

  } catch (error) {
    logger.error('获取报告服务状态失败:', error);
    res.status(500).json({
      success: false,
      message: '获取服务状态失败',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/reports/types:
 *   get:
 *     summary: 获取支持的报告类型
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 报告类型列表
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 types:
 *                   type: object
 */
router.get('/types', [
  protect,
  authorize(['admin', 'analyst', 'super_admin'])
], async (req, res) => {
  try {
    if (!reportService) {
      return res.status(503).json({
        success: false,
        message: '报告服务未初始化'
      });
    }

    res.json({
      success: true,
      types: reportService.reportTypes
    });

  } catch (error) {
    logger.error('获取报告类型失败:', error);
    res.status(500).json({
      success: false,
      message: '获取报告类型失败',
      error: error.message
    });
  }
});

// 辅助方法
function getContentType(ext) {
  const contentTypes = {
    '.html': 'text/html',
    '.json': 'application/json',
    '.csv': 'text/csv',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.pdf': 'application/pdf'
  };
    
  return contentTypes[ext] || 'application/octet-stream';
}

async function getReportList(type, format, limit, offset) {
  try {
    const files = await fs.readdir(reportService.config.outputPath);
    let filteredFiles = files;

    // 按类型过滤
    if (type) {
      filteredFiles = filteredFiles.filter(file => file.includes(type));
    }

    // 按格式过滤
    if (format) {
      filteredFiles = filteredFiles.filter(file => file.endsWith(`.${format}`));
    }

    // 获取文件信息
    const fileInfos = await Promise.all(
      filteredFiles.map(async (fileName) => {
        const filePath = path.join(reportService.config.outputPath, fileName);
        const stats = await fs.stat(filePath);
                
        return {
          fileName,
          filePath,
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime
        };
      })
    );

    // 按修改时间排序（最新的在前）
    fileInfos.sort((a, b) => b.modified - a.modified);

    // 分页
    const total = fileInfos.length;
    const paginatedFiles = fileInfos.slice(offset, offset + limit);

    return {
      files: paginatedFiles,
      total
    };

  } catch (error) {
    logger.error('获取报告列表失败:', error);
    throw error;
  }
}

module.exports = { router, setServices };
