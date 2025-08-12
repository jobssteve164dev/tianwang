#!/usr/bin/env node

/**
 * 天网安全监控系统 - 增强版开发环境日志收集器
 * TianWang Security System - Enhanced Development Environment Log Collector
 * 
 * 功能：
 * - 流式收集客户端、AI引擎、服务端的所有console日志
 * - 通过WebSocket收集浏览器控制台日志
 * - 限制最大100000行，超出自动覆盖
 * - 随系统启动和关闭
 * - 每次启动时清理并生成新文件
 * 
 * 注意：此脚本只负责日志收集，不负责启动进程
 * 进程启动由 dev.sh 脚本负责
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const readline = require('readline');
const WebSocket = require('ws');

class EnhancedDevLogger {
    constructor() {
        this.logDir = path.join(__dirname, '..', 'logs', 'dev');
        this.logFile = path.join(this.logDir, 'dev-console.log');
        this.maxLines = 100000;
        this.currentLines = 0;
        this.writeStream = null;
        this.processes = new Map();
        this.isShuttingDown = false;
        this.wsServer = null;
        this.browserClients = new Set();
        
        // 确保日志目录存在
        this.ensureLogDirectory();
        
        // 清理并初始化日志文件
        this.initializeLogFile();
        
        // 设置进程退出处理
        this.setupProcessHandlers();
        
        // 启动WebSocket服务器收集浏览器日志
        this.startWebSocketServer();
    }
    
    /**
     * 确保日志目录存在
     */
    ensureLogDirectory() {
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }
    }
    
    /**
     * 初始化日志文件
     */
    initializeLogFile() {
        // 清理旧日志文件
        if (fs.existsSync(this.logFile)) {
            fs.unlinkSync(this.logFile);
        }
        
        // 创建新的日志文件
        this.writeStream = fs.createWriteStream(this.logFile, { 
            flags: 'a',
            encoding: 'utf8'
        });
        
        // 写入启动标记
        const startTime = new Date().toISOString();
        this.writeLog('SYSTEM', `=== 增强版开发环境日志收集器启动 ${startTime} ===`);
        this.writeLog('SYSTEM', `日志文件: ${this.logFile}`);
        this.writeLog('SYSTEM', `最大行数限制: ${this.maxLines.toLocaleString()}`);
        this.writeLog('SYSTEM', `WebSocket服务器: ws://localhost:8889`);
        this.writeLog('SYSTEM', '注意：此脚本只负责日志收集，进程启动由 dev.sh 负责');
        this.writeLog('SYSTEM', '');
    }
    
    /**
     * 设置进程退出处理
     */
    setupProcessHandlers() {
        const cleanup = () => {
            if (this.isShuttingDown) return;
            this.isShuttingDown = true;
            
            console.log('\n正在关闭增强版日志收集器...');
            this.writeLog('SYSTEM', '=== 增强版开发环境日志收集器关闭 ===');
            
            // 停止所有监控的进程
            this.stopAllProcesses();
            
            // 关闭WebSocket服务器
            if (this.wsServer) {
                this.wsServer.close();
            }
            
            // 关闭写入流
            if (this.writeStream) {
                this.writeStream.end();
            }
            
            process.exit(0);
        };
        
        process.on('SIGINT', cleanup);
        process.on('SIGTERM', cleanup);
        process.on('exit', cleanup);
    }
    
    /**
     * 启动WebSocket服务器收集浏览器日志
     */
    startWebSocketServer() {
        this.wsServer = new WebSocket.Server({ port: 8889 });
        
        this.wsServer.on('connection', (ws) => {
            this.browserClients.add(ws);
            this.writeLog('SYSTEM', '浏览器客户端已连接');
            
            ws.on('message', (message) => {
                try {
                    const data = JSON.parse(message);
                    this.writeLog('BROWSER', `${data.level || 'INFO'} | ${data.message || data}`);
                } catch (error) {
                    this.writeLog('BROWSER-ERROR', `消息解析失败: ${message}`);
                }
            });
            
            ws.on('close', () => {
                this.browserClients.delete(ws);
                this.writeLog('SYSTEM', '浏览器客户端已断开');
            });
            
            ws.on('error', (error) => {
                this.writeLog('SYSTEM-ERROR', `WebSocket错误: ${error.message}`);
            });
        });
        
        this.wsServer.on('error', (error) => {
            this.writeLog('SYSTEM-ERROR', `WebSocket服务器错误: ${error.message}`);
        });
        
        this.writeLog('SYSTEM', 'WebSocket服务器已启动 (端口: 8889)');
    }
    
    /**
     * 写入日志
     */
    writeLog(service, message) {
        if (!this.writeStream) return;
        
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] [${service}] ${message}\n`;
        
        this.writeStream.write(logEntry);
        this.currentLines++;
        
        // 检查是否需要滚动日志
        if (this.currentLines >= this.maxLines) {
            this.rolloverLog();
        }
    }
    
    /**
     * 滚动日志文件
     */
    rolloverLog() {
        if (this.writeStream) {
            this.writeStream.end();
        }
        
        // 备份当前日志文件
        if (fs.existsSync(this.logFile)) {
            const backupFile = this.logFile.replace('.log', `.log.${Date.now()}`);
            try {
                fs.renameSync(this.logFile, backupFile);
                console.log(`日志文件已备份: ${backupFile}`);
            } catch (error) {
                console.log(`备份日志文件失败: ${error.message}`);
            }
        }
        
        // 创建新的日志文件
        this.writeStream = fs.createWriteStream(this.logFile, { 
            flags: 'a',
            encoding: 'utf8'
        });
        
        this.currentLines = 0;
        const rolloverTime = new Date().toISOString();
        this.writeLog('SYSTEM', `=== 日志滚动 ${rolloverTime} ===`);
        this.writeLog('SYSTEM', '');
    }
    
    /**
     * 清理ANSI颜色代码
     */
    cleanAnsiCodes(line) {
        return line.replace(/\x1B\[([0-9]{1,2}(;[0-9]{1,2})?)?[mGKH]/g, '');
    }

    /**
     * 启动AI引擎日志收集（只收集，不启动进程）
     */
    startAIEngineLogger() {
        const aiEngineDir = path.join(__dirname, '..', 'server', 'ai-engine');
        const logFile = path.join(aiEngineDir, 'logs', 'ai_engine.log');
        
        // 确保AI引擎日志目录存在
        const logDir = path.dirname(logFile);
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
        
        // 检查AI引擎日志文件是否存在
        if (!fs.existsSync(logFile)) {
            this.writeLog('SYSTEM', `AI引擎日志文件不存在: ${logFile}`);
            this.writeLog('SYSTEM', '等待AI引擎启动并生成日志...');
            return;
        }
        
        // 启动日志文件监控进程
        const tailProcess = spawn('tail', ['-f', logFile], {
            stdio: ['pipe', 'pipe', 'pipe']
        });
        
        this.processes.set('ai-engine-log', tailProcess);
        
        // 收集stdout
        tailProcess.stdout.on('data', (data) => {
            const lines = data.toString().split('\n').filter(line => line.trim());
            lines.forEach(line => {
                // 解析loguru格式的日志
                const loguruPattern = /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}) \| (\w+)\s* \| (.+?)(?: - (.+))?$/;
                const loguruMatch = line.match(loguruPattern);
                
                if (loguruMatch) {
                    const [, timestamp, level, source, message] = loguruMatch;
                    const actualMessage = message || source;
                    const actualSource = message ? source : '';
                    
                    let serviceTag = 'AI-ENGINE';
                    if (level === 'ERROR' || level === 'CRITICAL') {
                        serviceTag = 'AI-ENGINE-ERROR';
                    } else if (level === 'WARNING') {
                        serviceTag = 'AI-ENGINE-WARN';
                    } else if (level === 'DEBUG') {
                        serviceTag = 'AI-ENGINE-DEBUG';
                    }
                    
                    let logContent = `${level}`;
                    if (actualSource) {
                        logContent += ` | ${actualSource}`;
                    }
                    if (actualMessage) {
                        logContent += ` | ${actualMessage}`;
                    }
                    
                    this.writeLog(serviceTag, logContent);
                } else {
                    this.writeLog('AI-ENGINE', line);
                }
            });
        });
        
        // 处理进程退出
        tailProcess.on('close', (code) => {
            this.writeLog('SYSTEM', `AI引擎日志监控进程退出，退出码: ${code}`);
            this.processes.delete('ai-engine-log');
        });
        
        this.writeLog('SYSTEM', 'AI引擎日志收集已启动');
    }
    
    /**
     * 启动服务端日志收集（只收集，不启动进程）
     */
    startServerLogger() {
        const serverDir = path.join(__dirname, '..', 'server');
        const logFile = path.join(serverDir, 'logs', 'server.log');
        
        // 确保服务端日志目录存在
        const logDir = path.dirname(logFile);
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
        
        // 检查服务端日志文件是否存在
        if (!fs.existsSync(logFile)) {
            this.writeLog('SYSTEM', `服务端日志文件不存在: ${logFile}`);
            this.writeLog('SYSTEM', '等待服务端启动并生成日志...');
            return;
        }
        
        // 启动日志文件监控进程
        const tailProcess = spawn('tail', ['-f', logFile], {
            stdio: ['pipe', 'pipe', 'pipe']
        });
        
        this.processes.set('server-log', tailProcess);
        
        // 收集stdout
        tailProcess.stdout.on('data', (data) => {
            const lines = data.toString().split('\n').filter(line => line.trim());
            lines.forEach(line => {
                const cleanLine = this.cleanAnsiCodes(line);
                const parsedLine = this.parseServerLog(cleanLine);
                this.writeLog('SERVER', parsedLine);
            });
        });
        
        // 处理进程退出
        tailProcess.on('close', (code) => {
            this.writeLog('SYSTEM', `服务端日志监控进程退出，退出码: ${code}`);
            this.processes.delete('server-log');
        });
        
        this.writeLog('SYSTEM', '服务端日志收集已启动');
    }
    
    /**
     * 解析服务器日志，清理重复时间戳
     */
    parseServerLog(line) {
        // 匹配服务器日志格式: "07:36:15.814 info [tianwang-server]: 127.0.0.1 - - [10/Aug/2025:23:36:15 +0000] "GET /api/dashboard/security-metrics HTTP/1.1" 200 351 ..."
        // 支持带毫秒的时间戳格式
        const serverLogPattern = /^(\d{2}:\d{2}:\d{2}(?:\.\d{3})?)\s+(\w+)\s+\[([^\]]+)\]:\s+(.+)$/;
        const match = line.match(serverLogPattern);
        
        if (match) {
            const [, time, level, service, rest] = match;
            
            // 进一步解析HTTP请求部分，移除HTTP日志中的时间戳
            const httpPattern = /^(\d+\.\d+\.\d+\.\d+)\s+-\s+-\s+\[([^\]]+)\]\s+"([^"]+)"\s+(\d+)\s+([-\d]+)\s+"([^"]*)"\s+"([^"]*)"$/;
            const httpMatch = rest.match(httpPattern);
            
            if (httpMatch) {
                const [, ip, httpTime, request, status, size, referer, userAgent] = httpMatch;
                
                // 提取HTTP方法和路径
                const requestParts = request.split(' ');
                const method = requestParts[0];
                const path = requestParts[1];
                
                // 处理响应大小，如果是"-"则显示为"-"
                const sizeDisplay = size === '-' ? '-' : `${size}B`;
                
                // 构建简化的日志内容
                return `${level.toUpperCase()} | ${service} | ${method} ${path} | ${status} | ${sizeDisplay}`;
            } else {
                // 如果不是HTTP请求，返回简化格式
                return `${level.toUpperCase()} | ${service} | ${rest}`;
            }
        }
        
        // 如果无法解析，返回原行
        return line;
    }
    
    /**
     * 启动客户端日志收集（只收集，不启动进程）
     */
    startClientLogger() {
        const clientDir = path.join(__dirname, '..', 'client');
        const logFile = path.join(clientDir, 'logs', 'client.log');
        
        // 确保客户端日志目录存在
        const logDir = path.dirname(logFile);
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
        
        // 检查客户端日志文件是否存在
        if (!fs.existsSync(logFile)) {
            this.writeLog('SYSTEM', `客户端日志文件不存在: ${logFile}`);
            this.writeLog('SYSTEM', '等待客户端启动并生成日志...');
            return;
        }
        
        // 启动日志文件监控进程
        const tailProcess = spawn('tail', ['-f', logFile], {
            stdio: ['pipe', 'pipe', 'pipe']
        });
        
        this.processes.set('client-log', tailProcess);
        
        // 收集stdout
        tailProcess.stdout.on('data', (data) => {
            const lines = data.toString().split('\n').filter(line => line.trim());
            lines.forEach(line => {
                const cleanLine = this.cleanAnsiCodes(line);
                this.writeLog('CLIENT', cleanLine);
            });
        });
        
        // 处理进程退出
        tailProcess.on('close', (code) => {
            this.writeLog('SYSTEM', `客户端日志监控进程退出，退出码: ${code}`);
            this.processes.delete('client-log');
        });
        
        this.writeLog('SYSTEM', '客户端日志收集已启动');
    }
    
    /**
     * 启动所有日志收集（只收集，不启动进程）
     */
    startAllLoggers() {
        console.log('启动增强版开发环境日志收集器...');
        console.log('注意：此脚本只负责日志收集，进程启动由 dev.sh 负责');
        
        // 启动各个服务的日志收集
        this.startAIEngineLogger();
        this.startServerLogger();
        this.startClientLogger();
        
        console.log('所有日志收集器已启动');
        console.log(`日志文件: ${this.logFile}`);
        console.log('WebSocket服务器: ws://localhost:8889');
        console.log('按 Ctrl+C 停止日志收集器');
    }
    
    /**
     * 停止所有进程
     */
    stopAllProcesses() {
        for (const [name, process] of this.processes) {
            try {
                this.writeLog('SYSTEM', `正在停止 ${name}...`);
                process.kill('SIGTERM');
                
                // 等待进程优雅退出
                setTimeout(() => {
                    if (!process.killed) {
                        process.kill('SIGKILL');
                    }
                }, 5000);
            } catch (error) {
                this.writeLog('SYSTEM-ERROR', `停止 ${name} 时出错: ${error.message}`);
            }
        }
    }
    
    /**
     * 获取日志统计信息
     */
    getLogStats() {
        return {
            currentLines: this.currentLines,
            maxLines: this.maxLines,
            logFile: this.logFile,
            activeProcesses: this.processes.size,
            browserClients: this.browserClients.size
        };
    }
}

// 主函数
function main() {
    const logger = new EnhancedDevLogger();
    
    // 启动所有日志收集
    logger.startAllLoggers();
    
    // 定期输出统计信息
    setInterval(() => {
        const stats = logger.getLogStats();
        console.log(`\r日志统计: ${stats.currentLines.toLocaleString()}/${stats.maxLines.toLocaleString()} 行 | 活跃进程: ${stats.activeProcesses} | 浏览器客户端: ${stats.browserClients} | 文件: ${path.basename(stats.logFile)}`, '');
    }, 30000); // 每30秒更新一次
}

// 脚本入口
if (require.main === module) {
    main();
}

module.exports = EnhancedDevLogger;
