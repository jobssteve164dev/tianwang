"""
AI引擎配置文件
"""
import os
from typing import Dict, Any
from pydantic_settings import BaseSettings

class AIEngineConfig(BaseSettings):
    """AI引擎配置类"""
    
    # 应用基础配置
    app_name: str = "tianwang-ai-engine"
    app_version: str = "1.0.0-alpha.1"
    host: str = "0.0.0.0"
    port: int = 8888
    debug: bool = True
    
    # 数据库配置
    influxdb_url: str = "http://localhost:8086"
    influxdb_token: str = "tianwang-super-secret-auth-token"
    influxdb_org: str = "tianwang"
    influxdb_bucket: str = "security_logs"
    
    redis_host: str = "localhost"
    redis_port: int = 6379
    redis_password: str = ""  # 开发环境不使用密码
    redis_db: int = 0
    
    # Kafka配置
    kafka_brokers: str = "localhost:9092"
    kafka_group_id: str = "ai-engine-consumer"
    kafka_topics: Dict[str, str] = {
        "logs": "security-logs-dev",
        "alerts": "security-alerts-dev",
        "actions": "protection-actions-dev"
    }
    
    # AI模型配置 - 重命名以避免与Pydantic受保护命名空间冲突
    ai_model_path: str = "./models"  # 原 model_path
    confidence_threshold: float = 0.8
    batch_size: int = 32
    max_sequence_length: int = 512
    
    # 本地AI模型配置
    models: Dict[str, Dict[str, Any]] = {
        "anomaly_detection": {
            "type": "isolation_forest",
            "contamination": 0.1,
            "n_estimators": 100,
            "random_state": 42
        },
        "malware_detection": {
            "type": "cnn",
            "input_shape": (224, 224, 3),
            "num_classes": 10,
            "epochs": 50
        },
        "network_intrusion": {
            "type": "lstm",
            "sequence_length": 100,
            "hidden_units": 128,
            "dropout": 0.2
        },
        "user_behavior": {
            "type": "clustering",
            "algorithm": "kmeans",
            "n_clusters": 5,
            "random_state": 42
        }
    }
    
    # 外部API配置
    openai_api_key: str = ""
    claude_api_key: str = ""
    gemini_api_key: str = ""
    openrouter_api_key: str = ""
    deepseek_api_key: str = ""

    # API调用配置
    api_timeout: int = 30
    api_retry_count: int = 3
    api_rate_limit: int = 100  # 每小时请求数

    # 外部大模型API详细配置
    external_apis: Dict[str, Dict[str, Any]] = {
        "openai": {
            "enabled": True,
            "base_url": "https://api.openai.com/v1",
            "models": ["gpt-4", "gpt-3.5-turbo"],
            "default_model": "gpt-3.5-turbo",
            "priority": 1,
            "cost_per_token": 0.0000015,  # GPT-3.5-turbo价格
            "max_tokens": 4096,
            "rate_limit": 3500,  # RPM
            "timeout": 30
        },
        "claude": {
            "enabled": True,
            "base_url": "https://api.anthropic.com/v1",
            "models": ["claude-3-haiku", "claude-3-sonnet"],
            "default_model": "claude-3-haiku",
            "priority": 2,
            "cost_per_token": 0.000001,  # Claude-3-haiku价格
            "max_tokens": 4096,
            "rate_limit": 1000,  # RPM
            "timeout": 30
        },
        "openrouter": {
            "enabled": True,
            "base_url": "https://openrouter.ai/api/v1",
            "models": [
                "openai/gpt-4",
                "anthropic/claude-3-haiku",
                "google/gemini-pro",
                "meta-llama/llama-2-70b-chat",
                "mistralai/mixtral-8x7b-instruct"
            ],
            "default_model": "openai/gpt-4",
            "priority": 3,
            "cost_per_token": 0.000002,  # 平均价格
            "max_tokens": 4096,
            "rate_limit": 200,  # RPM
            "timeout": 45
        },
        "deepseek": {
            "enabled": True,
            "base_url": "https://api.deepseek.com/v1",
            "models": ["deepseek-chat", "deepseek-coder"],
            "default_model": "deepseek-chat",
            "priority": 4,
            "cost_per_token": 0.0000005,  # DeepSeek价格优势
            "max_tokens": 4096,
            "rate_limit": 600,  # RPM
            "timeout": 30
        }
    }

    # API负载均衡配置
    load_balancing: Dict[str, Any] = {
        "strategy": "priority_with_fallback",  # priority_with_fallback, round_robin, least_cost
        "health_check_interval": 60,  # 健康检查间隔（秒）
        "failure_threshold": 3,  # 失败阈值
        "recovery_timeout": 300,  # 恢复超时（秒）
        "enable_circuit_breaker": True
    }

    # API成本控制配置
    cost_control: Dict[str, Any] = {
        "daily_budget": 10.0,  # 每日预算（美元）
        "monthly_budget": 300.0,  # 每月预算（美元）
        "cost_alert_threshold": 0.8,  # 预算告警阈值
        "enable_cost_tracking": True,
        "cost_optimization": {
            "prefer_cheaper_models": True,
            "cache_duration": 3600,  # 缓存1小时
            "batch_requests": True
        }
    }

    # API缓存配置
    api_cache: Dict[str, Any] = {
        "enabled": True,
        "backend": "redis",  # redis, memory
        "default_ttl": 3600,  # 默认缓存1小时
        "max_cache_size": "100MB",
        "cache_strategies": {
            "log_analysis": 7200,  # 日志分析缓存2小时
            "threat_detection": 1800,  # 威胁检测缓存30分钟
            "behavior_analysis": 3600  # 行为分析缓存1小时
        }
    }
    
    # 威胁情报配置
    misp_url: str = ""
    misp_api_key: str = ""
    otx_api_key: str = ""
    
    # 开源规则库配置
    rules_config: Dict[str, Dict[str, Any]] = {
        "suricata": {
            "enabled": True,
            "rules_url": "https://rules.emergingthreats.net/open/suricata/rules/",
            "update_interval": 3600  # 1小时
        },
        "yara": {
            "enabled": True,
            "rules_path": "./rules/yara",
            "update_interval": 86400  # 24小时
        },
        "sigma": {
            "enabled": True,
            "rules_path": "./rules/sigma",
            "update_interval": 86400
        },
        "snort": {
            "enabled": True,
            "rules_url": "https://www.snort.org/downloads/community/",
            "update_interval": 3600
        }
    }
    
    # 日志配置
    log_level: str = "DEBUG"
    log_format: str = "{time} | {level} | {name} | {message}"
    log_file: str = "./logs/ai-engine.log"
    log_rotation: str = "1 day"
    log_retention: str = "30 days"
    
    # 性能配置
    max_workers: int = 4
    queue_size: int = 1000
    processing_timeout: int = 300  # 5分钟
    
    class Config:
        env_file = ".env"
        env_prefix = "AI_"
        # 设置受保护的命名空间，避免与我们的字段冲突
        protected_namespaces = ()
        # 禁用受保护命名空间检查，避免与我们的字段冲突
        validate_assignment = True

# 全局配置实例
config = AIEngineConfig()

# 配置验证
def validate_config() -> bool:
    """验证配置的有效性"""
    if not os.path.exists(config.ai_model_path):
        os.makedirs(config.ai_model_path, exist_ok=True)
    
    # 检查必需的API密钥
    api_keys = [
        config.openai_api_key,
        config.claude_api_key,
        config.gemini_api_key
    ]
    
    if not any(api_keys):
        print("警告: 未配置任何外部AI API密钥，将只使用本地模型")
    
    return True 