/**
 * 系统监控配置脚本
 * Monitoring Setup Script
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class MonitoringSetup {
  constructor() {
    this.configDir = path.join(__dirname, '../../config/monitoring');
    this.scriptsDir = path.join(__dirname, '../monitoring');
  }

  /**
   * 创建监控配置目录
   */
  createDirectories() {
    const dirs = [
      this.configDir,
      this.scriptsDir,
      path.join(this.configDir, 'alerts'),
      path.join(this.configDir, 'dashboards'),
      path.join(this.configDir, 'rules')
    ];

    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`✅ 创建目录: ${dir}`);
      }
    });
  }

  /**
   * 创建Prometheus配置
   */
  createPrometheusConfig() {
    const config = `# Prometheus配置 - 天网安全监控系统
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "rules/*.yml"

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093

scrape_configs:
  # 后端API服务监控
  - job_name: 'tianwang-server'
    static_configs:
      - targets: ['server:8000']
    metrics_path: '/api/metrics'
    scrape_interval: 30s

  # 前端应用监控
  - job_name: 'tianwang-client'
    static_configs:
      - targets: ['client:8080']
    metrics_path: '/metrics'
    scrape_interval: 30s

  # AI引擎监控
  - job_name: 'tianwang-ai-engine'
    static_configs:
      - targets: ['ai-engine:8888']
    metrics_path: '/metrics'
    scrape_interval: 30s

  # 数据库监控
  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres:5432']
    scrape_interval: 60s

  # Redis监控
  - job_name: 'redis'
    static_configs:
      - targets: ['redis:6379']
    scrape_interval: 30s

  # Kafka监控
  - job_name: 'kafka'
    static_configs:
      - targets: ['kafka:9092']
    scrape_interval: 30s

  # 系统监控
  - job_name: 'node-exporter'
    static_configs:
      - targets: ['node-exporter:9100']
    scrape_interval: 15s
`;

    const configPath = path.join(this.configDir, 'prometheus.yml');
    fs.writeFileSync(configPath, config);
    console.log('✅ 创建Prometheus配置');
  }

  /**
   * 创建告警规则
   */
  createAlertRules() {
    const rules = [
      {
        name: 'server-down.yml',
        content: `groups:
- name: tianwang-server
  rules:
  - alert: ServerDown
    expr: up{job="tianwang-server"} == 0
    for: 1m
    labels:
      severity: critical
    annotations:
      summary: "服务器 {{ $labels.instance }} 已下线"
      description: "服务器 {{ $labels.instance }} 已停止响应超过1分钟"

  - alert: HighCPUUsage
    expr: rate(process_cpu_seconds_total{job="tianwang-server"}[5m]) * 100 > 80
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "服务器CPU使用率过高"
      description: "服务器 {{ $labels.instance }} CPU使用率超过80%"

  - alert: HighMemoryUsage
    expr: (process_resident_memory_bytes{job="tianwang-server"} / container_memory_usage_bytes{job="tianwang-server"}) * 100 > 85
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "服务器内存使用率过高"
      description: "服务器 {{ $labels.instance }} 内存使用率超过85%"

  - alert: HighResponseTime
    expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket{job="tianwang-server"}[5m])) > 2
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "API响应时间过长"
      description: "服务器 {{ $labels.instance }} 95%响应时间超过2秒"`
      },
      {
        name: 'database-alerts.yml',
        content: `groups:
- name: database
  rules:
  - alert: DatabaseDown
    expr: up{job="postgres"} == 0
    for: 1m
    labels:
      severity: critical
    annotations:
      summary: "数据库 {{ $labels.instance }} 已下线"
      description: "PostgreSQL数据库已停止响应"

  - alert: HighDatabaseConnections
    expr: pg_stat_database_numbackends{job="postgres"} > 100
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "数据库连接数过高"
      description: "数据库连接数超过100个"

  - alert: SlowQueries
    expr: rate(pg_stat_activity_max_tx_duration{job="postgres"}[5m]) > 30
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "数据库查询缓慢"
      description: "存在执行时间超过30秒的查询"`
      },
      {
        name: 'security-alerts.yml',
        content: `groups:
- name: security
  rules:
  - alert: HighFailedLogins
    expr: rate(security_failed_logins_total[5m]) > 10
    for: 2m
    labels:
      severity: critical
    annotations:
      summary: "登录失败次数异常"
      description: "5分钟内登录失败次数超过10次，可能存在暴力破解攻击"

  - alert: HighSecurityEvents
    expr: rate(security_events_total{severity="critical"}[5m]) > 5
    for: 2m
    labels:
      severity: critical
    annotations:
      summary: "严重安全事件激增"
      description: "5分钟内严重安全事件超过5个"

  - alert: UnauthorizedAccess
    expr: rate(security_unauthorized_access_total[5m]) > 3
    for: 2m
    labels:
      severity: critical
    annotations:
      summary: "未授权访问尝试"
      description: "检测到多次未授权访问尝试"

  - alert: DataExfiltration
    expr: rate(security_data_exfiltration_total[5m]) > 0
    for: 1m
    labels:
      severity: critical
    annotations:
      summary: "数据泄露检测"
      description: "检测到可能的数据泄露行为"`
      }
    ];

    rules.forEach(rule => {
      const rulePath = path.join(this.configDir, 'rules', rule.name);
      fs.writeFileSync(rulePath, rule.content);
      console.log(`✅ 创建告警规则: ${rule.name}`);
    });
  }

  /**
   * 创建Grafana仪表板配置
   */
  createGrafanaDashboards() {
    const dashboardConfig = {
      server: {
        title: '天网服务器监控',
        panels: [
          {
            title: 'CPU使用率',
            type: 'graph',
            targets: [
              {
                expr: 'rate(process_cpu_seconds_total{job="tianwang-server"}[5m]) * 100',
                legendFormat: 'CPU %'
              }
            ]
          },
          {
            title: '内存使用率',
            type: 'graph',
            targets: [
              {
                expr: '(process_resident_memory_bytes{job="tianwang-server"} / container_memory_usage_bytes{job="tianwang-server"}) * 100',
                legendFormat: 'Memory %'
              }
            ]
          },
          {
            title: 'API响应时间',
            type: 'graph',
            targets: [
              {
                expr: 'histogram_quantile(0.95, rate(http_request_duration_seconds_bucket{job="tianwang-server"}[5m]))',
                legendFormat: '95th percentile'
              }
            ]
          },
          {
            title: '请求速率',
            type: 'graph',
            targets: [
              {
                expr: 'rate(http_requests_total{job="tianwang-server"}[5m])',
                legendFormat: 'Requests/sec'
              }
            ]
          }
        ]
      },
      security: {
        title: '安全事件监控',
        panels: [
          {
            title: '安全事件趋势',
            type: 'graph',
            targets: [
              {
                expr: 'rate(security_events_total[5m])',
                legendFormat: 'Events/sec'
              }
            ]
          },
          {
            title: '威胁检测统计',
            type: 'stat',
            targets: [
              {
                expr: 'security_threats_detected_total',
                legendFormat: 'Total Threats'
              }
            ]
          },
          {
            title: '设备在线状态',
            type: 'table',
            targets: [
              {
                expr: 'device_status{status="online"}',
                legendFormat: 'Online Devices'
              }
            ]
          }
        ]
      }
    };

    Object.entries(dashboardConfig).forEach(([name, config]) => {
      const dashboardPath = path.join(this.configDir, 'dashboards', `${name}-dashboard.json`);
      fs.writeFileSync(dashboardPath, JSON.stringify(config, null, 2));
      console.log(`✅ 创建Grafana仪表板: ${name}`);
    });
  }

  /**
   * 创建监控脚本
   */
  createMonitoringScripts() {
    const scripts = [
      {
        name: 'health-check.js',
        content: `#!/usr/bin/env node
/**
 * 系统健康检查脚本
 */

const http = require('http');
const https = require('https');

const services = [
  { name: 'API Server', url: 'http://localhost:8000/health' },
  { name: 'Frontend', url: 'http://localhost:3000' },
  { name: 'AI Engine', url: 'http://localhost:8888/health' }
];

async function checkHealth(service) {
  return new Promise((resolve) => {
    const client = service.url.startsWith('https') ? https : http;
    
    const req = client.get(service.url, (res) => {
      resolve({
        name: service.name,
        status: res.statusCode === 200 ? 'healthy' : 'unhealthy',
        statusCode: res.statusCode
      });
    });

    req.on('error', () => {
      resolve({
        name: service.name,
        status: 'unhealthy',
        statusCode: 0
      });
    });

    req.setTimeout(5000, () => {
      req.destroy();
      resolve({
        name: service.name,
        status: 'timeout',
        statusCode: 0
      });
    });
  });
}

async function runHealthCheck() {
  console.log('🔍 开始系统健康检查...\\n');
  
  const results = await Promise.all(services.map(checkHealth));
  
  results.forEach(result => {
    const status = result.status === 'healthy' ? '✅' : '❌';
    console.log(\`\${status} \${result.name}: \${result.status} (\${result.statusCode})\`);
  });
  
  const allHealthy = results.every(r => r.status === 'healthy');
  console.log(\`\\n\${allHealthy ? '🎉' : '⚠️'} 系统状态: \${allHealthy ? '全部正常' : '存在问题'}\`);
  
  process.exit(allHealthy ? 0 : 1);
}

runHealthCheck();
`
      },
      {
        name: 'performance-monitor.js',
        content: `#!/usr/bin/env node
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
    const logEntry = JSON.stringify(metrics) + '\\n';
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
      alerts.push(\`CPU负载过高: \${cpuLoad.toFixed(2)}\`);
    }
    
    // 内存告警
    const memUsage = parseFloat(metrics.memory.usagePercent);
    if (memUsage > 85) {
      alerts.push(\`内存使用率过高: \${memUsage}%\`);
    }
    
    if (alerts.length > 0) {
      console.log('⚠️  性能告警:', alerts.join(', '));
    }
  }
}

const monitor = new PerformanceMonitor();
monitor.start();
`
      }
    ];

    scripts.forEach(script => {
      const scriptPath = path.join(this.scriptsDir, script.name);
      fs.writeFileSync(scriptPath, script.content);
      
      // 设置执行权限
      try {
        execSync(`chmod +x ${scriptPath}`);
      } catch (error) {
        console.log(`⚠️  无法设置执行权限: ${scriptPath}`);
      }
      
      console.log(`✅ 创建监控脚本: ${script.name}`);
    });
  }

  /**
   * 创建Docker Compose监控配置
   */
  createMonitoringCompose() {
    const composeConfig = `# 监控服务配置
version: '3.8'

services:
  # Prometheus - 指标收集
  prometheus:
    image: prom/prometheus:latest
    container_name: tianwang-prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./config/monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
      - ./config/monitoring/rules:/etc/prometheus/rules
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'
      - '--storage.tsdb.retention.time=200h'
      - '--web.enable-lifecycle'
    networks:
      - tianwang-network

  # Grafana - 可视化
  grafana:
    image: grafana/grafana:latest
    container_name: tianwang-grafana
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin123
    volumes:
      - ./config/monitoring/dashboards:/etc/grafana/provisioning/dashboards
      - grafana_data:/var/lib/grafana
    networks:
      - tianwang-network

  # AlertManager - 告警管理
  alertmanager:
    image: prom/alertmanager:latest
    container_name: tianwang-alertmanager
    ports:
      - "9093:9093"
    volumes:
      - ./config/monitoring/alertmanager.yml:/etc/alertmanager/alertmanager.yml
      - alertmanager_data:/alertmanager
    command:
      - '--config.file=/etc/alertmanager/alertmanager.yml'
      - '--storage.path=/alertmanager'
    networks:
      - tianwang-network

  # Node Exporter - 系统指标
  node-exporter:
    image: prom/node-exporter:latest
    container_name: tianwang-node-exporter
    ports:
      - "9100:9100"
    volumes:
      - /proc:/host/proc:ro
      - /sys:/host/sys:ro
      - /:/rootfs:ro
    command:
      - '--path.procfs=/host/proc'
      - '--path.sysfs=/host/sys'
      - '--collector.filesystem.mount-points-exclude=^/(sys|proc|dev|host|etc)($$|/)'
    networks:
      - tianwang-network

volumes:
  prometheus_data:
  grafana_data:
  alertmanager_data:

networks:
  tianwang-network:
    external: true
`;

    const composePath = path.join(__dirname, '../../docker-compose.monitoring.yml');
    fs.writeFileSync(composePath, composeConfig);
    console.log('✅ 创建监控Docker Compose配置');
  }

  /**
   * 运行完整设置
   */
  run() {
    console.log('🚀 开始设置监控系统...\n');
    
    this.createDirectories();
    this.createPrometheusConfig();
    this.createAlertRules();
    this.createGrafanaDashboards();
    this.createMonitoringScripts();
    this.createMonitoringCompose();
    
    console.log('\n🎉 监控系统设置完成！');
    console.log('\n📋 下一步操作:');
    console.log('1. 启动监控服务: docker-compose -f docker-compose.monitoring.yml up -d');
    console.log('2. 访问Grafana: http://localhost:3001 (admin/admin123)');
    console.log('3. 访问Prometheus: http://localhost:9090');
    console.log('4. 访问AlertManager: http://localhost:9093');
  }
}

// 如果直接运行此文件
if (require.main === module) {
  const setup = new MonitoringSetup();
  setup.run();
}

module.exports = MonitoringSetup;
