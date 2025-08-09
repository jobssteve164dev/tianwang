#!/usr/bin/env python3

"""
混合推理引擎测试脚本
测试各个组件的功能和集成效果
"""

import asyncio
import json
import time
import logging
from pathlib import Path
import sys
import statistics
from typing import List, Dict

# 添加项目路径
sys.path.append(str(Path(__file__).parent))

from src.services.hybrid_inference_engine import (
    HybridInferenceEngine, SecurityEvent, ThreatLevel, InferenceMethod
)

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)

class HybridEngineTest:
    """混合推理引擎测试类"""
    
    def __init__(self):
        self.engine = HybridInferenceEngine()
        self.test_results = {
            'total_tests': 0,
            'passed_tests': 0,
            'failed_tests': 0,
            'performance_metrics': {}
        }
        
    def create_test_events(self) -> List[SecurityEvent]:
        """创建测试用的安全事件"""
        
        events = [
            # 1. 明显的DDoS攻击 - 应该被规则引擎快速检测
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
                raw_data={
                    "connection_rate": 1000,
                    "unique_sources": 1,
                    "tcp_flags": "SYN"
                }
            ),
            
            # 2. 可疑的端口扫描 - 需要AI模型分析
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
                raw_data={
                    "scan_type": "port_sweep",
                    "target_ports": list(range(1, 65536)),
                    "scan_rate": 200
                }
            ),
            
            # 3. 恶意软件通信 - 需要复杂分析
            SecurityEvent(
                event_id="test_003",
                timestamp=int(time.time()),
                source_ip="10.0.0.50",
                destination_ip="198.51.100.10",
                source_port=49152,
                destination_port=443,
                protocol="HTTPS",
                packet_size=1024,
                flow_duration=3600,
                packet_count=500,
                byte_count=512000,
                flags=["PSH", "ACK"],
                payload="encrypted_payload_suspicious_pattern",
                event_type="malware_communication",
                severity="critical",
                raw_data={
                    "ssl_cert_suspicious": True,
                    "domain": "suspicious-domain.com",
                    "user_agent": "Mozilla/5.0 (compatible; Malware/1.0)",
                    "communication_pattern": "c2_beacon"
                }
            ),
            
            # 4. 正常业务流量 - 应该被快速放行
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
                raw_data={
                    "query_type": "A",
                    "domain": "google.com",
                    "response_time": 20
                }
            ),
            
            # 5. 边缘案例 - 需要外部API协助
            SecurityEvent(
                event_id="test_005",
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
                raw_data={
                    "protocol_signature": "CUSTOM_PROTO_V1.0",
                    "behavior_pattern": "unknown",
                    "encryption_detected": False
                }
            )
        ]
        
        return events
    
    async def test_individual_methods(self):
        """测试各个推理方法的独立功能"""
        logger.info("开始测试各个推理方法...")
        
        test_event = self.create_test_events()[0]  # 使用DDoS攻击事件
        
        # 测试规则引擎
        try:
            start_time = time.time()
            rule_result = await self.engine._analyze_with_rules(test_event)
            rule_latency = (time.time() - start_time) * 1000
            
            logger.info(f"规则引擎结果: {rule_result.threat_level}, 延迟: {rule_latency:.2f}ms")
            self.test_results['performance_metrics']['rule_engine_latency'] = rule_latency
            self._record_test_result(True, "规则引擎测试")
            
        except Exception as e:
            logger.error(f"规则引擎测试失败: {e}")
            self._record_test_result(False, "规则引擎测试")
        
        # 测试本地AI模型
        try:
            start_time = time.time()
            ai_result = await self.engine._analyze_with_local_ai(test_event)
            ai_latency = (time.time() - start_time) * 1000
            
            logger.info(f"本地AI模型结果: {ai_result.threat_level}, 延迟: {ai_latency:.2f}ms")
            self.test_results['performance_metrics']['local_ai_latency'] = ai_latency
            self._record_test_result(True, "本地AI模型测试")
            
        except Exception as e:
            logger.error(f"本地AI模型测试失败: {e}")
            self._record_test_result(False, "本地AI模型测试")
    
    async def test_hybrid_analysis(self):
        """测试混合分析功能"""
        logger.info("开始测试混合分析...")
        
        events = self.create_test_events()
        results = []
        latencies = []
        
        for event in events:
            try:
                start_time = time.time()
                result = await self.engine.analyze_event(event)
                latency = (time.time() - start_time) * 1000
                
                results.append(result)
                latencies.append(latency)
                
                logger.info(f"事件 {event.event_id}: {result.threat_level} "
                           f"(置信度: {result.confidence:.2f}, "
                           f"方法: {result.inference_method}, "
                           f"延迟: {latency:.2f}ms)")
                
            except Exception as e:
                logger.error(f"分析事件 {event.event_id} 失败: {e}")
                self._record_test_result(False, f"混合分析-{event.event_id}")
                continue
            
            self._record_test_result(True, f"混合分析-{event.event_id}")
        
        # 计算性能指标
        if latencies:
            self.test_results['performance_metrics'].update({
                'hybrid_avg_latency': statistics.mean(latencies),
                'hybrid_max_latency': max(latencies),
                'hybrid_min_latency': min(latencies),
                'hybrid_p95_latency': sorted(latencies)[int(len(latencies) * 0.95)]
            })
    
    async def test_batch_analysis(self):
        """测试批量分析性能"""
        logger.info("开始测试批量分析性能...")
        
        # 创建大量测试事件
        batch_events = []
        base_events = self.create_test_events()
        
        for i in range(50):  # 创建50个事件进行批量测试
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
                    raw_data=base_event.raw_data
                )
                batch_events.append(event)
        
        # 批量分析
        start_time = time.time()
        try:
            results = await self.engine.analyze_batch(batch_events)
            total_time = time.time() - start_time
            
            logger.info(f"批量分析完成: {len(results)}个事件, "
                       f"总时间: {total_time:.2f}s, "
                       f"平均延迟: {(total_time/len(results)*1000):.2f}ms/事件")
            
            self.test_results['performance_metrics'].update({
                'batch_total_time': total_time,
                'batch_avg_latency_per_event': (total_time / len(results)) * 1000,
                'batch_throughput': len(results) / total_time
            })
            
            self._record_test_result(True, "批量分析测试")
            
        except Exception as e:
            logger.error(f"批量分析测试失败: {e}")
            self._record_test_result(False, "批量分析测试")
    
    async def test_scheduler_intelligence(self):
        """测试调度器的智能选择"""
        logger.info("开始测试调度器智能选择...")
        
        events = self.create_test_events()
        method_usage = {}
        
        for event in events:
            try:
                result = await self.engine.analyze_event(event)
                method = result.inference_method.value
                method_usage[method] = method_usage.get(method, 0) + 1
                
            except Exception as e:
                logger.error(f"调度器测试失败: {e}")
                self._record_test_result(False, f"调度器-{event.event_id}")
                continue
            
            self._record_test_result(True, f"调度器-{event.event_id}")
        
        logger.info(f"方法使用统计: {method_usage}")
        self.test_results['performance_metrics']['method_usage'] = method_usage
    
    def _record_test_result(self, passed: bool, test_name: str):
        """记录测试结果"""
        self.test_results['total_tests'] += 1
        if passed:
            self.test_results['passed_tests'] += 1
        else:
            self.test_results['failed_tests'] += 1
        
        logger.info(f"测试 '{test_name}': {'通过' if passed else '失败'}")
    
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
        
        if 'rule_engine_latency' in metrics:
            print(f"规则引擎延迟: {metrics['rule_engine_latency']:.2f}ms")
        
        if 'local_ai_latency' in metrics:
            print(f"本地AI延迟: {metrics['local_ai_latency']:.2f}ms")
        
        if 'hybrid_avg_latency' in metrics:
            print(f"混合分析平均延迟: {metrics['hybrid_avg_latency']:.2f}ms")
            print(f"混合分析P95延迟: {metrics['hybrid_p95_latency']:.2f}ms")
        
        if 'batch_throughput' in metrics:
            print(f"批量处理吞吐量: {metrics['batch_throughput']:.1f} 事件/秒")
        
        if 'method_usage' in metrics:
            print(f"推理方法使用分布: {metrics['method_usage']}")
        
        print("="*60)

async def main():
    """主测试函数"""
    logger.info("开始混合推理引擎集成测试...")
    
    test_suite = HybridEngineTest()
    
    try:
        # 运行所有测试
        await test_suite.test_individual_methods()
        await test_suite.test_hybrid_analysis()
        await test_suite.test_batch_analysis()
        await test_suite.test_scheduler_intelligence()
        
    except Exception as e:
        logger.error(f"测试执行过程中出现错误: {e}")
    
    finally:
        # 打印测试总结
        test_suite.print_test_summary()

if __name__ == "__main__":
    asyncio.run(main()) 