const { app, BrowserWindow, Tray, Menu, ipcMain, dialog, shell, nativeImage } = require('electron');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const Store = require('electron-store');
const logger = require('./utils/logger');
const AgentService = require('./services/AgentService');
const SystemMonitor = require('./services/SystemMonitor');
const NetworkMonitor = require('./services/NetworkMonitor');
const SecurityService = require('./services/SecurityService');
const FirewallService = require('./services/FirewallService');
const EventService = require('./services/EventService');

// 配置存储
const store = new Store();

// 全局变量
let mainWindow = null;
let tray = null;
let agentService = null;
let systemMonitor = null;
let networkMonitor = null;
let securityService = null;
let firewallService = null;
let eventService = null;
let settingsWindow = null; // 新增：设置窗口

// 应用程序是否已准备就绪
let appReady = false;
// 应用退出状态标志
let isQuitting = false;

// 开发模式检测
const isDev = process.env.ELECTRON_IS_DEV === '1';

// 单例应用程序
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', () => {
        // 当运行第二个实例时，聚焦到主窗口
        showMainWindow();
    });
}

// 创建主窗口
function createMainWindow() {
    mainWindow = new BrowserWindow({
        width: 900,
        height: 700,
        minWidth: 700,
        minHeight: 500,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
            preload: path.join(__dirname, 'preload.js')
        },
        icon: process.platform === 'darwin' 
            ? path.join(__dirname, '../assets/icon.icns') 
            : path.join(__dirname, '../assets/icon.png'),
        show: false,
        titleBarStyle: 'hiddenInset',
        frame: true
    });

    // 加载应用界面
    if (isDev) {
        // 在开发模式下，直接加载构建的HTML文件
        mainWindow.loadFile(path.join(__dirname, '../build/index.html'));
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, '../build/index.html'));
    }

    // 窗口事件处理
    mainWindow.once('ready-to-show', () => {
        console.log('主窗口准备显示');
        logger.info('主窗口准备显示');
        
        if (!store.get('minimizeToTray', false)) {
            mainWindow.show();
        }
        
        // 初始化服务
        initializeServices();
    });

    mainWindow.on('close', (event) => {
        console.log('主窗口关闭事件触发');
        logger.info('主窗口关闭事件触发');
        
        if (isQuitting) {
            console.log('应用正在退出，允许窗口关闭');
            logger.info('应用正在退出，允许窗口关闭');
            return; // 允许窗口关闭
        }
        
        if (store.get('minimizeToTray', true)) {
            console.log('阻止窗口关闭，隐藏窗口');
            logger.info('阻止窗口关闭，隐藏窗口');
            event.preventDefault();
            mainWindow.hide();
        } else {
            console.log('设置允许退出，退出应用');
            logger.info('设置允许退出，退出应用');
            isQuitting = true;
            app.quit();
        }
    });

    mainWindow.on('closed', () => {
        console.log('主窗口已关闭');
        logger.info('主窗口已关闭');
        mainWindow = null;
    });

    // 阻止新窗口打开
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });


}

// 创建设置窗口
function createSettingsWindow() {
    if (settingsWindow) {
        settingsWindow.focus();
        return;
    }

    settingsWindow = new BrowserWindow({
        width: 800,
        height: 600,
        minWidth: 600,
        minHeight: 400,
        parent: mainWindow,
        modal: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
            preload: path.join(__dirname, 'preload.js')
        },
        icon: path.join(__dirname, '../assets/icon.png'),
        titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default'
    });

    // 加载设置界面
    if (isDev) {
        settingsWindow.loadURL('http://localhost:3000/settings');
    } else {
        settingsWindow.loadFile(path.join(__dirname, '../build/settings.html'));
    }

    settingsWindow.on('closed', () => {
        settingsWindow = null;
    });
}

