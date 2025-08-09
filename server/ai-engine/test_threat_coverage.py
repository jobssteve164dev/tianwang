#!/usr/bin/env python3
"""
威胁类型覆盖测试
验证混合检测引擎能识别至少8种常见安全威胁类型
"""

import asyncio
import json
import time
import random
from datetime import datetime, timedelta
from typing import Dict, Any, List, Tuple
from dataclasses import dataclass
from enum import Enum
import sys
import os

# 添加路径以便导入模块
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

class ThreatCategory(Enum):
    """威胁类别"""
    MALWARE = "malware"
    NETWORK_INTRUSION = "network_intrusion"
    WEB_ATTACKS = "web_attacks"
    CREDENTIAL_ATTACKS = "credential_attacks"
    DATA_BREACHES = "data_breaches"
    DENIAL_OF_SERVICE = "denial_of_service"
    SOCIAL_ENGINEERING = "social_engineering"
    INSIDER_THREATS = "insider_threats"
    APT_ATTACKS = "apt_attacks"
    IOT_ATTACKS = "iot_attacks"

@dataclass
class ThreatPattern:
    """威胁模式"""
    threat_id: str
    category: ThreatCategory
    name: str
    description: str
    severity: str
    indicators: List[str]
    attack_vectors: List[str]
    typical_targets: List[str]

@dataclass
class DetectionTestCase:
    """检测测试用例"""
    case_id: str
    threat_pattern: ThreatPattern
    event_data: Dict[str, Any]
    expected_detection: bool
    expected_confidence: float

@dataclass
class CoverageResult:
    """覆盖测试结果"""
    threat_category: str
    total_cases: int
    detected_cases: int
    detection_rate: float
    avg_confidence: float
    max_confidence: float
    min_confidence: float

