/**
 * 系统负载测试
 * Load Testing for Performance Validation
 */

const autocannon = require('autocannon');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class LoadTester {
  constructor() {
    this.baseUrl = process.env.API_BASE_URL || 'http://localhost:8000';
    this.results = [];
  }

  /**
   * 运行所有负载测试
   */
  async runAllTests() {
    console.log('🚀 开始系统负载测试...\n');

    const tests = [
      {
        name: 'API健康检查测试',
        url: `${this.baseUrl}/api/health`,
        duration: 30,
        connections: 10
      },
      {
        name: '设备列表API测试',
        url: `${this.baseUrl}/api/devices`,
        duration: 60,
        connections: 20,
        headers: {
          'Authorization': 'Bearer test-token'
        }
      },
      {
        name: '安全事件API测试',
        url: `${this.baseUrl}/api/security-events`,
        duration: 60,
        connections: 15,
        headers: {
          'Authorization': 'Bearer test-token'
        }
      },
      {
        name: '仪表盘数据API测试',
        url: `${this.baseUrl}/api/dashboard/stats`,
        duration: 60,
        connections: 25,
        headers: {
          'Authorization': 'Bearer test-token'
        }
      },
      {
        name: '高并发测试',
        url: `${this.baseUrl}/api/devices`,
        duration: 120,
        connections: 50,
        headers: {
          'Authorization': 'Bearer test-token'
        }
      }
    ];

    for (const test of tests) {
      console.log(`📊 运行测试: ${test.name}`);
      const result = await this.runTest(test);
      this.results.push({ ...test, result });
      console.log(`✅ ${test.name} 完成\n`);
    }

    this.generateReport();
  }

  /**
   * 运行单个测试
   */
  async runTest(testConfig) {
    return new Promise((resolve, reject) => {
      const test = autocannon({
        url: testConfig.url,
        connections: testConfig.connections,
        duration: testConfig.duration,
        headers: testConfig.headers || {},
        timeout: 10,
        pipelining: 1,
        method: 'GET'
      }, (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      });

      // 实时显示进度
      autocannon.track(test, { renderProgressBar: true });
    });
  }

  /**
   * 生成测试报告
   */
  generateReport() {
    console.log('\n📈 负载测试报告');
    console.log('='.repeat(50));

    let totalRequests = 0;
    let totalLatency = 0;
    let totalErrors = 0;

    this.results.forEach((test, index) => {
      const { result } = test;
      totalRequests += result.requests.total;
      totalLatency += result.latency.p99;
      totalErrors += result.errors;

      console.log(`\n${index + 1}. ${test.name}`);
      console.log(`   请求总数: ${result.requests.total.toLocaleString()}`);
      console.log(`   平均RPS: ${result.requests.average.toFixed(2)}`);
      console.log(`   最大RPS: ${result.requests.max.toFixed(2)}`);
      console.log(`   平均延迟: ${result.latency.average.toFixed(2)}ms`);
      console.log(`   99%延迟: ${result.latency.p99.toFixed(2)}ms`);
      console.log(`   错误数: ${result.errors}`);
      console.log(`   错误率: ${((result.errors / result.requests.total) * 100).toFixed(2)}%`);
    });

    console.log('\n📊 总体统计');
    console.log('='.repeat(30));
    console.log(`总请求数: ${totalRequests.toLocaleString()}`);
    console.log(`平均99%延迟: ${(totalLatency / this.results.length).toFixed(2)}ms`);
    console.log(`总错误数: ${totalErrors}`);
    console.log(`总体错误率: ${((totalErrors / totalRequests) * 100).toFixed(2)}%`);

    // 保存详细报告
    const reportPath = path.join(__dirname, 'load-test-report.json');
    const report = {
      timestamp: new Date().toISOString(),
      baseUrl: this.baseUrl,
      tests: this.results,
      summary: {
        totalRequests,
        averageLatency: totalLatency / this.results.length,
        totalErrors,
        errorRate: (totalErrors / totalRequests) * 100
      }
    };

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 详细报告已保存到: ${reportPath}`);

    // 性能评估
    this.evaluatePerformance(report.summary);
  }

  /**
   * 性能评估
   */
  evaluatePerformance(summary) {
    console.log('\n🎯 性能评估');
    console.log('='.repeat(30));

    const { totalRequests, averageLatency, errorRate } = summary;

    // 评估标准
    const criteria = {
      requests: { excellent: 10000, good: 5000, poor: 1000 },
      latency: { excellent: 100, good: 300, poor: 1000 },
      errorRate: { excellent: 0.1, good: 1, poor: 5 }
    };

    const getGrade = (value, metric) => {
      if (value >= criteria[metric].excellent) return 'A+';
      if (value >= criteria[metric].good) return 'B+';
      if (value >= criteria[metric].poor) return 'C+';
      return 'D';
    };

    const getGradeForLatency = (value) => {
      if (value <= criteria.latency.excellent) return 'A+';
      if (value <= criteria.latency.good) return 'B+';
      if (value <= criteria.latency.poor) return 'C+';
      return 'D';
    };

    const getGradeForErrorRate = (value) => {
      if (value <= criteria.errorRate.excellent) return 'A+';
      if (value <= criteria.errorRate.good) return 'B+';
      if (value <= criteria.errorRate.poor) return 'C+';
      return 'D';
    };

    const requestGrade = getGrade(totalRequests, 'requests');
    const latencyGrade = getGradeForLatency(averageLatency);
    const errorGrade = getGradeForErrorRate(errorRate);

    console.log(`请求处理能力: ${requestGrade} (${totalRequests.toLocaleString()} 请求)`);
    console.log(`响应延迟: ${latencyGrade} (${averageLatency.toFixed(2)}ms)`);
    console.log(`错误率: ${errorGrade} (${errorRate.toFixed(2)}%)`);

    // 综合评分
    const grades = { 'A+': 95, 'B+': 85, 'C+': 75, 'D': 60 };
    const avgScore = (grades[requestGrade] + grades[latencyGrade] + grades[errorGrade]) / 3;
    
    console.log(`\n🏆 综合评分: ${avgScore.toFixed(1)}/100`);
    
    if (avgScore >= 90) {
      console.log('🎉 性能优秀！系统已准备好生产环境部署。');
    } else if (avgScore >= 80) {
      console.log('✅ 性能良好，建议进行小幅优化。');
    } else if (avgScore >= 70) {
      console.log('⚠️  性能一般，需要进一步优化。');
    } else {
      console.log('❌ 性能较差，需要重点优化。');
    }
  }

  /**
   * 运行数据库性能测试
   */
  async runDatabaseTests() {
    console.log('\n🗄️  数据库性能测试');
    console.log('='.repeat(30));

    const dbTests = [
      {
        name: '设备查询性能',
        url: `${this.baseUrl}/api/devices?limit=1000`,
        duration: 30,
        connections: 10
      },
      {
        name: '安全事件查询性能',
        url: `${this.baseUrl}/api/security-events?limit=1000`,
        duration: 30,
        connections: 10
      },
      {
        name: '复杂查询性能',
        url: `${this.baseUrl}/api/dashboard/stats?timeRange=7d`,
        duration: 30,
        connections: 10
      }
    ];

    for (const test of dbTests) {
      console.log(`📊 运行数据库测试: ${test.name}`);
      const result = await this.runTest(test);
      console.log(`   平均延迟: ${result.latency.average.toFixed(2)}ms`);
      console.log(`   99%延迟: ${result.latency.p99.toFixed(2)}ms`);
      console.log(`   错误率: ${((result.errors / result.requests.total) * 100).toFixed(2)}%\n`);
    }
  }
}

// 如果直接运行此文件
if (require.main === module) {
  const tester = new LoadTester();
  
  tester.runAllTests()
    .then(() => tester.runDatabaseTests())
    .then(() => {
      console.log('\n🎉 所有负载测试完成！');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ 负载测试失败:', error);
      process.exit(1);
    });
}

module.exports = LoadTester;
