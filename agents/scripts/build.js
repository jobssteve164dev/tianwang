const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 开始构建 TianWang Agent...');

// 确保目录存在
const buildDir = path.join(__dirname, '../build');
const assetsDir = path.join(__dirname, '../assets');

if (!fs.existsSync(buildDir)) {
    fs.mkdirSync(buildDir, { recursive: true });
}

if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
}

// 创建基本的HTML文件
const htmlContent = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TianWang Agent</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif;
            background: #000000;
            color: #ffffff;
            height: 100vh;
            overflow: hidden;
            display: flex;
            flex-direction: column;
        }

        .app-container {
            display: flex;
            height: 100vh;
            padding: 0;
            margin-top: 28px; /* 为标题栏预留空间 */
        }

        /* 添加可拖动的标题栏区域 */
        .titlebar {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            height: 28px;
            background: #000000;
            -webkit-app-region: drag;
            z-index: 1000;
            display: flex;
            align-items: center;
            padding: 0 12px;
            border-bottom: 1px solid #333333;
        }

        .titlebar-controls {
            display: flex;
            gap: 8px;
            margin-right: 12px;
            -webkit-app-region: no-drag;
        }

        .titlebar-button {
            width: 12px;
            height: 12px;
            border-radius: 50%;
            border: none;
            cursor: pointer;
            -webkit-app-region: no-drag;
        }

        .titlebar-button.close {
            background: #ff5f57;
        }

        .titlebar-button.minimize {
            background: #febc2e;
        }

        .titlebar-button.maximize {
            background: #28c940;
        }

        .titlebar-title {
            font-size: 12px;
            color: #888888;
            font-weight: 500;
            flex: 1;
        }

        .sidebar {
            width: 280px;
            background: #111111;
            border-right: 1px solid #333333;
            display: flex;
            flex-direction: column;
            padding: 20px 0;
            -webkit-app-region: no-drag;
        }

        .main-content {
            flex: 1;
            display: flex;
            flex-direction: column;
            background: #000000;
            -webkit-app-region: no-drag;
        }

        .header {
            padding: 20px 30px;
            border-bottom: 1px solid #333333;
            background: #0a0a0a;
        }

        .header h1 {
            font-size: 24px;
            font-weight: 600;
            margin-bottom: 4px;
            color: #ffffff;
        }

        .header p {
            font-size: 14px;
            color: #888888;
            font-weight: 400;
        }

        .status-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 1px;
            background: #333333;
            margin: 20px 30px;
            border-radius: 8px;
            overflow: hidden;
        }

        .status-card {
            background: #111111;
            padding: 20px;
            border: none;
            position: relative;
        }

        .status-card h3 {
            font-size: 12px;
            font-weight: 500;
            color: #888888;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 12px;
            display: flex;
            align-items: center;
        }

        .status-indicator {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            margin-right: 8px;
            flex-shrink: 0;
        }

        .status-online { background-color: #00ff88; box-shadow: 0 0 8px rgba(0, 255, 136, 0.5); }
        .status-offline { background-color: #ff4444; box-shadow: 0 0 8px rgba(255, 68, 68, 0.5); }
        .status-warning { background-color: #ffaa00; box-shadow: 0 0 8px rgba(255, 170, 0, 0.5); }

        .status-value {
            font-size: 18px;
            font-weight: 600;
            color: #ffffff;
            margin-bottom: 4px;
        }

        .status-detail {
            font-size: 11px;
            color: #888888;
            line-height: 1.4;
        }

        .controls {
            display: flex;
            gap: 8px;
            padding: 0 30px 20px;
            flex-wrap: wrap;
        }

        .btn {
            padding: 10px 16px;
            border: 1px solid #333333;
            border-radius: 6px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 500;
            transition: all 0.2s ease;
            background: #111111;
            color: #ffffff;
            min-width: 80px;
            text-align: center;
            -webkit-app-region: no-drag;
        }

        .btn:hover {
            background: #222222;
            border-color: #555555;
        }

        .btn:active {
            transform: translateY(1px);
        }

        .btn-primary {
            background: #00ff88;
            border-color: #00ff88;
            color: #000000;
        }

        .btn-primary:hover {
            background: #00cc6a;
            border-color: #00cc6a;
        }

        .btn-danger {
            background: #ff4444;
            border-color: #ff4444;
            color: #ffffff;
        }

        .btn-danger:hover {
            background: #cc3333;
            border-color: #cc3333;
        }

        .btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        .btn:disabled:hover {
            background: #111111;
            border-color: #333333;
        }

        .logs-section {
            flex: 1;
            margin: 0 30px 20px;
            background: #111111;
            border-radius: 8px;
            border: 1px solid #333333;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }

        .logs-header {
            padding: 12px 20px;
            border-bottom: 1px solid #333333;
            background: #0a0a0a;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .logs-title {
            font-size: 13px;
            font-weight: 500;
            color: #ffffff;
        }

        .logs-count {
            font-size: 11px;
            color: #888888;
        }

        .logs-container {
            flex: 1;
            padding: 16px 20px;
            overflow-y: auto;
            font-family: 'SF Mono', 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            font-size: 11px;
            line-height: 1.5;
            background: #000000;
        }

        .logs-container::-webkit-scrollbar {
            width: 6px;
        }

        .logs-container::-webkit-scrollbar-track {
            background: #111111;
        }

        .logs-container::-webkit-scrollbar-thumb {
            background: #333333;
            border-radius: 3px;
        }

        .logs-container::-webkit-scrollbar-thumb:hover {
            background: #555555;
        }

        .log-entry {
            margin-bottom: 6px;
            padding: 2px 0;
            display: flex;
            align-items: flex-start;
        }

        .log-timestamp {
            color: #666666;
            margin-right: 12px;
            flex-shrink: 0;
            font-size: 10px;
            min-width: 60px;
        }

        .log-message {
            flex: 1;
            word-break: break-word;
        }

        .log-error { color: #ff4444; }
        .log-warning { color: #ffaa00; }
        .log-success { color: #00ff88; }
        .log-info { color: #ffffff; }

        .footer {
            padding: 12px 30px;
            border-top: 1px solid #333333;
            background: #0a0a0a;
            text-align: center;
        }

        .footer p {
            font-size: 11px;
            color: #666666;
        }

        .metric-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 1px;
            background: #333333;
            margin: 0 30px 20px;
            border-radius: 8px;
            overflow: hidden;
        }

        .metric-card {
            background: #111111;
            padding: 16px;
            text-align: center;
        }

        .metric-value {
            font-size: 24px;
            font-weight: 700;
            color: #ffffff;
            margin-bottom: 4px;
        }

        .metric-label {
            font-size: 11px;
            color: #888888;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .sidebar-section {
            padding: 0 20px 20px;
        }

        .sidebar-title {
            font-size: 11px;
            color: #888888;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 12px;
            font-weight: 500;
        }

        .sidebar-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 0;
            border-bottom: 1px solid #222222;
        }

        .sidebar-item:last-child {
            border-bottom: none;
        }

        .sidebar-label {
            font-size: 12px;
            color: #cccccc;
        }

        .sidebar-value {
            font-size: 12px;
            color: #ffffff;
            font-weight: 500;
        }

        .logo {
            display: flex;
            align-items: center;
            padding: 0 20px 20px;
            border-bottom: 1px solid #333333;
            margin-bottom: 20px;
        }

        .logo-icon {
            width: 32px;
            height: 32px;
            background: linear-gradient(135deg, #00ff88, #00cc6a);
            border-radius: 8px;
            margin-right: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 16px;
            font-weight: bold;
            color: #000000;
        }

        .logo-text {
            font-size: 16px;
            font-weight: 600;
            color: #ffffff;
        }

        @media (max-width: 768px) {
            .app-container {
                flex-direction: column;
            }
            
            .sidebar {
                width: 100%;
                height: auto;
                border-right: none;
                border-bottom: 1px solid #333333;
            }
            
            .status-grid {
                grid-template-columns: 1fr;
            }
            
            .metric-grid {
                grid-template-columns: repeat(2, 1fr);
            }
        }
    </style>
</head>
<body>
    <!-- 可拖动的标题栏 -->
    <div class="titlebar">
        <div class="titlebar-controls">
            <button class="titlebar-button close" onclick="window.electronAPI.closeWindow()"></button>
            <button class="titlebar-button minimize" onclick="window.electronAPI.minimizeWindow()"></button>
            <button class="titlebar-button maximize" onclick="window.electronAPI.maximizeWindow()"></button>
        </div>
        <div class="titlebar-title">TianWang Agent</div>
    </div>
    
    <div class="app-container">
        <div class="sidebar">
            <div class="logo">
                <div class="logo-icon">🛡️</div>
                <div class="logo-text">TianWang</div>
            </div>
            
            <div class="sidebar-section">
                <div class="sidebar-title">系统信息</div>
                <div class="sidebar-item">
                    <span class="sidebar-label">平台</span>
                    <span class="sidebar-value" id="platform">--</span>
                </div>
                <div class="sidebar-item">
                    <span class="sidebar-label">主机名</span>
                    <span class="sidebar-value" id="hostname">--</span>
                </div>
                <div class="sidebar-item">
                    <span class="sidebar-label">代理ID</span>
                    <span class="sidebar-value" id="agent-id">--</span>
                </div>
            </div>
            
            <div class="sidebar-section">
                <div class="sidebar-title">资源使用</div>
                <div class="sidebar-item">
                    <span class="sidebar-label">CPU</span>
                    <span class="sidebar-value" id="cpu-usage">0%</span>
                </div>
                <div class="sidebar-item">
                    <span class="sidebar-label">内存</span>
                    <span class="sidebar-value" id="memory-usage">0%</span>
                </div>
            </div>
        </div>
        
        <div class="main-content">
            <div class="header">
                <h1>网络安全监控</h1>
                <p>AI驱动的实时威胁检测与防护系统</p>
            </div>
            
            <div class="status-grid">
                <div class="status-card">
                    <h3><span class="status-indicator status-offline" id="connection-status"></span>连接状态</h3>
                    <div class="status-value" id="connection-text">离线</div>
                    <div class="status-detail">与服务器连接状态</div>
                </div>
                
                <div class="status-card">
                    <h3><span class="status-indicator status-offline" id="monitor-status"></span>监控状态</h3>
                    <div class="status-value" id="monitor-text">已停止</div>
                    <div class="status-detail">系统监控运行状态</div>
                </div>
                
                <div class="status-card">
                    <h3><span class="status-indicator status-online" id="system-status"></span>系统状态</h3>
                    <div class="status-value">正常</div>
                    <div class="status-detail">系统运行状态</div>
                </div>
                
                <div class="status-card">
                    <h3>🔒 安全状态</h3>
                    <div class="status-value" id="security-status">安全</div>
                    <div class="status-detail">威胁检测状态</div>
                </div>
            </div>
            
            <div class="metric-grid">
                <div class="metric-card">
                    <div class="metric-value" id="threat-count">0</div>
                    <div class="metric-label">检测威胁</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value" id="blocked-ips">0</div>
                    <div class="metric-label">阻止IP</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value" id="firewall-rules">0</div>
                    <div class="metric-label">防火墙规则</div>
                </div>
            </div>
            
            <div class="controls">
                <button class="btn btn-primary" id="start-btn" onclick="startMonitoring()">开始监控</button>
                <button class="btn btn-danger" id="stop-btn" onclick="stopMonitoring()" disabled>停止监控</button>
                <button class="btn" onclick="showSettings()">设置</button>
                <button class="btn" onclick="runDiagnostics()">诊断</button>
            </div>
            
            <div class="logs-section">
                <div class="logs-header">
                    <span class="logs-title">系统日志</span>
                    <span class="logs-count" id="logs-count">0 条</span>
                </div>
                <div class="logs-container" id="logs-container">
                    <div class="log-entry">
                        <span class="log-timestamp">[启动]</span>
                        <span class="log-message log-info">TianWang Agent 已启动</span>
                    </div>
                </div>
            </div>
            
            <div class="footer">
                <p>TianWang AI Security Monitoring System v1.0.0</p>
            </div>
        </div>
    </div>

    <script>
        // 全局状态
        let isMonitoring = false;
        let systemInfo = null;
        let connectionStatus = false;
        let logCount = 1;

        // 初始化
        async function initialize() {
            try {
                // 获取系统信息
                systemInfo = await window.electronAPI.getSystemInfo();
                updateSystemInfo();
                
                // 获取监控状态
                const status = await window.electronAPI.getMonitoringStatus();
                updateMonitoringStatus(status);
                
                // 设置事件监听
                setupEventListeners();
                
                addLog('系统初始化完成', 'success');
            } catch (error) {
                addLog('初始化失败: ' + error.message, 'error');
            }
        }

        // 更新系统信息
        function updateSystemInfo() {
            if (systemInfo) {
                document.getElementById('platform').textContent = systemInfo.platform;
                document.getElementById('hostname').textContent = systemInfo.hostname;
                document.getElementById('agent-id').textContent = 'agent-' + systemInfo.hostname.substring(0, 8);
            }
        }

        // 更新监控状态
        function updateMonitoringStatus(status) {
            const connectionIndicator = document.getElementById('connection-status');
            const connectionText = document.getElementById('connection-text');
            const monitorIndicator = document.getElementById('monitor-status');
            const monitorText = document.getElementById('monitor-text');
            
            // 连接状态
            if (status.connected) {
                connectionIndicator.className = 'status-indicator status-online';
                connectionText.textContent = '已连接';
                connectionStatus = true;
            } else {
                connectionIndicator.className = 'status-indicator status-offline';
                connectionText.textContent = '离线';
                connectionStatus = false;
            }
            
            // 监控状态
            if (status.system || status.network) {
                monitorIndicator.className = 'status-indicator status-online';
                monitorText.textContent = '运行中';
                isMonitoring = true;
                document.getElementById('start-btn').disabled = true;
                document.getElementById('stop-btn').disabled = false;
            } else {
                monitorIndicator.className = 'status-indicator status-offline';
                monitorText.textContent = '已停止';
                isMonitoring = false;
                document.getElementById('start-btn').disabled = false;
                document.getElementById('stop-btn').disabled = true;
            }
        }

        // 设置事件监听
        function setupEventListeners() {
            // 系统数据监听
            window.electronAPI.onSystemData((data) => {
                if (data.system) {
                    document.getElementById('cpu-usage').textContent = 
                        (data.system.cpu?.load || 0).toFixed(1) + '%';
                    document.getElementById('memory-usage').textContent = 
                        (data.system.memory?.usage || 0) + '%';
                }
            });
            
            // 网络数据监听
            window.electronAPI.onNetworkData((data) => {
                addLog('收到网络数据: ' + (data.interfaces?.length || 0) + ' 个接口', 'info');
            });
            
            // 安全威胁监听
            window.electronAPI.onSecurityThreat((threat) => {
                addLog('🚨 安全警报: ' + threat.description, 'warning');
                // 更新威胁计数器
                const threatCount = document.getElementById('threat-count');
                threatCount.textContent = parseInt(threatCount.textContent) + 1;
            });
        }

        // 开始监控
        async function startMonitoring() {
            try {
                addLog('正在启动监控...', 'info');
                const result = await window.electronAPI.startMonitoring();
                if (result.success) {
                    addLog('监控已启动', 'success');
                    // 更新状态
                    const status = await window.electronAPI.getMonitoringStatus();
                    updateMonitoringStatus(status);
                } else {
                    addLog('启动监控失败: ' + result.error, 'error');
                }
            } catch (error) {
                addLog('启动监控失败: ' + error.message, 'error');
            }
        }

        // 停止监控
        async function stopMonitoring() {
            try {
                addLog('正在停止监控...', 'info');
                const result = await window.electronAPI.stopMonitoring();
                if (result.success) {
                    addLog('监控已停止', 'success');
                    // 更新状态
                    const status = await window.electronAPI.getMonitoringStatus();
                    updateMonitoringStatus(status);
                } else {
                    addLog('停止监控失败: ' + result.error, 'error');
                }
            } catch (error) {
                addLog('停止监控失败: ' + error.message, 'error');
            }
        }

        // 显示设置
        function showSettings() {
            addLog('打开设置界面...', 'info');
            
            // 创建设置对话框
            const settingsDialog = document.createElement('div');
            settingsDialog.style.cssText = 
                'position: fixed;' +
                'top: 0;' +
                'left: 0;' +
                'width: 100%;' +
                'height: 100%;' +
                'background: rgba(0, 0, 0, 0.9);' +
                'display: flex;' +
                'justify-content: center;' +
                'align-items: center;' +
                'z-index: 1000;';
            
            const settingsContent = document.createElement('div');
            settingsContent.style.cssText = 
                'background: #111111;' +
                'border-radius: 12px;' +
                'padding: 30px;' +
                'max-width: 500px;' +
                'width: 90%;' +
                'color: white;' +
                'border: 1px solid #333333;';
            
            settingsContent.innerHTML = 
                '<h2 style="margin-top: 0; text-align: center; margin-bottom: 30px; font-size: 18px;">⚙️ 设置</h2>' +
                
                '<div style="margin-bottom: 20px;">' +
                    '<label style="display: block; margin-bottom: 8px; font-size: 13px; color: #cccccc;">监控间隔 (秒):</label>' +
                    '<input type="number" id="monitor-interval" value="30" min="10" max="300" ' +
                           'style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid #333333; background: #000000; color: white; font-size: 14px;">' +
                '</div>' +
                
                '<div style="margin-bottom: 20px;">' +
                    '<label style="display: flex; align-items: center; margin-bottom: 8px; font-size: 13px; color: #cccccc;">' +
                        '<input type="checkbox" id="auto-start" style="margin-right: 10px;">' +
                        '开机自动启动' +
                    '</label>' +
                '</div>' +
                
                '<div style="margin-bottom: 20px;">' +
                    '<label style="display: flex; align-items: center; margin-bottom: 8px; font-size: 13px; color: #cccccc;">' +
                        '<input type="checkbox" id="minimize-to-tray" style="margin-right: 10px;">' +
                        '最小化到托盘' +
                    '</label>' +
                '</div>' +
                
                '<div style="margin-bottom: 20px;">' +
                    '<label style="display: flex; align-items: center; margin-bottom: 8px; font-size: 13px; color: #cccccc;">' +
                        '<input type="checkbox" id="auto-block" style="margin-right: 10px;">' +
                        '自动阻止威胁IP' +
                    '</label>' +
                '</div>' +
                
                '<div style="text-align: center; margin-top: 30px;">' +
                    '<button onclick="saveSettings()" style="' +
                        'padding: 10px 20px;' +
                        'margin-right: 10px;' +
                        'border: none;' +
                        'border-radius: 6px;' +
                        'background: #00ff88;' +
                        'color: #000000;' +
                        'cursor: pointer;' +
                        'font-weight: 500;' +
                    '">保存</button>' +
                    '<button onclick="closeSettings()" style="' +
                        'padding: 10px 20px;' +
                        'border: 1px solid #333333;' +
                        'border-radius: 6px;' +
                        'background: #111111;' +
                        'color: white;' +
                        'cursor: pointer;' +
                        'font-weight: 500;' +
                    '">取消</button>' +
                '</div>';
            
            settingsDialog.appendChild(settingsContent);
            document.body.appendChild(settingsDialog);
            
            // 加载当前设置
            loadSettings();
        }
        
        // 保存设置
        async function saveSettings() {
            try {
                const settings = {
                    monitorInterval: parseInt(document.getElementById('monitor-interval').value),
                    autoStart: document.getElementById('auto-start').checked,
                    minimizeToTray: document.getElementById('minimize-to-tray').checked,
                    autoBlock: document.getElementById('auto-block').checked
                };
                
                await window.electronAPI.saveSettings(settings);
                addLog('设置已保存', 'success');
                closeSettings();
            } catch (error) {
                addLog('保存设置失败: ' + error.message, 'error');
            }
        }
        
        // 关闭设置
        function closeSettings() {
            const dialog = document.querySelector('div[style*="position: fixed"]');
            if (dialog) {
                dialog.remove();
            }
        }
        
        // 加载设置
        async function loadSettings() {
            try {
                const settings = await window.electronAPI.getSettings();
                if (settings) {
                    document.getElementById('monitor-interval').value = settings.monitorInterval || 30;
                    document.getElementById('auto-start').checked = settings.autoStart || false;
                    document.getElementById('minimize-to-tray').checked = settings.minimizeToTray || false;
                    document.getElementById('auto-block').checked = settings.autoBlock || false;
                }
            } catch (error) {
                addLog('加载设置失败: ' + error.message, 'error');
            }
        }

        // 运行网络诊断
        function runDiagnostics() {
            addLog('正在运行网络诊断...', 'info');
            // TODO: 实现网络诊断
        }

        // 添加日志
        function addLog(message, type = 'info') {
            const logsContainer = document.getElementById('logs-container');
            const logEntry = document.createElement('div');
            logEntry.className = 'log-entry';
            
            const timestamp = new Date().toLocaleTimeString('zh-CN', { 
                hour12: false, 
                hour: '2-digit', 
                minute: '2-digit', 
                second: '2-digit' 
            });
            
            let icon = '';
            let className = 'log-info';
            
            switch (type) {
                case 'error':
                    icon = '❌';
                    className = 'log-error';
                    break;
                case 'warning':
                    icon = '⚠️';
                    className = 'log-warning';
                    break;
                case 'success':
                    icon = '✅';
                    className = 'log-success';
                    break;
                default:
                    icon = 'ℹ️';
                    className = 'log-info';
            }
            
            logEntry.innerHTML = \`
                <span class="log-timestamp">[\${timestamp}]</span>
                <span class="log-message \${className}">\${icon} \${message}</span>
            \`;
            
            logsContainer.appendChild(logEntry);
            logsContainer.scrollTop = logsContainer.scrollHeight;
            
            // 更新日志计数
            logCount++;
            document.getElementById('logs-count').textContent = logCount + ' 条';
            
            // 限制日志数量
            if (logsContainer.children.length > 100) {
                logsContainer.removeChild(logsContainer.firstChild);
            }
        }

        // 定期更新状态
        setInterval(async () => {
            try {
                const status = await window.electronAPI.getMonitoringStatus();
                updateMonitoringStatus(status);
            } catch (error) {
                console.error('状态更新失败:', error);
            }
        }, 5000);

        // 页面加载完成后初始化
        document.addEventListener('DOMContentLoaded', initialize);
    </script>
</body>
</html>`;

fs.writeFileSync(path.join(buildDir, 'index.html'), htmlContent);

// 创建基本的图标文件（占位符）
const iconSvg = `<svg width="256" height="256" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
    <defs>
        <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
        </linearGradient>
    </defs>
    <rect width="256" height="256" rx="32" fill="url(#grad1)"/>
    <text x="128" y="140" font-family="Arial, sans-serif" font-size="120" fill="white" text-anchor="middle">🛡️</text>
    <text x="128" y="200" font-family="Arial, sans-serif" font-size="24" fill="white" text-anchor="middle" opacity="0.8">TianWang</text>
</svg>`;

// 保存SVG图标（在实际部署中应该使用真正的PNG图标）
fs.writeFileSync(path.join(assetsDir, 'icon.svg'), iconSvg);

// 创建托盘图标的占位符
fs.writeFileSync(path.join(assetsDir, 'tray-icon.svg'), iconSvg);
fs.writeFileSync(path.join(assetsDir, 'warning-icon.svg'), iconSvg);

console.log('✅ 构建完成！');
console.log('📁 输出目录:', buildDir);
console.log('🎨 资源目录:', assetsDir);
console.log('');
console.log('🚀 运行以下命令启动应用:');
console.log('   npm start'); 