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
from ..rules.otx_manager import OtxManager

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
        # 创建MISP配置字典
        misp_config = {
            "url": config.misp_url,
            "api_key": config.misp_api_key
        }
        self.misp_manager = MispManager(misp_config)
        
        # 创建OTX配置字典
        otx_config = {
            "otx_api_key": config.otx_api_key
        }
        self.otx_manager = OtxManager(otx_config)

    def configure_threat_intelligence(self, misp: Dict[str, Any], otx: Dict[str, Any]) -> Dict[str, str]:
        """原子替换运行中的威胁情报管理器，保证管理端保存后新配置立即用于后续匹配。"""
        misp_enabled = bool(misp.get("enabled", False))
        otx_enabled = bool(otx.get("enabled", False))
        misp_url = str(misp.get("url", "")).rstrip("/") if misp_enabled else ""
        misp_api_key = str(misp.get("api_key", "")) if misp_enabled else ""
        otx_api_key = str(otx.get("api_key", "")) if otx_enabled else ""

        if misp_enabled and (not misp_url or not misp_api_key):
            raise ValueError("MISP启用时必须提供服务器地址和API密钥")
        if otx_enabled and not otx_api_key:
            raise ValueError("OTX启用时必须提供API密钥")

        config.misp_url = misp_url
        config.misp_api_key = misp_api_key
        config.otx_api_key = otx_api_key
        self.misp_manager = MispManager({"misp_url": misp_url, "misp_api_key": misp_api_key})
        self.otx_manager = OtxManager({"otx_api_key": otx_api_key})
        return {
            "misp": "configured" if misp_enabled else "disabled",
            "otx": "configured" if otx_enabled else "disabled"
        }
    
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
            
            # 加载威胁情报（可选，失败不影响启动）
            threat_intel_tasks = []
            
            # 尝试加载MISP威胁情报
            if config.misp_configured:
                threat_intel_tasks.append(self.misp_manager.fetch_threat_intelligence())
            else:
                logger.warning("MISP配置不完整，跳过MISP威胁情报加载")
            
            # 尝试加载OTX威胁情报
            if config.otx_api_key:
                threat_intel_tasks.append(self.otx_manager.fetch_threat_intelligence())
            else:
                logger.warning("OTX API密钥未配置，跳过OTX威胁情报加载")
            
            # 如果没有配置任何威胁情报源，添加空任务
            if not threat_intel_tasks:
                threat_intel_tasks.append(asyncio.sleep(0))
            
            tasks.extend(threat_intel_tasks)
            
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
            
            # 威胁情报检查（可选）
            threat_intel_tasks = []
            
            # MISP威胁情报检查
            if config.misp_configured:
                threat_intel_tasks.append(self._check_misp_intelligence(data))
            
            # OTX威胁情报检查
            if config.otx_api_key:
                threat_intel_tasks.append(self._check_otx_intelligence(data))
            
            # 如果没有配置任何威胁情报源，添加空任务
            if not threat_intel_tasks:
                threat_intel_tasks.append(asyncio.sleep(0))
            
            tasks.extend(threat_intel_tasks)
            
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
    
    async def _check_misp_intelligence(self, data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """检查MISP威胁情报"""
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
            logger.error(f"MISP威胁情报检查失败: {e}")
        
        return matches
    
    async def _check_otx_intelligence(self, data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """检查OTX威胁情报"""
        matches = []
        
        try:
            # 检查网络数据中的IOC
            if "network" in data:
                network_data = data["network"]
                for field in ["src_ip", "dst_ip", "domain", "url"]:
                    if field in network_data:
                        ioc_matches = await self.otx_manager.check_ioc(str(network_data[field]), field)
                        matches.extend(ioc_matches)
            
            # 检查文件数据中的IOC
            if "file" in data:
                file_data = data["file"]
                for field in ["md5", "sha1", "sha256", "filename"]:
                    if field in file_data:
                        ioc_matches = await self.otx_manager.check_ioc(str(file_data[field]), field)
                        matches.extend(ioc_matches)
            
            # 检查其他可能的IOC字段
            for field in ["ip", "domain", "url", "hash", "md5", "sha1", "sha256"]:
                if field in data:
                    ioc_matches = await self.otx_manager.check_ioc(str(data[field]), field)
                    matches.extend(ioc_matches)
            
        except Exception as e:
            logger.error(f"OTX威胁情报检查失败: {e}")
        
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
            otx_stats = self.otx_manager.get_statistics() if hasattr(self, 'otx_manager') else {}
            
            return {
                "service_status": "healthy" if self.is_healthy() else "unhealthy",
                "total_rules": self.metrics["rules_loaded"],
                "suricata_rules": suricata_stats,
                "sigma_rules": sigma_stats,
                "yara_rules": yara_stats,
                "misp_intelligence": misp_stats,
                "otx_intelligence": otx_stats,
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
            if config.misp_configured:
                tasks.append(self.misp_manager.update_threat_intelligence())
            if config.otx_api_key:
                tasks.append(self.otx_manager.update_threat_intelligence())
            
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

    async def reload_custom_rules(self) -> int:
        """Reload local Sigma rules after a governed custom-rule change."""
        if not self.is_initialized:
            raise RuntimeError("规则引擎未初始化")

        sigma_count = await self.sigma_manager.load_rules(allow_download=False)
        total_rules = sigma_count
        total_rules += len(self.suricata_manager.rules)
        total_rules += len(self.yara_manager.rules)
        self.metrics["rules_loaded"] = total_rules
        self.metrics["last_update_time"] = datetime.now().isoformat()
        return sigma_count
    
    async def cleanup(self):
        """清理资源"""
        try:
            logger.info("正在清理规则引擎资源...")
            self.is_initialized = False
            logger.info("规则引擎资源清理完成")
        except Exception as e:
            logger.error(f"规则引擎清理失败: {e}")
            raise
