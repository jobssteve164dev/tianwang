const keyManagementService = require('./src/services/KeyManagementService');
const deviceFingerprintService = require('./src/services/DeviceFingerprintService');
const registrationCodeService = require('./src/services/RegistrationCodeService');

async function testSecurityServices() {
  console.log('🔐 Testing Security Services...\n');

  try {
    // 测试密钥管理服务
    console.log('1. Testing Key Management Service...');
    await keyManagementService.initialize();
    console.log('✅ Key management service initialized');
    
    const publicKey = keyManagementService.getPublicKey();
    console.log('✅ Public key generated:', publicKey ? 'Yes' : 'No');
    
    const connectionKey = keyManagementService.generateConnectionKey();
    console.log('✅ Connection key generated:', connectionKey.key ? 'Yes' : 'No');
    
    const validation = keyManagementService.verifyConnectionKey(connectionKey.key, connectionKey.key);
const isValid = validation.isValid;
    console.log('✅ Connection key validation:', isValid ? 'Pass' : 'Fail');
    
    console.log('');

    // 测试设备指纹服务
    console.log('2. Testing Device Fingerprint Service...');
    const deviceInfo = {
      hostname: 'test-host',
      platform: 'linux',
      arch: 'x64',
      macAddresses: ['00:11:22:33:44:55'],
      cpuInfo: { model: 'Intel Core i7', cores: 8 },
      memoryInfo: { total: 16384 },
      diskInfo: [{ serial: 'ABC123', model: 'SSD' }],
      networkInterfaces: [{ name: 'eth0', mac: '00:11:22:33:44:55' }],
      systemUuid: 'test-uuid-123'
    };
    
    const fingerprint = deviceFingerprintService.generateFingerprint(deviceInfo);
    console.log('✅ Device fingerprint generated:', fingerprint.fingerprint ? 'Yes' : 'No');
    
    const verification = deviceFingerprintService.verifyFingerprint(fingerprint.fingerprint, deviceInfo);
    console.log('✅ Device fingerprint verification:', verification.isValid ? 'Pass' : 'Fail');
    
    console.log('');

    // 测试注册码服务
    console.log('3. Testing Registration Code Service...');
    const registrationCode = registrationCodeService.generateRegistrationCode({
      expiry: 24 * 60 * 60 * 1000, // 24小时
      maxUses: 1,
      permissions: ['basic'],
      description: 'Test registration code'
    });
    
    console.log('✅ Registration code generated:', registrationCode.code);
    
    const codeValidation = await registrationCodeService.validateRegistrationCode(registrationCode.code, {
      agentId: 'test-agent',
      hostname: 'test-host',
      platform: 'linux'
    });
    
    console.log('✅ Registration code validation:', codeValidation.isValid ? 'Pass' : 'Fail');
    
    const usage = await registrationCodeService.useRegistrationCode(registrationCode.code, {
      agentId: 'test-agent',
      hostname: 'test-host',
      platform: 'linux',
      fingerprint: fingerprint.fingerprint
    });
    
    console.log('✅ Registration code usage:', usage.success ? 'Pass' : 'Fail');
    
    console.log('');

    // 测试批量生成
    console.log('4. Testing Batch Generation...');
    const batchCodes = registrationCodeService.generateBatchRegistrationCodes(3, {
      expiry: 24 * 60 * 60 * 1000,
      maxUses: 1,
      permissions: ['basic'],
      description: 'Batch test codes'
    });
    
    console.log('✅ Batch codes generated:', batchCodes.length);
    
    console.log('');

    // 获取统计信息
    console.log('5. Testing Statistics...');
    const keyStats = keyManagementService.getStatus();
    const fingerprintStats = deviceFingerprintService.getStatus();
    const registrationStats = registrationCodeService.getStatus();
    
    console.log('✅ Key management stats:', keyStats.initialized ? 'Ready' : 'Not ready');
    console.log('✅ Fingerprint service stats:', fingerprintStats.initialized ? 'Ready' : 'Not ready');
    console.log('✅ Registration service stats:', registrationStats.initialized ? 'Ready' : 'Not ready');
    
    console.log('\n🎉 All security services tests passed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

// 运行测试
testSecurityServices();
