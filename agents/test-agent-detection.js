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

async function testAgentDetection() {
    console.log('=== 代理端威胁检测测试 ===\n');
    console.log('此脚本将触发代理端可能检测到的安全事件\n');
    
    const platform = os.platform();
    console.log(`当前平台: ${platform}`);
    
    if (platform !== 'darwin') {
        console.log('此测试主要针对 macOS 平台');
        return;
    }
    
    // 测试1: 可疑进程启动 (基于SecurityService中的检测规则)
    console.log('\n=== 测试1: 可疑进程检测 ===');
    console.log('启动可疑进程 (nc, netcat, nmap等)...');
    
    try {
        const suspiciousProcesses = [
            { name: 'nc', args: ['-l', '8080'] },
            { name: 'netcat', args: ['-l', '8081'] },
            { name: 'nmap', args: ['-p', '80', 'localhost'] },
            { name: 'masscan', args: ['--ports', '80', '127.0.0.1'] }
        ];
        
        for (const proc of suspiciousProcesses) {
            console.log(`尝试启动 ${proc.name}...`);
            try {
                const result = await execCommand(`which ${proc.name}`);
                if (result.error) {
                    console.log(`⚠️  ${proc.name} 不可用`);
                    continue;
                }
                
                const process = spawn(proc.name, proc.args, {
                    detached: true,
                    stdio: 'ignore'
                });
                
                console.log(`⚠️  启动可疑进程: ${proc.name} (PID: ${process.pid})`);
                
                // 等待2秒后终止
                setTimeout(async () => {
                    try {
                        await execCommand(`kill ${process.pid}`);
                        console.log(`✅ 终止进程: ${proc.name}`);
                    } catch (error) {
                        // 忽略错误
                    }
                }, 2000);
                
            } catch (error) {
                console.log(`✅ ${proc.name} 启动被阻止`);
            }
            
            // 等待一秒再测试下一个
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    } catch (error) {
        console.log('可疑进程测试失败:', error.message);
    }
    
    // 测试2: 危险命令执行 (基于SecurityService中的检测规则)
    console.log('\n=== 测试2: 危险命令检测 ===');
    console.log('执行危险命令...');
    
    try {
        const dangerousCommands = [
            'rm -rf /tmp/test_delete',
            'dd if=/dev/zero of=/tmp/test_file bs=1M count=1',
            'format /tmp/test_format'
        ];
        
        for (const cmd of dangerousCommands) {
            console.log(`尝试执行: ${cmd}`);
            try {
                const result = await execCommand(cmd);
                console.log(`⚠️  命令执行成功: ${cmd}`);
            } catch (error) {
                console.log(`✅ 命令执行被阻止: ${cmd}`);
            }
            
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    } catch (error) {
        console.log('危险命令测试失败:', error.message);
    }
    
    // 测试3: 网络连接监控 (基于NetworkMonitor的检测)
    console.log('\n=== 测试3: 网络连接监控 ===');
    console.log('创建大量网络连接...');
    
    try {
        // 创建多个并发连接
        const connections = [];
        for (let i = 0; i < 5; i++) {
            const conn = spawn('curl', ['-s', '--connect-timeout', '3', 'https://httpbin.org/delay/2']);
            connections.push(conn);
            console.log(`⚠️  创建连接 ${i + 1}`);
        }
        
        // 等待连接完成
        await new Promise(resolve => setTimeout(resolve, 4000));
        
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
        console.log('网络连接测试失败:', error.message);
    }
    
    // 测试4: 端口扫描检测
    console.log('\n=== 测试4: 端口扫描检测 ===');
    console.log('执行端口扫描...');
    
    try {
        // 使用系统工具进行端口扫描
        const scanCommands = [
            'lsof -i :80',
            'netstat -an | grep LISTEN',
            'ss -tuln | grep :80'
        ];
        
        for (const cmd of scanCommands) {
            console.log(`执行: ${cmd}`);
            try {
                const result = await execCommand(cmd);
                console.log(`⚠️  扫描完成: ${cmd}`);
            } catch (error) {
                console.log(`✅ 扫描被阻止: ${cmd}`);
            }
            
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    } catch (error) {
        console.log('端口扫描测试失败:', error.message);
    }
    
    // 测试5: 系统资源异常使用
    console.log('\n=== 测试5: 系统资源异常使用 ===');
    console.log('创建CPU和内存负载...');
    
    try {
        // 创建CPU密集型进程
        const cpuProcess = spawn('bash', ['-c', 'for i in {1..1000000}; do echo $i > /dev/null; done'], {
            detached: true,
            stdio: 'ignore'
        });
        
        console.log(`⚠️  启动CPU密集型进程 (PID: ${cpuProcess.pid})`);
        
        // 等待5秒后终止
        setTimeout(async () => {
            try {
                await execCommand(`kill ${cpuProcess.pid}`);
                console.log('✅ 终止CPU密集型进程');
            } catch (error) {
                // 忽略错误
            }
        }, 5000);
        
    } catch (error) {
        console.log('系统资源测试失败:', error.message);
    }
    
    // 测试6: 文件系统异常访问
    console.log('\n=== 测试6: 文件系统异常访问 ===');
    console.log('访问敏感目录...');
    
    try {
        const sensitivePaths = [
            '/etc/passwd',
            '/etc/shadow',
            '/var/log/system.log',
            '/Library/Preferences/com.apple.loginwindow.plist'
        ];
        
        for (const path of sensitivePaths) {
            console.log(`尝试访问: ${path}`);
            try {
                const result = await execCommand(`ls -la ${path}`);
                console.log(`⚠️  访问成功: ${path}`);
            } catch (error) {
                console.log(`✅ 访问被阻止: ${path}`);
            }
            
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    } catch (error) {
        console.log('文件系统访问测试失败:', error.message);
    }
    
    // 测试7: 进程注入尝试
    console.log('\n=== 测试7: 进程注入尝试 ===');
    console.log('尝试进程注入...');
    
    try {
        // 尝试附加到系统进程
        const result = await execCommand('ps aux | grep -E "(launchd|kernel_task)" | head -1');
        if (result.stdout) {
            const pid = result.stdout.split(/\s+/)[1];
            console.log(`⚠️  尝试附加到进程 PID: ${pid}`);
            
            try {
                await execCommand(`kill -0 ${pid}`);
                console.log('⚠️  进程注入尝试完成');
            } catch (error) {
                console.log('✅ 进程注入被阻止');
            }
        }
    } catch (error) {
        console.log('进程注入测试失败:', error.message);
    }
    
    // 测试8: 网络流量异常模式
    console.log('\n=== 测试8: 网络流量异常模式 ===');
    console.log('生成异常网络流量模式...');
    
    try {
        // 快速连续的网络请求
        for (let i = 0; i < 10; i++) {
            const conn = spawn('curl', ['-s', '--connect-timeout', '1', 'https://httpbin.org/status/200']);
            console.log(`⚠️  快速请求 ${i + 1}`);
            
            setTimeout(() => {
                try {
                    conn.kill();
                } catch (error) {
                    // 忽略错误
                }
            }, 1000);
            
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        console.log('✅ 网络流量模式测试完成');
    } catch (error) {
        console.log('网络流量模式测试失败:', error.message);
    }
    
    console.log('\n=== 测试完成 ===');
    console.log('\n请检查以下内容:');
    console.log('1. 代理端日志中是否有威胁检测记录');
    console.log('2. 客户端是否收到实时威胁警告');
    console.log('3. 防火墙是否自动阻止了可疑活动');
    console.log('4. 系统监控是否检测到异常行为');
    console.log('5. 事件服务是否记录了安全事件');
    
    console.log('\n监控位置:');
    console.log('- 代理端应用界面');
    console.log('- 系统日志: /var/log/system.log');
    console.log('- 应用日志: ~/Library/Application Support/tianwang-agent/');
    console.log('- 防火墙规则: sudo pfctl -s rules');
    
    console.log('\n预期结果:');
    console.log('- 代理端应该检测到可疑进程启动');
    console.log('- 网络监控应该发现异常连接模式');
    console.log('- 安全服务应该记录威胁事件');
    console.log('- 客户端应该显示实时警告');
}

// 执行测试
testAgentDetection().catch(console.error);
