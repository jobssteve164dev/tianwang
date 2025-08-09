"""
告警规则引擎
负责管理威胁检测阈值、告警策略和规则评估
"""

import json
import time
from typing import Dict, Any, List, Optional, Set, Tuple
from dataclasses import dataclass, asdict
from datetime import datetime, timedelta
from enum import Enum
from loguru import logger

from .hybrid_inference_engine import ThreatLevel, InferenceResult


class RuleSeverity(Enum):
    """规则严重性级别"""
    INFO = "info"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class RuleAction(Enum):
    """规则触发动作"""
    LOG_ONLY = "log_only"
    NOTIFY = "notify"
    BLOCK = "block"
    QUARANTINE = "quarantine"
    EMERGENCY_RESPONSE = "emergency_response"


class RuleCondition(Enum):
    """规则条件类型"""
    THRESHOLD = "threshold"              # 阈值条件
    FREQUENCY = "frequency"              # 频率条件
    CORRELATION = "correlation"          # 关联条件
    PATTERN = "pattern"                  # 模式匹配
    ANOMALY = "anomaly"                  # 异常检测


@dataclass
class AlertRule:
    """告警规则"""
    rule_id: str
    name: str
    description: str
    severity: RuleSeverity
    condition_type: RuleCondition
    conditions: Dict[str, Any]
    actions: List[RuleAction]
    enabled: bool
    created_at: datetime
    updated_at: datetime
    metadata: Dict[str, Any]


@dataclass
class RuleEvaluation:
    """规则评估结果"""
    rule_id: str
    triggered: bool
    confidence: float
    trigger_reason: str
    evaluation_time: datetime
    context: Dict[str, Any]


@dataclass
class AlertEvent:
    """告警事件"""
    alert_id: str
    rule_id: str
    event_id: str
    severity: RuleSeverity
    message: str
    triggered_actions: List[RuleAction]
    context: Dict[str, Any]
    created_at: datetime


