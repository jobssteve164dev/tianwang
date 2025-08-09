"""
实时分析管道服务
负责接收Kafka消息流，进行实时威胁分析，并触发相应的防护动作
"""

import asyncio
import json
import time
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass, asdict
from datetime import datetime, timedelta
from enum import Enum
from loguru import logger

from .kafka_service import KafkaService
from .hybrid_inference_engine import HybridInferenceEngine, SecurityEvent, InferenceResult, ThreatLevel
from .rule_engine import RuleEngine
from .alert_rule_engine import AlertRuleEngine
from .fusion_decision_engine import FusionDecisionEngine, DecisionContext
from ..config import config
from ..utils.data_processor import DataProcessor


class AnalysisMode(Enum):
    """分析模式枚举"""
    RULE_ONLY = "rule_only"           # 仅使用规则引擎
    AI_ONLY = "ai_only"               # 仅使用AI模型
    HYBRID = "hybrid"                 # 混合模式（默认）
    FAST_TRACK = "fast_track"         # 快速通道（高优先级威胁）


class ActionType(Enum):
    """防护动作类型"""
    BLOCK_IP = "block_ip"
    BLOCK_DOMAIN = "block_domain"
    KILL_PROCESS = "kill_process"
    ISOLATE_DEVICE = "isolate_device"
    NOTIFY_ADMIN = "notify_admin"
    LOG_EVENT = "log_event"


@dataclass
class AnalysisContext:
    """分析上下文"""
    event_id: str
    timestamp: datetime
    source_agent: str
    event_type: str
    priority: int
    analysis_mode: AnalysisMode
    metadata: Dict[str, Any]


@dataclass
class ThreatDetection:
    """威胁检测结果"""
    threat_id: str
    threat_type: str
    threat_level: ThreatLevel
    confidence: float
    source_event: SecurityEvent
    analysis_result: InferenceResult
    context: AnalysisContext
    recommended_actions: List[Dict[str, Any]]
    created_at: datetime


