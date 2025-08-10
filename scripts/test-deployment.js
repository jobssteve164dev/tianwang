#!/usr/bin/env node
/**
 * 测试部署脚本
 * Test Deployment Script
 */

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

class TestDeployment {
  constructor() {
    this.processes = [];
    this.testResults = [];
  }

  /**
   * 检查端口是否可用
   */
  async checkPort(port) {
    return new Promise((resolve) => {
      const req = http.request({
        host: 'localhost',
        port: port,
        method: 'HEAD',
        timeout: 2000
      }, (res) => {
        resolve(true);
      });

      req.on('error', () => {
        resolve(false);
      });

      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });

      req.end();
    });
  }

  /**
   * 启动服务
   */
  startService(name, command, cwd, env = {}) {
    console.log(`🚀 启动 ${name}...`);
    
    const process = spawn(command, [], {
      cwd: cwd,
      env: { ...process.env, ...env },
      stdio: 'pipe',
      shell: true
    });

    process.stdout.on('data', (data) => {
      console.log(`[${name}] ${data.toString().trim()}`);
    });

    process.stderr.on('data', (data) => {
      console.log(`[${name} ERROR] ${data.toString().trim()}`);
    });

    process.on('close', (code) => {
      console.log(`[${name}] 进程退出，代码: ${code}`);
    });

    this.processes.push({ name, process });
    return process;
  }

  /**
   * 停止所有服务
   */
  stopAllServices() {
    console.log('\n🛑 停止所有服务...');
    this.processes.forEach(({ name, process }) => {
      console.log(`停止 ${name}...`);
      process.kill('SIGTERM');
    });
  }

  /**
   * 等待服务启动
   */
  async waitForService(port, serviceName, maxAttempts = 30) {
    console.log(`⏳ 等待 ${serviceName} 启动 (端口 ${port})...`);
    
    for (let i = 0; i < maxAttempts; i++) {
      const isReady = await this.checkPort(port);
      if (isReady) {
        console.log(`✅ ${serviceName} 已启动`);
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log(`❌ ${serviceName} 启动超时`);
    return false;
  }

  /**
   * 运行API测试
   */
  async runAPITests() {
    console.log('\n🧪 运行API测试...');
    
    const tests = [
      {
        name: '健康检查',
        url: 'http://localhost:8000/api/health',
        expectedStatus: 200
      },
      {
        name: 'API文档',
        url: 'http://localhost:8000/api/docs',
        expectedStatus: 200
      }
    ];

    for (const test of tests) {
      try {
        const response = await this.makeRequest(test.url);
        const passed = response.statusCode === test.expectedStatus;
        
        this.testResults.push({
          test: test.name,
          passed,
          statusCode: response.statusCode,
          response: response.data
        });

        console.log(`${passed ? '✅' : '❌'} ${test.name}: ${response.statusCode}`);
      } catch (error) {
        this.testResults.push({
          test: test.name,
          passed: false,
          error: error.message
        });
        console.log(`❌ ${test.name}: ${error.message}`);
      }
    }
  }

  /**
   * 运行前端测试
   */
  async runFrontendTests() {
    console.log('\n🧪 运行前端测试...');
    
    const tests = [
      {
        name: '前端应用',
        url: 'http://localhost:3000',
        expectedStatus: 200
      }
    ];

    for (const test of tests) {
      try {
        const response = await this.makeRequest(test.url);
        const passed = response.statusCode === test.expectedStatus;
        
        this.testResults.push({
          test: test.name,
          passed,
          statusCode: response.statusCode
        });

        console.log(`${passed ? '✅' : '❌'} ${test.name}: ${response.statusCode}`);
      } catch (error) {
        this.testResults.push({
          test: test.name,
          passed: false,
          error: error.message
        });
        console.log(`❌ ${test.name}: ${error.message}`);
      }
    }
  }

  /**
   * 发送HTTP请求
   */
  makeRequest(url) {
    return new Promise((resolve, reject) => {
      const req = http.request(url, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            data: data
          });
        });
      });

      req.on('error', reject);
      req.setTimeout(5000, () => {
        req.destroy();
        reject(new Error('请求超时'));
      });

      req.end();
    });
  }

  /**
   * 生成测试报告
   */
  generateReport() {
    console.log('\n📊 测试报告');
    console.log('='.repeat(50));

    const total = this.testResults.length;
    const passed = this.testResults.filter(r => r.passed).length;
    const failed = total - passed;

    this.testResults.forEach(result => {
      const status = result.passed ? '✅' : '❌';
      console.log(`${status} ${result.test}`);
      if (!result.passed && result.error) {
        console.log(`   错误: ${result.error}`);
      }
    });

    console.log('\n📈 统计');
    console.log(`总测试数: ${total}`);
    console.log(`通过: ${passed}`);
    console.log(`失败: ${failed}`);
    console.log(`成功率: ${((passed / total) * 100).toFixed(1)}%`);

    return { total, passed, failed };
  }

  /**
   * 运行完整测试
   */
  async run() {
    console.log('🚀 开始天网系统测试部署...\n');

    try {
      // 1. 启动后端服务
      const backendProcess = this.startService(
        'Backend Server',
        'npm run dev',
        path.join(__dirname, '../server'),
        { NODE_ENV: 'test' }
      );

      // 等待后端启动
      const backendReady = await this.waitForService(8000, 'Backend Server');
      if (!backendReady) {
        throw new Error('后端服务启动失败');
      }

      // 2. 启动前端服务
      const frontendProcess = this.startService(
        'Frontend Client',
        'npm start',
        path.join(__dirname, '../client')
      );

      // 等待前端启动
      const frontendReady = await this.waitForService(3000, 'Frontend Client');
      if (!frontendReady) {
        throw new Error('前端服务启动失败');
      }

      // 3. 运行测试
      await this.runAPITests();
      await this.runFrontendTests();

      // 4. 生成报告
      const report = this.generateReport();

      // 5. 显示访问信息
      console.log('\n🌐 访问信息');
      console.log('='.repeat(30));
      console.log('前端应用: http://localhost:3000');
      console.log('后端API: http://localhost:8000');
      console.log('API文档: http://localhost:8000/api/docs');
      console.log('健康检查: http://localhost:8000/api/health');

      console.log('\n📋 测试账户');
      console.log('用户名: admin');
      console.log('密码: 123456');

      console.log('\n⏰ 系统将在30秒后自动停止...');
      setTimeout(() => {
        this.stopAllServices();
        process.exit(report.failed > 0 ? 1 : 0);
      }, 30000);

    } catch (error) {
      console.error('\n❌ 测试部署失败:', error.message);
      this.stopAllServices();
      process.exit(1);
    }
  }
}

// 如果直接运行此文件
if (require.main === module) {
  const tester = new TestDeployment();
  
  // 处理进程退出
  process.on('SIGINT', () => {
    console.log('\n🛑 收到中断信号，正在停止服务...');
    tester.stopAllServices();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\n🛑 收到终止信号，正在停止服务...');
    tester.stopAllServices();
    process.exit(0);
  });

  tester.run();
}

module.exports = TestDeployment;
