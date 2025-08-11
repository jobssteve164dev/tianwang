// API服务层 - 统一管理所有API调用

// eslint-disable-next-line no-undef
const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';

// 获取token的函数 - 避免循环依赖
const getAuthToken = () => {
  const token = localStorage.getItem('token');
  return token;
};

// 通用请求函数
const request = async (endpoint: string, options: any = {}) => {
  const token = getAuthToken();

  const config: any = {
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
    ...options,
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, config);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: '网络错误' }));
    throw new Error(error.message || `HTTP Error: ${response.status}`);
  }

  return response.json();
};

// 认证相关API
export const authAPI = {
  login: async (credentials: { username: string; password: string }) => {
    return request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  },

  logout: async () => {
    return request('/auth/logout', {
      method: 'POST',
    });
  },

  refreshToken: async () => {
    return request('/auth/refresh', {
      method: 'POST',
    });
  },

  getCurrentUser: async () => {
    return request('/auth/me');
  },
};

// 仪表盘相关API
export const dashboardAPI = {
  getSecurityMetrics: async () => {
    return request('/dashboard/security-metrics');
  },

  getThreatTrends: async (timeRange: string = '7d') => {
    return request(`/dashboard/threat-trends?range=${timeRange}`);
  },

  getThreatDistribution: async () => {
    return request('/dashboard/threat-distribution');
  },

  getDeviceStats: async () => {
    return request('/dashboard/device-stats');
  },
};

// 告警相关API
export const alertAPI = {
  getAlerts: async (params: {
    page?: number;
    pageSize?: number;
    severity?: string;
    status?: string;
    type?: string;
    search?: string;
    dateRange?: [string, string];
  } = {}) => {
    const queryString = new URLSearchParams();
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        if (Array.isArray(value)) {
          queryString.append(key, value.join(','));
        } else {
          queryString.append(key, String(value));
        }
      }
    });

    return request(`/alerts?${queryString.toString()}`);
  },

  getAlertById: async (id: string) => {
    return request(`/alerts/${id}`);
  },

  updateAlertStatus: async (id: string, status: string) => {
    return request(`/alerts/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },

  acknowledgeAlert: async (id: string) => {
    return request(`/alerts/${id}/acknowledge`, {
      method: 'POST',
    });
  },

  resolveAlert: async (id: string) => {
    return request(`/alerts/${id}/resolve`, {
      method: 'POST',
    });
  },

  deleteAlert: async (id: string) => {
    return request(`/alerts/${id}`, {
      method: 'DELETE',
    });
  },
};

// 设备相关API
export const deviceAPI = {
  getDevices: async (params: {
    type?: string;
    status?: string;
    search?: string;
  } = {}) => {
    const queryString = new URLSearchParams();
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        queryString.append(key, String(value));
      }
    });

    return request(`/devices?${queryString.toString()}`);
  },

  getDeviceById: async (id: string) => {
    return request(`/devices/${id}`);
  },

  updateDevice: async (id: string, data: Partial<any>) => {
    return request(`/devices/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  deleteDevice: async (id: string) => {
    return request(`/devices/${id}`, {
      method: 'DELETE',
    });
  },

  controlDevice: async (id: string, action: 'start' | 'stop' | 'restart') => {
    return request(`/devices/${id}/control`, {
      method: 'POST',
      body: JSON.stringify({ action }),
    });
  },

  getDeviceMetrics: async (id: string, timeRange: string = '1h') => {
    return request(`/devices/${id}/metrics?range=${timeRange}`);
  },

  getDeviceLogs: async (id: string, params: {
    page?: number;
    pageSize?: number;
    level?: string;
  } = {}) => {
    const queryString = new URLSearchParams();
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        queryString.append(key, String(value));
      }
    });

    return request(`/devices/${id}/logs?${queryString.toString()}`);
  },
};

