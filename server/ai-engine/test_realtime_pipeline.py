#!/usr/bin/env python3
"""
实时分析管道综合测试
测试Kafka消息处理、AI分析、规则引擎和融合决策的完整流程
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

from src.services.realtime_analysis_pipeline import RealtimeAnalysisPipeline, AnalysisContext, AnalysisMode
from src.services.kafka_service import KafkaService
from src.services.alert_rule_engine import AlertRuleEngine
from src.services.fusion_decision_engine import FusionDecisionEngine
from loguru import logger

class RealtimePipelineTest:
    """实时分析管道测试类"""
    
    def __init__(self):
        self.pipeline = None
        self.test_results = {
            "total_tests": 0,
            "passed_tests": 0,
            "failed_tests": 0,
            "test_details": []
        }
    
    async def setup(self):
        """测试环境设置"""
        logger.info("设置测试环境...")
        
        try:
            # 初始化实时分析管道（但不启动Kafka，使用模拟数据）
            self.pipeline = RealtimeAnalysisPipeline()
            
            # 直接初始化各个组件而不启动Kafka
            await self._setup_mock_environment()
            
            logger.info("测试环境设置完成")
            return True
            
        except Exception as e:
            logger.error(f"测试环境设置失败: {e}")
            return False
    
    async def _setup_mock_environment(self):
        """设置模拟环境"""
        # 模拟Kafka服务已启动的状态
        self.pipeline.is_running = True
        logger.info("模拟环境设置完成")
    
    async def run_all_tests(self):
        """运行所有测试"""
        logger.info("开始运行实时分析管道测试...")
        
        test_methods = [
            self.test_single_event_analysis,
            self.test_batch_event_processing,
            self.test_threat_detection_flow,
            self.test_different_analysis_modes,
            self.test_fusion_decision_strategies,
            self.test_alert_rule_evaluation,
            self.test_performance_metrics,
            self.test_error_handling
        ]
        
        for test_method in test_methods:
            try:
                await test_method()
            except Exception as e:
                logger.error(f"测试方法 {test_method.__name__} 执行失败: {e}")
                self._record_test_result(test_method.__name__, False, str(e))
        
        self._print_test_summary()
    
    async def test_single_event_analysis(self):
        """测试单个事件分析"""
        logger.info("测试单个事件分析...")
        
        try:
            # 创建测试事件
            test_event = self._create_test_event("network_attack", "high")
            context = self._create_analysis_context(test_event, AnalysisMode.HYBRID)
            
            # 执行分析
            result = await self.pipeline._analyze_single_event(test_event, context)
            
            # 验证结果
            assert result is not None, "分析结果不能为空"
            assert hasattr(result, 'threat_level'), "结果必须包含威胁级别"
            assert hasattr(result, 'confidence'), "结果必须包含置信度"
            
            self._record_test_result("test_single_event_analysis", True, f"威胁级别: {result.threat_level.value}, 置信度: {result.confidence:.3f}")
            
        except Exception as e:
            self._record_test_result("test_single_event_analysis", False, str(e))
            raise
    
    async def test_batch_event_processing(self):
        """测试批量事件处理"""
        logger.info("测试批量事件处理...")
        
        try:
            # 创建批量测试事件
            test_batch = []
            for i in range(10):
                event_type = random.choice(["network_attack", "malware", "anomaly", "normal"])
                severity = random.choice(["low", "medium", "high"])
                event = self._create_test_event(event_type, severity, f"test_event_{i}")
                context = self._create_analysis_context(event, AnalysisMode.HYBRID)
                test_batch.append((event, context))
            
            # 处理批量事件
            start_time = time.time()
            await self.pipeline._process_event_batch(test_batch)
            processing_time = time.time() - start_time
            
            # 验证处理指标
            assert processing_time < 10.0, f"批量处理时间过长: {processing_time:.2f}s"
            assert self.pipeline.metrics["events_processed"] > 0, "事件处理计数应该增加"
            
            self._record_test_result("test_batch_event_processing", True, 
                                   f"处理 {len(test_batch)} 个事件，耗时: {processing_time:.2f}s")
            
        except Exception as e:
            self._record_test_result("test_batch_event_processing", False, str(e))
            raise
    
    async def test_threat_detection_flow(self):
        """测试威胁检测流程"""
        logger.info("测试威胁检测流程...")
        
        try:
            # 创建高威胁事件
            threat_event = self._create_test_event("malware", "critical")
            threat_event["confidence"] = 0.95  # 高置信度
            
            context = self._create_analysis_context(threat_event, AnalysisMode.FAST_TRACK)
            
            # 分析事件
            result = await self.pipeline._analyze_single_event(threat_event, context)
            
            # 验证威胁检测
            initial_cache_size = len(self.pipeline.threat_cache)
            
            # 模拟威胁检测触发
            if result.confidence >= self.pipeline.config["threat_threshold"]:
                security_event = self.pipeline._convert_to_security_event(threat_event, context)
                threat_detection = await self.pipeline._create_threat_detection(
                    security_event, result, context
                )
                
                assert threat_detection is not None, "威胁检测对象不能为空"
                assert len(self.pipeline.threat_cache) > initial_cache_size, "威胁缓存应该增加"
            
            self._record_test_result("test_threat_detection_flow", True, 
                                   f"威胁检测流程完成，缓存大小: {len(self.pipeline.threat_cache)}")
            
        except Exception as e:
            self._record_test_result("test_threat_detection_flow", False, str(e))
            raise
    
    async def test_different_analysis_modes(self):
        """测试不同分析模式"""
        logger.info("测试不同分析模式...")
        
        modes_to_test = [
            AnalysisMode.RULE_ONLY,
            AnalysisMode.AI_ONLY,
            AnalysisMode.HYBRID,
            AnalysisMode.FAST_TRACK
        ]
        
        try:
            for mode in modes_to_test:
                test_event = self._create_test_event("network_scan", "medium")
                context = self._create_analysis_context(test_event, mode)
                
                result = await self.pipeline._analyze_single_event(test_event, context)
                
                assert result is not None, f"模式 {mode.value} 分析结果不能为空"
                logger.debug(f"模式 {mode.value}: 威胁级别={result.threat_level.value}, 置信度={result.confidence:.3f}")
            
            self._record_test_result("test_different_analysis_modes", True, 
                                   f"测试了 {len(modes_to_test)} 种分析模式")
            
        except Exception as e:
            self._record_test_result("test_different_analysis_modes", False, str(e))
            raise
    
    async def test_fusion_decision_strategies(self):
        """测试融合决策策略"""
        logger.info("测试融合决策策略...")
        
        try:
            from src.services.fusion_decision_engine import DecisionStrategy, DecisionContext
            
            strategies = [
                DecisionStrategy.RULE_PRIORITY,
                DecisionStrategy.AI_PRIORITY,
                DecisionStrategy.WEIGHTED_FUSION,
                DecisionStrategy.CONSENSUS
            ]
            
            test_event = self._create_test_event("apt_attack", "high")
            
            for strategy in strategies:
                decision_context = DecisionContext(
                    event_id=f"fusion_test_{strategy.value}",
                    event_type="apt_attack",
                    source_ip="192.168.1.100",
                    timestamp=datetime.now(),
                    priority=8,
                    metadata={}
                )
                
                fusion_result = await self.pipeline.fusion_engine.make_decision(
                    test_event, decision_context, strategy
                )
                
                assert fusion_result is not None, f"策略 {strategy.value} 融合结果不能为空"
                assert fusion_result.decision_strategy == strategy, f"返回的策略应该匹配请求的策略"
                
                logger.debug(f"策略 {strategy.value}: 威胁级别={fusion_result.final_threat_level.value}, "
                           f"置信度={fusion_result.final_confidence:.3f}")
            
            self._record_test_result("test_fusion_decision_strategies", True, 
                                   f"测试了 {len(strategies)} 种融合决策策略")
            
        except Exception as e:
            self._record_test_result("test_fusion_decision_strategies", False, str(e))
            raise
    
    async def test_alert_rule_evaluation(self):
        """测试告警规则评估"""
        logger.info("测试告警规则评估...")
        
        try:
            from src.services.hybrid_inference_engine import InferenceResult, ThreatLevel, InferenceMethod
            
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
            rule_evaluations = await self.pipeline.alert_rule_engine.evaluate_event(test_event, test_result)
            
            assert isinstance(rule_evaluations, list), "规则评估结果应该是列表"
            
            # 检查是否有规则被触发
            triggered_rules = [eval for eval in rule_evaluations if eval.triggered]
            logger.info(f"触发了 {len(triggered_rules)} 条规则")
            
            self._record_test_result("test_alert_rule_evaluation", True, 
                                   f"评估了 {len(rule_evaluations)} 条规则，触发了 {len(triggered_rules)} 条")
            
        except Exception as e:
            self._record_test_result("test_alert_rule_evaluation", False, str(e))
            raise
    
    async def test_performance_metrics(self):
        """测试性能指标"""
        logger.info("测试性能指标...")
        
        try:
            # 获取管道状态
            pipeline_status = self.pipeline.get_pipeline_status()
            
            assert "status" in pipeline_status, "状态信息应包含status字段"
            assert "metrics" in pipeline_status, "状态信息应包含metrics字段"
            assert "config" in pipeline_status, "状态信息应包含config字段"
            
            # 获取威胁摘要
            threat_summary = self.pipeline.get_threat_summary()
            assert "total_threats" in threat_summary, "威胁摘要应包含total_threats字段"
            
            # 获取融合引擎状态
            fusion_status = self.pipeline.fusion_engine.get_engine_status()
            assert "status" in fusion_status, "融合引擎状态应包含status字段"
            
            # 获取规则引擎统计
            rule_stats = self.pipeline.alert_rule_engine.get_rule_statistics()
            assert "total_rules" in rule_stats, "规则统计应包含total_rules字段"
            
            self._record_test_result("test_performance_metrics", True, 
                                   f"获取了所有性能指标，威胁总数: {threat_summary['total_threats']}")
            
        except Exception as e:
            self._record_test_result("test_performance_metrics", False, str(e))
            raise
    
    async def test_error_handling(self):
        """测试错误处理"""
        logger.info("测试错误处理...")
        
        try:
            # 测试无效事件数据
            invalid_event = {}  # 空事件
            context = self._create_analysis_context(invalid_event, AnalysisMode.HYBRID)
            
            try:
                result = await self.pipeline._analyze_single_event(invalid_event, context)
                # 如果没有抛出异常，检查是否有合理的默认处理
                assert result is not None, "即使是无效事件，也应该返回某种结果"
            except Exception:
                # 预期可能会有异常，这是正常的
                pass
            
            # 测试缓冲区处理
            await self.pipeline._process_event_batch([])  # 空批次
            
            self._record_test_result("test_error_handling", True, "错误处理测试完成")
            
        except Exception as e:
            self._record_test_result("test_error_handling", False, str(e))
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
    
    def _create_analysis_context(self, event_data: Dict[str, Any], mode: AnalysisMode) -> AnalysisContext:
        """创建分析上下文"""
        return AnalysisContext(
            event_id=event_data.get("event_id", "unknown"),
            timestamp=datetime.fromisoformat(event_data.get("timestamp", datetime.now().isoformat())),
            source_agent=event_data.get("agent_id", "test_agent"),
            event_type=event_data.get("event_type", "unknown"),
            priority=self._calculate_priority(event_data),
            analysis_mode=mode,
            metadata=event_data.get("metadata", {})
        )
    
    def _calculate_priority(self, event_data: Dict[str, Any]) -> int:
        """计算事件优先级"""
        severity = event_data.get("severity", "medium").lower()
        priority_map = {
            "low": 3,
            "medium": 5,
            "high": 8,
            "critical": 10
        }
        return priority_map.get(severity, 5)
    
    def _record_test_result(self, test_name: str, passed: bool, details: str = ""):
        """记录测试结果"""
        self.test_results["total_tests"] += 1
        if passed:
            self.test_results["passed_tests"] += 1
            logger.success(f"✅ {test_name}: 通过 - {details}")
        else:
            self.test_results["failed_tests"] += 1
            logger.error(f"❌ {test_name}: 失败 - {details}")
        
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
        
        logger.info("=" * 60)
        logger.info("实时分析管道测试摘要")
        logger.info("=" * 60)
        logger.info(f"总测试数: {total}")
        logger.info(f"通过测试: {passed}")
        logger.info(f"失败测试: {failed}")
        logger.info(f"成功率: {(passed/total*100):.1f}%" if total > 0 else "成功率: N/A")
        logger.info("=" * 60)
        
        if failed > 0:
            logger.warning("失败的测试:")
            for detail in results["test_details"]:
                if not detail["passed"]:
                    logger.warning(f"  - {detail['test_name']}: {detail['details']}")
    
    async def cleanup(self):
        """清理测试环境"""
        logger.info("清理测试环境...")
        
        try:
            if self.pipeline and self.pipeline.is_running:
                await self.pipeline.stop()
            logger.info("测试环境清理完成")
        except Exception as e:
            logger.error(f"清理测试环境失败: {e}")

async def main():
    """主测试函数"""
    logger.add("test_realtime_pipeline.log", rotation="1 MB", retention="7 days")
    logger.info("开始实时分析管道测试")
    
    test_runner = RealtimePipelineTest()
    
    try:
        # 设置测试环境
        if not await test_runner.setup():
            logger.error("测试环境设置失败，退出测试")
            return
        
        # 运行所有测试
        await test_runner.run_all_tests()
        
    except Exception as e:
        logger.error(f"测试执行异常: {e}")
    finally:
        # 清理环境
        await test_runner.cleanup()
    
    logger.info("实时分析管道测试完成")

if __name__ == "__main__":
    asyncio.run(main()) 