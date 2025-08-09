import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

export interface Device {
  id: string;
  name: string;
  type: 'windows' | 'linux' | 'macos' | 'openwrt';
  ip: string;
  status: 'online' | 'offline' | 'warning';
  lastSeen: string;
  version: string;
  organizationId: string;
  metadata?: Record<string, any>;
}

export interface DeviceState {
  devices: Device[];
  loading: boolean;
  error: string | null;
  selectedDevice: Device | null;
  filters: {
    type?: string;
    status?: string;
  };
}

const initialState: DeviceState = {
  devices: [],
  loading: false,
  error: null,
  selectedDevice: null,
  filters: {},
};

// 获取设备列表
export const fetchDevices = createAsyncThunk(
  'device/fetchDevices',
  async (_, { rejectWithValue, getState }) => {
    try {
      const state = getState() as { auth: { token: string } };
      const response = await fetch('/api/devices', {
        headers: {
          'Authorization': `Bearer ${state.auth.token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        return rejectWithValue(error.message || '获取设备列表失败');
      }

      return await response.json();
    } catch (error) {
      return rejectWithValue('网络错误，请稍后重试');
    }
  }
);

const deviceSlice = createSlice({
  name: 'device',
  initialState,
  reducers: {
    setFilters: (state, action) => {
      state.filters = action.payload;
    },
    setSelectedDevice: (state, action) => {
      state.selectedDevice = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
    updateDeviceStatus: (state, action) => {
      const { deviceId, status } = action.payload;
      const device = state.devices.find(d => d.id === deviceId);
      if (device) {
        device.status = status;
        device.lastSeen = new Date().toISOString();
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchDevices.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDevices.fulfilled, (state, action) => {
        state.loading = false;
        state.devices = action.payload;
      })
      .addCase(fetchDevices.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { setFilters, setSelectedDevice, clearError, updateDeviceStatus } = deviceSlice.actions;
export default deviceSlice.reducer; 