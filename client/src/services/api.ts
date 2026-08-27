import { io, Socket } from 'socket.io-client';

// API服务层 - 统一管理所有API调用

// eslint-disable-next-line no-undef
const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';

// 获取token的函数 - 避免循环依赖
const getAuthToken = () => {
  const token = localStorage.getItem('token');
  return token;
};

// 通用请求函数
const request = async (endpoint: string, options: RequestInit = {}) => {
  const token = getAuthToken();
  const { headers = {}, ...requestOptions } = options;

  const config: RequestInit = {
    ...requestOptions,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...headers,
    },
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, config);

  if (!response.ok) {
    let errorData;
    try {
      errorData = await response.json();
    } catch {
      errorData = { message: '网络错误' };
    }

    const errorMessage = errorData.message || errorData.error || `HTTP Error: ${response.status}`;
    throw new Error(errorMessage);
  }

  if (response.status === 204) return null;
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

  getThreatIPs: async () => {
    return request('/dashboard/threat-ips');
  },

  getNetworkAttacks: async () => {
    return request('/dashboard/network-attacks');
  },

  getSuspiciousActivities: async () => {
    return request('/dashboard/suspicious-activities');
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
    page?: number;
    limit?: number;
    type?: string;
    status?: string;
    search?: string;
    platform?: string;
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
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  deleteDevice: async (id: string) => {
    return request(`/devices/${id}`, {
      method: 'DELETE',
    });
  },

  getDeviceStats: async () => {
    return request('/devices/stats/overview');
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
  private socket: Socket | null = null;
  private url?: string;
  private listeners: { [key: string]: Function[] } = {};

  constructor(url?: string) {
    this.url = url;
  }

  connect() {
    try {
      const token = getAuthToken();
      if (!token) {
        this.emit('error', new Error('用户尚未登录'));
        return false;
      }

      this.disconnect();
      this.socket = io(this.url, {
        auth: { token },
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 3000,
      });

      this.socket.on('connect', () => {
        this.emit('connected');
      });
      this.socket.on('disconnect', reason => {
        this.emit('disconnected', reason);
      });
      this.socket.on('connect_error', error => {
        this.emit('error', error);
      });
      this.socket.onAny((event, payload) => {
        if (!['connect', 'disconnect', 'connect_error'].includes(event)) {
          this.emit(event, payload);
        }
      });
      return true;
    } catch (error) {
      this.emit('error', error);
      return false;
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.emit('disconnected', 'client disconnect');
    }
  }

  send(type: string, payload: unknown) {
    if (this.socket?.connected) {
      this.socket.emit(type, payload);
      return true;
    }
    return false;
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

  private emit(event: string, data?: unknown) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => callback(data));
    }
  }
}

// 导出WebSocket实例
export const wsManager = new WebSocketManager();

