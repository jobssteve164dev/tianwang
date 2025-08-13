const keyManagementService = require('./src/services/KeyManagementService');
const crypto = require('crypto');

async function debugSignature() {
  console.log('🔍 Debugging Signature Verification...\n');

  try {
    // 初始化密钥管理服务
    await keyManagementService.initialize();
    console.log('✅ Key management service initialized');

    // 检查密钥是否正确加载
    const publicKey = keyManagementService.getPublicKey();
    const privateKey = keyManagementService.privateKey;
    
    console.log('\n1. Checking Keys...');
    console.log('✅ Public key loaded:', !!publicKey);
    console.log('✅ Private key loaded:', !!privateKey);
    console.log('Public key length:', publicKey?.length);
    console.log('Private key length:', privateKey?.length);
    console.log('Public key starts with:', publicKey?.substring(0, 50) + '...');
    console.log('Private key starts with:', privateKey?.substring(0, 50) + '...');

    // 测试签名创建和验证
    console.log('\n2. Testing Signature Creation and Verification...');
    const testData = 'test:1234567890';
    console.log('Test data:', testData);
    
    // 创建签名
    const signer = crypto.createSign('SHA256');
    signer.update(testData);
    const signature = signer.sign(privateKey, 'base64');
    console.log('✅ Signature created:', signature.substring(0, 32) + '...');
    console.log('Signature length:', signature.length);

    // 验证签名
    const verifier = crypto.createVerify('SHA256');
    verifier.update(testData);
    const isValid = verifier.verify(publicKey, signature, 'base64');
    console.log('✅ Signature verification result:', isValid ? 'PASS' : 'FAIL');

    // 测试连接密钥生成和验证
    console.log('\n3. Testing Connection Key Generation...');
    const connectionKey = keyManagementService.generateConnectionKey();
    console.log('✅ Connection key generated:', {
      keyLength: connectionKey.key.length,
      timestamp: connectionKey.timestamp,
      signatureLength: connectionKey.signature.length
    });

    // 手动验证连接密钥签名
    console.log('\n4. Manual Signature Verification...');
    const data = `${connectionKey.key}:${connectionKey.timestamp}`;
    console.log('Data to sign:', data);
    
    // 重新创建签名
    const manualSigner = crypto.createSign('SHA256');
    manualSigner.update(data);
    const manualSignature = manualSigner.sign(privateKey, 'base64');
    console.log('Manual signature:', manualSignature.substring(0, 32) + '...');
    console.log('Original signature:', connectionKey.signature.substring(0, 32) + '...');
    console.log('Signatures match:', manualSignature === connectionKey.signature);

    // 验证原始签名
    const manualVerifier = crypto.createVerify('SHA256');
    manualVerifier.update(data);
    const manualIsValid = manualVerifier.verify(publicKey, connectionKey.signature, 'base64');
    console.log('✅ Manual verification result:', manualIsValid ? 'PASS' : 'FAIL');

    // 测试服务方法验证
    console.log('\n5. Testing Service Method Verification...');
    const serviceValidation = keyManagementService.verifyConnectionKey(connectionKey);
    console.log('✅ Service validation result:', serviceValidation.isValid ? 'PASS' : 'FAIL');
    if (!serviceValidation.isValid) {
      console.log('❌ Service validation error:', serviceValidation.error);
    }

    // 测试字符串格式验证
    console.log('\n6. Testing String Format Verification...');
    const fullConnectionKey = `${connectionKey.key}:${connectionKey.timestamp}:${connectionKey.signature}`;
    const stringValidation = keyManagementService.verifyConnectionKey(fullConnectionKey, fullConnectionKey);
    console.log('✅ String validation result:', stringValidation.isValid ? 'PASS' : 'FAIL');
    if (!stringValidation.isValid) {
      console.log('❌ String validation error:', stringValidation.error);
    }

    console.log('\n🎉 Debug completed!');

  } catch (error) {
    console.error('❌ Debug failed:', error);
    console.error('Stack trace:', error.stack);
  }
}

debugSignature();
