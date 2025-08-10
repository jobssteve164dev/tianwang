#!/usr/bin/env node

/**
 * 天网安全监控系统 - 开发环境日志查看器
 * TianWang Security System - Development Environment Log Viewer
 * 
 * 功能：
 * - 实时查看日志
 * - 按服务过滤
 * - 关键词搜索
 * - 日志统计
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

class DevLogViewer {
    constructor() {
        this.logFile = path.join(__dirname, '..', 'logs', 'dev', 'dev-console.log');
        this.filters = {
            service: null,
            keyword: null,
            level: null
        };
        this.isWatching = false;
        this.watcher = null;
        this.rl = null;
        
        this.setupReadline();
    }
    
    /**
     * 设置命令行界面
     */
    setupReadline() {
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
    }
    
    /**
     * 显示帮助信息
     */
    showHelp() {
        console.log('\n=== 开发环境日志查看器 ===');
        console.log('命令:');
        console.log('  help                    - 显示帮助信息');
        console.log('  tail [lines]           - 查看最后N行日志 (默认50行)');
        console.log('  watch                  - 实时监控日志');
        console.log('  filter service <name>  - 按服务过滤 (CLIENT, SERVER, AI-ENGINE, SYSTEM)');
        console.log('  filter keyword <text>  - 按关键词过滤');
        console.log('  filter level <level>   - 按级别过滤 (ERROR, WARNING, INFO)');
        console.log('  clear                  - 清除所有过滤器');
        console.log('  stats                  - 显示日志统计信息');
        console.log('  search <keyword>       - 搜索关键词');
        console.log('  quit                   - 退出');
        console.log('');
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
     * 获取日志文件统计信息
     */
    getLogStats() {
        if (!this.checkLogFile()) return null;
        
        try {
            const content = fs.readFileSync(this.logFile, 'utf8');
            const lines = content.split('\n').filter(line => line.trim());
            
            const stats = {
                totalLines: lines.length,
                fileSize: fs.statSync(this.logFile).size,
                services: {},
                levels: {},
                lastModified: fs.statSync(this.logFile).mtime
            };
            
            // 统计服务分布
            lines.forEach(line => {
                const serviceMatch = line.match(/\[([^\]]+)\]/);
                if (serviceMatch) {
                    const service = serviceMatch[1];
                    stats.services[service] = (stats.services[service] || 0) + 1;
                }
                
                // 统计错误级别
                if (line.includes('ERROR')) {
                    stats.levels.ERROR = (stats.levels.ERROR || 0) + 1;
                } else if (line.includes('WARNING')) {
                    stats.levels.WARNING = (stats.levels.WARNING || 0) + 1;
                } else {
                    stats.levels.INFO = (stats.levels.INFO || 0) + 1;
                }
            });
            
            return stats;
        } catch (error) {
            console.log(`❌ 读取日志文件失败: ${error.message}`);
            return null;
        }
    }
    
    /**
     * 显示日志统计信息
     */
    showStats() {
        const stats = this.getLogStats();
        if (!stats) return;
        
        console.log('\n=== 日志统计信息 ===');
        console.log(`总行数: ${stats.totalLines.toLocaleString()}`);
        console.log(`文件大小: ${(stats.fileSize / 1024).toFixed(2)} KB`);
        console.log(`最后修改: ${stats.lastModified.toLocaleString()}`);
        
        console.log('\n服务分布:');
        Object.entries(stats.services).forEach(([service, count]) => {
            console.log(`  ${service}: ${count.toLocaleString()} 行`);
        });
        
        console.log('\n级别分布:');
        Object.entries(stats.levels).forEach(([level, count]) => {
            console.log(`  ${level}: ${count.toLocaleString()} 行`);
        });
        console.log('');
    }
    
    /**
     * 过滤日志行
     */
    filterLine(line) {
        if (!line.trim()) return false;
        
        // 按服务过滤
        if (this.filters.service) {
            if (!line.includes(`[${this.filters.service}]`)) {
                return false;
            }
        }
        
        // 按关键词过滤
        if (this.filters.keyword) {
            if (!line.toLowerCase().includes(this.filters.keyword.toLowerCase())) {
                return false;
            }
        }
        
        // 按级别过滤
        if (this.filters.level) {
            if (!line.includes(this.filters.level)) {
                return false;
            }
        }
        
        return true;
    }
    
    /**
     * 显示最后N行日志
     */
    showTail(lines = 50) {
        if (!this.checkLogFile()) return;
        
        try {
            const content = fs.readFileSync(this.logFile, 'utf8');
            const allLines = content.split('\n').filter(line => line.trim());
            const filteredLines = allLines.filter(line => this.filterLine(line));
            
            const startIndex = Math.max(0, filteredLines.length - lines);
            const displayLines = filteredLines.slice(startIndex);
            
            console.log(`\n=== 最后 ${displayLines.length} 行日志 ===`);
            if (this.filters.service) console.log(`服务过滤: ${this.filters.service}`);
            if (this.filters.keyword) console.log(`关键词过滤: ${this.filters.keyword}`);
            if (this.filters.level) console.log(`级别过滤: ${this.filters.level}`);
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
     * 搜索关键词
     */
    search(keyword) {
        if (!this.checkLogFile()) return;
        
        try {
            const content = fs.readFileSync(this.logFile, 'utf8');
            const lines = content.split('\n').filter(line => line.trim());
            
            const matches = lines.filter(line => 
                line.toLowerCase().includes(keyword.toLowerCase())
            );
            
            console.log(`\n=== 搜索 "${keyword}" 结果 (${matches.length} 条) ===`);
            console.log('');
            
            matches.forEach(line => {
                this.colorizeAndPrint(line);
            });
            
            console.log('');
        } catch (error) {
            console.log(`❌ 搜索失败: ${error.message}`);
        }
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
     * 开始实时监控
     */
    startWatching() {
        if (!this.checkLogFile()) return;
        
        if (this.isWatching) {
            console.log('⚠️  已经在监控中，请先停止当前监控');
            return;
        }
        
        this.isWatching = true;
        console.log('\n=== 开始实时监控日志 ===');
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
                                if (this.filterLine(line)) {
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
     * 设置过滤器
     */
    setFilter(type, value) {
        switch (type) {
            case 'service':
                this.filters.service = value;
                console.log(`✅ 服务过滤器已设置: ${value}`);
                break;
            case 'keyword':
                this.filters.keyword = value;
                console.log(`✅ 关键词过滤器已设置: ${value}`);
                break;
            case 'level':
                this.filters.level = value;
                console.log(`✅ 级别过滤器已设置: ${value}`);
                break;
            default:
                console.log(`❌ 未知过滤器类型: ${type}`);
        }
    }
    
    /**
     * 清除所有过滤器
     */
    clearFilters() {
        this.filters = {
            service: null,
            keyword: null,
            level: null
        };
        console.log('✅ 所有过滤器已清除');
    }
    
    /**
     * 处理用户输入
     */
    async handleInput() {
        return new Promise((resolve) => {
            this.rl.question('> ', (input) => {
                const parts = input.trim().split(' ');
                const command = parts[0].toLowerCase();
                const args = parts.slice(1);
                
                resolve({ command, args });
            });
        });
    }
    
    /**
     * 运行主循环
     */
    async run() {
        console.log('🚀 开发环境日志查看器启动');
        this.showHelp();
        
        while (true) {
            try {
                const { command, args } = await this.handleInput();
                
                switch (command) {
                    case 'help':
                        this.showHelp();
                        break;
                        
                    case 'tail':
                        const lines = args[0] ? parseInt(args[0]) : 50;
                        this.showTail(lines);
                        break;
                        
                    case 'watch':
                        this.startWatching();
                        break;
                        
                    case 'filter':
                        if (args.length < 2) {
                            console.log('❌ 用法: filter <type> <value>');
                            break;
                        }
                        this.setFilter(args[0], args[1]);
                        break;
                        
                    case 'clear':
                        this.clearFilters();
                        break;
                        
                    case 'stats':
                        this.showStats();
                        break;
                        
                    case 'search':
                        if (args.length < 1) {
                            console.log('❌ 用法: search <keyword>');
                            break;
                        }
                        this.search(args[0]);
                        break;
                        
                    case 'quit':
                    case 'exit':
                        this.stopWatching();
                        this.rl.close();
                        console.log('👋 再见！');
                        process.exit(0);
                        break;
                        
                    default:
                        console.log(`❌ 未知命令: ${command}`);
                        console.log('输入 help 查看可用命令');
                }
            } catch (error) {
                console.log(`❌ 处理命令时出错: ${error.message}`);
            }
        }
    }
}

// 主函数
function main() {
    const viewer = new DevLogViewer();
    viewer.run();
}

// 脚本入口
if (require.main === module) {
    main();
}

module.exports = DevLogViewer;
