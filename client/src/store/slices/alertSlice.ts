import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { alertAPI } from '../../services/api';

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
    search?: string;
    dateRange?: [string, string];
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
  async (params: any = {}, { rejectWithValue }) => {
    try {
      const data = await alertAPI.getAlerts(params);
      return data;
    } catch (error: any) {
      return rejectWithValue(error.message || '获取告警列表失败');
    }
  }
);

// 更新告警状态
export const updateAlertStatusAsync = createAsyncThunk(
  'alert/updateAlertStatus',
  async ({ alertId, status }: { alertId: string; status: 'active' | 'acknowledged' | 'resolved' }, { rejectWithValue }) => {
    try {
      await alertAPI.updateAlertStatus(alertId, status);
      return { alertId, status };
    } catch (error: any) {
      return rejectWithValue(error.message || '更新告警状态失败');
    }
  }
);

// 确认告警
export const acknowledgeAlert = createAsyncThunk(
  'alert/acknowledgeAlert',
  async (alertId: string, { rejectWithValue }) => {
    try {
      await alertAPI.acknowledgeAlert(alertId);
      return { alertId, status: 'acknowledged' as const };
    } catch (error: any) {
      return rejectWithValue(error.message || '确认告警失败');
    }
  }
);

// 解决告警
export const resolveAlert = createAsyncThunk(
  'alert/resolveAlert',
  async (alertId: string, { rejectWithValue }) => {
    try {
      await alertAPI.resolveAlert(alertId);
      return { alertId, status: 'resolved' as const };
    } catch (error: any) {
      return rejectWithValue(error.message || '解决告警失败');
    }
  }
);

const alertSlice = createSlice({
  name: 'alert',
  initialState,
  reducers: {
    setFilters: (state, action) => {
      state.filters = action.payload;
      state.pagination.current = 1; // 重置页码
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
    setPagination: (state, action) => {
      state.pagination = { ...state.pagination, ...action.payload };
    },
  },
  extraReducers: (builder) => {
    builder
      // 获取告警列表
      .addCase(fetchAlerts.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAlerts.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload.data) {
          state.alerts = action.payload.data;
          state.pagination.total = action.payload.total || action.payload.data.length;
        } else {
          // 如果返回的是数组格式
          state.alerts = Array.isArray(action.payload) ? action.payload : [];
          state.pagination.total = state.alerts.length;
        }
      })
      .addCase(fetchAlerts.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // 更新告警状态
      .addCase(updateAlertStatusAsync.fulfilled, (state, action) => {
        const { alertId, status } = action.payload;
        const alert = state.alerts.find(a => a.id === alertId);
        if (alert) {
          alert.status = status;
        }
      })
      .addCase(updateAlertStatusAsync.rejected, (state, action) => {
        state.error = action.payload as string;
      })
      // 确认告警
      .addCase(acknowledgeAlert.fulfilled, (state, action) => {
        const { alertId, status } = action.payload;
        const alert = state.alerts.find(a => a.id === alertId);
        if (alert) {
          alert.status = status;
        }
      })
      .addCase(acknowledgeAlert.rejected, (state, action) => {
        state.error = action.payload as string;
      })
      // 解决告警
      .addCase(resolveAlert.fulfilled, (state, action) => {
        const { alertId, status } = action.payload;
        const alert = state.alerts.find(a => a.id === alertId);
        if (alert) {
          alert.status = status;
        }
      })
      .addCase(resolveAlert.rejected, (state, action) => {
        state.error = action.payload as string;
      });
  },
});

export const { setFilters, clearError, updateAlertStatus, setPagination } = alertSlice.actions;
export default alertSlice.reducer; 