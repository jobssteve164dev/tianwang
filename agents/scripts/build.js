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



        .titlebar-title {
            font-size: 12px;
            color: #888888;
            font-weight: 500;
            margin-left: 80px; /* 为系统交通灯按钮留出空间 */
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

        .logs-controls {
            display: flex;
            gap: 8px;
            align-items: center;
        }

        .logs-container {
            flex: 1;
            padding: 16px 20px;
            overflow-y: auto;
            overflow-x: hidden;
            font-family: 'SF Mono', 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            font-size: 11px;
            line-height: 1.5;
            background: #000000;
            scrollbar-width: thin;
            scrollbar-color: #444444 #0a0a0a;
        }

        .logs-container::-webkit-scrollbar {
            width: 8px;
        }

        .logs-container::-webkit-scrollbar-track {
            background: #0a0a0a;
            border-radius: 4px;
        }

        .logs-container::-webkit-scrollbar-thumb {
            background: #444444;
            border-radius: 4px;
            border: 1px solid #222222;
        }

        .logs-container::-webkit-scrollbar-thumb:hover {
            background: #666666;
        }

        .logs-container::-webkit-scrollbar-corner {
            background: #0a0a0a;
        }

        /* 标签页样式 */
        .tab-container {
            display: flex;
            background: #0a0a0a;
            border-bottom: 1px solid #333333;
        }

        .tab-button {
            padding: 12px 24px;
            background: transparent;
            border: none;
            color: #888888;
            cursor: pointer;
            font-size: 13px;
            font-weight: 500;
            border-bottom: 2px solid transparent;
            transition: all 0.2s ease;
        }

        .tab-button:hover {
            color: #ffffff;
            background: #1a1a1a;
        }

        .tab-button.active {
            color: #00ff88;
            border-bottom-color: #00ff88;
            background: #0a0a0a;
        }

        .tab-content {
            display: none;
            flex: 1;
            flex-direction: column;
            overflow: hidden;
        }

        .tab-content.active {
            display: flex;
        }

        /* 事件列表标签页特殊样式 */
        #events-tab {
            height: calc(100vh - 200px);
            overflow: hidden;
        }

        /* 事件列表样式 */
        .events-container {
            flex: 1;
            margin: 0 30px 20px;
            background: #111111;
            border-radius: 8px;
            border: 1px solid #333333;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            min-height: 400px;
            max-height: 600px;
        }

        .events-header {
            padding: 12px 20px;
            border-bottom: 1px solid #333333;
            background: #0a0a0a;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .events-title {
            font-size: 13px;
            font-weight: 500;
            color: #ffffff;
        }

        .events-controls {
            display: flex;
            gap: 8px;
            align-items: center;
        }

        .filter-select {
            padding: 4px 8px;
            background: #222222;
            border: 1px solid #333333;
            color: #ffffff;
            border-radius: 4px;
            font-size: 11px;
        }

        .search-input {
            padding: 4px 8px;
            background: #222222;
            border: 1px solid #333333;
            color: #ffffff;
            border-radius: 4px;
            font-size: 11px;
            width: 120px;
        }

        .events-list {
            flex: 1;
            overflow-y: auto;
            overflow-x: hidden;
            padding: 0;
            scrollbar-width: thin;
            scrollbar-color: #444444 #0a0a0a;
        }

        .events-list::-webkit-scrollbar {
            width: 8px;
        }

        .events-list::-webkit-scrollbar-track {
            background: #0a0a0a;
            border-radius: 4px;
        }

        .events-list::-webkit-scrollbar-thumb {
            background: #444444;
            border-radius: 4px;
            border: 1px solid #222222;
        }

        .events-list::-webkit-scrollbar-thumb:hover {
            background: #666666;
        }

        .events-list::-webkit-scrollbar-corner {
            background: #0a0a0a;
        }

        .event-item {
            padding: 12px 20px;
            border-bottom: 1px solid #222222;
            cursor: pointer;
            transition: background-color 0.2s ease;
        }

        .event-item:hover {
            background: #1a1a1a;
        }

        .event-item:last-child {
            border-bottom: none;
        }

        .event-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 8px;
        }

        .event-title {
            font-size: 13px;
            font-weight: 500;
            color: #ffffff;
            flex: 1;
        }

        .event-timestamp {
            font-size: 11px;
            color: #666666;
            margin-left: 12px;
        }

        .event-meta {
            display: flex;
            gap: 8px;
            margin-bottom: 6px;
        }

        .event-type {
            padding: 2px 6px;
            background: #333333;
            color: #ffffff;
            border-radius: 3px;
            font-size: 10px;
            text-transform: uppercase;
        }

        .event-level {
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 10px;
            text-transform: uppercase;
        }

        .event-level.error { background: #3a1a1a; color: #ff4444; }
        .event-level.warning { background: #3a3a1a; color: #ffaa00; }
        .event-level.info { background: #1a1a3a; color: #4444ff; }
        .event-level.success { background: #1a3a1a; color: #00ff88; }

        .event-status {
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 10px;
            text-transform: uppercase;
        }

        .event-status.pending { background: #3a3a1a; color: #ffaa00; }
        .event-status.sent { background: #1a3a1a; color: #00ff88; }
        .event-status.failed { background: #3a1a1a; color: #ff4444; }
        .event-status.acknowledged { background: #1a1a3a; color: #4444ff; }

        .event-description {
            font-size: 12px;
            color: #cccccc;
            line-height: 1.4;
            margin-bottom: 8px;
        }

        .event-tags {
            display: flex;
            gap: 4px;
            flex-wrap: wrap;
        }

        .event-tag {
            padding: 1px 4px;
            background: #222222;
            color: #888888;
            border-radius: 2px;
            font-size: 9px;
        }

        .event-actions {
            display: flex;
            gap: 8px;
            margin-top: 8px;
        }

        .event-action-btn {
            padding: 4px 8px;
            background: #222222;
            border: 1px solid #333333;
            color: #ffffff;
            border-radius: 4px;
            font-size: 10px;
            cursor: pointer;
            transition: all 0.2s ease;
        }

        .event-action-btn:hover {
            background: #333333;
            border-color: #444444;
        }

        .event-feedback {
            margin-top: 8px;
            padding: 8px;
            background: #1a1a1a;
            border-radius: 4px;
            font-size: 11px;
            color: #cccccc;
        }

        .event-stats {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 1px;
            background: #333333;
            margin: 0 30px 20px;
            border-radius: 8px;
            overflow: hidden;
        }

        .event-stat-card {
            background: #111111;
            padding: 12px;
            text-align: center;
        }

        .event-stat-value {
            font-size: 18px;
            font-weight: 700;
            color: #ffffff;
            margin-bottom: 2px;
        }

        .event-stat-label {
            font-size: 10px;
            color: #888888;
            text-transform: uppercase;
            letter-spacing: 0.5px;
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
                <!-- 标题栏占位区域 -->
            <div class="titlebar">
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
            
            <!-- 标签页导航 -->
            <div class="tab-container">
                <button class="tab-button active" onclick="switchTab('dashboard')">监控面板</button>
                <button class="tab-button" onclick="switchTab('events')">事件列表</button>
                <button class="tab-button" onclick="switchTab('logs')">系统日志</button>
            </div>
            
            <!-- 监控面板标签页 -->
            <div id="dashboard-tab" class="tab-content active">
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
            
            <div class="footer">
                <p>TianWang AI Security Monitoring System v1.0.0</p>
            </div>
        </div>
        
        <!-- 事件列表标签页 -->
        <div id="events-tab" class="tab-content">
            <!-- 事件统计 -->
            <div class="event-stats">
                <div class="event-stat-card">
                    <div class="event-stat-value" id="total-events">0</div>
                    <div class="event-stat-label">总事件数</div>
                </div>
                <div class="event-stat-card">
                    <div class="event-stat-value" id="today-events">0</div>
                    <div class="event-stat-label">今日事件</div>
                </div>
                <div class="event-stat-card">
                    <div class="event-stat-value" id="error-events">0</div>
                    <div class="event-stat-label">错误事件</div>
                </div>
                <div class="event-stat-card">
                    <div class="event-stat-value" id="pending-events">0</div>
                    <div class="event-stat-label">待处理</div>
                </div>
            </div>
            
            <!-- 事件列表 -->
            <div class="events-container">
                <div class="events-header">
                    <span class="events-title">事件列表</span>
                    <div class="events-controls">
                        <select class="filter-select" id="type-filter" onchange="filterEvents()">
                            <option value="all">所有类型</option>
                        </select>
                        <select class="filter-select" id="level-filter" onchange="filterEvents()">
                            <option value="all">所有级别</option>
                            <option value="error">错误</option>
                            <option value="warning">警告</option>
                            <option value="info">信息</option>
                            <option value="success">成功</option>
                        </select>
                        <select class="filter-select" id="status-filter" onchange="filterEvents()">
                            <option value="all">所有状态</option>
                            <option value="pending">待处理</option>
                            <option value="sent">已发送</option>
                            <option value="failed">失败</option>
                            <option value="acknowledged">已确认</option>
                        </select>
                        <input type="text" class="search-input" id="search-input" placeholder="搜索事件..." onkeyup="filterEvents()">
                        <button class="event-action-btn" onclick="clearOldEvents()">清理旧事件</button>
                        <button class="event-action-btn" onclick="exportEvents()">导出</button>
                    </div>
                </div>
                <div class="events-list" id="events-list">
                    <!-- 事件列表将通过JavaScript动态生成 -->
                </div>
            </div>
        </div>
        
        <!-- 系统日志标签页 -->
        <div id="logs-tab" class="tab-content">
            <div class="logs-section">
                <div class="logs-header">
                    <span class="logs-title">系统日志</span>
                    <div class="logs-controls">
                        <select class="filter-select" id="log-level-filter" onchange="filterLogs()">
                            <option value="all">所有级别</option>
                            <option value="error">错误</option>
                            <option value="warning">警告</option>
                            <option value="info">信息</option>
                            <option value="success">成功</option>
                        </select>
                        <input type="text" class="search-input" id="log-search-input" placeholder="搜索日志..." onkeyup="filterLogs()">
                        <button class="event-action-btn" onclick="clearLogs()">清空日志</button>
                        <button class="event-action-btn" onclick="exportLogs()">导出日志</button>
                        <button class="event-action-btn" onclick="refreshLogs()">刷新</button>
                    </div>
                    <span class="logs-count" id="logs-count">0 条</span>
                </div>
                <div class="logs-container" id="logs-container">
                    <div class="log-entry">
                        <span class="log-timestamp">[启动]</span>
                        <span class="log-message log-info">TianWang Agent 已启动</span>
                    </div>
                </div>
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
                
                // 初始化防火墙统计
                await updateFirewallStatistics();
                
                // 设置事件监听
                setupEventListeners();
                
                // 初始化日志计数
                updateLogCount();
                
                addLog('✅ 系统初始化完成', 'success');
            } catch (error) {
                addLog('系统初始化失败: ' + error.message, 'error');
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
            
            // 事件监听
            window.electronAPI.onEventRecorded((event) => {
                addEventToList(event);
                updateEventStats();
            });
            
            window.electronAPI.onEventUpdated((event) => {
                updateEventInList(event);
                updateEventStats();
            });
            
            // 安全威胁监听
            window.electronAPI.onSecurityThreat((threat) => {
                addLog('🚨 安全警报: ' + threat.description, 'warning');
                // 更新威胁计数器
                const threatCount = document.getElementById('threat-count');
                threatCount.textContent = parseInt(threatCount.textContent) + 1;
            });

            // IP阻止/解除阻止监听
            window.electronAPI.onIPBlocked((ip) => {
                addLog('IP ' + ip + ' 已被阻止', 'warning');
                updateFirewallStatistics(); // 实时更新阻止IP数量
            });

            window.electronAPI.onIPUnblocked((ip) => {
                addLog('IP ' + ip + ' 已解除阻止', 'info');
                updateFirewallStatistics(); // 实时更新阻止IP数量
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
                'max-width: 600px;' +
                'width: 90%;' +
                'color: white;' +
                'border: 1px solid #333333;' +
                'max-height: 80vh;' +
                'overflow-y: auto;' +
                'scrollbar-width: thin;' +
                'scrollbar-color: #333333 #111111;';
            
            // 添加自定义滚动条样式
            const style = document.createElement('style');
            style.textContent = 
                '.settings-dialog::-webkit-scrollbar {' +
                '    width: 8px;' +
                '}' +
                '.settings-dialog::-webkit-scrollbar-track {' +
                '    background: #0a0a0a;' +
                '    border-radius: 4px;' +
                '}' +
                '.settings-dialog::-webkit-scrollbar-thumb {' +
                '    background: #444444;' +
                '    border-radius: 4px;' +
                '    border: 1px solid #222222;' +
                '}' +
                '.settings-dialog::-webkit-scrollbar-thumb:hover {' +
                '    background: #666666;' +
                '}' +
                '.settings-dialog::-webkit-scrollbar-corner {' +
                '    background: #0a0a0a;' +
                '}';
            document.head.appendChild(style);
            settingsContent.classList.add('settings-dialog');
            
            settingsContent.innerHTML = 
                '<h2 style="margin-top: 0; text-align: center; margin-bottom: 30px; font-size: 18px;">⚙️ 设置</h2>' +
                
                // 服务器配置部分
                '<div style="margin-bottom: 30px; padding-bottom: 20px; border-bottom: 1px solid #333333;">' +
                    '<h3 style="margin-bottom: 15px; font-size: 16px; color: #007AFF;">🌐 服务器配置</h3>' +
                    '<div style="margin-bottom: 15px;">' +
                        '<label style="display: block; margin-bottom: 8px; font-size: 13px; color: #cccccc;">WebSocket服务器地址:</label>' +
                        '<input type="text" id="server-url" placeholder="ws://localhost:5555" ' +
                        'style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid #333333; background: #000000; color: white; font-size: 14px;">' +
                    '</div>' +
                    '<div style="margin-bottom: 15px;">' +
                        '<label style="display: block; margin-bottom: 8px; font-size: 13px; color: #cccccc;">API服务器地址:</label>' +
                        '<input type="text" id="api-url" placeholder="http://localhost:5555/api" ' +
                        'style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid #333333; background: #000000; color: white; font-size: 14px;">' +
                    '</div>' +
                    '<div style="display: flex; gap: 10px; margin-bottom: 15px;">' +
                        '<button onclick="testServerConnection()" style="flex: 1; padding: 8px; background: #333333; border: none; border-radius: 6px; color: white; cursor: pointer;">测试连接</button>' +
                        '<button onclick="resetServerConfig()" style="flex: 1; padding: 8px; background: #333333; border: none; border-radius: 6px; color: white; cursor: pointer;">重置默认</button>' +
                    '</div>' +
                    '<div id="server-status" style="display: none; padding: 8px; border-radius: 4px; font-size: 12px; margin-top: 10px;"></div>' +
                '</div>' +
                
                // 原有设置部分
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
                
                '<div style="margin-bottom: 20px;">' +
                    '<label style="display: block; margin-bottom: 8px; font-size: 13px; color: #cccccc;">注册码:</label>' +
                    '<input type="text" id="registration-code" placeholder="请输入注册码" ' +
                           'style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid #333333; background: #000000; color: white; font-size: 14px;">' +
                '</div>' +
                
                '<div style="margin-bottom: 20px;">' +
                    '<div style="display: flex; gap: 10px;">' +
                        '<button onclick="validateRegistrationCode()" style="' +
                            'flex: 1;' +
                            'padding: 8px 12px;' +
                            'border: 1px solid #333333;' +
                            'border-radius: 6px;' +
                            'background: #111111;' +
                            'color: white;' +
                            'cursor: pointer;' +
                            'font-size: 12px;' +
                            'font-weight: 500;' +
                        '">验证注册码</button>' +
                        '<button onclick="generateRegistrationCode()" style="' +
                            'flex: 1;' +
                            'padding: 8px 12px;' +
                            'border: 1px solid #333333;' +
                            'border-radius: 6px;' +
                            'background: #111111;' +
                            'color: white;' +
                            'cursor: pointer;' +
                            'font-size: 12px;' +
                            'font-weight: 500;' +
                        '">生成注册码</button>' +
                    '</div>' +
                '</div>' +
                
                '<div id="registration-status" style="margin-bottom: 20px; padding: 10px; border-radius: 6px; display: none;">' +
                    '<div id="status-message" style="font-size: 12px;"></div>' +
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
                
                // 保存常规设置
                await window.electronAPI.saveSettings(settings);
                
                // 保存服务器配置
                const serverConfig = {
                    serverUrl: document.getElementById('server-url').value.trim(),
                    apiUrl: document.getElementById('api-url').value.trim()
                };
                
                if (serverConfig.serverUrl && serverConfig.apiUrl) {
                    await window.electronAPI.updateServerConfig(serverConfig);
                }
                
                // 保存注册码
                const registrationCode = document.getElementById('registration-code').value.trim();
                if (registrationCode) {
                    await window.electronAPI.setRegistrationCode(registrationCode);
                }
                
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
                
                // 加载服务器配置
                const serverConfig = await window.electronAPI.getServerConfig();
                if (serverConfig) {
                    document.getElementById('server-url').value = serverConfig.serverUrl || '';
                    document.getElementById('api-url').value = serverConfig.apiUrl || '';
                }
                
                // 加载注册码
                const registrationCode = await window.electronAPI.getRegistrationCode();
                if (registrationCode) {
                    document.getElementById('registration-code').value = registrationCode;
                }
            } catch (error) {
                addLog('加载设置失败: ' + error.message, 'error');
            }
        }

        // 测试服务器连接
        async function testServerConnection() {
            const statusDiv = document.getElementById('server-status');
            statusDiv.style.display = 'block';
            statusDiv.style.background = '#1a1a3a';
            statusDiv.style.border = '1px solid #4444ff';
            statusDiv.style.color = '#4444ff';
            statusDiv.textContent = '正在测试连接...';
            
            try {
                const result = await window.electronAPI.testServerConnection();
                if (result.success) {
                    statusDiv.style.background = '#1a3a1a';
                    statusDiv.style.border = '1px solid #00ff88';
                    statusDiv.style.color = '#00ff88';
                    statusDiv.textContent = '连接成功: ' + result.message;
                } else {
                    statusDiv.style.background = '#3a1a1a';
                    statusDiv.style.border = '1px solid #ff4444';
                    statusDiv.style.color = '#ff4444';
                    statusDiv.textContent = '连接失败: ' + result.message;
                }
            } catch (error) {
                statusDiv.style.background = '#3a1a1a';
                statusDiv.style.border = '1px solid #ff4444';
                statusDiv.style.color = '#ff4444';
                statusDiv.textContent = '连接测试失败: ' + error.message;
            }
            
            setTimeout(() => {
                statusDiv.style.display = 'none';
            }, 5000);
        }

        // 重置服务器配置
        function resetServerConfig() {
            document.getElementById('server-url').value = 'ws://localhost:5555';
            document.getElementById('api-url').value = 'http://localhost:5555/api';
        }
        
        // 验证注册码
        async function validateRegistrationCode() {
            const code = document.getElementById('registration-code').value.trim();
            if (!code) {
                showRegistrationStatus('请输入注册码', 'error');
                return;
            }
            
            try {
                await window.electronAPI.setRegistrationCode(code);
                showRegistrationStatus('注册码验证成功', 'success');
                addLog('注册码验证成功', 'success');
            } catch (error) {
                showRegistrationStatus('注册码验证失败: ' + error.message, 'error');
                addLog('注册码验证失败: ' + error.message, 'error');
            }
        }
        
        // 生成注册码
        async function generateRegistrationCode() {
            try {
                const connectionInfo = await window.electronAPI.getConnectionInfo();
                const hostname = connectionInfo.hostname || 'unknown';
                const timestamp = Date.now();
                const code = 'TW-' + hostname.substring(0, 8).toUpperCase() + '-' + timestamp.toString(36).toUpperCase();
                
                document.getElementById('registration-code').value = code;
                showRegistrationStatus('已生成注册码，请复制并保存', 'info');
                addLog('已生成注册码: ' + code, 'info');
            } catch (error) {
                showRegistrationStatus('生成注册码失败: ' + error.message, 'error');
                addLog('生成注册码失败: ' + error.message, 'error');
            }
        }
        
        // 显示注册状态
        function showRegistrationStatus(message, type) {
            const statusDiv = document.getElementById('registration-status');
            const messageDiv = document.getElementById('status-message');
            
            statusDiv.style.display = 'block';
            statusDiv.style.background = type === 'success' ? '#1a3a1a' : 
                                       type === 'error' ? '#3a1a1a' : '#1a1a3a';
            statusDiv.style.border = type === 'success' ? '1px solid #00ff88' : 
                                   type === 'error' ? '1px solid #ff4444' : '1px solid #4444ff';
            
            messageDiv.style.color = type === 'success' ? '#00ff88' : 
                                   type === 'error' ? '#ff4444' : '#4444ff';
            messageDiv.textContent = message;
            
            // 3秒后自动隐藏
            setTimeout(() => {
                statusDiv.style.display = 'none';
            }, 3000);
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
            updateLogCount();
            
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

        // 定期更新事件统计
        setInterval(async () => {
            try {
                updateEventStats();
            } catch (error) {
                console.error('事件统计更新失败:', error);
            }
        }, 10000);

        // 定期更新防火墙统计
        setInterval(async () => {
            try {
                await updateFirewallStatistics();
            } catch (error) {
                console.error('防火墙统计更新失败:', error);
            }
        }, 10000); // 每10秒更新一次

        // 页面加载完成后初始化
        document.addEventListener('DOMContentLoaded', initialize);

        // ===== 系统日志相关函数 =====

        // 过滤日志
        function filterLogs() {
            const levelFilter = document.getElementById('log-level-filter').value;
            const searchFilter = document.getElementById('log-search-input').value.toLowerCase();
            const logEntries = document.querySelectorAll('.log-entry');
            
            logEntries.forEach(entry => {
                const message = entry.querySelector('.log-message').textContent.toLowerCase();
                const level = getLogLevel(entry);
                
                let show = true;
                
                // 按级别过滤
                if (levelFilter !== 'all' && level !== levelFilter) {
                    show = false;
                }
                
                // 按关键词过滤
                if (searchFilter && !message.includes(searchFilter)) {
                    show = false;
                }
                
                entry.style.display = show ? 'flex' : 'none';
            });
            
            updateLogCount();
        }

        // 获取日志级别
        function getLogLevel(logEntry) {
            const messageElement = logEntry.querySelector('.log-message');
            if (messageElement.classList.contains('log-error')) return 'error';
            if (messageElement.classList.contains('log-warning')) return 'warning';
            if (messageElement.classList.contains('log-success')) return 'success';
            return 'info';
        }

        // 清空日志
        function clearLogs() {
            const logsContainer = document.getElementById('logs-container');
            logsContainer.innerHTML = '';
            logCount = 0;
            document.getElementById('logs-count').textContent = '0 条';
            addLog('日志已清空', 'info');
        }

        // 导出日志
        function exportLogs() {
            try {
                const logsContainer = document.getElementById('logs-container');
                const logEntries = logsContainer.querySelectorAll('.log-entry');
                let logContent = 'TianWang Agent 系统日志\n';
                logContent += '导出时间: ' + new Date().toLocaleString('zh-CN') + '\n\n';
                
                logEntries.forEach(entry => {
                    const timestamp = entry.querySelector('.log-timestamp').textContent;
                    const message = entry.querySelector('.log-message').textContent;
                    logContent += timestamp + ' ' + message + '\n';
                });
                
                // 创建下载链接
                const blob = new Blob([logContent], { type: 'text/plain;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'tianwang-logs-' + new Date().toISOString().slice(0, 19).replace(/:/g, '-') + '.txt';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                
                addLog('日志已导出', 'success');
            } catch (error) {
                addLog('导出日志失败: ' + error.message, 'error');
            }
        }

        // 刷新日志
        function refreshLogs() {
            // 这里可以添加从后端获取最新日志的逻辑
            addLog('日志已刷新', 'info');
        }

        // 更新日志计数
        function updateLogCount() {
            const logEntries = document.querySelectorAll('.log-entry');
            const visibleLogs = Array.from(logEntries).filter(entry => {
                return entry.style.display !== 'none';
            }).length;
            const totalLogs = logEntries.length;
            
            if (visibleLogs === totalLogs) {
                document.getElementById('logs-count').textContent = \`\${totalLogs} 条\`;
            } else {
                document.getElementById('logs-count').textContent = \`\${visibleLogs}/\${totalLogs} 条\`;
            }
        }

        // ===== 事件列表相关函数 =====

        // 切换标签页
        function switchTab(tabName) {
            // 隐藏所有标签页内容
            document.querySelectorAll('.tab-content').forEach(tab => {
                tab.classList.remove('active');
            });
            
            // 移除所有标签页按钮的active状态
            document.querySelectorAll('.tab-button').forEach(btn => {
                btn.classList.remove('active');
            });
            
            // 显示选中的标签页
            document.getElementById(tabName + '-tab').classList.add('active');
            
            // 激活对应的按钮
            event.target.classList.add('active');
            
            // 如果切换到事件列表，加载事件数据
            if (tabName === 'events') {
                loadEvents();
                updateEventStats();
            }
            
            // 如果切换到系统日志，刷新日志数据
            if (tabName === 'logs') {
                refreshLogs();
            }
        }

        // 加载事件列表
        async function loadEvents() {
            try {
                const filters = getEventFilters();
                const result = await window.electronAPI.getEvents(filters);
                
                if (result.success) {
                    renderEvents(result.data);
                    updateEventTypeFilters();
                } else {
                    addLog('加载事件列表失败: ' + result.error, 'error');
                }
            } catch (error) {
                addLog('加载事件列表失败: ' + error.message, 'error');
            }
        }

        // 获取事件过滤器
        function getEventFilters() {
            return {
                type: document.getElementById('type-filter').value,
                level: document.getElementById('level-filter').value,
                status: document.getElementById('status-filter').value,
                search: document.getElementById('search-input').value,
                sortBy: 'timestamp-desc'
            };
        }

        // 渲染事件列表
        function renderEvents(events) {
            const eventsList = document.getElementById('events-list');
            eventsList.innerHTML = '';
            
            if (events.length === 0) {
                eventsList.innerHTML = '<div style="padding: 20px; text-align: center; color: #666666;">暂无事件</div>';
                return;
            }
            
            events.forEach(event => {
                const eventElement = createEventElement(event);
                eventsList.appendChild(eventElement);
            });
        }

        // 创建事件元素
        function createEventElement(event) {
            const eventDiv = document.createElement('div');
            eventDiv.className = 'event-item';
            eventDiv.id = 'event-' + event.id;
            
            const timestamp = new Date(event.timestamp).toLocaleString('zh-CN');
            
            eventDiv.innerHTML = \`
                <div class="event-header">
                    <div class="event-title">\${event.title}</div>
                    <div class="event-timestamp">\${timestamp}</div>
                </div>
                <div class="event-meta">
                    <span class="event-type">\${event.type}</span>
                    <span class="event-level \${event.level}">\${event.level}</span>
                    <span class="event-status \${event.status}">\${getStatusText(event.status)}</span>
                </div>
                <div class="event-description">\${event.description}</div>
                <div class="event-tags">
                    \${event.tags.map(tag => \`<span class="event-tag">\${tag}</span>\`).join('')}
                </div>
                <div class="event-actions">
                    <button class="event-action-btn" onclick="markEventFeedback('\${event.id}', '已处理')">标记已处理</button>
                    <button class="event-action-btn" onclick="markEventFeedback('\${event.id}', '忽略')">标记忽略</button>
                    <button class="event-action-btn" onclick="showEventDetails('\${event.id}')">查看详情</button>
                </div>
                \${event.feedback ? \`<div class="event-feedback">反馈: \${event.feedback}</div>\` : ''}
            \`;
            
            return eventDiv;
        }

        // 获取状态文本
        function getStatusText(status) {
            const statusMap = {
                'pending': '待处理',
                'sent': '已发送',
                'failed': '失败',
                'acknowledged': '已确认'
            };
            return statusMap[status] || status;
        }

        // 添加事件到列表
        function addEventToList(event) {
            const eventsList = document.getElementById('events-list');
            const eventElement = createEventElement(event);
            
            // 插入到列表开头
            if (eventsList.firstChild) {
                eventsList.insertBefore(eventElement, eventsList.firstChild);
            } else {
                eventsList.appendChild(eventElement);
            }
        }

        // 更新列表中的事件
        function updateEventInList(event) {
            const eventElement = document.getElementById('event-' + event.id);
            if (eventElement) {
                const newElement = createEventElement(event);
                eventElement.parentNode.replaceChild(newElement, eventElement);
            }
        }

        // 更新事件统计
        async function updateEventStats() {
            try {
                const result = await window.electronAPI.getEventStats();
                if (result.success) {
                    const stats = result.data;
                    document.getElementById('total-events').textContent = stats.total;
                    document.getElementById('today-events').textContent = stats.byDate.today;
                    document.getElementById('error-events').textContent = stats.byLevel.error || 0;
                    document.getElementById('pending-events').textContent = stats.byStatus.pending || 0;
                }
            } catch (error) {
                console.error('更新事件统计失败:', error);
            }
        }

        // 更新事件类型过滤器
        async function updateEventTypeFilters() {
            try {
                const result = await window.electronAPI.getEventFilters();
                if (result.success) {
                    const typeFilter = document.getElementById('type-filter');
                    const currentValue = typeFilter.value;
                    
                    // 清空现有选项（保留"所有类型"）
                    typeFilter.innerHTML = '<option value="all">所有类型</option>';
                    
                    // 添加事件类型选项
                    result.data.types.forEach(type => {
                        const option = document.createElement('option');
                        option.value = type;
                        option.textContent = type;
                        typeFilter.appendChild(option);
                    });
                    
                    // 恢复之前的选择
                    typeFilter.value = currentValue;
                }
            } catch (error) {
                console.error('更新事件类型过滤器失败:', error);
            }
        }

        // 过滤事件
        function filterEvents() {
            loadEvents();
        }

        // 标记事件反馈
        async function markEventFeedback(eventId, feedback) {
            try {
                const result = await window.electronAPI.markEventFeedback(eventId, feedback);
                if (result.success) {
                    addLog(\`事件反馈已标记: \${feedback}\`, 'success');
                } else {
                    addLog('标记事件反馈失败: ' + result.error, 'error');
                }
            } catch (error) {
                addLog('标记事件反馈失败: ' + error.message, 'error');
            }
        }

        // 显示事件详情
        function showEventDetails(eventId) {
            // TODO: 实现事件详情弹窗
            addLog('事件详情功能开发中...', 'info');
        }

        // 清理旧事件
        async function clearOldEvents() {
            if (confirm('确定要清理30天前的旧事件吗？')) {
                try {
                    const result = await window.electronAPI.clearOldEvents(30);
                    if (result.success) {
                        addLog(\`已清理 \${result.data.removedCount} 条旧事件\`, 'success');
                        loadEvents();
                        updateEventStats();
                    } else {
                        addLog('清理旧事件失败: ' + result.error, 'error');
                    }
                } catch (error) {
                    addLog('清理旧事件失败: ' + error.message, 'error');
                }
            }
        }

        // 导出事件
        async function exportEvents() {
            try {
                const result = await window.electronAPI.exportEvents('json');
                if (result.success) {
                    // 创建下载链接
                    const blob = new Blob([result.data], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = \`events_\${new Date().toISOString().split('T')[0]}.json\`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    
                    addLog('事件数据已导出', 'success');
                } else {
                    addLog('导出事件失败: ' + result.error, 'error');
                }
            } catch (error) {
                addLog('导出事件失败: ' + error.message, 'error');
            }
        }

        // 更新防火墙统计
        async function updateFirewallStatistics() {
            try {
                console.log('前端: 开始更新防火墙统计...');
                
                // 获取服务器规则统计
                console.log('前端: 调用getServerRuleStatistics...');
                const result = await window.electronAPI.getServerRuleStatistics();
                console.log('前端: 服务器规则统计结果:', result);
                
                if (result.success) {
                    const stats = result.data;
                    console.log('前端: 解析统计数据:', stats);
                    console.log('前端: 总规则数:', stats.total_rules);
                    
                    document.getElementById('firewall-rules').textContent = stats.total_rules || 0;
                    console.log('前端: 已更新防火墙规则显示为:', stats.total_rules || 0);
                    
                    // 阻止IP数量保持使用本地防火墙统计
                    console.log('前端: 获取本地防火墙统计...');
                    const localResult = await window.electronAPI.firewallGetStatistics();
                    console.log('前端: 本地防火墙统计结果:', localResult);
                    
                    if (localResult.success) {
                        document.getElementById('blocked-ips').textContent = localResult.data.blockedIPs || 0;
                        console.log('前端: 已更新阻止IP显示为:', localResult.data.blockedIPs || 0);
                    }
                } else {
                    console.error('前端: 获取服务器规则统计失败:', result.error);
                    // 如果服务器获取失败，使用本地防火墙统计作为备选
                    console.log('前端: 使用本地防火墙统计作为备选...');
                    const localResult = await window.electronAPI.firewallGetStatistics();
                    console.log('前端: 备选本地防火墙统计结果:', localResult);
                    
                    if (localResult.success) {
                        document.getElementById('firewall-rules').textContent = localResult.data.totalRules || 0;
                        document.getElementById('blocked-ips').textContent = localResult.data.blockedIPs || 0;
                        console.log('前端: 备选方案已更新显示');
                    }
                }
            } catch (error) {
                console.error('前端: 获取防火墙统计失败:', error);
                // 错误时显示0
                document.getElementById('firewall-rules').textContent = '0';
                document.getElementById('blocked-ips').textContent = '0';
                console.log('前端: 错误时显示0');
            }
        }
    </script>
</body>
</html>`;

fs.writeFileSync(path.join(buildDir, 'index.html'), htmlContent);

// 创建设置页面
const settingsHtmlContent = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TianWang Agent - 设置</title>
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
            margin-top: 28px;
        }

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

        .titlebar-title {
            font-size: 12px;
            color: #888888;
            font-weight: 500;
            margin-left: 80px;
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
            overflow-y: auto;
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

        .settings-container {
            padding: 30px;
            max-width: 800px;
        }

        .settings-section {
            background: #111111;
            border: 1px solid #333333;
            border-radius: 8px;
            margin-bottom: 20px;
            overflow: hidden;
        }

        .settings-section-header {
            padding: 20px;
            background: #1a1a1a;
            border-bottom: 1px solid #333333;
        }

        .settings-section-title {
            font-size: 18px;
            font-weight: 600;
            color: #ffffff;
            margin-bottom: 4px;
        }

        .settings-section-description {
            font-size: 14px;
            color: #888888;
        }

        .settings-section-content {
            padding: 20px;
        }

        .form-group {
            margin-bottom: 20px;
        }

        .form-label {
            display: block;
            font-size: 14px;
            font-weight: 500;
            color: #ffffff;
            margin-bottom: 8px;
        }

        .form-input {
            width: 100%;
            padding: 12px;
            background: #1a1a1a;
            border: 1px solid #333333;
            border-radius: 6px;
            color: #ffffff;
            font-size: 14px;
            transition: border-color 0.2s;
        }

        .form-input:focus {
            outline: none;
            border-color: #007AFF;
        }

        .button {
            padding: 12px 24px;
            border: none;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
            display: inline-flex;
            align-items: center;
            gap: 8px;
        }

        .button-primary {
            background: #007AFF;
            color: #ffffff;
        }

        .button-primary:hover {
            background: #0056CC;
        }

        .button-secondary {
            background: #333333;
            color: #ffffff;
        }

        .button-secondary:hover {
            background: #444444;
        }

        .button-group {
            display: flex;
            gap: 10px;
            margin-top: 20px;
        }

        .status-message {
            padding: 12px;
            border-radius: 6px;
            margin-bottom: 20px;
            font-size: 14px;
        }

        .status-message.success {
            background: #1C3A1C;
            border: 1px solid #2D5A2D;
            color: #4CAF50;
        }

        .status-message.error {
            background: #3A1C1C;
            border: 1px solid #5A2D2D;
            color: #FF3B30;
        }

        .status-message.info {
            background: #1C1C3A;
            border: 1px solid #2D2D5A;
            color: #007AFF;
        }

        .back-button {
            display: flex;
            align-items: center;
            padding: 12px 20px;
            color: #888888;
            text-decoration: none;
            font-size: 14px;
            transition: all 0.2s;
            border-bottom: 1px solid #333333;
            margin-bottom: 20px;
        }

        .back-button:hover {
            color: #ffffff;
            background: #1a1a1a;
        }

        .back-icon {
            width: 16px;
            height: 16px;
            margin-right: 8px;
        }
    </style>
</head>
<body>
    <div class="titlebar">
        <div class="titlebar-title">TianWang Agent - 设置</div>
    </div>

    <div class="app-container">
        <div class="sidebar">
            <a href="#" class="back-button" onclick="goBack()">
                <svg class="back-icon" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clip-rule="evenodd"></path>
                </svg>
                返回主界面
            </a>
        </div>

        <div class="main-content">
            <div class="header">
                <h1>服务器配置</h1>
                <p>配置代理端连接的服务器地址和端口</p>
            </div>

            <div class="settings-container">
                <div id="statusMessage" class="status-message" style="display: none;"></div>

                <div class="settings-section">
                    <div class="settings-section-header">
                        <div class="settings-section-title">连接设置</div>
                        <div class="settings-section-description">配置代理端连接的服务器地址和端口</div>
                    </div>
                    <div class="settings-section-content">
                        <div class="form-group">
                            <label class="form-label">WebSocket服务器地址</label>
                            <input type="text" id="serverUrl" class="form-input" placeholder="ws://localhost:5555">
                        </div>
                        <div class="form-group">
                            <label class="form-label">API服务器地址</label>
                            <input type="text" id="apiUrl" class="form-input" placeholder="http://localhost:5555/api">
                        </div>
                        <div class="button-group">
                            <button class="button button-primary" onclick="saveServerConfig()">保存配置</button>
                            <button class="button button-secondary" onclick="testConnection()">测试连接</button>
                            <button class="button button-secondary" onclick="resetServerConfig()">重置默认</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script>
        // 页面加载时初始化
        document.addEventListener('DOMContentLoaded', async function() {
            await loadServerConfig();
        });

        // 加载服务器配置
        async function loadServerConfig() {
            try {
                const config = await window.electronAPI.getServerConfig();
                if (config) {
                    document.getElementById('serverUrl').value = config.serverUrl || '';
                    document.getElementById('apiUrl').value = config.apiUrl || '';
                }
            } catch (error) {
                showStatusMessage('加载配置失败: ' + error.message, 'error');
            }
        }

        // 保存服务器配置
        async function saveServerConfig() {
            try {
                const config = {
                    serverUrl: document.getElementById('serverUrl').value.trim(),
                    apiUrl: document.getElementById('apiUrl').value.trim()
                };

                if (!config.serverUrl || !config.apiUrl) {
                    showStatusMessage('服务器地址不能为空', 'error');
                    return;
                }

                const result = await window.electronAPI.updateServerConfig(config);
                if (result.success) {
                    showStatusMessage('服务器配置已保存', 'success');
                } else {
                    showStatusMessage('保存失败: ' + result.error, 'error');
                }
            } catch (error) {
                showStatusMessage('保存配置失败: ' + error.message, 'error');
            }
        }

        // 重置服务器配置
        function resetServerConfig() {
            document.getElementById('serverUrl').value = 'ws://localhost:5555';
            document.getElementById('apiUrl').value = 'http://localhost:5555/api';
        }

        // 测试连接
        async function testConnection() {
            try {
                showStatusMessage('正在测试连接...', 'info');
                const result = await window.electronAPI.testServerConnection();
                if (result.success) {
                    showStatusMessage('连接成功: ' + result.message, 'success');
                } else {
                    showStatusMessage('连接失败: ' + result.message, 'error');
                }
            } catch (error) {
                showStatusMessage('连接测试失败: ' + error.message, 'error');
            }
        }

        // 显示状态消息
        function showStatusMessage(message, type) {
            const statusDiv = document.getElementById('statusMessage');
            statusDiv.textContent = message;
            statusDiv.className = \`status-message \${type}\`;
            statusDiv.style.display = 'block';

            setTimeout(() => {
                statusDiv.style.display = 'none';
            }, 3000);
        }

        // 返回主界面
        function goBack() {
            window.close();
        }
    </script>
</body>
</html>`;

fs.writeFileSync(path.join(buildDir, 'settings.html'), settingsHtmlContent);

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