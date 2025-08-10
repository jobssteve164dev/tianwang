const AgentService = require('./src/services/AgentService');

async function testRegistration() {
    console.log('🔐 Testing Agent Registration with Code...\n');

    try {
        // 创建代理服务实例
        const agentService = new AgentService();
        
        // 设置注册码
        const testRegistrationCode = 'TW-07984807BF93FE88A9AB2B14D4E7AF5B'; // 使用之前生成的测试码
        agentService.setRegistrationCode(testRegistrationCode);
        
        console.log('1. 设置注册码:', testRegistrationCode.substring(0, 8) + '...');
        console.log('✅ 注册码已设置');
        
        // 生成设备指纹
        console.log('\n2. 生成设备指纹...');
        const fingerprint = await agentService.generateDeviceFingerprint();
        console.log('✅ 设备指纹生成成功:', fingerprint.substring(0, 16) + '...');
        
        // 获取连接信息
        console.log('\n3. 获取连接信息...');
        const connectionInfo = agentService.getConnectionInfo();
        console.log('✅ 连接信息:', {
            agentId: connectionInfo.agentId,
            hasRegistrationCode: connectionInfo.hasRegistrationCode,
            hasDeviceFingerprint: connectionInfo.hasDeviceFingerprint
        });
        
        // 尝试注册（需要服务器运行）
        console.log('\n4. 尝试注册到服务器...');
        try {
            const result = await agentService.registerAgent(testRegistrationCode);
            console.log('✅ 注册成功:', {
                hasToken: !!result.token,
                hasConnectionKey: !!result.connectionKey,
                hasPublicKey: !!result.publicKey
            });
        } catch (error) {
            console.log('⚠️  注册失败 (服务器可能未运行):', error.message);
        }
        
        console.log('\n🎉 代理端注册码功能测试完成!');
        
    } catch (error) {
        console.error('❌ 测试失败:', error.message);
        console.error(error.stack);
    }
}

// 运行测试
testRegistration();
