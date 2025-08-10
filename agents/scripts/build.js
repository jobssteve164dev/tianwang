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
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            flex: 1;
        }
        .header {
            text-align: center;
            margin-bottom: 40px;
        }
        .header h1 {
            font-size: 2.5em;
            margin-bottom: 10px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }
        .header p {
            font-size: 1.2em;
            opacity: 0.9;
        }
        .status-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-bottom: 40px;
        }
        .status-card {
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            border-radius: 12px;
            padding: 20px;
            border: 1px solid rgba(255, 255, 255, 0.2);
        }
        .status-card h3 {
            margin-top: 0;
            margin-bottom: 15px;
            font-size: 1.3em;
        }
        .status-indicator {
            display: inline-block;
            width: 12px;
            height: 12px;
            border-radius: 50%;
            margin-right: 8px;
        }
        .status-online { background-color: #4CAF50; }
        .status-offline { background-color: #f44336; }
        .status-warning { background-color: #FF9800; }
        .controls {
            display: flex;
            gap: 15px;
            margin-top: 20px;
            justify-content: center;
            flex-wrap: wrap;
        }
        .btn {
            padding: 12px 24px;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            transition: all 0.3s ease;
            background: rgba(255, 255, 255, 0.2);
            color: white;
            border: 1px solid rgba(255, 255, 255, 0.3);
        }
        .btn:hover {
            background: rgba(255, 255, 255, 0.3);
            transform: translateY(-2px);
        }
        .btn-primary {
            background: #4CAF50;
            border-color: #4CAF50;
        }
        .btn-danger {
            background: #f44336;
            border-color: #f44336;
        }
        .logs {
            background: rgba(0, 0, 0, 0.3);
            border-radius: 8px;
            padding: 20px;
            margin-top: 20px;
            max-height: 300px;
            overflow-y: auto;
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            font-size: 12px;
            line-height: 1.4;
        }
        .log-entry {
            margin-bottom: 5px;
            padding: 2px 0;
        }
        .log-timestamp {
            color: #888;
            margin-right: 10px;
        }
        .footer {
            text-align: center;
            padding: 20px 0;
            opacity: 0.7;
            border-top: 1px solid rgba(255, 255, 255, 0.1);
            margin-top: 40px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🛡️ TianWang Agent</h1>
            <p>AI驱动的网络安全监控系统</p>
        </div>
        
        <div class="status-grid">
            <div class="status-card">
                <h3><span class="status-indicator status-offline" id="connection-status"></span>连接状态</h3>
                <p id="connection-text">正在连接到服务器...</p>
                <p><strong>代理ID:</strong> <span id="agent-id">加载中...</span></p>
            </div>
            
            <div class="status-card">
                <h3><span class="status-indicator status-offline" id="monitor-status"></span>监控状态</h3>
                <p id="monitor-text">监控已停止</p>
                <p><strong>上次更新:</strong> <span id="last-update">--</span></p>
            </div>
            
            <div class="status-card">
                <h3><span class="status-indicator status-online" id="system-status"></span>系统状态</h3>
                <p><strong>平台:</strong> <span id="platform">--</span></p>
                <p><strong>主机名:</strong> <span id="hostname">--</span></p>
                <p><strong>CPU:</strong> <span id="cpu-usage">0%</span></p>
                <p><strong>内存:</strong> <span id="memory-usage">0%</span></p>
            </div>
            
            <div class="status-card">
                <h3>🔒 安全状态</h3>
                <p><strong>检测到威胁:</strong> <span id="threat-count">0</span></p>
                <p><strong>阻止IP:</strong> <span id="blocked-ips">0</span></p>
                <p><strong>防火墙规则:</strong> <span id="firewall-rules">0</span></p>
            </div>
        </div>
        
        <div class="controls">
            <button class="btn btn-primary" id="start-btn" onclick="startMonitoring()">开始监控</button>
            <button class="btn btn-danger" id="stop-btn" onclick="stopMonitoring()" disabled>停止监控</button>
            <button class="btn" onclick="showSettings()">设置</button>
            <button class="btn" onclick="showLogs()">查看日志</button>
            <button class="btn" onclick="runDiagnostics()">网络诊断</button>
        </div>
        
        <div class="logs" id="logs-container">
            <div class="log-entry">
                <span class="log-timestamp">[${new Date().toLocaleTimeString()}]</span>
                <span>TianWang Agent 已启动</span>
            </div>
        </div>
        
        <div class="footer">
            <p>TianWang AI Security Monitoring System v1.0.0</p>
        </div>
    </div>

    <script>
        // 全局状态
        let isMonitoring = false;
        let systemInfo = null;
        let connectionStatus = false;

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
                
                addLog('系统初始化完成');
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
                connectionText.textContent = '已连接到服务器';
                connectionStatus = true;
            } else {
                connectionIndicator.className = 'status-indicator status-offline';
                connectionText.textContent = '未连接到服务器';
                connectionStatus = false;
            }
            
            // 监控状态
            if (status.system || status.network) {
                monitorIndicator.className = 'status-indicator status-online';
                monitorText.textContent = '监控运行中';
                isMonitoring = true;
                document.getElementById('start-btn').disabled = true;
                document.getElementById('stop-btn').disabled = false;
            } else {
                monitorIndicator.className = 'status-indicator status-offline';
                monitorText.textContent = '监控已停止';
                isMonitoring = false;
                document.getElementById('start-btn').disabled = false;
                document.getElementById('stop-btn').disabled = true;
            }
            
            document.getElementById('last-update').textContent = new Date().toLocaleTimeString();
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
                addLog('收到系统数据: CPU ' + (data.system?.cpu?.load || 0).toFixed(1) + '%');
            });
            
            // 网络数据监听
            window.electronAPI.onNetworkData((data) => {
                addLog('收到网络数据: ' + (data.interfaces?.length || 0) + ' 个网络接口');
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
                addLog('正在启动监控...');
                const result = await window.electronAPI.startMonitoring();
                if (result.success) {
                    addLog('监控已启动');
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
                addLog('正在停止监控...');
                const result = await window.electronAPI.stopMonitoring();
                if (result.success) {
                    addLog('监控已停止');
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
            addLog('打开设置界面...');
            
            // 创建设置对话框
            const settingsDialog = document.createElement('div');
            settingsDialog.style.cssText = 
                'position: fixed;' +
                'top: 0;' +
                'left: 0;' +
                'width: 100%;' +
                'height: 100%;' +
                'background: rgba(0, 0, 0, 0.8);' +
                'display: flex;' +
                'justify-content: center;' +
                'align-items: center;' +
                'z-index: 1000;';
            
            const settingsContent = document.createElement('div');
            settingsContent.style.cssText = 
                'background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);' +
                'border-radius: 12px;' +
                'padding: 30px;' +
                'max-width: 500px;' +
                'width: 90%;' +
                'color: white;' +
                'border: 1px solid rgba(255, 255, 255, 0.2);';
            
            settingsContent.innerHTML = 
                '<h2 style="margin-top: 0; text-align: center;">⚙️ 设置</h2>' +
                
                '<div style="margin-bottom: 20px;">' +
                    '<label style="display: block; margin-bottom: 5px;">监控间隔 (秒):</label>' +
                    '<input type="number" id="monitor-interval" value="30" min="10" max="300" ' +
                           'style="width: 100%; padding: 8px; border-radius: 4px; border: none; background: rgba(255,255,255,0.2); color: white;">' +
                '</div>' +
                
                '<div style="margin-bottom: 20px;">' +
                    '<label style="display: block; margin-bottom: 5px;">' +
                        '<input type="checkbox" id="auto-start" style="margin-right: 8px;">' +
                        '开机自动启动' +
                    '</label>' +
                '</div>' +
                
                '<div style="margin-bottom: 20px;">' +
                    '<label style="display: block; margin-bottom: 5px;">' +
                        '<input type="checkbox" id="minimize-to-tray" style="margin-right: 8px;">' +
                        '最小化到托盘' +
                    '</label>' +
                '</div>' +
                
                '<div style="margin-bottom: 20px;">' +
                    '<label style="display: block; margin-bottom: 5px;">' +
                        '<input type="checkbox" id="auto-block" style="margin-right: 8px;">' +
                        '自动阻止威胁IP' +
                    '</label>' +
                '</div>' +
                
                '<div style="text-align: center; margin-top: 30px;">' +
                    '<button onclick="saveSettings()" style="' +
                        'padding: 10px 20px;' +
                        'margin-right: 10px;' +
                        'border: none;' +
                        'border-radius: 6px;' +
                        'background: #4CAF50;' +
                        'color: white;' +
                        'cursor: pointer;' +
                    '">保存</button>' +
                    '<button onclick="closeSettings()" style="' +
                        'padding: 10px 20px;' +
                        'border: none;' +
                        'border-radius: 6px;' +
                        'background: rgba(255,255,255,0.2);' +
                        'color: white;' +
                        'cursor: pointer;' +
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

        // 显示日志
        function showLogs() {
            addLog('打开日志查看器...');
            // TODO: 实现日志查看器
        }

        // 运行网络诊断
        function runDiagnostics() {
            addLog('正在运行网络诊断...');
            // TODO: 实现网络诊断
        }

        // 添加日志
        function addLog(message, type = 'info') {
            const logsContainer = document.getElementById('logs-container');
            const logEntry = document.createElement('div');
            logEntry.className = 'log-entry';
            
            const timestamp = new Date().toLocaleTimeString();
            let icon = '';
            let color = '';
            
            switch (type) {
                case 'error':
                    icon = '❌';
                    color = '#f44336';
                    break;
                case 'warning':
                    icon = '⚠️';
                    color = '#FF9800';
                    break;
                case 'success':
                    icon = '✅';
                    color = '#4CAF50';
                    break;
                default:
                    icon = 'ℹ️';
                    color = '#fff';
            }
            
            logEntry.innerHTML = \`
                <span class="log-timestamp">[\${timestamp}]</span>
                <span style="color: \${color}">\${icon} \${message}</span>
            \`;
            
            logsContainer.appendChild(logEntry);
            logsContainer.scrollTop = logsContainer.scrollHeight;
            
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