#!/usr/bin/env node

/**
 * 真实InfluxDB数据存储测试脚本
 * Real InfluxDB Data Storage Test Script
 */

require('dotenv').config();
const dataStorageService = require('../src/services/DataStorageService');
const logger = require('../src/utils/logger');

async function testRealInfluxDB() {
  console.log('🧪 Starting Real InfluxDB DataStorageService test...');
  
  try {
    // 1. 初始化数据存储服务
    console.log('📊 Initializing DataStorageService...');
    await dataStorageService.initialize();
    console.log('✅ DataStorageService initialized successfully');

    // 2. 测试系统数据存储
    console.log('💾 Testing system data storage...');
    const systemData = {
      hostname: 'real-test-host',
      platform: 'linux',
      system: {
        cpu: {
          load: 75.5,
          loadUser: 45.2,
          loadSystem: 30.3,
          cores: 16,
          speed: 3.2
        },
        memory: {
          total: 33554432, // 32GB
          used: 16777216,  // 16GB
          free: 8388608,   // 8GB
          available: 25165824, // 24GB
          usage: '50.0'
        },
        uptime: {
          system: 172800,  // 48小时
          process: 7200    // 2小时
        }
      }
    };

    await dataStorageService.storeSystemData('real-test-agent-001', systemData);
    console.log('✅ System data stored successfully');

    // 3. 等待数据写入
    console.log('⏳ Waiting for data to be written...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 4. 测试数据查询 - 使用正确的时间格式
    console.log('🔍 Testing data queries with proper time format...');
    
    // 查询最近1小时的数据
    const systemQuery = await dataStorageService.querySystemData(
      'real-test-agent-001',
      '-1h',
      'now()',
      100
    );
    console.log(`✅ System data query returned ${systemQuery.length} records`);
    
    if (systemQuery.length > 0) {
      console.log('📊 Sample system data:');
      console.log(JSON.stringify(systemQuery.slice(0, 3), null, 2));
    }

    // 5. 测试系统统计
    console.log('📊 Testing system statistics...');
    const stats = await dataStorageService.getSystemStats('real-test-agent-001', '1h');
    console.log(`✅ System stats query returned ${stats.length} records`);
    
    if (stats.length > 0) {
      console.log('📈 Sample stats:');
      console.log(JSON.stringify(stats.slice(0, 3), null, 2));
    }

    // 6. 测试网络数据存储和查询
    console.log('🌐 Testing network data storage and query...');
    const networkData = {
      interfaces: [
        {
          iface: 'eth0',
          operstate: 'up',
          rx_bytes: 2048000,
          tx_bytes: 1024000,
          rx_errors: 0,
          tx_errors: 0,
          rx_dropped: 0,
          tx_dropped: 0,
          throughput: {
            rxRate: 2048.7,
            txRate: 1024.3,
            totalRate: 3073.0
          }
        }
      ],
      connections: {
        total: 200,
        active: 180,
        connections: []
      }
    };

    await dataStorageService.storeNetworkData('real-test-agent-001', networkData);
    console.log('✅ Network data stored successfully');

    // 等待写入
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 查询网络数据
    const networkQuery = await dataStorageService.queryNetworkData(
      'real-test-agent-001',
      '-1h',
      'now()',
      50
    );
    console.log(`✅ Network data query returned ${networkQuery.length} records`);

    if (networkQuery.length > 0) {
      console.log('🌐 Sample network data:');
      console.log(JSON.stringify(networkQuery.slice(0, 3), null, 2));
    }

    // 7. 测试安全事件存储和查询
    console.log('🛡️ Testing security event storage and query...');
    const securityEvent = {
      type: 'malware_detected',
      severity: 'high',
      title: '恶意软件检测',
      description: '在系统中检测到可疑的恶意软件活动',
      sourceIP: '10.0.0.100',
      targetIP: '10.0.0.1',
      sourcePort: 54321,
      targetPort: 443,
      status: 'open'
    };

    await dataStorageService.storeSecurityEvent('real-test-agent-001', securityEvent);
    console.log('✅ Security event stored successfully');

    // 等待写入
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 查询安全事件
    const securityQuery = await dataStorageService.querySecurityEvents(
      'real-test-agent-001',
      '-1h',
      'now()',
      20
    );
    console.log(`✅ Security events query returned ${securityQuery.length} records`);

    if (securityQuery.length > 0) {
      console.log('🛡️ Sample security events:');
      console.log(JSON.stringify(securityQuery.slice(0, 2), null, 2));
    }

    // 8. 关闭服务
    console.log('🔌 Closing DataStorageService...');
    await dataStorageService.close();
    console.log('✅ DataStorageService closed successfully');

    console.log('🎉 All real InfluxDB tests passed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    logger.error('Real InfluxDB test failed:', error);
    process.exit(1);
  }
}

// 运行测试
if (require.main === module) {
  testRealInfluxDB()
    .then(() => {
      console.log('✅ Real InfluxDB test completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Real InfluxDB test failed:', error);
      process.exit(1);
    });
}

module.exports = { testRealInfluxDB };
