#!/usr/bin/env node

/**
 * 数据存储服务测试脚本
 * Test script for DataStorageService
 */

require('dotenv').config();
const dataStorageService = require('../src/services/DataStorageService');
const logger = require('../src/utils/logger');

async function testDataStorage() {
  console.log('🧪 Starting DataStorageService test...');
  
  try {
    // 1. 初始化数据存储服务
    console.log('📊 Initializing DataStorageService...');
    await dataStorageService.initialize();
    console.log('✅ DataStorageService initialized successfully');

    // 2. 测试系统数据存储
    console.log('💾 Testing system data storage...');
    const systemData = {
      hostname: 'test-host',
      platform: 'linux',
      system: {
        cpu: {
          load: 45.2,
          loadUser: 30.1,
          loadSystem: 15.1,
          cores: 8,
          speed: 2.4
        },
        memory: {
          total: 16777216, // 16GB
          used: 8388608,   // 8GB
          free: 4194304,   // 4GB
          available: 12582912, // 12GB
          usage: '50.0'
        },
        uptime: {
          system: 86400,   // 24小时
          process: 3600    // 1小时
        }
      }
    };

    await dataStorageService.storeSystemData('test-agent-001', systemData);
    console.log('✅ System data stored successfully');

    // 3. 测试网络数据存储
    console.log('🌐 Testing network data storage...');
    const networkData = {
      interfaces: [
        {
          iface: 'eth0',
          operstate: 'up',
          rx_bytes: 1024000,
          tx_bytes: 512000,
          rx_errors: 0,
          tx_errors: 0,
          rx_dropped: 0,
          tx_dropped: 0,
          throughput: {
            rxRate: 1024.5,
            txRate: 512.3,
            totalRate: 1536.8
          }
        }
      ],
      connections: {
        total: 150,
        active: 120,
        connections: []
      }
    };

    await dataStorageService.storeNetworkData('test-agent-001', networkData);
    console.log('✅ Network data stored successfully');

    // 4. 测试日志数据存储
    console.log('📝 Testing log data storage...');
    const logData = {
      source: '/var/log/syslog',
      lines: [
        '2025-01-17 10:30:15 test-host kernel: [12345.678] CPU temperature above threshold',
        '2025-01-17 10:30:16 test-host systemd: Started Network Time Synchronization.',
        '2025-01-17 10:30:17 test-host sshd: Accepted password for user from 192.168.1.100'
      ]
    };

    await dataStorageService.storeLogData('test-agent-001', logData);
    console.log('✅ Log data stored successfully');

    // 5. 测试安全事件存储
    console.log('🛡️ Testing security event storage...');
    const securityEvent = {
      type: 'suspicious_connection',
      severity: 'medium',
      title: '可疑网络连接',
      description: '检测到来自未知IP的可疑连接',
      sourceIP: '192.168.1.200',
      targetIP: '192.168.1.100',
      sourcePort: 12345,
      targetPort: 22,
      status: 'open'
    };

    await dataStorageService.storeSecurityEvent('test-agent-001', securityEvent);
    console.log('✅ Security event stored successfully');

    // 6. 等待数据写入
    console.log('⏳ Waiting for data to be written...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 7. 测试数据查询
    console.log('🔍 Testing data queries...');
    
    // 查询系统数据
    const systemQuery = await dataStorageService.querySystemData(
      'test-agent-001',
      '-1h',
      'now()',
      10
    );
    console.log(`✅ System data query returned ${systemQuery.length} records`);

    // 查询网络数据
    const networkQuery = await dataStorageService.queryNetworkData(
      'test-agent-001',
      '-1h',
      'now()',
      10
    );
    console.log(`✅ Network data query returned ${networkQuery.length} records`);

    // 查询安全事件
    const securityQuery = await dataStorageService.querySecurityEvents(
      'test-agent-001',
      '-1h',
      'now()',
      10
    );
    console.log(`✅ Security events query returned ${securityQuery.length} records`);

    // 8. 测试系统统计
    console.log('📊 Testing system statistics...');
    const stats = await dataStorageService.getSystemStats('test-agent-001', '1h');
    console.log(`✅ System stats query returned ${stats.length} records`);

    // 9. 关闭服务
    console.log('🔌 Closing DataStorageService...');
    await dataStorageService.close();
    console.log('✅ DataStorageService closed successfully');

    console.log('🎉 All tests passed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    logger.error('DataStorageService test failed:', error);
    process.exit(1);
  }
}

// 运行测试
if (require.main === module) {
  testDataStorage()
    .then(() => {
      console.log('✅ Test completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Test failed:', error);
      process.exit(1);
    });
}

module.exports = { testDataStorage };
