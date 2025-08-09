import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

export interface SecurityMetrics {
  totalThreats: number;
  activeAlerts: number;
  connectedDevices: number;
  threatsTrend: Array<{ time: string; count: number }>;
  threatTypes: Array<{ type: string; count: number }>;
  deviceStatus: Array<{ status: string; count: number }>;
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
  'dashboard/fetchMetrics',
  async (_, { rejectWithValue, getState }) => {
    try {
      const state = getState() as { auth: { token: string } };
      const response = await fetch('/api/dashboard/metrics', {
        headers: {
          'Authorization': `Bearer ${state.auth.token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        return rejectWithValue(error.message || '获取安全指标失败');
      }

      return await response.json();
    } catch (error) {
      return rejectWithValue('网络错误，请稍后重试');
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
      state.metrics = action.payload;
      state.lastUpdated = new Date().toISOString();
    },
  },
  extraReducers: (builder) => {
    builder
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
      });
  },
});

export const { clearError, updateMetrics } = dashboardSlice.actions;
export default dashboardSlice.reducer; 