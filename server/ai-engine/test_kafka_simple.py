#!/usr/bin/env python3
"""
简化的Kafka连接测试脚本
"""

import asyncio
import json
from aiokafka import AIOKafkaProducer, AIOKafkaConsumer
from loguru import logger

async def test_kafka_connection():
    """测试Kafka连接"""
    logger.info("开始Kafka连接测试...")
    
    # 测试生产者
    try:
        logger.info("测试生产者连接...")
        producer = AIOKafkaProducer(
            bootstrap_servers="localhost:9092",
            value_serializer=lambda v: json.dumps(v).encode('utf-8')
        )
        
        await producer.start()
        logger.info("✅ 生产者连接成功")
        
        # 发送测试消息
        test_message = {"test": "message", "timestamp": "2025-08-10T22:15:00Z"}
        await producer.send_and_wait("security-logs-dev", test_message)
        logger.info("✅ 测试消息发送成功")
        
        await producer.stop()
        logger.info("✅ 生产者连接测试完成")
        
    except Exception as e:
        logger.error(f"❌ 生产者连接失败: {e}")
        return False
    
    # 测试消费者
    try:
        logger.info("测试消费者连接...")
        consumer = AIOKafkaConsumer(
            "security-logs-dev",
            bootstrap_servers="localhost:9092",
            group_id="test-consumer-group",
            value_deserializer=lambda m: json.loads(m.decode('utf-8')),
            auto_offset_reset='latest',
            session_timeout_ms=60000,
            heartbeat_interval_ms=10000,
            request_timeout_ms=60000
        )
        
        await consumer.start()
        logger.info("✅ 消费者连接成功")
        
        # 等待一段时间看是否能收到消息
        logger.info("等待消息...")
        try:
            async for message in consumer:
                logger.info(f"收到消息: {message.value}")
                break
        except Exception as msg_error:
            logger.warning(f"消息接收测试: {msg_error}")
        
        await consumer.stop()
        logger.info("✅ 消费者连接测试完成")
        
    except Exception as e:
        logger.error(f"❌ 消费者连接失败: {e}")
        return False
    
    logger.info("🎉 Kafka连接测试全部通过")
    return True

if __name__ == "__main__":
    asyncio.run(test_kafka_connection())
