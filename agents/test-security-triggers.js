const { exec, spawn } = require('child_process');
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

async function triggerSecurityEvents() {
    console.log('=== 安全威胁触发测试 ===\n');
    console.log('⚠️  警告: 此脚本将触发可能被安全软件检测的行为');
    console.log('请确保在测试环境中运行，并监控代理端的响应\n');
    
    const platform = os.platform();
    console.log(`当前平台: ${platform}`);
    
    if (platform !== 'darwin') {
        console.log('此测试主要针对 macOS 平台');
        return;
    }
    
    // 测试1: 可疑网络连接
    console.log('\n=== 测试1: 可疑网络连接 ===');
    console.log('尝试连接到已知的恶意IP地址...');
    
    try {
        // 尝试连接到一些已知的恶意IP（这些IP通常被安全软件标记）
        const maliciousIPs = [
            '185.220.101.182',  // 已知恶意IP示例
            '45.95.147.44',     // 已知恶意IP示例
            '91.92.240.58'      // 已知恶意IP示例
        ];
        
        for (const ip of maliciousIPs) {
            console.log(`尝试连接 ${ip}...`);
            try {
                const result = await execCommand(`nc -z -w 3 ${ip} 80`);
                if (result.error) {
                    console.log(`✅ 连接失败 (预期): ${ip}`);
                } else {
                    console.log(`⚠️  连接成功: ${ip}`);
                }
            } catch (error) {
                console.log(`✅ 连接被阻止: ${ip}`);
            }
            
            // 等待一秒再测试下一个
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    } catch (error) {
        console.log('网络连接测试失败:', error.message);
    }
    
    // 测试2: 可疑端口扫描
    console.log('\n=== 测试2: 端口扫描行为 ===');
    console.log('执行本地端口扫描...');
    
    try {
        const result = await execCommand('nmap -p 22,80,443,8080 localhost');
        if (result.error) {
            console.log('✅ 端口扫描被阻止或nmap不可用');
        } else {
            console.log('⚠️  端口扫描完成');
        }
    } catch (error) {
        console.log('端口扫描测试失败:', error.message);
    }
    
    // 测试3: 可疑文件操作
    console.log('\n=== 测试3: 可疑文件操作 ===');
    console.log('创建可疑文件...');
    
    try {
        const suspiciousFiles = [
            '/tmp/suspicious_script.sh',
            '/tmp/malware_test.exe',
            '/tmp/keylogger.py'
        ];
        
        for (const file of suspiciousFiles) {
            const content = `#!/bin/bash
# 可疑脚本内容
echo "This is a suspicious script for testing purposes"
sleep 1
`;
            
            fs.writeFileSync(file, content);
            fs.chmodSync(file, '755');
            console.log(`✅ 创建可疑文件: ${file}`);
            
            // 执行可疑脚本
            try {
                const result = await execCommand(`bash ${file}`);
                console.log(`⚠️  执行可疑脚本: ${file}`);
            } catch (error) {
                console.log(`✅ 脚本执行被阻止: ${file}`);
            }
            
            // 清理
            fs.unlinkSync(file);
        }
    } catch (error) {
        console.log('文件操作测试失败:', error.message);
    }
    
    // 测试4: 可疑进程启动
    console.log('\n=== 测试4: 可疑进程启动 ===');
    console.log('启动可疑进程...');
    
    try {
        // 启动一个持续运行的进程，模拟恶意软件行为
        const suspiciousProcess = spawn('bash', ['-c', 'while true; do echo "suspicious activity"; sleep 5; done'], {
            detached: true,
            stdio: 'ignore'
        });
        
        console.log(`⚠️  启动可疑进程 PID: ${suspiciousProcess.pid}`);
        
        // 等待10秒后终止进程
        setTimeout(async () => {
            try {
                await execCommand(`kill ${suspiciousProcess.pid}`);
                console.log('✅ 终止可疑进程');
            } catch (error) {
                console.log('进程终止失败:', error.message);
            }
        }, 10000);
        
    } catch (error) {
        console.log('进程启动测试失败:', error.message);
    }
    
    // 测试5: 系统日志篡改尝试
    console.log('\n=== 测试5: 系统日志篡改尝试 ===');
    console.log('尝试修改系统日志...');
    
    try {
        const logTestFile = '/tmp/log_tamper_test.log';
        fs.writeFileSync(logTestFile, 'Suspicious log entry for testing\n');
        
        // 尝试追加到系统日志
        const result = await execCommand(`echo "SUSPICIOUS ACTIVITY DETECTED" | sudo tee -a /var/log/system.log`);
        if (result.error) {
            console.log('✅ 系统日志修改被阻止');
        } else {
            console.log('⚠️  系统日志修改成功');
        }
        
        // 清理测试文件
        fs.unlinkSync(logTestFile);
    } catch (error) {
        console.log('日志篡改测试失败:', error.message);
    }
    
    // 测试6: 网络流量异常
    console.log('\n=== 测试6: 网络流量异常 ===');
    console.log('生成异常网络流量...');
    
    try {
        // 创建大量网络连接
        const connections = [];
        for (let i = 0; i < 10; i++) {
            const conn = spawn('curl', ['-s', '--connect-timeout', '2', 'https://www.google.com']);
            connections.push(conn);
        }
        
        console.log('⚠️  创建了10个并发网络连接');
        
        // 等待连接完成
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // 清理连接
        connections.forEach(conn => {
            try {
                conn.kill();
            } catch (error) {
                // 忽略错误
            }
        });
        
        console.log('✅ 网络连接测试完成');
    } catch (error) {
        console.log('网络流量测试失败:', error.message);
    }
    
    // 测试7: 权限提升尝试
    console.log('\n=== 测试7: 权限提升尝试 ===');
    console.log('尝试权限提升操作...');
    
    try {
        // 尝试修改系统文件
        const result = await execCommand('sudo touch /tmp/privilege_escalation_test');
        if (result.error) {
            console.log('✅ 权限提升被阻止');
        } else {
            console.log('⚠️  权限提升成功');
            // 清理
            await execCommand('sudo rm /tmp/privilege_escalation_test');
        }
    } catch (error) {
        console.log('权限提升测试失败:', error.message);
    }
    
    // 测试8: 加密通信检测
    console.log('\n=== 测试8: 加密通信检测 ===');
    console.log('建立加密通信连接...');
    
    try {
        // 尝试建立SSL/TLS连接
        const result = await execCommand('openssl s_client -connect www.google.com:443 -servername www.google.com < /dev/null');
        if (result.error) {
            console.log('✅ 加密连接被阻止');
        } else {
            console.log('⚠️  加密连接成功');
        }
    } catch (error) {
        console.log('加密通信测试失败:', error.message);
    }
    
    console.log('\n=== 测试完成 ===');
    console.log('\n请检查以下内容:');
    console.log('1. 代理端是否检测到威胁事件');
    console.log('2. 客户端是否收到威胁警告');
    console.log('3. 防火墙是否自动阻止了可疑IP');
    console.log('4. 系统日志中是否有安全事件记录');
    console.log('5. 应用界面是否显示威胁警报');
    
    console.log('\n监控建议:');
    console.log('- 查看代理端日志文件');
    console.log('- 检查客户端威胁面板');
    console.log('- 监控系统防火墙规则');
    console.log('- 查看系统安全日志');
}

// 执行测试
triggerSecurityEvents().catch(console.error);
