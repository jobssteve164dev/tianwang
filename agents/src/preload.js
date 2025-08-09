const { contextBridge, ipcRenderer } = require('electron');

// 暴露安全的API给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
    // 系统信息
    getSystemInfo: () => ipcRenderer.invoke('get-system-info'),
    
    // 配置管理
    getConfig: (key) => ipcRenderer.invoke('get-config', key),
    setConfig: (key, value) => ipcRenderer.invoke('set-config', key, value),
    
    // 监控控制
    startMonitoring: () => ipcRenderer.invoke('start-monitoring'),
    stopMonitoring: () => ipcRenderer.invoke('stop-monitoring'),
    getMonitoringStatus: () => ipcRenderer.invoke('get-monitoring-status'),
    
    // 防火墙控制
    firewallBlockIP: (ip, reason) => ipcRenderer.invoke('firewall-block-ip', ip, reason),
    firewallUnblockIP: (ip, reason) => ipcRenderer.invoke('firewall-unblock-ip', ip, reason),
    firewallGetBlockedIPs: () => ipcRenderer.invoke('firewall-get-blocked-ips'),
    firewallGetStatistics: () => ipcRenderer.invoke('firewall-get-statistics'),
    firewallEnableAutoBlock: () => ipcRenderer.invoke('firewall-enable-auto-block'),
    firewallDisableAutoBlock: () => ipcRenderer.invoke('firewall-disable-auto-block'),
    
    // 事件监听
    onSystemData: (callback) => {
        ipcRenderer.on('system-data', (event, data) => callback(data));
    },
    onNetworkData: (callback) => {
        ipcRenderer.on('network-data', (event, data) => callback(data));
    },
    onSecurityThreat: (callback) => {
        ipcRenderer.on('security-threat', (event, threat) => callback(threat));
    },
    onNavigate: (callback) => {
        ipcRenderer.on('navigate-to', (event, path) => callback(path));
    },
    onIPBlocked: (callback) => {
        ipcRenderer.on('ip-blocked', (event, data) => callback(data));
    },
    onIPUnblocked: (callback) => {
        ipcRenderer.on('ip-unblocked', (event, data) => callback(data));
    },
    
    // 移除监听器
    removeAllListeners: (channel) => {
        ipcRenderer.removeAllListeners(channel);
    }
});

// 版本信息
contextBridge.exposeInMainWorld('versions', {
    node: () => process.versions.node,
    chrome: () => process.versions.chrome,
    electron: () => process.versions.electron
}); 