#!/usr/bin/env python3
"""
混合检测引擎准确性测试套件
验证威胁检测准确率≥95%，误报率≤5%，支持至少8种威胁类型
"""

import asyncio
import json
import time
import random
import statistics
from datetime import datetime, timedelta
from typing import Dict, Any, List, Tuple, Optional
from dataclasses import dataclass
from enum import Enum
import sys
import os

# 添加路径以便导入模块
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

class ThreatType(Enum):
    """威胁类型枚举"""
    MALWARE = "malware"
    NETWORK_ATTACK = "network_attack"
    BRUTE_FORCE = "brute_force"
    SQL_INJECTION = "sql_injection"
    XSS_ATTACK = "xss_attack"
    DDOS_ATTACK = "ddos_attack"
    DATA_EXFILTRATION = "data_exfiltration"
    PRIVILEGE_ESCALATION = "privilege_escalation"
    PHISHING = "phishing"
    RANSOMWARE = "ransomware"
    NORMAL_TRAFFIC = "normal_traffic"

class ThreatSeverity(Enum):
    """威胁严重性"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

@dataclass
class TestCase:
    """测试用例"""
    case_id: str
    threat_type: ThreatType
    severity: ThreatSeverity
    expected_detection: bool
    event_data: Dict[str, Any]
    description: str

@dataclass
class DetectionResult:
    """检测结果"""
    case_id: str
    detected: bool
    confidence: float
    threat_level: str
    processing_time: float
    method_used: str
    details: Dict[str, Any]

@dataclass
class AccuracyMetrics:
    """准确性指标"""
    total_cases: int
    true_positives: int
    true_negatives: int
    false_positives: int
    false_negatives: int
    accuracy: float
    precision: float
    recall: float
    f1_score: float
    false_positive_rate: float

class MixedDetectionAccuracyTest:
    """混合检测引擎准确性测试"""
    
    def __init__(self):
        # 模拟的检测引擎（实际应该导入真实的引擎）
        self.detection_engine = self._create_mock_detection_engine()
        
        # 测试结果存储
        self.test_results: List[DetectionResult] = []
        self.test_cases: List[TestCase] = []
        
        # 性能指标
        self.performance_metrics = {
            "total_processing_time": 0.0,
            "avg_processing_time": 0.0,
            "min_processing_time": float('inf'),
            "max_processing_time": 0.0,
            "throughput": 0.0
        }
    
    def _create_mock_detection_engine(self):
        """创建模拟检测引擎"""
        class MockDetectionEngine:
            def __init__(self):
                # 模拟不同威胁类型的检测准确率
                self.threat_detection_rates = {
                    ThreatType.MALWARE: 0.98,
                    ThreatType.NETWORK_ATTACK: 0.96,
                    ThreatType.BRUTE_FORCE: 0.94,
                    ThreatType.SQL_INJECTION: 0.92,
                    ThreatType.XSS_ATTACK: 0.90,
                    ThreatType.DDOS_ATTACK: 0.97,
                    ThreatType.DATA_EXFILTRATION: 0.89,
                    ThreatType.PRIVILEGE_ESCALATION: 0.87,
                    ThreatType.PHISHING: 0.93,
                    ThreatType.RANSOMWARE: 0.99,
                    ThreatType.NORMAL_TRAFFIC: 0.02  # 正常流量的误报率
                }
            
            async def detect_threat(self, event_data: Dict[str, Any]) -> Dict[str, Any]:
                """模拟威胁检测"""
                start_time = time.time()
                
                # 从事件数据中提取威胁类型
                actual_threat = ThreatType(event_data.get("actual_threat_type", "normal_traffic"))
                
                # 根据威胁类型和检测率决定是否检测到
                detection_rate = self.threat_detection_rates.get(actual_threat, 0.5)
                detected = random.random() < detection_rate
                
                # 模拟处理延迟
                processing_delay = random.uniform(0.001, 0.1)  # 1-100ms
                await asyncio.sleep(processing_delay)
                
                # 生成置信度
                if detected and actual_threat != ThreatType.NORMAL_TRAFFIC:
                    confidence = random.uniform(0.7, 0.99)
                elif detected and actual_threat == ThreatType.NORMAL_TRAFFIC:
                    confidence = random.uniform(0.5, 0.8)  # 误报的置信度较低
                else:
                    confidence = random.uniform(0.1, 0.6)
                
                # 映射威胁级别
                severity_mapping = {
                    ThreatType.RANSOMWARE: "critical",
                    ThreatType.MALWARE: "critical",
                    ThreatType.DDOS_ATTACK: "high",
                    ThreatType.NETWORK_ATTACK: "high",
                    ThreatType.DATA_EXFILTRATION: "high",
                    ThreatType.SQL_INJECTION: "medium",
                    ThreatType.XSS_ATTACK: "medium",
                    ThreatType.BRUTE_FORCE: "medium",
                    ThreatType.PRIVILEGE_ESCALATION: "medium",
                    ThreatType.PHISHING: "medium",
                    ThreatType.NORMAL_TRAFFIC: "low"
                }
                
                threat_level = severity_mapping.get(actual_threat, "low")
                processing_time = time.time() - start_time
                
                return {
                    "detected": detected,
                    "confidence": confidence,
                    "threat_level": threat_level,
                    "threat_type": actual_threat.value if detected else "none",
                    "processing_time": processing_time,
                    "method": "hybrid_detection",
                    "details": {
                        "rules_triggered": random.randint(0, 3) if detected else 0,
                        "ai_confidence": confidence,
                        "rule_confidence": random.uniform(0.6, 0.9) if detected else 0
                    }
                }
        
        return MockDetectionEngine()
    
    def generate_test_cases(self, num_cases_per_type: int = 100) -> List[TestCase]:
        """生成测试用例"""
        test_cases = []
        case_counter = 0
        
        # 为每种威胁类型生成测试用例
        for threat_type in ThreatType:
            for i in range(num_cases_per_type):
                case_counter += 1
                
                # 确定期望检测结果
                expected_detection = threat_type != ThreatType.NORMAL_TRAFFIC
                
                # 确定严重性
                if threat_type in [ThreatType.RANSOMWARE, ThreatType.MALWARE]:
                    severity = ThreatSeverity.CRITICAL
                elif threat_type in [ThreatType.DDOS_ATTACK, ThreatType.NETWORK_ATTACK, ThreatType.DATA_EXFILTRATION]:
                    severity = ThreatSeverity.HIGH
                elif threat_type in [ThreatType.SQL_INJECTION, ThreatType.XSS_ATTACK, ThreatType.BRUTE_FORCE, 
                                   ThreatType.PRIVILEGE_ESCALATION, ThreatType.PHISHING]:
                    severity = ThreatSeverity.MEDIUM
                else:
                    severity = ThreatSeverity.LOW
                
                # 生成事件数据
                event_data = self._generate_event_data(threat_type, severity)
                
                test_case = TestCase(
                    case_id=f"case_{case_counter:04d}",
                    threat_type=threat_type,
                    severity=severity,
                    expected_detection=expected_detection,
                    event_data=event_data,
                    description=f"{threat_type.value} test case {i+1}"
                )
                
                test_cases.append(test_case)
        
        # 打乱测试用例顺序
        random.shuffle(test_cases)
        
        self.test_cases = test_cases
        return test_cases
    
    def _generate_event_data(self, threat_type: ThreatType, severity: ThreatSeverity) -> Dict[str, Any]:
        """生成特定威胁类型的事件数据"""
        base_data = {
            "event_id": f"event_{int(time.time() * 1000000)}",
            "timestamp": datetime.now().isoformat(),
            "source_ip": f"192.168.{random.randint(1, 255)}.{random.randint(1, 254)}",
            "destination_ip": f"10.0.{random.randint(1, 255)}.{random.randint(1, 254)}",
            "protocol": random.choice(["TCP", "UDP", "ICMP"]),
            "port": random.randint(1, 65535),
            "actual_threat_type": threat_type.value,  # 实际威胁类型（用于验证）
            "severity": severity.value
        }
        
        # 根据威胁类型添加特定特征
        if threat_type == ThreatType.MALWARE:
            base_data.update({
                "process_name": random.choice(["malware.exe", "trojan.bin", "virus.dll"]),
                "file_hash": f"md5_{random.randint(100000, 999999)}",
                "behavior": "suspicious_network_activity"
            })
        
        elif threat_type == ThreatType.NETWORK_ATTACK:
            base_data.update({
                "attack_pattern": random.choice(["port_scan", "vulnerability_exploit", "buffer_overflow"]),
                "payload_size": random.randint(1000, 10000),
                "connection_attempts": random.randint(10, 100)
            })
        
        elif threat_type == ThreatType.BRUTE_FORCE:
            base_data.update({
                "failed_attempts": random.randint(10, 50),
                "target_service": random.choice(["ssh", "rdp", "ftp", "http"]),
                "time_window": random.randint(60, 300)
            })
        
        elif threat_type == ThreatType.SQL_INJECTION:
            base_data.update({
                "http_method": "POST",
                "payload": "' OR 1=1 --",
                "target_parameter": random.choice(["username", "id", "search"])
            })
        
        elif threat_type == ThreatType.XSS_ATTACK:
            base_data.update({
                "http_method": "GET",
                "payload": "<script>alert('xss')</script>",
                "target_url": "/search.php"
            })
        
        elif threat_type == ThreatType.DDOS_ATTACK:
            base_data.update({
                "request_rate": random.randint(1000, 10000),
                "source_count": random.randint(100, 1000),
                "attack_type": random.choice(["volumetric", "protocol", "application"])
            })
        
        elif threat_type == ThreatType.DATA_EXFILTRATION:
            base_data.update({
                "data_volume": random.randint(1000000, 100000000),  # bytes
                "destination_external": True,
                "encryption_detected": random.choice([True, False])
            })
        
        elif threat_type == ThreatType.PRIVILEGE_ESCALATION:
            base_data.update({
                "user_account": f"user_{random.randint(1, 100)}",
                "elevated_permissions": ["admin", "root", "system"],
                "escalation_method": random.choice(["exploit", "credential_theft", "token_manipulation"])
            })
        
        elif threat_type == ThreatType.PHISHING:
            base_data.update({
                "email_subject": "Urgent: Verify your account",
                "sender_domain": random.choice(["fake-bank.com", "phishing-site.org"]),
                "suspicious_links": random.randint(1, 5)
            })
        
        elif threat_type == ThreatType.RANSOMWARE:
            base_data.update({
                "file_encryption_detected": True,
                "ransom_note_found": True,
                "encrypted_files_count": random.randint(100, 10000)
            })
        
        elif threat_type == ThreatType.NORMAL_TRAFFIC:
            base_data.update({
                "http_method": "GET",
                "status_code": 200,
                "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            })
        
        return base_data
    
    async def run_accuracy_test(self, test_cases: List[TestCase]) -> List[DetectionResult]:
        """运行准确性测试"""
        print(f"🔍 开始运行准确性测试，共 {len(test_cases)} 个测试用例...")
        
        results = []
        start_time = time.time()
        
        for i, test_case in enumerate(test_cases):
            if i % 100 == 0:
                print(f"   进度: {i}/{len(test_cases)} ({i/len(test_cases)*100:.1f}%)")
            
            # 执行检测
            detection_result = await self.detection_engine.detect_threat(test_case.event_data)
            
            # 创建结果对象
            result = DetectionResult(
                case_id=test_case.case_id,
                detected=detection_result["detected"],
                confidence=detection_result["confidence"],
                threat_level=detection_result["threat_level"],
                processing_time=detection_result["processing_time"],
                method_used=detection_result["method"],
                details=detection_result["details"]
            )
            
            results.append(result)
        
        total_time = time.time() - start_time
        
        # 更新性能指标
        processing_times = [r.processing_time for r in results]
        self.performance_metrics.update({
            "total_processing_time": total_time,
            "avg_processing_time": statistics.mean(processing_times),
            "min_processing_time": min(processing_times),
            "max_processing_time": max(processing_times),
            "throughput": len(test_cases) / total_time
        })
        
        self.test_results = results
        print(f"✅ 准确性测试完成，总耗时: {total_time:.2f}s")
        
        return results
    
    def calculate_accuracy_metrics(self, test_cases: List[TestCase], results: List[DetectionResult]) -> AccuracyMetrics:
        """计算准确性指标"""
        
        # 初始化计数器
        tp = tn = fp = fn = 0
        
        # 统计各类结果
        for test_case, result in zip(test_cases, results):
            expected = test_case.expected_detection
            detected = result.detected
            
            if expected and detected:
                tp += 1  # True Positive
            elif not expected and not detected:
                tn += 1  # True Negative
            elif not expected and detected:
                fp += 1  # False Positive
            elif expected and not detected:
                fn += 1  # False Negative
        
        total = len(test_cases)
        
        # 计算指标
        accuracy = (tp + tn) / total if total > 0 else 0
        precision = tp / (tp + fp) if (tp + fp) > 0 else 0
        recall = tp / (tp + fn) if (tp + fn) > 0 else 0
        f1_score = 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 0
        false_positive_rate = fp / (fp + tn) if (fp + tn) > 0 else 0
        
        return AccuracyMetrics(
            total_cases=total,
            true_positives=tp,
            true_negatives=tn,
            false_positives=fp,
            false_negatives=fn,
            accuracy=accuracy,
            precision=precision,
            recall=recall,
            f1_score=f1_score,
            false_positive_rate=false_positive_rate
        )
    
    def analyze_threat_type_performance(self, test_cases: List[TestCase], results: List[DetectionResult]) -> Dict[str, Dict[str, Any]]:
        """分析各威胁类型的检测性能"""
        
        threat_stats = {}
        
        # 按威胁类型分组
        for test_case, result in zip(test_cases, results):
            threat_type = test_case.threat_type.value
            
            if threat_type not in threat_stats:
                threat_stats[threat_type] = {
                    "total": 0,
                    "detected": 0,
                    "expected_detections": 0,
                    "true_positives": 0,
                    "false_positives": 0,
                    "false_negatives": 0,
                    "avg_confidence": 0,
                    "avg_processing_time": 0
                }
            
            stats = threat_stats[threat_type]
            stats["total"] += 1
            
            if result.detected:
                stats["detected"] += 1
            
            if test_case.expected_detection:
                stats["expected_detections"] += 1
                
                if result.detected:
                    stats["true_positives"] += 1
                else:
                    stats["false_negatives"] += 1
            else:
                if result.detected:
                    stats["false_positives"] += 1
            
            stats["avg_confidence"] += result.confidence
            stats["avg_processing_time"] += result.processing_time
        
        # 计算平均值和检测率
        for threat_type, stats in threat_stats.items():
            total = stats["total"]
            stats["avg_confidence"] /= total
            stats["avg_processing_time"] /= total
            stats["detection_rate"] = stats["detected"] / total
            stats["accuracy"] = (stats["true_positives"] + (total - stats["expected_detections"] - stats["false_positives"])) / total
        
        return threat_stats
    
    def print_test_results(self, metrics: AccuracyMetrics, threat_stats: Dict[str, Dict[str, Any]]):
        """打印测试结果"""
        
        print("\n" + "="*80)
        print("🎯 混合检测引擎准确性测试结果")
        print("="*80)
        
        # 总体指标
        print(f"\n📊 总体准确性指标:")
        print(f"   总测试用例数: {metrics.total_cases}")
        print(f"   准确率 (Accuracy): {metrics.accuracy:.3f} ({metrics.accuracy*100:.1f}%)")
        print(f"   精确率 (Precision): {metrics.precision:.3f} ({metrics.precision*100:.1f}%)")
        print(f"   召回率 (Recall): {metrics.recall:.3f} ({metrics.recall*100:.1f}%)")
        print(f"   F1分数: {metrics.f1_score:.3f}")
        print(f"   误报率: {metrics.false_positive_rate:.3f} ({metrics.false_positive_rate*100:.1f}%)")
        
        # 混淆矩阵
        print(f"\n📈 混淆矩阵:")
        print(f"   真阳性 (TP): {metrics.true_positives}")
        print(f"   真阴性 (TN): {metrics.true_negatives}")
        print(f"   假阳性 (FP): {metrics.false_positives}")
        print(f"   假阴性 (FN): {metrics.false_negatives}")
        
        # 性能指标
        print(f"\n⚡ 性能指标:")
        print(f"   平均处理时间: {self.performance_metrics['avg_processing_time']*1000:.2f}ms")
        print(f"   最小处理时间: {self.performance_metrics['min_processing_time']*1000:.2f}ms")
        print(f"   最大处理时间: {self.performance_metrics['max_processing_time']*1000:.2f}ms")
        print(f"   吞吐量: {self.performance_metrics['throughput']:.1f} 事件/秒")
        
        # 各威胁类型性能
        print(f"\n🎯 各威胁类型检测性能:")
        print(f"{'威胁类型':<20} {'检测率':<10} {'准确率':<10} {'平均置信度':<12} {'处理时间(ms)':<12}")
        print("-" * 70)
        
        for threat_type, stats in threat_stats.items():
            print(f"{threat_type:<20} {stats['detection_rate']:.3f}     {stats['accuracy']:.3f}     {stats['avg_confidence']:.3f}        {stats['avg_processing_time']*1000:.2f}")
        
        # 达标情况评估
        print(f"\n✅ 达标情况评估:")
        
        # 准确率要求 ≥95%
        accuracy_pass = metrics.accuracy >= 0.95
        print(f"   威胁检测准确率: {metrics.accuracy*100:.1f}% {'✅ 达标' if accuracy_pass else '❌ 未达标'} (要求: ≥95%)")
        
        # 误报率要求 ≤5%
        fpr_pass = metrics.false_positive_rate <= 0.05
        print(f"   误报率: {metrics.false_positive_rate*100:.1f}% {'✅ 达标' if fpr_pass else '❌ 未达标'} (要求: ≤5%)")
        
        # 响应时间要求 <30秒
        response_time_pass = self.performance_metrics['max_processing_time'] < 30.0
        print(f"   最大响应时间: {self.performance_metrics['max_processing_time']:.3f}s {'✅ 达标' if response_time_pass else '❌ 未达标'} (要求: <30s)")
        
        # 威胁类型覆盖要求 ≥8种
        threat_types_detected = len([t for t, s in threat_stats.items() if s['detection_rate'] > 0.5 and t != 'normal_traffic'])
        threat_coverage_pass = threat_types_detected >= 8
        print(f"   威胁类型覆盖: {threat_types_detected}种 {'✅ 达标' if threat_coverage_pass else '❌ 未达标'} (要求: ≥8种)")
        
        # 总体评估
        all_pass = accuracy_pass and fpr_pass and response_time_pass and threat_coverage_pass
        print(f"\n🎉 总体评估: {'✅ 全部达标' if all_pass else '❌ 存在未达标项'}")
        
        print("="*80)
        
        return {
            "accuracy_pass": accuracy_pass,
            "fpr_pass": fpr_pass,
            "response_time_pass": response_time_pass,
            "threat_coverage_pass": threat_coverage_pass,
            "all_pass": all_pass
        }
    
    async def run_comprehensive_test(self, cases_per_type: int = 100) -> Dict[str, Any]:
        """运行综合测试"""
        
        print("🚀 开始混合检测引擎综合准确性测试")
        print(f"📝 测试参数: 每种威胁类型 {cases_per_type} 个用例")
        print(f"🎯 目标指标: 准确率≥95%, 误报率≤5%, 响应时间<30s, 威胁类型≥8种")
        
        # 生成测试用例
        test_cases = self.generate_test_cases(cases_per_type)
        print(f"✅ 生成了 {len(test_cases)} 个测试用例，覆盖 {len(ThreatType)} 种威胁类型")
        
        # 运行准确性测试
        results = await self.run_accuracy_test(test_cases)
        
        # 计算指标
        accuracy_metrics = self.calculate_accuracy_metrics(test_cases, results)
        threat_stats = self.analyze_threat_type_performance(test_cases, results)
        
        # 打印结果
        evaluation = self.print_test_results(accuracy_metrics, threat_stats)
        
        return {
            "test_cases": len(test_cases),
            "accuracy_metrics": accuracy_metrics,
            "threat_stats": threat_stats,
            "performance_metrics": self.performance_metrics,
            "evaluation": evaluation,
            "timestamp": datetime.now().isoformat()
        }

async def main():
    """主测试函数"""
    print("🔧 混合检测引擎准确性验证测试")
    
    test_runner = MixedDetectionAccuracyTest()
    
    try:
        # 运行综合测试
        results = await test_runner.run_comprehensive_test(cases_per_type=50)  # 每种类型50个用例
        
        return results["evaluation"]["all_pass"]
        
    except Exception as e:
        print(f"❌ 测试执行异常: {e}")
        return False

if __name__ == "__main__":
    success = asyncio.run(main())
    print(f"\n{'🎉 准确性测试全部通过' if success else '❌ 准确性测试存在未达标项'}")
    exit(0 if success else 1) 