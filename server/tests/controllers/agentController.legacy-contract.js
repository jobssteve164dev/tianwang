// Historical pre-Sequelize contract retained as a migration reference.
const request = require('supertest');
const express = require('express');
const agentController = require('../../src/controllers/agentController');
const jwt = require('jsonwebtoken');

// Mock dependencies
jest.mock('../../src/models/Agent');
jest.mock('../../src/utils/logger');

const Agent = require('../../src/models/Agent');
const logger = require('../../src/utils/logger');

// Create test app
const app = express();
app.use(express.json());

// Mock routes for testing
app.post('/register', agentController.registerAgent);
app.post('/auth', agentController.authenticateAgent);
app.get('/', agentController.getAgents);
app.get('/:agentId', agentController.getAgent);
app.patch('/:agentId/status', agentController.updateAgentStatus);
app.delete('/:agentId', agentController.deleteAgent);
app.post('/:agentId/heartbeat', agentController.heartbeat);
app.post('/:agentId/data', agentController.receiveData);

describe('AgentController', () => {
    beforeEach(() => {
        // Mock logger methods
        logger.info = jest.fn();
        logger.error = jest.fn();
        logger.warn = jest.fn();
        logger.debug = jest.fn();

        // Clear all mocks
        jest.clearAllMocks();
    });

    describe('POST /register', () => {
        it('should register a new agent successfully', async () => {
            const agentData = {
                hostname: 'test-host',
                platform: 'linux',
                version: '1.0.0',
                publicKey: 'test-public-key'
            };

            const mockAgent = {
                _id: 'agent123',
                ...agentData,
                save: jest.fn().mockResolvedValue(true)
            };

            Agent.prototype.save = jest.fn().mockResolvedValue(mockAgent);
            Agent.findOne = jest.fn().mockResolvedValue(null);

            const response = await request(app)
                .post('/register')
                .send(agentData)
                .expect(201);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('agentId');
            expect(response.body).toHaveProperty('message', '代理注册成功');
        });

        it('should return error for duplicate hostname', async () => {
            const agentData = {
                hostname: 'existing-host',
                platform: 'linux',
                version: '1.0.0',
                publicKey: 'test-public-key'
            };

            const existingAgent = {
                _id: 'existing123',
                hostname: 'existing-host'
            };

            Agent.findOne = jest.fn().mockResolvedValue(existingAgent);

            const response = await request(app)
                .post('/register')
                .send(agentData)
                .expect(409);

            expect(response.body).toHaveProperty('success', false);
            expect(response.body).toHaveProperty('message', '主机名已存在');
        });

        it('should return validation error for missing required fields', async () => {
            const incompleteData = {
                hostname: 'test-host'
                // Missing platform, version, publicKey
            };

            const response = await request(app)
                .post('/register')
                .send(incompleteData)
                .expect(400);

            expect(response.body).toHaveProperty('success', false);
            expect(response.body.message).toContain('缺少必需字段');
        });

        it('should handle database errors', async () => {
            const agentData = {
                hostname: 'test-host',
                platform: 'linux',
                version: '1.0.0',
                publicKey: 'test-public-key'
            };

            Agent.findOne = jest.fn().mockResolvedValue(null);
            Agent.prototype.save = jest.fn().mockRejectedValue(new Error('Database error'));

            const response = await request(app)
                .post('/register')
                .send(agentData)
                .expect(500);

            expect(response.body).toHaveProperty('success', false);
            expect(logger.error).toHaveBeenCalled();
        });
    });

    describe('POST /auth', () => {
        it('should authenticate agent successfully', async () => {
            const authData = {
                agentId: 'agent123',
                hostname: 'test-host'
            };

            const mockAgent = {
                _id: 'agent123',
                hostname: 'test-host',
                isActive: true,
                save: jest.fn().mockResolvedValue(true)
            };

            Agent.findOne = jest.fn().mockResolvedValue(mockAgent);

            const response = await request(app)
                .post('/auth')
                .send(authData)
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('token');
            expect(response.body).toHaveProperty('message', '代理认证成功');

            // Verify JWT token
            const token = response.body.token;
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'test-secret');
            expect(decoded).toHaveProperty('agentId', 'agent123');
            expect(decoded).toHaveProperty('hostname', 'test-host');
        });

        it('should return error for non-existent agent', async () => {
            const authData = {
                agentId: 'nonexistent',
                hostname: 'test-host'
            };

            Agent.findOne = jest.fn().mockResolvedValue(null);

            const response = await request(app)
                .post('/auth')
                .send(authData)
                .expect(404);

            expect(response.body).toHaveProperty('success', false);
            expect(response.body).toHaveProperty('message', '代理不存在，请先注册');
        });

        it('should return error for inactive agent', async () => {
            const authData = {
                agentId: 'agent123',
                hostname: 'test-host'
            };

            const mockAgent = {
                _id: 'agent123',
                hostname: 'test-host',
                isActive: false
            };

            Agent.findOne = jest.fn().mockResolvedValue(mockAgent);

            const response = await request(app)
                .post('/auth')
                .send(authData)
                .expect(403);

            expect(response.body).toHaveProperty('success', false);
            expect(response.body).toHaveProperty('message', '代理已被禁用');
        });

        it('should return validation error for missing fields', async () => {
            const incompleteData = {
                agentId: 'agent123'
                // Missing hostname
            };

            const response = await request(app)
                .post('/auth')
                .send(incompleteData)
                .expect(400);

            expect(response.body).toHaveProperty('success', false);
            expect(response.body.message).toContain('缺少必需字段');
        });
    });

    describe('GET /', () => {
        it('should return list of agents', async () => {
            const mockAgents = [
                {
                    _id: 'agent1',
                    hostname: 'host1',
                    platform: 'linux',
                    status: 'active',
                    lastSeen: new Date()
                },
                {
                    _id: 'agent2',
                    hostname: 'host2',
                    platform: 'windows',
                    status: 'inactive',
                    lastSeen: new Date()
                }
            ];

            Agent.find = jest.fn().mockReturnValue({
                select: jest.fn().mockReturnValue({
                    sort: jest.fn().mockResolvedValue(mockAgents)
                })
            });

            const response = await request(app)
                .get('/')
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('agents');
            expect(response.body.agents).toHaveLength(2);
            expect(response.body.agents[0]).toHaveProperty('hostname', 'host1');
        });

        it('should handle database errors', async () => {
            Agent.find = jest.fn().mockReturnValue({
                select: jest.fn().mockReturnValue({
                    sort: jest.fn().mockRejectedValue(new Error('Database error'))
                })
            });

            const response = await request(app)
                .get('/')
                .expect(500);

            expect(response.body).toHaveProperty('success', false);
            expect(logger.error).toHaveBeenCalled();
        });
    });

    describe('GET /:agentId', () => {
        it('should return agent details', async () => {
            const mockAgent = {
                _id: 'agent123',
                hostname: 'test-host',
                platform: 'linux',
                status: 'active',
                version: '1.0.0',
                lastSeen: new Date(),
                createdAt: new Date()
            };

            Agent.findById = jest.fn().mockResolvedValue(mockAgent);

            const response = await request(app)
                .get('/agent123')
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('agent');
            expect(response.body.agent).toHaveProperty('hostname', 'test-host');
        });

        it('should return 404 for non-existent agent', async () => {
            Agent.findById = jest.fn().mockResolvedValue(null);

            const response = await request(app)
                .get('/nonexistent')
                .expect(404);

            expect(response.body).toHaveProperty('success', false);
            expect(response.body).toHaveProperty('message', '代理不存在');
        });
    });

    describe('PATCH /:agentId/status', () => {
        it('should update agent status', async () => {
            const mockAgent = {
                _id: 'agent123',
                hostname: 'test-host',
                status: 'active',
                save: jest.fn().mockResolvedValue(true)
            };

            Agent.findById = jest.fn().mockResolvedValue(mockAgent);

            const response = await request(app)
                .patch('/agent123/status')
                .send({ status: 'inactive' })
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('message', '代理状态更新成功');
            expect(mockAgent.status).toBe('inactive');
            expect(mockAgent.save).toHaveBeenCalled();
        });

        it('should return 404 for non-existent agent', async () => {
            Agent.findById = jest.fn().mockResolvedValue(null);

            const response = await request(app)
                .patch('/nonexistent/status')
                .send({ status: 'inactive' })
                .expect(404);

            expect(response.body).toHaveProperty('success', false);
            expect(response.body).toHaveProperty('message', '代理不存在');
        });

        it('should validate status values', async () => {
            const mockAgent = {
                _id: 'agent123',
                hostname: 'test-host',
                status: 'active'
            };

            Agent.findById = jest.fn().mockResolvedValue(mockAgent);

            const response = await request(app)
                .patch('/agent123/status')
                .send({ status: 'invalid-status' })
                .expect(400);

            expect(response.body).toHaveProperty('success', false);
            expect(response.body.message).toContain('无效的状态值');
        });
    });

    describe('DELETE /:agentId', () => {
        it('should delete agent successfully', async () => {
            const mockAgent = {
                _id: 'agent123',
                hostname: 'test-host',
                remove: jest.fn().mockResolvedValue(true)
            };

            Agent.findById = jest.fn().mockResolvedValue(mockAgent);

            const response = await request(app)
                .delete('/agent123')
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('message', '代理删除成功');
            expect(mockAgent.remove).toHaveBeenCalled();
        });

        it('should return 404 for non-existent agent', async () => {
            Agent.findById = jest.fn().mockResolvedValue(null);

            const response = await request(app)
                .delete('/nonexistent')
                .expect(404);

            expect(response.body).toHaveProperty('success', false);
            expect(response.body).toHaveProperty('message', '代理不存在');
        });
    });

    describe('POST /:agentId/heartbeat', () => {
        it('should update agent heartbeat', async () => {
            const mockAgent = {
                _id: 'agent123',
                hostname: 'test-host',
                lastSeen: new Date('2023-01-01'),
                save: jest.fn().mockResolvedValue(true)
            };

            Agent.findById = jest.fn().mockResolvedValue(mockAgent);

            const response = await request(app)
                .post('/agent123/heartbeat')
                .send({ timestamp: Date.now() })
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('message', '心跳更新成功');
            expect(mockAgent.lastSeen).not.toEqual(new Date('2023-01-01'));
            expect(mockAgent.save).toHaveBeenCalled();
        });

        it('should return 404 for non-existent agent', async () => {
            Agent.findById = jest.fn().mockResolvedValue(null);

            const response = await request(app)
                .post('/nonexistent/heartbeat')
                .send({ timestamp: Date.now() })
                .expect(404);

            expect(response.body).toHaveProperty('success', false);
            expect(response.body).toHaveProperty('message', '代理不存在');
        });
    });

    describe('POST /:agentId/data', () => {
        it('should receive and process agent data', async () => {
            const mockAgent = {
                _id: 'agent123',
                hostname: 'test-host',
                lastSeen: new Date('2023-01-01'),
                save: jest.fn().mockResolvedValue(true)
            };

            Agent.findById = jest.fn().mockResolvedValue(mockAgent);

            const testData = {
                type: 'system',
                data: {
                    cpu: 50,
                    memory: 80,
                    timestamp: Date.now()
                }
            };

            const response = await request(app)
                .post('/agent123/data')
                .send(testData)
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('message', '数据接收成功');
            expect(mockAgent.save).toHaveBeenCalled();
            expect(logger.debug).toHaveBeenCalledWith(
                '接收到代理数据:',
                expect.objectContaining({
                    agentId: 'agent123',
                    type: 'system'
                })
            );
        });

        it('should return 404 for non-existent agent', async () => {
            Agent.findById = jest.fn().mockResolvedValue(null);

            const testData = {
                type: 'system',
                data: { cpu: 50 }
            };

            const response = await request(app)
                .post('/nonexistent/data')
                .send(testData)
                .expect(404);

            expect(response.body).toHaveProperty('success', false);
            expect(response.body).toHaveProperty('message', '代理不存在');
        });

        it('should validate data format', async () => {
            const mockAgent = {
                _id: 'agent123',
                hostname: 'test-host'
            };

            Agent.findById = jest.fn().mockResolvedValue(mockAgent);

            const invalidData = {
                // Missing type and data fields
                invalid: 'data'
            };

            const response = await request(app)
                .post('/agent123/data')
                .send(invalidData)
                .expect(400);

            expect(response.body).toHaveProperty('success', false);
            expect(response.body.message).toContain('缺少必需字段: type, data');
        });
    });
});