class AlertRuleEngine:
    """
    告警规则引擎
    管理威胁检测规则、评估事件并触发相应的告警和防护动作
    """
    
    def __init__(self):
        # 规则存储
        self.rules: Dict[str, AlertRule] = {}
        self.rule_statistics: Dict[str, Dict[str, Any]] = {}
        
        # 事件历史和频率统计
        self.event_history: List[Dict[str, Any]] = []
        self.frequency_counters: Dict[str, List[datetime]] = {}
        self.correlation_cache: Dict[str, List[Dict[str, Any]]] = {}
        
        # 配置参数
        self.config = {
            "max_history_size": 10000,        # 最大历史事件数
            "correlation_window": 300,        # 关联窗口时间（秒）
            "frequency_window": 3600,         # 频率统计窗口（秒）
            "cache_cleanup_interval": 1800,   # 缓存清理间隔（秒）
        }
        
        # 性能指标
        self.metrics = {
            "rules_loaded": 0,
            "evaluations_performed": 0,
            "alerts_triggered": 0,
            "false_positives": 0,
            "avg_evaluation_time": 0.0,
            "last_evaluation_time": None
        }
        
        # 初始化默认规则
        self._initialize_default_rules()
        
        logger.info("告警规则引擎初始化完成")
    
    def _initialize_default_rules(self):
        """初始化默认规则"""
        default_rules = [
            # 高置信度威胁检测规则
            {
                "rule_id": "high_confidence_threat",
                "name": "高置信度威胁检测",
                "description": "AI分析置信度超过90%的威胁",
                "severity": RuleSeverity.HIGH,
                "condition_type": RuleCondition.THRESHOLD,
                "conditions": {
                    "field": "confidence",
                    "operator": ">=",
                    "value": 0.9,
                    "threat_level": ["high", "critical"]
                },
                "actions": [RuleAction.NOTIFY, RuleAction.BLOCK],
                "enabled": True
            },
            
            # 恶意软件检测规则
            {
                "rule_id": "malware_detection",
                "name": "恶意软件检测",
                "description": "检测到恶意软件活动",
                "severity": RuleSeverity.CRITICAL,
                "condition_type": RuleCondition.PATTERN,
                "conditions": {
                    "threat_type": ["malware", "trojan", "virus", "ransomware"],
                    "confidence": 0.8
                },
                "actions": [RuleAction.EMERGENCY_RESPONSE, RuleAction.QUARANTINE],
                "enabled": True
            },
            
            # 网络攻击频率规则
            {
                "rule_id": "network_attack_frequency",
                "name": "网络攻击频率告警",
                "description": "短时间内多次网络攻击尝试",
                "severity": RuleSeverity.HIGH,
                "condition_type": RuleCondition.FREQUENCY,
                "conditions": {
                    "event_types": ["network_attack", "brute_force", "ddos"],
                    "count": 5,
                    "time_window": 300,  # 5分钟
                    "source_field": "source_ip"
                },
                "actions": [RuleAction.NOTIFY, RuleAction.BLOCK],
                "enabled": True
            },
            
            # 异常行为检测规则
            {
                "rule_id": "anomaly_behavior",
                "name": "异常行为检测",
                "description": "检测到用户或系统异常行为",
                "severity": RuleSeverity.MEDIUM,
                "condition_type": RuleCondition.ANOMALY,
                "conditions": {
                    "anomaly_score": 0.7,
                    "behavior_types": ["unusual_login", "data_exfiltration", "privilege_escalation"]
                },
                "actions": [RuleAction.NOTIFY, RuleAction.LOG_ONLY],
                "enabled": True
            },
            
            # 多阶段攻击关联规则
            {
                "rule_id": "multi_stage_attack",
                "name": "多阶段攻击关联",
                "description": "检测关联的多阶段攻击活动",
                "severity": RuleSeverity.CRITICAL,
                "condition_type": RuleCondition.CORRELATION,
                "conditions": {
                    "stages": ["reconnaissance", "exploitation", "persistence"],
                    "correlation_window": 3600,  # 1小时
                    "min_stages": 2
                },
                "actions": [RuleAction.EMERGENCY_RESPONSE, RuleAction.NOTIFY],
                "enabled": True
            }
        ]
        
        # 加载默认规则
        for rule_data in default_rules:
            rule = AlertRule(
                rule_id=rule_data["rule_id"],
                name=rule_data["name"],
                description=rule_data["description"],
                severity=rule_data["severity"],
                condition_type=rule_data["condition_type"],
                conditions=rule_data["conditions"],
                actions=rule_data["actions"],
                enabled=rule_data["enabled"],
                created_at=datetime.now(),
                updated_at=datetime.now(),
                metadata={}
            )
            
            self.rules[rule.rule_id] = rule
            self.rule_statistics[rule.rule_id] = {
                "evaluations": 0,
                "triggers": 0,
                "false_positives": 0,
                "last_triggered": None
            }
        
        self.metrics["rules_loaded"] = len(self.rules)
        logger.info(f"加载了 {len(self.rules)} 条默认规则")
    
    async def evaluate_event(
        self, 
        event_data: Dict[str, Any], 
        analysis_result: InferenceResult
    ) -> List[RuleEvaluation]:
        """评估事件是否触发告警规则"""
        try:
            start_time = time.time()
            evaluations = []
            
            # 准备评估上下文
            context = {
                "event_data": event_data,
                "analysis_result": asdict(analysis_result),
                "timestamp": datetime.now(),
                "event_id": event_data.get("event_id", "unknown")
            }
            
            # 更新事件历史
            self._update_event_history(event_data, analysis_result)
            
            # 评估所有启用的规则
            for rule in self.rules.values():
                if not rule.enabled:
                    continue
                
                evaluation = await self._evaluate_single_rule(rule, context)
                evaluations.append(evaluation)
                
                # 更新规则统计
                self.rule_statistics[rule.rule_id]["evaluations"] += 1
                
                if evaluation.triggered:
                    self.rule_statistics[rule.rule_id]["triggers"] += 1
                    self.rule_statistics[rule.rule_id]["last_triggered"] = datetime.now()
                    
                    # 创建告警事件
                    alert_event = await self._create_alert_event(rule, evaluation, context)
                    logger.warning(f"规则触发告警: {rule.name} (ID: {rule.rule_id})")
            
            # 更新指标
            evaluation_time = time.time() - start_time
            self.metrics["evaluations_performed"] += 1
            self.metrics["avg_evaluation_time"] = (
                (self.metrics["avg_evaluation_time"] * (self.metrics["evaluations_performed"] - 1) + 
                 evaluation_time) / self.metrics["evaluations_performed"]
            )
            self.metrics["last_evaluation_time"] = datetime.now().isoformat()
            
            return evaluations
            
        except Exception as e:
            logger.error(f"评估事件规则失败: {e}")
            return []
    
    async def _evaluate_single_rule(self, rule: AlertRule, context: Dict[str, Any]) -> RuleEvaluation:
        """评估单条规则"""
        try:
            triggered = False
            confidence = 0.0
            trigger_reason = ""
            
            if rule.condition_type == RuleCondition.THRESHOLD:
                triggered, confidence, trigger_reason = self._evaluate_threshold_condition(
                    rule.conditions, context
                )
            elif rule.condition_type == RuleCondition.FREQUENCY:
                triggered, confidence, trigger_reason = self._evaluate_frequency_condition(
                    rule.conditions, context
                )
            elif rule.condition_type == RuleCondition.CORRELATION:
                triggered, confidence, trigger_reason = self._evaluate_correlation_condition(
                    rule.conditions, context
                )
            elif rule.condition_type == RuleCondition.PATTERN:
                triggered, confidence, trigger_reason = self._evaluate_pattern_condition(
                    rule.conditions, context
                )
            elif rule.condition_type == RuleCondition.ANOMALY:
                triggered, confidence, trigger_reason = self._evaluate_anomaly_condition(
                    rule.conditions, context
                )
            
            return RuleEvaluation(
                rule_id=rule.rule_id,
                triggered=triggered,
                confidence=confidence,
                trigger_reason=trigger_reason,
                evaluation_time=datetime.now(),
                context={"rule_name": rule.name, "severity": rule.severity.value}
            )
            
        except Exception as e:
            logger.error(f"评估规则失败 {rule.rule_id}: {e}")
            return RuleEvaluation(
                rule_id=rule.rule_id,
                triggered=False,
                confidence=0.0,
                trigger_reason=f"评估异常: {str(e)}",
                evaluation_time=datetime.now(),
                context={}
            )
    
    def _evaluate_threshold_condition(
        self, 
        conditions: Dict[str, Any], 
        context: Dict[str, Any]
    ) -> Tuple[bool, float, str]:
        """评估阈值条件"""
        try:
            analysis_result = context["analysis_result"]
            field = conditions.get("field", "confidence")
            operator = conditions.get("operator", ">=")
            threshold = conditions.get("value", 0.8)
            
            # 获取字段值
            field_value = analysis_result.get(field, 0.0)
            
            # 检查威胁级别（如果指定）
            threat_levels = conditions.get("threat_level", [])
            if threat_levels:
                current_threat_level = analysis_result.get("threat_level", "low")
                if current_threat_level not in threat_levels:
                    return False, 0.0, f"威胁级别 {current_threat_level} 不在指定范围内"
            
            # 评估阈值条件
            if operator == ">=":
                triggered = field_value >= threshold
            elif operator == ">":
                triggered = field_value > threshold
            elif operator == "<=":
                triggered = field_value <= threshold
            elif operator == "<":
                triggered = field_value < threshold
            elif operator == "==":
                triggered = field_value == threshold
            else:
                return False, 0.0, f"未支持的操作符: {operator}"
            
            confidence = min(field_value, 1.0) if triggered else 0.0
            reason = f"{field} {operator} {threshold} (实际值: {field_value})" if triggered else ""
            
            return triggered, confidence, reason
            
        except Exception as e:
            return False, 0.0, f"阈值条件评估失败: {str(e)}"
    
    def _evaluate_frequency_condition(
        self, 
        conditions: Dict[str, Any], 
        context: Dict[str, Any]
    ) -> Tuple[bool, float, str]:
        """评估频率条件"""
        try:
            event_types = conditions.get("event_types", [])
            count_threshold = conditions.get("count", 5)
            time_window = conditions.get("time_window", 300)  # 秒
            source_field = conditions.get("source_field", "source_ip")
            
            current_time = datetime.now()
            event_data = context["event_data"]
            event_type = event_data.get("event_type", "")
            source_value = event_data.get(source_field, "unknown")
            
            # 检查事件类型是否匹配
            if event_types and event_type not in event_types:
                return False, 0.0, f"事件类型 {event_type} 不在监控范围内"
            
            # 构建频率计数器键
            counter_key = f"{source_field}:{source_value}:{event_type}"
            
            # 初始化计数器
            if counter_key not in self.frequency_counters:
                self.frequency_counters[counter_key] = []
            
            # 添加当前事件时间
            self.frequency_counters[counter_key].append(current_time)
            
            # 清理过期事件
            cutoff_time = current_time - timedelta(seconds=time_window)
            self.frequency_counters[counter_key] = [
                timestamp for timestamp in self.frequency_counters[counter_key]
                if timestamp > cutoff_time
            ]
            
            # 检查是否超过阈值
            event_count = len(self.frequency_counters[counter_key])
            triggered = event_count >= count_threshold
            
            confidence = min(event_count / count_threshold, 1.0) if triggered else 0.0
            reason = f"{source_field} {source_value} 在 {time_window}s 内出现 {event_count} 次 {event_type} 事件" if triggered else ""
            
            return triggered, confidence, reason
            
        except Exception as e:
            return False, 0.0, f"频率条件评估失败: {str(e)}"
    
    def _evaluate_correlation_condition(
        self, 
        conditions: Dict[str, Any], 
        context: Dict[str, Any]
    ) -> Tuple[bool, float, str]:
        """评估关联条件"""
        try:
            stages = conditions.get("stages", [])
            correlation_window = conditions.get("correlation_window", 3600)
            min_stages = conditions.get("min_stages", 2)
            
            current_time = datetime.now()
            cutoff_time = current_time - timedelta(seconds=correlation_window)
            
            event_data = context["event_data"]
            source_ip = event_data.get("source_ip", "unknown")
            
            # 构建关联缓存键
            cache_key = f"correlation:{source_ip}"
            
            # 初始化关联缓存
            if cache_key not in self.correlation_cache:
                self.correlation_cache[cache_key] = []
            
            # 添加当前事件
            current_event = {
                "timestamp": current_time,
                "event_type": event_data.get("event_type", ""),
                "stage": self._identify_attack_stage(event_data)
            }
            self.correlation_cache[cache_key].append(current_event)
            
            # 清理过期事件
            self.correlation_cache[cache_key] = [
                event for event in self.correlation_cache[cache_key]
                if event["timestamp"] > cutoff_time
            ]
            
            # 统计出现的攻击阶段
            found_stages = set()
            for event in self.correlation_cache[cache_key]:
                stage = event.get("stage")
                if stage in stages:
                    found_stages.add(stage)
            
            # 检查是否满足关联条件
            triggered = len(found_stages) >= min_stages
            confidence = len(found_stages) / len(stages) if triggered else 0.0
            reason = f"在 {correlation_window}s 内检测到 {len(found_stages)} 个攻击阶段: {list(found_stages)}" if triggered else ""
            
            return triggered, confidence, reason
            
        except Exception as e:
            return False, 0.0, f"关联条件评估失败: {str(e)}"
    
    def _evaluate_pattern_condition(
        self, 
        conditions: Dict[str, Any], 
        context: Dict[str, Any]
    ) -> Tuple[bool, float, str]:
        """评估模式条件"""
        try:
            threat_types = conditions.get("threat_type", [])
            min_confidence = conditions.get("confidence", 0.8)
            
            analysis_result = context["analysis_result"]
            detected_threat = analysis_result.get("details", {}).get("threat_type", "")
            confidence = analysis_result.get("confidence", 0.0)
            
            # 检查威胁类型是否匹配
            pattern_matched = any(threat_type.lower() in detected_threat.lower() 
                                for threat_type in threat_types)
            
            # 检查置信度
            confidence_met = confidence >= min_confidence
            
            triggered = pattern_matched and confidence_met
            final_confidence = confidence if triggered else 0.0
            reason = f"检测到威胁类型 {detected_threat}，置信度 {confidence:.2f}" if triggered else ""
            
            return triggered, final_confidence, reason
            
        except Exception as e:
            return False, 0.0, f"模式条件评估失败: {str(e)}"
    
    def _evaluate_anomaly_condition(
        self, 
        conditions: Dict[str, Any], 
        context: Dict[str, Any]
    ) -> Tuple[bool, float, str]:
        """评估异常条件"""
        try:
            anomaly_threshold = conditions.get("anomaly_score", 0.7)
            behavior_types = conditions.get("behavior_types", [])
            
            analysis_result = context["analysis_result"]
            details = analysis_result.get("details", {})
            
            # 检查异常分数
            anomaly_score = details.get("anomaly_score", 0.0)
            
            # 检查行为类型
            behavior_type = details.get("behavior_type", "")
            behavior_matched = not behavior_types or behavior_type in behavior_types
            
            triggered = anomaly_score >= anomaly_threshold and behavior_matched
            confidence = anomaly_score if triggered else 0.0
            reason = f"异常分数 {anomaly_score:.2f}，行为类型: {behavior_type}" if triggered else ""
            
            return triggered, confidence, reason
            
        except Exception as e:
            return False, 0.0, f"异常条件评估失败: {str(e)}"
    
    def _identify_attack_stage(self, event_data: Dict[str, Any]) -> str:
        """识别攻击阶段"""
        event_type = event_data.get("event_type", "").lower()
        
        # 简单的攻击阶段识别逻辑
        if any(keyword in event_type for keyword in ["scan", "probe", "recon"]):
            return "reconnaissance"
        elif any(keyword in event_type for keyword in ["exploit", "injection", "overflow"]):
            return "exploitation"
        elif any(keyword in event_type for keyword in ["backdoor", "persistence", "install"]):
            return "persistence"
        elif any(keyword in event_type for keyword in ["lateral", "privilege", "escalation"]):
            return "privilege_escalation"
        elif any(keyword in event_type for keyword in ["exfiltration", "data_theft", "download"]):
            return "exfiltration"
        else:
            return "unknown"
    
    def _update_event_history(self, event_data: Dict[str, Any], analysis_result: InferenceResult):
        """更新事件历史"""
        try:
            history_entry = {
                "timestamp": datetime.now(),
                "event_id": event_data.get("event_id", "unknown"),
                "event_type": event_data.get("event_type", "unknown"),
                "source_ip": event_data.get("source_ip", "unknown"),
                "threat_level": analysis_result.threat_level.value,
                "confidence": analysis_result.confidence,
                "analysis_method": analysis_result.method
            }
            
            self.event_history.append(history_entry)
            
            # 限制历史记录大小
            if len(self.event_history) > self.config["max_history_size"]:
                self.event_history = self.event_history[-self.config["max_history_size"]:]
                
        except Exception as e:
            logger.error(f"更新事件历史失败: {e}")
    
    async def _create_alert_event(
        self, 
        rule: AlertRule, 
        evaluation: RuleEvaluation, 
        context: Dict[str, Any]
    ) -> AlertEvent:
        """创建告警事件"""
        alert_id = f"alert_{rule.rule_id}_{int(time.time() * 1000)}"
        
        alert_event = AlertEvent(
            alert_id=alert_id,
            rule_id=rule.rule_id,
            event_id=context["event_id"],
            severity=rule.severity,
            message=f"{rule.name}: {evaluation.trigger_reason}",
            triggered_actions=rule.actions,
            context={
                "rule_name": rule.name,
                "confidence": evaluation.confidence,
                "evaluation_context": evaluation.context,
                "original_event": context["event_data"]
            },
            created_at=datetime.now()
        )
        
        self.metrics["alerts_triggered"] += 1
        
        return alert_event
    
    def add_rule(self, rule_data: Dict[str, Any]) -> bool:
        """添加新规则"""
        try:
            rule = AlertRule(
                rule_id=rule_data["rule_id"],
                name=rule_data["name"],
                description=rule_data["description"],
                severity=RuleSeverity(rule_data["severity"]),
                condition_type=RuleCondition(rule_data["condition_type"]),
                conditions=rule_data["conditions"],
                actions=[RuleAction(action) for action in rule_data["actions"]],
                enabled=rule_data.get("enabled", True),
                created_at=datetime.now(),
                updated_at=datetime.now(),
                metadata=rule_data.get("metadata", {})
            )
            
            self.rules[rule.rule_id] = rule
            self.rule_statistics[rule.rule_id] = {
                "evaluations": 0,
                "triggers": 0,
                "false_positives": 0,
                "last_triggered": None
            }
            
            logger.info(f"添加新规则: {rule.name} (ID: {rule.rule_id})")
            return True
            
        except Exception as e:
            logger.error(f"添加规则失败: {e}")
            return False
    
    def update_rule(self, rule_id: str, updates: Dict[str, Any]) -> bool:
        """更新规则"""
        try:
            if rule_id not in self.rules:
                logger.warning(f"规则不存在: {rule_id}")
                return False
            
            rule = self.rules[rule_id]
            
            # 更新规则属性
            for key, value in updates.items():
                if hasattr(rule, key):
                    if key == "severity":
                        setattr(rule, key, RuleSeverity(value))
                    elif key == "condition_type":
                        setattr(rule, key, RuleCondition(value))
                    elif key == "actions":
                        setattr(rule, key, [RuleAction(action) for action in value])
                    else:
                        setattr(rule, key, value)
            
            rule.updated_at = datetime.now()
            
            logger.info(f"更新规则: {rule.name} (ID: {rule_id})")
            return True
            
        except Exception as e:
            logger.error(f"更新规则失败: {e}")
            return False
    
    def delete_rule(self, rule_id: str) -> bool:
        """删除规则"""
        try:
            if rule_id not in self.rules:
                logger.warning(f"规则不存在: {rule_id}")
                return False
            
            rule_name = self.rules[rule_id].name
            del self.rules[rule_id]
            del self.rule_statistics[rule_id]
            
            logger.info(f"删除规则: {rule_name} (ID: {rule_id})")
            return True
            
        except Exception as e:
            logger.error(f"删除规则失败: {e}")
            return False
    
    def get_rule_statistics(self) -> Dict[str, Any]:
        """获取规则统计信息"""
        return {
            "total_rules": len(self.rules),
            "enabled_rules": sum(1 for rule in self.rules.values() if rule.enabled),
            "rule_statistics": self.rule_statistics,
            "engine_metrics": self.metrics,
            "timestamp": datetime.now().isoformat()
        }
    
    def export_rules(self) -> List[Dict[str, Any]]:
        """导出规则配置"""
        exported_rules = []
        
        for rule in self.rules.values():
            rule_dict = asdict(rule)
            rule_dict["severity"] = rule.severity.value
            rule_dict["condition_type"] = rule.condition_type.value
            rule_dict["actions"] = [action.value for action in rule.actions]
            rule_dict["created_at"] = rule.created_at.isoformat()
            rule_dict["updated_at"] = rule.updated_at.isoformat()
            
            exported_rules.append(rule_dict)
        
        return exported_rules
    
    def import_rules(self, rules_data: List[Dict[str, Any]]) -> Tuple[int, int]:
        """导入规则配置"""
        success_count = 0
        error_count = 0
        
        for rule_data in rules_data:
            try:
                # 转换时间字符串
                if "created_at" in rule_data:
                    rule_data["created_at"] = datetime.fromisoformat(rule_data["created_at"])
                if "updated_at" in rule_data:
                    rule_data["updated_at"] = datetime.fromisoformat(rule_data["updated_at"])
                
                if self.add_rule(rule_data):
                    success_count += 1
                else:
                    error_count += 1
                    
            except Exception as e:
                logger.error(f"导入规则失败: {e}")
                error_count += 1
        
        logger.info(f"规则导入完成: 成功 {success_count}, 失败 {error_count}")
        return success_count, error_count 