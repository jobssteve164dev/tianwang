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

// 异步登录action
export const loginAsync = createAsyncThunk(
  'auth/login',
  async (credentials: { username: string; password: string }, { rejectWithValue }) => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });

      if (!response.ok) {
        const error = await response.json();
        const messages: Record<string, string> = {
          INVALID_CREDENTIALS: '用户名或密码不正确，请重新输入',
          ACCOUNT_LOCKED: '登录尝试过多，请稍后再试',
          ACCOUNT_INACTIVE: '账户已停用，请联系管理员',
          DB_UNAVAILABLE: '登录服务暂时不可用，请稍后重试',
        };
        return rejectWithValue(messages[error.code] || (response.status === 429
          ? '登录尝试过多，请稍后再试' : '暂时无法登录，请稍后重试'));
      }

      const data = await response.json();
      localStorage.setItem('token', data.accessToken);
      return { user: data.user, token: data.accessToken };
    } catch (error) {
      return rejectWithValue('网络错误，请稍后重试');
    }
  }
);

export const logoutAsync = createAsyncThunk(
  'auth/logoutSession',
  async (_, { dispatch, getState, rejectWithValue }) => {
    const token = (getState() as { auth: AuthState }).auth.token;
    try {
      if (token) {
        const response = await fetch('/api/auth/logout', {
          method: 'POST', headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok && response.status !== 401) {
          return rejectWithValue('退出登录失败，请重试');
        }
      }
      dispatch(logout());
    } catch {
      return rejectWithValue('网络连接失败，请重试退出登录');
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

      // 真实API调用
      const response = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        return rejectWithValue(error.message || '获取用户信息失败');
      }

      const data = await response.json();
      return data.user;
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
      });
  },
});

export const { logout, clearError, setToken } = authSlice.actions;
export default authSlice.reducer;
