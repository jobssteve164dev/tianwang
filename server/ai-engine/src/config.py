"""
AI引擎配置文件
"""
import os
from typing import Dict, Any
from pydantic import BaseSettings

class AIEngineConfig(BaseSettings):
    """AI引擎配置类"""
    
    # 应用基础配置
    app_name: str = "tianwang-ai-engine"
    app_version: str = "1.0.0-alpha.1"
    host: str = "0.0.0.0"
    port: int = 8001
    debug: bool = True
    
    # 数据库配置
    influxdb_url: str = "http://localhost:8086"
    influxdb_token: str = "tianwang-super-secret-auth-token"
    influxdb_org: str = "tianwang"
    influxdb_bucket: str = "security_logs"
    
    redis_host: str = "localhost"
    redis_port: int = 6379
    redis_password: str = "tianwang123"
    redis_db: int = 0
    
    # Kafka配置
    kafka_brokers: str = "localhost:9092"
    kafka_group_id: str = "ai-engine-consumer"
    kafka_topics: Dict[str, str] = {
        "logs": "security-logs",
        "alerts": "security-alerts",
        "actions": "protection-actions"
    }
    
    # AI模型配置
    model_path: str = "./models"
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
    
    # API调用配置
    api_timeout: int = 30
    api_retry_count: int = 3
    api_rate_limit: int = 100  # 每小时请求数
    
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

# 全局配置实例
config = AIEngineConfig()

# 配置验证
def validate_config() -> bool:
    """验证配置的有效性"""
    if not os.path.exists(config.model_path):
        os.makedirs(config.model_path, exist_ok=True)
    
    # 检查必需的API密钥
    api_keys = [
        config.openai_api_key,
        config.claude_api_key,
        config.gemini_api_key
    ]
    
    if not any(api_keys):
        print("警告: 未配置任何外部AI API密钥，将只使用本地模型")
    
    return True 