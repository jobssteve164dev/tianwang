/**
 * Kafka消息队列配置
 * Kafka Message Queue Configuration
 */

const { Kafka } = require('kafkajs');
const config = require('./index');
const logger = require('../utils/logger');

let kafka = null;
let producer = null;
let consumer = null;

/**
 * 初始化Kafka连接
 */
async function initializeKafka() {
  try {
    // 等待Kafka服务器完全启动
    logger.info('⏳ Waiting for Kafka server to be ready...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 创建Kafka实例
    kafka = new Kafka({
      clientId: config.kafka.clientId,
      brokers: config.kafka.brokers,
      retry: {
        initialRetryTime: 500,  // 增加初始重试时间
        retries: 10             // 增加重试次数
      }
    });

    // 创建生产者
    producer = kafka.producer({
      maxInFlightRequests: 1,
      idempotent: true,
      transactionTimeout: 30000
    });

    // 创建消费者
    consumer = kafka.consumer({
      groupId: config.kafka.groupId,
      sessionTimeout: 30000,
      heartbeatInterval: 3000
    });

    // 连接生产者
    await producer.connect();
    logger.info('✅ Kafka producer connected');

    // 连接消费者
    await consumer.connect();
    logger.info('✅ Kafka consumer connected');

    // 验证连接健康状态
    await validateKafkaConnection();

    // 创建必要的主题
    await createTopics();

    // 设置消费者监听
    await setupConsumers();

    logger.info('✅ Kafka initialized successfully');

  } catch (error) {
    logger.error('❌ Kafka initialization failed:', error);
    throw error;
  }
}

/**
 * 验证Kafka连接健康状态
 */
async function validateKafkaConnection() {
  try {
    const admin = kafka.admin();
    await admin.connect();

    // 获取集群元数据
    const metadata = await admin.fetchTopicMetadata();
    logger.info(`✅ Kafka connection validated. Found ${metadata.topics.length} topics`);

    await admin.disconnect();
  } catch (error) {
    logger.error('❌ Kafka connection validation failed:', error);
    throw error;
  }
}

/**
 * 创建Kafka主题
 */
async function createTopics() {
  try {
    const admin = kafka.admin();
    await admin.connect();

    const topics = [
      {
        topic: config.kafka.topics.logs,
        numPartitions: 3,
        replicationFactor: 1
      },
      {
        topic: config.kafka.topics.alerts,
        numPartitions: 2,
        replicationFactor: 1
      },
      {
        topic: config.kafka.topics.actions,
        numPartitions: 2,
        replicationFactor: 1
      }
    ];

    await admin.createTopics({
      topics,
      waitForLeaders: true
    });

    await admin.disconnect();
    logger.info('✅ Kafka topics created/verified');

  } catch (error) {
    if (error.type === 'TOPIC_ALREADY_EXISTS') {
      logger.debug('Kafka topics already exist');
    } else {
      logger.error('❌ Failed to create Kafka topics:', error);
      throw error;
    }
  }
}

/**
 * 设置消费者监听
 */
async function setupConsumers() {
  try {
    // 订阅主题
    await consumer.subscribe({
      topics: [
        config.kafka.topics.logs,
        config.kafka.topics.alerts,
        config.kafka.topics.actions
      ]
    });

    // 开始消费消息
    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const data = JSON.parse(message.value.toString());

          logger.debug(`Kafka message received from ${topic}:`, {
            partition,
            offset: message.offset,
            key: message.key?.toString(),
            timestamp: message.timestamp
          });

          // 根据主题处理消息
          switch (topic) {
          case config.kafka.topics.logs:
            await handleLogMessage(data);
            break;
          case config.kafka.topics.alerts:
            await handleAlertMessage(data);
            break;
          case config.kafka.topics.actions:
            await handleActionMessage(data);
            break;
          default:
            logger.warn(`Unknown topic: ${topic}`);
          }

        } catch (error) {
          logger.error(`Error processing message from ${topic}:`, error);
          throw error;
        }
      }
    });

    logger.info('✅ Kafka consumers started');

  } catch (error) {
    logger.error('❌ Failed to setup Kafka consumers:', error);
    throw error;
  }
}

