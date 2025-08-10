const axios = require('axios');
const AgentService = require('../agents/src/services/AgentService');

async function testCompleteFlow() {
  console.log('🔐 Testing Complete Registration Flow...\n');

  try {
    // 1. 生成注册码（模拟管理界面操作）
    console.log('1. 生成注册码...');
    const registrationCode = 'TW-' + Math.random().toString(36).substring(2, 15).toUpperCase();
    console.log('✅ 生成注册码:', registrationCode);

    // 2. 创建代理服务实例
    console.log('\n2. 创建代理服务实例...');
    const agentService = new AgentService();
    agentService.setRegistrationCode(registrationCode);
    console.log('✅ 代理服务实例创建成功');

    // 3. 生成设备指纹
    console.log('\n3. 生成设备指纹...');
    const fingerprint = await agentService.generateDeviceFingerprint();
    console.log('✅ 设备指纹生成成功:', fingerprint.substring(0, 16) + '...');

    // 4. 注册代理
    console.log('\n4. 注册代理到服务器...');
    try {
      const result = await agentService.registerAgent(registrationCode);
      console.log('✅ 代理注册成功:', {
        hasToken: !!result.token,
        hasConnectionKey: !!result.connectionKey,
        hasPublicKey: !!result.publicKey
      });
    } catch (error) {
      console.log('⚠️  注册失败（需要有效的注册码）:', error.message);
    }

    // 5. 测试连接信息
    console.log('\n5. 获取连接信息...');
    const connectionInfo = agentService.getConnectionInfo();
    console.log('✅ 连接信息:', connectionInfo);

    console.log('\n🎉 完整流程测试完成!');
    console.log('\n📋 下一步:');
    console.log('1. 通过Web管理界面生成注册码');
    console.log('2. 在代理端设置注册码');
    console.log('3. 代理端自动注册并连接');

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    console.error('错误堆栈:', error.stack);
  }
}

// 运行测试
testCompleteFlow();
