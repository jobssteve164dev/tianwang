"""
Kafka消息服务
负责接收和处理来自主服务器的安全数据
"""
import asyncio
import json
from typing import Dict, Any, List, Callable, Optional
from loguru import logger
from aiokafka import AIOKafkaConsumer, AIOKafkaProducer
from datetime import datetime

from ..config import config

class KafkaService:
    """Kafka消息服务"""
    
    def __init__(self):
        self.consumer: Optional[AIOKafkaConsumer] = None
        self.producer: Optional[AIOKafkaProducer] = None
        self.is_running = False
        self.message_handlers: Dict[str, Callable] = {}
        self.metrics = {
            "messages_received": 0,
            "messages_sent": 0,
            "processing_errors": 0,
            "last_message_time": None
        }
    
    async def start(self):
        """启动Kafka服务"""
        try:
            logger.info("正在启动Kafka服务...")
            
            # 初始化消费者
            self.consumer = AIOKafkaConsumer(
                config.kafka_topics["logs"],
                config.kafka_topics["alerts"],
                bootstrap_servers=config.kafka_brokers,
                group_id=config.kafka_group_id,
                value_deserializer=lambda m: json.loads(m.decode('utf-8')),
                enable_auto_commit=True,
                auto_offset_reset='latest'
            )
            
            # 初始化生产者
            self.producer = AIOKafkaProducer(
                bootstrap_servers=config.kafka_brokers,
                value_serializer=lambda v: json.dumps(v).encode('utf-8')
            )
            
            # 启动连接
            await self.consumer.start()
            await self.producer.start()
            
            self.is_running = True
            
            # 启动消息处理循环
            asyncio.create_task(self._message_processing_loop())
            
            logger.info("Kafka服务启动成功")
            
        except Exception as e:
            logger.error(f"Kafka服务启动失败: {e}")
            raise
    
    async def stop(self):
        """停止Kafka服务"""
        try:
            logger.info("正在停止Kafka服务...")
            
            self.is_running = False
            
            if self.consumer:
                await self.consumer.stop()
            
            if self.producer:
                await self.producer.stop()
            
            logger.info("Kafka服务已停止")
            
        except Exception as e:
            logger.error(f"停止Kafka服务失败: {e}")
            raise
    
    async def _message_processing_loop(self):
        """消息处理循环"""
        logger.info("开始Kafka消息处理循环")
        
        try:
            async for message in self.consumer:
                if not self.is_running:
                    break
                
                try:
                    # 更新指标
                    self.metrics["messages_received"] += 1
                    self.metrics["last_message_time"] = datetime.now().isoformat()
                    
                    # 解析消息
                    topic = message.topic
                    data = message.value
                    
                    logger.debug(f"收到消息，主题: {topic}, 数据大小: {len(str(data))}")
                    
                    # 根据主题处理消息
                    if topic == config.kafka_topics["logs"]:
                        await self._handle_security_log(data)
                    elif topic == config.kafka_topics["alerts"]:
                        await self._handle_security_alert(data)
                    else:
                        logger.warning(f"未知的消息主题: {topic}")
                    
                except Exception as e:
                    logger.error(f"消息处理失败: {e}")
                    self.metrics["processing_errors"] += 1
                    
        except Exception as e:
            logger.error(f"消息处理循环异常: {e}")
            
        logger.info("Kafka消息处理循环结束")
    
    async def _handle_security_log(self, data: Dict[str, Any]):
        """处理安全日志"""
        try:
            # 调用注册的处理器
            handler = self.message_handlers.get("security_log")
            if handler:
                await handler(data)
            else:
                logger.debug("未注册安全日志处理器")
                
        except Exception as e:
            logger.error(f"安全日志处理失败: {e}")
            raise
    
    async def _handle_security_alert(self, data: Dict[str, Any]):
        """处理安全告警"""
        try:
            # 调用注册的处理器
            handler = self.message_handlers.get("security_alert")
            if handler:
                await handler(data)
            else:
                logger.debug("未注册安全告警处理器")
                
        except Exception as e:
            logger.error(f"安全告警处理失败: {e}")
            raise
    
    def register_handler(self, message_type: str, handler: Callable):
        """注册消息处理器"""
        self.message_handlers[message_type] = handler
        logger.info(f"已注册消息处理器: {message_type}")
    
    async def send_analysis_result(self, result: Dict[str, Any]):
        """发送分析结果"""
        try:
            if not self.producer:
                raise RuntimeError("Kafka生产者未初始化")
            
            # 添加时间戳
            result["timestamp"] = datetime.now().isoformat()
            result["source"] = "ai-engine"
            
            # 发送到动作主题
            await self.producer.send_and_wait(
                config.kafka_topics["actions"],
                result
            )
            
            self.metrics["messages_sent"] += 1
            logger.debug(f"已发送分析结果: {result.get('type', 'unknown')}")
            
        except Exception as e:
            logger.error(f"发送分析结果失败: {e}")
            raise
    
    async def send_threat_alert(self, threat_info: Dict[str, Any]):
        """发送威胁告警"""
        try:
            if not self.producer:
                raise RuntimeError("Kafka生产者未初始化")
            
            alert = {
                "type": "threat_detected",
                "threat_info": threat_info,
                "timestamp": datetime.now().isoformat(),
                "source": "ai-engine",
                "severity": threat_info.get("severity", "medium")
            }
            
            # 发送告警
            await self.producer.send_and_wait(
                config.kafka_topics["alerts"],
                alert
            )
            
            self.metrics["messages_sent"] += 1
            logger.info(f"已发送威胁告警: {threat_info.get('threat_type', 'unknown')}")
            
        except Exception as e:
            logger.error(f"发送威胁告警失败: {e}")
            raise
    
    async def send_protection_action(self, action: Dict[str, Any]):
        """发送防护动作"""
        try:
            if not self.producer:
                raise RuntimeError("Kafka生产者未初始化")
            
            action_message = {
                "type": "protection_action",
                "action": action,
                "timestamp": datetime.now().isoformat(),
                "source": "ai-engine"
            }
            
            # 发送到动作主题
            await self.producer.send_and_wait(
                config.kafka_topics["actions"],
                action_message
            )
            
            self.metrics["messages_sent"] += 1
            logger.info(f"已发送防护动作: {action.get('action_type', 'unknown')}")
            
        except Exception as e:
            logger.error(f"发送防护动作失败: {e}")
            raise
    
    def is_healthy(self) -> bool:
        """检查服务健康状态"""
        return self.is_running and self.consumer is not None and self.producer is not None
    
    def get_metrics(self) -> Dict[str, Any]:
        """获取服务指标"""
        return {
            "service_status": "healthy" if self.is_healthy() else "unhealthy",
            "is_running": self.is_running,
            "handlers_registered": list(self.message_handlers.keys()),
            "metrics": self.metrics,
            "timestamp": datetime.now().isoformat()
        }
    
    async def get_consumer_info(self) -> Dict[str, Any]:
        """获取消费者信息"""
        try:
            if not self.consumer:
                return {"status": "not_initialized"}
            
            # 获取分区信息
            partitions = self.consumer.assignment()
            partition_info = []
            
            for partition in partitions:
                try:
                    position = await self.consumer.position(partition)
                    partition_info.append({
                        "topic": partition.topic,
                        "partition": partition.partition,
                        "position": position
                    })
                except Exception as e:
                    logger.warning(f"获取分区信息失败: {e}")
            
            return {
                "status": "initialized",
                "subscribed_topics": list(self.consumer.subscription()),
                "partitions": partition_info,
                "group_id": config.kafka_group_id
            }
            
        except Exception as e:
            logger.error(f"获取消费者信息失败: {e}")
            return {"status": "error", "error": str(e)} 