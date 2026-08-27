const mockSocketHandlers: Record<string, (...args: unknown[]) => void> = {};
const mockSocket: {
  connected: boolean;
  on: jest.Mock;
  onAny: jest.Mock;
  emit: jest.Mock;
  disconnect: jest.Mock;
} = {
  connected: false,
  on: jest.fn((event: string, handler: (...args: unknown[]) => void) => {
    mockSocketHandlers[event] = handler;
  }),
  onAny: jest.fn(),
  emit: jest.fn(),
  disconnect: jest.fn(),
};

jest.mock('socket.io-client', () => ({ io: jest.fn() }));

import { authAPI, deviceAPI, WebSocketManager } from './api';
import { io } from 'socket.io-client';

const mockIo = io as jest.Mock;

describe('browser API and realtime contract', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    Object.keys(mockSocketHandlers).forEach(key => delete mockSocketHandlers[key]);
    mockSocket.connected = false;
    mockIo.mockReturnValue(mockSocket);
    global.fetch = jest.fn();
  });

  test('sends login credentials to the real API without inventing a local identity', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true, status: 200, json: async () => ({ accessToken: 'access-token' })
    });
    await authAPI.login({ username: 'admin', password: '123456' });
    expect(global.fetch).toHaveBeenCalledWith('/api/auth/login', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ username: 'admin', password: '123456' }),
      headers: { 'Content-Type': 'application/json' }
    }));
  });

  test('preserves authorization when a caller adds its own headers', async () => {
    localStorage.setItem('token', 'access-token');
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, status: 200, json: async () => ({ user: {} }) });
    await authAPI.getCurrentUser();
    expect(global.fetch).toHaveBeenCalledWith('/api/auth/me', expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer access-token' })
    }));
  });

  test('returns the server error message to the user', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false, status: 401, json: async () => ({ error: 'Invalid credentials' })
    });
    await expect(authAPI.login({ username: 'user', password: 'wrong-password' }))
      .rejects.toThrow('Invalid credentials');
  });

  test('serializes only meaningful device filters', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, status: 200, json: async () => [] });
    await deviceAPI.getDevices({ page: 2, platform: 'linux', search: '' });
    expect(global.fetch).toHaveBeenCalledWith('/api/devices?page=2&platform=linux', expect.any(Object));
  });

  test('uses the authenticated Socket.IO user channel, not the agent-only /ws channel', () => {
    localStorage.setItem('token', 'access-token');
    const manager = new WebSocketManager('https://control.example');
    expect(manager.connect()).toBe(true);
    expect(mockIo).toHaveBeenCalledWith('https://control.example', expect.objectContaining({
      auth: { token: 'access-token' }, transports: ['websocket']
    }));
    mockSocket.connected = true;
    expect(manager.send('subscribe-threats', { scope: 'mine' })).toBe(true);
    expect(mockSocket.emit).toHaveBeenCalledWith('subscribe-threats', { scope: 'mine' });
  });

  test('does not open a realtime channel before login', () => {
    const manager = new WebSocketManager();
    const onError = jest.fn();
    manager.on('error', onError);
    expect(manager.connect()).toBe(false);
    expect(mockIo).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
  });
});
