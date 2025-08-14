const FirewallService = require('./src/services/FirewallService');
const logger = require('./src/utils/logger');

// 模拟FirewallService，不实际执行防火墙命令
class MockFirewallService extends FirewallService {
    constructor() {
        super();
        this.mockMode = true;
    }
    
    // 重写executeCommand方法，模拟成功执行
    async executeCommand(command, timeout = 10000) {
        if (this.mockMode) {
            return {
                success: true,
                stdout: 'Mock success',
                stderr: '',
                error: null
            };
        }
        return super.executeCommand(command, timeout);
    }
    
    // 重写checkFirewallStatus方法，模拟成功
    async checkFirewallStatus() {
        if (this.mockMode) {
            return true;
        }
        return super.checkFirewallStatus();
    }
    
    // 重写loadExistingRules方法，模拟加载现有规则
    async loadExistingRules() {
        if (this.mockMode) {
            // 模拟加载一些现有规则
            const mockRules = [
                { ip: '192.168.1.50', ruleId: 'existing_rule_1' },
                { ip: '10.0.0.100', ruleId: 'existing_rule_2' }
            ];
            
            mockRules.forEach(rule => {
                this.blockedIPs.add(rule.ip);
                this.rules.set(rule.ruleId, {
                    ip: rule.ip,
                    reason: 'Existing rule',
                    platform: this.platform,
                    timestamp: Date.now(),
                    duration: this.config.blockDuration
                });
            });
            
            logger.info(`模拟加载了 ${mockRules.length} 条现有规则`);
            return;
        }
        return super.loadExistingRules();
    }
}

async function testFirewallStatisticsMock() {
    console.log('🧪 模拟测试防火墙统计功能...\n');
    
    try {
        // 创建模拟防火墙服务实例
        const firewallService = new MockFirewallService();
        
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
        const expectedRules = 2 + testIPs.length; // 现有规则 + 新添加的规则
        if (updatedStats.totalRules === expectedRules) {
            console.log('   ✅ 规则数量统计正确');
        } else {
            console.log(`   ❌ 规则数量统计错误: 期望 ${expectedRules}, 实际 ${updatedStats.totalRules}`);
        }
        
        const expectedBlockedIPs = 2 + testIPs.length; // 现有IP + 新阻止的IP
        if (updatedStats.blockedIPs === expectedBlockedIPs) {
            console.log('   ✅ 阻止IP数量统计正确');
        } else {
            console.log(`   ❌ 阻止IP数量统计错误: 期望 ${expectedBlockedIPs}, 实际 ${updatedStats.blockedIPs}`);
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
        const expectedFinalRules = expectedRules - 1;
        if (finalStats.totalRules === expectedFinalRules) {
            console.log('   ✅ 最终规则数量统计正确');
        } else {
            console.log(`   ❌ 最终规则数量统计错误: 期望 ${expectedFinalRules}, 实际 ${finalStats.totalRules}`);
        }
        
        const expectedFinalBlockedIPs = expectedBlockedIPs - 1;
        if (finalStats.blockedIPs === expectedFinalBlockedIPs) {
            console.log('   ✅ 最终阻止IP数量统计正确');
        } else {
            console.log(`   ❌ 最终阻止IP数量统计错误: 期望 ${expectedFinalBlockedIPs}, 实际 ${finalStats.blockedIPs}`);
        }
        
        // 显示所有规则详情
        console.log('\n9. 显示所有规则详情...');
        const allRules = Array.from(firewallService.rules.entries());
        allRules.forEach(([ruleId, rule]) => {
            console.log(`   规则ID: ${ruleId}, IP: ${rule.ip}, 原因: ${rule.reason}`);
        });
        
        console.log('\n🎉 防火墙统计功能模拟测试完成！');
        
    } catch (error) {
        console.error('❌ 测试失败:', error);
    }
}

// 运行测试
testFirewallStatisticsMock();
