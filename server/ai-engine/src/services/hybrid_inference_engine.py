"""
混合推理引擎
结合本地模型和外部大模型API，提供高精度、低延迟的智能分析
"""

import asyncio
import json
import time
from typing import Dict, List, Any, Optional, Union
from dataclasses import dataclass
from enum import Enum
import logging
import numpy as np
from concurrent.futures import ThreadPoolExecutor

from .ai_service import AIService
from .external_api_service import ExternalAPIService
from .rule_engine import RuleEngine
from ..utils.data_processor import DataProcessor
from ..utils.feature_extractor import FeatureExtractor
from ..config import config

logger = logging.getLogger(__name__)

class ThreatLevel(Enum):
    """威胁等级枚举"""
    LOW = "low"
    MEDIUM = "medium" 
    HIGH = "high"
    CRITICAL = "critical"

class InferenceMethod(Enum):
    """推理方法枚举"""
    LOCAL_MODEL = "local_model"
    RULE_ENGINE = "rule_engine"
    EXTERNAL_API = "external_api"
    HYBRID = "hybrid"

@dataclass
class InferenceResult:
    """推理结果数据类"""
    threat_level: ThreatLevel
    confidence: float
    method: InferenceMethod
    details: Dict[str, Any]
    processing_time: float
    cost: float = 0.0

@dataclass
class SecurityEvent:
    """安全事件数据类"""
    event_id: str
    timestamp: int
    event_type: str
    source_ip: str
    destination_ip: str
    protocol: str
    payload: Optional[str]
    features: Dict[str, Any]
    raw_data: Dict[str, Any]

