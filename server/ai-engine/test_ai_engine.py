#!/usr/bin/env python3
"""
AI引擎测试脚本
验证AI分析引擎的基本功能
"""
import asyncio
import json
from datetime import datetime
import sys
import os

# 添加项目路径
sys.path.append(os.path.join(os.path.dirname(__file__), 'src'))

from src.config import config
from src.services.ai_service import AIService
from src.services.rule_engine import RuleEngine
from src.utils.feature_extractor import FeatureExtractor
from src.utils.data_processor import DataProcessor

async def test_ai_service():
    """测试AI服务"""
    print("=== 测试AI服务 ===")
    
    ai_service = AIService()
    await ai_service.initialize()
    
    # 测试数据
    test_data = {
        "timestamp": datetime.now().isoformat(),
        "system": {
            "cpu_usage": 85.5,
            "memory_usage": 78.2,
            "disk_usage": 65.0
        },
        "processes": [
            {
                "name": "chrome.exe",
                "cpu_percent": 15.2,
                "memory_percent": 12.5,
                "username": "user"
            },
            {
                "name": "suspicious_process.exe",
                "cpu_percent": 25.0,
                "memory_percent": 8.0,
                "username": "SYSTEM"
            }
        ],
        "network": {
            "bytes_sent": 1024000,
            "bytes_recv": 2048000,
            "packets_sent": 500,
            "packets_recv": 800,
            "connections": [
                {"status": "ESTABLISHED", "local_port": 80, "remote_port": 443}
            ]
        }
    }
    
    # 测试异常检测
    print("测试异常检测...")
    anomaly_result = await ai_service.detect_anomaly(test_data)
    print(f"异常检测结果: {json.dumps(anomaly_result, indent=2, ensure_ascii=False)}")
    
    # 测试恶意软件检测
    print("\n测试恶意软件检测...")
    malware_result = await ai_service.detect_malware(test_data)
    print(f"恶意软件检测结果: {json.dumps(malware_result, indent=2, ensure_ascii=False)}")
    
    # 测试网络入侵检测
    print("\n测试网络入侵检测...")
    network_result = await ai_service.detect_network_intrusion(test_data)
    print(f"网络入侵检测结果: {json.dumps(network_result, indent=2, ensure_ascii=False)}")
    
    # 测试用户行为分析
    print("\n测试用户行为分析...")
    behavior_result = await ai_service.analyze_user_behavior(test_data)
    print(f"用户行为分析结果: {json.dumps(behavior_result, indent=2, ensure_ascii=False)}")
    
    # 获取服务指标
    print("\n获取AI服务指标...")
    metrics = ai_service.get_metrics()
    print(f"服务指标: {json.dumps(metrics, indent=2, ensure_ascii=False)}")
    
    await ai_service.cleanup()
    print("AI服务测试完成")

async def test_rule_engine():
    """测试规则引擎"""
    print("\n=== 测试规则引擎 ===")
    
    rule_engine = RuleEngine()
    await rule_engine.initialize()
    
    # 测试数据
    test_data = {
        "timestamp": datetime.now().isoformat(),
        "EventID": 1,
        "Image": "C:\\Windows\\System32\\cmd.exe",
        "CommandLine": "cmd.exe /c malware.exe",
        "network": {
            "protocol": "tcp",
            "src_ip": "192.168.1.100",
            "dst_ip": "10.0.0.1",
            "src_port": 12345,
            "dst_port": 443
        },
        "file": {
            "name": "suspicious.exe",
            "size": 1024000,
            "extension": ".exe"
        }
    }
    
    # 测试规则匹配
    print("测试规则匹配...")
    matches = await rule_engine.match_rules(test_data)
    print(f"规则匹配结果: {json.dumps(matches, indent=2, ensure_ascii=False)}")
    
    # 获取规则引擎指标
    print("\n获取规则引擎指标...")
    metrics = rule_engine.get_metrics()
    print(f"规则引擎指标: {json.dumps(metrics, indent=2, ensure_ascii=False)}")
    
    await rule_engine.cleanup()
    print("规则引擎测试完成")

