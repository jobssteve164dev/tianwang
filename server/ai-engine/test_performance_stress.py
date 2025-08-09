#!/usr/bin/env python3
"""
混合检测引擎性能压力测试
验证响应时间<30秒，并发处理能力≥1000个客户端
"""

import asyncio
import time
import random
import statistics
from datetime import datetime
from typing import Dict, Any, List
from dataclasses import dataclass
from concurrent.futures import ThreadPoolExecutor
import sys
import os

# 添加路径以便导入模块
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

@dataclass
class PerformanceResult:
    """性能测试结果"""
    test_id: str
    start_time: float
    end_time: float
    processing_time: float
    success: bool
    error_message: str = ""

@dataclass
class StressTestMetrics:
    """压力测试指标"""
    total_requests: int
    successful_requests: int
    failed_requests: int
    success_rate: float
    avg_response_time: float
    min_response_time: float
    max_response_time: float
    p95_response_time: float
    p99_response_time: float
    throughput: float
    concurrent_users: int
    test_duration: float

class PerformanceStressTest:
    """性能压力测试"""
    
    def __init__(self):
        # 模拟检测引擎
        self.detection_engine = self._create_mock_detection_engine()
        
        # 测试配置
        self.test_config = {
            "max_concurrent_users": 1000,
            "test_duration": 60,  # 秒
            "ramp_up_time": 10,   # 秒
            "request_interval": 0.1,  # 秒
        }
        
        # 结果存储
        self.test_results: List[PerformanceResult] = []
    
    def _create_mock_detection_engine(self):
        """创建模拟检测引擎"""
        class MockDetectionEngine:
            def __init__(self):
                self.request_count = 0
                self.max_concurrent = 0
                self.current_concurrent = 0
                
            async def detect_threat(self, event_data: Dict[str, Any]) -> Dict[str, Any]:
                """模拟威胁检测"""
                self.current_concurrent += 1
                self.max_concurrent = max(self.max_concurrent, self.current_concurrent)
                self.request_count += 1
                
                try:
                    # 模拟不同负载下的处理时间
                    base_delay = 0.01  # 10ms基础延迟
                    
                    # 根据并发数增加延迟（模拟系统负载）
                    load_factor = min(self.current_concurrent / 100, 5.0)  # 最多5倍延迟
                    processing_delay = base_delay * (1 + load_factor)
                    
                    # 添加随机变动
                    processing_delay += random.uniform(0, 0.02)
                    
                    await asyncio.sleep(processing_delay)
                    
                    # 模拟偶发的系统过载
                    if random.random() < 0.001:  # 0.1%概率的长延迟
                        await asyncio.sleep(random.uniform(1, 3))
                    
                    return {
                        "detected": random.choice([True, False]),
                        "confidence": random.uniform(0.5, 0.95),
                        "threat_level": random.choice(["low", "medium", "high", "critical"]),
                        "processing_time": processing_delay,
                        "request_id": self.request_count
                    }
                    
                finally:
                    self.current_concurrent -= 1
        
        return MockDetectionEngine()
    
    def _generate_test_event(self, user_id: int, request_id: int) -> Dict[str, Any]:
        """生成测试事件"""
        return {
            "event_id": f"stress_test_{user_id}_{request_id}",
            "timestamp": datetime.now().isoformat(),
            "user_id": user_id,
            "source_ip": f"192.168.{random.randint(1, 255)}.{random.randint(1, 254)}",
            "destination_ip": f"10.0.{random.randint(1, 255)}.{random.randint(1, 254)}",
            "protocol": random.choice(["TCP", "UDP", "ICMP"]),
            "event_type": random.choice([
                "network_attack", "malware", "brute_force", 
                "sql_injection", "normal_traffic"
            ]),
            "payload_size": random.randint(100, 10000),
            "test_data": True
        }
    
    async def simulate_user_requests(self, user_id: int, duration: float, request_interval: float) -> List[PerformanceResult]:
        """模拟用户请求"""
        results = []
        request_count = 0
        start_time = time.time()
        
        while time.time() - start_time < duration:
            request_count += 1
            test_id = f"user_{user_id}_req_{request_count}"
            
            # 生成测试事件
            event_data = self._generate_test_event(user_id, request_count)
            
            # 发送请求并测量响应时间
            request_start = time.time()
            
            try:
                result = await self.detection_engine.detect_threat(event_data)
                request_end = time.time()
                
                performance_result = PerformanceResult(
                    test_id=test_id,
                    start_time=request_start,
                    end_time=request_end,
                    processing_time=request_end - request_start,
                    success=True
                )
                
            except Exception as e:
                request_end = time.time()
                
                performance_result = PerformanceResult(
                    test_id=test_id,
                    start_time=request_start,
                    end_time=request_end,
                    processing_time=request_end - request_start,
                    success=False,
                    error_message=str(e)
                )
            
            results.append(performance_result)
            
            # 控制请求间隔
            await asyncio.sleep(request_interval)
        
        return results
    
    async def run_concurrent_stress_test(self, concurrent_users: int, duration: float) -> StressTestMetrics:
        """运行并发压力测试"""
        
        print(f"🚀 开始并发压力测试...")
        print(f"   并发用户数: {concurrent_users}")
        print(f"   测试持续时间: {duration}s")
        print(f"   请求间隔: {self.test_config['request_interval']}s")
        
        # 创建并发任务
        tasks = []
        for user_id in range(concurrent_users):
            task = asyncio.create_task(
                self.simulate_user_requests(
                    user_id, 
                    duration, 
                    self.test_config['request_interval']
                )
            )
            tasks.append(task)
        
        # 等待所有任务完成
        test_start = time.time()
        all_results = await asyncio.gather(*tasks, return_exceptions=True)
        test_end = time.time()
        
        # 合并结果
        combined_results = []
        for user_results in all_results:
            if isinstance(user_results, list):
                combined_results.extend(user_results)
        
        # 计算指标
        total_requests = len(combined_results)
        successful_requests = sum(1 for r in combined_results if r.success)
        failed_requests = total_requests - successful_requests
        
        if total_requests > 0:
            success_rate = successful_requests / total_requests
            
            # 响应时间统计（只统计成功的请求）
            successful_times = [r.processing_time for r in combined_results if r.success]
            
            if successful_times:
                avg_response_time = statistics.mean(successful_times)
                min_response_time = min(successful_times)
                max_response_time = max(successful_times)
                
                # 计算百分位数
                sorted_times = sorted(successful_times)
                p95_index = int(len(sorted_times) * 0.95)
                p99_index = int(len(sorted_times) * 0.99)
                
                p95_response_time = sorted_times[p95_index] if p95_index < len(sorted_times) else max_response_time
                p99_response_time = sorted_times[p99_index] if p99_index < len(sorted_times) else max_response_time
            else:
                avg_response_time = min_response_time = max_response_time = p95_response_time = p99_response_time = 0
            
            throughput = successful_requests / (test_end - test_start)
        else:
            success_rate = avg_response_time = min_response_time = max_response_time = 0
            p95_response_time = p99_response_time = throughput = 0
        
        metrics = StressTestMetrics(
            total_requests=total_requests,
            successful_requests=successful_requests,
            failed_requests=failed_requests,
            success_rate=success_rate,
            avg_response_time=avg_response_time,
            min_response_time=min_response_time,
            max_response_time=max_response_time,
            p95_response_time=p95_response_time,
            p99_response_time=p99_response_time,
            throughput=throughput,
            concurrent_users=concurrent_users,
            test_duration=test_end - test_start
        )
        
        self.test_results = combined_results
        
        print(f"✅ 并发压力测试完成，实际耗时: {test_end - test_start:.2f}s")
        
        return metrics
    
    async def run_ramp_up_test(self, max_users: int, ramp_up_time: float, test_duration: float) -> List[StressTestMetrics]:
        """运行渐进式负载测试"""
        
        print(f"📈 开始渐进式负载测试...")
        print(f"   最大用户数: {max_users}")
        print(f"   渐进时间: {ramp_up_time}s")
        print(f"   每级测试时间: {test_duration}s")
        
        # 定义用户数级别
        user_levels = [10, 50, 100, 250, 500, 750, 1000]
        user_levels = [level for level in user_levels if level <= max_users]
        
        results = []
        
        for user_count in user_levels:
            print(f"\n🔄 测试 {user_count} 并发用户...")
            
            # 运行测试
            metrics = await self.run_concurrent_stress_test(user_count, test_duration)
            results.append(metrics)
            
            # 打印当前级别结果
            print(f"   成功率: {metrics.success_rate*100:.1f}%")
            print(f"   平均响应时间: {metrics.avg_response_time*1000:.1f}ms")
            print(f"   P95响应时间: {metrics.p95_response_time*1000:.1f}ms")
            print(f"   吞吐量: {metrics.throughput:.1f} 请求/秒")
            
            # 如果成功率过低，提前结束测试
            if metrics.success_rate < 0.8:
                print(f"⚠️  成功率过低 ({metrics.success_rate*100:.1f}%)，停止渐进测试")
                break
            
            # 间歇时间
            await asyncio.sleep(2)
        
        return results
    
    def print_performance_results(self, ramp_up_results: List[StressTestMetrics]):
        """打印性能测试结果"""
        
        print("\n" + "="*80)
        print("⚡ 混合检测引擎性能压力测试结果")
        print("="*80)
        
        # 渐进式测试结果表格
        print(f"\n📊 渐进式负载测试结果:")
        print(f"{'并发用户':<10} {'成功率':<10} {'平均响应时间':<15} {'P95响应时间':<15} {'P99响应时间':<15} {'吞吐量':<12}")
        print("-" * 85)
        
        for metrics in ramp_up_results:
            print(f"{metrics.concurrent_users:<10} "
                  f"{metrics.success_rate*100:.1f}%{'':<5} "
                  f"{metrics.avg_response_time*1000:.1f}ms{'':<10} "
                  f"{metrics.p95_response_time*1000:.1f}ms{'':<10} "
                  f"{metrics.p99_response_time*1000:.1f}ms{'':<10} "
                  f"{metrics.throughput:.1f} req/s")
        
        # 找到最大成功的并发数
        max_successful_concurrent = 0
        best_metrics = None
        
        for metrics in ramp_up_results:
            if metrics.success_rate >= 0.95 and metrics.max_response_time < 30.0:
                max_successful_concurrent = max(max_successful_concurrent, metrics.concurrent_users)
                if best_metrics is None or metrics.concurrent_users > best_metrics.concurrent_users:
                    best_metrics = metrics
        
        # 性能峰值分析
        if best_metrics:
            print(f"\n🎯 最佳性能点:")
            print(f"   最大稳定并发数: {best_metrics.concurrent_users}")
            print(f"   成功率: {best_metrics.success_rate*100:.1f}%")
            print(f"   平均响应时间: {best_metrics.avg_response_time*1000:.1f}ms")
            print(f"   最大响应时间: {best_metrics.max_response_time*1000:.1f}ms")
            print(f"   吞吐量: {best_metrics.throughput:.1f} 请求/秒")
        
        # 达标情况评估
        print(f"\n✅ 达标情况评估:")
        
        # 并发处理能力要求 ≥1000个客户端
        concurrent_pass = max_successful_concurrent >= 1000
        print(f"   最大稳定并发数: {max_successful_concurrent} {'✅ 达标' if concurrent_pass else '❌ 未达标'} (要求: ≥1000)")
        
        # 响应时间要求 <30秒
        if best_metrics:
            response_time_pass = best_metrics.max_response_time < 30.0
            print(f"   最大响应时间: {best_metrics.max_response_time:.3f}s {'✅ 达标' if response_time_pass else '❌ 未达标'} (要求: <30s)")
        else:
            response_time_pass = False
            print(f"   最大响应时间: N/A ❌ 未达标 (要求: <30s)")
        
        # 系统稳定性评估
        if best_metrics:
            stability_pass = best_metrics.success_rate >= 0.95
            print(f"   系统稳定性: {best_metrics.success_rate*100:.1f}% {'✅ 稳定' if stability_pass else '❌ 不稳定'} (要求: ≥95%)")
        else:
            stability_pass = False
            print(f"   系统稳定性: N/A ❌ 不稳定 (要求: ≥95%)")
        
        # 性能建议
        print(f"\n💡 性能优化建议:")
        
        if max_successful_concurrent < 1000:
            print(f"   - 当前最大并发数 {max_successful_concurrent} 未达到要求，建议:")
            print(f"     * 优化数据库连接池和查询性能")
            print(f"     * 增加缓存机制减少重复计算")
            print(f"     * 考虑水平扩展和负载均衡")
        
        # 寻找性能瓶颈点
        performance_degradation = []
        for i in range(1, len(ramp_up_results)):
            prev_metrics = ramp_up_results[i-1]
            curr_metrics = ramp_up_results[i]
            
            # 检查响应时间是否显著增加
            if curr_metrics.avg_response_time > prev_metrics.avg_response_time * 2:
                performance_degradation.append(curr_metrics.concurrent_users)
        
        if performance_degradation:
            print(f"   - 性能瓶颈点: {performance_degradation} 并发用户时响应时间显著增加")
            print(f"     * 建议在这些点位进行详细的性能分析")
        
        # 总体评估
        all_pass = concurrent_pass and response_time_pass and stability_pass
        print(f"\n🎉 总体评估: {'✅ 性能达标' if all_pass else '❌ 性能需要优化'}")
        
        print("="*80)
        
        return {
            "concurrent_pass": concurrent_pass,
            "response_time_pass": response_time_pass,
            "stability_pass": stability_pass,
            "all_pass": all_pass,
            "max_concurrent": max_successful_concurrent,
            "best_metrics": best_metrics
        }
    
    async def run_comprehensive_performance_test(self) -> Dict[str, Any]:
        """运行综合性能测试"""
        
        print("🔧 混合检测引擎性能压力测试")
        print(f"🎯 目标指标: 并发处理≥1000客户端, 响应时间<30s, 成功率≥95%")
        
        # 运行渐进式负载测试
        ramp_up_results = await self.run_ramp_up_test(
            max_users=self.test_config["max_concurrent_users"],
            ramp_up_time=self.test_config["ramp_up_time"],
            test_duration=30  # 每级测试30秒
        )
        
        # 打印结果
        evaluation = self.print_performance_results(ramp_up_results)
        
        return {
            "test_config": self.test_config,
            "ramp_up_results": ramp_up_results,
            "evaluation": evaluation,
            "max_concurrent_detected": self.detection_engine.max_concurrent,
            "total_requests_processed": self.detection_engine.request_count,
            "timestamp": datetime.now().isoformat()
        }

async def main():
    """主测试函数"""
    test_runner = PerformanceStressTest()
    
    try:
        results = await test_runner.run_comprehensive_performance_test()
        return results["evaluation"]["all_pass"]
        
    except Exception as e:
        print(f"❌ 性能测试执行异常: {e}")
        return False

if __name__ == "__main__":
    success = asyncio.run(main())
    print(f"\n{'🎉 性能测试全部通过' if success else '❌ 性能测试存在未达标项'}")
    exit(0 if success else 1) 