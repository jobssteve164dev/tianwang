import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { dashboardAPI } from '../../services/api';

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
  loading: boolean;
  error: string | null;
  lastUpdated: string | null;
}

const initialState: DashboardState = {
  metrics: null,
  loading: false,
  error: null,
  lastUpdated: null,
};

// 获取安全指标
export const fetchSecurityMetrics = createAsyncThunk(
  'dashboard/fetchSecurityMetrics',
  async (_, { rejectWithValue }) => {
    try {
      const data = await dashboardAPI.getSecurityMetrics();
      return data;
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
      const data = await dashboardAPI.getThreatTrends(timeRange);
      return data;
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
      const data = await dashboardAPI.getThreatDistribution();
      return data;
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
      const data = await dashboardAPI.getDeviceStats();
      return data;
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
        state.metrics = action.payload;
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
      .addCase(fetchThreatTrends.fulfilled, (state) => {
        state.loading = false;
        // 可以在这里处理威胁趋势数据
      })
      .addCase(fetchThreatTrends.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // 获取威胁分布
      .addCase(fetchThreatDistribution.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchThreatDistribution.fulfilled, (state) => {
        state.loading = false;
        // 可以在这里处理威胁分布数据
      })
      .addCase(fetchThreatDistribution.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // 获取设备统计
      .addCase(fetchDeviceStats.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchDeviceStats.fulfilled, (state) => {
        state.loading = false;
        // 可以在这里处理设备统计数据
      })
      .addCase(fetchDeviceStats.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearError, updateMetrics } = dashboardSlice.actions;
export default dashboardSlice.reducer; 