import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

export interface Device {
  id: string;
  name: string;
  hostname?: string;
  ip_address?: string;
  ip?: string; // 兼容旧版本
  mac_address?: string;
  platform?: string;
  type?: 'windows' | 'linux' | 'macos' | 'openwrt'; // 兼容旧版本
  status: 'online' | 'offline' | 'error';
  last_seen_at?: string;
  lastSeen?: string; // 兼容旧版本
  agent_version?: string;
  version?: string; // 兼容旧版本
  organizationId?: string;
  metadata?: Record<string, any>;
  capabilities?: {
    log_collection: boolean;
    network_monitoring: boolean;
    process_monitoring: boolean;
  };
  os?: string;
  architecture?: string;
  registered_at?: string;
  hardware_info?: {
    cpu: any;
    memory: any;
    disk: any[];
  };
  network_info?: {
    interfaces: any[];
  };
  system_info?: any;
}

export interface DeviceState {
  devices: Device[];
  loading: boolean;
  error: string | null;
  selectedDevice: Device | null;
  filters: {
    type?: string;
    status?: string;
    search?: string;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  stats: {
    total: number;
    online: number;
    offline: number;
    error: number;
    onlineRate: number;
  };
}

const initialState: DeviceState = {
  devices: [],
  loading: false,
  error: null,
  selectedDevice: null,
  filters: {},
  pagination: {
    page: 1,
    limit: 20,
    total: 0,
    pages: 0,
  },
  stats: {
    total: 0,
    online: 0,
    offline: 0,
    error: 0,
    onlineRate: 0,
  },
};

// 获取设备列表
export const fetchDevices = createAsyncThunk(
  'device/fetchDevices',
  async (params: { 
    page?: number; 
    limit?: number;
    type?: string; 
    status?: string; 
    search?: string; 
    platform?: string;
  } = {}, { rejectWithValue }) => {
    try {
      const token = localStorage.getItem('token');
      const queryString = new URLSearchParams();
      
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryString.append(key, String(value));
        }
      });

      const response = await fetch(`/api/devices?${queryString.toString()}`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: '网络错误' }));
        throw new Error(error.message || `HTTP Error: ${response.status}`);
      }

      const data = await response.json();
      
      // 处理新的API响应格式
      if (data.success && data.data) {
        return {
          devices: data.data,
          pagination: data.pagination || {
            page: 1,
            limit: 20,
            total: data.count || 0,
            pages: 1,
          },
        };
      } else if (Array.isArray(data)) {
        return {
          devices: data,
          pagination: {
            page: 1,
            limit: 20,
            total: data.length,
            pages: 1,
          },
        };
      } else {
        return {
          devices: [],
          pagination: {
            page: 1,
            limit: 20,
            total: 0,
            pages: 0,
          },
        };
      }
    } catch (error: any) {
      return rejectWithValue(error.message || '获取设备列表失败');
    }
  }
);

// 获取单个设备详情
export const fetchDeviceById = createAsyncThunk(
  'device/fetchDeviceById',
  async (id: string, { rejectWithValue }) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/devices/${id}`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: '网络错误' }));
        throw new Error(error.message || `HTTP Error: ${response.status}`);
      }

      const data = await response.json();
      return data.success ? data.data : null;
    } catch (error: any) {
      return rejectWithValue(error.message || '获取设备详情失败');
    }
  }
);

// 删除设备
export const deleteDevice = createAsyncThunk(
  'device/deleteDevice',
  async (id: string, { rejectWithValue }) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/devices/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: '网络错误' }));
        throw new Error(error.message || `HTTP Error: ${response.status}`);
      }

      const data = await response.json();
      return { id, success: data.success };
    } catch (error: any) {
      return rejectWithValue(error.message || '删除设备失败');
    }
  }
);

// 更新设备
export const updateDevice = createAsyncThunk(
  'device/updateDevice',
  async ({ id, data }: { id: string; data: Partial<Device> }, { rejectWithValue }) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/devices/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: '网络错误' }));
        throw new Error(error.message || `HTTP Error: ${response.status}`);
      }

      const responseData = await response.json();
      return responseData.success ? responseData.data : null;
    } catch (error: any) {
      return rejectWithValue(error.message || '更新设备失败');
    }
  }
);

// 获取设备统计信息
export const fetchDeviceStats = createAsyncThunk(
  'device/fetchDeviceStats',
  async (_, { rejectWithValue }) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/devices/stats/overview', {
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: '网络错误' }));
        throw new Error(error.message || `HTTP Error: ${response.status}`);
      }

      const data = await response.json();
      return data.success ? data.data.overview : null;
    } catch (error: any) {
      return rejectWithValue(error.message || '获取设备统计失败');
    }
  }
);

const deviceSlice = createSlice({
  name: 'device',
  initialState,
  reducers: {
    setFilters: (state, action) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    setSelectedDevice: (state, action) => {
      state.selectedDevice = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
    setPagination: (state, action) => {
      state.pagination = { ...state.pagination, ...action.payload };
    },
  },
  extraReducers: (builder) => {
    builder
      // fetchDevices
      .addCase(fetchDevices.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDevices.fulfilled, (state, action) => {
        state.loading = false;
        state.devices = action.payload.devices;
        state.pagination = action.payload.pagination;
      })
      .addCase(fetchDevices.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // fetchDeviceById
      .addCase(fetchDeviceById.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDeviceById.fulfilled, (state, action) => {
        state.loading = false;
        state.selectedDevice = action.payload;
      })
      .addCase(fetchDeviceById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // deleteDevice
      .addCase(deleteDevice.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteDevice.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload.success) {
          state.devices = state.devices.filter(device => device.id !== action.payload.id);
          state.pagination.total -= 1;
        }
      })
      .addCase(deleteDevice.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // updateDevice
      .addCase(updateDevice.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateDevice.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload) {
          const index = state.devices.findIndex(device => device.id === action.payload.id);
          if (index !== -1) {
            state.devices[index] = { ...state.devices[index], ...action.payload };
          }
          if (state.selectedDevice?.id === action.payload.id) {
            state.selectedDevice = { ...state.selectedDevice, ...action.payload };
          }
        }
      })
      .addCase(updateDevice.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // fetchDeviceStats
      .addCase(fetchDeviceStats.pending, (state) => {
        state.error = null;
      })
      .addCase(fetchDeviceStats.fulfilled, (state, action) => {
        if (action.payload) {
          state.stats = action.payload;
        }
      })
      .addCase(fetchDeviceStats.rejected, (state, action) => {
        state.error = action.payload as string;
      });
  },
});

export const { setFilters, setSelectedDevice, clearError, setPagination } = deviceSlice.actions;
export default deviceSlice.reducer; 