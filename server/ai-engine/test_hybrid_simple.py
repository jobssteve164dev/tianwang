#!/usr/bin/env python3

"""
混合推理引擎简化测试脚本
专注于核心逻辑验证，避免复杂依赖
"""

import asyncio
import json
import time
import logging
from pathlib import Path
import sys
from typing import List, Dict, Any
from dataclasses import dataclass
from enum import Enum

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)

# 简化的枚举和数据结构
class ThreatLevel(Enum):
    LOW = "low"
    MEDIUM = "medium" 
    HIGH = "high"
    CRITICAL = "critical"

class InferenceMethod(Enum):
    LOCAL_MODEL = "local_model"
    RULE_ENGINE = "rule_engine"
    EXTERNAL_API = "external_api"
    HYBRID = "hybrid"

@dataclass
class SecurityEvent:
    """安全事件数据结构"""
    event_id: str
    timestamp: int
    source_ip: str
    destination_ip: str
    source_port: int
    destination_port: int
    protocol: str
    packet_size: int
    flow_duration: float
    packet_count: int
    byte_count: int
    flags: List[str]
    payload: str
    event_type: str
    severity: str
    raw_data: Dict[str, Any]

@dataclass
class AnalysisResult:
    """分析结果数据结构"""
    event_id: str
    threat_level: ThreatLevel
    confidence: float
    inference_method: InferenceMethod
    processing_time: float
    details: Dict[str, Any]
    cost: float = 0.0

