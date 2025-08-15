const { exec } = require('child_process');
const os = require('os');
const fs = require('fs');
const path = require('path');

function execCommand(command) {
    return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
            resolve({ error, stdout, stderr });
        });
    });
}

async function testPermissionPrompts() {
    console.log('=== macOS 权限提示测试 ===\n');
    
    const platform = os.platform();
    console.log(`当前平台: ${platform}`);
    
    if (platform !== 'darwin') {
        console.log('此测试仅适用于 macOS 平台');
        return;
    }
    
    console.log('\n=== 测试1: 完全磁盘访问权限 ===');
    console.log('尝试访问系统日志目录...');
    
    try {
        // 尝试访问系统日志目录，这会触发完全磁盘访问权限提示
        const result = await execCommand('ls -la /var/log/system.log');
        if (result.error) {
            console.log('✅ 权限提示应该已触发 - 无法访问系统日志');
            console.log('请在系统偏好设置 > 安全性与隐私 > 隐私 > 完全磁盘访问权限中授予应用权限');
        } else {
            console.log('⚠️  已有完全磁盘访问权限');
        }
    } catch (error) {
        console.log('权限检查失败:', error.message);
    }
    
    console.log('\n=== 测试2: 辅助功能权限 ===');
    console.log('尝试控制系统偏好设置...');
    
    try {
        // 尝试使用AppleScript控制系统偏好设置，这会触发辅助功能权限提示
        const script = `
            tell application "System Preferences"
                activate
                set current pane to pane id "com.apple.preference.security"
            end tell
        `;
        
        const result = await execCommand(`osascript -e '${script}'`);
        if (result.error && result.error.message.includes('not authorized')) {
            console.log('✅ 辅助功能权限提示应该已触发');
            console.log('请在系统偏好设置 > 安全性与隐私 > 隐私 > 辅助功能中授予应用权限');
        } else if (result.error) {
            console.log('⚠️  辅助功能权限检查失败:', result.error.message);
        } else {
            console.log('⚠️  已有辅助功能权限');
        }
    } catch (error) {
        console.log('辅助功能测试失败:', error.message);
    }
    
    console.log('\n=== 测试3: 防火墙权限 ===');
    console.log('尝试执行防火墙命令...');
    
    try {
        // 尝试执行需要管理员权限的防火墙命令
        const result = await execCommand('sudo pfctl -s info');
        if (result.error && result.error.message.includes('password')) {
            console.log('✅ 管理员权限提示应该已触发');
            console.log('请输入管理员密码以授予防火墙管理权限');
        } else if (result.error) {
            console.log('⚠️  防火墙权限检查失败:', result.error.message);
        } else {
            console.log('⚠️  已有防火墙管理权限');
        }
    } catch (error) {
        console.log('防火墙测试失败:', error.message);
    }
    
    console.log('\n=== 测试4: 网络访问权限 ===');
    console.log('尝试建立网络连接...');
    
    try {
        // 尝试建立网络连接，这会触发网络访问权限
        const result = await execCommand('curl -s --connect-timeout 5 https://www.apple.com');
        if (result.error) {
            console.log('⚠️  网络访问失败:', result.error.message);
        } else {
            console.log('✅ 网络访问权限正常');
        }
    } catch (error) {
        console.log('网络测试失败:', error.message);
    }
    
    console.log('\n=== 权限配置建议 ===');
    console.log('1. 完全磁盘访问权限: 系统偏好设置 > 安全性与隐私 > 隐私 > 完全磁盘访问权限');
    console.log('2. 辅助功能权限: 系统偏好设置 > 安全性与隐私 > 隐私 > 辅助功能');
    console.log('3. 网络访问权限: 系统偏好设置 > 安全性与隐私 > 防火墙');
    console.log('4. 管理员权限: 首次使用防火墙功能时会提示输入密码');
    
    console.log('\n=== 测试完成 ===');
}

// 执行测试
testPermissionPrompts().catch(console.error);