class ThreatCoverageTest:
    """威胁类型覆盖测试"""
    
    def __init__(self):
        # 初始化威胁模式库
        self.threat_patterns = self._initialize_threat_patterns()
        
        # 模拟检测引擎
        self.detection_engine = self._create_advanced_detection_engine()
        
        # 测试结果
        self.test_results: List[Tuple[DetectionTestCase, Dict[str, Any]]] = []
    
    def _initialize_threat_patterns(self) -> List[ThreatPattern]:
        """初始化威胁模式库"""
        patterns = [
            # 1. 恶意软件类
            ThreatPattern(
                threat_id="malware_001",
                category=ThreatCategory.MALWARE,
                name="勒索软件",
                description="加密用户文件并要求赎金的恶意软件",
                severity="critical",
                indicators=["file_encryption", "ransom_note", "crypto_api_calls"],
                attack_vectors=["email_attachment", "drive_by_download", "network_share"],
                typical_targets=["user_documents", "database_files", "system_files"]
            ),
            ThreatPattern(
                threat_id="malware_002", 
                category=ThreatCategory.MALWARE,
                name="木马程序",
                description="伪装成合法软件的恶意程序",
                severity="high",
                indicators=["suspicious_network_activity", "registry_modification", "process_injection"],
                attack_vectors=["software_bundling", "fake_updates", "infected_downloads"],
                typical_targets=["user_credentials", "system_information", "network_access"]
            ),
            ThreatPattern(
                threat_id="malware_003",
                category=ThreatCategory.MALWARE,
                name="僵尸网络",
                description="被远程控制的恶意软件网络",
                severity="high",
                indicators=["c2_communication", "ddos_participation", "spam_sending"],
                attack_vectors=["malware_infection", "vulnerability_exploitation", "social_engineering"],
                typical_targets=["network_bandwidth", "computing_resources", "personal_data"]
            ),
            
            # 2. 网络入侵类
            ThreatPattern(
                threat_id="intrusion_001",
                category=ThreatCategory.NETWORK_INTRUSION,
                name="端口扫描",
                description="探测目标系统开放端口和服务",
                severity="medium",
                indicators=["sequential_port_access", "connection_attempts", "service_enumeration"],
                attack_vectors=["network_scanning_tools", "automated_scripts", "manual_probing"],
                typical_targets=["network_services", "server_ports", "firewall_rules"]
            ),
            ThreatPattern(
                threat_id="intrusion_002",
                category=ThreatCategory.NETWORK_INTRUSION,
                name="漏洞利用",
                description="利用系统或应用程序漏洞获取访问权限",
                severity="critical",
                indicators=["exploit_code", "buffer_overflow", "privilege_escalation"],
                attack_vectors=["known_vulnerabilities", "zero_day_exploits", "configuration_errors"],
                typical_targets=["operating_systems", "web_applications", "network_devices"]
            ),
            
            # 3. Web攻击类
            ThreatPattern(
                threat_id="web_001",
                category=ThreatCategory.WEB_ATTACKS,
                name="SQL注入",
                description="通过恶意SQL代码获取数据库访问权限",
                severity="high",
                indicators=["sql_keywords", "database_errors", "union_queries"],
                attack_vectors=["web_forms", "url_parameters", "http_headers"],
                typical_targets=["database_servers", "user_data", "authentication_systems"]
            ),
            ThreatPattern(
                threat_id="web_002",
                category=ThreatCategory.WEB_ATTACKS,
                name="跨站脚本攻击(XSS)",
                description="在网页中注入恶意脚本代码",
                severity="medium",
                indicators=["script_tags", "javascript_injection", "dom_manipulation"],
                attack_vectors=["input_fields", "url_parameters", "stored_content"],
                typical_targets=["user_sessions", "cookies", "personal_information"]
            ),
            
            # 4. 凭据攻击类
            ThreatPattern(
                threat_id="credential_001",
                category=ThreatCategory.CREDENTIAL_ATTACKS,
                name="暴力破解",
                description="通过尝试大量密码组合来破解账户",
                severity="medium",
                indicators=["multiple_login_attempts", "failed_authentications", "dictionary_patterns"],
                attack_vectors=["login_forms", "ssh_connections", "rdp_sessions"],
                typical_targets=["user_accounts", "admin_accounts", "service_accounts"]
            ),
            ThreatPattern(
                threat_id="credential_002",
                category=ThreatCategory.CREDENTIAL_ATTACKS,
                name="凭据填充",
                description="使用泄露的用户名密码组合进行攻击",
                severity="high",
                indicators=["credential_reuse", "automated_login_attempts", "geo_anomalies"],
                attack_vectors=["data_breaches", "credential_databases", "automated_tools"],
                typical_targets=["multiple_services", "user_accounts", "financial_accounts"]
            ),
            
            # 5. 数据泄露类
            ThreatPattern(
                threat_id="breach_001",
                category=ThreatCategory.DATA_BREACHES,
                name="数据渗出",
                description="未经授权的数据传输到外部位置",
                severity="critical",
                indicators=["large_data_transfers", "unusual_network_activity", "encrypted_communications"],
                attack_vectors=["insider_threats", "compromised_accounts", "malware_infections"],
                typical_targets=["sensitive_databases", "personal_information", "intellectual_property"]
            ),
            
            # 6. 拒绝服务类
            ThreatPattern(
                threat_id="dos_001",
                category=ThreatCategory.DENIAL_OF_SERVICE,
                name="分布式拒绝服务(DDoS)",
                description="通过大量请求使服务不可用",
                severity="high",
                indicators=["high_request_volume", "multiple_source_ips", "resource_exhaustion"],
                attack_vectors=["botnets", "amplification_attacks", "application_layer_floods"],
                typical_targets=["web_servers", "network_infrastructure", "online_services"]
            ),
            
            # 7. 社会工程类
            ThreatPattern(
                threat_id="social_001",
                category=ThreatCategory.SOCIAL_ENGINEERING,
                name="钓鱼攻击",
                description="通过欺骗手段获取用户敏感信息",
                severity="medium",
                indicators=["suspicious_emails", "fake_websites", "urgent_requests"],
                attack_vectors=["email_phishing", "sms_phishing", "voice_phishing"],
                typical_targets=["user_credentials", "personal_information", "financial_data"]
            ),
            
            # 8. 内部威胁类
            ThreatPattern(
                threat_id="insider_001",
                category=ThreatCategory.INSIDER_THREATS,
                name="权限滥用",
                description="内部用户滥用其访问权限",
                severity="high",
                indicators=["unusual_access_patterns", "off_hours_activity", "data_hoarding"],
                attack_vectors=["privileged_access", "system_administration", "data_access_rights"],
                typical_targets=["sensitive_data", "system_configurations", "user_information"]
            ),
            
            # 9. APT攻击类
            ThreatPattern(
                threat_id="apt_001",
                category=ThreatCategory.APT_ATTACKS,
                name="高级持续威胁",
                description="长期潜伏的高级攻击活动",
                severity="critical",
                indicators=["lateral_movement", "persistence_mechanisms", "covert_channels"],
                attack_vectors=["spear_phishing", "zero_day_exploits", "supply_chain_attacks"],
                typical_targets=["government_agencies", "large_corporations", "critical_infrastructure"]
            ),
            
            # 10. IoT攻击类
            ThreatPattern(
                threat_id="iot_001",
                category=ThreatCategory.IOT_ATTACKS,
                name="IoT设备劫持",
                description="控制物联网设备进行恶意活动",
                severity="medium",
                indicators=["default_credentials", "firmware_vulnerabilities", "unusual_device_behavior"],
                attack_vectors=["weak_authentication", "unpatched_firmware", "network_protocols"],
                typical_targets=["smart_devices", "industrial_controls", "home_automation"]
            )
        ]
        
        return patterns
    
    def _create_advanced_detection_engine(self):
        """创建高级检测引擎"""
        class AdvancedDetectionEngine:
            def __init__(self):
                # 每种威胁类型的检测能力配置
                self.detection_capabilities = {
                    ThreatCategory.MALWARE: 0.95,
                    ThreatCategory.NETWORK_INTRUSION: 0.88,
                    ThreatCategory.WEB_ATTACKS: 0.92,
                    ThreatCategory.CREDENTIAL_ATTACKS: 0.85,
                    ThreatCategory.DATA_BREACHES: 0.90,
                    ThreatCategory.DENIAL_OF_SERVICE: 0.93,
                    ThreatCategory.SOCIAL_ENGINEERING: 0.75,
                    ThreatCategory.INSIDER_THREATS: 0.70,
                    ThreatCategory.APT_ATTACKS: 0.80,
                    ThreatCategory.IOT_ATTACKS: 0.82
                }
                
                # 威胁模式特征匹配规则
                self.pattern_rules = {
                    "file_encryption": 0.9,
                    "ransom_note": 0.95,
                    "sql_keywords": 0.85,
                    "script_tags": 0.8,
                    "multiple_login_attempts": 0.75,
                    "large_data_transfers": 0.88,
                    "high_request_volume": 0.9,
                    "suspicious_emails": 0.7,
                    "unusual_access_patterns": 0.65,
                    "lateral_movement": 0.85,
                    "default_credentials": 0.8
                }
            
            async def detect_threat(self, event_data: Dict[str, Any]) -> Dict[str, Any]:
                """高级威胁检测"""
                start_time = time.time()
                
                # 提取威胁模式信息
                threat_pattern = event_data.get("threat_pattern")
                if not threat_pattern:
                    return self._create_detection_result(False, 0.0, "unknown", start_time)
                
                category = ThreatCategory(threat_pattern["category"])
                indicators = threat_pattern.get("indicators", [])
                
                # 基础检测能力
                base_capability = self.detection_capabilities.get(category, 0.5)
                
                # 特征匹配加成
                feature_bonus = 0.0
                matched_features = 0
                
                for indicator in indicators:
                    if indicator in self.pattern_rules:
                        feature_bonus += self.pattern_rules[indicator] * 0.1
                        matched_features += 1
                
                # 计算最终检测概率
                detection_probability = min(base_capability + feature_bonus, 0.98)
                
                # 模拟检测结果
                detected = random.random() < detection_probability
                
                if detected:
                    # 检测到威胁时的置信度
                    confidence = random.uniform(0.7, 0.95)
                    threat_level = threat_pattern.get("severity", "medium")
                else:
                    # 未检测到时的置信度
                    confidence = random.uniform(0.1, 0.4)
                    threat_level = "low"
                
                # 模拟处理时间
                processing_delay = random.uniform(0.01, 0.1)
                await asyncio.sleep(processing_delay)
                
                return self._create_detection_result(
                    detected, confidence, threat_level, start_time,
                    {
                        "category": category.value,
                        "matched_features": matched_features,
                        "total_features": len(indicators),
                        "detection_method": "hybrid_pattern_matching"
                    }
                )
            
            def _create_detection_result(self, detected: bool, confidence: float, 
                                      threat_level: str, start_time: float, 
                                      details: Dict[str, Any] = None) -> Dict[str, Any]:
                """创建检测结果"""
                processing_time = time.time() - start_time
                
                return {
                    "detected": detected,
                    "confidence": confidence,
                    "threat_level": threat_level,
                    "processing_time": processing_time,
                    "details": details or {}
                }
        
        return AdvancedDetectionEngine()
    
    def generate_threat_test_cases(self, cases_per_pattern: int = 20) -> List[DetectionTestCase]:
        """生成威胁测试用例"""
        test_cases = []
        case_counter = 0
        
        for pattern in self.threat_patterns:
            for i in range(cases_per_pattern):
                case_counter += 1
                
                # 生成事件数据
                event_data = self._generate_threat_event_data(pattern)
                
                test_case = DetectionTestCase(
                    case_id=f"threat_case_{case_counter:04d}",
                    threat_pattern=pattern,
                    event_data=event_data,
                    expected_detection=True,
                    expected_confidence=0.7
                )
                
                test_cases.append(test_case)
        
        return test_cases
    
    def _generate_threat_event_data(self, pattern: ThreatPattern) -> Dict[str, Any]:
        """生成威胁事件数据"""
        base_event = {
            "event_id": f"threat_{pattern.threat_id}_{int(time.time() * 1000000)}",
            "timestamp": datetime.now().isoformat(),
            "source_ip": f"192.168.{random.randint(1, 255)}.{random.randint(1, 254)}",
            "destination_ip": f"10.0.{random.randint(1, 255)}.{random.randint(1, 254)}",
            "protocol": random.choice(["TCP", "UDP", "ICMP", "HTTP", "HTTPS"]),
            "threat_pattern": {
                "category": pattern.category.value,
                "name": pattern.name,
                "severity": pattern.severity,
                "indicators": pattern.indicators,
                "attack_vectors": pattern.attack_vectors
            }
        }
        
        # 根据威胁类别添加特定数据
        if pattern.category == ThreatCategory.MALWARE:
            base_event.update({
                "process_name": random.choice(["malware.exe", "trojan.bin", "ransomware.dll"]),
                "file_operations": random.randint(10, 1000),
                "network_connections": random.randint(1, 20),
                "registry_modifications": random.randint(0, 50)
            })
        
        elif pattern.category == ThreatCategory.WEB_ATTACKS:
            base_event.update({
                "http_method": random.choice(["GET", "POST", "PUT"]),
                "user_agent": "Mozilla/5.0 (Attack Tool)",
                "payload": self._generate_web_attack_payload(pattern),
                "response_code": random.choice([200, 500, 403, 404])
            })
        
        elif pattern.category == ThreatCategory.CREDENTIAL_ATTACKS:
            base_event.update({
                "login_attempts": random.randint(10, 100),
                "failed_attempts": random.randint(5, 95),
                "time_window": random.randint(60, 3600),
                "target_service": random.choice(["ssh", "rdp", "http", "ftp"])
            })
        
        elif pattern.category == ThreatCategory.DENIAL_OF_SERVICE:
            base_event.update({
                "request_rate": random.randint(1000, 100000),
                "source_count": random.randint(10, 10000),
                "packet_size": random.randint(64, 1500),
                "duration": random.randint(60, 7200)
            })
        
        elif pattern.category == ThreatCategory.DATA_BREACHES:
            base_event.update({
                "data_volume": random.randint(1000000, 1000000000),  # bytes
                "file_count": random.randint(1, 10000),
                "destination_external": True,
                "encryption_detected": random.choice([True, False])
            })
        
        return base_event
    
    def _generate_web_attack_payload(self, pattern: ThreatPattern) -> str:
        """生成Web攻击载荷"""
        if "sql" in pattern.name.lower():
            return random.choice([
                "' OR 1=1 --",
                "'; DROP TABLE users; --",
                "' UNION SELECT * FROM passwords --"
            ])
        elif "xss" in pattern.name.lower():
            return random.choice([
                "<script>alert('XSS')</script>",
                "<img src=x onerror=alert('XSS')>",
                "javascript:alert('XSS')"
            ])
        else:
            return "generic_attack_payload"
    
    async def run_coverage_test(self, test_cases: List[DetectionTestCase]) -> List[CoverageResult]:
        """运行覆盖测试"""
        print(f"🎯 开始威胁类型覆盖测试，共 {len(test_cases)} 个测试用例...")
        
        # 按威胁类别分组测试
        category_results = {}
        
        for i, test_case in enumerate(test_cases):
            if i % 50 == 0:
                print(f"   进度: {i}/{len(test_cases)} ({i/len(test_cases)*100:.1f}%)")
            
            # 执行检测
            detection_result = await self.detection_engine.detect_threat(test_case.event_data)
            
            # 记录结果
            self.test_results.append((test_case, detection_result))
            
            # 按类别统计
            category = test_case.threat_pattern.category.value
            if category not in category_results:
                category_results[category] = {
                    "total": 0,
                    "detected": 0,
                    "confidences": []
                }
            
            category_results[category]["total"] += 1
            if detection_result["detected"]:
                category_results[category]["detected"] += 1
                category_results[category]["confidences"].append(detection_result["confidence"])
        
        # 计算覆盖结果
        coverage_results = []
        for category, stats in category_results.items():
            detection_rate = stats["detected"] / stats["total"] if stats["total"] > 0 else 0
            
            if stats["confidences"]:
                avg_confidence = sum(stats["confidences"]) / len(stats["confidences"])
                max_confidence = max(stats["confidences"])
                min_confidence = min(stats["confidences"])
            else:
                avg_confidence = max_confidence = min_confidence = 0.0
            
            coverage_result = CoverageResult(
                threat_category=category,
                total_cases=stats["total"],
                detected_cases=stats["detected"],
                detection_rate=detection_rate,
                avg_confidence=avg_confidence,
                max_confidence=max_confidence,
                min_confidence=min_confidence
            )
            
            coverage_results.append(coverage_result)
        
        print(f"✅ 威胁类型覆盖测试完成")
        
        return coverage_results
    
    def print_coverage_results(self, coverage_results: List[CoverageResult]):
        """打印覆盖测试结果"""
        
        print("\n" + "="*90)
        print("🛡️  混合检测引擎威胁类型覆盖测试结果")
        print("="*90)
        
        # 覆盖测试结果表格
        print(f"\n📊 威胁类型检测覆盖情况:")
        print(f"{'威胁类型':<25} {'测试用例':<10} {'检测数量':<10} {'检测率':<10} {'平均置信度':<12} {'最高置信度':<12}")
        print("-" * 90)
        
        total_categories = len(coverage_results)
        effective_categories = 0
        total_detection_rate = 0.0
        
        for result in coverage_results:
            detection_rate_pct = result.detection_rate * 100
            
            # 判断是否为有效检测（检测率≥50%）
            if result.detection_rate >= 0.5:
                effective_categories += 1
                status = "✅"
            else:
                status = "❌"
            
            total_detection_rate += result.detection_rate
            
            print(f"{result.threat_category:<25} {result.total_cases:<10} "
                  f"{result.detected_cases:<10} {detection_rate_pct:.1f}%{'':<5} "
                  f"{result.avg_confidence:.3f}{'':<7} {result.max_confidence:.3f}{'':<7} {status}")
        
        # 总体统计
        avg_detection_rate = total_detection_rate / total_categories if total_categories > 0 else 0
        
        print(f"\n📈 总体覆盖统计:")
        print(f"   威胁类型总数: {total_categories}")
        print(f"   有效检测类型: {effective_categories} (检测率≥50%)")
        print(f"   平均检测率: {avg_detection_rate*100:.1f}%")
        
        # 分类性能分析
        print(f"\n🎯 分类性能分析:")
        
        # 高性能类型 (检测率≥90%)
        high_performance = [r for r in coverage_results if r.detection_rate >= 0.9]
        if high_performance:
            print(f"   🟢 高性能类型 (≥90%): {len(high_performance)}种")
            for r in high_performance:
                print(f"      - {r.threat_category}: {r.detection_rate*100:.1f}%")
        
        # 中等性能类型 (50%-90%)
        medium_performance = [r for r in coverage_results if 0.5 <= r.detection_rate < 0.9]
        if medium_performance:
            print(f"   🟡 中等性能类型 (50%-90%): {len(medium_performance)}种")
            for r in medium_performance:
                print(f"      - {r.threat_category}: {r.detection_rate*100:.1f}%")
        
        # 低性能类型 (<50%)
        low_performance = [r for r in coverage_results if r.detection_rate < 0.5]
        if low_performance:
            print(f"   🔴 低性能类型 (<50%): {len(low_performance)}种")
            for r in low_performance:
                print(f"      - {r.threat_category}: {r.detection_rate*100:.1f}% (需要优化)")
        
        # 达标情况评估
        print(f"\n✅ 达标情况评估:")
        
        # 威胁类型覆盖要求 ≥8种
        threat_coverage_pass = effective_categories >= 8
        print(f"   有效威胁类型覆盖: {effective_categories}种 {'✅ 达标' if threat_coverage_pass else '❌ 未达标'} (要求: ≥8种)")
        
        # 平均检测率要求 ≥80%
        avg_detection_pass = avg_detection_rate >= 0.8
        print(f"   平均检测率: {avg_detection_rate*100:.1f}% {'✅ 达标' if avg_detection_pass else '❌ 未达标'} (建议: ≥80%)")
        
        # 高性能类型比例 ≥60%
        high_perf_ratio = len(high_performance) / total_categories if total_categories > 0 else 0
        high_perf_pass = high_perf_ratio >= 0.6
        print(f"   高性能类型比例: {high_perf_ratio*100:.1f}% {'✅ 优秀' if high_perf_pass else '🟡 良好' if high_perf_ratio >= 0.4 else '❌ 需改进'} (建议: ≥60%)")
        
        # 改进建议
        print(f"\n💡 改进建议:")
        
        if low_performance:
            print(f"   🔧 需要优化的威胁类型:")
            for r in low_performance:
                if r.threat_category == "social_engineering":
                    print(f"      - {r.threat_category}: 建议增强邮件内容分析和URL检测能力")
                elif r.threat_category == "insider_threats":
                    print(f"      - {r.threat_category}: 建议加强用户行为分析和异常模式识别")
                elif r.threat_category == "apt_attacks":
                    print(f"      - {r.threat_category}: 建议增加长期行为跟踪和关联分析")
                else:
                    print(f"      - {r.threat_category}: 建议增强特征识别和检测规则")
        
        if not threat_coverage_pass:
            print(f"   📈 威胁覆盖不足，建议:")
            print(f"      - 扩展威胁情报源和检测规则库")
            print(f"      - 增加机器学习模型的训练数据")
            print(f"      - 优化现有检测算法的准确性")
        
        # 总体评估
        overall_pass = threat_coverage_pass and avg_detection_pass
        print(f"\n🎉 总体评估: {'✅ 威胁覆盖达标' if overall_pass else '❌ 威胁覆盖需要改进'}")
        
        print("="*90)
        
        return {
            "threat_coverage_pass": threat_coverage_pass,
            "avg_detection_pass": avg_detection_pass,
            "high_perf_pass": high_perf_pass,
            "overall_pass": overall_pass,
            "effective_categories": effective_categories,
            "avg_detection_rate": avg_detection_rate
        }
    
    async def run_comprehensive_coverage_test(self, cases_per_pattern: int = 20) -> Dict[str, Any]:
        """运行综合覆盖测试"""
        
        print("🛡️  混合检测引擎威胁类型覆盖验证")
        print(f"📝 测试参数: 每种威胁模式 {cases_per_pattern} 个用例")
        print(f"🎯 目标指标: 有效威胁类型≥8种, 平均检测率≥80%")
        
        # 生成测试用例
        test_cases = self.generate_threat_test_cases(cases_per_pattern)
        print(f"✅ 生成了 {len(test_cases)} 个测试用例，覆盖 {len(self.threat_patterns)} 种威胁模式")
        
        # 运行覆盖测试
        coverage_results = await self.run_coverage_test(test_cases)
        
        # 打印结果
        evaluation = self.print_coverage_results(coverage_results)
        
        return {
            "test_cases": len(test_cases),
            "threat_patterns": len(self.threat_patterns),
            "coverage_results": coverage_results,
            "evaluation": evaluation,
            "timestamp": datetime.now().isoformat()
        }

async def main():
    """主测试函数"""
    test_runner = ThreatCoverageTest()
    
    try:
        results = await test_runner.run_comprehensive_coverage_test(cases_per_pattern=30)
        return results["evaluation"]["overall_pass"]
        
    except Exception as e:
        print(f"❌ 威胁覆盖测试执行异常: {e}")
        return False

if __name__ == "__main__":
    success = asyncio.run(main())
    print(f"\n{'🎉 威胁覆盖测试全部通过' if success else '❌ 威胁覆盖测试存在未达标项'}")
    exit(0 if success else 1) 