#!/usr/bin/env node
/**
 * 快速测试脚本
 * Quick Test Script
 */

const fs = require('fs');
const path = require('path');

class QuickTest {
  constructor() {
    this.testResults = [];
  }

  /**
   * 测试文件结构
   */
  testFileStructure() {
    console.log('📁 测试文件结构...');
    
    const requiredFiles = [
      'server/src/index.js',
      'server/package.json',
      'client/src/App.tsx',
      'client/package.json',
      'docker-compose.yml',
      'README.md'
    ];

    requiredFiles.forEach(file => {
      const exists = fs.existsSync(file);
      this.testResults.push({
        test: `文件存在: ${file}`,
        passed: exists
      });
      console.log(`${exists ? '✅' : '❌'} ${file}`);
    });
  }

  /**
   * 测试依赖配置
   */
  testDependencies() {
    console.log('\n📦 测试依赖配置...');
    
    try {
      const serverPackage = JSON.parse(fs.readFileSync('server/package.json', 'utf8'));
      const clientPackage = JSON.parse(fs.readFileSync('client/package.json', 'utf8'));
      
      // 检查关键依赖
      const serverDeps = Object.keys(serverPackage.dependencies || {});
      const clientDeps = Object.keys(clientPackage.dependencies || {});
      
      const requiredServerDeps = ['express', 'sequelize', 'redis', 'jsonwebtoken'];
      const requiredClientDeps = ['react', 'antd', 'axios', 'echarts'];
      
      requiredServerDeps.forEach(dep => {
        const hasDep = serverDeps.includes(dep);
        this.testResults.push({
          test: `后端依赖: ${dep}`,
          passed: hasDep
        });
        console.log(`${hasDep ? '✅' : '❌'} ${dep}`);
      });
      
      requiredClientDeps.forEach(dep => {
        const hasDep = clientDeps.includes(dep);
        this.testResults.push({
          test: `前端依赖: ${dep}`,
          passed: hasDep
        });
        console.log(`${hasDep ? '✅' : '❌'} ${dep}`);
      });
      
    } catch (error) {
      console.log(`❌ 依赖检查失败: ${error.message}`);
    }
  }

  /**
   * 测试配置文件
   */
  testConfigurations() {
    console.log('\n⚙️ 测试配置文件...');
    
    const configFiles = [
      'server/config/test.env',
      'docker/server/Dockerfile',
      'docker/client/Dockerfile',
      'docker/nginx/nginx.conf'
    ];
    
    configFiles.forEach(file => {
      const exists = fs.existsSync(file);
      this.testResults.push({
        test: `配置文件: ${file}`,
        passed: exists
      });
      console.log(`${exists ? '✅' : '❌'} ${file}`);
    });
  }

  /**
   * 测试脚本文件
   */
  testScripts() {
    console.log('\n🔧 测试脚本文件...');
    
    const scriptFiles = [
      'scripts/test-deployment.js',
      'scripts/monitoring/setup-monitoring.js',
      'scripts/backup/backup-manager.js',
      'tests/performance/load-test.js'
    ];
    
    scriptFiles.forEach(file => {
      const exists = fs.existsSync(file);
      this.testResults.push({
        test: `脚本文件: ${file}`,
        passed: exists
      });
      console.log(`${exists ? '✅' : '❌'} ${file}`);
    });
  }

  /**
   * 测试代码质量
   */
  testCodeQuality() {
    console.log('\n🔍 测试代码质量...');
    
    // 检查是否有明显的语法错误
    const jsFiles = [
      'server/src/index.js',
      'server/src/utils/logger.js',
      'scripts/test-deployment.js'
    ];
    
    jsFiles.forEach(file => {
      try {
        if (fs.existsSync(file)) {
          const content = fs.readFileSync(file, 'utf8');
          // 简单的语法检查
          const hasSyntaxError = content.includes('syntax error') || content.includes('undefined');
          this.testResults.push({
            test: `语法检查: ${file}`,
            passed: !hasSyntaxError
          });
          console.log(`${!hasSyntaxError ? '✅' : '❌'} ${file}`);
        }
      } catch (error) {
        this.testResults.push({
          test: `语法检查: ${file}`,
          passed: false
        });
        console.log(`❌ ${file}: ${error.message}`);
      }
    });
  }

  /**
   * 生成测试报告
   */
  generateReport() {
    console.log('\n📊 快速测试报告');
    console.log('='.repeat(50));
    
    const total = this.testResults.length;
    const passed = this.testResults.filter(r => r.passed).length;
    const failed = total - passed;
    
    this.testResults.forEach(result => {
      const status = result.passed ? '✅' : '❌';
      console.log(`${status} ${result.test}`);
    });
    
    console.log('\n📈 统计');
    console.log(`总测试数: ${total}`);
    console.log(`通过: ${passed}`);
    console.log(`失败: ${failed}`);
    console.log(`成功率: ${((passed / total) * 100).toFixed(1)}%`);
    
    if (failed === 0) {
      console.log('\n🎉 所有测试通过！系统准备就绪。');
    } else {
      console.log('\n⚠️ 发现一些问题，请检查失败的测试项。');
    }
    
    return { total, passed, failed };
  }

  /**
   * 运行所有测试
   */
  run() {
    console.log('🚀 开始天网系统快速测试...\n');
    
    this.testFileStructure();
    this.testDependencies();
    this.testConfigurations();
    this.testScripts();
    this.testCodeQuality();
    
    const report = this.generateReport();
    
    console.log('\n📋 下一步操作建议:');
    if (report.failed === 0) {
      console.log('1. 运行完整测试: node scripts/test-deployment.js');
      console.log('2. 启动Docker服务: docker-compose up -d');
      console.log('3. 访问前端应用: http://localhost:3000');
    } else {
      console.log('1. 修复失败的测试项');
      console.log('2. 重新运行快速测试');
      console.log('3. 然后进行完整测试');
    }
    
    return report;
  }
}

// 如果直接运行此文件
if (require.main === module) {
  const tester = new QuickTest();
  const result = tester.run();
  process.exit(result.failed > 0 ? 1 : 0);
}

module.exports = QuickTest;
