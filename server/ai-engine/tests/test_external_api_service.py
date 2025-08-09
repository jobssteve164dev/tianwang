"""
外部API服务单元测试
"""
import pytest
import asyncio
import json
from unittest.mock import AsyncMock, Mock, patch
from datetime import datetime

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.services.external_api_service import ExternalAPIService, APIStatus
from src.config import config

class TestExternalAPIService:
    """外部API服务测试类"""
    
    @pytest.fixture
    async def api_service(self):
        """创建测试用的API服务实例"""
        service = ExternalAPIService()
        # 模拟初始化，避免真实的网络连接
        service.api_status = {
            "openai": APIStatus.HEALTHY,
            "claude": APIStatus.HEALTHY,
            "openrouter": APIStatus.HEALTHY,
            "deepseek": APIStatus.HEALTHY
        }
        service.failure_counts = {api: 0 for api in service.api_status.keys()}
        service.request_counts = {api: 0 for api in service.api_status.keys()}
        service.last_request_time = {}
        return service
    
    @pytest.mark.asyncio
    async def test_select_best_api_priority(self, api_service):
        """测试API选择 - 优先级策略"""
        # 模拟配置
        with patch.object(config, 'external_apis', {
            "openai": {"enabled": True, "priority": 1},
            "claude": {"enabled": True, "priority": 2},
            "deepseek": {"enabled": True, "priority": 3}
        }):
            with patch.object(config, 'load_balancing', {"strategy": "priority_with_fallback"}):
                with patch.object(api_service, '_check_rate_limit', return_value=True):
                    with patch.object(api_service, '_check_budget', return_value=True):
                        selected = await api_service._select_best_api()
                        assert selected == "openai"
    
    @pytest.mark.asyncio
    async def test_select_best_api_least_cost(self, api_service):
        """测试API选择 - 最低成本策略"""
        with patch.object(config, 'external_apis', {
            "openai": {"enabled": True, "cost_per_token": 0.002},
            "deepseek": {"enabled": True, "cost_per_token": 0.0005},
            "claude": {"enabled": True, "cost_per_token": 0.001}
        }):
            with patch.object(config, 'load_balancing', {"strategy": "least_cost"}):
                with patch.object(api_service, '_check_rate_limit', return_value=True):
                    with patch.object(api_service, '_check_budget', return_value=True):
                        selected = await api_service._select_best_api()
                        assert selected == "deepseek"
    
    @pytest.mark.asyncio
    async def test_api_failure_handling(self, api_service):
        """测试API失败处理"""
        api_name = "openai"
        
        # 模拟失败阈值
        with patch.object(config, 'load_balancing', {"failure_threshold": 3}):
            # 连续失败3次
            for _ in range(3):
                await api_service._handle_api_failure(api_name)
            
            # 检查状态是否变为不健康
            assert api_service.api_status[api_name] == APIStatus.UNHEALTHY
            assert api_service.failure_counts[api_name] == 3
    
    @pytest.mark.asyncio
    async def test_rate_limit_check(self, api_service):
        """测试速率限制检查"""
        api_name = "openai"
        
        with patch.object(config, 'external_apis', {
            api_name: {"rate_limit": 60}  # 每分钟60次
        }):
            # 第一次请求应该通过
            result = await api_service._check_rate_limit(api_name)
            assert result is True
            
            # 模拟快速连续请求
            api_service.request_counts[api_name] = 61
            result = await api_service._check_rate_limit(api_name)
            assert result is False
    
    @pytest.mark.asyncio
    async def test_budget_check(self, api_service):
        """测试预算检查"""
        with patch.object(config, 'cost_control', {
            "enable_cost_tracking": True,
            "daily_budget": 10.0
        }):
            # 预算充足
            api_service.cost_tracker["daily_cost"] = 5.0
            result = await api_service._check_budget()
            assert result is True
            
            # 超出预算
            api_service.cost_tracker["daily_cost"] = 15.0
            result = await api_service._check_budget()
            assert result is False
    
    @pytest.mark.asyncio
    async def test_cost_tracking_update(self, api_service):
        """测试成本追踪更新"""
        api_name = "openai"
        tokens_used = 1000
        
        with patch.object(config, 'cost_control', {"enable_cost_tracking": True}):
            with patch.object(config, 'external_apis', {
                api_name: {"cost_per_token": 0.000002}
            }):
                initial_cost = api_service.cost_tracker["daily_cost"]
                await api_service._update_cost_tracking(api_name, tokens_used)
                
                expected_cost = tokens_used * 0.000002
                assert api_service.cost_tracker["daily_cost"] == initial_cost + expected_cost
    
    def test_generate_cache_key(self, api_service):
        """测试缓存键生成"""
        prompt = "分析这个日志"
        analysis_type = "log_analysis"
        
        key1 = api_service._generate_cache_key(prompt, analysis_type)
        key2 = api_service._generate_cache_key(prompt, analysis_type)
        
        # 相同输入应生成相同的键
        assert key1 == key2
        assert key1.startswith("llm_cache:")
        
        # 不同输入应生成不同的键
        key3 = api_service._generate_cache_key("不同的提示", analysis_type)
        assert key1 != key3
    
    def test_build_request_openai(self, api_service):
        """测试OpenAI请求构建"""
        with patch.object(config, 'external_apis', {
            "openai": {
                "default_model": "gpt-3.5-turbo",
                "max_tokens": 4096
            }
        }):
            request = api_service._build_request("openai", "测试提示", "log_analysis")
            
            assert request["model"] == "gpt-3.5-turbo"
            assert request["max_tokens"] == 4096
            assert len(request["messages"]) == 2
            assert request["messages"][0]["role"] == "system"
            assert request["messages"][1]["role"] == "user"
            assert request["messages"][1]["content"] == "测试提示"
    
    def test_build_request_openrouter(self, api_service):
        """测试OpenRouter请求构建"""
        with patch.object(config, 'external_apis', {
            "openrouter": {
                "default_model": "openai/gpt-4",
                "max_tokens": 4096
            }
        }):
            request = api_service._build_request("openrouter", "测试提示", "threat_detection")
            
            assert request["model"] == "openai/gpt-4"
            assert "site_url" in request
            assert "app_name" in request
            assert request["site_url"] == "https://tianwang-security.com"
    
    @pytest.mark.asyncio
    async def test_analyze_with_llm_success(self, api_service):
        """测试成功的LLM分析"""
        # 模拟成功的API响应
        mock_response = {
            "choices": [
                {"message": {"content": "这是分析结果"}}
            ],
            "usage": {"total_tokens": 150}
        }
        
        with patch.object(api_service, '_select_best_api', return_value="openai"):
            with patch.object(api_service, '_make_api_request', return_value={
                "success": True,
                "content": "这是分析结果",
                "tokens_used": 150,
                "provider": "openai",
                "model": "gpt-3.5-turbo"
            }):
                result = await api_service.analyze_with_llm("测试提示", "log_analysis")
                
                assert result["success"] is True
                assert result["content"] == "这是分析结果"
                assert result["provider"] == "openai"
                assert result["tokens_used"] == 150
    
    @pytest.mark.asyncio
    async def test_analyze_with_llm_no_available_api(self, api_service):
        """测试没有可用API的情况"""
        with patch.object(api_service, '_select_best_api', return_value=None):
            result = await api_service.analyze_with_llm("测试提示", "log_analysis")
            
            assert result["success"] is False
            assert "没有可用的外部API" in result["error"]
    
    @pytest.mark.asyncio
    async def test_cache_functionality(self, api_service):
        """测试缓存功能"""
        # 模拟Redis客户端
        mock_redis = AsyncMock()
        api_service.redis_client = mock_redis
        
        # 测试缓存存储
        prompt = "测试提示"
        analysis_type = "log_analysis"
        result = {"success": True, "content": "缓存测试"}
        
        with patch.object(config, 'api_cache', {
            "enabled": True,
            "default_ttl": 3600,
            "cache_strategies": {"log_analysis": 7200}
        }):
            await api_service._cache_result(prompt, analysis_type, result)
            
            # 验证Redis被调用
            mock_redis.setex.assert_called_once()
            
            # 测试缓存获取
            mock_redis.get.return_value = json.dumps({**result, "cached_at": datetime.now().isoformat()})
            cached_result = await api_service._get_from_cache(prompt, analysis_type)
            
            assert cached_result is not None
            assert cached_result["from_cache"] is True
    
    def test_is_healthy(self, api_service):
        """测试健康检查"""
        # 所有API都健康
        assert api_service.is_healthy() is True
        
        # 所有API都不健康
        for api_name in api_service.api_status:
            api_service.api_status[api_name] = APIStatus.UNHEALTHY
        assert api_service.is_healthy() is False
        
        # 部分API健康
        api_service.api_status["openai"] = APIStatus.HEALTHY
        assert api_service.is_healthy() is True

if __name__ == "__main__":
    pytest.main([__file__, "-v"]) 