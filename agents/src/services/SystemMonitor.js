const EventEmitter = require('events');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { spawn, exec } = require('child_process');
const si = require('systeminformation');
const logger = require('../utils/logger');

class SystemMonitor extends EventEmitter {
    constructor() {
        super();
        this.isRunning = false;
        this.intervalId = null;
        this.config = {
            interval: 30000, // 30秒
            collectSystemInfo: true,
            collectProcesses: true,
            collectLogs: true,
            collectPerformance: true,
            maxLogLines: 100
        };
        this.platform = os.platform();
        this.logWatchers = new Map();
    }

    // 开始监控
    async start() {
        if (this.isRunning) {
            logger.warn('系统监控已在运行');
            return;
        }

        logger.info('启动系统监控...');
        this.isRunning = true;

        // 立即收集一次数据
        await this.collectData();

        // 设置定期收集
        this.intervalId = setInterval(async () => {
            try {
                await this.collectData();
            } catch (error) {
                logger.error('数据收集失败:', error);
            }
        }, this.config.interval);

        // 启动日志监控
        if (this.config.collectLogs) {
            await this.startLogWatching();
        }

        logger.info('系统监控已启动');
    }

    // 停止监控
    async stop() {
        if (!this.isRunning) {
            logger.warn('系统监控未运行');
            return;
        }

        logger.info('停止系统监控...');
        this.isRunning = false;

        // 清除定时器
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }

        // 停止日志监控
        await this.stopLogWatching();

