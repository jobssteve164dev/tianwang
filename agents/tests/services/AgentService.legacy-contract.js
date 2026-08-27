// Historical pre-registration-code contract retained as a migration reference.
const AgentService = require('../../src/services/AgentService');
const WebSocket = require('ws');
const axios = require('axios');
const crypto = require('crypto');

// Mock dependencies
jest.mock('ws');
jest.mock('axios');
jest.mock('crypto');
jest.mock('../../src/utils/logger');

const logger = require('../../src/utils/logger');

describe('AgentService', () => {
    let agentService;
    let mockWebSocket;

    beforeEach(() => {
        agentService = new AgentService();

        // Mock WebSocket
        mockWebSocket = {
            on: jest.fn(),
            send: jest.fn(),
            close: jest.fn(),
            readyState: WebSocket.OPEN,
            OPEN: WebSocket.OPEN,
            CLOSED: WebSocket.CLOSED
        };

        WebSocket.mockImplementation(() => mockWebSocket);

        // Mock logger methods
        logger.info = jest.fn();
        logger.error = jest.fn();
        logger.warn = jest.fn();
        logger.debug = jest.fn();

        // Mock crypto
        crypto.randomBytes = jest.fn().mockReturnValue(Buffer.from('test-random-bytes'));
        crypto.createHash = jest.fn().mockReturnValue({
            update: jest.fn().mockReturnThis(),
            digest: jest.fn().mockReturnValue('test-hash')
        });

        // Clear all mocks
        jest.clearAllMocks();
    });

    afterEach(() => {
        if (agentService) {
            agentService.removeAllListeners();
        }
    });

    describe('initialize', () => {
        it('should initialize agent service with default config', async () => {
            const result = await agentService.initialize();

            expect(result).toBe(true);
            expect(agentService.config).toHaveProperty('serverUrl');
            expect(agentService.config).toHaveProperty('reconnectInterval', 30000);
            expect(agentService.config).toHaveProperty('maxReconnectAttempts', 10);
            expect(logger.info).toHaveBeenCalledWith('代理服务初始化成功');
        });

        it('should initialize with custom config', async () => {
            const customConfig = {
                serverUrl: 'ws://custom.server.com:8080/ws',
                reconnectInterval: 60000,
                maxReconnectAttempts: 5,
                agentId: 'custom-agent-id'
            };

            const result = await agentService.initialize(customConfig);

            expect(result).toBe(true);
            expect(agentService.config.serverUrl).toBe('ws://custom.server.com:8080/ws');
            expect(agentService.config.reconnectInterval).toBe(60000);
            expect(agentService.config.maxReconnectAttempts).toBe(5);
            expect(agentService.agentId).toBe('custom-agent-id');
        });

        it('should generate agent ID if not provided', async () => {
            await agentService.initialize();

            expect(agentService.agentId).toBeDefined();
            expect(agentService.agentId).toMatch(/^agent_/);
        });
    });

    describe('register', () => {
        beforeEach(async () => {
            await agentService.initialize();
        });

        it('should register agent successfully', async () => {
            const mockResponse = {
                data: {
                    success: true,
                    agentId: 'registered-agent-id',
                    message: '代理注册成功'
                }
            };

            axios.post.mockResolvedValue(mockResponse);

            const result = await agentService.register();

            expect(result).toBe(true);
            expect(agentService.agentId).toBe('registered-agent-id');
            expect(axios.post).toHaveBeenCalledWith(
                expect.stringContaining('/api/agents/register'),
                expect.objectContaining({
                    hostname: expect.any(String),
                    platform: expect.any(String),
                    version: expect.any(String),
                    publicKey: expect.any(String)
                })
            );
            expect(logger.info).toHaveBeenCalledWith('代理注册成功:', 'registered-agent-id');
        });

        it('should handle registration failure', async () => {
            const mockResponse = {
                data: {
                    success: false,
                    message: '注册失败'
                }
            };

            axios.post.mockResolvedValue(mockResponse);

            const result = await agentService.register();

            expect(result).toBe(false);
            expect(logger.error).toHaveBeenCalledWith('代理注册失败:', '注册失败');
        });

        it('should handle network errors', async () => {
            axios.post.mockRejectedValue(new Error('Network error'));

            const result = await agentService.register();

            expect(result).toBe(false);
            expect(logger.error).toHaveBeenCalledWith('代理注册请求失败:', expect.any(Error));
        });
    });

    describe('authenticate', () => {
        beforeEach(async () => {
            await agentService.initialize();
            agentService.agentId = 'test-agent-id';
        });

        it('should authenticate successfully', async () => {
            const mockResponse = {
                data: {
                    success: true,
                    token: 'test-jwt-token',
                    message: '认证成功'
                }
            };

            axios.post.mockResolvedValue(mockResponse);

            const result = await agentService.authenticate();

            expect(result).toBe(true);
            expect(agentService.authToken).toBe('test-jwt-token');
            expect(axios.post).toHaveBeenCalledWith(
                expect.stringContaining('/api/agents/auth'),
                expect.objectContaining({
                    agentId: 'test-agent-id',
                    hostname: expect.any(String)
                })
            );
            expect(logger.info).toHaveBeenCalledWith('代理认证成功');
        });

        it('should handle authentication failure', async () => {
            const mockResponse = {
                data: {
                    success: false,
                    message: '认证失败'
                }
            };

            axios.post.mockResolvedValue(mockResponse);

            const result = await agentService.authenticate();

            expect(result).toBe(false);
            expect(agentService.authToken).toBeNull();
            expect(logger.error).toHaveBeenCalledWith('代理认证失败:', '认证失败');
        });

        it('should require agent ID for authentication', async () => {
            agentService.agentId = null;

            const result = await agentService.authenticate();

            expect(result).toBe(false);
            expect(logger.error).toHaveBeenCalledWith('代理ID不存在，请先注册');
        });

        it('should handle network errors', async () => {
            axios.post.mockRejectedValue(new Error('Network error'));

            const result = await agentService.authenticate();

            expect(result).toBe(false);
            expect(logger.error).toHaveBeenCalledWith('代理认证请求失败:', expect.any(Error));
        });
    });

    describe('connect', () => {
        beforeEach(async () => {
            await agentService.initialize();
            agentService.agentId = 'test-agent-id';
            agentService.authToken = 'test-jwt-token';
        });

        it('should establish WebSocket connection successfully', async () => {
            const connectPromise = agentService.connect();

            // Simulate successful connection
            const openCallback = mockWebSocket.on.mock.calls.find(call => call[0] === 'open')[1];
            openCallback();

            const result = await connectPromise;

            expect(result).toBe(true);
            expect(agentService.isConnected).toBe(true);
            expect(agentService.reconnectAttempts).toBe(0);
            expect(WebSocket).toHaveBeenCalledWith(
                expect.stringContaining('test-agent-id?token=test-jwt-token')
            );
            expect(logger.info).toHaveBeenCalledWith('WebSocket连接已建立');
        });

        it('should require auth token for connection', async () => {
            agentService.authToken = null;

            await expect(agentService.connect()).rejects.toThrow('未获取到认证token，请先注册代理');
        });

        it('should handle connection errors', async () => {
            const connectPromise = agentService.connect();

            // Simulate connection error
            const errorCallback = mockWebSocket.on.mock.calls.find(call => call[0] === 'error')[1];
            errorCallback(new Error('Connection failed'));

            await expect(connectPromise).rejects.toThrow('Connection failed');
            expect(agentService.isConnected).toBe(false);
        });

        it('should handle connection timeout', async () => {
            jest.useFakeTimers();

            const connectPromise = agentService.connect();

            // Fast forward past timeout
            jest.advanceTimersByTime(10000);

            await expect(connectPromise).rejects.toThrow('连接超时');

            jest.useRealTimers();
        });

        it('should start heartbeat after connection', async () => {
            agentService.startHeartbeat = jest.fn();

            const connectPromise = agentService.connect();

            const openCallback = mockWebSocket.on.mock.calls.find(call => call[0] === 'open')[1];
            openCallback();

            await connectPromise;

            expect(agentService.startHeartbeat).toHaveBeenCalled();
        });

        it('should flush data buffer after connection', async () => {
            agentService.flushDataBuffer = jest.fn();

            const connectPromise = agentService.connect();

            const openCallback = mockWebSocket.on.mock.calls.find(call => call[0] === 'open')[1];
            openCallback();

            await connectPromise;

            expect(agentService.flushDataBuffer).toHaveBeenCalled();
        });
    });

    describe('message handling', () => {
        beforeEach(async () => {
            await agentService.initialize();
            agentService.agentId = 'test-agent-id';
            agentService.authToken = 'test-jwt-token';
            agentService.isConnected = true;
            agentService.ws = mockWebSocket;
        });

        it('should handle incoming messages', () => {
            const testMessage = {
                type: 'command',
                command: 'status',
                data: { request: 'get_status' }
            };

            agentService.handleMessage = jest.fn();

            const messageCallback = mockWebSocket.on.mock.calls.find(call => call[0] === 'message')[1];
            messageCallback(JSON.stringify(testMessage));

            expect(agentService.handleMessage).toHaveBeenCalledWith(testMessage);
        });

        it('should handle malformed JSON messages', () => {
            const messageCallback = mockWebSocket.on.mock.calls.find(call => call[0] === 'message')[1];
            messageCallback('invalid json');

            expect(logger.error).toHaveBeenCalledWith('处理消息失败:', expect.any(Error));
        });

        it('should handle connection close', () => {
            agentService.stopHeartbeat = jest.fn();
            agentService.scheduleReconnect = jest.fn();

            const closeCallback = mockWebSocket.on.mock.calls.find(call => call[0] === 'close')[1];
            closeCallback(1006, 'Connection lost');

            expect(agentService.isConnected).toBe(false);
            expect(agentService.stopHeartbeat).toHaveBeenCalled();
            expect(agentService.scheduleReconnect).toHaveBeenCalled();
            expect(logger.warn).toHaveBeenCalledWith('WebSocket连接已关闭', expect.any(Object));
        });

        it('should not reconnect on normal close', () => {
            agentService.scheduleReconnect = jest.fn();

            const closeCallback = mockWebSocket.on.mock.calls.find(call => call[0] === 'close')[1];
            closeCallback(1000, 'Normal close');

            expect(agentService.scheduleReconnect).not.toHaveBeenCalled();
        });
    });

    describe('sendData', () => {
        beforeEach(async () => {
            await agentService.initialize();
            agentService.isConnected = true;
            agentService.ws = mockWebSocket;
        });

        it('should send data when connected', () => {
            const testData = { cpu: 50, memory: 80 };

            agentService.sendData('system', testData);

            expect(mockWebSocket.send).toHaveBeenCalledWith(
                JSON.stringify({
                    type: 'data',
                    dataType: 'system',
                    data: testData,
                    timestamp: expect.any(Number),
                    agentId: expect.any(String)
                })
            );
        });

        it('should buffer data when disconnected', () => {
            agentService.isConnected = false;
            agentService.ws = null;

            const testData = { cpu: 50, memory: 80 };

            agentService.sendData('system', testData);

            expect(agentService.dataBuffer).toHaveLength(1);
            expect(agentService.dataBuffer[0]).toMatchObject({
                type: 'data',
                dataType: 'system',
                data: testData
            });
            expect(logger.debug).toHaveBeenCalledWith('连接断开，数据已缓存');
        });

        it('should limit buffer size', () => {
            agentService.isConnected = false;
            agentService.ws = null;
            agentService.config.maxBufferSize = 2;

            // Fill buffer beyond limit
            agentService.sendData('system', { data: 1 });
            agentService.sendData('system', { data: 2 });
            agentService.sendData('system', { data: 3 });

            expect(agentService.dataBuffer).toHaveLength(2);
            expect(agentService.dataBuffer[0].data).toEqual({ data: 2 });
            expect(agentService.dataBuffer[1].data).toEqual({ data: 3 });
            expect(logger.warn).toHaveBeenCalledWith('数据缓冲区已满，丢弃最旧的数据');
        });

        it('should handle send errors', () => {
            mockWebSocket.send.mockImplementation(() => {
                throw new Error('Send failed');
            });

            const testData = { cpu: 50, memory: 80 };

            agentService.sendData('system', testData);

            expect(logger.error).toHaveBeenCalledWith('发送数据失败:', expect.any(Error));
        });
    });

    describe('heartbeat', () => {
        beforeEach(async () => {
            await agentService.initialize();
            agentService.isConnected = true;
            agentService.ws = mockWebSocket;
        });

        it('should start heartbeat', () => {
            jest.useFakeTimers();
            agentService.config.heartbeatInterval = 1000;

            agentService.startHeartbeat();

            expect(agentService.heartbeatTimer).toBeDefined();

            // Fast forward and check if heartbeat is sent
            jest.advanceTimersByTime(1000);

            expect(mockWebSocket.send).toHaveBeenCalledWith(
                JSON.stringify({
                    type: 'heartbeat',
                    timestamp: expect.any(Number),
                    agentId: expect.any(String)
                })
            );

            jest.useRealTimers();
        });

        it('should stop heartbeat', () => {
            agentService.heartbeatTimer = setTimeout(() => {}, 1000);

            agentService.stopHeartbeat();

            expect(agentService.heartbeatTimer).toBeNull();
        });

        it('should handle heartbeat send errors', () => {
            jest.useFakeTimers();
            mockWebSocket.send.mockImplementation(() => {
                throw new Error('Send failed');
            });

            agentService.startHeartbeat();
            jest.advanceTimersByTime(30000);

            expect(logger.error).toHaveBeenCalledWith('发送心跳失败:', expect.any(Error));

            jest.useRealTimers();
        });
    });

    describe('reconnection', () => {
        beforeEach(async () => {
            await agentService.initialize();
            agentService.agentId = 'test-agent-id';
            agentService.authToken = 'test-jwt-token';
        });

        it('should schedule reconnection', () => {
            jest.useFakeTimers();
            agentService.connect = jest.fn();

            agentService.scheduleReconnect();

            expect(agentService.reconnectTimer).toBeDefined();

            jest.advanceTimersByTime(30000);

            expect(agentService.connect).toHaveBeenCalled();

            jest.useRealTimers();
        });

        it('should stop reconnection after max attempts', () => {
            agentService.reconnectAttempts = 10;
            agentService.config.maxReconnectAttempts = 10;

            agentService.scheduleReconnect();

            expect(agentService.reconnectTimer).toBeNull();
            expect(logger.error).toHaveBeenCalledWith('达到最大重连次数，停止重连');
        });

        it('should not reconnect if already connected', () => {
            jest.useFakeTimers();
            agentService.isConnected = true;
            agentService.connect = jest.fn();

            agentService.scheduleReconnect();
            jest.advanceTimersByTime(30000);

            expect(agentService.connect).not.toHaveBeenCalled();

            jest.useRealTimers();
        });
    });

    describe('data buffer', () => {
        beforeEach(async () => {
            await agentService.initialize();
            agentService.ws = mockWebSocket;
        });

        it('should flush data buffer when connected', () => {
            // Add data to buffer
            agentService.dataBuffer = [
                { type: 'data', dataType: 'system', data: { cpu: 50 } },
                { type: 'data', dataType: 'network', data: { bandwidth: 100 } }
            ];

            agentService.isConnected = true;

            agentService.flushDataBuffer();

            expect(mockWebSocket.send).toHaveBeenCalledTimes(2);
            expect(agentService.dataBuffer).toHaveLength(0);
            expect(logger.info).toHaveBeenCalledWith('缓存数据发送完成，共发送 2 条数据');
        });

        it('should not flush when disconnected', () => {
            agentService.dataBuffer = [
                { type: 'data', dataType: 'system', data: { cpu: 50 } }
            ];

            agentService.isConnected = false;

            agentService.flushDataBuffer();

            expect(mockWebSocket.send).not.toHaveBeenCalled();
            expect(agentService.dataBuffer).toHaveLength(1);
        });

        it('should handle flush errors', () => {
            agentService.dataBuffer = [
                { type: 'data', dataType: 'system', data: { cpu: 50 } }
            ];

            agentService.isConnected = true;
            mockWebSocket.send.mockImplementation(() => {
                throw new Error('Send failed');
            });

            agentService.flushDataBuffer();

            expect(logger.error).toHaveBeenCalledWith('发送缓存数据失败:', expect.any(Error));
        });
    });

    describe('disconnect', () => {
        beforeEach(async () => {
            await agentService.initialize();
            agentService.ws = mockWebSocket;
            agentService.isConnected = true;
        });

        it('should disconnect cleanly', () => {
            agentService.stopHeartbeat = jest.fn();

            agentService.disconnect();

            expect(agentService.stopHeartbeat).toHaveBeenCalled();
            expect(mockWebSocket.close).toHaveBeenCalled();
            expect(agentService.isConnected).toBe(false);
            expect(agentService.ws).toBeNull();
            expect(logger.info).toHaveBeenCalledWith('WebSocket连接已断开');
        });

        it('should handle disconnect when not connected', () => {
            agentService.isConnected = false;
            agentService.ws = null;

            agentService.disconnect();

            expect(logger.info).toHaveBeenCalledWith('WebSocket连接已断开');
        });
    });

    describe('getStatus', () => {
        beforeEach(async () => {
            await agentService.initialize();
        });

        it('should return correct status', () => {
            agentService.isConnected = true;
            agentService.reconnectAttempts = 2;

            const status = agentService.getStatus();

            expect(status).toEqual({
                agentId: expect.any(String),
                isConnected: true,
                reconnectAttempts: 2,
                bufferSize: 0,
                lastHeartbeat: expect.any(Number)
            });
        });
    });
});