// 注册码管理API - 仅限管理端访问
export const registrationCodeApi = {
  generateRegistrationCode: (data: any) => request('/admin/registration-codes', {
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
    return request(`/admin/registration-codes?${queryString.toString()}`);
  },
  getRegistrationCodeStats: () => request('/admin/registration-codes/stats'),
  disableRegistrationCode: (code: string) => request(`/admin/registration-codes/${code}`, {
    method: 'DELETE',
  }),
  extendRegistrationCode: (code: string, additionalExpiry: number) =>
    request(`/admin/registration-codes/${code}/extend`, {
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

  // 自定义规则管理
  getCustomRules: () => request('/security/rules/custom'),
  getCustomRule: (id: string) => request(`/security/rules/custom/${id}`),
  createCustomRule: (data: any) => request('/security/rules/custom', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  updateCustomRule: (id: string, data: any) => request(`/security/rules/custom/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  deleteCustomRule: (id: string) => request(`/security/rules/custom/${id}`, {
    method: 'DELETE',
  }),
  testCustomRule: (id: string, data: { test_data: any }) => request(`/security/rules/custom/${id}/test`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),
};

// 通知配置管理API
export const notificationApi = {
  getConfig: () => request('/notifications/config'),
  updateConfig: (config: any) => request('/notifications/config', {
    method: 'PUT',
    body: JSON.stringify(config),
  }),
  sendTestNotification: (data: { type: string; recipient: string }) =>
    request('/notifications/test', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getStatus: () => request('/notifications/status'),
};

// AI模型配置管理API
export const aiModelApi = {
  getConfig: () => request('/system/ai-model/config'),
  updateConfig: (config: any) => request('/system/ai-model/config', {
    method: 'PUT',
    body: JSON.stringify(config),
  }),
  getUsageStats: () => request('/system/ai-model/usage-stats'),
  testConnection: (data: { provider: string; api_key: string; model?: string }) =>
    request('/system/ai-model/test-connection', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// 本地AI模型管理API
export const localAIModelApi = {
  // 获取所有模型状态
  getModelStatus: () => request('/system/ai-models/status'),

  // 获取特定模型状态
  getModelStatusByName: (modelName: string) => request(`/system/ai-models/${modelName}/status`),

  // 训练模型
  trainModel: (data: { model_name: string; training_data?: any[] }) =>
    request('/system/ai-models/train', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // 获取训练状态
  getTrainingStatus: (taskId: string) => request(`/system/ai-models/training/${taskId}/status`),

  // 测试模型
  testModel: (data: { model_name: string; test_data: any }) =>
    request('/system/ai-models/test', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // 训练数据管理
  uploadTrainingData: (data: { model_name: string; data_type: string; data: any[] }) =>
    request('/system/ai-models/training-data', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getTrainingDataList: (params?: { model_name?: string; page?: number; limit?: number }) => {
    const queryString = params ? `?${new URLSearchParams(params as any).toString()}` : '';
    return request(`/system/ai-models/training-data${queryString}`);
  },

  getTrainingDataDetail: (dataId: string) => request(`/system/ai-models/training-data/${dataId}`),

  deleteTrainingData: (dataId: string) =>
    request(`/system/ai-models/training-data/${dataId}`, {
      method: 'DELETE',
    }),

  exportTrainingData: (params?: { model_name?: string; data_type?: string; format?: string }) => {
    const queryString = params ? `?${new URLSearchParams(params as any).toString()}` : '';
    return request(`/system/ai-models/training-data/export${queryString}`);
  },

  // 性能监控
  getModelPerformance: (modelName?: string) => {
    const queryString = modelName ? `?model_name=${modelName}` : '';
    return request(`/system/ai-models/performance${queryString}`);
  },

  getPerformanceHistory: (params?: { model_name?: string; days?: number }) => {
    const queryString = params ? `?${new URLSearchParams(params as any).toString()}` : '';
    return request(`/system/ai-models/performance/history${queryString}`);
  },

  getSystemPerformanceOverview: () => request('/system/ai-models/performance/overview'),

  // 资源管理
  getResourceList: () => request('/system/ai-models/resources'),

  downloadResource: (data: { resource_id: string; category: string; model_name?: string }) =>
    request('/system/ai-models/resources/download', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  deleteResource: (resourceId: string) =>
    request(`/system/ai-models/resources/${resourceId}`, {
      method: 'DELETE',
    }),

  // 模型管理
  getLoadedModels: () => request('/system/ai-models/loaded-models'),

  toggleModel: (data: { model_id: string; status: 'active' | 'inactive' }) =>
    request('/system/ai-models/toggle-model', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  reloadModel: (modelId: string) =>
    request(`/system/ai-models/reload-model/${modelId}`, {
      method: 'POST',
    }),
};

// 威胁情报配置管理API
export const threatIntelligenceApi = {
  getConfig: () => request('/threat-intelligence/config'),
  updateConfig: (data: any) => request('/threat-intelligence/config', {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  testConnection: (source: 'misp' | 'otx') => request(`/threat-intelligence/test/${source}`, {
    method: 'POST',
  }),
  getStatus: () => request('/threat-intelligence/status'),
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
  notification: notificationApi,
  aiModel: aiModelApi,
  threatIntelligence: threatIntelligenceApi,
};
