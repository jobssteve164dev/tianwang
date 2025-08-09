#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// 颜色输出
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
    console.log(colors[color] + message + colors.reset);
}

function runCommand(command, args, cwd) {
    return new Promise((resolve, reject) => {
        log(`\n🏃 运行: ${command} ${args.join(' ')}`, 'cyan');
        log(`📁 目录: ${cwd}`, 'blue');

        const child = spawn(command, args, {
            cwd,
            stdio: 'inherit',
            shell: true
        });

        child.on('close', (code) => {
            if (code === 0) {
                log(`✅ 成功: ${command} ${args.join(' ')}`, 'green');
                resolve(code);
            } else {
                log(`❌ 失败: ${command} ${args.join(' ')} (退出码: ${code})`, 'red');
                resolve(code); // 不reject，继续执行其他测试
            }
        });

        child.on('error', (error) => {
            log(`💥 错误: ${error.message}`, 'red');
            resolve(1);
        });
    });
}

async function runTests() {
    const rootDir = path.resolve(__dirname, '..');
    const serverDir = path.join(rootDir, 'server');
    const agentsDir = path.join(rootDir, 'agents');
    const testsDir = path.join(rootDir, 'tests');

    log('🚀 开始运行天网系统单元测试', 'bright');
    log('=' .repeat(50), 'magenta');

    const results = {
        server: null,
        agents: null,
        integration: null
    };

    // 1. 运行服务端测试
    log('\n📡 运行服务端单元测试...', 'yellow');
    if (fs.existsSync(serverDir)) {
        results.server = await runCommand('npm', ['test'], serverDir);
    } else {
        log('⚠️  服务端目录不存在，跳过', 'yellow');
        results.server = -1;
    }

    // 2. 运行桌面客户端测试
    log('\n🖥️  运行桌面客户端单元测试...', 'yellow');
    if (fs.existsSync(agentsDir)) {
        results.agents = await runCommand('npm', ['test'], agentsDir);
    } else {
        log('⚠️  客户端目录不存在，跳过', 'yellow');
        results.agents = -1;
    }

    // 3. 运行集成测试
    log('\n🔗 运行集成测试...', 'yellow');
    if (fs.existsSync(testsDir)) {
        // 检查是否有Jest配置
        const jestConfig = path.join(rootDir, 'jest.config.js');
        if (fs.existsSync(jestConfig)) {
            results.integration = await runCommand('npx', ['jest', '--config', 'jest.config.js'], rootDir);
        } else {
            log('⚠️  没有找到集成测试配置，跳过', 'yellow');
            results.integration = -1;
        }
    } else {
        log('⚠️  集成测试目录不存在，跳过', 'yellow');
        results.integration = -1;
    }

    // 4. 生成覆盖率报告
    log('\n📊 生成测试覆盖率报告...', 'yellow');
    
    // 服务端覆盖率
    if (results.server === 0) {
        log('📈 生成服务端覆盖率报告...', 'cyan');
        await runCommand('npm', ['run', 'test:coverage'], serverDir);
    }

    // 桌面客户端覆盖率
    if (results.agents === 0) {
        log('📈 生成桌面客户端覆盖率报告...', 'cyan');
        await runCommand('npm', ['run', 'test:coverage'], agentsDir);
    }

    // 输出测试结果摘要
    log('\n' + '='.repeat(50), 'magenta');
    log('📋 测试结果摘要', 'bright');
    log('='.repeat(50), 'magenta');

    const statusIcon = (code) => {
        if (code === -1) return '⏭️  跳过';
        if (code === 0) return '✅ 通过';
        return '❌ 失败';
    };

    const statusColor = (code) => {
        if (code === -1) return 'yellow';
        if (code === 0) return 'green';
        return 'red';
    };

    log(`服务端测试:     ${statusIcon(results.server)}`, statusColor(results.server));
    log(`桌面客户端测试: ${statusIcon(results.agents)}`, statusColor(results.agents));
    log(`集成测试:       ${statusIcon(results.integration)}`, statusColor(results.integration));

    // 计算总体结果
    const totalTests = Object.values(results).filter(r => r !== -1).length;
    const passedTests = Object.values(results).filter(r => r === 0).length;
    const failedTests = Object.values(results).filter(r => r > 0).length;

    log('\n📊 总体统计:', 'bright');
    log(`总测试套件: ${totalTests}`, 'cyan');
    log(`通过: ${passedTests}`, 'green');
    log(`失败: ${failedTests}`, failedTests > 0 ? 'red' : 'green');

    if (failedTests === 0 && totalTests > 0) {
        log('\n🎉 所有测试都通过了！', 'green');
        process.exit(0);
    } else if (totalTests === 0) {
        log('\n⚠️  没有运行任何测试', 'yellow');
        process.exit(1);
    } else {
        log(`\n💥 有 ${failedTests} 个测试套件失败`, 'red');
        process.exit(1);
    }
}

// 处理命令行参数
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
    log('天网系统测试运行器', 'bright');
    log('');
    log('用法: node scripts/run-tests.js [选项]', 'cyan');
    log('');
    log('选项:', 'yellow');
    log('  --help, -h     显示帮助信息');
    log('  --server       仅运行服务端测试');
    log('  --agents       仅运行桌面客户端测试');
    log('  --integration  仅运行集成测试');
    log('');
    process.exit(0);
}

// 检查特定模块测试
if (args.includes('--server')) {
    log('🎯 仅运行服务端测试', 'cyan');
    runCommand('npm', ['test'], path.join(__dirname, '..', 'server'))
        .then(code => process.exit(code));
} else if (args.includes('--agents')) {
    log('🎯 仅运行桌面客户端测试', 'cyan');
    runCommand('npm', ['test'], path.join(__dirname, '..', 'agents'))
        .then(code => process.exit(code));
} else if (args.includes('--integration')) {
    log('🎯 仅运行集成测试', 'cyan');
    runCommand('npx', ['jest', '--config', 'jest.config.js'], path.join(__dirname, '..'))
        .then(code => process.exit(code));
} else {
    // 运行所有测试
    runTests().catch(error => {
        log(`💥 测试运行器出错: ${error.message}`, 'red');
        process.exit(1);
    });
} 