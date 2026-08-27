// Historical pre-connection-key contract retained as a migration reference.
const WebSocketService = require('../../src/services/WebSocketService');
const jwt = require('jsonwebtoken');
const WebSocket = require('ws');
const http = require('http');

// Mock dependencies
jest.mock('../../src/models/Agent');
jest.mock('../../src/utils/logger');

const Agent = require('../../src/models/Agent');
const logger = require('../../src/utils/logger');

describe('WebSocketService', () => {
    let server;
    let wsServer;

    beforeEach(() => {
        // Create HTTP server for testing
        server = http.createServer();

        // Mock logger methods
        logger.info = jest.fn();
        logger.error = jest.fn();
        logger.warn = jest.fn();
        logger.debug = jest.fn();

        // Clear all mocks
        jest.clearAllMocks();
    });

    afterEach(async () => {
        // Close WebSocket service
        if (wsServer) {
            WebSocketService.close();
            wsServer = null;
        }

        // Close HTTP server
        if (server) {
            await new Promise(resolve => server.close(resolve));
            server = null;
        }
    });

    describe('initialize', () => {
        it('should initialize WebSocket server successfully', () => {
            const result = WebSocketService.initialize(server);

            expect(result).toBeDefined();
            expect(logger.info).toHaveBeenCalledWith('WebSocket服务器已启动');
        });

        it('should handle initialization errors', () => {
            expect(() => {
                WebSocketService.initialize(null);
            }).toThrow();
        });
    });

    describe('authentication', () => {
        beforeEach(() => {
            WebSocketService.initialize(server);
            server.listen(0); // Use random port
        });

        it('should authenticate valid JWT token', async () => {
            const mockAgent = {
                _id: 'agent123',
                hostname: 'test-host',
                isActive: true
            };

            Agent.findOne = jest.fn().mockResolvedValue(mockAgent);

            const token = jwt.sign(
                { agentId: 'agent123', hostname: 'test-host' },
                process.env.JWT_SECRET || 'test-secret',
                { expiresIn: '24h' }
            );

            const port = server.address().port;
            const ws = new WebSocket(`ws://localhost:${port}/agents/agent123?token=${token}`);

            return new Promise((resolve, reject) => {
                ws.on('open', () => {
                    expect(Agent.findOne).toHaveBeenCalledWith({ _id: 'agent123' });
                    ws.close();
                    resolve();
                });

                ws.on('error', reject);

                setTimeout(() => reject(new Error('Connection timeout')), 5000);
            });
        });

        it('should reject invalid JWT token', async () => {
            const port = server.address().port;
            const ws = new WebSocket(`ws://localhost:${port}/agents/agent123?token=invalid-token`);

            return new Promise((resolve, reject) => {
                ws.on('close', (code) => {
                    expect(code).toBe(1008); // Policy violation
                    resolve();
                });

                ws.on('open', () => {
                    reject(new Error('Connection should not open with invalid token'));
                });

                setTimeout(() => reject(new Error('Test timeout')), 5000);
            });
        });

        it('should reject connection for non-existent agent', async () => {
            Agent.findOne = jest.fn().mockResolvedValue(null);

            const token = jwt.sign(
                { agentId: 'nonexistent', hostname: 'test-host' },
                process.env.JWT_SECRET || 'test-secret',
                { expiresIn: '24h' }
            );

            const port = server.address().port;
            const ws = new WebSocket(`ws://localhost:${port}/agents/nonexistent?token=${token}`);

            return new Promise((resolve, reject) => {
                ws.on('close', (code) => {
                    expect(code).toBe(1008); // Policy violation
                    expect(Agent.findOne).toHaveBeenCalled();
                    resolve();
                });

                ws.on('open', () => {
                    reject(new Error('Connection should not open for non-existent agent'));
                });

                setTimeout(() => reject(new Error('Test timeout')), 5000);
            });
        });
    });

    describe('message handling', () => {
        let ws;
        let mockAgent;

        beforeEach(async () => {
            mockAgent = {
                _id: 'agent123',
                hostname: 'test-host',
                isActive: true,
                save: jest.fn().mockResolvedValue(true)
            };

            Agent.findOne = jest.fn().mockResolvedValue(mockAgent);
            Agent.findOneAndUpdate = jest.fn().mockResolvedValue(mockAgent);

            WebSocketService.initialize(server);
            server.listen(0);

            const token = jwt.sign(
                { agentId: 'agent123', hostname: 'test-host' },
                process.env.JWT_SECRET || 'test-secret',
                { expiresIn: '24h' }
            );

            const port = server.address().port;
            ws = new WebSocket(`ws://localhost:${port}/agents/agent123?token=${token}`);

            // Wait for connection to open
            await new Promise((resolve, reject) => {
                ws.on('open', resolve);
                ws.on('error', reject);
                setTimeout(() => reject(new Error('Connection timeout')), 5000);
            });
        });

        afterEach(() => {
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.close();
            }
        });

        it('should handle heartbeat messages', (done) => {
            const heartbeatMessage = JSON.stringify({
                type: 'heartbeat',
                timestamp: Date.now(),
                agentId: 'agent123'
            });

            ws.send(heartbeatMessage);

            // Wait a bit for message processing
            setTimeout(() => {
                expect(Agent.findOneAndUpdate).toHaveBeenCalledWith(
                    { _id: 'agent123' },
                    { lastSeen: expect.any(Date) },
                    { new: true }
                );
                done();
            }, 100);
        });

        it('should handle data messages', (done) => {
            const dataMessage = JSON.stringify({
                type: 'data',
                dataType: 'system',
                data: {
                    cpu: 50,
                    memory: 80,
                    timestamp: Date.now()
                },
                agentId: 'agent123'
            });

            ws.send(dataMessage);

            // Wait a bit for message processing
            setTimeout(() => {
                expect(logger.debug).toHaveBeenCalledWith(
                    '收到代理数据:',
                    expect.objectContaining({
                        agentId: 'agent123',
                        dataType: 'system'
                    })
                );
                done();
            }, 100);
        });

        it('should handle status update messages', (done) => {
            const statusMessage = JSON.stringify({
                type: 'status',
                status: 'active',
                agentId: 'agent123'
            });

            ws.send(statusMessage);

            // Wait a bit for message processing
            setTimeout(() => {
                expect(Agent.findOneAndUpdate).toHaveBeenCalledWith(
                    { _id: 'agent123' },
                    { status: 'active', lastSeen: expect.any(Date) },
                    { new: true }
                );
                done();
            }, 100);
        });

        it('should handle invalid JSON messages gracefully', (done) => {
            ws.send('invalid json message');

            // Wait a bit for message processing
            setTimeout(() => {
                expect(logger.error).toHaveBeenCalledWith(
                    '处理WebSocket消息失败:',
                    expect.objectContaining({
                        agentId: 'agent123'
                    })
                );
                done();
            }, 100);
        });

        it('should handle unknown message types', (done) => {
            const unknownMessage = JSON.stringify({
                type: 'unknown',
                data: 'test'
            });

            ws.send(unknownMessage);

            // Wait a bit for message processing
            setTimeout(() => {
                expect(logger.warn).toHaveBeenCalledWith(
                    '未知消息类型:',
                    expect.objectContaining({
                        agentId: 'agent123',
                        type: 'unknown'
                    })
                );
                done();
            }, 100);
        });
    });

    describe('client management', () => {
        it('should track connected clients', async () => {
            const mockAgent = {
                _id: 'agent123',
                hostname: 'test-host',
                isActive: true
            };

            Agent.findOne = jest.fn().mockResolvedValue(mockAgent);

            WebSocketService.initialize(server);
            server.listen(0);

            const token = jwt.sign(
                { agentId: 'agent123', hostname: 'test-host' },
                process.env.JWT_SECRET || 'test-secret',
                { expiresIn: '24h' }
            );

            const port = server.address().port;
            const ws = new WebSocket(`ws://localhost:${port}/agents/agent123?token=${token}`);

            await new Promise((resolve, reject) => {
                ws.on('open', () => {
                    // Check if client is tracked
                    const clients = WebSocketService.getConnectedClients();
                    expect(clients).toContain('agent123');
                    ws.close();
                    resolve();
                });

                ws.on('error', reject);
                setTimeout(() => reject(new Error('Connection timeout')), 5000);
            });
        });

        it('should remove clients on disconnect', async () => {
            const mockAgent = {
                _id: 'agent123',
                hostname: 'test-host',
                isActive: true
            };

            Agent.findOne = jest.fn().mockResolvedValue(mockAgent);

            WebSocketService.initialize(server);
            server.listen(0);

            const token = jwt.sign(
                { agentId: 'agent123', hostname: 'test-host' },
                process.env.JWT_SECRET || 'test-secret',
                { expiresIn: '24h' }
            );

            const port = server.address().port;
            const ws = new WebSocket(`ws://localhost:${port}/agents/agent123?token=${token}`);

            await new Promise((resolve, reject) => {
                ws.on('open', () => {
                    ws.close();
                });

                ws.on('close', () => {
                    // Wait a bit for cleanup
                    setTimeout(() => {
                        const clients = WebSocketService.getConnectedClients();
                        expect(clients).not.toContain('agent123');
                        resolve();
                    }, 100);
                });

                ws.on('error', reject);
                setTimeout(() => reject(new Error('Connection timeout')), 5000);
            });
        });
    });

    describe('broadcast functionality', () => {
        let ws1, ws2;

        beforeEach(async () => {
            const mockAgent1 = { _id: 'agent1', hostname: 'host1', isActive: true };
            const mockAgent2 = { _id: 'agent2', hostname: 'host2', isActive: true };

            Agent.findOne = jest.fn()
                .mockResolvedValueOnce(mockAgent1)
                .mockResolvedValueOnce(mockAgent2);

            WebSocketService.initialize(server);
            server.listen(0);

            const token1 = jwt.sign(
                { agentId: 'agent1', hostname: 'host1' },
                process.env.JWT_SECRET || 'test-secret',
                { expiresIn: '24h' }
            );

            const token2 = jwt.sign(
                { agentId: 'agent2', hostname: 'host2' },
                process.env.JWT_SECRET || 'test-secret',
                { expiresIn: '24h' }
            );

            const port = server.address().port;

            ws1 = new WebSocket(`ws://localhost:${port}/agents/agent1?token=${token1}`);
            ws2 = new WebSocket(`ws://localhost:${port}/agents/agent2?token=${token2}`);

            // Wait for both connections to open
            await Promise.all([
                new Promise(resolve => ws1.on('open', resolve)),
                new Promise(resolve => ws2.on('open', resolve))
            ]);
        });

        afterEach(() => {
            if (ws1 && ws1.readyState === WebSocket.OPEN) ws1.close();
            if (ws2 && ws2.readyState === WebSocket.OPEN) ws2.close();
        });

        it('should broadcast messages to all connected clients', (done) => {
            let receivedCount = 0;
            const testMessage = { type: 'broadcast', data: 'test broadcast' };

            const messageHandler = (data) => {
                const message = JSON.parse(data);
                expect(message).toEqual(testMessage);
                receivedCount++;

                if (receivedCount === 2) {
                    done();
                }
            };

            ws1.on('message', messageHandler);
            ws2.on('message', messageHandler);

            // Broadcast message
            WebSocketService.broadcast(testMessage);
        });

        it('should send message to specific client', (done) => {
            const testMessage = { type: 'direct', data: 'test direct message' };

            ws1.on('message', (data) => {
                const message = JSON.parse(data);
                expect(message).toEqual(testMessage);
                done();
            });

            ws2.on('message', () => {
                done(new Error('Message should not be received by agent2'));
            });

            // Send message to specific client
            WebSocketService.sendToClient('agent1', testMessage);
        });
    });

    describe('error handling', () => {
        it('should handle database errors gracefully', async () => {
            Agent.findOne = jest.fn().mockRejectedValue(new Error('Database error'));

            WebSocketService.initialize(server);
            server.listen(0);

            const token = jwt.sign(
                { agentId: 'agent123', hostname: 'test-host' },
                process.env.JWT_SECRET || 'test-secret',
                { expiresIn: '24h' }
            );

            const port = server.address().port;
            const ws = new WebSocket(`ws://localhost:${port}/agents/agent123?token=${token}`);

            return new Promise((resolve, reject) => {
                ws.on('close', (code) => {
                    expect(code).toBe(1011); // Internal error
                    expect(logger.error).toHaveBeenCalled();
                    resolve();
                });

                ws.on('open', () => {
                    reject(new Error('Connection should not open with database error'));
                });

                setTimeout(() => reject(new Error('Test timeout')), 5000);
            });
        });
    });
});
