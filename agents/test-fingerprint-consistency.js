const AgentService = require('./src/services/AgentService');
const logger = require('./src/utils/logger');

// 测试设备指纹生成一致性
async function testFingerprintConsistency() {
    console.log('=== 开始测试设备指纹生成一致性 ===');
    
    const agentService = new AgentService();
    
    try {
        console.log('生成设备指纹...');
        const fingerprint = await agentService.generateDeviceFingerprint();
        
        console.log('设备指纹生成结果:');
        console.log('指纹:', fingerprint);
        console.log('指纹长度:', fingerprint.length);
        console.log('指纹前16位:', fingerprint.substring(0, 16) + '...');
        
        // 获取系统信息用于对比
        console.log('\n获取系统信息...');
        const systemInfo = await agentService.getSystemInfo();
        
        console.log('系统信息摘要:');
        console.log('- 主机名:', systemInfo.hostname);
        console.log('- 平台:', systemInfo.platform);
        console.log('- 架构:', systemInfo.arch);
        console.log('- MAC地址数量:', systemInfo.macAddresses.length);
        console.log('- 磁盘数量:', systemInfo.diskInfo.length);
        console.log('- 网络接口数量:', systemInfo.networkInterfaces.length);
        
        // 显示MAC地址（脱敏）
        if (systemInfo.macAddresses.length > 0) {
            console.log('- MAC地址示例:', systemInfo.macAddresses[0].substring(0, 8) + '...');
        }
        
        // 显示磁盘信息（脱敏）
        if (systemInfo.diskInfo.length > 0) {
            console.log('- 磁盘序列号示例:', systemInfo.diskInfo[0].serial.substring(0, 8) + '...');
        }
        
        console.log('\n=== 测试完成 ===');
        
    } catch (error) {
        console.error('测试失败:', error);
    }
}

// 运行测试
testFingerprintConsistency().catch(error => {
    console.error('测试失败:', error);
    process.exit(1);
});