class RealtimeAnalysisPipeline:
    """
    实时分析管道
    整合Kafka消息处理、混合AI分析和威胁响应的完整流程
    """
    
    def __init__(self):
        self.kafka_service = KafkaService()
        self.hybrid_engine = HybridInferenceEngine()
        self.rule_engine = RuleEngine()
        self.data_processor = DataProcessor()
        
        # 新增：告警规则引擎和融合决策引擎
        self.alert_rule_engine = AlertRuleEngine()
        self.fusion_engine = FusionDecisionEngine()
        
        # 运行状态
        self.is_running = False
        self.pipeline_tasks: List[asyncio.Task] = []
        
        # 配置参数
        self.config = {
            "batch_size": 50,                    # 批处理大小
            "batch_timeout": 5.0,                # 批处理超时（秒）
            "max_concurrent_analysis": 20,       # 最大并发分析数
            "threat_threshold": 0.7,             # 威胁检测阈值
            "high_priority_threshold": 0.9,      # 高优先级威胁阈值
            "analysis_timeout": 30.0,            # 分析超时时间
        }
        
        # 性能指标
        self.metrics = {
            "events_processed": 0,
            "threats_detected": 0,
            "actions_triggered": 0,
            "processing_errors": 0,
            "avg_processing_time": 0.0,
            "pipeline_uptime": 0,
            "last_event_time": None,
            "throughput_per_second": 0.0
        }
        
        # 事件缓冲区
        self.event_buffer: List[Tuple[Dict[str, Any], AnalysisContext]] = []
        self.buffer_lock = asyncio.Lock()
        
        # 威胁检测缓存
        self.threat_cache: Dict[str, ThreatDetection] = {}
        self.cache_ttl = timedelta(hours=1)
        
        logger.info("实时分析管道初始化完成")
    
    async def start(self):
        """启动实时分析管道"""
        try:
            logger.info("正在启动实时分析管道...")
            
            # 启动Kafka服务
            await self.kafka_service.start()
            
            # 注册消息处理器
            self.kafka_service.register_handler("security_log", self._handle_security_log)
            self.kafka_service.register_handler("security_alert", self._handle_security_alert)
            
            # 启动分析管道任务
            self.pipeline_tasks = [
                asyncio.create_task(self._batch_processing_loop()),
                asyncio.create_task(self._metrics_collection_loop()),
                asyncio.create_task(self._cache_cleanup_loop())
            ]
            
            self.is_running = True
            self.metrics["pipeline_uptime"] = time.time()
            
            logger.info("实时分析管道启动成功")
            
        except Exception as e:
            logger.error(f"启动实时分析管道失败: {e}")
            await self.stop()
            raise
    
    async def stop(self):
        """停止实时分析管道"""
        try:
            logger.info("正在停止实时分析管道...")
            
            self.is_running = False
            
            # 停止管道任务
            for task in self.pipeline_tasks:
                if not task.done():
                    task.cancel()
                    try:
                        await task
                    except asyncio.CancelledError:
                        pass
            
            # 处理剩余缓冲区事件
            if self.event_buffer:
                logger.info(f"处理剩余的 {len(self.event_buffer)} 个事件...")
                await self._process_event_batch(self.event_buffer)
            
            # 停止Kafka服务
            await self.kafka_service.stop()
            
            logger.info("实时分析管道已停止")
            
        except Exception as e:
            logger.error(f"停止实时分析管道失败: {e}")
    
    async def _handle_security_log(self, log_data: Dict[str, Any]):
        """处理安全日志"""
        try:
            # 创建分析上下文
            context = AnalysisContext(
                event_id=log_data.get("event_id", f"log_{int(time.time() * 1000)}"),
                timestamp=datetime.fromisoformat(log_data.get("timestamp", datetime.now().isoformat())),
                source_agent=log_data.get("agent_id", "unknown"),
                event_type=log_data.get("event_type", "security_log"),
                priority=self._calculate_priority(log_data),
                analysis_mode=self._determine_analysis_mode(log_data),
                metadata=log_data.get("metadata", {})
            )
            
            # 添加到事件缓冲区
            async with self.buffer_lock:
                self.event_buffer.append((log_data, context))
                
                # 如果缓冲区满了或有高优先级事件，立即处理
                if (len(self.event_buffer) >= self.config["batch_size"] or 
                    context.priority >= 8):
                    await self._flush_buffer()
            
        except Exception as e:
            logger.error(f"处理安全日志失败: {e}")
            self.metrics["processing_errors"] += 1
    
    async def _handle_security_alert(self, alert_data: Dict[str, Any]):
        """处理安全告警"""
        try:
            # 安全告警通常优先级较高，直接处理
            context = AnalysisContext(
                event_id=alert_data.get("alert_id", f"alert_{int(time.time() * 1000)}"),
                timestamp=datetime.fromisoformat(alert_data.get("timestamp", datetime.now().isoformat())),
                source_agent=alert_data.get("agent_id", "unknown"),
                event_type="security_alert",
                priority=9,  # 告警默认高优先级
                analysis_mode=AnalysisMode.FAST_TRACK,
                metadata=alert_data.get("metadata", {})
            )
            
            # 立即分析处理
            await self._analyze_single_event(alert_data, context)
            
        except Exception as e:
            logger.error(f"处理安全告警失败: {e}")
            self.metrics["processing_errors"] += 1
    
    async def _batch_processing_loop(self):
        """批处理循环"""
        logger.info("启动批处理循环")
        
        while self.is_running:
            try:
                await asyncio.sleep(self.config["batch_timeout"])
                
                async with self.buffer_lock:
                    if self.event_buffer:
                        await self._flush_buffer()
                        
            except Exception as e:
                logger.error(f"批处理循环异常: {e}")
                await asyncio.sleep(1)
    
    async def _flush_buffer(self):
        """清空缓冲区并处理事件"""
        if not self.event_buffer:
            return
        
        batch = self.event_buffer.copy()
        self.event_buffer.clear()
        
        # 异步处理批次
        asyncio.create_task(self._process_event_batch(batch))
    
    async def _process_event_batch(self, batch: List[Tuple[Dict[str, Any], AnalysisContext]]):
        """处理事件批次"""
        try:
            logger.debug(f"开始处理事件批次，大小: {len(batch)}")
            start_time = time.time()
            
            # 创建分析任务
            analysis_tasks = []
            semaphore = asyncio.Semaphore(self.config["max_concurrent_analysis"])
            
            for event_data, context in batch:
                task = asyncio.create_task(
                    self._analyze_event_with_semaphore(semaphore, event_data, context)
                )
                analysis_tasks.append(task)
            
            # 等待所有分析完成
            results = await asyncio.gather(*analysis_tasks, return_exceptions=True)
            
            # 处理结果
            successful_analyses = 0
            for result in results:
                if isinstance(result, Exception):
                    logger.error(f"事件分析失败: {result}")
                    self.metrics["processing_errors"] += 1
                else:
                    successful_analyses += 1
            
            # 更新指标
            processing_time = time.time() - start_time
            self.metrics["events_processed"] += len(batch)
            self.metrics["avg_processing_time"] = (
                (self.metrics["avg_processing_time"] * (self.metrics["events_processed"] - len(batch)) + 
                 processing_time) / self.metrics["events_processed"]
            )
            
            logger.debug(f"批次处理完成，成功: {successful_analyses}/{len(batch)}, 耗时: {processing_time:.2f}s")
            
        except Exception as e:
            logger.error(f"处理事件批次失败: {e}")
            self.metrics["processing_errors"] += len(batch)
    
    async def _analyze_event_with_semaphore(
        self, 
        semaphore: asyncio.Semaphore, 
        event_data: Dict[str, Any], 
        context: AnalysisContext
    ):
        """使用信号量控制并发的事件分析"""
        async with semaphore:
            return await self._analyze_single_event(event_data, context)
    
    async def _analyze_single_event(self, event_data: Dict[str, Any], context: AnalysisContext):
        """分析单个事件"""
        try:
            start_time = time.time()
            
            # 创建决策上下文
            decision_context = DecisionContext(
                event_id=context.event_id,
                event_type=context.event_type,
                source_ip=event_data.get("source_ip", "unknown"),
                timestamp=context.timestamp,
                priority=context.priority,
                metadata=context.metadata
            )
            
            # 使用融合决策引擎进行分析
            if context.analysis_mode == AnalysisMode.FAST_TRACK:
                # 快速通道：使用规则优先策略
                from .fusion_decision_engine import DecisionStrategy
                fusion_result = await self.fusion_engine.make_decision(
                    event_data, decision_context, DecisionStrategy.RULE_PRIORITY
                )
            elif context.analysis_mode == AnalysisMode.RULE_ONLY:
                # 仅规则分析：使用规则优先策略
                from .fusion_decision_engine import DecisionStrategy
                fusion_result = await self.fusion_engine.make_decision(
                    event_data, decision_context, DecisionStrategy.RULE_PRIORITY
                )
            elif context.analysis_mode == AnalysisMode.AI_ONLY:
                # 仅AI分析：使用AI优先策略
                from .fusion_decision_engine import DecisionStrategy
                fusion_result = await self.fusion_engine.make_decision(
                    event_data, decision_context, DecisionStrategy.AI_PRIORITY
                )
            else:
                # 混合分析（默认）：使用自适应策略
                fusion_result = await self.fusion_engine.make_decision(event_data, decision_context)
            
            # 使用融合结果创建分析结果
            analysis_result = fusion_result.ai_result
            analysis_result.threat_level = fusion_result.final_threat_level
            analysis_result.confidence = fusion_result.final_confidence
            
            # 评估威胁级别
            if fusion_result.final_confidence >= self.config["threat_threshold"]:
                # 转换为SecurityEvent用于威胁检测
                security_event = self._convert_to_security_event(event_data, context)
                
                threat_detection = await self._create_threat_detection_from_fusion(
                    security_event, fusion_result, context
                )
                await self._handle_threat_detection(threat_detection)
            
            # 更新指标
            self.metrics["last_event_time"] = datetime.now().isoformat()
            
            processing_time = time.time() - start_time
            logger.debug(f"融合分析完成: {context.event_id}, 耗时: {processing_time:.3f}s, "
                        f"威胁级别: {fusion_result.final_threat_level.value}, "
                        f"置信度: {fusion_result.final_confidence:.3f}, "
                        f"策略: {fusion_result.decision_strategy.value}")
            
            return analysis_result
            
        except Exception as e:
            logger.error(f"分析事件失败 {context.event_id}: {e}")
            raise
    
    async def _fast_track_analysis(self, event: SecurityEvent) -> InferenceResult:
        """快速通道分析"""
        # 优先使用规则引擎进行快速检测
        rule_result = await self.rule_engine.analyze_event(asdict(event))
        
        if rule_result and rule_result.get("confidence", 0) > 0.8:
            return InferenceResult(
                threat_level=ThreatLevel(rule_result.get("threat_level", "medium")),
                confidence=rule_result.get("confidence", 0.8),
                method="rule_engine",
                details=rule_result,
                processing_time=0.01,
                cost=0.0
            )
        
        # 如果规则引擎置信度不够，使用混合分析
        return await self.hybrid_engine.analyze_security_event(event)
    
    async def _rule_only_analysis(self, event: SecurityEvent) -> InferenceResult:
        """仅规则分析"""
        rule_result = await self.rule_engine.analyze_event(asdict(event))
        
        return InferenceResult(
            threat_level=ThreatLevel(rule_result.get("threat_level", "low")),
            confidence=rule_result.get("confidence", 0.5),
            method="rule_engine",
            details=rule_result or {},
            processing_time=0.01,
            cost=0.0
        )
    
    async def _ai_only_analysis(self, event: SecurityEvent) -> InferenceResult:
        """仅AI分析"""
        # 这里可以直接调用AI服务，暂时使用混合引擎的AI部分
        return await self.hybrid_engine.analyze_security_event(event, method="LOCAL_MODEL")
    
    def _convert_to_security_event(self, event_data: Dict[str, Any], context: AnalysisContext) -> SecurityEvent:
        """将原始事件数据转换为SecurityEvent对象"""
        return SecurityEvent(
            event_id=context.event_id,
            timestamp=int(context.timestamp.timestamp()),
            event_type=context.event_type,
            source_ip=event_data.get("source_ip", "unknown"),
            destination_ip=event_data.get("destination_ip", "unknown"),
            protocol=event_data.get("protocol", "unknown"),
            payload=event_data.get("payload"),
            features=self.data_processor.extract_features(event_data),
            raw_data=event_data
        )
    
    async def _create_threat_detection(
        self, 
        event: SecurityEvent, 
        result: InferenceResult, 
        context: AnalysisContext
    ) -> ThreatDetection:
        """创建威胁检测结果"""
        threat_id = f"threat_{event.event_id}_{int(time.time())}"
        
        # 生成推荐动作
        recommended_actions = await self._generate_recommended_actions(result)
        
        threat_detection = ThreatDetection(
            threat_id=threat_id,
            threat_type=result.details.get("threat_type", "unknown"),
            threat_level=result.threat_level,
            confidence=result.confidence,
            source_event=event,
            analysis_result=result,
            context=context,
            recommended_actions=recommended_actions,
            created_at=datetime.now()
        )
        
        # 缓存威胁检测结果
        self.threat_cache[threat_id] = threat_detection
        
        return threat_detection
    
    async def _create_threat_detection_from_fusion(
        self, 
        event: SecurityEvent, 
        fusion_result, 
        context: AnalysisContext
    ) -> ThreatDetection:
        """从融合结果创建威胁检测结果"""
        threat_id = f"threat_{event.event_id}_{int(time.time())}"
        
        # 使用融合结果的推荐动作
        recommended_actions = fusion_result.recommended_actions
        
        threat_detection = ThreatDetection(
            threat_id=threat_id,
            threat_type=fusion_result.ai_result.details.get("threat_type", "fusion_detected"),
            threat_level=fusion_result.final_threat_level,
            confidence=fusion_result.final_confidence,
            source_event=event,
            analysis_result=fusion_result.ai_result,
            context=context,
            recommended_actions=recommended_actions,
            created_at=datetime.now()
        )
        
        # 缓存威胁检测结果
        self.threat_cache[threat_id] = threat_detection
        
        return threat_detection
    
    async def _generate_recommended_actions(self, result: InferenceResult) -> List[Dict[str, Any]]:
        """生成推荐的防护动作"""
        actions = []
        
        threat_level = result.threat_level
        threat_type = result.details.get("threat_type", "unknown")
        
        if threat_level in [ThreatLevel.HIGH, ThreatLevel.CRITICAL]:
            if "malware" in threat_type.lower():
                actions.append({
                    "action_type": ActionType.KILL_PROCESS.value,
                    "priority": 9,
                    "parameters": {"process_name": result.details.get("process_name")}
                })
            
            if "network_attack" in threat_type.lower():
                actions.append({
                    "action_type": ActionType.BLOCK_IP.value,
                    "priority": 8,
                    "parameters": {"ip_address": result.details.get("source_ip")}
                })
            
            # 高危威胁总是通知管理员
            actions.append({
                "action_type": ActionType.NOTIFY_ADMIN.value,
                "priority": 7,
                "parameters": {
                    "threat_level": threat_level.value,
                    "message": f"检测到{threat_level.value}级威胁: {threat_type}"
                }
            })
        
        # 所有威胁都记录日志
        actions.append({
            "action_type": ActionType.LOG_EVENT.value,
            "priority": 1,
            "parameters": {"analysis_result": asdict(result)}
        })
        
        return actions
    
    async def _handle_threat_detection(self, threat: ThreatDetection):
        """处理威胁检测结果"""
        try:
            logger.warning(f"检测到威胁: {threat.threat_id}, 级别: {threat.threat_level.value}, 置信度: {threat.confidence:.2f}")
            
            # 发送威胁告警
            await self.kafka_service.send_threat_alert({
                "threat_id": threat.threat_id,
                "threat_type": threat.threat_type,
                "threat_level": threat.threat_level.value,
                "confidence": threat.confidence,
                "source_agent": threat.context.source_agent,
                "event_id": threat.source_event.event_id,
                "analysis_method": threat.analysis_result.method,
                "details": threat.analysis_result.details
            })
            
            # 执行推荐动作
            for action in threat.recommended_actions:
                await self.kafka_service.send_protection_action(action)
            
            # 更新指标
            self.metrics["threats_detected"] += 1
            self.metrics["actions_triggered"] += len(threat.recommended_actions)
            
        except Exception as e:
            logger.error(f"处理威胁检测失败: {e}")
    
    def _calculate_priority(self, event_data: Dict[str, Any]) -> int:
        """计算事件优先级 (1-10, 10最高)"""
        priority = 5  # 默认优先级
        
        # 根据事件类型调整优先级
        event_type = event_data.get("event_type", "").lower()
        if "critical" in event_type or "attack" in event_type:
            priority = 9
        elif "warning" in event_type or "suspicious" in event_type:
            priority = 7
        elif "error" in event_type:
            priority = 6
        
        # 根据来源调整优先级
        source_ip = event_data.get("source_ip", "")
        if source_ip and self._is_external_ip(source_ip):
            priority += 1
        
        return min(priority, 10)
    
    def _determine_analysis_mode(self, event_data: Dict[str, Any]) -> AnalysisMode:
        """确定分析模式"""
        event_type = event_data.get("event_type", "").lower()
        
        # 已知攻击模式优先使用规则引擎
        if any(keyword in event_type for keyword in ["ddos", "brute_force", "sql_injection"]):
            return AnalysisMode.RULE_ONLY
        
        # 未知或复杂模式使用混合分析
        if "unknown" in event_type or "anomaly" in event_type:
            return AnalysisMode.HYBRID
        
        return AnalysisMode.HYBRID  # 默认混合模式
    
    def _is_external_ip(self, ip: str) -> bool:
        """判断是否为外部IP"""
        # 简单实现，实际应该更完善
        private_ranges = ["192.168.", "10.", "172.16.", "127."]
        return not any(ip.startswith(range_prefix) for range_prefix in private_ranges)
    
    async def _metrics_collection_loop(self):
        """指标收集循环"""
        last_processed = 0
        
        while self.is_running:
            try:
                await asyncio.sleep(60)  # 每分钟更新一次吞吐量
                
                current_processed = self.metrics["events_processed"]
                self.metrics["throughput_per_second"] = (current_processed - last_processed) / 60
                last_processed = current_processed
                
            except Exception as e:
                logger.error(f"指标收集异常: {e}")
    
    async def _cache_cleanup_loop(self):
        """缓存清理循环"""
        while self.is_running:
            try:
                await asyncio.sleep(3600)  # 每小时清理一次
                
                current_time = datetime.now()
                expired_keys = []
                
                for threat_id, threat in self.threat_cache.items():
                    if current_time - threat.created_at > self.cache_ttl:
                        expired_keys.append(threat_id)
                
                for key in expired_keys:
                    del self.threat_cache[key]
                
                if expired_keys:
                    logger.info(f"清理过期威胁缓存: {len(expired_keys)} 条记录")
                
            except Exception as e:
                logger.error(f"缓存清理异常: {e}")
    
    def get_pipeline_status(self) -> Dict[str, Any]:
        """获取管道状态"""
        uptime = time.time() - self.metrics["pipeline_uptime"] if self.metrics["pipeline_uptime"] else 0
        
        return {
            "status": "running" if self.is_running else "stopped",
            "uptime_seconds": uptime,
            "kafka_status": self.kafka_service.is_healthy(),
            "buffer_size": len(self.event_buffer),
            "cache_size": len(self.threat_cache),
            "metrics": self.metrics,
            "config": self.config,
            "timestamp": datetime.now().isoformat()
        }
    
    def get_threat_summary(self) -> Dict[str, Any]:
        """获取威胁摘要"""
        if not self.threat_cache:
            return {"total_threats": 0, "threats_by_level": {}}
        
        threats_by_level = {}
        for threat in self.threat_cache.values():
            level = threat.threat_level.value
            threats_by_level[level] = threats_by_level.get(level, 0) + 1
        
        return {
            "total_threats": len(self.threat_cache),
            "threats_by_level": threats_by_level,
            "latest_threat": max(self.threat_cache.values(), key=lambda t: t.created_at).threat_id if self.threat_cache else None
        } 