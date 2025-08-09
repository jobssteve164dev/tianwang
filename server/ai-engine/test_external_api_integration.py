"""
外部API集成测试
测试OpenRouter和DeepSeek API的实际集成
"""
import asyncio
import os
import json
from datetime import datetime
from loguru import logger

# 设置日志
logger.add("logs/external_api_test.log", rotation="1 day", retention="7 days")

# 添加路径
import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from src.services.external_api_service import ExternalAPIService
from src.config import config

async def test_api_configuration():
    """测试API配置"""
    logger.info("=== 测试API配置 ===")
    
    print("外部API配置:")
    for api_name, api_config in config.external_apis.items():
        print(f"  {api_name}:")
        print(f"    启用: {api_config.get('enabled', False)}")
        print(f"    基础URL: {api_config.get('base_url', 'N/A')}")
        print(f"    默认模型: {api_config.get('default_model', 'N/A')}")
        print(f"    优先级: {api_config.get('priority', 'N/A')}")
        print(f"    每token成本: {api_config.get('cost_per_token', 'N/A')}")
        
        # 检查API密钥配置
        key_attr = f"{api_name}_api_key"
        has_key = hasattr(config, key_attr) and getattr(config, key_attr)
        print(f"    API密钥: {'已配置' if has_key else '未配置'}")
        print()

async def test_service_initialization():
    """测试服务初始化"""
    logger.info("=== 测试服务初始化 ===")
    
    try:
        service = ExternalAPIService()
        
        # 检查初始状态
        print("服务初始状态:")
        print(f"  会话: {service.session}")
        print(f"  Redis客户端: {service.redis_client}")
        print(f"  API状态: {service.api_status}")
        print(f"  成本追踪器: {service.cost_tracker}")
        
        # 注意: 这里不执行真实初始化，避免网络连接
        # await service.initialize()
        
        print("✅ 服务初始化测试通过")
        return service
        
    except Exception as e:
        print(f"❌ 服务初始化失败: {e}")
        logger.error(f"服务初始化失败: {e}")
        return None

async def test_api_selection_logic():
    """测试API选择逻辑"""
    logger.info("=== 测试API选择逻辑 ===")
    
    service = ExternalAPIService()
    
    # 模拟健康状态
    from src.services.external_api_service import APIStatus
    service.api_status = {
        "openai": APIStatus.HEALTHY,
        "claude": APIStatus.HEALTHY,
        "openrouter": APIStatus.HEALTHY,
        "deepseek": APIStatus.HEALTHY
    }
    service.failure_counts = {api: 0 for api in service.api_status.keys()}
    
    # 测试不同策略
    strategies = ["priority_with_fallback", "least_cost", "round_robin"]
    
    for strategy in strategies:
        print(f"\n测试策略: {strategy}")
        
        # 临时修改配置
        original_strategy = config.load_balancing.get("strategy")
        config.load_balancing["strategy"] = strategy
        
        try:
            # 模拟选择过程
            selected_apis = []
            for _ in range(3):
                # 模拟检查函数
                async def mock_check_rate_limit(api_name):
                    return True
                async def mock_check_budget():
                    return True
                
                service._check_rate_limit = mock_check_rate_limit
                service._check_budget = mock_check_budget
                
                selected = await service._select_best_api()
                selected_apis.append(selected)
                await asyncio.sleep(0.1)  # 模拟时间流逝
            
            print(f"  选择结果: {selected_apis}")
            
        except Exception as e:
            print(f"  ❌ 策略测试失败: {e}")
        finally:
            # 恢复原配置
            if original_strategy:
                config.load_balancing["strategy"] = original_strategy

def test_request_building():
    """测试请求构建"""
    logger.info("=== 测试请求构建 ===")
    
    service = ExternalAPIService()
    test_prompt = "分析以下网络日志是否存在安全威胁：[2024-01-09 10:30:15] 192.168.1.100 -> 8.8.8.8:53 DNS查询 malicious-domain.com"
    
    for api_name in ["openai", "claude", "openrouter", "deepseek"]:
        print(f"\n测试 {api_name} 请求构建:")
        
        try:
            request_data = service._build_request(api_name, test_prompt, "log_analysis")
            
            print(f"  模型: {request_data.get('model', 'N/A')}")
            print(f"  最大tokens: {request_data.get('max_tokens', 'N/A')}")
            print(f"  温度: {request_data.get('temperature', 'N/A')}")
            print(f"  消息数量: {len(request_data.get('messages', []))}")
            
            if api_name == "openrouter":
                print(f"  站点URL: {request_data.get('site_url', 'N/A')}")
                print(f"  应用名称: {request_data.get('app_name', 'N/A')}")
            
            print("  ✅ 请求构建成功")
            
        except Exception as e:
            print(f"  ❌ 请求构建失败: {e}")

