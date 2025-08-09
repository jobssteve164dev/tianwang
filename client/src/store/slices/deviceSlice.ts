import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { deviceAPI } from '../../services/api';

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
    search?: string;
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
  async (params: { type?: string; status?: string; search?: string } = {}, { rejectWithValue }) => {
    try {
      const data = await deviceAPI.getDevices(params);
      return Array.isArray(data) ? data : data.devices || [];
    } catch (error: any) {
      return rejectWithValue(error.message || '获取设备列表失败');
    }
  }
);

// 获取单个设备详情
export const fetchDeviceById = createAsyncThunk(
  'device/fetchDeviceById',
  async (deviceId: string, { rejectWithValue }) => {
    try {
      const data = await deviceAPI.getDeviceById(deviceId);
      return data;
    } catch (error: any) {
      return rejectWithValue(error.message || '获取设备详情失败');
    }
  }
);

// 控制设备
export const controlDevice = createAsyncThunk(
  'device/controlDevice',
  async ({ deviceId, action }: { deviceId: string; action: 'start' | 'stop' | 'restart' }, { rejectWithValue }) => {
    try {
      await deviceAPI.controlDevice(deviceId, action);
      return { deviceId, action };
    } catch (error: any) {
      return rejectWithValue(error.message || '设备控制失败');
    }
  }
);

// 删除设备
export const deleteDevice = createAsyncThunk(
  'device/deleteDevice',
  async (deviceId: string, { rejectWithValue }) => {
    try {
      await deviceAPI.deleteDevice(deviceId);
      return deviceId;
    } catch (error: any) {
      return rejectWithValue(error.message || '删除设备失败');
    }
  }
);

// 更新设备信息
export const updateDevice = createAsyncThunk(
  'device/updateDevice',
  async ({ deviceId, data }: { deviceId: string; data: Partial<Device> }, { rejectWithValue }) => {
    try {
      const updatedDevice = await deviceAPI.updateDevice(deviceId, data);
      return updatedDevice;
    } catch (error: any) {
      return rejectWithValue(error.message || '更新设备失败');
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
    clearSelectedDevice: (state) => {
      state.selectedDevice = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // 获取设备列表
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
      })
      // 获取设备详情
      .addCase(fetchDeviceById.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchDeviceById.fulfilled, (state, action) => {
        state.loading = false;
        state.selectedDevice = action.payload;
      })
      .addCase(fetchDeviceById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // 控制设备
      .addCase(controlDevice.fulfilled, (state, action) => {
        const { deviceId, action: deviceAction } = action.payload;
        const device = state.devices.find(d => d.id === deviceId);
        if (device) {
          // 根据操作类型更新设备状态
          if (deviceAction === 'start') {
            device.status = 'online';
          } else if (deviceAction === 'stop') {
            device.status = 'offline';
          }
          device.lastSeen = new Date().toISOString();
        }
      })
      .addCase(controlDevice.rejected, (state, action) => {
        state.error = action.payload as string;
      })
      // 删除设备
      .addCase(deleteDevice.fulfilled, (state, action) => {
        const deviceId = action.payload;
        state.devices = state.devices.filter(d => d.id !== deviceId);
        if (state.selectedDevice?.id === deviceId) {
          state.selectedDevice = null;
        }
      })
      .addCase(deleteDevice.rejected, (state, action) => {
        state.error = action.payload as string;
      })
      // 更新设备
      .addCase(updateDevice.fulfilled, (state, action) => {
        const updatedDevice = action.payload;
        const index = state.devices.findIndex(d => d.id === updatedDevice.id);
        if (index !== -1) {
          state.devices[index] = updatedDevice;
        }
        if (state.selectedDevice?.id === updatedDevice.id) {
          state.selectedDevice = updatedDevice;
        }
      })
      .addCase(updateDevice.rejected, (state, action) => {
        state.error = action.payload as string;
      });
  },
});

export const { 
  setFilters, 
  setSelectedDevice, 
  clearError, 
  updateDeviceStatus, 
  clearSelectedDevice 
} = deviceSlice.actions;
export default deviceSlice.reducer; 