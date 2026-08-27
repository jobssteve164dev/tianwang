import { configureStore } from '@reduxjs/toolkit';
import reducer, { fetchUserProfile, loginAsync, logout } from './authSlice';

const makeStore = () => configureStore({ reducer: { auth: reducer } });

describe('auth state uses only server-issued identities', () => {
  beforeEach(() => {
    localStorage.clear();
    global.fetch = jest.fn();
  });

  test('even former demo credentials must be authenticated by the server', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        user: { id: 'user-1', username: 'admin', email: 'admin@example.com', role: 'admin' },
        accessToken: 'server-access-token',
        refreshToken: 'server-refresh-token'
      })
    });
    const store = makeStore();
    await store.dispatch(loginAsync({ username: 'admin', password: '123456' }));
    expect(global.fetch).toHaveBeenCalledWith('/api/auth/login', expect.any(Object));
    expect(store.getState().auth).toMatchObject({
      isAuthenticated: true, token: 'server-access-token', user: { id: 'user-1' }
    });
    expect(localStorage.getItem('token')).toBe('server-access-token');
  });

  test('restores a user through /auth/me and unwraps the response envelope', async () => {
    localStorage.setItem('token', 'access-token');
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ user: { id: 'user-1', username: 'analyst', email: 'a@example.com', role: 'analyst' } })
    });
    const store = makeStore();
    store.dispatch({ type: 'auth/setToken', payload: 'access-token' });
    await store.dispatch(fetchUserProfile());
    expect(global.fetch).toHaveBeenCalledWith('/api/auth/me', expect.objectContaining({
      headers: { Authorization: 'Bearer access-token' }
    }));
    expect(store.getState().auth.user?.username).toBe('analyst');
  });

  test('failed profile restoration clears an unusable token', async () => {
    localStorage.setItem('token', 'expired-token');
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false, json: async () => ({ message: 'Token expired' })
    });
    const store = makeStore();
    store.dispatch({ type: 'auth/setToken', payload: 'expired-token' });
    await store.dispatch(fetchUserProfile());
    expect(store.getState().auth).toMatchObject({ isAuthenticated: false, token: null, error: 'Token expired' });
    expect(localStorage.getItem('token')).toBeNull();
  });

  test('logout clears both memory and persistent credentials', () => {
    localStorage.setItem('token', 'access-token');
    const state = reducer({
      user: { id: '1', username: 'u', email: 'u@example.com', role: 'viewer' },
      token: 'access-token', isAuthenticated: true, loading: false, error: null
    }, logout());
    expect(state).toMatchObject({ user: null, token: null, isAuthenticated: false });
    expect(localStorage.getItem('token')).toBeNull();
  });
});
