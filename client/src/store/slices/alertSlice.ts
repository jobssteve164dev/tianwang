import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

export interface Alert {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  source: string;
  timestamp: string;
  status: 'active' | 'acknowledged' | 'resolved';
  deviceId?: string;
}

export interface AlertState {
  alerts: Alert[];
  loading: boolean;
  error: string | null;
  filters: {
    severity?: string;
    status?: string;
    type?: string;
  };
  pagination: {
    current: number;
    pageSize: number;
    total: number;
  };
}

const initialState: AlertState = {
  alerts: [],
  loading: false,
  error: null,
  filters: {},
  pagination: {
    current: 1,
    pageSize: 20,
    total: 0,
  },
};

// 获取告警列表
export const fetchAlerts = createAsyncThunk(
  'alert/fetchAlerts',
  async (params: any, { rejectWithValue, getState }) => {
    try {
      const state = getState() as { auth: { token: string } };
      const queryParams = new URLSearchParams(params);
      const response = await fetch(`/api/alerts?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${state.auth.token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        return rejectWithValue(error.message || '获取告警列表失败');
      }

      return await response.json();
    } catch (error) {
      return rejectWithValue('网络错误，请稍后重试');
    }
  }
);

const alertSlice = createSlice({
  name: 'alert',
  initialState,
  reducers: {
    setFilters: (state, action) => {
      state.filters = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
    updateAlertStatus: (state, action) => {
      const { alertId, status } = action.payload;
      const alert = state.alerts.find(a => a.id === alertId);
      if (alert) {
        alert.status = status;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAlerts.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAlerts.fulfilled, (state, action) => {
        state.loading = false;
        state.alerts = action.payload.data;
        state.pagination.total = action.payload.total;
      })
      .addCase(fetchAlerts.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { setFilters, clearError, updateAlertStatus } = alertSlice.actions;
export default alertSlice.reducer; 