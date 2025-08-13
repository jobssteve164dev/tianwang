const AgentService = require('./src/services/AgentService');

async function testWebSocketConnection() {
    console.log('🔌 Testing WebSocket Connection...\n');

    try {
        // 创建代理服务实例
        const agentService = new AgentService();
        
        // 设置注册码
        const testRegistrationCode = 'TW-739884CF59B7ADA964AE7F845C1FF56D';
        agentService.setRegistrationCode(testRegistrationCode);
        
        console.log('1. 初始化代理服务...');
        await agentService.initialize();
        console.log('✅ 代理服务初始化完成');
        
        console.log('\n2. 注册代理...');
        const registrationResult = await agentService.registerAgent(testRegistrationCode);
        console.log('✅ 代理注册成功:', {
            hasToken: !!registrationResult.token,
            hasConnectionKey: !!registrationResult.connectionKey,
            hasPublicKey: !!registrationResult.publicKey
        });
        
        console.log('\n3. 建立WebSocket连接...');
        
        // 监听连接事件
        agentService.on('connected', () => {
            console.log('✅ WebSocket连接成功建立');
        });
        
        agentService.on('disconnected', (data) => {
            console.log('❌ WebSocket连接断开:', data);
        });
        
        agentService.on('error', (error) => {
            console.log('❌ WebSocket连接错误:', error.message);
        });
        
        // 尝试连接
        await agentService.connect();
        
        // 等待5秒观察连接状态
        console.log('\n4. 观察连接状态5秒...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // 检查连接状态
        const isConnected = agentService.getConnectionStatus();
        console.log('📊 最终连接状态:', isConnected ? '✅ 已连接' : '❌ 未连接');
        
        // 断开连接
        if (agentService.ws) {
            agentService.ws.close();
        }
        
        console.log('\n🎉 WebSocket连接测试完成!');
        
    } catch (error) {
        console.error('❌ 测试失败:', error.message);
        console.error('错误详情:', error);
    }
}

testWebSocketConnection();

