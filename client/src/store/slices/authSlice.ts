import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';

export interface User {
  id: string;
  username: string;
  email: string;
  role: string;
  organizationId?: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  token: localStorage.getItem('token'),
  isAuthenticated: false,
  loading: false,
  error: null,
};

// 内置测试用户数据
const DEMO_USER: User = {
  id: '1',
  username: 'admin',
  email: 'admin@tianwang.com',
  role: 'admin',
  organizationId: '1',
};

// 异步登录action
export const loginAsync = createAsyncThunk(
  'auth/login',
  async (credentials: { username: string; password: string }, { rejectWithValue }) => {
    try {
      // 内置测试账户验证
      if (credentials.username === 'admin' && credentials.password === '123456') {
        const mockToken = 'demo-token-' + Date.now();
        localStorage.setItem('token', mockToken);
        
        return {
          user: DEMO_USER,
          token: mockToken,
        };
      }

      // 如果不是测试账户，尝试真实API调用
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });

      if (!response.ok) {
        const error = await response.json();
        return rejectWithValue(error.message || '登录失败');
      }

      const data = await response.json();
      localStorage.setItem('token', data.token);
      return data;
    } catch (error) {
      return rejectWithValue('网络错误，请稍后重试');
    }
  }
);

// 异步获取用户信息
export const fetchUserProfile = createAsyncThunk(
  'auth/fetchProfile',
  async (_, { rejectWithValue, getState }) => {
    try {
      const state = getState() as { auth: AuthState };
      const token = state.auth.token;

      if (!token) {
        return rejectWithValue('未找到认证令牌');
      }

      // 如果是演示token，直接返回演示用户
      if (token.startsWith('demo-token-')) {
        return DEMO_USER;
      }

      // 真实API调用
      const response = await fetch('/api/auth/profile', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        return rejectWithValue(error.message || '获取用户信息失败');
      }

      return await response.json();
    } catch (error) {
      return rejectWithValue('网络错误，请稍后重试');
    }
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      state.error = null;
      localStorage.removeItem('token');
    },
    clearError: (state) => {
      state.error = null;
    },
    setToken: (state, action: PayloadAction<string>) => {
      state.token = action.payload;
      localStorage.setItem('token', action.payload);
    },
  },
  extraReducers: (builder) => {
    builder
      // 登录
      .addCase(loginAsync.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginAsync.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.isAuthenticated = true;
        state.error = null;
      })
      .addCase(loginAsync.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
        state.isAuthenticated = false;
      })
      // 获取用户信息
      .addCase(fetchUserProfile.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchUserProfile.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload;
        state.isAuthenticated = true;
      })
      .addCase(fetchUserProfile.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
        state.isAuthenticated = false;
        state.token = null;
        localStorage.removeItem('token');
      })
      // 自动登录演示账户
      .addCase(autoLoginDemo.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(autoLoginDemo.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.isAuthenticated = true;
        state.error = null;
      })
      .addCase(autoLoginDemo.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
        state.isAuthenticated = false;
      });
  },
});

// 自动登录演示账户
export const autoLoginDemo = createAsyncThunk(
  'auth/autoLoginDemo',
  async () => {
    const mockToken = 'demo-token-' + Date.now();
    localStorage.setItem('token', mockToken);
    
    return {
      user: DEMO_USER,
      token: mockToken,
    };
  }
);

export const { logout, clearError, setToken } = authSlice.actions;
export default authSlice.reducer; 