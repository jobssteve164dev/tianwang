const { exec } = require('child_process');
const os = require('os');

function execCommand(command) {
    return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
            resolve({ error, stdout, stderr });
        });
    });
}

async function testFirewallCapability() {
    console.log('=== TianWang Agent 防火墙功能测试 ===\n');
    
    const platform = os.platform();
    console.log(`当前平台: ${platform}`);
    
    if (platform !== 'darwin') {
        console.log('此测试仅适用于 macOS 平台');
        return;
    }
    
    // 测试1: 检查 pfctl 是否可用
    console.log('\n1. 检查 pfctl 命令可用性...');
    try {
        const result = await execCommand('which pfctl');
        if (!result.error && result.stdout.trim()) {
            console.log('✅ pfctl 命令可用:', result.stdout.trim());
        } else {
            console.log('❌ pfctl 命令不可用');
            return;
        }
    } catch (error) {
        console.log('❌ pfctl 命令不可用:', error.message);
        return;
    }
    
    // 测试2: 检查防火墙状态
    console.log('\n2. 检查防火墙状态...');
    try {
        const result = await execCommand('sudo pfctl -s info');
        if (result.stdout.includes('Status: Enabled')) {
            console.log('✅ 防火墙已启用');
        } else if (result.stdout.includes('Status: Disabled')) {
            console.log('⚠️  防火墙已禁用，尝试启用...');
            try {
                await execCommand('sudo pfctl -e');
                console.log('✅ 防火墙已启用');
            } catch (error) {
                console.log('❌ 无法启用防火墙:', error.message);
            }
        } else {
            console.log('❓ 无法确定防火墙状态');
        }
    } catch (error) {
        console.log('❌ 无法检查防火墙状态:', error.message);
    }
    
    // 测试3: 测试添加防火墙规则
    console.log('\n3. 测试添加防火墙规则...');
    const testIP = '192.168.1.100';
    const testRule = `block drop from ${testIP} to any`;
    
    try {
        // 先检查是否已有规则
        const result = await execCommand('sudo pfctl -s rules');
        if (result.stdout.includes(testIP)) {
            console.log('⚠️  测试IP已存在规则，先删除...');
            await execCommand('sudo pfctl -a tianwang -F rules');
        }
        
        // 添加测试规则
        const addResult = await execCommand(
            `echo "${testRule}" | sudo pfctl -a tianwang -f -`
        );
        
        if (!addResult.error) {
            console.log('✅ 测试规则添加成功');
            
            // 验证规则是否生效
            const verifyResult = await execCommand('sudo pfctl -s rules');
            if (verifyResult.stdout.includes(testIP)) {
                console.log('✅ 规则验证成功');
            } else {
                console.log('❌ 规则验证失败');
            }
            
            // 清理测试规则
            console.log('\n4. 清理测试规则...');
            await execCommand('sudo pfctl -a tianwang -F rules');
            console.log('✅ 测试规则已清理');
        } else {
            console.log('❌ 添加规则失败:', addResult.error);
        }
    } catch (error) {
        console.log('❌ 测试防火墙规则失败:', error.message);
    }
    
    // 测试4: 检查应用权限
    console.log('\n5. 检查应用权限...');
    try {
        const result = await execCommand('codesign -d --entitlements - "/Applications/TianWang Agent.app" 2>/dev/null || echo "No entitlements"');
        if (result.stdout.includes('com.apple.security.network.client')) {
            console.log('✅ 应用已获得网络访问权限');
        } else if (result.stdout.includes('No entitlements')) {
            console.log('⚠️  应用没有entitlements，权限可能受限');
        } else {
            console.log('✅ 应用已获得部分权限');
        }
    } catch (error) {
        console.log('❌ 无法检查应用权限:', error.message);
    }
    
    console.log('\n=== 测试完成 ===');
    console.log('\n注意事项:');
    console.log('1. 防火墙功能需要管理员权限');
    console.log('2. 首次使用可能需要输入管理员密码');
    console.log('3. 建议在系统偏好设置中授予应用完全磁盘访问权限');
    console.log('4. 如果遇到权限问题，请参考 docs/macos-permissions.md');
}

// 执行测试
testFirewallCapability().catch(console.error);
