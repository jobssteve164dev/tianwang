"""
智能调度服务
根据系统负载、模型性能、成本等因素智能调度AI分析任务
"""

import asyncio
import time
from typing import Dict, List, Any, Optional
from dataclasses import dataclass
from enum import Enum
import logging

from ..config import config
from ..utils.feature_extractor import FeatureExtractor

logger = logging.getLogger(__name__)

class SystemLoad(Enum):
    """系统负载等级"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

@dataclass
class ModelMetrics:
    """模型性能指标"""
    accuracy: float
    precision: float
    recall: float
    f1_score: float
    avg_latency: float
    cost_per_request: float
    success_rate: float = 1.0
    last_updated: float = time.time()

@dataclass
class SystemMetrics:
    """系统指标"""
    cpu_usage: float
    memory_usage: float
    gpu_usage: float
    queue_size: int
    active_requests: int
    error_rate: float

class IntelligentScheduler:
    """
    智能调度器
    负责根据多种因素选择最优的推理方法
    """
    
    def __init__(self):
        # 模型性能历史
        self.model_metrics = {
            'local_model': ModelMetrics(0.92, 0.88, 0.95, 0.91, 0.05, 0.0),
            'rule_engine': ModelMetrics(0.85, 0.90, 0.80, 0.85, 0.01, 0.0),
            'external_api': ModelMetrics(0.95, 0.93, 0.97, 0.95, 2.5, 0.002),
            'hybrid': ModelMetrics(0.96, 0.94, 0.98, 0.96, 1.2, 0.001)
        }
        
        # 性能历史窗口
        self.performance_window = 100
        self.latency_history = defaultdict(lambda: deque(maxlen=self.performance_window))
        self.accuracy_history = defaultdict(lambda: deque(maxlen=self.performance_window))
        self.cost_history = defaultdict(lambda: deque(maxlen=self.performance_window))
        
        # 系统状态
        self.system_metrics = SystemMetrics(0.0, 0.0, 0.0, 0, 0, 0.0)
        
        # 调度策略配置
        self.strategy_config = {
            'cost_weight': 0.3,
            'latency_weight': 0.4,
            'accuracy_weight': 0.3,
            'load_threshold': 0.8,
            'api_budget_threshold': 0.8,
            'emergency_fallback': True
        }
        
        # 预算管理
        self.daily_budget = config.cost_control.get("daily_budget", 10.0)
        self.current_cost = 0.0
        self.cost_reset_time = time.time()
        
        # 负载均衡
        self.request_queues = {
            'local_model': asyncio.Queue(maxsize=100),
            'rule_engine': asyncio.Queue(maxsize=200),
            'external_api': asyncio.Queue(maxsize=50),
            'hybrid': asyncio.Queue(maxsize=75)
        }
        
        logger.info("智能调度器初始化完成")

    async def select_optimal_method(
        self, 
        event_features: Dict[str, Any],
        constraints: Optional[Dict[str, Any]] = None
    ) -> Tuple[str, float]:
        """
        选择最优推理方法
        
        Args:
            event_features: 事件特征
            constraints: 约束条件 (max_latency, max_cost, min_accuracy等)
            
        Returns:
            (选择的方法, 预期置信度)
        """
        
        # 更新系统指标
        await self._update_system_metrics()
        
        # 计算各方法的评分
        method_scores = await self._calculate_method_scores(event_features, constraints)
        
        # 选择最优方法
        best_method = max(method_scores, key=method_scores.get)
        expected_confidence = await self._estimate_confidence(best_method, event_features)
        
        logger.debug(
            f"调度决策: {best_method} (评分: {method_scores[best_method]:.3f}, "
            f"预期置信度: {expected_confidence:.3f})"
        )
        
        return best_method, expected_confidence

    async def _calculate_method_scores(
        self, 
        event_features: Dict[str, Any],
        constraints: Optional[Dict[str, Any]] = None
    ) -> Dict[str, float]:
        """计算各推理方法的综合评分"""
        
        scores = {}
        constraints = constraints or {}
        
        for method in ['local_model', 'rule_engine', 'external_api', 'hybrid']:
            # 基础性能评分
            base_score = await self._calculate_base_score(method, event_features)
            
            # 约束惩罚
            constraint_penalty = await self._calculate_constraint_penalty(method, constraints)
            
            # 系统负载调整
            load_adjustment = await self._calculate_load_adjustment(method)
            
            # 预算考虑
            budget_adjustment = await self._calculate_budget_adjustment(method)
            
            # 综合评分
            final_score = base_score * (1 - constraint_penalty) * load_adjustment * budget_adjustment
            
            scores[method] = max(0.0, final_score)
        
        return scores

    async def _calculate_base_score(self, method: str, event_features: Dict[str, Any]) -> float:
        """计算基础性能评分"""
        
        metrics = self.model_metrics[method]
        
        # 准确性评分
        accuracy_score = metrics.accuracy * self.strategy_config['accuracy_weight']
        
        # 延迟评分（越低越好）
        max_acceptable_latency = 5.0  # 5秒
        latency_score = max(0, 1 - metrics.avg_latency / max_acceptable_latency) * self.strategy_config['latency_weight']
        
        # 成本评分（越低越好）
        max_acceptable_cost = 0.01  # $0.01
        cost_score = max(0, 1 - metrics.cost_per_request / max_acceptable_cost) * self.strategy_config['cost_weight']
        
        # 事件类型适配性
        adaptability_score = await self._calculate_adaptability(method, event_features)
        
        base_score = (accuracy_score + latency_score + cost_score + adaptability_score) / 4
        
        return base_score

    async def _calculate_adaptability(self, method: str, event_features: Dict[str, Any]) -> float:
        """计算方法对特定事件类型的适配性"""
        
        event_type = event_features.get('event_type', 'unknown')
        has_payload = bool(event_features.get('payload'))
        complexity = event_features.get('complexity', 'medium')
        
        # 不同方法的适配性规则
        adaptability_rules = {
            'rule_engine': {
                'known_patterns': 1.0,
                'simple_attacks': 0.9,
                'port_scans': 0.95,
                'ddos': 0.85
            },
            'local_model': {
                'network_anomaly': 0.9,
                'behavioral_analysis': 0.85,
                'traffic_analysis': 0.9,
                'unknown_patterns': 0.7
            },
            'external_api': {
                'text_analysis': 0.95,
                'complex_payload': 0.9,
                'apt_detection': 0.95,
                'malware_analysis': 0.9
            },
            'hybrid': {
                'multi_stage_attack': 0.95,
                'complex_event': 0.9,
                'high_stakes': 0.95
            }
        }
        
        # 基于事件特征计算适配性
        base_adaptability = 0.7  # 默认适配性
        
        if method in adaptability_rules:
            rules = adaptability_rules[method]
            
            # 检查事件类型匹配
            for pattern, score in rules.items():
                if pattern in event_type.lower():
                    base_adaptability = max(base_adaptability, score)
            
            # 特殊情况调整
            if method == 'external_api' and has_payload and len(event_features.get('payload', '')) > 500:
                base_adaptability += 0.1
            
            if method == 'rule_engine' and complexity == 'simple':
                base_adaptability += 0.1
                
            if method == 'hybrid' and complexity == 'high':
                base_adaptability += 0.15
        
        return min(1.0, base_adaptability)

    async def _calculate_constraint_penalty(
        self, 
        method: str, 
        constraints: Dict[str, Any]
    ) -> float:
        """计算约束违反惩罚"""
        
        penalty = 0.0
        metrics = self.model_metrics[method]
        
        # 延迟约束
        if 'max_latency' in constraints:
            if metrics.avg_latency > constraints['max_latency']:
                penalty += 0.5
        
        # 成本约束
        if 'max_cost' in constraints:
            if metrics.cost_per_request > constraints['max_cost']:
                penalty += 0.3
        
        # 准确性约束
        if 'min_accuracy' in constraints:
            if metrics.accuracy < constraints['min_accuracy']:
                penalty += 0.4
        
        return min(1.0, penalty)

    async def _calculate_load_adjustment(self, method: str) -> float:
        """计算系统负载调整因子"""
        
        load_level = await self._get_system_load_level()
        
        # 负载调整策略
        load_adjustments = {
            SystemLoad.LOW: {
                'local_model': 1.0,
                'rule_engine': 1.0,
                'external_api': 1.0,
                'hybrid': 1.0
            },
            SystemLoad.MEDIUM: {
                'local_model': 0.9,
                'rule_engine': 1.1,  # 规则引擎在中等负载下表现更好
                'external_api': 0.8,
                'hybrid': 0.85
            },
            SystemLoad.HIGH: {
                'local_model': 0.7,
                'rule_engine': 1.2,
                'external_api': 0.6,
                'hybrid': 0.7
            },
            SystemLoad.CRITICAL: {
                'local_model': 0.5,
                'rule_engine': 1.3,  # 紧急情况优先使用轻量级方法
                'external_api': 0.3,
                'hybrid': 0.4
            }
        }
        
        return load_adjustments[load_level].get(method, 0.5)

    async def _calculate_budget_adjustment(self, method: str) -> float:
        """计算预算调整因子"""
        
        # 检查当前预算使用情况
        budget_usage = self.current_cost / self.daily_budget
        
        # 如果是免费方法，不受预算限制
        if self.model_metrics[method].cost_per_request == 0:
            return 1.0
        
        # 预算调整策略
        if budget_usage < 0.5:
            return 1.0  # 预算充足
        elif budget_usage < 0.8:
            return 0.8  # 预算紧张，轻微降低付费方法优先级
        elif budget_usage < 0.95:
            return 0.5  # 预算接近用完，大幅降低付费方法优先级
        else:
            return 0.1  # 预算用完，几乎不使用付费方法

    async def _get_system_load_level(self) -> SystemLoad:
        """获取当前系统负载等级"""
        
        cpu_load = self.system_metrics.cpu_usage
        memory_load = self.system_metrics.memory_usage
        queue_load = sum(q.qsize() for q in self.request_queues.values()) / 400  # 总队列容量
        
        # 综合负载评估
        overall_load = (cpu_load + memory_load + queue_load) / 3
        
        if overall_load < 0.3:
            return SystemLoad.LOW
        elif overall_load < 0.6:
            return SystemLoad.MEDIUM
        elif overall_load < 0.9:
            return SystemLoad.HIGH
        else:
            return SystemLoad.CRITICAL

    async def _estimate_confidence(self, method: str, event_features: Dict[str, Any]) -> float:
        """估算预期置信度"""
        
        base_confidence = self.model_metrics[method].accuracy
        
        # 基于历史性能调整
        if method in self.accuracy_history:
            recent_accuracies = list(self.accuracy_history[method])
            if recent_accuracies:
                recent_avg = statistics.mean(recent_accuracies)
                # 加权平均：70%历史基准 + 30%近期表现
                base_confidence = 0.7 * base_confidence + 0.3 * recent_avg
        
        # 基于事件复杂度调整
        complexity = event_features.get('complexity', 'medium')
        complexity_adjustments = {
            'simple': 1.1,
            'medium': 1.0,
            'high': 0.9,
            'critical': 0.8
        }
        
        adjusted_confidence = base_confidence * complexity_adjustments.get(complexity, 1.0)
        
        return min(1.0, max(0.0, adjusted_confidence))

    async def _update_system_metrics(self):
        """更新系统指标"""
        try:
            import psutil
            
            # CPU和内存使用率
            self.system_metrics.cpu_usage = psutil.cpu_percent(interval=0.1) / 100.0
            self.system_metrics.memory_usage = psutil.virtual_memory().percent / 100.0
            
            # GPU使用率（如果可用）
            try:
                import GPUtil
                gpus = GPUtil.getGPUs()
                if gpus:
                    self.system_metrics.gpu_usage = gpus[0].load
                else:
                    self.system_metrics.gpu_usage = 0.0
            except ImportError:
                self.system_metrics.gpu_usage = 0.0
            
            # 队列大小
            self.system_metrics.queue_size = sum(q.qsize() for q in self.request_queues.values())
            
        except Exception as e:
            logger.warning(f"更新系统指标失败: {e}")

    def update_performance_metrics(
        self, 
        method: str, 
        latency: float, 
        accuracy: float, 
        cost: float
    ):
        """更新性能指标"""
        
        # 更新历史数据
        self.latency_history[method].append(latency)
        self.accuracy_history[method].append(accuracy)
        self.cost_history[method].append(cost)
        
        # 更新模型指标
        if method in self.model_metrics:
            metrics = self.model_metrics[method]
            
            # 指数移动平均更新
            alpha = 0.1  # 学习率
            metrics.avg_latency = (1 - alpha) * metrics.avg_latency + alpha * latency
            metrics.accuracy = (1 - alpha) * metrics.accuracy + alpha * accuracy
            metrics.cost_per_request = (1 - alpha) * metrics.cost_per_request + alpha * cost
            metrics.last_updated = time.time()
        
        # 更新总成本
        self.current_cost += cost
        
        # 检查是否需要重置日成本
        current_time = time.time()
        if current_time - self.cost_reset_time > 86400:  # 24小时
            self.current_cost = 0.0
            self.cost_reset_time = current_time

    async def get_queue_status(self) -> Dict[str, Dict[str, Any]]:
        """获取队列状态"""
        status = {}
        
        for method, queue in self.request_queues.items():
            status[method] = {
                'queue_size': queue.qsize(),
                'max_size': queue.maxsize,
                'utilization': queue.qsize() / queue.maxsize if queue.maxsize > 0 else 0.0
            }
        
        return status

    async def optimize_resource_allocation(self):
        """优化资源分配"""
        
        # 获取各方法的性能统计
        performance_stats = {}
        for method in ['local_model', 'rule_engine', 'external_api', 'hybrid']:
            if method in self.latency_history:
                latencies = list(self.latency_history[method])
                accuracies = list(self.accuracy_history[method])
                
                if latencies and accuracies:
                    performance_stats[method] = {
                        'avg_latency': statistics.mean(latencies),
                        'avg_accuracy': statistics.mean(accuracies),
                        'latency_std': statistics.stdev(latencies) if len(latencies) > 1 else 0,
                        'accuracy_std': statistics.stdev(accuracies) if len(accuracies) > 1 else 0
                    }
        
        # 动态调整队列大小
        for method, stats in performance_stats.items():
            if method in self.request_queues:
                queue = self.request_queues[method]
                
                # 基于性能调整队列容量
                if stats['avg_latency'] < 0.1 and stats['avg_accuracy'] > 0.9:
                    # 高性能方法，增加队列容量
                    new_maxsize = min(queue.maxsize * 1.2, 300)
                elif stats['avg_latency'] > 2.0 or stats['avg_accuracy'] < 0.8:
                    # 低性能方法，减少队列容量
                    new_maxsize = max(queue.maxsize * 0.8, 20)
                else:
                    continue
                
                # 创建新队列（asyncio.Queue不支持动态调整大小）
                if int(new_maxsize) != queue.maxsize:
                    old_queue = self.request_queues[method]
                    self.request_queues[method] = asyncio.Queue(maxsize=int(new_maxsize))
                    
                    # 迁移现有任务
                    while not old_queue.empty():
                        try:
                            task = old_queue.get_nowait()
                            await self.request_queues[method].put(task)
                        except asyncio.QueueEmpty:
                            break
                        except asyncio.QueueFull:
                            logger.warning(f"队列 {method} 迁移时溢出")
                            break

    def get_scheduling_stats(self) -> Dict[str, Any]:
        """获取调度统计信息"""
        
        stats = {
            'model_metrics': {
                method: {
                    'accuracy': metrics.accuracy,
                    'avg_latency': metrics.avg_latency,
                    'cost_per_request': metrics.cost_per_request,
                    'success_rate': metrics.success_rate
                }
                for method, metrics in self.model_metrics.items()
            },
            'system_metrics': {
                'cpu_usage': self.system_metrics.cpu_usage,
                'memory_usage': self.system_metrics.memory_usage,
                'gpu_usage': self.system_metrics.gpu_usage,
                'queue_size': self.system_metrics.queue_size
            },
            'budget_status': {
                'daily_budget': self.daily_budget,
                'current_cost': self.current_cost,
                'usage_percentage': (self.current_cost / self.daily_budget) * 100
            },
            'performance_history_size': {
                method: len(history) for method, history in self.latency_history.items()
            }
        }
        
        return stats

    async def emergency_fallback(self) -> str:
        """紧急情况下的降级策略"""
        
        # 优先级：规则引擎 > 本地模型 > 混合 > 外部API
        fallback_priority = ['rule_engine', 'local_model', 'hybrid', 'external_api']
        
        for method in fallback_priority:
            if method in self.model_metrics:
                queue = self.request_queues.get(method)
                if queue and queue.qsize() < queue.maxsize * 0.8:  # 队列未满
                    logger.warning(f"启用紧急降级策略，使用方法: {method}")
                    return method
        
        # 如果所有方法都不可用，返回最基本的规则引擎
        logger.critical("所有推理方法都不可用，强制使用规则引擎")
        return 'rule_engine' 