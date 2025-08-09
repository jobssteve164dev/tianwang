#!/usr/bin/env python3
"""
混合检测引擎综合性能基准报告
汇总所有测试结果，生成性能基准和优化建议
"""

import asyncio
import json
import time
import subprocess
import sys
import os
from datetime import datetime
from typing import Dict, Any, List
from dataclasses import dataclass, asdict

# 添加路径以便导入模块
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

@dataclass
class TestSuiteResult:
    """测试套件结果"""
    suite_name: str
    passed: bool
    execution_time: float
    key_metrics: Dict[str, Any]
    issues: List[str]
    recommendations: List[str]

@dataclass
class BenchmarkReport:
    """基准测试报告"""
    report_id: str
    timestamp: str
    system_info: Dict[str, Any]
    test_results: List[TestSuiteResult]
    overall_assessment: Dict[str, Any]
    performance_baseline: Dict[str, Any]
    optimization_roadmap: List[Dict[str, Any]]

class ComprehensiveBenchmarkTest:
    """综合性能基准测试"""
    
    def __init__(self):
        self.test_suites = [
            {
                "name": "准确性测试",
                "script": "test_mixed_detection_accuracy.py",
                "weight": 0.3,
                "critical": True
            },
            {
                "name": "性能压力测试",
                "script": "test_performance_stress.py",
                "weight": 0.25,
                "critical": True
            },
            {
                "name": "威胁覆盖测试",
                "script": "test_threat_coverage.py",
                "weight": 0.25,
                "critical": True
            },
            {
                "name": "端到端集成测试",
                "script": "test_end_to_end_integration.py",
                "weight": 0.2,
                "critical": False
            }
        ]
        
        self.benchmark_results: List[TestSuiteResult] = []
    
    def get_system_info(self) -> Dict[str, Any]:
        """获取系统信息"""
        try:
            # 获取Python版本
            python_version = sys.version.split()[0]
            
            # 获取系统信息（简化版，避免依赖外部库）
            system_info = {
                "python_version": python_version,
                "platform": sys.platform,
                "test_environment": "development",
                "timestamp": datetime.now().isoformat(),
                "working_directory": os.getcwd()
            }
            
            return system_info
        except Exception as e:
            return {"error": str(e), "python_version": sys.version.split()[0]}
    
    async def run_test_suite(self, suite_config: Dict[str, Any]) -> TestSuiteResult:
        """运行单个测试套件"""
        suite_name = suite_config["name"]
        script_name = suite_config["script"]
        
        print(f"🧪 运行 {suite_name}...")
        
        start_time = time.time()
        
        try:
            # 运行测试脚本
            process = await asyncio.create_subprocess_exec(
                "python3", script_name,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=os.path.dirname(os.path.abspath(__file__))
            )
            
            stdout, stderr = await process.communicate()
            execution_time = time.time() - start_time
            
            # 解析结果
            passed = process.returncode == 0
            output = stdout.decode('utf-8')
            error_output = stderr.decode('utf-8') if stderr else ""
            
            # 提取关键指标
            key_metrics = self._extract_metrics_from_output(suite_name, output)
            
            # 识别问题和建议
            issues = self._identify_issues(suite_name, key_metrics, passed)
            recommendations = self._generate_recommendations(suite_name, key_metrics, issues)
            
            result = TestSuiteResult(
                suite_name=suite_name,
                passed=passed,
                execution_time=execution_time,
                key_metrics=key_metrics,
                issues=issues,
                recommendations=recommendations
            )
            
            status = "✅ 通过" if passed else "❌ 失败"
            print(f"   {status} | 耗时: {execution_time:.2f}s")
            
            return result
            
        except Exception as e:
            execution_time = time.time() - start_time
            
            result = TestSuiteResult(
                suite_name=suite_name,
                passed=False,
                execution_time=execution_time,
                key_metrics={},
                issues=[f"执行异常: {str(e)}"],
                recommendations=[f"检查 {script_name} 脚本的依赖和配置"]
            )
            
            print(f"   ❌ 异常 | {str(e)}")
            return result
    
    def _extract_metrics_from_output(self, suite_name: str, output: str) -> Dict[str, Any]:
        """从输出中提取关键指标"""
        metrics = {}
        
        try:
            if "准确性测试" in suite_name:
                # 提取准确性相关指标
                lines = output.split('\n')
                for line in lines:
                    # 修复准确率提取
                    if "准确率 (Accuracy):" in line and "(" in line and "%" in line:
                        # 格式: "   准确率 (Accuracy): 0.944 (94.4%)"
                        parts = line.split('(')
                        if len(parts) >= 3:
                            accuracy_str = parts[2].split('%')[0]
                            metrics["accuracy"] = float(accuracy_str) / 100
                    elif "误报率:" in line and "(" in line and "%" in line:
                        # 格式: "   误报率: 0.000 (0.0%)"
                        parts = line.split('(')
                        if len(parts) >= 2:
                            fpr_str = parts[1].split('%')[0]
                            metrics["false_positive_rate"] = float(fpr_str) / 100
                    elif "威胁类型覆盖:" in line and "种" in line:
                        # 格式: "   威胁类型覆盖: 10种 ✅ 达标"
                        coverage_str = line.split(':')[1].split('种')[0].strip()
                        metrics["threat_coverage"] = int(coverage_str)
            
            elif "性能压力测试" in suite_name:
                # 提取性能相关指标
                lines = output.split('\n')
                for line in lines:
                    if "最大稳定并发数:" in line:
                        concurrent = line.split(':')[1].split()[0]
                        metrics["max_concurrent"] = int(concurrent)
                    elif "平均响应时间:" in line and "ms" in line:
                        response_time = line.split(':')[1].split('ms')[0].strip()
                        metrics["avg_response_time_ms"] = float(response_time)
                    elif "吞吐量:" in line and "请求/秒" in line:
                        throughput = line.split(':')[1].split('请求/秒')[0].strip()
                        metrics["throughput"] = float(throughput)
            
            elif "威胁覆盖测试" in suite_name:
                # 提取威胁覆盖相关指标
                lines = output.split('\n')
                for line in lines:
                    if "有效威胁类型覆盖:" in line and "种" in line:
                        coverage_str = line.split(':')[1].split('种')[0].strip()
                        metrics["effective_threat_types"] = int(coverage_str)
                    elif "平均检测率:" in line and "%" in line:
                        detection_rate = line.split(':')[1].split('%')[0].strip()
                        metrics["avg_detection_rate"] = float(detection_rate) / 100
            
            elif "端到端集成测试" in suite_name:
                # 提取集成测试相关指标
                lines = output.split('\n')
                for line in lines:
                    if "端到端成功率:" in line and "%" in line:
                        # 格式: "   端到端成功率: 100.0% ✅ 达标"
                        success_rate_str = line.split(':')[1].split('%')[0].strip()
                        metrics["e2e_success_rate"] = float(success_rate_str) / 100
                    elif "功能准确性:" in line and "%" in line:
                        # 格式: "   功能准确性: 66.7% ❌ 未达标"
                        functional_accuracy_str = line.split(':')[1].split('%')[0].strip()
                        metrics["functional_accuracy"] = float(functional_accuracy_str) / 100
                    elif "平均响应时间:" in line and "s" in line and "ms" not in line:
                        # 格式: "   平均响应时间: 0.062s"
                        response_time_str = line.split(':')[1].split('s')[0].strip()
                        metrics["avg_e2e_response_time"] = float(response_time_str)
        
        except Exception as e:
            metrics["extraction_error"] = str(e)
        
        return metrics
    
    def _identify_issues(self, suite_name: str, metrics: Dict[str, Any], passed: bool) -> List[str]:
        """识别问题"""
        issues = []
        
        if not passed:
            issues.append(f"{suite_name}执行失败")
        
        if "准确性测试" in suite_name:
            accuracy = metrics.get("accuracy", 0)
            fpr = metrics.get("false_positive_rate", 1)
            
            if accuracy < 0.95:
                issues.append(f"准确率{accuracy*100:.1f}%未达到95%要求")
            if fpr > 0.05:
                issues.append(f"误报率{fpr*100:.1f}%超过5%限制")
        
        elif "性能压力测试" in suite_name:
            max_concurrent = metrics.get("max_concurrent", 0)
            
            if max_concurrent < 1000:
                issues.append(f"最大并发数{max_concurrent}未达到1000要求")
        
        elif "威胁覆盖测试" in suite_name:
            effective_types = metrics.get("effective_threat_types", 0)
            
            if effective_types < 8:
                issues.append(f"有效威胁类型{effective_types}种未达到8种要求")
        
        elif "端到端集成测试" in suite_name:
            e2e_success = metrics.get("e2e_success_rate", 0)
            functional_accuracy = metrics.get("functional_accuracy", 0)
            
            if e2e_success < 0.95:
                issues.append(f"端到端成功率{e2e_success*100:.1f}%未达到95%要求")
            if functional_accuracy < 0.90:
                issues.append(f"功能准确性{functional_accuracy*100:.1f}%未达到90%要求")
        
        return issues
    
    def _generate_recommendations(self, suite_name: str, metrics: Dict[str, Any], issues: List[str]) -> List[str]:
        """生成优化建议"""
        recommendations = []
        
        if "准确性测试" in suite_name and issues:
            if any("准确率" in issue for issue in issues):
                recommendations.extend([
                    "增加训练数据量和质量",
                    "优化机器学习模型参数",
                    "增强特征工程",
                    "实现模型集成和投票机制"
                ])
            
            if any("误报率" in issue for issue in issues):
                recommendations.extend([
                    "调整检测阈值",
                    "增加白名单过滤机制",
                    "优化规则引擎逻辑",
                    "实现上下文感知检测"
                ])
        
        elif "性能压力测试" in suite_name and issues:
            recommendations.extend([
                "实现水平扩展架构",
                "优化数据库连接池",
                "增加缓存机制",
                "异步处理优化",
                "负载均衡配置"
            ])
        
        elif "威胁覆盖测试" in suite_name and issues:
            recommendations.extend([
                "扩展威胁情报源",
                "增加检测规则库",
                "训练更多威胁类型的模型",
                "实现自适应学习机制"
            ])
        
        elif "端到端集成测试" in suite_name and issues:
            recommendations.extend([
                "增强组件间通信可靠性",
                "实现容错和重试机制",
                "优化工作流编排",
                "增加监控和告警"
            ])
        
        return recommendations
    
    def calculate_overall_assessment(self, results: List[TestSuiteResult]) -> Dict[str, Any]:
        """计算总体评估"""
        
        total_weight = sum(suite["weight"] for suite in self.test_suites)
        weighted_score = 0
        
        critical_failures = 0
        total_issues = 0
        
        for result, suite_config in zip(results, self.test_suites):
            # 计算加权分数
            suite_score = 1.0 if result.passed else 0.0
            weighted_score += suite_score * suite_config["weight"]
            
            # 统计关键失败
            if not result.passed and suite_config["critical"]:
                critical_failures += 1
            
            total_issues += len(result.issues)
        
        # 标准化分数
        overall_score = weighted_score / total_weight if total_weight > 0 else 0
        
        # 确定等级
        if overall_score >= 0.9 and critical_failures == 0:
            grade = "A"
            status = "优秀"
        elif overall_score >= 0.8 and critical_failures <= 1:
            grade = "B"
            status = "良好"
        elif overall_score >= 0.6:
            grade = "C"
            status = "及格"
        else:
            grade = "D"
            status = "需要改进"
        
        return {
            "overall_score": overall_score,
            "grade": grade,
            "status": status,
            "critical_failures": critical_failures,
            "total_issues": total_issues,
            "passed_suites": sum(1 for r in results if r.passed),
            "total_suites": len(results)
        }
    
    def create_performance_baseline(self, results: List[TestSuiteResult]) -> Dict[str, Any]:
        """创建性能基准"""
        
        baseline = {
            "accuracy_metrics": {
                "target_accuracy": 0.95,
                "target_false_positive_rate": 0.05,
                "target_threat_coverage": 8
            },
            "performance_metrics": {
                "target_max_concurrent": 1000,
                "target_response_time_ms": 30000,
                "target_throughput": 1000
            },
            "integration_metrics": {
                "target_e2e_success_rate": 0.95,
                "target_functional_accuracy": 0.90,
                "target_e2e_response_time": 5.0
            },
            "current_performance": {}
        }
        
        # 提取当前性能数据
        for result in results:
            if result.key_metrics:
                if "准确性测试" in result.suite_name:
                    baseline["current_performance"]["accuracy"] = result.key_metrics.get("accuracy", 0)
                    baseline["current_performance"]["false_positive_rate"] = result.key_metrics.get("false_positive_rate", 1)
                    baseline["current_performance"]["threat_coverage"] = result.key_metrics.get("threat_coverage", 0)
                
                elif "性能压力测试" in result.suite_name:
                    baseline["current_performance"]["max_concurrent"] = result.key_metrics.get("max_concurrent", 0)
                    baseline["current_performance"]["avg_response_time_ms"] = result.key_metrics.get("avg_response_time_ms", 0)
                    baseline["current_performance"]["throughput"] = result.key_metrics.get("throughput", 0)
                
                elif "端到端集成测试" in result.suite_name:
                    baseline["current_performance"]["e2e_success_rate"] = result.key_metrics.get("e2e_success_rate", 0)
                    baseline["current_performance"]["functional_accuracy"] = result.key_metrics.get("functional_accuracy", 0)
                    baseline["current_performance"]["avg_e2e_response_time"] = result.key_metrics.get("avg_e2e_response_time", 0)
        
        return baseline
    
    def create_optimization_roadmap(self, results: List[TestSuiteResult], assessment: Dict[str, Any]) -> List[Dict[str, Any]]:
        """创建优化路线图"""
        
        roadmap = []
        
        # 高优先级：关键问题修复
        critical_issues = []
        for result in results:
            if not result.passed:
                for issue in result.issues:
                    critical_issues.append({
                        "suite": result.suite_name,
                        "issue": issue,
                        "recommendations": result.recommendations[:2]  # 取前2个建议
                    })
        
        if critical_issues:
            roadmap.append({
                "phase": "第一阶段：关键问题修复",
                "priority": "高",
                "timeline": "1-2周",
                "tasks": critical_issues,
                "success_criteria": "所有测试套件通过基本要求"
            })
        
        # 中优先级：性能优化
        performance_tasks = []
        for result in results:
            if result.passed and result.recommendations:
                performance_tasks.extend([
                    {
                        "suite": result.suite_name,
                        "task": rec,
                        "type": "optimization"
                    } for rec in result.recommendations[:3]
                ])
        
        if performance_tasks:
            roadmap.append({
                "phase": "第二阶段：性能优化",
                "priority": "中",
                "timeline": "2-4周",
                "tasks": performance_tasks[:10],  # 限制任务数量
                "success_criteria": "性能指标达到或超过目标值"
            })
        
        # 低优先级：功能增强
        roadmap.append({
            "phase": "第三阶段：功能增强",
            "priority": "低",
            "timeline": "4-8周",
            "tasks": [
                {"task": "增加新的威胁检测类型", "type": "feature"},
                {"task": "实现自适应学习机制", "type": "feature"},
                {"task": "增强可视化监控", "type": "feature"},
                {"task": "实现A/B测试框架", "type": "feature"}
            ],
            "success_criteria": "系统功能完整性和用户体验显著提升"
        })
        
        return roadmap
    
    def print_benchmark_report(self, report: BenchmarkReport):
        """打印基准测试报告"""
        
        print("\n" + "="*120)
        print("📊 混合检测引擎综合性能基准测试报告")
        print("="*120)
        
        # 系统信息
        print(f"\n🖥️  测试环境信息:")
        print(f"   Python版本: {report.system_info.get('python_version', 'Unknown')}")
        print(f"   平台: {report.system_info.get('platform', 'Unknown')}")
        print(f"   测试时间: {report.timestamp}")
        print(f"   报告ID: {report.report_id}")
        
        # 测试套件结果
        print(f"\n🧪 测试套件执行结果:")
        print(f"{'测试套件':<25} {'状态':<10} {'耗时':<12} {'关键指标':<30} {'问题数':<8}")
        print("-" * 120)
        
        for result in report.test_results:
            status = "✅ 通过" if result.passed else "❌ 失败"
            key_metric = ""
            
            if result.key_metrics:
                if "accuracy" in result.key_metrics:
                    key_metric = f"准确率: {result.key_metrics['accuracy']*100:.1f}%"
                elif "max_concurrent" in result.key_metrics:
                    key_metric = f"并发: {result.key_metrics['max_concurrent']}"
                elif "effective_threat_types" in result.key_metrics:
                    key_metric = f"威胁类型: {result.key_metrics['effective_threat_types']}种"
                elif "e2e_success_rate" in result.key_metrics:
                    key_metric = f"成功率: {result.key_metrics['e2e_success_rate']*100:.1f}%"
            
            print(f"{result.suite_name:<25} {status:<10} {result.execution_time:.2f}s{'':<6} "
                  f"{key_metric:<30} {len(result.issues):<8}")
        
        # 总体评估
        assessment = report.overall_assessment
        print(f"\n🎯 总体评估:")
        print(f"   综合得分: {assessment['overall_score']*100:.1f}/100")
        print(f"   评估等级: {assessment['grade']} ({assessment['status']})")
        print(f"   通过套件: {assessment['passed_suites']}/{assessment['total_suites']}")
        print(f"   关键失败: {assessment['critical_failures']}")
        print(f"   总问题数: {assessment['total_issues']}")
        
        # 性能基准对比
        baseline = report.performance_baseline
        current = baseline.get("current_performance", {})
        
        print(f"\n📈 性能基准对比:")
        print(f"{'指标':<25} {'当前值':<15} {'目标值':<15} {'达标状态':<10}")
        print("-" * 80)
        
        metrics_comparison = [
            ("准确率", current.get("accuracy", 0), 0.95, "%"),
            ("误报率", current.get("false_positive_rate", 1), 0.05, "%"),
            ("最大并发数", current.get("max_concurrent", 0), 1000, ""),
            ("威胁类型覆盖", current.get("threat_coverage", 0), 8, "种"),
            ("端到端成功率", current.get("e2e_success_rate", 0), 0.95, "%")
        ]
        
        for metric_name, current_val, target_val, unit in metrics_comparison:
            if unit == "%":
                current_display = f"{current_val*100:.1f}%"
                target_display = f"{target_val*100:.1f}%"
                is_better = current_val >= target_val if "误报率" not in metric_name else current_val <= target_val
            else:
                current_display = f"{current_val}{unit}"
                target_display = f"{target_val}{unit}"
                is_better = current_val >= target_val
            
            status = "✅ 达标" if is_better else "❌ 未达标"
            print(f"{metric_name:<25} {current_display:<15} {target_display:<15} {status:<10}")
        
        # 优化路线图
        if report.optimization_roadmap:
            print(f"\n🗺️  优化路线图:")
            
            for phase in report.optimization_roadmap:
                print(f"\n   {phase['phase']} (优先级: {phase['priority']}, 时间: {phase['timeline']})")
                print(f"   成功标准: {phase['success_criteria']}")
                
                if isinstance(phase['tasks'], list) and phase['tasks']:
                    print(f"   主要任务:")
                    for i, task in enumerate(phase['tasks'][:5], 1):  # 只显示前5个任务
                        if isinstance(task, dict):
                            task_desc = task.get('task', task.get('issue', str(task)))
                        else:
                            task_desc = str(task)
                        print(f"     {i}. {task_desc}")
                    
                    if len(phase['tasks']) > 5:
                        print(f"     ... 还有 {len(phase['tasks']) - 5} 个任务")
        
        # 总结和建议
        print(f"\n💡 总结和建议:")
        
        if assessment['grade'] == 'A':
            print(f"   🎉 系统性能优秀！所有核心指标都达到了预期要求。")
            print(f"   📈 建议继续监控性能，并考虑功能扩展和优化。")
        elif assessment['grade'] == 'B':
            print(f"   👍 系统性能良好，大部分指标达标。")
            print(f"   🔧 建议重点关注未达标的指标，进行针对性优化。")
        elif assessment['grade'] == 'C':
            print(f"   ⚠️  系统性能及格，但仍有改进空间。")
            print(f"   🚀 建议按照优化路线图逐步改进性能。")
        else:
            print(f"   🚨 系统性能需要重大改进！")
            print(f"   🔥 建议立即启动性能优化项目，优先解决关键问题。")
        
        print(f"\n📊 本次测试报告已生成，建议定期进行基准测试以跟踪性能变化。")
        
        print("="*120)
    
    async def run_comprehensive_benchmark(self) -> BenchmarkReport:
        """运行综合基准测试"""
        
        print("📊 开始混合检测引擎综合性能基准测试")
        print(f"🎯 测试范围: {len(self.test_suites)} 个测试套件")
        
        # 获取系统信息
        system_info = self.get_system_info()
        
        # 运行所有测试套件
        results = []
        for suite_config in self.test_suites:
            result = await self.run_test_suite(suite_config)
            results.append(result)
            self.benchmark_results.append(result)
        
        # 计算总体评估
        assessment = self.calculate_overall_assessment(results)
        
        # 创建性能基准
        baseline = self.create_performance_baseline(results)
        
        # 创建优化路线图
        roadmap = self.create_optimization_roadmap(results, assessment)
        
        # 生成报告
        report = BenchmarkReport(
            report_id=f"benchmark_{int(time.time())}",
            timestamp=datetime.now().isoformat(),
            system_info=system_info,
            test_results=results,
            overall_assessment=assessment,
            performance_baseline=baseline,
            optimization_roadmap=roadmap
        )
        
        # 打印报告
        self.print_benchmark_report(report)
        
        return report
    
    def save_report(self, report: BenchmarkReport, filename: str = None):
        """保存报告到文件"""
        if filename is None:
            filename = f"benchmark_report_{report.report_id}.json"
        
        try:
            with open(filename, 'w', encoding='utf-8') as f:
                json.dump(asdict(report), f, ensure_ascii=False, indent=2)
            
            print(f"\n💾 基准测试报告已保存到: {filename}")
            
        except Exception as e:
            print(f"❌ 保存报告失败: {e}")

async def main():
    """主测试函数"""
    print("🔧 混合检测引擎综合性能基准测试")
    
    benchmark = ComprehensiveBenchmarkTest()
    
    try:
        # 运行综合基准测试
        report = await benchmark.run_comprehensive_benchmark()
        
        # 保存报告
        benchmark.save_report(report)
        
        # 返回是否达到基本要求
        assessment = report.overall_assessment
        return assessment["grade"] in ["A", "B"] and assessment["critical_failures"] == 0
        
    except Exception as e:
        print(f"❌ 基准测试执行异常: {e}")
        return False

if __name__ == "__main__":
    success = asyncio.run(main())
    print(f"\n{'🎉 基准测试达到要求' if success else '❌ 基准测试需要改进'}")
    exit(0 if success else 1) 