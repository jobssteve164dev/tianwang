const keyManagementService = require('./src/services/KeyManagementService');

async function testConnectionKeyFix() {
  console.log('🔐 Testing Connection Key Fix...\n');

  try {
    // 初始化密钥管理服务
    await keyManagementService.initialize();
    console.log('✅ Key management service initialized');

    // 测试1: 生成连接密钥
    console.log('\n1. Testing Connection Key Generation...');
    const connectionKey = keyManagementService.generateConnectionKey();
    console.log('✅ Connection key generated:', {
      keyLength: connectionKey.key.length,
      timestamp: connectionKey.timestamp,
      signatureLength: connectionKey.signature.length,
      expiresAt: connectionKey.expiresAt
    });

    // 测试2: 验证连接密钥对象
    console.log('\n2. Testing Connection Key Object Validation...');
    const objectValidation = keyManagementService.verifyConnectionKey(connectionKey);
    console.log('✅ Object validation result:', objectValidation.isValid ? 'PASS' : 'FAIL');
    if (!objectValidation.isValid) {
      console.log('❌ Error:', objectValidation.error);
    }

    // 测试3: 构建完整的连接密钥字符串
    console.log('\n3. Testing Full Connection Key String...');
    const fullConnectionKey = `${connectionKey.key}:${connectionKey.timestamp}:${connectionKey.signature}`;
    console.log('✅ Full connection key string:', {
      length: fullConnectionKey.length,
      preview: fullConnectionKey.substring(0, 32) + '...'
    });

    // 测试4: 验证完整的连接密钥字符串
    console.log('\n4. Testing Full Connection Key String Validation...');
    const stringValidation = keyManagementService.verifyConnectionKey(fullConnectionKey, fullConnectionKey);
    console.log('✅ String validation result:', stringValidation.isValid ? 'PASS' : 'FAIL');
    if (!stringValidation.isValid) {
      console.log('❌ Error:', stringValidation.error);
    }

    // 测试5: 测试连接密钥匹配
    console.log('\n5. Testing Connection Key Match...');
    const matchValidation = keyManagementService.verifyConnectionKeyMatch(fullConnectionKey, fullConnectionKey);
    console.log('✅ Match validation result:', matchValidation.isValid ? 'PASS' : 'FAIL');
    if (!matchValidation.isValid) {
      console.log('❌ Error:', matchValidation.error);
    }

    // 测试6: 测试不匹配的情况
    console.log('\n6. Testing Mismatch Detection...');
    const differentKey = 'different:key:signature';
    const mismatchValidation = keyManagementService.verifyConnectionKeyMatch(fullConnectionKey, differentKey);
    console.log('✅ Mismatch detection result:', !mismatchValidation.isValid ? 'PASS' : 'FAIL');
    if (mismatchValidation.isValid) {
      console.log('❌ Error: Should have detected mismatch');
    }

    console.log('\n🎉 All tests completed!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testConnectionKeyFix();
