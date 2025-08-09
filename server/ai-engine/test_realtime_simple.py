#!/usr/bin/env python3
"""
实时分析管道简化测试
测试核心分析逻辑，不依赖外部服务
"""

import asyncio
import json
import time
import random
from datetime import datetime, timedelta
from typing import Dict, Any, List
import sys
import os

# 添加路径以便导入模块
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# 简化的测试，只测试核心组件
from src.services.alert_rule_engine import AlertRuleEngine, RuleSeverity, RuleCondition, RuleAction
from src.services.fusion_decision_engine import FusionDecisionEngine, DecisionStrategy, DecisionContext
from src.services.hybrid_inference_engine import HybridInferenceEngine, SecurityEvent, InferenceResult, ThreatLevel, InferenceMethod

class SimpleRealtimePipelineTest:
    """简化的实时分析管道测试"""
    
    def __init__(self):
        self.alert_engine = AlertRuleEngine()
        self.fusion_engine = FusionDecisionEngine()
        self.hybrid_engine = HybridInferenceEngine()
        
        self.test_results = {
            "total_tests": 0,
            "passed_tests": 0,
            "failed_tests": 0,
            "test_details": []
        }
    
    async def run_all_tests(self):
        """运行所有测试"""
        print("🚀 开始实时分析管道核心组件测试...")
        print("=" * 60)
        
        test_methods = [
            self.test_alert_rule_engine,
            self.test_fusion_decision_engine,
            self.test_hybrid_inference_engine,
            self.test_integration_workflow,
            self.test_performance_benchmark
        ]
        
        for test_method in test_methods:
            try:
                await test_method()
            except Exception as e:
                print(f"❌ 测试方法 {test_method.__name__} 执行失败: {e}")
                self._record_test_result(test_method.__name__, False, str(e))
        
        self._print_test_summary()
    
    async def test_alert_rule_engine(self):
        """测试告警规则引擎"""
        print("\n📋 测试告警规则引擎...")
        
        try:
            # 测试规则加载
            rule_stats = self.alert_engine.get_rule_statistics()
            assert rule_stats["total_rules"] > 0, "应该加载了默认规则"
            
            # 创建测试事件和分析结果
            test_event = self._create_test_event("malware", "critical")
            test_result = InferenceResult(
                threat_level=ThreatLevel.CRITICAL,
                confidence=0.95,
                method=InferenceMethod.HYBRID,
                details={"threat_type": "malware", "malware_family": "trojan"},
                processing_time=0.1
            )
            
            # 评估规则
            rule_evaluations = await self.alert_engine.evaluate_event(test_event, test_result)
            
            assert isinstance(rule_evaluations, list), "规则评估结果应该是列表"
            triggered_rules = [eval for eval in rule_evaluations if eval.triggered]
            
            print(f"   ✅ 加载了 {rule_stats['total_rules']} 条规则")
            print(f"   ✅ 评估了 {len(rule_evaluations)} 条规则，触发了 {len(triggered_rules)} 条")
            
            self._record_test_result("test_alert_rule_engine", True, 
                                   f"规则数: {rule_stats['total_rules']}, 触发数: {len(triggered_rules)}")
            
        except Exception as e:
            self._record_test_result("test_alert_rule_engine", False, str(e))
            raise
    
    async def test_fusion_decision_engine(self):
        """测试融合决策引擎"""
        print("\n🧠 测试融合决策引擎...")
        
        try:
            strategies = [
                DecisionStrategy.RULE_PRIORITY,
                DecisionStrategy.AI_PRIORITY,
                DecisionStrategy.WEIGHTED_FUSION,
                DecisionStrategy.CONSENSUS
            ]
            
            test_event = self._create_test_event("apt_attack", "high")
            
            results = {}
            for strategy in strategies:
                decision_context = DecisionContext(
                    event_id=f"fusion_test_{strategy.value}",
                    event_type="apt_attack",
                    source_ip="192.168.1.100",
                    timestamp=datetime.now(),
                    priority=8,
                    metadata={}
                )
                
                fusion_result = await self.fusion_engine.make_decision(
                    test_event, decision_context, strategy
                )
                
                assert fusion_result is not None, f"策略 {strategy.value} 融合结果不能为空"
                assert fusion_result.decision_strategy == strategy, f"返回的策略应该匹配请求的策略"
                
                results[strategy.value] = {
                    "threat_level": fusion_result.final_threat_level.value,
                    "confidence": round(fusion_result.final_confidence, 3),
                    "processing_time": round(fusion_result.processing_time, 4)
                }
            
            print(f"   ✅ 测试了 {len(strategies)} 种融合决策策略")
            for strategy, result in results.items():
                print(f"   📊 {strategy}: 威胁级别={result['threat_level']}, 置信度={result['confidence']}")
            
            self._record_test_result("test_fusion_decision_engine", True, 
                                   f"测试了 {len(strategies)} 种策略")
            
        except Exception as e:
            self._record_test_result("test_fusion_decision_engine", False, str(e))
            raise
    
    async def test_hybrid_inference_engine(self):
        """测试混合推理引擎"""
        print("\n🔬 测试混合推理引擎...")
        
        try:
            # 创建不同类型的安全事件
            test_cases = [
                {"event_type": "network_attack", "severity": "high", "expected_method": "rule_engine"},
                {"event_type": "network_scan", "severity": "medium", "expected_method": "local_model"},
                {"event_type": "unknown_protocol", "severity": "low", "expected_method": "external_api"},
                {"event_type": "normal_traffic", "severity": "low", "expected_method": "hybrid"}
            ]
            
            results = []
            for test_case in test_cases:
                security_event = SecurityEvent(
                    event_id=f"test_{test_case['event_type']}",
                    timestamp=int(datetime.now().timestamp()),
                    event_type=test_case["event_type"],
                    source_ip="192.168.1.100",
                    destination_ip="10.0.0.1",
                    protocol="TCP",
                    payload=None,
                    features={},
                    raw_data=test_case
                )
                
                # 执行分析
                start_time = time.time()
                analysis_result = await self.hybrid_engine.analyze_security_event(security_event)
                processing_time = time.time() - start_time
                
                assert analysis_result is not None, f"分析结果不能为空: {test_case['event_type']}"
                assert hasattr(analysis_result, 'threat_level'), "结果必须包含威胁级别"
                assert hasattr(analysis_result, 'confidence'), "结果必须包含置信度"
                
                results.append({
                    "event_type": test_case["event_type"],
                    "threat_level": analysis_result.threat_level.value,
                    "confidence": round(analysis_result.confidence, 3),
                    "method": analysis_result.method,
                    "processing_time": round(processing_time, 4)
                })
            
            print(f"   ✅ 测试了 {len(test_cases)} 种事件类型")
            for result in results:
                print(f"   📊 {result['event_type']}: {result['threat_level']} (置信度: {result['confidence']}, 方法: {result['method']})")
            
            self._record_test_result("test_hybrid_inference_engine", True, 
                                   f"测试了 {len(test_cases)} 种事件类型")
            
        except Exception as e:
            self._record_test_result("test_hybrid_inference_engine", False, str(e))
            raise
    
    async def test_integration_workflow(self):
        """测试集成工作流程"""
        print("\n🔄 测试集成工作流程...")
        
        try:
            # 模拟完整的分析流程
            test_event = self._create_test_event("malware", "critical")
            
            # 步骤1: 混合推理分析
            security_event = SecurityEvent(
                event_id=test_event["event_id"],
                timestamp=int(datetime.now().timestamp()),
                event_type=test_event["event_type"],
                source_ip=test_event["source_ip"],
                destination_ip=test_event["destination_ip"],
                protocol=test_event["protocol"],
                payload=test_event.get("payload"),
                features={},
                raw_data=test_event
            )
            
            ai_result = await self.hybrid_engine.analyze_security_event(security_event)
            
            # 步骤2: 规则引擎评估
            rule_evaluations = await self.alert_engine.evaluate_event(test_event, ai_result)
            
            # 步骤3: 融合决策
            decision_context = DecisionContext(
                event_id=test_event["event_id"],
                event_type=test_event["event_type"],
                source_ip=test_event["source_ip"],
                timestamp=datetime.now(),
                priority=8,
                metadata=test_event.get("metadata", {})
            )
            
            fusion_result = await self.fusion_engine.make_decision(
                test_event, decision_context, DecisionStrategy.ADAPTIVE
            )
            
            # 验证工作流程
            assert ai_result is not None, "AI分析结果不能为空"
            assert isinstance(rule_evaluations, list), "规则评估结果应该是列表"
            assert fusion_result is not None, "融合决策结果不能为空"
            
            triggered_rules = len([r for r in rule_evaluations if r.triggered])
            
            print(f"   ✅ AI分析: 威胁级别={ai_result.threat_level.value}, 置信度={ai_result.confidence:.3f}")
            print(f"   ✅ 规则评估: 触发了 {triggered_rules} 条规则")
            print(f"   ✅ 融合决策: 最终威胁级别={fusion_result.final_threat_level.value}, 置信度={fusion_result.final_confidence:.3f}")
            print(f"   ✅ 推荐动作: {len(fusion_result.recommended_actions)} 项")
            
            self._record_test_result("test_integration_workflow", True, 
                                   f"完整工作流程测试成功，最终置信度: {fusion_result.final_confidence:.3f}")
            
        except Exception as e:
            self._record_test_result("test_integration_workflow", False, str(e))
            raise
    
    async def test_performance_benchmark(self):
        """测试性能基准"""
        print("\n⚡ 测试性能基准...")
        
        try:
            # 批量性能测试
            batch_size = 50
            test_events = []
            
            for i in range(batch_size):
                event_type = random.choice(["network_attack", "malware", "anomaly", "normal"])
                severity = random.choice(["low", "medium", "high", "critical"])
                test_events.append(self._create_test_event(event_type, severity, f"perf_test_{i}"))
            
            # 测试批量融合决策性能
            start_time = time.time()
            results = []
            
            for event in test_events:
                decision_context = DecisionContext(
                    event_id=event["event_id"],
                    event_type=event["event_type"],
                    source_ip=event["source_ip"],
                    timestamp=datetime.now(),
                    priority=random.randint(1, 10),
                    metadata={}
                )
                
                result = await self.fusion_engine.make_decision(event, decision_context)
                results.append(result)
            
            total_time = time.time() - start_time
            avg_time = total_time / batch_size
            throughput = batch_size / total_time
            
            # 统计结果
            threat_levels = {}
            for result in results:
                level = result.final_threat_level.value
                threat_levels[level] = threat_levels.get(level, 0) + 1
            
            print(f"   ✅ 处理了 {batch_size} 个事件")
            print(f"   ⏱️  总耗时: {total_time:.2f}s")
            print(f"   📊 平均耗时: {avg_time*1000:.1f}ms/事件")
            print(f"   🚀 吞吐量: {throughput:.1f} 事件/秒")
            print(f"   📈 威胁分布: {threat_levels}")
            
            # 性能断言
            assert avg_time < 1.0, f"平均处理时间过长: {avg_time:.3f}s"
            assert throughput > 10, f"吞吐量过低: {throughput:.1f} 事件/秒"
            
            self._record_test_result("test_performance_benchmark", True, 
                                   f"吞吐量: {throughput:.1f} 事件/秒, 平均耗时: {avg_time*1000:.1f}ms")
            
        except Exception as e:
            self._record_test_result("test_performance_benchmark", False, str(e))
            raise
    
    def _create_test_event(self, event_type: str, severity: str, event_id: str = None) -> Dict[str, Any]:
        """创建测试事件"""
        if event_id is None:
            event_id = f"test_{event_type}_{int(time.time() * 1000)}"
        
        return {
            "event_id": event_id,
            "timestamp": datetime.now().isoformat(),
            "event_type": event_type,
            "severity": severity,
            "source_ip": f"192.168.1.{random.randint(1, 254)}",
            "destination_ip": f"10.0.0.{random.randint(1, 254)}",
            "protocol": random.choice(["TCP", "UDP", "ICMP"]),
            "port": random.randint(1, 65535),
            "agent_id": f"agent_{random.randint(1, 100)}",
            "payload": f"test_payload_{event_type}",
            "metadata": {
                "test": True,
                "created_at": datetime.now().isoformat()
            }
        }
    
    def _record_test_result(self, test_name: str, passed: bool, details: str = ""):
        """记录测试结果"""
        self.test_results["total_tests"] += 1
        if passed:
            self.test_results["passed_tests"] += 1
        else:
            self.test_results["failed_tests"] += 1
        
        self.test_results["test_details"].append({
            "test_name": test_name,
            "passed": passed,
            "details": details,
            "timestamp": datetime.now().isoformat()
        })
    
    def _print_test_summary(self):
        """打印测试摘要"""
        results = self.test_results
        total = results["total_tests"]
        passed = results["passed_tests"]
        failed = results["failed_tests"]
        
        print("\n" + "=" * 60)
        print("🎯 实时分析管道测试摘要")
        print("=" * 60)
        print(f"📊 总测试数: {total}")
        print(f"✅ 通过测试: {passed}")
        print(f"❌ 失败测试: {failed}")
        print(f"🎉 成功率: {(passed/total*100):.1f}%" if total > 0 else "🎉 成功率: N/A")
        print("=" * 60)
        
        if failed > 0:
            print("❌ 失败的测试:")
            for detail in results["test_details"]:
                if not detail["passed"]:
                    print(f"   - {detail['test_name']}: {detail['details']}")
        else:
            print("🎊 所有测试都通过了！实时分析管道核心功能正常运行。")
        
        print("=" * 60)

async def main():
    """主测试函数"""
    test_runner = SimpleRealtimePipelineTest()
    
    try:
        await test_runner.run_all_tests()
    except Exception as e:
        print(f"❌ 测试执行异常: {e}")
        return False
    
    # 返回测试是否全部通过
    return test_runner.test_results["failed_tests"] == 0

if __name__ == "__main__":
    success = asyncio.run(main())
    exit(0 if success else 1) 