/**
 * 处理日志消息
 */
async function handleLogMessage(data) {
  if (!data.agent_id || !data.data) throw new Error('日志消息缺少agent_id或data');
  const dataStorageService = require('../services/DataStorageService');
  await dataStorageService.storeLogData(data.agent_id, data.data);
  logger.debug('Kafka日志消息已持久化', { agent_id: data.agent_id });
}

/**
 * 处理告警消息
 */
async function handleAlertMessage(data) {
  if (!data.agent_id || !data.type || !data.title) throw new Error('告警消息缺少必要字段');
  const securityEventService = require('../services/SecurityEventService');
  await securityEventService.record({
    type: data.type,
    alert_type: data.alert_type,
    severity: data.severity || 'medium',
    title: data.title,
    description: data.description || data.title,
    details: data.details || {},
    device_id: data.device_id,
    agent_id: data.agent_id,
    organization_id: data.organization_id,
    source_ip: data.source_ip,
    target_ip: data.target_ip,
    source: 'kafka',
    tags: ['kafka', ...(data.tags || [])]
  });
  logger.debug('Kafka告警消息已入库', { agent_id: data.agent_id, type: data.type });
}

/**
 * 处理防护动作消息
 */
async function handleActionMessage(data) {
  let agentId = data.agent_id;
  if (!agentId && data.device_id) {
    const models = require('../models');
    const agent = await models.Agent?.findOne({ where: { device_id: data.device_id } });
    agentId = agent?.agent_id;
  }
  if (!agentId) throw new Error('防护动作消息无法解析目标节点');
  const action = data.action || data;
  const WebSocketService = require('../services/WebSocketService');
  const sent = WebSocketService.sendCommandToAgent(agentId, action);
  if (!sent) throw new Error(`节点 ${agentId} 当前不在线，防护动作未送达`);
  logger.info('Kafka防护动作已下发', { agent_id: agentId, action: action.type || action.action });
}

/**
 * 发送消息到Kafka
 */
async function sendMessage(topic, message, key = null) {
  try {
    if (!producer) {
      throw new Error('Kafka producer not initialized');
    }

    const result = await producer.send({
      topic,
      messages: [{
        key,
        value: JSON.stringify(message),
        timestamp: Date.now().toString()
      }]
    });

    logger.debug(`Message sent to ${topic}:`, {
      partition: result[0].partition,
      offset: result[0].baseOffset
    });

    return result;

  } catch (error) {
    logger.error(`Failed to send message to ${topic}:`, error);
    throw error;
  }
}

/**
 * 发送日志消息
 */
async function sendLogMessage(logData) {
  return await sendMessage(config.kafka.topics.logs, logData, logData.device_id);
}

/**
 * 发送告警消息
 */
async function sendAlertMessage(alertData) {
  return await sendMessage(config.kafka.topics.alerts, alertData, alertData.event_id);
}

/**
 * 发送防护动作消息
 */
async function sendActionMessage(actionData) {
  return await sendMessage(config.kafka.topics.actions, actionData, actionData.device_id);
}

/**
 * 关闭Kafka连接
 */
async function closeKafka() {
  try {
    if (consumer) {
      await consumer.disconnect();
      logger.info('✅ Kafka consumer disconnected');
    }

    if (producer) {
      await producer.disconnect();
      logger.info('✅ Kafka producer disconnected');
    }

  } catch (error) {
    logger.error('❌ Error closing Kafka connections:', error);
  }
}

/**
 * 获取Kafka实例
 */
function getKafka() {
  if (!kafka) {
    throw new Error('Kafka not initialized. Call initializeKafka() first.');
  }
  return kafka;
}

function getProducer() {
  if (!producer) {
    throw new Error('Kafka producer not initialized.');
  }
  return producer;
}

function getConsumer() {
  if (!consumer) {
    throw new Error('Kafka consumer not initialized.');
  }
  return consumer;
}

module.exports = {
  initializeKafka,
  closeKafka,
  getKafka,
  getProducer,
  getConsumer,
  sendMessage,
  sendLogMessage,
  sendAlertMessage,
  sendActionMessage,
  validateKafkaConnection
};
