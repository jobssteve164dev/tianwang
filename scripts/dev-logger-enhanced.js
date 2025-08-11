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
        const port = 8889;
        
        this.wsServer = new WebSocket.Server({ port });
        
        this.wsServer.on('connection', (ws, req) => {
            const clientId = req.headers['x-client-id'] || 'unknown';
            this.browserClients.add(ws);
            
            this.writeLog('SYSTEM', `浏览器客户端连接: ${clientId}`);
            
            ws.on('message', (message) => {
                try {
                    const data = JSON.parse(message.toString());
                    this.writeLog('BROWSER', `${data.level || 'INFO'}: ${data.message}`);
                    
                    if (data.stack) {
                        this.writeLog('BROWSER-STACK', data.stack);
                    }
                } catch (error) {
                    this.writeLog('BROWSER-RAW', message.toString());
                }
            });
            
            ws.on('close', () => {
                this.browserClients.delete(ws);
                this.writeLog('SYSTEM', `浏览器客户端断开连接: ${clientId}`);
            });
            
            ws.on('error', (error) => {
                this.writeLog('SYSTEM-ERROR', `WebSocket错误: ${error.message}`);
            });
        });
        
        this.wsServer.on('error', (error) => {
            this.writeLog('SYSTEM-ERROR', `WebSocket服务器错误: ${error.message}`);
        });
        
        this.writeLog('SYSTEM', `WebSocket服务器已启动 (端口: ${port})`);
    }
    
    /**
     * 写入日志到文件
     */
    writeLog(service, message) {
        if (!this.writeStream) return;
        
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] [${service}] ${message}\n`;
        
        this.writeStream.write(logEntry);
        this.currentLines++;
        
        // 检查是否需要滚动日志
        if (this.currentLines > this.maxLines) {
            this.rolloverLog();
        }
    }

    /**
     * 写入日志到文件，不添加额外时间戳
     */
    writeLogWithoutTimestamp(service, message) {
        if (!this.writeStream) return;

        const logEntry = `[${service}] ${message}\n`;
        this.writeStream.write(logEntry);
        this.currentLines++;

        // 检查是否需要滚动日志
        if (this.currentLines > this.maxLines) {
            this.rolloverLog();
        }
    }
    
    /**
     * 滚动日志文件
     */
    rolloverLog() {
        console.log(`日志行数达到限制 (${this.maxLines.toLocaleString()})，开始滚动...`);
        
        // 关闭当前流
        this.writeStream.end();
        
        // 检查原文件是否存在，如果存在则重命名
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
     * 启动AI引擎日志收集
     */
    startAIEngineLogger() {
        const aiEngineDir = path.join(__dirname, '..', 'server', 'ai-engine');
        const logFile = path.join(aiEngineDir, 'logs', 'ai_engine.log');
        
        // 确保AI引擎日志目录存在
        const logDir = path.dirname(logFile);
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
        
        // 检查AI引擎主文件是否存在
        const mainFile = path.join(aiEngineDir, 'src', 'main.py');
        if (!fs.existsSync(mainFile)) {
            this.writeLog('SYSTEM-ERROR', `AI引擎主文件不存在: ${mainFile}`);
            this.writeLog('SYSTEM', '跳过AI引擎启动');
            return;
        }
        
        // 启动AI引擎进程
        const aiProcess = spawn('python3', ['-m', 'src.main'], {
            cwd: aiEngineDir,
            stdio: ['pipe', 'pipe', 'pipe'],
            env: { ...process.env, PYTHONUNBUFFERED: '1' }
        });
        
        this.processes.set('ai-engine', aiProcess);
        
        // 收集stdout
        aiProcess.stdout.on('data', (data) => {
            const lines = data.toString().split('\n').filter(line => line.trim());
            lines.forEach(line => {
                this.writeLog('AI-ENGINE', line);
            });
        });
        
        // 收集stderr - 解析loguru格式的日志
        aiProcess.stderr.on('data', (data) => {
            const lines = data.toString().split('\n').filter(line => line.trim());
            lines.forEach(line => {
                // 1. 解析loguru格式的日志: "2025-08-11 07:36:13.869 | INFO     | src.services.ai_service:initialize:58 - AI服务初始化完成"
                // 注意：loguru格式中级别后面可能有多个空格
                const loguruPattern = /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}) \| (\w+)\s* \| (.+?)(?: - (.+))?$/;
                const loguruMatch = line.match(loguruPattern);
                
                if (loguruMatch) {
                    // 解析成功，提取各个部分
                    const [, timestamp, level, source, message] = loguruMatch;
                    
                    // 如果没有单独的消息部分，则整个source就是消息
                    const actualMessage = message || source;
                    const actualSource = message ? source : '';
                    
                    // 根据日志级别确定服务标签
                    let serviceTag = 'AI-ENGINE';
                    if (level === 'ERROR' || level === 'CRITICAL') {
                        serviceTag = 'AI-ENGINE-ERROR';
                    } else if (level === 'WARNING') {
                        serviceTag = 'AI-ENGINE-WARN';
                    } else if (level === 'DEBUG') {
                        serviceTag = 'AI-ENGINE-DEBUG';
                    }
                    
                    // 构建日志内容，不包含原始时间戳
                    let logContent = `${level}`;
                    if (actualSource) {
                        logContent += ` | ${actualSource}`;
                    }
                    if (actualMessage) {
                        logContent += ` | ${actualMessage}`;
                    }
                    
                    // 使用writeLog，让日志收集器添加统一的时间戳
                    this.writeLog(serviceTag, logContent);
                    return;
                }
                
                // 2. 解析uvicorn格式的日志: "INFO: Uvicorn running on http://0.0.0.0:8888 (Press CTRL+C to quit)"
                // 只匹配标准的日志级别
                const uvicornPattern = /^(INFO|ERROR|WARNING|DEBUG):\s*(.+)$/;
                const uvicornMatch = line.match(uvicornPattern);
                
                if (uvicornMatch) {
                    const [, level, message] = uvicornMatch;
                    let serviceTag = 'AI-ENGINE';
                    if (level === 'ERROR' || level === 'CRITICAL') {
                        serviceTag = 'AI-ENGINE-ERROR';
                    } else if (level === 'WARNING') {
                        serviceTag = 'AI-ENGINE-WARN';
                    } else if (level === 'DEBUG') {
                        serviceTag = 'AI-ENGINE-DEBUG';
                    }
                    
                    this.writeLog(serviceTag, `${level} | ${message}`);
                    return;
                }
                
                // 3. 解析Python warnings: "UserWarning: Field "model_name" has conflict with protected namespace "model_"."
                // 匹配以Warning结尾的类型
                const warningPattern = /^(\w+Warning):\s*(.+)$/;
                const warningMatch = line.match(warningPattern);
                
                if (warningMatch) {
                    const [, warningType, message] = warningMatch;
                    this.writeLog('AI-ENGINE-WARN', `WARNING | ${warningType} | ${message}`);
                    return;
                }
                
                // 4. 解析Python warnings的后续行: "You may be able to resolve this warning by setting `model_config['protected_namespaces'] = ()`."
                const warningLinePattern = /^(.+)$/;
                const warningLineMatch = line.match(warningLinePattern);
                
                if (warningLineMatch && (line.includes('warning') || line.includes('Warning') || line.includes('resolve'))) {
                    this.writeLog('AI-ENGINE-WARN', `WARNING | ${line}`);
                    return;
                }
                
                // 5. 解析Python warnings的堆栈行: "  warnings.warn("
                const stackPattern = /^\s+(.+)$/;
                const stackMatch = line.match(stackPattern);
                
                if (stackMatch && (line.includes('warnings.warn') || line.includes('warn('))) {
                    this.writeLog('AI-ENGINE-WARN', `WARNING | ${line.trim()}`);
                    return;
                }
                
                // 6. 无法解析的日志，按原样处理
                this.writeLog('AI-ENGINE-RAW', line);
            });
        });
        
        // 处理进程退出
        aiProcess.on('close', (code) => {
            this.writeLog('SYSTEM', `AI引擎进程退出，退出码: ${code}`);
            this.processes.delete('ai-engine');
        });
        
        this.writeLog('SYSTEM', 'AI引擎日志收集已启动');
    }
    
    /**
     * 启动服务端日志收集
     */
    startServerLogger() {
        const serverDir = path.join(__dirname, '..', 'server');
        
        // 启动服务端进程
        const serverProcess = spawn('npm', ['start'], {
            cwd: serverDir,
            stdio: ['pipe', 'pipe', 'pipe'],
            env: { ...process.env, NODE_ENV: 'development' }
        });
        
        this.processes.set('server', serverProcess);
        
        // 收集stdout
        serverProcess.stdout.on('data', (data) => {
            const lines = data.toString().split('\n').filter(line => line.trim());
            lines.forEach(line => {
                // 清理ANSI颜色代码
                const cleanLine = this.cleanAnsiCodes(line);
                
                // 解析服务器日志格式，清理重复时间戳
                const parsedLine = this.parseServerLog(cleanLine);
                this.writeLog('SERVER', parsedLine);
            });
        });
        
        // 收集stderr
        serverProcess.stderr.on('data', (data) => {
            const lines = data.toString().split('\n').filter(line => line.trim());
            lines.forEach(line => {
                // 清理ANSI颜色代码
                const cleanLine = this.cleanAnsiCodes(line);
                
                // 解析服务器日志格式，清理重复时间戳
                const parsedLine = this.parseServerLog(cleanLine);
                this.writeLog('SERVER-ERROR', parsedLine);
            });
        });
        
        // 处理进程退出
        serverProcess.on('close', (code) => {
            this.writeLog('SYSTEM', `服务端进程退出，退出码: ${code}`);
            this.processes.delete('server');
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
            // 注意：状态码304等特殊情况下，响应大小可能是"-"而不是数字
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
     * 启动客户端日志收集
     */
    startClientLogger() {
        const clientDir = path.join(__dirname, '..', 'client');
        
        // 启动客户端进程
        const clientProcess = spawn('npm', ['start'], {
            cwd: clientDir,
            stdio: ['pipe', 'pipe', 'pipe'],
            env: { ...process.env, PORT: '3333' }
        });
        
        this.processes.set('client', clientProcess);
        
        // 收集stdout
        clientProcess.stdout.on('data', (data) => {
            const lines = data.toString().split('\n').filter(line => line.trim());
            lines.forEach(line => {
                // 清理ANSI颜色代码
                const cleanLine = this.cleanAnsiCodes(line);
                this.writeLog('CLIENT', cleanLine);
            });
        });
        
        // 收集stderr
        clientProcess.stderr.on('data', (data) => {
            const lines = data.toString().split('\n').filter(line => line.trim());
            lines.forEach(line => {
                // 清理ANSI颜色代码
                const cleanLine = this.cleanAnsiCodes(line);
                this.writeLog('CLIENT-ERROR', cleanLine);
            });
        });
        
        // 处理进程退出
        clientProcess.on('close', (code) => {
            this.writeLog('SYSTEM', `客户端进程退出，退出码: ${code}`);
            this.processes.delete('client');
        });
        
        this.writeLog('SYSTEM', '客户端日志收集已启动');
    }
    
    /**
     * 启动所有日志收集
     */
    startAllLoggers() {
        console.log('启动增强版开发环境日志收集器...');
        
        // 启动各个服务的日志收集
        this.startAIEngineLogger();
        this.startServerLogger();
        this.startClientLogger();
        
        console.log('所有日志收集器已启动');
        console.log(`日志文件: ${this.logFile}`);
        console.log('WebSocket服务器: ws://localhost:8889');
        console.log('按 Ctrl+C 停止所有服务');
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