// 显示主窗口的通用函数
function showMainWindow() {
    console.log('showMainWindow被调用');
    logger.info('showMainWindow被调用');
    
    if (!mainWindow) {
        console.log('主窗口不存在，创建新窗口');
        logger.info('主窗口不存在，创建新窗口');
        createMainWindow();
        return;
    }

    try {
        if (mainWindow.isMinimized()) {
            console.log('窗口已最小化，恢复窗口');
            logger.info('窗口已最小化，恢复窗口');
            mainWindow.restore();
        }
        
        if (!mainWindow.isVisible()) {
            console.log('窗口不可见，显示窗口');
            logger.info('窗口不可见，显示窗口');
            mainWindow.show();
        }
        
        console.log('聚焦窗口');
        logger.info('聚焦窗口');
        mainWindow.focus();
        
        // 确保窗口内容已加载
        if (mainWindow.webContents.isLoading()) {
            console.log('窗口内容正在加载，等待完成');
            logger.info('窗口内容正在加载，等待完成');
            mainWindow.webContents.once('did-finish-load', () => {
                console.log('窗口内容加载完成');
                logger.info('窗口内容加载完成');
            });
        } else {
            console.log('窗口内容已加载完成');
            logger.info('窗口内容已加载完成');
        }
        
    } catch (error) {
        console.error('显示主窗口时出错:', error);
        logger.error('显示主窗口时出错:', error);
        
        // 如果出错，尝试重新创建窗口
        console.log('尝试重新创建主窗口');
        logger.info('尝试重新创建主窗口');
        mainWindow = null;
        createMainWindow();
    }
}

// 创建系统托盘
function createTray() {
    try {
        console.log('=== 开始创建菜单栏图标 ===');
        logger.info('=== 开始创建菜单栏图标 ===');
        
        // 根据操作系统选择合适的图标
        let iconPath;
        if (process.platform === 'darwin') {
            // macOS 使用专用的菜单栏图标以获得最佳显示效果
            iconPath = path.join(__dirname, '../assets/macos-tray-icon.png');
        } else {
            // 其他平台使用标准图标
            iconPath = path.join(__dirname, '../assets/tray-icon.png');
        }
        
        // 创建图标
        const icon = nativeImage.createFromPath(iconPath);
        
        // 确保图标大小适合托盘显示
        if (process.platform === 'darwin') {
            // macOS 托盘图标推荐大小为 16x16 或 32x32
            icon.setTemplateImage(false); // 确保图标不会被系统模板化
        }
        
        console.log('图标创建成功');
        logger.info('图标创建成功');
        
        // 创建托盘
        tray = new Tray(icon);
        
        if (!tray) {
            throw new Error('托盘对象创建失败');
        }
        
        console.log('托盘对象创建成功');
        logger.info('托盘对象创建成功');
        
        // 创建菜单
        const contextMenu = Menu.buildFromTemplate([
            {
                label: '显示主窗口',
                click: () => {
                    console.log('菜单：显示主窗口被点击');
                    logger.info('菜单：显示主窗口被点击');
                    showMainWindow();
                }
            },
            {
                label: '设置',
                click: () => {
                    console.log('菜单：设置被点击');
                    logger.info('菜单：设置被点击');
                    createSettingsWindow();
                }
            },
            { type: 'separator' },
            {
                label: '退出',
                click: () => {
                    console.log('菜单：退出被点击');
                    logger.info('菜单：退出被点击');
                    isQuitting = true;
                    
                    // 强制退出应用
                    try {
                        // 先尝试正常退出
                        app.quit();
                        
                        // 如果3秒后还没有退出，强制退出
                        setTimeout(() => {
                            console.log('强制退出应用');
                            logger.info('强制退出应用');
                            process.exit(0);
                        }, 3000);
                    } catch (error) {
                        console.error('退出应用时出错:', error);
                        logger.error('退出应用时出错:', error);
                        process.exit(0);
                    }
                }
            }
        ]);
        
        // 设置菜单和工具提示
        tray.setContextMenu(contextMenu);
        tray.setToolTip('TianWang Agent');
        
        // 设置双击事件
        tray.on('double-click', () => {
            console.log('托盘被双击');
            logger.info('托盘被双击');
            showMainWindow();
        });
        
        console.log('托盘设置完成');
        logger.info('托盘设置完成');
        
    } catch (error) {
        console.error('创建托盘失败:', error);
        logger.error('创建托盘失败:', error);
        tray = null;
    }
}

