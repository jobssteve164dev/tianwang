const ReportService = require('../../src/services/ReportService');
const logger = require('../../src/utils/logger');
const fs = require('fs').promises;
const path = require('path');

// Mock logger
jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

// Mock fs
jest.mock('fs', () => ({
  promises: {
    access: jest.fn(),
    mkdir: jest.fn(),
    writeFile: jest.fn(),
    readdir: jest.fn(),
    stat: jest.fn(),
    unlink: jest.fn()
  }
}));

describe('ReportService', () => {
  let reportService;
  let mockConfig;

  beforeEach(() => {
    // 重置所有mock
    jest.clearAllMocks();
    
    // Mock配置
    mockConfig = {
      outputPath: './reports',
      retentionDays: 90,
      maxFileSize: '100MB',
      supportedFormats: ['pdf', 'html', 'json', 'csv', 'xlsx']
    };

    // Mock config模块
    jest.doMock('../../src/config', () => mockConfig);
    
    reportService = new ReportService();
  });

  afterEach(async () => {
    if (reportService && reportService.isInitialized) {
      await reportService.cleanup();
    }
  });

  describe('初始化', () => {
    test('应该成功初始化报告服务', async () => {
      // Mock fs.access抛出错误（目录不存在）
      fs.access.mockRejectedValue(new Error('Directory not found'));
      
      await reportService.initialize();
      
      expect(reportService.isInitialized).toBe(true);
      expect(fs.mkdir).toHaveBeenCalledWith('./reports', { recursive: true });
      expect(logger.info).toHaveBeenCalledWith('报告服务初始化完成');
    });

    test('应该在目录已存在时正常初始化', async () => {
      // Mock fs.access成功（目录已存在）
      fs.access.mockResolvedValue();
      
      await reportService.initialize();
      
      expect(reportService.isInitialized).toBe(true);
      expect(fs.mkdir).not.toHaveBeenCalled();
    });
  });

  describe('生成报告', () => {
    beforeEach(async () => {
      fs.access.mockResolvedValue();
      await reportService.initialize();
    });

    test('应该成功生成HTML报告', async () => {
      const options = {
        type: 'threat_summary',
        data: {
          threatCount: 10,
          highThreatCount: 3,
          mediumThreatCount: 5,
          lowThreatCount: 2,
          threats: [
            {
              type: 'malware',
              severity: 'high',
              source: '192.168.1.100',
              timestamp: new Date(),
              description: '恶意软件检测'
            }
          ]
        },
        format: 'html'
      };

      const report = await reportService.generateReport(options);
      
      expect(report.id).toBeTruthy();
      expect(report.fileName).toMatch(/tianwang_threat_summary_\d{8}_\d{6}\.html/);
      expect(report.size).toBeGreaterThan(0);
      expect(report.generatedAt).toBeInstanceOf(Date);
      expect(fs.writeFile).toHaveBeenCalled();
    });

    test('应该成功生成JSON报告', async () => {
      const options = {
        type: 'system_health',
        data: {
          cpuUsage: 45.2,
          memoryUsage: 67.8,
          diskUsage: 23.1,
          networkTraffic: 12.5
        },
        format: 'json'
      };

      const report = await reportService.generateReport(options);
      
      expect(report.format).toBe('json');
      expect(report.fileName).toMatch(/\.json$/);
    });

    test('应该成功生成CSV报告', async () => {
      const options = {
        type: 'weekly_security',
        data: {
          startDate: '2023-01-01',
          endDate: '2023-01-07',
          threatCount: 15,
          actionCount: 8,
          availability: 99.9
        },
        format: 'csv'
      };

      const report = await reportService.generateReport(options);
      
      expect(report.format).toBe('csv');
      expect(report.fileName).toMatch(/\.csv$/);
    });

    test('应该在无效报告类型时抛出错误', async () => {
      const options = {
        type: 'invalid_type',
        data: {},
        format: 'html'
      };

      await expect(reportService.generateReport(options))
        .rejects.toThrow('不支持的报告类型: invalid_type');
    });

    test('应该在无效格式时抛出错误', async () => {
      const options = {
        type: 'threat_summary',
        data: {},
        format: 'invalid_format'
      };

      await expect(reportService.generateReport(options))
        .rejects.toThrow('不支持的输出格式: invalid_format');
    });

    test('应该在服务未初始化时抛出错误', async () => {
      reportService.isInitialized = false;
      
      const options = {
        type: 'threat_summary',
        data: {},
        format: 'html'
      };

      await expect(reportService.generateReport(options))
        .rejects.toThrow('报告服务未初始化');
    });
  });

  describe('导出数据', () => {
    beforeEach(async () => {
      fs.access.mockResolvedValue();
      await reportService.initialize();
    });

    test('应该成功导出JSON数据', async () => {
      const options = {
        type: 'threats',
        format: 'json',
        filters: {},
        fields: []
      };

      const exportInfo = await reportService.exportData(options);
      
      expect(exportInfo.id).toBeTruthy();
      expect(exportInfo.fileName).toMatch(/export_threats_\d{8}_\d{6}\.json/);
      expect(exportInfo.recordCount).toBeGreaterThan(0);
      expect(fs.writeFile).toHaveBeenCalled();
    });

    test('应该成功导出CSV数据', async () => {
      const options = {
        type: 'events',
        format: 'csv',
        filters: {},
        fields: ['id', 'event_type', 'user']
      };

      const exportInfo = await reportService.exportData(options);
      
      expect(exportInfo.format).toBe('csv');
      expect(exportInfo.fileName).toMatch(/\.csv$/);
    });

    test('应该处理空数据导出', async () => {
      // Mock queryData返回空数组
      reportService.queryData = jest.fn().mockResolvedValue([]);
      
      const options = {
        type: 'alerts',
        format: 'json',
        filters: {},
        fields: []
      };

      const exportInfo = await reportService.exportData(options);
      
      expect(exportInfo.recordCount).toBe(0);
    });
  });

  describe('模板渲染', () => {
    test('应该正确渲染威胁汇总模板', () => {
      const template = reportService.getThreatSummaryTemplate();
      const data = {
        generatedAt: '2023-01-01',
        threatCount: 5,
        highThreatCount: 2,
        mediumThreatCount: 2,
        lowThreatCount: 1
      };

      const result = reportService.renderReport(template, data);
      
      expect(result).toContain('天网安全威胁汇总报告');
      expect(result).toContain('5');
      expect(result).toContain('2');
    });

    test('应该正确渲染系统健康模板', () => {
      const template = reportService.getSystemHealthTemplate();
      const data = {
        generatedAt: '2023-01-01',
        cpuUsage: 45.2,
        memoryUsage: 67.8,
        diskUsage: 23.1,
        networkTraffic: 12.5
      };

      const result = reportService.renderReport(template, data);
      
      expect(result).toContain('天网系统健康报告');
      expect(result).toContain('45.2');
      expect(result).toContain('67.8');
    });
  });

  describe('CSV转换', () => {
    test('应该正确转换数组数据为CSV', () => {
      const data = [
        { id: 1, name: 'test1', value: 100 },
        { id: 2, name: 'test2', value: 200 }
      ];

      const csv = reportService.convertToCSV(data);
      
      expect(csv).toContain('id,name,value');
      expect(csv).toContain('1,test1,100');
      expect(csv).toContain('2,test2,200');
    });

    test('应该处理空数组', () => {
      const data = [];
      const csv = reportService.convertToCSV(data);
      
      expect(csv).toBe('');
    });

    test('应该处理非数组数据', () => {
      const data = { key: 'value' };
      const csv = reportService.convertToCSV(data);
      
      expect(csv).toBe(JSON.stringify(data));
    });
  });

  describe('文件管理', () => {
    test('应该生成正确的文件名', () => {
      const fileName = reportService.generateFileName('threat_summary', 'html');
      
      expect(fileName).toMatch(/^tianwang_threat_summary_\d{8}_\d{6}\.html$/);
    });

    test('应该生成唯一的报告ID', () => {
      const id1 = reportService.generateReportId();
      const id2 = reportService.generateReportId();
      
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^report_\d+_[a-z0-9]+$/);
    });
  });

  describe('服务状态', () => {
    test('应该返回正确的服务状态', async () => {
      fs.access.mockResolvedValue();
      await reportService.initialize();
      
      const status = reportService.getStatus();
      
      expect(status.initialized).toBe(true);
      expect(status.reportTypes).toBeDefined();
      expect(status.supportedFormats).toBeDefined();
      expect(status.stats).toBeDefined();
      expect(status.scheduledTasks).toBe(0);
    });
  });

  describe('清理资源', () => {
    test('应该正确清理资源', async () => {
      fs.access.mockResolvedValue();
      await reportService.initialize();
      
      // 添加一个定时任务
      const taskId = 'test-task';
      const task = setInterval(() => {}, 1000);
      reportService.scheduledTasks.set(taskId, task);
      
      await reportService.cleanup();
      
      expect(reportService.scheduledTasks.size).toBe(0);
      expect(logger.info).toHaveBeenCalledWith('报告服务已清理');
    });
  });

  describe('事件处理', () => {
    beforeEach(async () => {
      fs.access.mockResolvedValue();
      await reportService.initialize();
    });

    test('应该发出报告生成成功事件', async () => {
      const mockListener = jest.fn();
      reportService.on('report_generated', mockListener);

      const options = {
        type: 'threat_summary',
        data: { threatCount: 5 },
        format: 'html'
      };

      await reportService.generateReport(options);
      
      expect(mockListener).toHaveBeenCalled();
    });

    test('应该发出数据导出成功事件', async () => {
      const mockListener = jest.fn();
      reportService.on('data_exported', mockListener);

      const options = {
        type: 'threats',
        format: 'json',
        filters: {},
        fields: []
      };

      await reportService.exportData(options);
      
      expect(mockListener).toHaveBeenCalled();
    });
  });
});