class HybridInferenceEngine:
    """
    混合推理引擎
    智能调度本地模型、规则引擎和外部API，提供最优的威胁检测能力
    """
    
    def __init__(self):
        self.ai_service = AIService()
        self.external_api = ExternalAPIService()
        self.rule_engine = RuleEngine()
        self.data_processor = DataProcessor()
        
        # 性能统计
        self.stats = {
            'total_requests': 0,
            'local_model_requests': 0,
            'rule_engine_requests': 0,
            'external_api_requests': 0,
            'hybrid_requests': 0,
            'total_processing_time': 0.0,
            'total_cost': 0.0
        }
        
        # 模型性能缓存
        self.model_performance = {
            'local_model': {'accuracy': 0.92, 'latency': 0.05, 'cost': 0.0},
            'rule_engine': {'accuracy': 0.85, 'latency': 0.01, 'cost': 0.0},
            'external_api': {'accuracy': 0.95, 'latency': 2.5, 'cost': 0.002}
        }
        
        logger.info("混合推理引擎初始化完成")

    async def analyze_security_event(
        self, 
        event: SecurityEvent,
        method: Optional[InferenceMethod] = None
    ) -> InferenceResult:
        """
        分析安全事件
        
        Args:
            event: 安全事件对象
            method: 指定推理方法，None表示自动选择
            
        Returns:
            推理结果
        """
        start_time = time.time()
        self.stats['total_requests'] += 1
        
        try:
            # 自动选择推理方法
            if method is None:
                method = await self._select_inference_method(event)
            
            # 根据选择的方法执行推理
            result = await self._execute_inference(event, method)
            
            # 记录统计信息
            processing_time = time.time() - start_time
            result.processing_time = processing_time
            self.stats['total_processing_time'] += processing_time
            self.stats['total_cost'] += result.cost
            
            logger.info(
                f"事件 {event.event_id} 分析完成: "
                f"威胁等级={result.threat_level.value}, "
                f"置信度={result.confidence:.3f}, "
                f"方法={result.method.value}, "
                f"耗时={processing_time:.3f}s"
            )
            
            return result
            
        except Exception as e:
            logger.error(f"分析事件 {event.event_id} 时发生错误: {e}")
            # 返回默认结果
            return InferenceResult(
                threat_level=ThreatLevel.LOW,
                confidence=0.0,
                method=InferenceMethod.RULE_ENGINE,
                details={'error': str(e)},
                processing_time=time.time() - start_time
            )

    async def _select_inference_method(self, event: SecurityEvent) -> InferenceMethod:
        """
        智能选择推理方法
        基于事件特征、系统负载、成本预算等因素决定使用哪种推理方法
        """
        # 快速规则筛选 - 明显的攻击模式
        if await self._is_obvious_threat(event):
            return InferenceMethod.RULE_ENGINE
            
        # 检查是否需要深度分析
        if await self._needs_deep_analysis(event):
            # 如果有文本内容且预算允许，使用外部API
            if event.payload and len(event.payload) > 100:
                if self._check_api_budget():
                    return InferenceMethod.EXTERNAL_API
            
            # 否则使用本地模型
            return InferenceMethod.LOCAL_MODEL
        
        # 复杂事件使用混合方法
        if await self._is_complex_event(event):
            return InferenceMethod.HYBRID
            
        # 默认使用本地模型
        return InferenceMethod.LOCAL_MODEL

    async def _execute_inference(
        self, 
        event: SecurityEvent, 
        method: InferenceMethod
    ) -> InferenceResult:
        """执行具体的推理方法"""
        
        if method == InferenceMethod.LOCAL_MODEL:
            return await self._local_model_inference(event)
        elif method == InferenceMethod.RULE_ENGINE:
            return await self._rule_engine_inference(event)
        elif method == InferenceMethod.EXTERNAL_API:
            return await self._external_api_inference(event)
        elif method == InferenceMethod.HYBRID:
            return await self._hybrid_inference(event)
        else:
            raise ValueError(f"未知的推理方法: {method}")

    async def _local_model_inference(self, event: SecurityEvent) -> InferenceResult:
        """本地模型推理"""
        self.stats['local_model_requests'] += 1
        
        # 特征提取
        features = self.data_processor.extract_features(event.raw_data)
        
        # 本地模型预测
        prediction = await self.ai_service.predict_threat(features)
        
        # 解析预测结果
        threat_level = self._map_prediction_to_threat_level(prediction['threat_score'])
        
        return InferenceResult(
            threat_level=threat_level,
            confidence=prediction['confidence'],
            method=InferenceMethod.LOCAL_MODEL,
            details={
                'model_prediction': prediction,
                'features_used': list(features.keys())
            },
            processing_time=0.0,  # 将在上层设置
            cost=0.0
        )

    async def _rule_engine_inference(self, event: SecurityEvent) -> InferenceResult:
        """规则引擎推理"""
        self.stats['rule_engine_requests'] += 1
        
        # 规则匹配
        rule_results = await self.rule_engine.evaluate_event(event)
        
        # 计算综合威胁等级
        max_severity = max([r.severity for r in rule_results], default=0)
        threat_level = self._map_severity_to_threat_level(max_severity)
        
        # 计算置信度（基于匹配规则的权重）
        confidence = min(sum([r.weight for r in rule_results]) / 10.0, 1.0)
        
        return InferenceResult(
            threat_level=threat_level,
            confidence=confidence,
            method=InferenceMethod.RULE_ENGINE,
            details={
                'matched_rules': [r.rule_name for r in rule_results],
                'rule_count': len(rule_results)
            },
            processing_time=0.0,
            cost=0.0
        )

    async def _external_api_inference(self, event: SecurityEvent) -> InferenceResult:
        """外部API推理"""
        self.stats['external_api_requests'] += 1
        
        # 构造分析请求
        analysis_request = self._build_analysis_request(event)
        
        # 调用外部API
        api_result = await self.external_api.analyze_security_event(analysis_request)
        
        # 解析API结果
        threat_level = self._parse_api_threat_level(api_result)
        confidence = api_result.get('confidence', 0.8)
        
        return InferenceResult(
            threat_level=threat_level,
            confidence=confidence,
            method=InferenceMethod.EXTERNAL_API,
            details={
                'api_response': api_result,
                'model_used': api_result.get('model', 'unknown')
            },
            processing_time=0.0,
            cost=0.001  # 默认API调用成本
        )

    async def _hybrid_inference(self, event: SecurityEvent) -> InferenceResult:
        """混合推理 - 结合多种方法的结果"""
        self.stats['hybrid_requests'] += 1
        
        # 并行执行多种推理方法
        tasks = [
            self._local_model_inference(event),
            self._rule_engine_inference(event),
        ]
        
        # 如果预算允许，加入外部API
        if self._check_api_budget():
            tasks.append(self._external_api_inference(event))
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # 过滤异常结果
        valid_results = [r for r in results if isinstance(r, InferenceResult)]
        
        if not valid_results:
            # 如果所有方法都失败，返回默认结果
            return InferenceResult(
                threat_level=ThreatLevel.LOW,
                confidence=0.0,
                method=InferenceMethod.HYBRID,
                details={'error': 'All inference methods failed'},
                processing_time=0.0
            )
        
        # 融合结果
        final_result = self._fuse_results(valid_results)
        final_result.method = InferenceMethod.HYBRID
        
        return final_result

    def _fuse_results(self, results: List[InferenceResult]) -> InferenceResult:
        """融合多个推理结果"""
        
        # 威胁等级映射到数值
        threat_values = {
            ThreatLevel.LOW: 1,
            ThreatLevel.MEDIUM: 2,
            ThreatLevel.HIGH: 3,
            ThreatLevel.CRITICAL: 4
        }
        
        # 加权平均（考虑置信度和方法权重）
        method_weights = {
            InferenceMethod.LOCAL_MODEL: 1.0,
            InferenceMethod.RULE_ENGINE: 0.8,
            InferenceMethod.EXTERNAL_API: 1.2
        }
        
        weighted_threat = 0.0
        weighted_confidence = 0.0
        total_weight = 0.0
        total_cost = 0.0
        
        for result in results:
            weight = method_weights.get(result.method, 1.0) * result.confidence
            weighted_threat += threat_values[result.threat_level] * weight
            weighted_confidence += result.confidence * weight
            total_weight += weight
            total_cost += result.cost
        
        if total_weight > 0:
            avg_threat = weighted_threat / total_weight
            avg_confidence = weighted_confidence / total_weight
        else:
            avg_threat = 1.0
            avg_confidence = 0.0
        
        # 映射回威胁等级
        if avg_threat >= 3.5:
            final_threat_level = ThreatLevel.CRITICAL
        elif avg_threat >= 2.5:
            final_threat_level = ThreatLevel.HIGH
        elif avg_threat >= 1.5:
            final_threat_level = ThreatLevel.MEDIUM
        else:
            final_threat_level = ThreatLevel.LOW
        
        return InferenceResult(
            threat_level=final_threat_level,
            confidence=min(avg_confidence, 1.0),
            method=InferenceMethod.HYBRID,
            details={
                'fused_from': len(results),
                'individual_results': [
                    {
                        'method': r.method.value,
                        'threat_level': r.threat_level.value,
                        'confidence': r.confidence
                    } for r in results
                ]
            },
            processing_time=0.0,
            cost=total_cost
        )

    async def _is_obvious_threat(self, event: SecurityEvent) -> bool:
        """判断是否为明显威胁（可通过简单规则识别）"""
        # 检查已知恶意IP（这里可以扩展为从威胁情报源获取）
        known_malicious_ips = []  # 可以从配置文件或威胁情报源获取
        if event.source_ip in known_malicious_ips:
            return True
            
        # 检查异常端口
        suspicious_ports = [22, 23, 3389, 445, 1433, 3306]  # 常见攻击端口
        if event.features.get('dest_port') in suspicious_ports:
            return True
            
        # 检查异常协议模式
        if event.protocol in ['ICMP'] and event.features.get('packet_size', 0) > 1000:
            return True
            
        return False

    async def _needs_deep_analysis(self, event: SecurityEvent) -> bool:
        """判断是否需要深度分析"""
        # 检查是否包含复杂payload
        if event.payload and len(event.payload) > 500:
            return True
            
        # 检查是否为新型攻击模式
        if event.features.get('is_new_pattern', False):
            return True
            
        # 检查连接特征复杂度
        feature_complexity = len([v for v in event.features.values() if v != 0])
        if feature_complexity > 10:
            return True
            
        return False

    async def _is_complex_event(self, event: SecurityEvent) -> bool:
        """判断是否为复杂事件（需要多种方法协同）"""
        # 检查是否为APT相关
        if 'apt' in event.event_type.lower():
            return True
            
        # 检查是否涉及多个阶段
        if event.features.get('multi_stage', False):
            return True
            
        return False

    def _check_api_budget(self) -> bool:
        """检查API预算是否充足"""
        daily_budget = config.cost_control.get("daily_budget", 10.0)
        current_cost = self.stats['total_cost']
        
        # 简单的日预算检查
        return current_cost < daily_budget * 0.8  # 保留20%缓冲

    def _build_analysis_request(self, event: SecurityEvent) -> Dict[str, Any]:
        """构建外部API分析请求"""
        return {
            'event_type': event.event_type,
            'source_ip': event.source_ip,
            'destination_ip': event.destination_ip,
            'protocol': event.protocol,
            'payload': event.payload[:1000] if event.payload else None,  # 限制长度
            'features': event.features,
            'timestamp': event.timestamp
        }

    def _map_prediction_to_threat_level(self, threat_score: float) -> ThreatLevel:
        """将预测分数映射到威胁等级"""
        if threat_score >= 0.8:
            return ThreatLevel.CRITICAL
        elif threat_score >= 0.6:
            return ThreatLevel.HIGH
        elif threat_score >= 0.4:
            return ThreatLevel.MEDIUM
        else:
            return ThreatLevel.LOW

    def _map_severity_to_threat_level(self, severity: int) -> ThreatLevel:
        """将严重程度映射到威胁等级"""
        if severity >= 8:
            return ThreatLevel.CRITICAL
        elif severity >= 6:
            return ThreatLevel.HIGH
        elif severity >= 4:
            return ThreatLevel.MEDIUM
        else:
            return ThreatLevel.LOW

    def _parse_api_threat_level(self, api_result: Dict[str, Any]) -> ThreatLevel:
        """解析API返回的威胁等级"""
        threat_level_str = api_result.get('threat_level', 'low').lower()
        
        threat_mapping = {
            'critical': ThreatLevel.CRITICAL,
            'high': ThreatLevel.HIGH,
            'medium': ThreatLevel.MEDIUM,
            'low': ThreatLevel.LOW
        }
        
        return threat_mapping.get(threat_level_str, ThreatLevel.LOW)

    def get_performance_stats(self) -> Dict[str, Any]:
        """获取性能统计信息"""
        if self.stats['total_requests'] > 0:
            avg_processing_time = self.stats['total_processing_time'] / self.stats['total_requests']
        else:
            avg_processing_time = 0.0
            
        return {
            'total_requests': self.stats['total_requests'],
            'method_distribution': {
                'local_model': self.stats['local_model_requests'],
                'rule_engine': self.stats['rule_engine_requests'],
                'external_api': self.stats['external_api_requests'],
                'hybrid': self.stats['hybrid_requests']
            },
            'average_processing_time': avg_processing_time,
            'total_cost': self.stats['total_cost'],
            'cost_per_request': self.stats['total_cost'] / max(self.stats['total_requests'], 1)
        }

    async def batch_analyze(
        self, 
        events: List[SecurityEvent],
        max_concurrent: int = 10
    ) -> List[InferenceResult]:
        """批量分析安全事件"""
        semaphore = asyncio.Semaphore(max_concurrent)
        
        async def analyze_with_semaphore(event):
            async with semaphore:
                return await self.analyze_security_event(event)
        
        tasks = [analyze_with_semaphore(event) for event in events]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # 过滤异常结果
        valid_results = []
        for i, result in enumerate(results):
            if isinstance(result, InferenceResult):
                valid_results.append(result)
            else:
                logger.error(f"批量分析事件 {events[i].event_id} 失败: {result}")
                # 添加默认结果
                valid_results.append(InferenceResult(
                    threat_level=ThreatLevel.LOW,
                    confidence=0.0,
                    method=InferenceMethod.RULE_ENGINE,
                    details={'error': str(result)},
                    processing_time=0.0
                ))
        
        return valid_results 