class SimplifiedHybridEngine:
    """简化的混合推理引擎"""
    
    def __init__(self):
        self.performance_metrics = {
            'total_requests': 0,
            'method_usage': {},
            'processing_times': [],
            'total_cost': 0.0
        }
    
    async def analyze_event(self, event: SecurityEvent) -> AnalysisResult:
        """分析单个安全事件"""
        start_time = time.time()
        self.performance_metrics['total_requests'] += 1
        
        # 智能调度逻辑
        method = self._select_inference_method(event)
        
        # 根据选择的方法进行分析
        if method == InferenceMethod.RULE_ENGINE:
            result = await self._analyze_with_rules(event)
        elif method == InferenceMethod.LOCAL_MODEL:
            result = await self._analyze_with_local_ai(event)
        elif method == InferenceMethod.EXTERNAL_API:
            result = await self._analyze_with_external_api(event)
        else:  # HYBRID
            result = await self._analyze_with_hybrid(event)
        
        # 记录性能指标
        processing_time = time.time() - start_time
        result.processing_time = processing_time
        result.inference_method = method
        
        self.performance_metrics['processing_times'].append(processing_time)
        self.performance_metrics['method_usage'][method.value] = \
            self.performance_metrics['method_usage'].get(method.value, 0) + 1
        self.performance_metrics['total_cost'] += result.cost
        
        return result
    
    def _select_inference_method(self, event: SecurityEvent) -> InferenceMethod:
        """智能选择推理方法"""
        # 基于事件特征选择方法
        if event.event_type == "network_traffic" and event.severity == "high":
            # 明显的攻击，使用快速的规则引擎
            return InferenceMethod.RULE_ENGINE
        elif event.event_type == "network_scan":
            # 需要模式识别，使用本地AI
            return InferenceMethod.LOCAL_MODEL
        elif event.event_type == "unknown_protocol":
            # 复杂未知情况，使用外部API
            return InferenceMethod.EXTERNAL_API
        else:
            # 默认使用混合方法
            return InferenceMethod.HYBRID
    
    async def _analyze_with_rules(self, event: SecurityEvent) -> AnalysisResult:
        """规则引擎分析"""
        await asyncio.sleep(0.01)  # 模拟处理时间
        
        # 简化的规则逻辑
        threat_level = ThreatLevel.LOW
        confidence = 0.9
        
        if "SYN" in event.flags and event.packet_count > 1000:
            threat_level = ThreatLevel.HIGH
            confidence = 0.95
        elif event.packet_count > 100:
            threat_level = ThreatLevel.MEDIUM
            confidence = 0.8
        
        return AnalysisResult(
            event_id=event.event_id,
            threat_level=threat_level,
            confidence=confidence,
            inference_method=InferenceMethod.RULE_ENGINE,
            processing_time=0.0,
            details={
                "rule_matched": "ddos_detection" if threat_level == ThreatLevel.HIGH else "normal_traffic",
                "rule_confidence": confidence
            },
            cost=0.001  # 规则引擎成本很低
        )
    
    async def _analyze_with_local_ai(self, event: SecurityEvent) -> AnalysisResult:
        """本地AI模型分析"""
        await asyncio.sleep(0.05)  # 模拟AI推理时间
        
        # 简化的AI逻辑
        threat_level = ThreatLevel.LOW
        confidence = 0.75
        
        # 基于特征的简单分析
        if event.event_type == "network_scan":
            threat_level = ThreatLevel.MEDIUM
            confidence = 0.85
        elif event.packet_count > 50000:
            threat_level = ThreatLevel.HIGH
            confidence = 0.9
        
        return AnalysisResult(
            event_id=event.event_id,
            threat_level=threat_level,
            confidence=confidence,
            inference_method=InferenceMethod.LOCAL_MODEL,
            processing_time=0.0,
            details={
                "model_used": "anomaly_detector_v1",
                "anomaly_score": 0.7 if threat_level != ThreatLevel.LOW else 0.2
            },
            cost=0.005  # 本地模型成本适中
        )
    
    async def _analyze_with_external_api(self, event: SecurityEvent) -> AnalysisResult:
        """外部API分析"""
        await asyncio.sleep(0.5)  # 模拟API调用时间
        
        # 简化的外部API逻辑
        threat_level = ThreatLevel.MEDIUM
        confidence = 0.95
        
        if event.event_type == "unknown_protocol":
            threat_level = ThreatLevel.HIGH
            confidence = 0.9
        
        return AnalysisResult(
            event_id=event.event_id,
            threat_level=threat_level,
            confidence=confidence,
            inference_method=InferenceMethod.EXTERNAL_API,
            processing_time=0.0,
            details={
                "api_used": "openai_gpt4",
                "reasoning": "复杂行为模式需要深度分析"
            },
            cost=0.03  # 外部API成本最高
        )
    
    async def _analyze_with_hybrid(self, event: SecurityEvent) -> AnalysisResult:
        """混合分析"""
        # 组合多种方法
        rule_result = await self._analyze_with_rules(event)
        ai_result = await self._analyze_with_local_ai(event)
        
        # 简单的融合逻辑
        if rule_result.confidence > 0.9:
            final_result = rule_result
        elif ai_result.confidence > 0.8:
            final_result = ai_result
        else:
            # 取置信度更高的结果
            final_result = rule_result if rule_result.confidence > ai_result.confidence else ai_result
        
        final_result.inference_method = InferenceMethod.HYBRID
        final_result.cost = rule_result.cost + ai_result.cost
        final_result.details = {
            "rule_result": rule_result.threat_level.value,
            "ai_result": ai_result.threat_level.value,
            "fusion_strategy": "confidence_based"
        }
        
        return final_result
    
    async def analyze_batch(self, events: List[SecurityEvent]) -> List[AnalysisResult]:
        """批量分析事件"""
        tasks = [self.analyze_event(event) for event in events]
        return await asyncio.gather(*tasks)
    
    def get_performance_stats(self) -> Dict[str, Any]:
        """获取性能统计"""
        metrics = self.performance_metrics
        avg_time = sum(metrics['processing_times']) / len(metrics['processing_times']) if metrics['processing_times'] else 0
        
        return {
            'total_requests': metrics['total_requests'],
            'average_processing_time': avg_time,
            'total_cost': metrics['total_cost'],
            'cost_per_request': metrics['total_cost'] / metrics['total_requests'] if metrics['total_requests'] > 0 else 0,
            'method_distribution': metrics['method_usage']
        }

