const AgentService = require('./src/services/AgentService');
const logger = require('./src/utils/logger');

// 测试连接错误处理
async function testConnectionErrorHandling() {
    console.log('=== 开始测试代理端连接错误处理 ===');
    
    const agentService = new AgentService();
    
    // 设置测试配置
    agentService.updateServerConfig({
        serverUrl: 'ws://localhost:9999', // 使用不存在的端口
        apiUrl: 'http://localhost:9999/api',
        reconnectInterval: 2000, // 缩短重连间隔用于测试
        maxReconnectAttempts: 3, // 减少重连次数用于测试
        heartbeatInterval: 10000
    });
    
    // 监听事件
    agentService.on('connected', () => {
        console.log('✅ 连接成功事件');
    });
    
    agentService.on('disconnected', (data) => {
        console.log('⚠️ 连接断开事件:', data);
    });
    
    agentService.on('error', (error) => {
        console.log('❌ 连接错误事件:', error.message);
    });
    
    agentService.on('connection-refused', () => {
        console.log('🚫 连接被拒绝事件');
    });
    
    agentService.on('max-reconnect-reached', () => {
        console.log('🛑 达到最大重连次数事件');
    });
    
    // 模拟认证token
    agentService.authToken = 'test-token';
    
    console.log('开始连接测试...');
    
    try {
        await agentService.connect();
    } catch (error) {
        console.log('连接失败（预期）:', error.message);
    }
    
    // 等待重连尝试完成
    setTimeout(() => {
        console.log('=== 测试完成 ===');
        console.log('连接状态:', agentService.getConnectionStatus());
        console.log('重连次数:', agentService.reconnectAttempts);
        
        // 清理
        agentService.disconnect();
        process.exit(0);
    }, 10000);
}

// 运行测试
testConnectionErrorHandling().catch(error => {
    console.error('测试失败:', error);
    process.exit(1);
});
