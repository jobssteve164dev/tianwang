"""
规则引擎服务 (重构版)
集成开源安全规则库，提供基于规则的威胁检测
"""
import asyncio
from typing import Dict, List, Any
from loguru import logger
from datetime import datetime

from ..config import config
from ..rules.suricata_manager import SuricataRuleManager
from ..rules.sigma_manager import SigmaRuleManager
from ..rules.yara_manager import YaraRuleManager
from ..rules.misp_manager import MispManager

class RuleEngine:
    """规则引擎"""
    
    def __init__(self):
        self.is_initialized = False
        self.metrics = {
            "rules_loaded": 0,
            "matches_found": 0,
            "false_positives": 0,
            "last_update_time": None
        }
        
        # 初始化规则管理器
        self.suricata_manager = SuricataRuleManager()
        self.sigma_manager = SigmaRuleManager()
        self.yara_manager = YaraRuleManager()
        self.misp_manager = MispManager(config.threatIntelligence.get("misp", {}))
    
    async def initialize(self):
        """初始化规则引擎"""
        try:
            logger.info("正在初始化规则引擎...")
            
            # 初始化各个规则管理器
            tasks = []
            
            # 加载Suricata规则
            if config.rules_config.get("suricata", {}).get("enabled", False):
                tasks.append(self.suricata_manager.load_rules())
            
            # 加载Sigma规则
            if config.rules_config.get("sigma", {}).get("enabled", False):
                tasks.append(self.sigma_manager.load_rules())
            
            # 加载YARA规则
            if config.rules_config.get("yara", {}).get("enabled", False):
                tasks.append(self.yara_manager.load_rules())
            
            # 加载威胁情报
            tasks.append(self.misp_manager.fetch_threat_intelligence())
            
            # 并行执行所有初始化任务
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # 统计加载的规则数量
            total_rules = 0
            for i, result in enumerate(results):
                if isinstance(result, int):
                    total_rules += result
                elif isinstance(result, Exception):
                    logger.error(f"规则加载失败: {result}")
            
            self.metrics["rules_loaded"] = total_rules
            self.is_initialized = True
            
            logger.info(f"规则引擎初始化完成，共加载 {total_rules} 条规则")
            
        except Exception as e:
            logger.error(f"规则引擎初始化失败: {e}")
            raise
    
    async def match_rules(self, data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """匹配规则"""
        matches = []
        
        try:
            # 并行执行所有规则匹配
            tasks = []
            
            # Sigma规则匹配
            if config.rules_config.get("sigma", {}).get("enabled", False):
                tasks.append(self.sigma_manager.match_rule(data))
            
            # YARA规则匹配
            if config.rules_config.get("yara", {}).get("enabled", False):
                tasks.append(self.yara_manager.match_rule(data))
            
            # Suricata规则匹配
            if config.rules_config.get("suricata", {}).get("enabled", False):
                network_data = data.get("network", data)
                tasks.append(self.suricata_manager.match_rule(network_data))
            
            # MISP威胁情报检查
            tasks.append(self._check_threat_intelligence(data))
            
            # 执行所有匹配任务
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # 收集所有匹配结果
            for result in results:
                if isinstance(result, list):
                    matches.extend(result)
                elif isinstance(result, Exception):
                    logger.error(f"规则匹配异常: {result}")
            
            self.metrics["matches_found"] += len(matches)
            
            if matches:
                logger.info(f"规则匹配找到 {len(matches)} 个威胁")
            
            return matches
            
        except Exception as e:
            logger.error(f"规则匹配失败: {e}")
            return []
    
    async def _check_threat_intelligence(self, data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """检查威胁情报"""
        matches = []
        
        try:
            # 检查网络数据中的IOC
            if "network" in data:
                network_matches = await self.misp_manager.check_network_data(data["network"])
                matches.extend(network_matches)
            
            # 检查文件数据中的IOC
            if "file" in data:
                file_matches = await self.misp_manager.check_file_data(data["file"])
                matches.extend(file_matches)
            
            # 检查其他可能的IOC字段
            for field in ["ip", "domain", "url", "hash", "md5", "sha1", "sha256"]:
                if field in data:
                    ioc_matches = await self.misp_manager.check_ioc(str(data[field]))
                    matches.extend(ioc_matches)
            
        except Exception as e:
            logger.error(f"威胁情报检查失败: {e}")
        
        return matches
    
    def is_healthy(self) -> bool:
        """检查服务健康状态"""
        return self.is_initialized
    
    def get_metrics(self) -> Dict[str, Any]:
        """获取服务指标"""
        try:
            # 获取各个管理器的统计信息
            suricata_stats = self.suricata_manager.get_statistics() if hasattr(self, 'suricata_manager') else {}
            sigma_stats = self.sigma_manager.get_statistics() if hasattr(self, 'sigma_manager') else {}
            yara_stats = self.yara_manager.get_statistics() if hasattr(self, 'yara_manager') else {}
            misp_stats = self.misp_manager.get_statistics() if hasattr(self, 'misp_manager') else {}
            
            return {
                "service_status": "healthy" if self.is_healthy() else "unhealthy",
                "total_rules": self.metrics["rules_loaded"],
                "suricata_rules": suricata_stats,
                "sigma_rules": sigma_stats,
                "yara_rules": yara_stats,
                "threat_intelligence": misp_stats,
                "metrics": self.metrics,
                "timestamp": datetime.now().isoformat()
            }
        except Exception as e:
            logger.error(f"获取规则引擎指标失败: {e}")
            return {
                "service_status": "unhealthy",
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }
    
    async def update_rules(self) -> bool:
        """更新所有规则库"""
        try:
            logger.info("开始更新所有规则库...")
            
            # 并行更新所有规则库
            tasks = []
            
            if config.rules_config.get("suricata", {}).get("enabled", False):
                tasks.append(self.suricata_manager.update_rules())
            
            if config.rules_config.get("sigma", {}).get("enabled", False):
                tasks.append(self.sigma_manager.update_rules())
            
            if config.rules_config.get("yara", {}).get("enabled", False):
                tasks.append(self.yara_manager.update_rules())
            
            # 更新威胁情报
            tasks.append(self.misp_manager.update_threat_intelligence())
            
            # 执行所有更新任务
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # 检查更新结果
            success_count = 0
            for result in results:
                if result is True:
                    success_count += 1
                elif isinstance(result, Exception):
                    logger.error(f"规则更新失败: {result}")
            
            # 更新指标
            total_rules = 0
            if hasattr(self, 'suricata_manager'):
                total_rules += len(self.suricata_manager.rules)
            if hasattr(self, 'sigma_manager'):
                total_rules += len(self.sigma_manager.rules)
            if hasattr(self, 'yara_manager'):
                total_rules += len(self.yara_manager.rules)
            
            self.metrics["rules_loaded"] = total_rules
            self.metrics["last_update_time"] = datetime.now().isoformat()
            
            logger.info(f"规则库更新完成，成功更新 {success_count}/{len(tasks)} 个规则源")
            return success_count > 0
            
        except Exception as e:
            logger.error(f"更新规则库失败: {e}")
            return False
    
    async def cleanup(self):
        """清理资源"""
        try:
            logger.info("正在清理规则引擎资源...")
            self.is_initialized = False
            logger.info("规则引擎资源清理完成")
        except Exception as e:
            logger.error(f"规则引擎清理失败: {e}")
            raise 