// 更新托盘菜单状态 - 简化版本
function updateTrayMenu() {
    // 暂时禁用复杂的菜单更新逻辑
    console.log('菜单更新功能暂时禁用');
    logger.info('菜单更新功能暂时禁用');
}

// 初始化服务
async function initializeServices() {
    try {
        logger.info('初始化代理服务...');

        // 初始化代理服务（使用try-catch避免循环引用错误）
        try {
            agentService = new AgentService();
            
            // 从持久化存储中恢复注册码
            const savedRegistrationCode = store.get('registrationCode');
            if (savedRegistrationCode) {
                agentService.setRegistrationCode(savedRegistrationCode);
                logger.info('从存储中恢复注册码:', savedRegistrationCode.substring(0, 8) + '...');
            }
            
            await agentService.initialize();
        } catch (agentError) {
            logger.error('代理服务初始化失败:', agentError.message);
            // 继续初始化其他服务，不中断整个流程
        }

        // 初始化系统监控
        systemMonitor = new SystemMonitor();
        systemMonitor.on('data', (data) => {
            if (agentService) {
                agentService.sendData('system', data);
            }
            if (mainWindow) {
                mainWindow.webContents.send('system-data', data);
            }
        });

        // 初始化网络监控
        networkMonitor = new NetworkMonitor();
        networkMonitor.on('data', (data) => {
            if (agentService) {
                agentService.sendData('network', data);
            }
            if (mainWindow) {
                mainWindow.webContents.send('network-data', data);
            }
        });

        // 初始化安全服务
        securityService = new SecurityService();
        securityService.on('threat', (threat) => {
            logger.warn('检测到安全威胁:', threat);
            if (mainWindow) {
                mainWindow.webContents.send('security-threat', threat);
            }
            
            // 自动阻止威胁IP（如果启用了防火墙服务）
            if (firewallService && threat.source && firewallService.config.autoBlock) {
                firewallService.blockIP(threat.source, `Auto-block: ${threat.description}`)
                    .then(() => {
                        logger.info(`自动阻止威胁IP: ${threat.source}`);
                    })
                    .catch(error => {
                        logger.error(`自动阻止IP失败: ${error.message}`);
                    });
            }
            
            // 显示系统通知
            if (Notification.isSupported()) {
                new Notification({
                    title: 'TianWang 安全警报',
                    body: `检测到威胁: ${threat.type}`,
                    icon: path.join(__dirname, '../assets/warning-icon.png')
                }).show();
            }
        });

        // 初始化防火墙服务
        firewallService = new FirewallService();
        await firewallService.initialize({
            autoBlock: false, // 默认关闭自动阻止
            blockDuration: 3600000, // 1小时
            whitelistIPs: ['127.0.0.1', '::1', '192.168.1.1', '10.0.0.1']
        });

        // 初始化事件服务
        eventService = new EventService();
        
        // 设置全局事件服务，供其他服务使用
        global.eventService = eventService;
        
        // 监听事件服务的事件
        eventService.on('event-recorded', (event) => {
            if (mainWindow) {
                mainWindow.webContents.send('event-recorded', event);
            }
        });
        
        eventService.on('event-updated', (event) => {
            if (mainWindow) {
                mainWindow.webContents.send('event-updated', event);
            }
        });

        // 监听防火墙事件
        firewallService.on('ip-blocked', (data) => {
            logger.info(`IP已被阻止: ${data.ip}, 原因: ${data.reason}`);
            if (mainWindow) {
                mainWindow.webContents.send('ip-blocked', data);
            }
        });

        firewallService.on('ip-unblocked', (data) => {
            logger.info(`IP阻止已解除: ${data.ip}, 原因: ${data.reason}`);
            if (mainWindow) {
                mainWindow.webContents.send('ip-unblocked', data);
            }
        });

        // 尝试连接到服务器（可选，不阻塞启动）
        if (agentService) {
            try {
                await agentService.connect();
            } catch (connectError) {
                logger.warn('服务器连接失败，将在后台重试:', connectError.message);
            }
            
            // 监听连接相关事件
            agentService.on('connected', () => {
                logger.info('代理已连接到服务器');
                updateTrayMenu();
            });
            
            agentService.on('disconnected', (data) => {
                logger.warn('代理与服务器断开连接:', data);
                updateTrayMenu();
            });
            
            agentService.on('error', (error) => {
                logger.error('代理连接错误:', error.message);
                // 不显示错误对话框，避免干扰用户
            });
            
            agentService.on('connection-refused', () => {
                logger.error('服务器连接被拒绝，请检查服务器是否启动');
                // 可以在这里显示系统通知
                if (Notification.isSupported()) {
                    new Notification({
                        title: 'TianWang 连接错误',
                        body: '无法连接到服务器，请检查服务器状态',
                        icon: path.join(__dirname, '../assets/warning-icon.png')
                    }).show();
                }
            });
            
            agentService.on('max-reconnect-reached', () => {
                logger.error('达到最大重连次数，停止自动重连');
                // 可以在这里显示系统通知
                if (Notification.isSupported()) {
                    new Notification({
                        title: 'TianWang 连接失败',
                        body: '无法连接到服务器，请检查网络和服务器状态',
                        icon: path.join(__dirname, '../assets/error-icon.png')
                    }).show();
                }
            });
        }

        // 更新托盘状态
        updateTrayMenu();

        logger.info('代理服务初始化完成');
    } catch (error) {
        logger.error('服务初始化失败:', error);
        dialog.showErrorBox('初始化错误', `服务初始化失败: ${error.message}`);
    }
}

