#!/usr/bin/env node
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
  console.log('🔍 开始系统健康检查...\n');
  
  const results = await Promise.all(services.map(checkHealth));
  
  results.forEach(result => {
    const status = result.status === 'healthy' ? '✅' : '❌';
    console.log(`${status} ${result.name}: ${result.status} (${result.statusCode})`);
  });
  
  const allHealthy = results.every(r => r.status === 'healthy');
  console.log(`\n${allHealthy ? '🎉' : '⚠️'} 系统状态: ${allHealthy ? '全部正常' : '存在问题'}`);
  
  process.exit(allHealthy ? 0 : 1);
}

runHealthCheck();
