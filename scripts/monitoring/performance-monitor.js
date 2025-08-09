#!/usr/bin/env node
/**
 * 性能监控脚本
 */

const os = require('os');
const fs = require('fs');
const path = require('path');

class PerformanceMonitor {
  constructor() {
    this.logFile = path.join(__dirname, '../../logs/performance.log');
    this.interval = 60000; // 1分钟
  }

  getSystemMetrics() {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    
    return {
      timestamp: new Date().toISOString(),
      cpu: {
        loadAverage: os.loadavg(),
        cores: os.cpus().length
      },
      memory: {
        total: totalMem,
        used: usedMem,
        free: freeMem,
        usagePercent: (usedMem / totalMem * 100).toFixed(2)
      },
      uptime: os.uptime(),
      platform: os.platform(),
      arch: os.arch()
    };
  }

  logMetrics(metrics) {
    const logEntry = JSON.stringify(metrics) + '\n';
    fs.appendFileSync(this.logFile, logEntry);
  }

  start() {
    console.log('📊 开始性能监控...');
    
    setInterval(() => {
      const metrics = this.getSystemMetrics();
      this.logMetrics(metrics);
      
      // 检查告警条件
      this.checkAlerts(metrics);
    }, this.interval);
  }

  checkAlerts(metrics) {
    const alerts = [];
    
    // CPU告警
    const cpuLoad = metrics.cpu.loadAverage[0];
    if (cpuLoad > metrics.cpu.cores * 0.8) {
      alerts.push(`CPU负载过高: ${cpuLoad.toFixed(2)}`);
    }
    
    // 内存告警
    const memUsage = parseFloat(metrics.memory.usagePercent);
    if (memUsage > 85) {
      alerts.push(`内存使用率过高: ${memUsage}%`);
    }
    
    if (alerts.length > 0) {
      console.log('⚠️  性能告警:', alerts.join(', '));
    }
  }
}

const monitor = new PerformanceMonitor();
monitor.start();
