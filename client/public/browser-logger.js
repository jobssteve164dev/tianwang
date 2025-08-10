/**
 * 天网安全监控系统 - 浏览器日志收集器
 * TianWang Security System - Browser Log Collector
 * 
 * 功能：
 * - 拦截浏览器控制台的所有日志
 * - 通过WebSocket发送到日志收集服务器
 * - 支持错误堆栈信息收集
 */

(function() {
    'use strict';
    
    // 配置
    const WS_URL = 'ws://localhost:8889';
    const CLIENT_ID = 'browser-' + Date.now();
    
    let ws = null;
    let isConnected = false;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;
    const reconnectDelay = 2000;
    
    // 原始控制台方法
    const originalConsole = {
        log: console.log,
        info: console.info,
        warn: console.warn,
        error: console.error,
        debug: console.debug
    };
    
    /**
     * 连接到WebSocket服务器
     */
    function connect() {
        try {
            ws = new WebSocket(WS_URL);
            
            ws.onopen = function() {
                isConnected = true;
                reconnectAttempts = 0;
                originalConsole.log('[Browser Logger] 已连接到日志服务器');
                
                // 发送客户端信息
                sendLog('INFO', '浏览器日志收集器已启动', {
                    userAgent: navigator.userAgent,
                    url: window.location.href,
                    timestamp: new Date().toISOString()
                });
            };
            
            ws.onclose = function() {
                isConnected = false;
                originalConsole.log('[Browser Logger] 与日志服务器断开连接');
                
                // 尝试重连
                if (reconnectAttempts < maxReconnectAttempts) {
                    reconnectAttempts++;
                    setTimeout(connect, reconnectDelay);
                }
            };
            
            ws.onerror = function(error) {
                originalConsole.error('[Browser Logger] WebSocket错误:', error);
            };
            
        } catch (error) {
            originalConsole.error('[Browser Logger] 连接失败:', error);
        }
    }
    
    /**
     * 发送日志到服务器
     */
    function sendLog(level, message, extra = {}) {
        if (!isConnected || !ws) return;
        
        try {
            const logData = {
                level: level,
                message: message,
                timestamp: new Date().toISOString(),
                url: window.location.href,
                userAgent: navigator.userAgent,
                ...extra
            };
            
            ws.send(JSON.stringify(logData));
        } catch (error) {
            originalConsole.error('[Browser Logger] 发送日志失败:', error);
        }
    }
    
    /**
     * 获取错误堆栈信息
     */
    function getStackTrace() {
        try {
            throw new Error();
        } catch (error) {
            return error.stack;
        }
    }
    
    /**
     * 拦截控制台方法
     */
    function interceptConsole() {
        // 拦截 console.log
        console.log = function(...args) {
            originalConsole.log.apply(console, args);
            sendLog('INFO', args.map(arg => 
                typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
            ).join(' '));
        };
        
        // 拦截 console.info
        console.info = function(...args) {
            originalConsole.info.apply(console, args);
            sendLog('INFO', args.map(arg => 
                typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
            ).join(' '));
        };
        
        // 拦截 console.warn
        console.warn = function(...args) {
            originalConsole.warn.apply(console, args);
            sendLog('WARNING', args.map(arg => 
                typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
            ).join(' '));
        };
        
        // 拦截 console.error
        console.error = function(...args) {
            originalConsole.error.apply(console, args);
            sendLog('ERROR', args.map(arg => 
                typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
            ).join(' '), {
                stack: getStackTrace()
            });
        };
        
        // 拦截 console.debug
        console.debug = function(...args) {
            originalConsole.debug.apply(console, args);
            sendLog('DEBUG', args.map(arg => 
                typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
            ).join(' '));
        };
    }
    
    /**
     * 拦截全局错误
     */
    function interceptGlobalErrors() {
        // 拦截 JavaScript 错误
        window.addEventListener('error', function(event) {
            sendLog('ERROR', `JavaScript错误: ${event.message}`, {
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                stack: event.error ? event.error.stack : null
            });
        });
        
        // 拦截未处理的 Promise 拒绝
        window.addEventListener('unhandledrejection', function(event) {
            sendLog('ERROR', `未处理的Promise拒绝: ${event.reason}`, {
                stack: event.reason && event.reason.stack ? event.reason.stack : null
            });
        });
        
        // 拦截资源加载错误
        window.addEventListener('error', function(event) {
            if (event.target && event.target.tagName) {
                sendLog('ERROR', `资源加载失败: ${event.target.src || event.target.href}`, {
                    tagName: event.target.tagName,
                    src: event.target.src,
                    href: event.target.href
                });
            }
        }, true);
    }
    
    /**
     * 拦截网络请求
     */
    function interceptNetworkRequests() {
        // 拦截 fetch 请求
        const originalFetch = window.fetch;
        window.fetch = function(...args) {
            const startTime = Date.now();
            const url = args[0];
            
            return originalFetch.apply(this, args)
                .then(response => {
                    const duration = Date.now() - startTime;
                    if (!response.ok) {
                        sendLog('WARNING', `HTTP请求失败: ${response.status} ${response.statusText}`, {
                            url: url,
                            status: response.status,
                            duration: duration
                        });
                    }
                    return response;
                })
                .catch(error => {
                    const duration = Date.now() - startTime;
                    sendLog('ERROR', `网络请求错误: ${error.message}`, {
                        url: url,
                        duration: duration,
                        stack: error.stack
                    });
                    throw error;
                });
        };
        
        // 拦截 XMLHttpRequest
        const originalXHROpen = XMLHttpRequest.prototype.open;
        const originalXHRSend = XMLHttpRequest.prototype.send;
        
        XMLHttpRequest.prototype.open = function(method, url, ...args) {
            this._logUrl = url;
            this._logMethod = method;
            this._logStartTime = Date.now();
            return originalXHROpen.apply(this, [method, url, ...args]);
        };
        
        XMLHttpRequest.prototype.send = function(...args) {
            const xhr = this;
            const originalOnReadyStateChange = xhr.onreadystatechange;
            
            xhr.onreadystatechange = function() {
                if (xhr.readyState === 4) {
                    const duration = Date.now() - xhr._logStartTime;
                    if (xhr.status >= 400) {
                        sendLog('WARNING', `XHR请求失败: ${xhr.status} ${xhr.statusText}`, {
                            url: xhr._logUrl,
                            method: xhr._logMethod,
                            status: xhr.status,
                            duration: duration
                        });
                    }
                }
                
                if (originalOnReadyStateChange) {
                    originalOnReadyStateChange.apply(xhr, args);
                }
            };
            
            return originalXHRSend.apply(this, args);
        };
    }
    
    /**
     * 初始化日志收集器
     */
    function init() {
        // 等待页面加载完成
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', startLogger);
        } else {
            startLogger();
        }
    }
    
    /**
     * 启动日志收集器
     */
    function startLogger() {
        try {
            // 连接WebSocket
            connect();
            
            // 拦截控制台
            interceptConsole();
            
            // 拦截全局错误
            interceptGlobalErrors();
            
            // 拦截网络请求
            interceptNetworkRequests();
            
            // 发送启动日志
            setTimeout(() => {
                sendLog('INFO', '浏览器日志收集器初始化完成');
            }, 1000);
            
        } catch (error) {
            originalConsole.error('[Browser Logger] 初始化失败:', error);
        }
    }
    
    // 启动日志收集器
    init();
    
    // 暴露到全局对象，方便调试
    window.browserLogger = {
        sendLog: sendLog,
        isConnected: () => isConnected,
        reconnect: connect
    };
    
})();
