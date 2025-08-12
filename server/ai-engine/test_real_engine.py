#!/usr/bin/env python3
"""
AI引擎真实功能测试脚本
测试所有规则管理器的真实功能
"""
import asyncio
import sys
import os
from pathlib import Path

# 添加项目根目录到Python路径
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

from src.rules.yara_manager import YaraRuleManager
from src.rules.suricata_manager import SuricataRuleManager
from src.rules.sigma_manager import SigmaRuleManager
from src.rules.misp_manager import MispManager
from src.config import config
from loguru import logger

async def test_yara_manager():
    """测试YARA规则管理器"""
    print("\n=== 测试YARA规则管理器 ===")
    try:
        yara_manager = YaraRuleManager()
        
        # 测试加载规则
        rules_count = await yara_manager.load_rules()
        print(f"✓ YARA规则加载成功: {rules_count} 条规则")
        
        # 测试规则匹配
        test_data = {
            "content": "cmd.exe /c powershell.exe -c \"Invoke-WebRequest\"",
            "filename": "malware.exe",
            "file_size": 1024
        }
        
        matches = await yara_manager.match_rule(test_data)
        print(f"✓ YARA规则匹配测试: 找到 {len(matches)} 个匹配")
        
        # 获取统计信息
        stats = yara_manager.get_statistics()
        print(f"✓ YARA统计信息: {stats['total_rules']} 条规则")
        
        return True
        
    except Exception as e:
        print(f"✗ YARA规则管理器测试失败: {e}")
        return False

async def test_suricata_manager():
    """测试Suricata规则管理器"""
    print("\n=== 测试Suricata规则管理器 ===")
    try:
        suricata_manager = SuricataRuleManager()
        
        # 测试加载规则
        rules_count = await suricata_manager.load_rules()
        print(f"✓ Suricata规则加载成功: {rules_count} 条规则")
        
        # 测试规则匹配
        test_data = {
            "protocol": "tcp",
            "src_ip": "192.168.1.100",
            "src_port": 12345,
            "dst_ip": "10.0.0.1",
            "dst_port": 80,
            "payload": "GET /admin HTTP/1.1"
        }
        
        matches = await suricata_manager.match_rule(test_data)
        print(f"✓ Suricata规则匹配测试: 找到 {len(matches)} 个匹配")
        
        # 获取统计信息
        stats = suricata_manager.get_statistics()
        print(f"✓ Suricata统计信息: {stats['total_rules']} 条规则")
        
        return True
        
    except Exception as e:
        print(f"✗ Suricata规则管理器测试失败: {e}")
        return False

async def test_sigma_manager():
    """测试Sigma规则管理器"""
    print("\n=== 测试Sigma规则管理器 ===")
    try:
        sigma_manager = SigmaRuleManager()
        
        # 测试加载规则
        rules_count = await sigma_manager.load_rules()
        print(f"✓ Sigma规则加载成功: {rules_count} 条规则")
        
        # 测试规则匹配
        test_data = {
            "EventID": 4688,
            "CommandLine": "cmd.exe /c powershell.exe -c \"Invoke-WebRequest\"",
            "ProcessName": "cmd.exe",
            "ParentProcessName": "explorer.exe"
        }
        
        matches = await sigma_manager.match_rule(test_data)
        print(f"✓ Sigma规则匹配测试: 找到 {len(matches)} 个匹配")
        
        # 获取统计信息
        stats = sigma_manager.get_statistics()
        print(f"✓ Sigma统计信息: {stats['total_rules']} 条规则")
        
        return True
        
    except Exception as e:
        print(f"✗ Sigma规则管理器测试失败: {e}")
        return False

async def test_misp_manager():
    """测试MISP威胁情报管理器"""
    print("\n=== 测试MISP威胁情报管理器 ===")
    try:
        # 使用配置中的MISP设置
        misp_config = config.misp_config
        misp_manager = MispManager(misp_config)
        
        # 测试配置验证
        is_configured = misp_manager._is_config_valid()
        print(f"✓ MISP配置验证: {'已配置' if is_configured else '未配置'}")
        
        if is_configured:
            # 测试连接
            is_connected = await misp_manager._test_misp_connection()
            print(f"✓ MISP连接测试: {'成功' if is_connected else '失败'}")
            
            if is_connected:
                # 测试获取威胁情报
                success = await misp_manager.fetch_threat_intelligence(days=1)
                print(f"✓ MISP威胁情报获取: {'成功' if success else '失败'}")
                
                if success:
                    # 测试IOC检查
                    test_ioc = "192.168.100.100"
                    matches = await misp_manager.check_ioc(test_ioc, "ip")
                    print(f"✓ MISP IOC检查测试: 找到 {len(matches)} 个匹配")
        
        # 获取健康状态
        health = misp_manager.get_health_status()
        print(f"✓ MISP健康状态: {health['ioc_count']} 个IOC")
        
        return True
        
    except Exception as e:
        print(f"✗ MISP威胁情报管理器测试失败: {e}")
        return False

async def test_rule_engine():
    """测试规则引擎集成"""
    print("\n=== 测试规则引擎集成 ===")
    try:
        from src.services.rule_engine import RuleEngine
        
        rule_engine = RuleEngine()
        
        # 测试初始化
        await rule_engine.initialize()
        print("✓ 规则引擎初始化成功")
        
        # 测试规则匹配
        test_data = {
            "network": {
                "protocol": "tcp",
                "src_ip": "192.168.1.100",
                "dst_ip": "10.0.0.1",
                "dst_port": 80,
                "payload": "GET /admin HTTP/1.1"
            },
            "file": {
                "filename": "malware.exe",
                "content": "cmd.exe /c powershell.exe",
                "hash": "d41d8cd98f00b204e9800998ecf8427e"
            },
            "log": {
                "EventID": 4688,
                "CommandLine": "cmd.exe /c powershell.exe -c \"Invoke-WebRequest\""
            }
        }
        
        matches = await rule_engine.match_rules(test_data)
        print(f"✓ 规则引擎匹配测试: 找到 {len(matches)} 个威胁")
        
        # 获取指标
        metrics = rule_engine.metrics
        print(f"✓ 规则引擎指标: {metrics['rules_loaded']} 条规则已加载")
        
        return True
        
    except Exception as e:
        print(f"✗ 规则引擎集成测试失败: {e}")
        return False

async def main():
    """主测试函数"""
    print("开始AI引擎真实功能测试...")
    print("=" * 50)
    
    # 配置日志
    logger.remove()
    logger.add(sys.stderr, level="INFO")
    
    test_results = []
    
    # 测试各个规则管理器
    test_results.append(await test_yara_manager())
    test_results.append(await test_suricata_manager())
    test_results.append(await test_sigma_manager())
    test_results.append(await test_misp_manager())
    test_results.append(await test_rule_engine())
    
    # 输出测试结果
    print("\n" + "=" * 50)
    print("测试结果汇总:")
    print("=" * 50)
    
    test_names = [
        "YARA规则管理器",
        "Suricata规则管理器", 
        "Sigma规则管理器",
        "MISP威胁情报管理器",
        "规则引擎集成"
    ]
    
    for i, (name, result) in enumerate(zip(test_names, test_results)):
        status = "✓ 通过" if result else "✗ 失败"
        print(f"{i+1}. {name}: {status}")
    
    passed = sum(test_results)
    total = len(test_results)
    
    print(f"\n总体结果: {passed}/{total} 项测试通过")
    
    if passed == total:
        print("🎉 所有测试通过！AI引擎真实功能正常。")
        return 0
    else:
        print("⚠️  部分测试失败，请检查相关配置和实现。")
        return 1

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
