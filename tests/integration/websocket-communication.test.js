const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const http = require('http');
const express = require('express');
const WebSocketService = require('../../server/src/services/WebSocketService');

// Mock Agent model
const mockAgent = {
    _id: 'test-agent-123',
    hostname: 'test-host',
    isActive: true,
    lastSeen: new Date(),
    save: jest.fn().mockResolvedValue(true)
};

jest.mock('../../server/src/models/Agent', () => ({
    findOne: jest.fn().mockResolvedValue(mockAgent),
    findOneAndUpdate: jest.fn().mockResolvedValue(mockAgent)
}));

jest.mock('../../server/src/utils/logger', () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
}));

describe('WebSocket Communication Integration Tests', () => {
    let server;
    let app;
    let port;
    let wsClient;

    beforeAll(async () => {
        // Create Express app and HTTP server
        app = express();
        server = http.createServer(app);

        // Initialize WebSocket service
        WebSocketService.initialize(server);

        // Start server on random port
        await new Promise((resolve) => {
            server.listen(0, () => {
                port = server.address().port;
                resolve();
            });
        });
    });

    afterAll(async () => {
        if (wsClient && wsClient.readyState === WebSocket.OPEN) {
            wsClient.close();
        }
        
        WebSocketService.close();
        
        await new Promise((resolve) => {
            server.close(resolve);
        });
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Agent Connection Flow', () => {
        it('should establish connection with valid JWT token', async () => {
            const token = jwt.sign(
                { agentId: 'test-agent-123', hostname: 'test-host' },
                process.env.JWT_SECRET || 'test-secret',
                { expiresIn: '1h' }
            );

            wsClient = new WebSocket(`ws://localhost:${port}/agents/test-agent-123?token=${token}`);

            await new Promise((resolve, reject) => {
                wsClient.on('open', resolve);
                wsClient.on('error', reject);
                
                setTimeout(() => reject(new Error('Connection timeout')), 5000);
            });

            expect(wsClient.readyState).toBe(WebSocket.OPEN);
        });

        it('should reject connection with invalid token', async () => {
            const invalidClient = new WebSocket(`ws://localhost:${port}/agents/test-agent-123?token=invalid-token`);

            await new Promise((resolve, reject) => {
                invalidClient.on('close', (code) => {
                    expect(code).toBe(1008); // Policy violation
                    resolve();
                });
                
                invalidClient.on('open', () => {
                    reject(new Error('Connection should not open with invalid token'));
                });
                
                setTimeout(() => reject(new Error('Test timeout')), 5000);
            });
        });

        it('should reject connection without token', async () => {
            const noTokenClient = new WebSocket(`ws://localhost:${port}/agents/test-agent-123`);

            await new Promise((resolve, reject) => {
                noTokenClient.on('close', (code) => {
                    expect(code).toBe(1008); // Policy violation
                    resolve();
                });
                
                noTokenClient.on('open', () => {
                    reject(new Error('Connection should not open without token'));
                });
                
                setTimeout(() => reject(new Error('Test timeout')), 5000);
            });
        });
    });

    describe('Message Exchange', () => {
        beforeEach(async () => {
            const token = jwt.sign(
                { agentId: 'test-agent-123', hostname: 'test-host' },
                process.env.JWT_SECRET || 'test-secret',
                { expiresIn: '1h' }
            );

            wsClient = new WebSocket(`ws://localhost:${port}/agents/test-agent-123?token=${token}`);

            await new Promise((resolve, reject) => {
                wsClient.on('open', resolve);
                wsClient.on('error', reject);
                setTimeout(() => reject(new Error('Connection timeout')), 5000);
            });
        });

        afterEach(() => {
            if (wsClient && wsClient.readyState === WebSocket.OPEN) {
                wsClient.close();
            }
        });

        it('should handle heartbeat messages', (done) => {
            const heartbeatMessage = {
                type: 'heartbeat',
                timestamp: Date.now(),
                agentId: 'test-agent-123'
            };

            wsClient.send(JSON.stringify(heartbeatMessage));

            // Wait for processing
            setTimeout(() => {
                const Agent = require('../../server/src/models/Agent');
                expect(Agent.findOneAndUpdate).toHaveBeenCalledWith(
                    { _id: 'test-agent-123' },
                    { lastSeen: expect.any(Date) },
                    { new: true }
                );
                done();
            }, 100);
        });

        it('should handle system data messages', (done) => {
            const systemDataMessage = {
                type: 'data',
                dataType: 'system',
                data: {
                    cpu: 75.5,
                    memory: 60.2,
                    processes: 156,
                    uptime: 3600,
                    timestamp: Date.now()
                },
                agentId: 'test-agent-123'
            };

            wsClient.send(JSON.stringify(systemDataMessage));

            setTimeout(() => {
                const logger = require('../../server/src/utils/logger');
                expect(logger.debug).toHaveBeenCalledWith(
                    '收到代理数据:',
                    expect.objectContaining({
                        agentId: 'test-agent-123',
                        dataType: 'system'
                    })
                );
                done();
            }, 100);
        });

        it('should handle network data messages', (done) => {
            const networkDataMessage = {
                type: 'data',
                dataType: 'network',
                data: {
                    interfaces: [
                        {
                            name: 'eth0',
                            rxBytes: 1024000,
                            txBytes: 512000,
                            status: 'up'
                        }
                    ],
                    wifiDevices: [
                        {
                            mac: '00:11:22:33:44:55',
                            ip: '192.168.1.100',
                            signal: -45
                        }
                    ],
                    timestamp: Date.now()
                },
                agentId: 'test-agent-123'
            };

            wsClient.send(JSON.stringify(networkDataMessage));

            setTimeout(() => {
                const logger = require('../../server/src/utils/logger');
                expect(logger.debug).toHaveBeenCalledWith(
                    '收到代理数据:',
                    expect.objectContaining({
                        agentId: 'test-agent-123',
                        dataType: 'network'
                    })
                );
                done();
            }, 100);
        });

        it('should handle security event messages', (done) => {
            const securityEventMessage = {
                type: 'data',
                dataType: 'security',
                data: {
                    eventType: 'suspicious_activity',
                    severity: 'high',
                    sourceIP: '192.168.1.200',
                    description: 'Multiple failed login attempts',
                    timestamp: Date.now()
                },
                agentId: 'test-agent-123'
            };

            wsClient.send(JSON.stringify(securityEventMessage));

            setTimeout(() => {
                const logger = require('../../server/src/utils/logger');
                expect(logger.debug).toHaveBeenCalledWith(
                    '收到代理数据:',
                    expect.objectContaining({
                        agentId: 'test-agent-123',
                        dataType: 'security'
                    })
                );
                done();
            }, 100);
        });

        it('should handle status update messages', (done) => {
            const statusMessage = {
                type: 'status',
                status: 'monitoring',
                details: {
                    servicesRunning: ['system', 'network', 'security'],
                    lastRestart: Date.now() - 3600000
                },
                agentId: 'test-agent-123'
            };

            wsClient.send(JSON.stringify(statusMessage));

            setTimeout(() => {
                const Agent = require('../../server/src/models/Agent');
                expect(Agent.findOneAndUpdate).toHaveBeenCalledWith(
                    { _id: 'test-agent-123' },
                    { status: 'monitoring', lastSeen: expect.any(Date) },
                    { new: true }
                );
                done();
            }, 100);
        });

        it('should handle pong messages for ping/pong', (done) => {
            const pongMessage = {
                type: 'pong',
                timestamp: Date.now(),
                agentId: 'test-agent-123'
            };

            wsClient.send(JSON.stringify(pongMessage));

            // Pong messages should be handled without errors
            setTimeout(() => {
                // No specific assertions needed, just ensure no errors
                done();
            }, 100);
        });

        it('should handle malformed JSON gracefully', (done) => {
            wsClient.send('invalid json message');

            setTimeout(() => {
                const logger = require('../../server/src/utils/logger');
                expect(logger.error).toHaveBeenCalledWith(
                    '处理WebSocket消息失败:',
                    expect.objectContaining({
                        agentId: 'test-agent-123'
                    })
                );
                done();
            }, 100);
        });

        it('should handle unknown message types', (done) => {
            const unknownMessage = {
                type: 'unknown_type',
                data: 'test data',
                agentId: 'test-agent-123'
            };

            wsClient.send(JSON.stringify(unknownMessage));

            setTimeout(() => {
                const logger = require('../../server/src/utils/logger');
                expect(logger.warn).toHaveBeenCalledWith(
                    '未知消息类型:',
                    expect.objectContaining({
                        agentId: 'test-agent-123',
                        type: 'unknown_type'
                    })
                );
                done();
            }, 100);
        });
    });

    describe('Server to Client Communication', () => {
        beforeEach(async () => {
            const token = jwt.sign(
                { agentId: 'test-agent-123', hostname: 'test-host' },
                process.env.JWT_SECRET || 'test-secret',
                { expiresIn: '1h' }
            );

            wsClient = new WebSocket(`ws://localhost:${port}/agents/test-agent-123?token=${token}`);

            await new Promise((resolve, reject) => {
                wsClient.on('open', resolve);
                wsClient.on('error', reject);
                setTimeout(() => reject(new Error('Connection timeout')), 5000);
            });
        });

        afterEach(() => {
            if (wsClient && wsClient.readyState === WebSocket.OPEN) {
                wsClient.close();
            }
        });

        it('should send command to specific client', (done) => {
            const testCommand = {
                type: 'command',
                command: 'get_status',
                params: {}
            };

            wsClient.on('message', (data) => {
                const message = JSON.parse(data.toString());
                expect(message).toEqual(testCommand);
                done();
            });

            // Send command from server to client
            WebSocketService.sendToClient('test-agent-123', testCommand);
        });

        it('should broadcast message to all clients', (done) => {
            const broadcastMessage = {
                type: 'broadcast',
                message: 'System maintenance in 10 minutes',
                timestamp: Date.now()
            };

            wsClient.on('message', (data) => {
                const message = JSON.parse(data.toString());
                expect(message).toEqual(broadcastMessage);
                done();
            });

            // Broadcast from server
            WebSocketService.broadcast(broadcastMessage);
        });

        it('should send ping to client', (done) => {
            wsClient.on('message', (data) => {
                const message = JSON.parse(data.toString());
                if (message.type === 'ping') {
                    expect(message).toHaveProperty('timestamp');
                    
                    // Respond with pong
                    wsClient.send(JSON.stringify({
                        type: 'pong',
                        timestamp: message.timestamp,
                        agentId: 'test-agent-123'
                    }));
                    
                    done();
                }
            });

            // Send ping from server
            WebSocketService.sendToClient('test-agent-123', {
                type: 'ping',
                timestamp: Date.now()
            });
        });
    });

    describe('Connection Management', () => {
        it('should track connected clients', async () => {
            const token = jwt.sign(
                { agentId: 'test-agent-123', hostname: 'test-host' },
                process.env.JWT_SECRET || 'test-secret',
                { expiresIn: '1h' }
            );

            wsClient = new WebSocket(`ws://localhost:${port}/agents/test-agent-123?token=${token}`);

            await new Promise((resolve, reject) => {
                wsClient.on('open', resolve);
                wsClient.on('error', reject);
                setTimeout(() => reject(new Error('Connection timeout')), 5000);
            });

            const connectedClients = WebSocketService.getConnectedClients();
            expect(connectedClients).toContain('test-agent-123');
        });

        it('should remove client from tracking on disconnect', async () => {
            const token = jwt.sign(
                { agentId: 'test-agent-123', hostname: 'test-host' },
                process.env.JWT_SECRET || 'test-secret',
                { expiresIn: '1h' }
            );

            wsClient = new WebSocket(`ws://localhost:${port}/agents/test-agent-123?token=${token}`);

            await new Promise((resolve, reject) => {
                wsClient.on('open', resolve);
                wsClient.on('error', reject);
                setTimeout(() => reject(new Error('Connection timeout')), 5000);
            });

            // Verify client is connected
            let connectedClients = WebSocketService.getConnectedClients();
            expect(connectedClients).toContain('test-agent-123');

            // Close connection
            wsClient.close();

            // Wait for cleanup
            await new Promise(resolve => setTimeout(resolve, 100));

            // Verify client is removed
            connectedClients = WebSocketService.getConnectedClients();
            expect(connectedClients).not.toContain('test-agent-123');
        });

        it('should handle multiple concurrent connections', async () => {
            const clients = [];
            const agentIds = ['agent-1', 'agent-2', 'agent-3'];

            // Create multiple connections
            for (const agentId of agentIds) {
                const token = jwt.sign(
                    { agentId, hostname: 'test-host' },
                    process.env.JWT_SECRET || 'test-secret',
                    { expiresIn: '1h' }
                );

                const client = new WebSocket(`ws://localhost:${port}/agents/${agentId}?token=${token}`);
                clients.push(client);

                await new Promise((resolve, reject) => {
                    client.on('open', resolve);
                    client.on('error', reject);
                    setTimeout(() => reject(new Error('Connection timeout')), 5000);
                });
            }

            // Verify all clients are connected
            const connectedClients = WebSocketService.getConnectedClients();
            for (const agentId of agentIds) {
                expect(connectedClients).toContain(agentId);
            }

            // Close all connections
            for (const client of clients) {
                client.close();
            }

            // Wait for cleanup
            await new Promise(resolve => setTimeout(resolve, 200));

            // Verify all clients are removed
            const finalConnectedClients = WebSocketService.getConnectedClients();
            for (const agentId of agentIds) {
                expect(finalConnectedClients).not.toContain(agentId);
            }
        });
    });

    describe('Error Handling', () => {
        it('should handle database errors during authentication', async () => {
            const Agent = require('../../server/src/models/Agent');
            Agent.findOne.mockRejectedValueOnce(new Error('Database connection failed'));

            const token = jwt.sign(
                { agentId: 'test-agent-123', hostname: 'test-host' },
                process.env.JWT_SECRET || 'test-secret',
                { expiresIn: '1h' }
            );

            const errorClient = new WebSocket(`ws://localhost:${port}/agents/test-agent-123?token=${token}`);

            await new Promise((resolve, reject) => {
                errorClient.on('close', (code) => {
                    expect(code).toBe(1011); // Internal error
                    resolve();
                });
                
                errorClient.on('open', () => {
                    reject(new Error('Connection should not open with database error'));
                });
                
                setTimeout(() => reject(new Error('Test timeout')), 5000);
            });

            const logger = require('../../server/src/utils/logger');
            expect(logger.error).toHaveBeenCalled();
        });
    });
}); 