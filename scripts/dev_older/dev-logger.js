#!/usr/bin/env node

/**
 * 天网安全监控系统 - 开发环境日志收集器
 * TianWang Security System - Development Environment Log Collector
 * 
 * 功能：
 * - 流式收集客户端、AI引擎、服务端的所有console日志
 * - 限制最大100000行，超出自动覆盖
 * - 随系统启动和关闭
 * - 每次启动时清理并生成新文件
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const readline = require('readline');

class DevLogger {
    constructor() {
        this.logDir = path.join(__dirname, '..', 'logs', 'dev');
        this.logFile = path.join(this.logDir, 'dev-console.log');
        this.maxLines = 100000;
        this.currentLines = 0;
        this.writeStream = null;
        this.processes = new Map();
        this.isShuttingDown = false;
        
        // 确保日志目录存在
        this.ensureLogDirectory();
        
        // 清理并初始化日志文件
        this.initializeLogFile();
        
        // 设置进程退出处理
        this.setupProcessHandlers();
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
        this.writeLog('SYSTEM', `=== 开发环境日志收集器启动 ${startTime} ===`);
        this.writeLog('SYSTEM', `日志文件: ${this.logFile}`);
        this.writeLog('SYSTEM', `最大行数限制: ${this.maxLines.toLocaleString()}`);
        this.writeLog('SYSTEM', '');
    }
    
    /**
     * 设置进程退出处理
     */
    setupProcessHandlers() {
        const cleanup = () => {
            if (this.isShuttingDown) return;
            this.isShuttingDown = true;
            
            console.log('\n正在关闭日志收集器...');
            this.writeLog('SYSTEM', '=== 开发环境日志收集器关闭 ===');
            
            // 停止所有监控的进程
            this.stopAllProcesses();
            
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
        
        // 收集stderr
        aiProcess.stderr.on('data', (data) => {
            const lines = data.toString().split('\n').filter(line => line.trim());
            lines.forEach(line => {
                this.writeLog('AI-ENGINE-ERROR', line);
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
                this.writeLog('SERVER', line);
            });
        });
        
        // 收集stderr
        serverProcess.stderr.on('data', (data) => {
            const lines = data.toString().split('\n').filter(line => line.trim());
            lines.forEach(line => {
                this.writeLog('SERVER-ERROR', line);
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
                this.writeLog('CLIENT', line);
            });
        });
        
        // 收集stderr
        clientProcess.stderr.on('data', (data) => {
            const lines = data.toString().split('\n').filter(line => line.trim());
            lines.forEach(line => {
                this.writeLog('CLIENT-ERROR', line);
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
        console.log('启动开发环境日志收集器...');
        
        // 启动各个服务的日志收集
        this.startAIEngineLogger();
        this.startServerLogger();
        this.startClientLogger();
        
        console.log('所有日志收集器已启动');
        console.log(`日志文件: ${this.logFile}`);
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
            activeProcesses: this.processes.size
        };
    }
}

// 主函数
function main() {
    const logger = new DevLogger();
    
    // 启动所有日志收集
    logger.startAllLoggers();
    
    // 定期输出统计信息
    setInterval(() => {
        const stats = logger.getLogStats();
        console.log(`\r日志统计: ${stats.currentLines.toLocaleString()}/${stats.maxLines.toLocaleString()} 行 | 活跃进程: ${stats.activeProcesses} | 文件: ${path.basename(stats.logFile)}`, '');
    }, 30000); // 每30秒更新一次
}

// 脚本入口
if (require.main === module) {
    main();
}

module.exports = DevLogger;
