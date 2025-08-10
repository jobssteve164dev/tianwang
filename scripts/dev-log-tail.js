#!/usr/bin/env node

/**
 * 天网安全监控系统 - 开发环境日志快速查看器
 * TianWang Security System - Development Environment Log Quick Viewer
 * 
 * 功能：
 * - 快速查看最后N行日志
 * - 实时监控日志
 * - 简单的过滤功能
 */

const fs = require('fs');
const path = require('path');

class DevLogTail {
    constructor() {
        this.logFile = path.join(__dirname, '..', 'logs', 'dev', 'dev-console.log');
        this.isWatching = false;
        this.watcher = null;
    }
    
    /**
     * 检查日志文件是否存在
     */
    checkLogFile() {
        if (!fs.existsSync(this.logFile)) {
            console.log(`❌ 日志文件不存在: ${this.logFile}`);
            console.log('请先启动开发环境: ./dev-start-with-logger.sh');
            return false;
        }
        return true;
    }
    
    /**
     * 带颜色输出日志行
     */
    colorizeAndPrint(line) {
        // 提取时间戳
        const timeMatch = line.match(/^\[([^\]]+)\]/);
        const timestamp = timeMatch ? timeMatch[1] : '';
        const rest = timeMatch ? line.substring(timeMatch[0].length) : line;
        
        // 提取服务名
        const serviceMatch = rest.match(/\[([^\]]+)\]/);
        const service = serviceMatch ? serviceMatch[1] : '';
        const message = serviceMatch ? rest.substring(serviceMatch[0].length) : rest;
        
        // 颜色代码
        const colors = {
            timestamp: '\x1b[36m', // 青色
            service: '\x1b[33m',   // 黄色
            error: '\x1b[31m',     // 红色
            warning: '\x1b[33m',   // 黄色
            info: '\x1b[32m',      // 绿色
            reset: '\x1b[0m'       // 重置
        };
        
        let colorizedLine = `${colors.timestamp}${timestamp}${colors.reset} `;
        
        if (service) {
            colorizedLine += `${colors.service}[${service}]${colors.reset} `;
        }
        
        // 根据内容添加颜色
        if (message.includes('ERROR') || service.includes('ERROR')) {
            colorizedLine += `${colors.error}${message}${colors.reset}`;
        } else if (message.includes('WARNING') || service.includes('WARNING')) {
            colorizedLine += `${colors.warning}${message}${colors.reset}`;
        } else {
            colorizedLine += `${colors.info}${message}${colors.reset}`;
        }
        
        console.log(colorizedLine);
    }
    
    /**
     * 显示最后N行日志
     */
    showTail(lines = 50, filter = null) {
        if (!this.checkLogFile()) return;
        
        try {
            const content = fs.readFileSync(this.logFile, 'utf8');
            let allLines = content.split('\n').filter(line => line.trim());
            
            // 应用过滤器
            if (filter) {
                allLines = allLines.filter(line => 
                    line.toLowerCase().includes(filter.toLowerCase())
                );
            }
            
            const startIndex = Math.max(0, allLines.length - lines);
            const displayLines = allLines.slice(startIndex);
            
            console.log(`\n=== 最后 ${displayLines.length} 行日志 ===`);
            if (filter) console.log(`过滤: ${filter}`);
            console.log('');
            
            displayLines.forEach(line => {
                this.colorizeAndPrint(line);
            });
            
            console.log('');
        } catch (error) {
            console.log(`❌ 读取日志文件失败: ${error.message}`);
        }
    }
    
    /**
     * 开始实时监控
     */
    startWatching(filter = null) {
        if (!this.checkLogFile()) return;
        
        if (this.isWatching) {
            console.log('⚠️  已经在监控中，请先停止当前监控');
            return;
        }
        
        this.isWatching = true;
        console.log('\n=== 开始实时监控日志 ===');
        if (filter) console.log(`过滤: ${filter}`);
        console.log('按 Ctrl+C 停止监控\n');
        
        let lastSize = fs.statSync(this.logFile).size;
        
        this.watcher = fs.watch(this.logFile, (eventType, filename) => {
            if (eventType === 'change') {
                try {
                    const currentSize = fs.statSync(this.logFile).size;
                    if (currentSize > lastSize) {
                        const stream = fs.createReadStream(this.logFile, {
                            start: lastSize,
                            end: currentSize
                        });
                        
                        stream.on('data', (chunk) => {
                            const lines = chunk.toString().split('\n').filter(line => line.trim());
                            lines.forEach(line => {
                                if (!filter || line.toLowerCase().includes(filter.toLowerCase())) {
                                    this.colorizeAndPrint(line);
                                }
                            });
                        });
                        
                        lastSize = currentSize;
                    }
                } catch (error) {
                    console.log(`❌ 监控出错: ${error.message}`);
                }
            }
        });
        
        // 设置信号处理
        process.on('SIGINT', () => {
            this.stopWatching();
            process.exit(0);
        });
    }
    
    /**
     * 停止实时监控
     */
    stopWatching() {
        if (this.watcher) {
            this.watcher.close();
            this.watcher = null;
        }
        this.isWatching = false;
        console.log('\n监控已停止');
    }
    
    /**
     * 显示帮助信息
     */
    showHelp() {
        console.log('\n=== 开发环境日志快速查看器 ===');
        console.log('用法:');
        console.log('  node scripts/dev-log-tail.js [lines] [filter]');
        console.log('  node scripts/dev-log-tail.js watch [filter]');
        console.log('');
        console.log('参数:');
        console.log('  lines   - 显示最后N行日志 (默认50行)');
        console.log('  filter  - 过滤关键词');
        console.log('  watch   - 实时监控模式');
        console.log('');
        console.log('示例:');
        console.log('  node scripts/dev-log-tail.js 100');
        console.log('  node scripts/dev-log-tail.js 50 error');
        console.log('  node scripts/dev-log-tail.js watch');
        console.log('  node scripts/dev-log-tail.js watch server');
        console.log('');
    }
}

// 主函数
function main() {
    const args = process.argv.slice(2);
    const tail = new DevLogTail();
    
    if (args.length === 0) {
        tail.showHelp();
        return;
    }
    
    const firstArg = args[0].toLowerCase();
    
    if (firstArg === 'help' || firstArg === '-h' || firstArg === '--help') {
        tail.showHelp();
        return;
    }
    
    if (firstArg === 'watch') {
        const filter = args[1] || null;
        tail.startWatching(filter);
        return;
    }
    
    // 解析行数和过滤器
    let lines = 50;
    let filter = null;
    
    if (!isNaN(firstArg)) {
        lines = parseInt(firstArg);
        filter = args[1] || null;
    } else {
        filter = firstArg;
    }
    
    tail.showTail(lines, filter);
}

// 脚本入口
if (require.main === module) {
    main();
}

module.exports = DevLogTail;
