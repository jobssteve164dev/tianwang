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
        width: 1200,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
            preload: path.join(__dirname, 'preload.js')
        },
        icon: path.join(__dirname, '../assets/icon.png'),
        show: false,
        titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default'
    });

    // 加载应用界面
    if (isDev) {
        mainWindow.loadURL('http://localhost:3000');
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, '../build/index.html'));
    }

    // 窗口事件处理
    mainWindow.once('ready-to-show', () => {
        if (!store.get('minimizeToTray', false)) {
            mainWindow.show();
        }
        
        // 初始化服务
        initializeServices();
    });

    mainWindow.on('close', (event) => {
        if (store.get('minimizeToTray', true)) {
            event.preventDefault();
            mainWindow.hide();
        } else {
            app.quit();
        }
    });

    mainWindow.on('closed', () => {
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
        settingsWindow.loadFile(path.join(__dirname, '../build/index.html'));
        // 发送消息到渲染进程，显示设置界面
        settingsWindow.webContents.on('did-finish-load', () => {
            settingsWindow.webContents.send('show-settings');
        });
    }

    settingsWindow.on('closed', () => {
        settingsWindow = null;
    });
}

// 显示主窗口的通用函数
function showMainWindow() {
    if (!mainWindow) {
        createMainWindow();
        return;
    }

    if (mainWindow.isMinimized()) {
        mainWindow.restore();
    }
    
    if (!mainWindow.isVisible()) {
        mainWindow.show();
    }
    
    mainWindow.focus();
}

// 创建系统托盘
function createTray() {
    try {
        // 创建一个简单的16x16像素的图标
        const icon = nativeImage.createFromDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAbwAAAG8B8aLcQwAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3Njape.org5vuPBoAAAB9SURBVDiNY2AYBYMRMDIyMjAyMjL8//+f4f///wwsDAwMDP///2f4//8/AwMDA8P///8ZGBgYGP7//8/AwMDA8P//f4b///8z/P//n+H///8M////Z/j//z8DAwMDw////xn+///P8P//f4b///8z/P//n+H///8M////Z/j//z8DAwMDw////xn+//8/AAAb8QABn5Qj5QAAAABJRU5ErkJggg==');
        
        tray = new Tray(icon);
        
        // 验证托盘对象是否创建成功
        if (!tray) {
            throw new Error('托盘对象创建失败');
        }
        
        logger.info('托盘图标创建成功');
    } catch (error) {
        logger.error('创建托盘图标失败:', error);
        tray = null;
        return; // 如果托盘创建完全失败，直接返回，不创建菜单
    }

    const contextMenu = Menu.buildFromTemplate([
        {
            label: '显示主窗口',
            click: () => {
                showMainWindow();
            }
        },
        {
            label: '系统状态',
            submenu: [
                {
                    label: '连接状态: 未连接',
                    enabled: false,
                    id: 'connection-status'
                },
                {
                    label: '监控状态: 停止',
                    enabled: false,
                    id: 'monitor-status'
                }
            ]
        },
        { type: 'separator' },
        {
            label: '开始监控',
            click: () => {
                if (systemMonitor) {
                    systemMonitor.start();
                }
                if (networkMonitor) {
                    networkMonitor.start();
                }
                updateTrayMenu();
            },
            id: 'start-monitor'
        },
        {
            label: '停止监控',
            click: () => {
                if (systemMonitor) {
                    systemMonitor.stop();
                }
                if (networkMonitor) {
                    networkMonitor.stop();
                }
                updateTrayMenu();
            },
            id: 'stop-monitor',
            enabled: false
        },
        { type: 'separator' },
        {
            label: '设置',
            click: () => {
                createSettingsWindow();
            }
        },
        {
            label: '关于',
            click: () => {
                dialog.showMessageBox(mainWindow, {
                    type: 'info',
                    title: '关于 TianWang Agent',
                    message: 'TianWang AI Security Monitoring System',
                    detail: `版本: ${app.getVersion()}\n平台: ${os.platform()}\n架构: ${os.arch()}`
                });
            }
        },
        { type: 'separator' },
        {
            label: '退出',
            click: () => {
                isQuitting = true;
                app.quit();
            }
        }
    ]);

    tray.setContextMenu(contextMenu);
    tray.setToolTip('TianWang Agent');

    tray.on('double-click', () => {
        showMainWindow();
    });
}

// 更新托盘菜单状态
function updateTrayMenu() {
    if (!tray || typeof tray.getContextMenu !== 'function') {
        logger.warn('托盘菜单更新失败：托盘对象不可用');
        return;
    }

    try {
        const menu = tray.getContextMenu();
        if (!menu) {
            logger.warn('托盘菜单更新失败：无法获取上下文菜单');
            return;
        }

        const connectionStatus = agentService?.isConnected() ? '已连接' : '未连接';
        const monitorStatus = (systemMonitor?.isRunning() || networkMonitor?.isRunning()) ? '运行中' : '停止';
        
        const connectionMenuItem = menu.getMenuItemById('connection-status');
        const monitorMenuItem = menu.getMenuItemById('monitor-status');
        const startMenuItem = menu.getMenuItemById('start-monitor');
        const stopMenuItem = menu.getMenuItemById('stop-monitor');
        
        if (connectionMenuItem) connectionMenuItem.label = `连接状态: ${connectionStatus}`;
        if (monitorMenuItem) monitorMenuItem.label = `监控状态: ${monitorStatus}`;
        
        const isMonitoring = systemMonitor?.isRunning() || networkMonitor?.isRunning();
        if (startMenuItem) startMenuItem.enabled = !isMonitoring;
        if (stopMenuItem) stopMenuItem.enabled = isMonitoring;
    } catch (error) {
        logger.error('更新托盘菜单失败:', error);
    }
}

// 初始化服务
async function initializeServices() {
    try {
        logger.info('初始化代理服务...');

        // 初始化代理服务（使用try-catch避免循环引用错误）
        try {
            agentService = new AgentService();
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
            connected: agentService?.isConnected ? agentService.isConnected() : false,
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

// 应用程序事件
app.whenReady().then(() => {
    createMainWindow();
    createTray();
    appReady = true;
});

app.on('window-all-closed', () => {
    // 在 macOS 上，保持应用程序运行
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
    }
});

app.on('before-quit', () => {
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
    
    logger.error('未捕获的异常:', error);
    
    // 只在主进程存在且未退出时才显示错误对话框
    if (app && !isQuitting) {
        try {
            dialog.showErrorBox('应用程序错误', `发生未知错误: ${error.message}`);
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
    
    logger.error('未处理的Promise拒绝:', reason);
}); 