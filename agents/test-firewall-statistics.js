const FirewallService = require('./src/services/FirewallService');
const logger = require('./src/utils/logger');

async function testFirewallStatistics() {
    console.log('🧪 测试防火墙统计功能...\n');
    
    try {
        // 创建防火墙服务实例
        const firewallService = new FirewallService();
        
        // 初始化服务
        console.log('1. 初始化防火墙服务...');
        await firewallService.initialize({
            autoBlock: false,
            blockDuration: 3600000, // 1小时
            whitelistIPs: ['127.0.0.1', '::1']
        });
        
        // 获取初始统计
        console.log('2. 获取初始统计...');
        const initialStats = firewallService.getStatistics();
        console.log('   初始统计:', initialStats);
        
        // 测试添加规则
        console.log('\n3. 测试添加防火墙规则...');
        const testIPs = ['192.168.1.100', '10.0.0.50', '172.16.0.25'];
        
        for (const ip of testIPs) {
            console.log(`   阻止IP: ${ip}`);
            const result = await firewallService.blockIP(ip, `测试阻止 ${ip}`);
            console.log(`   结果: ${result ? '成功' : '失败'}`);
        }
        
        // 获取更新后的统计
        console.log('\n4. 获取更新后的统计...');
        const updatedStats = firewallService.getStatistics();
        console.log('   更新后统计:', updatedStats);
        
        // 验证统计是否正确
        console.log('\n5. 验证统计...');
        if (updatedStats.totalRules === testIPs.length) {
            console.log('   ✅ 规则数量统计正确');
        } else {
            console.log('   ❌ 规则数量统计错误');
        }
        
        if (updatedStats.blockedIPs === testIPs.length) {
            console.log('   ✅ 阻止IP数量统计正确');
        } else {
            console.log('   ❌ 阻止IP数量统计错误');
        }
        
        // 测试移除规则
        console.log('\n6. 测试移除防火墙规则...');
        const removeIP = testIPs[0];
        console.log(`   解除阻止IP: ${removeIP}`);
        const unblockResult = await firewallService.unblockIP(removeIP, '测试解除阻止');
        console.log(`   结果: ${unblockResult ? '成功' : '失败'}`);
        
        // 获取最终统计
        console.log('\n7. 获取最终统计...');
        const finalStats = firewallService.getStatistics();
        console.log('   最终统计:', finalStats);
        
        // 验证最终统计
        console.log('\n8. 验证最终统计...');
        if (finalStats.totalRules === testIPs.length - 1) {
            console.log('   ✅ 最终规则数量统计正确');
        } else {
            console.log('   ❌ 最终规则数量统计错误');
        }
        
        if (finalStats.blockedIPs === testIPs.length - 1) {
            console.log('   ✅ 最终阻止IP数量统计正确');
        } else {
            console.log('   ❌ 最终阻止IP数量统计错误');
        }
        
        console.log('\n🎉 防火墙统计功能测试完成！');
        
    } catch (error) {
        console.error('❌ 测试失败:', error);
    }
}

// 运行测试
testFirewallStatistics();
