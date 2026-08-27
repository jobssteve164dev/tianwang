"""
外部API服务管理器
负责管理和调用多个外部大模型API，包括OpenAI、Claude、OpenRouter、DeepSeek等
"""
import asyncio
import aiohttp
import hashlib
import json
import time
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple
from loguru import logger
import redis.asyncio as redis
from enum import Enum

from ..config import config

class APIProvider(Enum):
    """API提供商枚举"""
    OPENAI = "openai"
    CLAUDE = "claude"
    OPENROUTER = "openrouter"
    DEEPSEEK = "deepseek"

class APIStatus(Enum):
    """API状态枚举"""
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNHEALTHY = "unhealthy"
    DISABLED = "disabled"

class ExternalAPIService:
    """外部API服务管理器"""
    
    def __init__(self):
        self.session: Optional[aiohttp.ClientSession] = None
        self.redis_client: Optional[redis.Redis] = None
        self.api_status: Dict[str, APIStatus] = {}
        self.failure_counts: Dict[str, int] = {}
        self.last_failure_time: Dict[str, datetime] = {}
        self.cost_tracker: Dict[str, float] = {
            "daily_cost": 0.0,
            "monthly_cost": 0.0,
            "last_reset": datetime.now()
        }
        self.request_counts: Dict[str, int] = {}
        self.last_request_time: Dict[str, datetime] = {}
        
    async def initialize(self):
        """初始化外部API服务"""
        try:
            logger.info("正在初始化外部API服务...")
            
            # 创建HTTP会话
            timeout = aiohttp.ClientTimeout(total=config.api_timeout)
            self.session = aiohttp.ClientSession(timeout=timeout)
            
            # 初始化Redis客户端（用于缓存）
            if config.api_cache.get("enabled", False) and config.api_cache.get("backend") == "redis":
                redis_kwargs = {
                    "host": config.redis_host,
                    "port": config.redis_port,
                    "db": config.redis_db,
                    "decode_responses": True
                }
                # 只有在配置了密码时才添加密码参数
                if config.redis_password:
                    redis_kwargs["password"] = config.redis_password
                
                self.redis_client = redis.Redis(**redis_kwargs)
                await self.redis_client.ping()
                logger.info("Redis缓存连接成功")
            
            # 初始化API状态
            for api_name, api_config in config.external_apis.items():
                has_key = bool(getattr(config, f"{api_name}_api_key", ""))
                self.api_status[api_name] = APIStatus.HEALTHY if api_config.get("enabled") and has_key else APIStatus.DISABLED
                self.failure_counts[api_name] = 0
                self.request_counts[api_name] = 0
            
            # 启动健康检查任务
            asyncio.create_task(self._health_check_loop())
            
            # 启动成本重置任务
            asyncio.create_task(self._cost_reset_loop())
            
            logger.info("外部API服务初始化完成")
            
        except Exception as e:
            logger.error(f"外部API服务初始化失败: {e}")
            raise
    
    async def cleanup(self):
        """清理资源"""
        if self.session:
            await self.session.close()
        if self.redis_client:
            await self.redis_client.close()
    
    async def analyze_with_llm(
        self,
        prompt: str,
        analysis_type: str = "general",
        preferred_provider: Optional[str] = None,
        use_cache: bool = True
    ) -> Dict[str, Any]:
        """使用大模型进行分析"""
        try:
            # 检查缓存
            if use_cache:
                cached_result = await self._get_from_cache(prompt, analysis_type)
                if cached_result:
                    logger.debug(f"使用缓存结果: {analysis_type}")
                    return cached_result
            
            # 选择最佳API
            selected_api = await self._select_best_api(preferred_provider)
            if not selected_api:
                return {
                    "success": False,
                    "error": "没有可用的外部API",
                    "provider": None
                }
            
            # 构建请求
            request_data = self._build_request(selected_api, prompt, analysis_type)
            
            # 发送请求
            result = await self._make_api_request(selected_api, request_data)
            
            # 缓存结果
            if use_cache and result.get("success", False):
                await self._cache_result(prompt, analysis_type, result)
            
            # 更新成本追踪
            if result.get("success", False):
                await self._update_cost_tracking(selected_api, result.get("tokens_used", 0))
            
            return result
            
        except Exception as e:
            logger.error(f"大模型分析失败: {e}")
            return {
                "success": False,
                "error": str(e),
                "provider": None
            }
    
    async def _select_best_api(self, preferred_provider: Optional[str] = None) -> Optional[str]:
        """选择最佳API"""
        try:
            # 如果指定了首选提供商且可用，优先使用
            if preferred_provider and preferred_provider in config.external_apis:
                if (self.api_status.get(preferred_provider) == APIStatus.HEALTHY and
                    await self._check_rate_limit(preferred_provider) and
                    await self._check_budget()):
                    return preferred_provider
            
            # 获取可用的API列表
            available_apis = []
            for api_name, api_config in config.external_apis.items():
                if (api_config.get("enabled", False) and
                    self.api_status.get(api_name) == APIStatus.HEALTHY and
                    await self._check_rate_limit(api_name) and
                    await self._check_budget()):
                    available_apis.append((api_name, api_config))
            
            if not available_apis:
                logger.warning("没有可用的外部API")
                return None
            
            # 根据负载均衡策略选择API
            strategy = config.load_balancing.get("strategy", "priority_with_fallback")
            
            if strategy == "priority_with_fallback":
                # 按优先级排序
                available_apis.sort(key=lambda x: x[1].get("priority", 999))
                return available_apis[0][0]
                
            elif strategy == "least_cost":
                # 按成本排序
                available_apis.sort(key=lambda x: x[1].get("cost_per_token", 999))
                return available_apis[0][0]
                
            elif strategy == "round_robin":
                # 轮询选择
                api_names = [api[0] for api in available_apis]
                current_time = int(time.time())
                selected_index = current_time % len(api_names)
                return api_names[selected_index]
            
            # 默认返回第一个可用的
            return available_apis[0][0]
            
        except Exception as e:
            logger.error(f"选择API失败: {e}")
            return None
    
    def _build_request(self, api_name: str, prompt: str, analysis_type: str) -> Dict[str, Any]:
        """构建API请求"""
        api_config = config.external_apis[api_name]
        
        # 根据分析类型优化提示词
        system_prompts = {
            "log_analysis": "你是一个网络安全专家，专门分析系统日志以识别潜在的安全威胁。",
            "threat_detection": "你是一个威胁检测专家，能够识别和分析各种网络安全威胁。",
            "behavior_analysis": "你是一个行为分析专家，专门分析用户和系统行为模式以发现异常。",
            "general": "你是一个网络安全分析专家。"
        }
        
        system_prompt = system_prompts.get(analysis_type, system_prompts["general"])
        
        # 构建统一的请求格式
        request_data = {
            "model": api_config["default_model"],
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt}
            ],
            "max_tokens": min(api_config.get("max_tokens", 4096), 4096),
            "temperature": 0.1,  # 安全分析需要较低的随机性
        }

        if api_name == "claude":
            request_data = {
                "model": api_config["default_model"],
                "system": system_prompt,
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": min(api_config.get("max_tokens", 4096), 4096),
                "temperature": 0.1,
            }
        
        # API特定的参数调整
        return request_data
    
    async def _make_api_request(self, api_name: str, request_data: Dict[str, Any], api_key_override: str = "") -> Dict[str, Any]:
        """发送API请求"""
        try:
            api_config = config.external_apis[api_name]
            
            # 构建请求头
            headers = {
                "Content-Type": "application/json"
            }
            
            # 设置API密钥
            api_key = api_key_override or getattr(config, f"{api_name}_api_key", "")
            if not api_key:
                return {
                    "success": False,
                    "error": f"{api_name} API密钥未配置",
                    "provider": api_name
                }
            
            if api_name == "openai":
                headers["Authorization"] = f"Bearer {api_key}"
            elif api_name == "claude":
                headers["x-api-key"] = api_key
                headers["anthropic-version"] = "2023-06-01"
            elif api_name == "openrouter":
                headers["Authorization"] = f"Bearer {api_key}"
                headers["HTTP-Referer"] = "https://tianwang-security.com"
                headers["X-Title"] = "TianWang Security Monitor"
            elif api_name == "deepseek":
                headers["Authorization"] = f"Bearer {api_key}"
            
            # 发送请求
            endpoint = "messages" if api_name == "claude" else "chat/completions"
            url = f"{api_config['base_url']}/{endpoint}"
            
            async with self.session.post(url, json=request_data, headers=headers) as response:
                if response.status == 200:
                    result = await response.json()
                    
                    # 解析响应
                    content = ""
                    tokens_used = 0
                    
                    if api_name == "claude" and result.get("content"):
                        content = "".join(part.get("text", "") for part in result["content"] if part.get("type") == "text")
                    elif "choices" in result and len(result["choices"]) > 0:
                        content = result["choices"][0]["message"]["content"]
                    
                    if "usage" in result:
                        tokens_used = result["usage"].get("total_tokens", 0)
                    
                    # 更新成功计数
                    self.failure_counts[api_name] = 0
                    
                    return {
                        "success": True,
                        "content": content,
                        "tokens_used": tokens_used,
                        "provider": api_name,
                        "model": request_data["model"]
                    }
                else:
                    error_text = await response.text()
                    logger.error(f"{api_name} API请求失败: {response.status} - {error_text}")
                    
                    # 更新失败计数
                    await self._handle_api_failure(api_name)
                    
                    return {
                        "success": False,
                        "error": f"HTTP {response.status}: {error_text}",
                        "provider": api_name
                    }
                    
        except asyncio.TimeoutError:
            logger.error(f"{api_name} API请求超时")
            await self._handle_api_failure(api_name)
            return {
                "success": False,
                "error": "请求超时",
                "provider": api_name
            }
            
        except Exception as e:
            logger.error(f"{api_name} API请求异常: {e}")
            await self._handle_api_failure(api_name)
            return {
                "success": False,
                "error": str(e),
                "provider": api_name
            }
    
    async def _handle_api_failure(self, api_name: str):
        """处理API失败"""
        self.failure_counts[api_name] += 1
        self.last_failure_time[api_name] = datetime.now()
        
        # 检查是否需要降级
        failure_threshold = config.load_balancing.get("failure_threshold", 3)
        if self.failure_counts[api_name] >= failure_threshold:
            self.api_status[api_name] = APIStatus.UNHEALTHY
            logger.warning(f"{api_name} API已标记为不健康，失败次数: {self.failure_counts[api_name]}")
    
    async def _check_rate_limit(self, api_name: str) -> bool:
        """检查速率限制"""
        try:
            api_config = config.external_apis[api_name]
            rate_limit = api_config.get("rate_limit", 1000)
            
            current_time = datetime.now()
            last_request = self.last_request_time.get(api_name)
            
            if last_request:
                time_diff = (current_time - last_request).total_seconds()
                if time_diff < 60:  # 1分钟内
                    current_requests = self.request_counts.get(api_name, 0)
                    if current_requests >= rate_limit / 60:  # 每分钟限制
                        return False
            
            # 更新请求计数
            if not last_request or (current_time - last_request).total_seconds() >= 60:
                self.request_counts[api_name] = 1
            else:
                self.request_counts[api_name] += 1
            
            self.last_request_time[api_name] = current_time
            return True
            
        except Exception as e:
            logger.error(f"检查速率限制失败: {e}")
            return True  # 默认允许
    
    async def _check_budget(self) -> bool:
        """检查预算限制"""
        try:
            if not config.cost_control.get("enable_cost_tracking", False):
                return True
            
            daily_budget = config.cost_control.get("daily_budget", 10.0)
            current_cost = self.cost_tracker.get("daily_cost", 0.0)
            
            if current_cost >= daily_budget:
                logger.warning(f"已达到每日预算限制: ${current_cost:.4f} >= ${daily_budget}")
                return False
            
            return True
            
        except Exception as e:
            logger.error(f"检查预算失败: {e}")
            return True  # 默认允许
    
    async def _update_cost_tracking(self, api_name: str, tokens_used: int):
        """更新成本追踪"""
        try:
            if not config.cost_control.get("enable_cost_tracking", False):
                return
            
            api_config = config.external_apis[api_name]
            cost_per_token = api_config.get("cost_per_token", 0.000001)
            cost = tokens_used * cost_per_token
            
            self.cost_tracker["daily_cost"] += cost
            self.cost_tracker["monthly_cost"] += cost
            
            logger.debug(f"{api_name} API调用成本: ${cost:.6f} (tokens: {tokens_used})")
            
            # 检查预算告警
            daily_budget = config.cost_control.get("daily_budget", 10.0)
            alert_threshold = config.cost_control.get("cost_alert_threshold", 0.8)
            
            if self.cost_tracker["daily_cost"] >= daily_budget * alert_threshold:
                logger.warning(f"接近每日预算限制: ${self.cost_tracker['daily_cost']:.4f} / ${daily_budget}")
            
        except Exception as e:
            logger.error(f"更新成本追踪失败: {e}")
    
    async def _get_from_cache(self, prompt: str, analysis_type: str) -> Optional[Dict[str, Any]]:
        """从缓存获取结果"""
        try:
            if not config.api_cache.get("enabled", False) or not self.redis_client:
                return None
            
            # 生成缓存键
            cache_key = self._generate_cache_key(prompt, analysis_type)
            
            # 从Redis获取
            cached_data = await self.redis_client.get(cache_key)
            if cached_data:
                result = json.loads(cached_data)
                result["from_cache"] = True
                return result
            
            return None
            
        except Exception as e:
            logger.error(f"获取缓存失败: {e}")
            return None
    
    async def _cache_result(self, prompt: str, analysis_type: str, result: Dict[str, Any]):
        """缓存结果"""
        try:
            if not config.api_cache.get("enabled", False) or not self.redis_client:
                return
            
            # 生成缓存键
            cache_key = self._generate_cache_key(prompt, analysis_type)
            
            # 获取缓存TTL
            ttl = config.api_cache.get("cache_strategies", {}).get(
                analysis_type, 
                config.api_cache.get("default_ttl", 3600)
            )
            
            # 准备缓存数据
            cache_data = result.copy()
            cache_data["cached_at"] = datetime.now().isoformat()
            
            # 存储到Redis
            await self.redis_client.setex(
                cache_key,
                ttl,
                json.dumps(cache_data, ensure_ascii=False)
            )
            
        except Exception as e:
            logger.error(f"缓存结果失败: {e}")
    
    def _generate_cache_key(self, prompt: str, analysis_type: str) -> str:
        """生成缓存键"""
        content = f"{analysis_type}:{prompt}"
        return f"llm_cache:{hashlib.md5(content.encode()).hexdigest()}"
    
    async def _health_check_loop(self):
        """健康检查循环"""
        while True:
            try:
                await asyncio.sleep(config.load_balancing.get("health_check_interval", 60))
                await self._perform_health_check()
            except Exception as e:
                logger.error(f"健康检查失败: {e}")
    
    async def _perform_health_check(self):
        """执行健康检查"""
        try:
            recovery_timeout = config.load_balancing.get("recovery_timeout", 300)
            current_time = datetime.now()
            
            for api_name in config.external_apis.keys():
                if self.api_status.get(api_name) == APIStatus.UNHEALTHY:
                    last_failure = self.last_failure_time.get(api_name)
                    if last_failure and (current_time - last_failure).total_seconds() >= recovery_timeout:
                        # 尝试恢复
                        logger.info(f"尝试恢复 {api_name} API")
                        self.api_status[api_name] = APIStatus.HEALTHY
                        self.failure_counts[api_name] = 0
            
        except Exception as e:
            logger.error(f"健康检查执行失败: {e}")
    
    async def _cost_reset_loop(self):
        """成本重置循环"""
        while True:
            try:
                await asyncio.sleep(3600)  # 每小时检查一次
                await self._reset_cost_counters()
            except Exception as e:
                logger.error(f"成本重置失败: {e}")
    
    async def _reset_cost_counters(self):
        """重置成本计数器"""
        try:
            current_time = datetime.now()
            last_reset = self.cost_tracker.get("last_reset", current_time)
            
            # 每日重置
            if (current_time - last_reset).days >= 1:
                self.cost_tracker["daily_cost"] = 0.0
                logger.info("已重置每日成本计数器")
            
            # 每月重置
            if current_time.month != last_reset.month:
                self.cost_tracker["monthly_cost"] = 0.0
                logger.info("已重置每月成本计数器")
            
            self.cost_tracker["last_reset"] = current_time
            
        except Exception as e:
            logger.error(f"重置成本计数器失败: {e}")
    
    async def get_api_status(self) -> Dict[str, Any]:
        """获取API状态信息"""
        return {
            "api_status": {name: status.value for name, status in self.api_status.items()},
            "failure_counts": self.failure_counts,
            "cost_tracking": self.cost_tracker,
            "request_counts": self.request_counts
        }

    def configure_providers(self, provider_configs: Dict[str, Dict[str, Any]]) -> Dict[str, str]:
        supported = {provider.value for provider in APIProvider}
        unknown = set(provider_configs) - supported
        if unknown:
            raise ValueError(f"不支持的外部API提供方: {', '.join(sorted(unknown))}")

        for api_name, incoming in provider_configs.items():
            current = dict(config.external_apis[api_name])
            enabled = bool(incoming.get("enabled", current.get("enabled", False)))
            api_key = str(incoming.get("api_key", "") or getattr(config, f"{api_name}_api_key", "")).strip()
            default_model = incoming.get("default_model") or current.get("default_model")
            if enabled and not api_key:
                raise ValueError(f"{api_name} 启用时必须提供API密钥")
            if not isinstance(default_model, str) or not default_model.strip():
                raise ValueError(f"{api_name} 默认模型无效")

            current["enabled"] = enabled
            current["default_model"] = default_model.strip()
            config.external_apis[api_name] = current
            setattr(config, f"{api_name}_api_key", api_key)
            self.api_status[api_name] = APIStatus.HEALTHY if enabled else APIStatus.DISABLED
            self.failure_counts[api_name] = 0

        return {name: status.value for name, status in self.api_status.items()}

    async def test_provider(self, provider: str, api_key: str, model: Optional[str] = None) -> Dict[str, Any]:
        if provider not in {item.value for item in APIProvider}:
            raise ValueError(f"不支持的外部API提供方: {provider}")
        if not api_key.strip():
            raise ValueError("API密钥不能为空")

        request_data = self._build_request(provider, "Reply with OK.", "general")
        if model:
            request_data["model"] = model
        return await self._make_api_request(provider, request_data, api_key_override=api_key.strip())
    
    def is_healthy(self) -> bool:
        """检查服务是否健康"""
        return any(status == APIStatus.HEALTHY for status in self.api_status.values())
