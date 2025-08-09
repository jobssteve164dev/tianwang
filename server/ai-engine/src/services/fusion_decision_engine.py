"""
融合决策引擎
实现规则匹配与AI分析的智能融合决策，提供最优的威胁检测和响应策略
"""

import asyncio
import time
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass, asdict
from datetime import datetime
from enum import Enum
from loguru import logger

from .hybrid_inference_engine import HybridInferenceEngine, InferenceResult, ThreatLevel, InferenceMethod
from .alert_rule_engine import AlertRuleEngine, RuleEvaluation, RuleSeverity
from .rule_engine import RuleEngine


class DecisionStrategy(Enum):
    """决策策略"""
    RULE_PRIORITY = "rule_priority"          # 规则优先
    AI_PRIORITY = "ai_priority"              # AI优先
    CONSENSUS = "consensus"                  # 一致性决策
    WEIGHTED_FUSION = "weighted_fusion"      # 加权融合
    ADAPTIVE = "adaptive"                    # 自适应决策


class ConfidenceLevel(Enum):
    """置信度级别"""
    VERY_LOW = "very_low"      # 0.0 - 0.3
    LOW = "low"                # 0.3 - 0.5
    MEDIUM = "medium"          # 0.5 - 0.7
    HIGH = "high"              # 0.7 - 0.9
    VERY_HIGH = "very_high"    # 0.9 - 1.0


@dataclass
class DecisionContext:
    """决策上下文"""
    event_id: str
    event_type: str
    source_ip: str
    timestamp: datetime
    priority: int
    metadata: Dict[str, Any]


@dataclass
class FusionResult:
    """融合决策结果"""
    decision_id: str
    final_threat_level: ThreatLevel
    final_confidence: float
    confidence_level: ConfidenceLevel
    decision_strategy: DecisionStrategy
    rule_results: List[RuleEvaluation]
    ai_result: InferenceResult
    fusion_reasoning: str
    recommended_actions: List[Dict[str, Any]]
    processing_time: float
    created_at: datetime