// 用户管理相关API
export const userAPI = {
  getUsers: async (params: {
    page?: number;
    pageSize?: number;
    search?: string;
    role?: string;
  } = {}) => {
    const queryString = new URLSearchParams();
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        queryString.append(key, String(value));
      }
    });

    return request(`/users?${queryString.toString()}`);
  },

  createUser: async (userData: any) => {
    return request('/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  },

  updateUser: async (id: string, userData: Partial<any>) => {
    return request(`/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(userData),
    });
  },

  deleteUser: async (id: string) => {
    return request(`/users/${id}`, {
      method: 'DELETE',
    });
  },
};

// 系统配置相关API
export const systemAPI = {
  getSystemInfo: async () => {
    return request('/system/info');
  },

  getSystemHealth: async () => {
    return request('/system/health');
  },

  getSystemLogs: async (params: {
    page?: number;
    pageSize?: number;
    level?: string;
    service?: string;
  } = {}) => {
    const queryString = new URLSearchParams();
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        queryString.append(key, String(value));
      }
    });

    return request(`/system/logs?${queryString.toString()}`);
  },

  updateSystemConfig: async (config: any) => {
    return request('/system/config', {
      method: 'PUT',
      body: JSON.stringify(config),
    });
  },
};

// WebSocket连接管理
export class WebSocketManager {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectInterval = 3000;
  private listeners: { [key: string]: Function[] } = {};

  constructor(url?: string) {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.host;
    this.url = url || `${wsProtocol}//${wsHost}/ws`;
  }

  connect() {
    try {
      const token = getAuthToken();
      
      this.ws = new WebSocket(`${this.url}?token=${token}`);
      
      this.ws.onopen = () => {
        console.log('WebSocket连接已建立');
        this.reconnectAttempts = 0;
        this.emit('connected');
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.emit(data.type, data.payload);
        } catch (error) {
          console.error('WebSocket消息解析失败:', error);
        }
      };

      this.ws.onclose = () => {
        console.log('WebSocket连接已关闭');
        this.emit('disconnected');
        this.reconnect();
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket错误:', error);
        this.emit('error', error);
      };
    } catch (error) {
      console.error('WebSocket连接失败:', error);
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  send(type: string, payload: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, payload }));
    }
  }

  on(event: string, callback: Function) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  off(event: string, callback: Function) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    }
  }

  private emit(event: string, data?: any) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => callback(data));
    }
  }

  private reconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`尝试重连WebSocket (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      
      setTimeout(() => {
        this.connect();
      }, this.reconnectInterval);
    } else {
      console.error('WebSocket重连失败，已达到最大重试次数');
    }
  }
}

// 导出WebSocket实例
export const wsManager = new WebSocketManager();

// 注册码管理API
export const registrationCodeApi = {
  generateRegistrationCode: (data: any) => request('/agents/registration-codes', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  getRegistrationCodes: (params?: any) => {
    const queryString = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryString.append(key, String(value));
        }
      });
    }
    return request(`/agents/registration-codes?${queryString.toString()}`);
  },
  getRegistrationCodeStats: () => request('/agents/registration-codes/stats'),
  disableRegistrationCode: (code: string) => request(`/agents/registration-codes/${code}`, {
    method: 'DELETE',
  }),
  extendRegistrationCode: (code: string, additionalExpiry: number) => 
    request(`/agents/registration-codes/${code}/extend`, {
      method: 'PATCH',
      body: JSON.stringify({ additionalExpiry }),
    }),
  getSecurityStatus: () => request('/agents/security-status'),
};

// 安全规则管理API
export const securityRulesApi = {
  getRuleSources: () => request('/security/rules/sources'),
  getRuleStatistics: () => request('/security/rules/statistics'),
  updateRules: (data?: { source_type?: string; source_name?: string }) => 
    request('/security/rules/update', {
      method: 'POST',
      body: JSON.stringify(data || {}),
    }),
  getRuleStatus: () => request('/security/rules/status'),
};

// 默认导出所有API
export default {
  auth: authAPI,
  dashboard: dashboardAPI,
  alert: alertAPI,
  device: deviceAPI,
  user: userAPI,
  system: systemAPI,
  registrationCode: registrationCodeApi,
  securityRules: securityRulesApi,
}; 