// IPC 事件处理
ipcMain.handle('get-system-info', async () => {
    return {
        platform: os.platform(),
        arch: os.arch(),
        hostname: os.hostname(),
        version: app.getVersion()
    };
});

ipcMain.handle('get-config', async (event, key) => {
    return store.get(key);
});

ipcMain.handle('set-config', async (event, key, value) => {
    store.set(key, value);
    return true;
});

ipcMain.handle('start-monitoring', async () => {
    try {
        if (systemMonitor) await systemMonitor.start();
        if (networkMonitor) await networkMonitor.start();
        updateTrayMenu();
        return { success: true };
    } catch (error) {
        logger.error('启动监控失败:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('stop-monitoring', async () => {
    try {
        if (systemMonitor) await systemMonitor.stop();
        if (networkMonitor) await networkMonitor.stop();
        updateTrayMenu();
        return { success: true };
    } catch (error) {
        logger.error('停止监控失败:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('get-monitoring-status', async () => {
    try {
        return {
            system: systemMonitor?.isRunning() || false,
            network: networkMonitor?.isRunning() || false,
            connected: agentService?.getConnectionStatus ? agentService.getConnectionStatus() : false,
            firewall: firewallService?.isEnabled || false
        };
    } catch (error) {
        logger.error('获取监控状态失败:', error);
        return {
            system: false,
            network: false,
            connected: false,
            firewall: false
        };
    }
});

// 防火墙相关IPC处理
ipcMain.handle('firewall-block-ip', async (event, ip, reason) => {
    try {
        if (firewallService) {
            const result = await firewallService.blockIP(ip, reason);
            return { success: result };
        }
        return { success: false, error: '防火墙服务未初始化' };
    } catch (error) {
        logger.error('阻止IP失败:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('firewall-unblock-ip', async (event, ip, reason) => {
    try {
        if (firewallService) {
            const result = await firewallService.unblockIP(ip, reason);
            return { success: result };
        }
        return { success: false, error: '防火墙服务未初始化' };
    } catch (error) {
        logger.error('解除IP阻止失败:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('firewall-get-blocked-ips', async () => {
    try {
        if (firewallService) {
            return { success: true, data: firewallService.getBlockedIPs() };
        }
        return { success: false, error: '防火墙服务未初始化' };
    } catch (error) {
        logger.error('获取阻止IP列表失败:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('firewall-get-statistics', async () => {
    try {
        if (firewallService) {
            return { success: true, data: firewallService.getStatistics() };
        }
        return { success: false, error: '防火墙服务未初始化' };
    } catch (error) {
        logger.error('获取防火墙统计失败:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('firewall-enable-auto-block', async () => {
    try {
        if (firewallService) {
            firewallService.enableAutoBlock();
            return { success: true };
        }
        return { success: false, error: '防火墙服务未初始化' };
    } catch (error) {
        logger.error('启用自动阻止失败:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('firewall-disable-auto-block', async () => {
    try {
        if (firewallService) {
            firewallService.disableAutoBlock();
            return { success: true };
        }
        return { success: false, error: '防火墙服务未初始化' };
    } catch (error) {
        logger.error('禁用自动阻止失败:', error);
        return { success: false, error: error.message };
    }
});

// 设置相关IPC处理
ipcMain.handle('get-settings', async () => {
    try {
        return {
            registrationCode: store.get('registrationCode', ''),
            monitorInterval: store.get('monitorInterval', 30),
            autoStart: store.get('autoStart', false),
            minimizeToTray: store.get('minimizeToTray', true),
            autoBlock: store.get('autoBlock', false)
        };
    } catch (error) {
        logger.error('获取设置失败:', error);
        return null;
    }
});

ipcMain.handle('save-settings', async (event, settings) => {
    try {
        store.set('monitorInterval', settings.monitorInterval);
        store.set('autoStart', settings.autoStart);
        store.set('minimizeToTray', settings.minimizeToTray);
        store.set('autoBlock', settings.autoBlock);
        store.set('registrationCode', settings.registrationCode);
        
        // 如果启用了自动阻止，更新防火墙服务配置
        if (firewallService) {
            firewallService.config.autoBlock = settings.autoBlock;
        }
        
        return { success: true };
    } catch (error) {
        logger.error('保存设置失败:', error);
        return { success: false, error: error.message };
    }
});

// 服务器配置相关IPC处理
ipcMain.handle('get-server-config', async () => {
    try {
        if (agentService) {
            return agentService.getServerConfig();
        }
        return {
            serverUrl: store.get('serverUrl', 'ws://localhost:5555'),
            apiUrl: store.get('apiUrl', 'http://localhost:5555/api'),
            reconnectInterval: store.get('reconnectInterval', 5000),
            maxReconnectAttempts: store.get('maxReconnectAttempts', 10),
            heartbeatInterval: store.get('heartbeatInterval', 30000)
        };
    } catch (error) {
        logger.error('获取服务器配置失败:', error);
        return null;
    }
});

ipcMain.handle('update-server-config', async (event, serverConfig) => {
    try {
        if (agentService) {
            const result = agentService.updateServerConfig(serverConfig);
            return { success: true, message: '服务器配置已更新' };
        }
        return { success: false, error: '代理服务未初始化' };
    } catch (error) {
        logger.error('更新服务器配置失败:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('test-server-connection', async () => {
    try {
        if (agentService) {
            const result = await agentService.testServerConnection();
            return result;
        }
        return { success: false, error: '代理服务未初始化' };
    } catch (error) {
        logger.error('测试服务器连接失败:', error);
        return { success: false, error: error.message };
    }
});

// 打开设置窗口
ipcMain.handle('open-settings-window', async () => {
    try {
        createSettingsWindow();
        return { success: true };
    } catch (error) {
        logger.error('打开设置窗口失败:', error);
        return { success: false, error: error.message };
    }
});

// 注册码相关IPC处理
ipcMain.handle('set-registration-code', async (event, code) => {
    try {
        if (agentService) {
            agentService.setRegistrationCode(code);
            store.set('registrationCode', code);
            logger.info('注册码已设置:', code ? code.substring(0, 8) + '...' : 'null');
            return { success: true };
        }
        return { success: false, error: '代理服务未初始化' };
    } catch (error) {
        logger.error('设置注册码失败:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('get-registration-code', async () => {
    try {
        // 优先从AgentService获取，如果为空则从store获取
        if (agentService) {
            const code = agentService.getRegistrationCode();
            if (code) {
                return code;
            }
        }
        return store.get('registrationCode', '');
    } catch (error) {
        logger.error('获取注册码失败:', error);
        return '';
    }
});

ipcMain.handle('get-connection-info', async () => {
    try {
        if (agentService) {
            return agentService.getConnectionInfo();
        }
        return {
            agentId: 'unknown',
            isConnected: false,
            hasAuthToken: false,
            hasRegistrationCode: !!store.get('registrationCode'),
            hasDeviceFingerprint: false,
            hasConnectionKey: false
        };
    } catch (error) {
        logger.error('获取连接信息失败:', error);
        return {
            agentId: 'error',
            isConnected: false,
            hasAuthToken: false,
            hasRegistrationCode: false,
            hasDeviceFingerprint: false,
            hasConnectionKey: false
        };
    }
});

// 事件管理相关IPC处理
ipcMain.handle('get-events', async (event, filters = {}) => {
    try {
        if (eventService) {
            return { success: true, data: eventService.getEvents(filters) };
        }
        return { success: false, error: '事件服务未初始化' };
    } catch (error) {
        logger.error('获取事件列表失败:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('get-event-stats', async () => {
    try {
        if (eventService) {
            return { success: true, data: eventService.getEventStats() };
        }
        return { success: false, error: '事件服务未初始化' };
    } catch (error) {
        logger.error('获取事件统计失败:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('update-event-status', async (event, eventId, status, feedback) => {
    try {
        if (eventService) {
            const result = eventService.updateEventStatus(eventId, status, feedback);
            return { success: !!result, data: result };
        }
        return { success: false, error: '事件服务未初始化' };
    } catch (error) {
        logger.error('更新事件状态失败:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('mark-event-feedback', async (event, eventId, feedback) => {
    try {
        if (eventService) {
            const result = eventService.markEventFeedback(eventId, feedback);
            return { success: !!result, data: result };
        }
        return { success: false, error: '事件服务未初始化' };
    } catch (error) {
        logger.error('标记事件反馈失败:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('clear-old-events', async (event, days = 30) => {
    try {
        if (eventService) {
            const removedCount = eventService.clearOldEvents(days);
            return { success: true, data: { removedCount } };
        }
        return { success: false, error: '事件服务未初始化' };
    } catch (error) {
        logger.error('清除旧事件失败:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('export-events', async (event, format = 'json') => {
    try {
        if (eventService) {
            const data = eventService.exportEvents(format);
            return { success: true, data };
        }
        return { success: false, error: '事件服务未初始化' };
    } catch (error) {
        logger.error('导出事件失败:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('get-event-filters', async () => {
    try {
        if (eventService) {
            return {
                success: true,
                data: {
                    types: eventService.getEventTypes(),
                    levels: eventService.getEventLevels(),
                    statuses: eventService.getEventStatuses()
                }
            };
        }
        return { success: false, error: '事件服务未初始化' };
    } catch (error) {
        logger.error('获取事件过滤器失败:', error);
        return { success: false, error: error.message };
    }
});

// 应用程序事件
app.whenReady().then(() => {
    console.log('=== 应用启动事件 ===');
    logger.info('=== 应用启动事件 ===');
    console.log('创建主窗口...');
    logger.info('创建主窗口...');
    createMainWindow();
    console.log('创建菜单栏图标...');
    logger.info('创建菜单栏图标...');
    createTray();
    console.log('设置应用就绪状态...');
    logger.info('设置应用就绪状态...');
    appReady = true;
    console.log('应用启动完成');
    logger.info('应用启动完成');
    
    // 在macOS上，确保菜单栏图标可见
    if (process.platform === 'darwin') {
        console.log('macOS平台：应用已启动');
        logger.info('macOS平台：应用已启动');
        
        // 简单的延迟检查
        setTimeout(() => {
            if (tray) {
                console.log('托盘对象存在，应用应该正常运行');
                logger.info('托盘对象存在，应用应该正常运行');
            } else {
                console.warn('托盘对象不存在');
                logger.warn('托盘对象不存在');
            }
        }, 2000);
    }
});

app.on('window-all-closed', () => {
    console.log('所有窗口已关闭');
    logger.info('所有窗口已关闭');
    
    // 在 macOS 上，保持应用程序运行，除非用户明确退出
    if (process.platform !== 'darwin') {
        console.log('非macOS平台，退出应用');
        logger.info('非macOS平台，退出应用');
        app.quit();
    } else {
        console.log('macOS平台，保持应用运行');
        logger.info('macOS平台，保持应用运行');
    }
});

app.on('activate', () => {
    console.log('应用被激活');
    logger.info('应用被激活');
    
    // 在macOS上，当点击dock图标时重新创建窗口
    if (BrowserWindow.getAllWindows().length === 0) {
        console.log('没有窗口，重新创建主窗口');
        logger.info('没有窗口，重新创建主窗口');
        createMainWindow();
    } else {
        console.log('已有窗口，显示主窗口');
        logger.info('已有窗口，显示主窗口');
        showMainWindow();
    }
});

app.on('before-quit', () => {
    console.log('应用即将退出');
    logger.info('应用即将退出');
    isQuitting = true;
    
    // 清理资源
    try {
        if (systemMonitor) {
            systemMonitor.stop();
        }
        if (networkMonitor) {
            networkMonitor.stop();
        }
        if (agentService) {
            agentService.disconnect();
        }
    } catch (error) {
        logger.warn('清理资源时出错:', error.message);
    }
});

// 处理未捕获的异常
process.on('uncaughtException', (error) => {
    // 忽略EPIPE错误，这通常是无害的
    if (error.code === 'EPIPE' || error.message.includes('EPIPE')) {
        logger.warn('忽略EPIPE错误（管道已关闭）:', error.message);
        return;
    }
    
    // 忽略WebSocket相关的连接错误
    if (error.code === 'ECONNREFUSED' || 
        error.code === 'ENOTFOUND' || 
        error.code === 'ETIMEDOUT' ||
        error.message.includes('ECONNREFUSED') ||
        error.message.includes('ENOTFOUND') ||
        error.message.includes('ETIMEDOUT')) {
        logger.warn('忽略网络连接错误:', error.message);
        return;
    }
    
    // 忽略WebSocket连接关闭错误
    if (error.message.includes('WebSocket is not open') ||
        error.message.includes('WebSocket connection is closed')) {
        logger.warn('忽略WebSocket连接状态错误:', error.message);
        return;
    }
    
    logger.error('未捕获的异常:', error);
    
    // 只在主进程存在且未退出时才显示错误对话框
    if (app && !isQuitting) {
        try {
            // 对于严重的错误才显示对话框
            if (error.message.includes('ENOMEM') || 
                error.message.includes('EACCES') ||
                error.message.includes('EADDRINUSE')) {
                dialog.showErrorBox('应用程序错误', `发生严重错误: ${error.message}`);
            }
        } catch (dialogError) {
            logger.error('显示错误对话框失败:', dialogError);
        }
    }
});

process.on('unhandledRejection', (reason, promise) => {
    // 忽略EPIPE相关的Promise拒绝
    if (reason && (reason.code === 'EPIPE' || reason.message?.includes('EPIPE'))) {
        logger.warn('忽略EPIPE Promise拒绝:', reason.message);
        return;
    }
    
    // 忽略网络连接相关的Promise拒绝
    if (reason && (reason.code === 'ECONNREFUSED' || 
                   reason.code === 'ENOTFOUND' || 
                   reason.code === 'ETIMEDOUT' ||
                   reason.message?.includes('ECONNREFUSED') ||
                   reason.message?.includes('ENOTFOUND') ||
                   reason.message?.includes('ETIMEDOUT'))) {
        logger.warn('忽略网络连接Promise拒绝:', reason.message);
        return;
    }
    
    // 忽略WebSocket相关的Promise拒绝
    if (reason && (reason.message?.includes('WebSocket is not open') ||
                   reason.message?.includes('WebSocket connection is closed'))) {
        logger.warn('忽略WebSocket连接Promise拒绝:', reason.message);
        return;
    }
    
    logger.error('未处理的Promise拒绝:', reason);
}); 