class FusionDecisionEngine:
    """
    融合决策引擎
    智能融合规则引擎和AI分析的结果，提供最优的威胁检测决策
    """
    
    def __init__(self):
        self.hybrid_engine = HybridInferenceEngine()
        self.alert_rule_engine = AlertRuleEngine()
        self.rule_engine = RuleEngine()
        
        # 决策配置
        self.config = {
            "default_strategy": DecisionStrategy.ADAPTIVE,
            "rule_weight": 0.4,              # 规则权重
            "ai_weight": 0.6,                # AI权重
            "consensus_threshold": 0.8,       # 一致性阈值
            "confidence_threshold": 0.7,      # 最终置信度阈值
            "adaptive_learning": True,        # 是否启用自适应学习
            "performance_window": 3600,       # 性能统计窗口（秒）
        }
        
        # 性能统计
        self.performance_stats = {
            "rule_engine": {"accuracy": 0.85, "precision": 0.82, "recall": 0.88, "f1_score": 0.85},
            "ai_engine": {"accuracy": 0.92, "precision": 0.90, "recall": 0.94, "f1_score": 0.92},
            "fusion_engine": {"accuracy": 0.95, "precision": 0.93, "recall": 0.97, "f1_score": 0.95}
        }
        
        # 决策历史
        self.decision_history: List[FusionResult] = []
        self.max_history_size = 10000
        
        # 运行指标
        self.metrics = {
            "decisions_made": 0,
            "rule_agreements": 0,
            "ai_agreements": 0,
            "fusion_overrides": 0,
            "avg_processing_time": 0.0,
            "avg_confidence": 0.0,
            "threat_detection_rate": 0.0,
            "false_positive_rate": 0.0
        }
        
        logger.info("融合决策引擎初始化完成")
    
    async def make_decision(
        self, 
        event_data: Dict[str, Any], 
        context: DecisionContext,
        strategy: Optional[DecisionStrategy] = None
    ) -> FusionResult:
        """
        做出融合决策
        
        Args:
            event_data: 事件数据
            context: 决策上下文
            strategy: 决策策略（可选，默认使用配置的策略）
        
        Returns:
            FusionResult: 融合决策结果
        """
        try:
            start_time = time.time()
            decision_id = f"decision_{context.event_id}_{int(time.time() * 1000)}"
            
            # 确定决策策略
            decision_strategy = strategy or self.config["default_strategy"]
            if decision_strategy == DecisionStrategy.ADAPTIVE:
                decision_strategy = self._select_adaptive_strategy(event_data, context)
            
            # 并行执行AI分析和规则评估
            ai_task = asyncio.create_task(self._get_ai_analysis(event_data, context))
            rule_task = asyncio.create_task(self._get_rule_evaluations(event_data, context))
            
            # 等待结果
            ai_result, rule_results = await asyncio.gather(ai_task, rule_task)
            
            # 执行融合决策
            fusion_result = await self._execute_fusion_strategy(
                decision_id, decision_strategy, ai_result, rule_results, context
            )
            
            # 更新性能指标
            processing_time = time.time() - start_time
            self._update_metrics(fusion_result, processing_time)
            
            # 保存决策历史
            self._save_decision_history(fusion_result)
            
            logger.info(f"融合决策完成: {decision_id}, 策略: {decision_strategy.value}, "
                       f"威胁级别: {fusion_result.final_threat_level.value}, "
                       f"置信度: {fusion_result.final_confidence:.3f}")
            
            return fusion_result
            
        except Exception as e:
            logger.error(f"融合决策失败: {e}")
            # 返回默认的安全决策
            return self._create_fallback_decision(context, str(e))
    
    async def _get_ai_analysis(self, event_data: Dict[str, Any], context: DecisionContext) -> InferenceResult:
        """获取AI分析结果"""
        try:
            # 转换为SecurityEvent格式
            from .hybrid_inference_engine import SecurityEvent
            
            security_event = SecurityEvent(
                event_id=context.event_id,
                timestamp=int(context.timestamp.timestamp()),
                event_type=context.event_type,
                source_ip=context.source_ip,
                destination_ip=event_data.get("destination_ip", "unknown"),
                protocol=event_data.get("protocol", "unknown"),
                payload=event_data.get("payload"),
                features=event_data.get("features", {}),
                raw_data=event_data
            )
            
            return await self.hybrid_engine.analyze_security_event(security_event)
            
        except Exception as e:
            logger.error(f"AI分析失败: {e}")
            # 返回默认结果
            return InferenceResult(
                threat_level=ThreatLevel.LOW,
                confidence=0.0,
                method=InferenceMethod.HYBRID,
                details={"error": str(e)},
                processing_time=0.0,
                cost=0.0
            )
    
    async def _get_rule_evaluations(
        self, 
        event_data: Dict[str, Any], 
        context: DecisionContext
    ) -> List[RuleEvaluation]:
        """获取规则评估结果"""
        try:
            # 创建一个临时的InferenceResult用于规则评估
            temp_result = InferenceResult(
                threat_level=ThreatLevel.MEDIUM,
                confidence=0.5,
                method=InferenceMethod.RULE_ENGINE,
                details={"event_type": context.event_type},
                processing_time=0.0
            )
            
            return await self.alert_rule_engine.evaluate_event(event_data, temp_result)
            
        except Exception as e:
            logger.error(f"规则评估失败: {e}")
            return []
    
    async def _execute_fusion_strategy(
        self,
        decision_id: str,
        strategy: DecisionStrategy,
        ai_result: InferenceResult,
        rule_results: List[RuleEvaluation],
        context: DecisionContext
    ) -> FusionResult:
        """执行融合策略"""
        
        if strategy == DecisionStrategy.RULE_PRIORITY:
            return await self._rule_priority_fusion(decision_id, ai_result, rule_results, context)
        elif strategy == DecisionStrategy.AI_PRIORITY:
            return await self._ai_priority_fusion(decision_id, ai_result, rule_results, context)
        elif strategy == DecisionStrategy.CONSENSUS:
            return await self._consensus_fusion(decision_id, ai_result, rule_results, context)
        elif strategy == DecisionStrategy.WEIGHTED_FUSION:
            return await self._weighted_fusion(decision_id, ai_result, rule_results, context)
        else:
            # 默认使用加权融合
            return await self._weighted_fusion(decision_id, ai_result, rule_results, context)
    
    async def _rule_priority_fusion(
        self,
        decision_id: str,
        ai_result: InferenceResult,
        rule_results: List[RuleEvaluation],
        context: DecisionContext
    ) -> FusionResult:
        """规则优先融合策略"""
        
        # 找到触发的最高优先级规则
        triggered_rules = [rule for rule in rule_results if rule.triggered]
        
        if triggered_rules:
            # 使用规则结果
            highest_confidence_rule = max(triggered_rules, key=lambda r: r.confidence)
            
            final_threat_level = self._map_rule_severity_to_threat_level(highest_confidence_rule)
            final_confidence = highest_confidence_rule.confidence
            reasoning = f"规则优先策略：触发规则 {highest_confidence_rule.rule_id}，置信度 {final_confidence:.3f}"
        else:
            # 没有规则触发，使用AI结果
            final_threat_level = ai_result.threat_level
            final_confidence = ai_result.confidence * 0.8  # 降权使用AI结果
            reasoning = f"规则优先策略：无规则触发，使用AI结果（降权），置信度 {final_confidence:.3f}"
        
        return self._create_fusion_result(
            decision_id, final_threat_level, final_confidence, DecisionStrategy.RULE_PRIORITY,
            rule_results, ai_result, reasoning, context
        )
    
    async def _ai_priority_fusion(
        self,
        decision_id: str,
        ai_result: InferenceResult,
        rule_results: List[RuleEvaluation],
        context: DecisionContext
    ) -> FusionResult:
        """AI优先融合策略"""
        
        # 优先使用AI结果
        final_threat_level = ai_result.threat_level
        final_confidence = ai_result.confidence
        
        # 如果有规则支持，提升置信度
        triggered_rules = [rule for rule in rule_results if rule.triggered]
        if triggered_rules:
            confidence_boost = min(0.1, len(triggered_rules) * 0.05)
            final_confidence = min(1.0, final_confidence + confidence_boost)
            reasoning = f"AI优先策略：AI置信度 {ai_result.confidence:.3f}，{len(triggered_rules)} 条规则支持，最终置信度 {final_confidence:.3f}"
        else:
            reasoning = f"AI优先策略：AI置信度 {final_confidence:.3f}，无规则支持"
        
        return self._create_fusion_result(
            decision_id, final_threat_level, final_confidence, DecisionStrategy.AI_PRIORITY,
            rule_results, ai_result, reasoning, context
        )
    
    async def _consensus_fusion(
        self,
        decision_id: str,
        ai_result: InferenceResult,
        rule_results: List[RuleEvaluation],
        context: DecisionContext
    ) -> FusionResult:
        """一致性融合策略"""
        
        # 计算AI和规则的威胁级别一致性
        triggered_rules = [rule for rule in rule_results if rule.triggered]
        
        if not triggered_rules:
            # 无规则触发，使用AI结果但降低置信度
            final_threat_level = ai_result.threat_level
            final_confidence = ai_result.confidence * 0.7
            reasoning = f"一致性策略：无规则支持AI结果，置信度降权至 {final_confidence:.3f}"
        else:
            # 检查一致性
            rule_threat_levels = [self._map_rule_severity_to_threat_level(rule) for rule in triggered_rules]
            ai_threat_level = ai_result.threat_level
            
            # 计算一致性分数
            consensus_score = self._calculate_consensus_score(ai_threat_level, rule_threat_levels)
            
            if consensus_score >= self.config["consensus_threshold"]:
                # 高一致性，使用更高的威胁级别和置信度
                final_threat_level = max([ai_threat_level] + rule_threat_levels, key=lambda x: self._threat_level_priority(x))
                rule_avg_confidence = sum(rule.confidence for rule in triggered_rules) / len(triggered_rules)
                final_confidence = min(1.0, (ai_result.confidence + rule_avg_confidence) / 2 + 0.1)
                reasoning = f"一致性策略：高度一致（{consensus_score:.3f}），最终置信度 {final_confidence:.3f}"
            else:
                # 低一致性，保守决策
                final_threat_level = ThreatLevel.MEDIUM
                final_confidence = min(ai_result.confidence, max(rule.confidence for rule in triggered_rules)) * 0.8
                reasoning = f"一致性策略：一致性较低（{consensus_score:.3f}），保守决策，置信度 {final_confidence:.3f}"
        
        return self._create_fusion_result(
            decision_id, final_threat_level, final_confidence, DecisionStrategy.CONSENSUS,
            rule_results, ai_result, reasoning, context
        )
    
    async def _weighted_fusion(
        self,
        decision_id: str,
        ai_result: InferenceResult,
        rule_results: List[RuleEvaluation],
        context: DecisionContext
    ) -> FusionResult:
        """加权融合策略"""
        
        # 计算规则引擎的综合结果
        triggered_rules = [rule for rule in rule_results if rule.triggered]
        
        if triggered_rules:
            # 计算规则的平均置信度和最高威胁级别
            rule_avg_confidence = sum(rule.confidence for rule in triggered_rules) / len(triggered_rules)
            rule_max_threat_level = max(
                [self._map_rule_severity_to_threat_level(rule) for rule in triggered_rules],
                key=lambda x: self._threat_level_priority(x)
            )
        else:
            rule_avg_confidence = 0.0
            rule_max_threat_level = ThreatLevel.LOW
        
        # 获取当前性能统计
        rule_performance = self.performance_stats["rule_engine"]["f1_score"]
        ai_performance = self.performance_stats["ai_engine"]["f1_score"]
        
        # 动态调整权重
        total_performance = rule_performance + ai_performance
        dynamic_rule_weight = rule_performance / total_performance
        dynamic_ai_weight = ai_performance / total_performance
        
        # 加权计算最终置信度
        final_confidence = (
            ai_result.confidence * dynamic_ai_weight + 
            rule_avg_confidence * dynamic_rule_weight
        )
        
        # 威胁级别选择（选择更高的威胁级别）
        ai_priority = self._threat_level_priority(ai_result.threat_level)
        rule_priority = self._threat_level_priority(rule_max_threat_level)
        
        if ai_priority >= rule_priority:
            final_threat_level = ai_result.threat_level
        else:
            final_threat_level = rule_max_threat_level
        
        reasoning = (f"加权融合策略：AI权重 {dynamic_ai_weight:.3f}（置信度 {ai_result.confidence:.3f}），"
                    f"规则权重 {dynamic_rule_weight:.3f}（置信度 {rule_avg_confidence:.3f}），"
                    f"最终置信度 {final_confidence:.3f}")
        
        return self._create_fusion_result(
            decision_id, final_threat_level, final_confidence, DecisionStrategy.WEIGHTED_FUSION,
            rule_results, ai_result, reasoning, context
        )
    
    def _select_adaptive_strategy(self, event_data: Dict[str, Any], context: DecisionContext) -> DecisionStrategy:
        """自适应策略选择"""
        
        # 根据事件类型选择策略
        event_type = context.event_type.lower()
        
        # 已知攻击模式，优先使用规则
        if any(keyword in event_type for keyword in ["ddos", "brute_force", "sql_injection", "xss"]):
            return DecisionStrategy.RULE_PRIORITY
        
        # 复杂或未知模式，优先使用AI
        if any(keyword in event_type for keyword in ["anomaly", "unknown", "advanced", "apt"]):
            return DecisionStrategy.AI_PRIORITY
        
        # 根据历史性能选择策略
        rule_performance = self.performance_stats["rule_engine"]["f1_score"]
        ai_performance = self.performance_stats["ai_engine"]["f1_score"]
        
        if abs(rule_performance - ai_performance) < 0.05:
            # 性能相近，使用加权融合
            return DecisionStrategy.WEIGHTED_FUSION
        elif rule_performance > ai_performance:
            return DecisionStrategy.RULE_PRIORITY
        else:
            return DecisionStrategy.AI_PRIORITY
    
    def _map_rule_severity_to_threat_level(self, rule_evaluation: RuleEvaluation) -> ThreatLevel:
        """将规则严重性映射到威胁级别"""
        # 这里需要根据具体的规则评估结果来映射
        # 简化实现，假设规则评估包含威胁级别信息
        severity_mapping = {
            "info": ThreatLevel.LOW,
            "low": ThreatLevel.LOW,
            "medium": ThreatLevel.MEDIUM,
            "high": ThreatLevel.HIGH,
            "critical": ThreatLevel.CRITICAL
        }
        
        # 从规则评估上下文中获取严重性
        severity = rule_evaluation.context.get("severity", "medium")
        return severity_mapping.get(severity, ThreatLevel.MEDIUM)
    
    def _threat_level_priority(self, threat_level: ThreatLevel) -> int:
        """威胁级别优先级"""
        priority_map = {
            ThreatLevel.LOW: 1,
            ThreatLevel.MEDIUM: 2,
            ThreatLevel.HIGH: 3,
            ThreatLevel.CRITICAL: 4
        }
        return priority_map.get(threat_level, 2)
    
    def _calculate_consensus_score(self, ai_level: ThreatLevel, rule_levels: List[ThreatLevel]) -> float:
        """计算一致性分数"""
        if not rule_levels:
            return 0.0
        
        ai_priority = self._threat_level_priority(ai_level)
        rule_priorities = [self._threat_level_priority(level) for level in rule_levels]
        
        # 计算AI与规则的平均差异
        avg_rule_priority = sum(rule_priorities) / len(rule_priorities)
        difference = abs(ai_priority - avg_rule_priority)
        
        # 转换为一致性分数（差异越小，一致性越高）
        max_difference = 3  # 最大可能差异
        consensus_score = 1.0 - (difference / max_difference)
        
        return max(0.0, consensus_score)
    
    def _get_confidence_level(self, confidence: float) -> ConfidenceLevel:
        """获取置信度级别"""
        if confidence >= 0.9:
            return ConfidenceLevel.VERY_HIGH
        elif confidence >= 0.7:
            return ConfidenceLevel.HIGH
        elif confidence >= 0.5:
            return ConfidenceLevel.MEDIUM
        elif confidence >= 0.3:
            return ConfidenceLevel.LOW
        else:
            return ConfidenceLevel.VERY_LOW
    
    def _create_fusion_result(
        self,
        decision_id: str,
        threat_level: ThreatLevel,
        confidence: float,
        strategy: DecisionStrategy,
        rule_results: List[RuleEvaluation],
        ai_result: InferenceResult,
        reasoning: str,
        context: DecisionContext
    ) -> FusionResult:
        """创建融合决策结果"""
        
        # 生成推荐动作
        recommended_actions = self._generate_fusion_actions(threat_level, confidence, rule_results, ai_result)
        
        return FusionResult(
            decision_id=decision_id,
            final_threat_level=threat_level,
            final_confidence=confidence,
            confidence_level=self._get_confidence_level(confidence),
            decision_strategy=strategy,
            rule_results=rule_results,
            ai_result=ai_result,
            fusion_reasoning=reasoning,
            recommended_actions=recommended_actions,
            processing_time=0.0,  # 将在调用方设置
            created_at=datetime.now()
        )
    
    def _generate_fusion_actions(
        self,
        threat_level: ThreatLevel,
        confidence: float,
        rule_results: List[RuleEvaluation],
        ai_result: InferenceResult
    ) -> List[Dict[str, Any]]:
        """生成融合推荐动作"""
        actions = []
        
        # 基于威胁级别和置信度生成动作
        if threat_level == ThreatLevel.CRITICAL and confidence >= 0.9:
            actions.extend([
                {"action_type": "emergency_response", "priority": 10},
                {"action_type": "isolate_device", "priority": 9},
                {"action_type": "notify_admin", "priority": 8}
            ])
        elif threat_level == ThreatLevel.HIGH and confidence >= 0.8:
            actions.extend([
                {"action_type": "block_ip", "priority": 8},
                {"action_type": "notify_admin", "priority": 7},
                {"action_type": "quarantine", "priority": 6}
            ])
        elif threat_level == ThreatLevel.MEDIUM and confidence >= 0.7:
            actions.extend([
                {"action_type": "monitor", "priority": 5},
                {"action_type": "log_enhanced", "priority": 4}
            ])
        
        # 添加基础日志动作
        actions.append({"action_type": "log_event", "priority": 1})
        
        return actions
    
    def _create_fallback_decision(self, context: DecisionContext, error_message: str) -> FusionResult:
        """创建回退决策"""
        return FusionResult(
            decision_id=f"fallback_{context.event_id}",
            final_threat_level=ThreatLevel.MEDIUM,
            final_confidence=0.5,
            confidence_level=ConfidenceLevel.MEDIUM,
            decision_strategy=DecisionStrategy.WEIGHTED_FUSION,
            rule_results=[],
            ai_result=InferenceResult(
                threat_level=ThreatLevel.MEDIUM,
                confidence=0.5,
                method=InferenceMethod.HYBRID,
                details={"error": error_message},
                processing_time=0.0
            ),
            fusion_reasoning=f"回退决策：发生错误 - {error_message}",
            recommended_actions=[{"action_type": "log_event", "priority": 1}],
            processing_time=0.0,
            created_at=datetime.now()
        )
    
    def _update_metrics(self, result: FusionResult, processing_time: float):
        """更新性能指标"""
        self.metrics["decisions_made"] += 1
        
        # 更新平均处理时间
        total_time = self.metrics["avg_processing_time"] * (self.metrics["decisions_made"] - 1) + processing_time
        self.metrics["avg_processing_time"] = total_time / self.metrics["decisions_made"]
        
        # 更新平均置信度
        total_confidence = self.metrics["avg_confidence"] * (self.metrics["decisions_made"] - 1) + result.final_confidence
        self.metrics["avg_confidence"] = total_confidence / self.metrics["decisions_made"]
        
        # 统计规则和AI的一致性
        triggered_rules = [r for r in result.rule_results if r.triggered]
        if triggered_rules and result.ai_result.confidence > 0.7:
            self.metrics["rule_agreements"] += 1
        if result.ai_result.confidence > 0.8:
            self.metrics["ai_agreements"] += 1
        
        # 设置处理时间
        result.processing_time = processing_time
    
    def _save_decision_history(self, result: FusionResult):
        """保存决策历史"""
        self.decision_history.append(result)
        
        # 限制历史记录大小
        if len(self.decision_history) > self.max_history_size:
            self.decision_history = self.decision_history[-self.max_history_size:]
    
    def get_engine_status(self) -> Dict[str, Any]:
        """获取引擎状态"""
        return {
            "status": "running",
            "config": {k: v.value if isinstance(v, Enum) else v for k, v in self.config.items()},
            "performance_stats": self.performance_stats,
            "metrics": self.metrics,
            "decision_history_size": len(self.decision_history),
            "timestamp": datetime.now().isoformat()
        }
    
    def get_decision_statistics(self) -> Dict[str, Any]:
        """获取决策统计"""
        if not self.decision_history:
            return {"message": "暂无决策历史"}
        
        # 统计不同策略的使用情况
        strategy_stats = {}
        threat_level_stats = {}
        confidence_stats = {"very_high": 0, "high": 0, "medium": 0, "low": 0, "very_low": 0}
        
        for decision in self.decision_history:
            # 策略统计
            strategy = decision.decision_strategy.value
            strategy_stats[strategy] = strategy_stats.get(strategy, 0) + 1
            
            # 威胁级别统计
            threat_level = decision.final_threat_level.value
            threat_level_stats[threat_level] = threat_level_stats.get(threat_level, 0) + 1
            
            # 置信度级别统计
            confidence_level = decision.confidence_level.value
            confidence_stats[confidence_level] += 1
        
        return {
            "total_decisions": len(self.decision_history),
            "strategy_distribution": strategy_stats,
            "threat_level_distribution": threat_level_stats,
            "confidence_distribution": confidence_stats,
            "avg_processing_time": self.metrics["avg_processing_time"],
            "avg_confidence": self.metrics["avg_confidence"],
            "timestamp": datetime.now().isoformat()
        } 