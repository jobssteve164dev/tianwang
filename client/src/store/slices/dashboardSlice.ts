import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

export interface SecurityMetrics {
  totalThreats: number;
  activeAlerts: number;
  connectedDevices: number;
  threatTrend: number;
  systemHealth: 'healthy' | 'warning' | 'critical';
  lastUpdated: string;
}

export interface DashboardState {
  metrics: SecurityMetrics | null;
  threatTrends: any | null;
  threatDistribution: any | null;
  deviceStats: any | null;
  loading: boolean;
  error: string | null;
  lastUpdated: string | null;
}

const initialState: DashboardState = {
  metrics: null,
  threatTrends: null,
  threatDistribution: null,
  deviceStats: null,
  loading: false,
  error: null,
  lastUpdated: null,
};

// 获取安全指标
export const fetchSecurityMetrics = createAsyncThunk(
  'dashboard/fetchSecurityMetrics',
  async (_, { rejectWithValue }) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/dashboard/security-metrics', {
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: '网络错误' }));
        throw new Error(error.message || `HTTP Error: ${response.status}`);
      }

      return response.json();
    } catch (error: any) {
      return rejectWithValue(error.message || '获取安全指标失败');
    }
  }
);

// 获取威胁趋势数据
export const fetchThreatTrends = createAsyncThunk(
  'dashboard/fetchThreatTrends',
  async (timeRange: string = '7d', { rejectWithValue }) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/dashboard/threat-trends?range=${timeRange}`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: '网络错误' }));
        throw new Error(error.message || `HTTP Error: ${response.status}`);
      }

      return response.json();
    } catch (error: any) {
      return rejectWithValue(error.message || '获取威胁趋势失败');
    }
  }
);

// 获取威胁类型分布
export const fetchThreatDistribution = createAsyncThunk(
  'dashboard/fetchThreatDistribution',
  async (_, { rejectWithValue }) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/dashboard/threat-distribution', {
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: '网络错误' }));
        throw new Error(error.message || `HTTP Error: ${response.status}`);
      }

      return response.json();
    } catch (error: any) {
      return rejectWithValue(error.message || '获取威胁分布失败');
    }
  }
);

// 获取设备统计
export const fetchDeviceStats = createAsyncThunk(
  'dashboard/fetchDeviceStats',
  async (_, { rejectWithValue }) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/dashboard/device-stats', {
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: '网络错误' }));
        throw new Error(error.message || `HTTP Error: ${response.status}`);
      }

      return response.json();
    } catch (error: any) {
      return rejectWithValue(error.message || '获取设备统计失败');
    }
  }
);

const dashboardSlice = createSlice({
  name: 'dashboard',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    updateMetrics: (state, action) => {
      state.metrics = { ...state.metrics, ...action.payload };
      state.lastUpdated = new Date().toISOString();
    },
  },
  extraReducers: (builder) => {
    builder
      // 获取安全指标
      .addCase(fetchSecurityMetrics.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchSecurityMetrics.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload.success && action.payload.data) {
          state.metrics = action.payload.data;
        } else {
          state.metrics = action.payload;
        }
        state.lastUpdated = new Date().toISOString();
      })
      .addCase(fetchSecurityMetrics.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // 获取威胁趋势
      .addCase(fetchThreatTrends.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchThreatTrends.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload.success && action.payload.data) {
          state.threatTrends = action.payload.data;
        } else {
          state.threatTrends = action.payload;
        }
      })
      .addCase(fetchThreatTrends.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // 获取威胁分布
      .addCase(fetchThreatDistribution.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchThreatDistribution.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload.success && action.payload.data) {
          state.threatDistribution = action.payload.data;
        } else {
          state.threatDistribution = action.payload;
        }
      })
      .addCase(fetchThreatDistribution.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // 获取设备统计
      .addCase(fetchDeviceStats.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchDeviceStats.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload.success && action.payload.data) {
          state.deviceStats = action.payload.data;
        } else {
          state.deviceStats = action.payload;
        }
      })
      .addCase(fetchDeviceStats.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearError, updateMetrics } = dashboardSlice.actions;
export default dashboardSlice.reducer; 