async def test_feature_extractor():
    """测试特征提取器"""
    print("\n=== 测试特征提取器 ===")
    
    feature_extractor = FeatureExtractor()
    
    # 测试数据
    test_data = {
        "timestamp": datetime.now().isoformat(),
        "system": {
            "cpu_usage": 75.0,
            "memory_usage": 60.0,
            "disk_usage": 80.0
        },
        "processes": [
            {"name": "chrome.exe", "cpu_percent": 10.0, "memory_percent": 5.0},
            {"name": "notepad.exe", "cpu_percent": 2.0, "memory_percent": 1.0}
        ],
        "network": {
            "bytes_sent": 500000,
            "bytes_recv": 1000000,
            "connections": [{"status": "ESTABLISHED"}]
        }
    }
    
    # 测试各种特征提取
    print("提取异常检测特征...")
    anomaly_features = await feature_extractor.extract_anomaly_features(test_data)
    print(f"异常检测特征数量: {len(anomaly_features)}")
    print(f"前10个特征: {anomaly_features[:10]}")
    
    print("\n提取恶意软件检测特征...")
    malware_features = await feature_extractor.extract_malware_features(test_data)
    print(f"恶意软件检测特征数量: {len(malware_features)}")
    print(f"前10个特征: {malware_features[:10]}")
    
    print("\n提取网络入侵检测特征...")
    network_features = await feature_extractor.extract_network_features(test_data)
    print(f"网络入侵检测特征数量: {len(network_features)}")
    print(f"前10个特征: {network_features[:10]}")
    
    print("\n提取用户行为分析特征...")
    behavior_features = await feature_extractor.extract_behavior_features(test_data)
    print(f"用户行为分析特征数量: {len(behavior_features)}")
    print(f"前10个特征: {behavior_features[:10]}")
    
    print("特征提取器测试完成")

async def test_data_processor():
    """测试数据处理器"""
    print("\n=== 测试数据处理器 ===")
    
    data_processor = DataProcessor()
    
    # 测试实时数据预处理
    test_data = {
        "cpu_usage": "85.5",  # 字符串格式
        "memory_usage": None,  # 空值
        "disk_usage": 65.0,
        "timestamp": datetime.now().isoformat(),
        "processes": []
    }
    
    print("测试实时数据预处理...")
    processed_data = data_processor.preprocess_real_time_data(test_data)
    print(f"预处理结果: {json.dumps(processed_data, indent=2, ensure_ascii=False)}")
    
    # 测试训练数据处理
    training_data = [
        {
            "cpu_usage": 80.0,
            "memory_usage": 70.0,
            "disk_usage": 60.0,
            "network_activity": 100,
            "processes": ["chrome.exe", "notepad.exe"],
            "connections": [{"status": "ESTABLISHED"}]
        },
        {
            "cpu_usage": 45.0,
            "memory_usage": 30.0,
            "disk_usage": 40.0,
            "network_activity": 50,
            "processes": ["explorer.exe"],
            "connections": []
        }
    ]
    
    print("\n测试异常检测训练数据处理...")
    processed_training = await data_processor.process_training_data(training_data, "anomaly_detection")
    print(f"训练数据形状: {processed_training['features'].shape}")
    print(f"标签: {processed_training['labels']}")
    
    print("数据处理器测试完成")

async def main():
    """主测试函数"""
    print("开始AI引擎功能测试")
    print(f"配置信息: {config.app_name} v{config.app_version}")
    print(f"模型路径: {config.model_path}")
    print("-" * 50)
    
    try:
        # 测试各个组件
        await test_feature_extractor()
        await test_data_processor()
        await test_ai_service()
        await test_rule_engine()
        
        print("\n" + "=" * 50)
        print("所有测试完成！AI引擎功能正常")
        
    except Exception as e:
        print(f"\n测试失败: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    return 0

if __name__ == "__main__":
    exit_code = asyncio.run(main()) 