        logger.info('系统监控已停止');
    }

    // 收集系统数据
    async collectData() {
        const data = {
            timestamp: Date.now(),
            hostname: os.hostname(),
            platform: this.platform
        };

        try {
            // 收集基本系统信息
            if (this.config.collectSystemInfo) {
                data.system = await this.collectSystemInfo();
            }

            // 收集进程信息
            if (this.config.collectProcesses) {
                data.processes = await this.collectProcessInfo();
            }

            // 收集性能数据
            if (this.config.collectPerformance) {
                data.performance = await this.collectPerformanceData();
            }

            this.emit('data', data);
            logger.debug('系统数据收集完成');
        } catch (error) {
            logger.error('系统数据收集失败:', error);
        }
    }

    // 收集系统信息
    async collectSystemInfo() {
        try {
            const [cpu, mem, load, uptime] = await Promise.all([
                si.cpu(),
                si.mem(),
                si.currentLoad(),
                si.time()
            ]);

            return {
                cpu: {
                    manufacturer: cpu.manufacturer,
                    brand: cpu.brand,
                    cores: cpu.cores,
                    physicalCores: cpu.physicalCores,
                    speed: cpu.speed,
                    load: load.currentLoad,
                    loadUser: load.currentLoadUser,
                    loadSystem: load.currentLoadSystem
                },
                memory: {
                    total: mem.total,
                    free: mem.free,
                    used: mem.used,
                    available: mem.available,
                    usage: ((mem.used / mem.total) * 100).toFixed(2)
                },
                uptime: {
                    system: uptime.uptime,
                    process: process.uptime()
                }
            };
        } catch (error) {
            logger.error('收集系统信息失败:', error);
            return {};
        }
    }

    // 收集进程信息
    async collectProcessInfo() {
        try {
            const processes = await si.processes();
            
            // 只收集关键进程信息，避免数据量过大
            const filteredProcesses = processes.list
                .filter(proc => proc.cpu > 1 || proc.mem > 1) // CPU或内存使用率大于1%
                .sort((a, b) => b.cpu - a.cpu) // 按CPU使用率排序
                .slice(0, 20) // 只取前20个
                .map(proc => ({
                    pid: proc.pid,
                    name: proc.name,
                    command: proc.command,
                    cpu: proc.cpu,
                    mem: proc.mem,
                    memVsz: proc.memVsz,
                    memRss: proc.memRss,
                    nice: proc.nice,
                    started: proc.started,
                    state: proc.state,
                    user: proc.user
                }));

            return {
                total: processes.all,
                running: processes.running,
                blocked: processes.blocked,
                sleeping: processes.sleeping,
                unknown: processes.unknown,
                list: filteredProcesses
            };
        } catch (error) {
            logger.error('收集进程信息失败:', error);
            return {};
        }
    }

    // 收集性能数据
    async collectPerformanceData() {
        try {
            const [diskIO, networkStats, temp] = await Promise.all([
                si.disksIO(),
                si.networkStats(),
                si.cpuTemperature().catch(() => ({ main: -1 })) // 某些系统可能无法获取温度
            ]);

            return {
                disk: {
                    readSpeed: diskIO.rIO_sec || 0,
                    writeSpeed: diskIO.wIO_sec || 0,
                    readOps: diskIO.rIO || 0,
                    writeOps: diskIO.wIO || 0
                },
                network: networkStats.map(stat => ({
                    iface: stat.iface,
                    rxBytes: stat.rx_bytes,
                    txBytes: stat.tx_bytes,
                    rxSec: stat.rx_sec,
                    txSec: stat.tx_sec,
                    rxDropped: stat.rx_dropped,
                    txDropped: stat.tx_dropped,
                    rxErrors: stat.rx_errors,
                    txErrors: stat.tx_errors
                })),
                temperature: {
                    cpu: temp.main
                }
            };
        } catch (error) {
            logger.error('收集性能数据失败:', error);
            return {};
        }
    }

    // 启动日志监控
    async startLogWatching() {
        const logPaths = this.getSystemLogPaths();
        
        for (const logPath of logPaths) {
            if (fs.existsSync(logPath)) {
                try {
                    await this.watchLogFile(logPath);
                } catch (error) {
                    logger.error(`监控日志文件失败 ${logPath}:`, error);
                }
            }
        }
    }

    // 停止日志监控
    async stopLogWatching() {
        for (const [path, watcher] of this.logWatchers) {
            try {
                watcher.close();
                logger.debug(`停止监控日志文件: ${path}`);
            } catch (error) {
                logger.error(`停止日志监控失败 ${path}:`, error);
            }
        }
        this.logWatchers.clear();
    }

    // 获取系统日志路径
    getSystemLogPaths() {
        const paths = [];
        
        switch (this.platform) {
            case 'linux':
                paths.push(
                    '/var/log/syslog',
                    '/var/log/messages',
                    '/var/log/auth.log',
                    '/var/log/kern.log',
                    '/var/log/secure'
                );
                break;
                
            case 'darwin':
                paths.push(
                    '/var/log/system.log',
                    '/var/log/secure.log'
                );
                break;
                
            case 'win32':
                // Windows事件日志通过WMI或PowerShell获取
                break;
        }
        
        return paths.filter(path => fs.existsSync(path));
    }

    // 监控日志文件
    async watchLogFile(logPath) {
        try {
            const watcher = fs.watchFile(logPath, { interval: 1000 }, async (curr, prev) => {
                if (curr.mtime > prev.mtime) {
                    try {
                        const newLines = await this.readNewLogLines(logPath, prev.size, curr.size);
                        if (newLines.length > 0) {
                            this.emit('data', {
                                type: 'logs',
                                timestamp: Date.now(),
                                source: logPath,
                                lines: newLines
                            });
                        }
                    } catch (error) {
                        logger.error(`读取日志文件失败 ${logPath}:`, error);
                    }
                }
            });

            this.logWatchers.set(logPath, watcher);
            logger.debug(`开始监控日志文件: ${logPath}`);
        } catch (error) {
            logger.error(`启动日志监控失败 ${logPath}:`, error);
        }
    }

    // 读取新的日志行
    async readNewLogLines(logPath, oldSize, newSize) {
        return new Promise((resolve, reject) => {
            const stream = fs.createReadStream(logPath, {
                start: oldSize,
                end: newSize - 1
            });

            let data = '';
            stream.on('data', chunk => {
                data += chunk.toString();
            });

            stream.on('end', () => {
                const lines = data.split('\n')
                    .filter(line => line.trim().length > 0)
                    .slice(0, this.config.maxLogLines);
                resolve(lines);
            });

            stream.on('error', reject);
        });
    }

    // Windows事件日志收集
    async collectWindowsEventLogs() {
        if (this.platform !== 'win32') return [];

        return new Promise((resolve, reject) => {
            const powershellScript = `
                Get-WinEvent -FilterHashtable @{LogName='System','Application','Security'; Level=1,2,3} -MaxEvents 50 |
                Select-Object TimeCreated, Id, LevelDisplayName, LogName, ProviderName, Message |
                ConvertTo-Json
            `;

            exec(`powershell -Command "${powershellScript}"`, { timeout: 10000 }, (error, stdout, stderr) => {
                if (error) {
                    logger.error('Windows事件日志收集失败:', error);
                    resolve([]);
                    return;
                }

                try {
                    const events = JSON.parse(stdout);
                    resolve(Array.isArray(events) ? events : [events]);
                } catch (parseError) {
                    logger.error('解析Windows事件日志失败:', parseError);
                    resolve([]);
                }
            });
        });
    }

    // 获取运行状态
    isRunning() {
        return this.isRunning;
    }

    // 更新配置
    updateConfig(newConfig) {
        Object.assign(this.config, newConfig);
        logger.info('系统监控配置已更新:', newConfig);
        
        // 如果正在运行，重启以应用新配置
        if (this.isRunning) {
            this.stop().then(() => this.start());
        }
    }

    // 获取系统摘要
    async getSystemSummary() {
        try {
            const [system, processes, performance] = await Promise.all([
                this.collectSystemInfo(),
                this.collectProcessInfo(),
                this.collectPerformanceData()
            ]);

            return {
                timestamp: Date.now(),
                hostname: os.hostname(),
                platform: this.platform,
                system,
                processes: {
                    total: processes.total,
                    running: processes.running
                },
                performance: {
                    cpu: system.cpu?.load || 0,
                    memory: system.memory?.usage || 0,
                    temperature: performance.temperature?.cpu || -1
                }
            };
        } catch (error) {
            logger.error('获取系统摘要失败:', error);
            return null;
        }
    }
}

module.exports = SystemMonitor; 