def test_cache_key_generation():
    """测试缓存键生成"""
    logger.info("=== 测试缓存键生成 ===")
    
    service = ExternalAPIService()
    
    test_cases = [
        ("分析日志", "log_analysis"),
        ("检测威胁", "threat_detection"),
        ("行为分析", "behavior_analysis"),
        ("相同提示", "log_analysis"),
        ("相同提示", "log_analysis"),  # 重复测试
    ]
    
    cache_keys = []
    for prompt, analysis_type in test_cases:
        key = service._generate_cache_key(prompt, analysis_type)
        cache_keys.append(key)
        print(f"提示: '{prompt}' | 类型: '{analysis_type}' | 键: {key}")
    
    # 检查重复键
    if cache_keys[3] == cache_keys[4]:
        print("✅ 相同输入生成相同缓存键")
    else:
        print("❌ 相同输入生成了不同的缓存键")
    
    # 检查不同键
    unique_keys = set(cache_keys[:3])
    if len(unique_keys) == 3:
        print("✅ 不同输入生成不同缓存键")
    else:
        print("❌ 不同输入生成了相同的缓存键")

async def test_cost_control():
    """测试成本控制"""
    logger.info("=== 测试成本控制 ===")
    
    service = ExternalAPIService()
    service.cost_tracker = {
        "daily_cost": 0.0,
        "monthly_cost": 0.0,
        "last_reset": datetime.now()
    }
    
    print("初始成本状态:")
    print(f"  每日成本: ${service.cost_tracker['daily_cost']:.4f}")
    print(f"  每月成本: ${service.cost_tracker['monthly_cost']:.4f}")
    
    # 模拟API调用成本
    test_scenarios = [
        ("openai", 1000, "OpenAI调用"),
        ("deepseek", 2000, "DeepSeek调用"),
        ("claude", 500, "Claude调用"),
        ("openrouter", 1500, "OpenRouter调用")
    ]
    
    for api_name, tokens, description in test_scenarios:
        await service._update_cost_tracking(api_name, tokens)
        print(f"\n{description} ({tokens} tokens):")
        print(f"  每日成本: ${service.cost_tracker['daily_cost']:.4f}")
        print(f"  每月成本: ${service.cost_tracker['monthly_cost']:.4f}")
        
        # 检查预算
        budget_ok = await service._check_budget()
        print(f"  预算检查: {'通过' if budget_ok else '超限'}")
    
    print(f"\n最终成本统计:")
    print(f"  每日总成本: ${service.cost_tracker['daily_cost']:.4f}")
    print(f"  每月总成本: ${service.cost_tracker['monthly_cost']:.4f}")

async def test_health_status():
    """测试健康状态管理"""
    logger.info("=== 测试健康状态管理 ===")
    
    service = ExternalAPIService()
    from src.services.external_api_service import APIStatus
    
    # 初始化状态
    service.api_status = {
        "openai": APIStatus.HEALTHY,
        "claude": APIStatus.HEALTHY,
        "openrouter": APIStatus.HEALTHY,
        "deepseek": APIStatus.HEALTHY
    }
    service.failure_counts = {api: 0 for api in service.api_status.keys()}
    
    print("初始健康状态:")
    for api_name, status in service.api_status.items():
        print(f"  {api_name}: {status.value}")
    print(f"整体健康: {service.is_healthy()}")
    
    # 模拟失败
    print("\n模拟API失败:")
    await service._handle_api_failure("openai")
    await service._handle_api_failure("openai")
    await service._handle_api_failure("openai")
    
    print("失败后状态:")
    for api_name, status in service.api_status.items():
        count = service.failure_counts[api_name]
        print(f"  {api_name}: {status.value} (失败次数: {count})")
    print(f"整体健康: {service.is_healthy()}")

async def main():
    """主测试函数"""
    print("🚀 开始外部API集成测试")
    print("=" * 50)
    
    try:
        # 运行所有测试
        await test_api_configuration()
        await test_service_initialization()
        await test_api_selection_logic()
        test_request_building()
        test_cache_key_generation()
        await test_cost_control()
        await test_health_status()
        
        print("\n" + "=" * 50)
        print("✅ 所有测试完成")
        
    except Exception as e:
        print(f"\n❌ 测试过程中出现异常: {e}")
        logger.error(f"测试异常: {e}")

if __name__ == "__main__":
    # 创建日志目录
    os.makedirs("logs", exist_ok=True)
    
    # 运行测试
    asyncio.run(main()) 