class HybridEngineTest:
    """混合推理引擎测试类"""
    
    def __init__(self):
        self.engine = SimplifiedHybridEngine()
        self.test_results = {
            'total_tests': 0,
            'passed_tests': 0,
            'failed_tests': 0,
            'performance_metrics': {}
        }
        
    def create_test_events(self) -> List[SecurityEvent]:
        """创建测试用的安全事件"""
        
        events = [
            # 1. DDoS攻击 - 应该被规则引擎检测
            SecurityEvent(
                event_id="test_001",
                timestamp=int(time.time()),
                source_ip="192.168.1.100",
                destination_ip="10.0.0.1",
                source_port=80,
                destination_port=443,
                protocol="TCP",
                packet_size=1500,
                flow_duration=0.1,
                packet_count=10000,
                byte_count=15000000,
                flags=["SYN"],
                payload="",
                event_type="network_traffic",
                severity="high",
                raw_data={"connection_rate": 1000}
            ),
            
            # 2. 端口扫描 - 应该被AI模型检测
            SecurityEvent(
                event_id="test_002", 
                timestamp=int(time.time()),
                source_ip="203.0.113.5",
                destination_ip="10.0.0.0/24",
                source_port=0,
                destination_port=0,
                protocol="TCP",
                packet_size=64,
                flow_duration=300,
                packet_count=65535,
                byte_count=4194240,
                flags=["SYN", "RST"],
                payload="",
                event_type="network_scan",
                severity="medium",
                raw_data={"scan_type": "port_sweep"}
            ),
            
            # 3. 未知协议 - 应该使用外部API
            SecurityEvent(
                event_id="test_003",
                timestamp=int(time.time()),
                source_ip="172.16.0.100",
                destination_ip="172.16.0.200",
                source_port=8080,
                destination_port=8080,
                protocol="HTTP",
                packet_size=2048,
                flow_duration=60,
                packet_count=100,
                byte_count=204800,
                flags=["PSH", "ACK"],
                payload="custom_protocol_unknown_behavior",
                event_type="unknown_protocol",
                severity="medium",
                raw_data={"protocol_signature": "CUSTOM_PROTO_V1.0"}
            ),
            
            # 4. 正常流量 - 应该被快速处理
            SecurityEvent(
                event_id="test_004",
                timestamp=int(time.time()),
                source_ip="10.0.0.20",
                destination_ip="8.8.8.8",
                source_port=53,
                destination_port=53,
                protocol="UDP",
                packet_size=512,
                flow_duration=1,
                packet_count=2,
                byte_count=1024,
                flags=[],
                payload="dns_query_google.com",
                event_type="dns_query",
                severity="low",
                raw_data={"query_type": "A"}
            )
        ]
        
        return events
    
    async def test_individual_methods(self):
        """测试各个推理方法"""
        logger.info("开始测试各个推理方法...")
        
        events = self.create_test_events()
        
        for event in events:
            try:
                start_time = time.time()
                result = await self.engine.analyze_event(event)
                latency = (time.time() - start_time) * 1000
                
                logger.info(f"事件 {event.event_id}: {result.threat_level.value} "
                           f"(置信度: {result.confidence:.2f}, "
                           f"方法: {result.inference_method.value}, "
                           f"延迟: {latency:.2f}ms)")
                
                self._record_test_result(True, f"单事件分析-{event.event_id}")
                
            except Exception as e:
                logger.error(f"分析事件 {event.event_id} 失败: {e}")
                self._record_test_result(False, f"单事件分析-{event.event_id}")
    
    async def test_batch_analysis(self):
        """测试批量分析"""
        logger.info("开始测试批量分析...")
        
        # 创建批量测试事件
        base_events = self.create_test_events()
        batch_events = []
        
        for i in range(20):  # 创建20个事件
            for base_event in base_events:
                event = SecurityEvent(
                    event_id=f"batch_{i}_{base_event.event_id}",
                    timestamp=base_event.timestamp + i,
                    source_ip=base_event.source_ip,
                    destination_ip=base_event.destination_ip,
                    source_port=base_event.source_port,
                    destination_port=base_event.destination_port,
                    protocol=base_event.protocol,
                    packet_size=base_event.packet_size,
                    flow_duration=base_event.flow_duration,
                    packet_count=base_event.packet_count,
                    byte_count=base_event.byte_count,
                    flags=base_event.flags,
                    payload=base_event.payload,
                    event_type=base_event.event_type,
                    severity=base_event.severity,
                    raw_data=base_event.raw_data.copy()
                )
                batch_events.append(event)
        
        try:
            start_time = time.time()
            results = await self.engine.analyze_batch(batch_events)
            total_time = time.time() - start_time
            
            logger.info(f"批量分析完成: {len(results)}个事件, "
                       f"总时间: {total_time:.2f}s, "
                       f"吞吐量: {len(results)/total_time:.1f} 事件/秒")
            
            self.test_results['performance_metrics']['batch_throughput'] = len(results) / total_time
            self._record_test_result(True, "批量分析测试")
            
        except Exception as e:
            logger.error(f"批量分析测试失败: {e}")
            self._record_test_result(False, "批量分析测试")
    
    async def test_scheduler_intelligence(self):
        """测试调度器智能选择"""
        logger.info("开始测试调度器智能选择...")
        
        events = self.create_test_events()
        method_usage = {}
        
        for event in events:
            try:
                result = await self.engine.analyze_event(event)
                method = result.inference_method.value
                method_usage[method] = method_usage.get(method, 0) + 1
                
                self._record_test_result(True, f"调度器-{event.event_id}")
                
            except Exception as e:
                logger.error(f"调度器测试失败: {e}")
                self._record_test_result(False, f"调度器-{event.event_id}")
        
        logger.info(f"方法使用统计: {method_usage}")
        self.test_results['performance_metrics']['method_usage'] = method_usage
    
    def _record_test_result(self, passed: bool, test_name: str):
        """记录测试结果"""
        self.test_results['total_tests'] += 1
        if passed:
            self.test_results['passed_tests'] += 1
        else:
            self.test_results['failed_tests'] += 1
    
    def print_test_summary(self):
        """打印测试总结"""
        results = self.test_results
        
        print("\n" + "="*60)
        print("混合推理引擎测试总结")
        print("="*60)
        print(f"总测试数: {results['total_tests']}")
        print(f"通过测试: {results['passed_tests']}")
        print(f"失败测试: {results['failed_tests']}")
        print(f"成功率: {(results['passed_tests']/results['total_tests']*100):.1f}%")
        
        print("\n性能指标:")
        print("-"*40)
        metrics = results['performance_metrics']
        
        if 'batch_throughput' in metrics:
            print(f"批量处理吞吐量: {metrics['batch_throughput']:.1f} 事件/秒")
        
        if 'method_usage' in metrics:
            print(f"推理方法使用分布: {metrics['method_usage']}")
        
        # 获取引擎性能统计
        engine_stats = self.engine.get_performance_stats()
        print(f"平均处理时间: {engine_stats['average_processing_time']*1000:.2f}ms")
        print(f"总成本: ${engine_stats['total_cost']:.4f}")
        print(f"每请求平均成本: ${engine_stats['cost_per_request']:.4f}")
        
        print("="*60)

async def main():
    """主测试函数"""
    logger.info("开始混合推理引擎简化测试...")
    
    test_suite = HybridEngineTest()
    
    try:
        # 运行所有测试
        await test_suite.test_individual_methods()
        await test_suite.test_batch_analysis()
        await test_suite.test_scheduler_intelligence()
        
    except Exception as e:
        logger.error(f"测试执行过程中出现错误: {e}")
    
    finally:
        # 打印测试总结
        test_suite.print_test_summary()

if __name__ == "__main__":
    asyncio.run(main()) 