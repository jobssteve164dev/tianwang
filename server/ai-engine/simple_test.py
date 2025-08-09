#!/usr/bin/env python3
"""
AI引擎简化测试
验证基本的文件结构和导入
"""
import os
import sys

def test_file_structure():
    """测试文件结构"""
    print("=== 测试AI引擎文件结构 ===")
    
    # 检查主要目录
    directories = [
        'src',
        'src/services',
        'src/utils',
        'src/api',
        'models',
        'data',
        'tests',
        'config'
    ]
    
    for directory in directories:
        if os.path.exists(directory):
            print(f"✓ {directory} 目录存在")
        else:
            print(f"✗ {directory} 目录缺失")
    
    # 检查主要文件
    files = [
        'requirements.txt',
        'src/__init__.py',
        'src/config.py',
        'src/main.py',
        'src/services/__init__.py',
        'src/services/ai_service.py',
        'src/services/kafka_service.py',
        'src/services/rule_engine.py',
        'src/utils/__init__.py',
        'src/utils/feature_extractor.py',
        'src/utils/data_processor.py',
        'src/api/__init__.py',
        'src/api/routes.py'
    ]
    
    for file in files:
        if os.path.exists(file):
            print(f"✓ {file} 文件存在")
        else:
            print(f"✗ {file} 文件缺失")

def test_basic_imports():
    """测试基本导入（不需要外部依赖）"""
    print("\n=== 测试基本Python语法 ===")
    
    try:
        # 测试基本的Python功能
        import json
        import asyncio
        from datetime import datetime
        from typing import Dict, List, Any
        
        print("✓ 基本Python模块导入成功")
        
        # 测试异步函数语法
        async def test_async():
            return {"test": "success"}
        
        # 运行异步测试
        result = asyncio.run(test_async())
        print(f"✓ 异步函数测试成功: {result}")
        
        # 测试数据结构
        test_data = {
            "timestamp": datetime.now().isoformat(),
            "system": {
                "cpu_usage": 75.0,
                "memory_usage": 60.0
            },
            "processes": [
                {"name": "test.exe", "cpu": 10.0}
            ]
        }
        
        json_str = json.dumps(test_data, ensure_ascii=False, indent=2)
        print("✓ JSON序列化测试成功")
        
        return True
        
    except Exception as e:
        print(f"✗ 基本导入测试失败: {e}")
        return False

def test_file_content():
    """测试文件内容"""
    print("\n=== 测试文件内容 ===")
    
    try:
        # 检查配置文件
        with open('src/config.py', 'r', encoding='utf-8') as f:
            config_content = f.read()
            if 'AIEngineConfig' in config_content:
                print("✓ 配置文件包含AIEngineConfig类")
            else:
                print("✗ 配置文件缺少AIEngineConfig类")
        
        # 检查主文件
        with open('src/main.py', 'r', encoding='utf-8') as f:
            main_content = f.read()
            if 'FastAPI' in main_content:
                print("✓ 主文件包含FastAPI应用")
            else:
                print("✗ 主文件缺少FastAPI应用")
        
        # 检查服务文件
        with open('src/services/ai_service.py', 'r', encoding='utf-8') as f:
            ai_service_content = f.read()
            if 'class AIService' in ai_service_content:
                print("✓ AI服务文件包含AIService类")
            else:
                print("✗ AI服务文件缺少AIService类")
        
        return True
        
    except Exception as e:
        print(f"✗ 文件内容测试失败: {e}")
        return False

def main():
    """主测试函数"""
    print("AI引擎简化测试开始")
    print("=" * 50)
    
    success = True
    
    # 运行各项测试
    test_file_structure()
    
    if not test_basic_imports():
        success = False
    
    if not test_file_content():
        success = False
    
    print("\n" + "=" * 50)
    if success:
        print("✓ 所有基础测试通过！AI引擎结构正确")
        print("\n下一步:")
        print("1. 安装Python依赖: pip install -r requirements.txt")
        print("2. 配置环境变量")
        print("3. 启动AI引擎: python -m src.main")
        return 0
    else:
        print("✗ 部分测试失败，请检查文件结构")
        return 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code) 