"""
规则引擎服务
集成开源安全规则库，提供基于规则的威胁检测
"""
import os
import re
import json
import asyncio
import aiohttp
from typing import Dict, List, Any, Optional
from loguru import logger
from datetime import datetime, timedelta
import yaml

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
    
    async def _load_local_rules(self):
        """加载本地规则文件"""
        try:
            total_rules = 0
            
            for rule_type in self.rules.keys():
                rule_path = os.path.join(self.rules_dir, rule_type)
                if os.path.exists(rule_path):
                    rules = await self._load_rules_from_directory(rule_path, rule_type)
                    self.rules[rule_type] = rules
                    total_rules += len(rules)
                    logger.info(f"已加载 {len(rules)} 条 {rule_type} 规则")
            
            self.metrics["rules_loaded"] = total_rules
            
        except Exception as e:
            logger.error(f"加载本地规则失败: {e}")
            raise
    
    async def _load_rules_from_directory(self, directory: str, rule_type: str) -> List[Dict[str, Any]]:
        """从目录加载规则"""
        rules = []
        
        try:
            for filename in os.listdir(directory):
                file_path = os.path.join(directory, filename)
                if os.path.isfile(file_path):
                    if rule_type == "sigma" and filename.endswith('.yml'):
                        rule = await self._parse_sigma_rule(file_path)
                        if rule:
                            rules.append(rule)
                    elif rule_type == "yara" and filename.endswith('.yar'):
                        rule = await self._parse_yara_rule(file_path)
                        if rule:
                            rules.append(rule)
                    elif rule_type in ["suricata", "snort"] and filename.endswith('.rules'):
                        file_rules = await self._parse_suricata_snort_rules(file_path, rule_type)
                        rules.extend(file_rules)
                        
        except Exception as e:
            logger.error(f"从目录 {directory} 加载规则失败: {e}")
        
        return rules
    
    async def _parse_sigma_rule(self, file_path: str) -> Optional[Dict[str, Any]]:
        """解析Sigma规则"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                rule_data = yaml.safe_load(f)
            
            return {
                "id": rule_data.get("id", "unknown"),
                "title": rule_data.get("title", ""),
                "description": rule_data.get("description", ""),
                "level": rule_data.get("level", "medium"),
                "detection": rule_data.get("detection", {}),
                "tags": rule_data.get("tags", []),
                "file_path": file_path,
                "type": "sigma"
            }
            
        except Exception as e:
            logger.warning(f"解析Sigma规则失败 {file_path}: {e}")
            return None
    
    async def _parse_yara_rule(self, file_path: str) -> Optional[Dict[str, Any]]:
        """解析YARA规则"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # 简单解析YARA规则（实际应该使用yara-python库）
            rule_name_match = re.search(r'rule\s+(\w+)', content)
            rule_name = rule_name_match.group(1) if rule_name_match else "unknown"
            
            return {
                "name": rule_name,
                "content": content,
                "file_path": file_path,
                "type": "yara"
            }
            
        except Exception as e:
            logger.warning(f"解析YARA规则失败 {file_path}: {e}")
            return None
    
    async def _parse_suricata_snort_rules(self, file_path: str, rule_type: str) -> List[Dict[str, Any]]:
        """解析Suricata/Snort规则"""
        rules = []
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                lines = f.readlines()
            
            for line_num, line in enumerate(lines, 1):
                line = line.strip()
                if line and not line.startswith('#'):
                    rule = self._parse_suricata_snort_rule_line(line, rule_type, file_path, line_num)
                    if rule:
                        rules.append(rule)
                        
        except Exception as e:
            logger.warning(f"解析 {rule_type} 规则文件失败 {file_path}: {e}")
        
        return rules
    
    def _parse_suricata_snort_rule_line(self, line: str, rule_type: str, file_path: str, line_num: int) -> Optional[Dict[str, Any]]:
        """解析单条Suricata/Snort规则"""
        try:
            # 基本规则格式解析
            parts = line.split(' ', 7)
            if len(parts) < 8:
                return None
            
            action, protocol, src_ip, src_port, direction, dst_ip, dst_port, rule_options = parts
            
            # 提取规则选项
            options = {}
            if rule_options.startswith('(') and rule_options.endswith(')'):
                options_str = rule_options[1:-1]
                for option in options_str.split(';'):
                    if ':' in option:
                        key, value = option.split(':', 1)
                        options[key.strip()] = value.strip().strip('"')
            
            return {
                "action": action,
                "protocol": protocol,
                "src_ip": src_ip,
                "src_port": src_port,
                "direction": direction,
                "dst_ip": dst_ip,
                "dst_port": dst_port,
                "options": options,
                "raw_rule": line,
                "file_path": file_path,
                "line_number": line_num,
                "type": rule_type
            }
            
        except Exception as e:
            logger.debug(f"解析规则行失败: {e}")
            return None
    
    async def _update_rules(self):
        """更新规则库"""
        try:
            logger.info("开始更新规则库...")
            
            for rule_type, rule_config in config.rules_config.items():
                if not rule_config.get("enabled", False):
                    continue
                
                last_update = self.last_update.get(rule_type, datetime.min)
                update_interval = timedelta(seconds=rule_config.get("update_interval", 86400))
                
                if datetime.now() - last_update > update_interval:
                    await self._update_rule_type(rule_type, rule_config)
                    self.last_update[rule_type] = datetime.now()
            
            self.metrics["last_update_time"] = datetime.now().isoformat()
            logger.info("规则库更新完成")
            
        except Exception as e:
            logger.error(f"更新规则库失败: {e}")
    
    async def _update_rule_type(self, rule_type: str, rule_config: Dict[str, Any]):
        """更新特定类型的规则"""
        try:
            logger.info(f"正在更新 {rule_type} 规则...")
            
            if rule_type in ["suricata", "snort"]:
                await self._download_network_rules(rule_type, rule_config)
            elif rule_type in ["sigma", "yara"]:
                await self._download_detection_rules(rule_type, rule_config)
            
            # 重新加载规则
            rule_path = os.path.join(self.rules_dir, rule_type)
            if os.path.exists(rule_path):
                rules = await self._load_rules_from_directory(rule_path, rule_type)
                self.rules[rule_type] = rules
                logger.info(f"已更新 {len(rules)} 条 {rule_type} 规则")
                
        except Exception as e:
            logger.error(f"更新 {rule_type} 规则失败: {e}")
    
    async def _download_network_rules(self, rule_type: str, rule_config: Dict[str, Any]):
        """下载网络规则"""
        try:
            rules_url = rule_config.get("rules_url")
            if not rules_url:
                return
            
            async with aiohttp.ClientSession() as session:
                async with session.get(rules_url, timeout=30) as response:
                    if response.status == 200:
                        content = await response.text()
                        
                        # 保存规则文件
                        rule_file = os.path.join(self.rules_dir, rule_type, f"downloaded_{rule_type}.rules")
                        with open(rule_file, 'w', encoding='utf-8') as f:
                            f.write(content)
                        
                        logger.info(f"已下载 {rule_type} 规则到 {rule_file}")
                    else:
                        logger.warning(f"下载 {rule_type} 规则失败，状态码: {response.status}")
                        
        except Exception as e:
            logger.error(f"下载 {rule_type} 规则异常: {e}")
    
    async def _download_detection_rules(self, rule_type: str, rule_config: Dict[str, Any]):
        """下载检测规则（Sigma/YARA）"""
        try:
            # 这里应该实现从GitHub等源下载规则
            # 简化实现，创建示例规则
            await self._create_sample_rules(rule_type)
            
        except Exception as e:
            logger.error(f"下载 {rule_type} 检测规则异常: {e}")
    
    async def _create_sample_rules(self, rule_type: str):
        """创建示例规则"""
        try:
            rule_dir = os.path.join(self.rules_dir, rule_type)
            
            if rule_type == "sigma":
                sample_rule = {
                    "title": "Suspicious Process Execution",
                    "id": "sample-001",
                    "description": "Detects suspicious process execution",
                    "level": "medium",
                    "detection": {
                        "selection": {
                            "EventID": 1,
                            "Image": ["*\\cmd.exe", "*\\powershell.exe"]
                        },
                        "condition": "selection"
                    },
                    "tags": ["attack.execution"]
                }
                
                rule_file = os.path.join(rule_dir, "sample_sigma.yml")
                with open(rule_file, 'w', encoding='utf-8') as f:
                    yaml.dump(sample_rule, f, default_flow_style=False)
                    
            elif rule_type == "yara":
                sample_rule = '''
rule SuspiciousStrings
{
    meta:
        description = "Detects suspicious strings"
        author = "Tianwang Security"
        
    strings:
        $s1 = "malware" nocase
        $s2 = "backdoor" nocase
        $s3 = "keylogger" nocase
        
    condition:
        any of them
}
'''
                rule_file = os.path.join(rule_dir, "sample_yara.yar")
                with open(rule_file, 'w', encoding='utf-8') as f:
                    f.write(sample_rule)
            
            logger.info(f"已创建 {rule_type} 示例规则")
            
        except Exception as e:
            logger.error(f"创建 {rule_type} 示例规则失败: {e}")
    
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
    
    async def _match_sigma_rules(self, data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """匹配Sigma规则"""
        matches = []
        
        try:
            for rule in self.rules.get("sigma", []):
                if await self._evaluate_sigma_rule(rule, data):
                    matches.append({
                        "rule_type": "sigma",
                        "rule_id": rule.get("id"),
                        "title": rule.get("title"),
                        "level": rule.get("level"),
                        "description": rule.get("description"),
                        "tags": rule.get("tags", []),
                        "matched_data": data
                    })
                    
        except Exception as e:
            logger.error(f"Sigma规则匹配失败: {e}")
        
        return matches
    
    async def _evaluate_sigma_rule(self, rule: Dict[str, Any], data: Dict[str, Any]) -> bool:
        """评估Sigma规则"""
        try:
            detection = rule.get("detection", {})
            
            # 简化的Sigma规则评估
            for key, conditions in detection.items():
                if key == "condition":
                    continue
                
                if isinstance(conditions, dict):
                    for field, values in conditions.items():
                        if field in data:
                            data_value = str(data[field]).lower()
                            if isinstance(values, list):
                                for value in values:
                                    if str(value).lower() in data_value:
                                        return True
                            elif isinstance(values, str):
                                if str(values).lower() in data_value:
                                    return True
            
            return False
            
        except Exception as e:
            logger.debug(f"Sigma规则评估异常: {e}")
            return False
    
    async def _match_yara_rules(self, data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """匹配YARA规则"""
        matches = []
        
        try:
            # 简化的YARA规则匹配
            for rule in self.rules.get("yara", []):
                if await self._evaluate_yara_rule(rule, data):
                    matches.append({
                        "rule_type": "yara",
                        "rule_name": rule.get("name"),
                        "matched_data": data
                    })
                    
        except Exception as e:
            logger.error(f"YARA规则匹配失败: {e}")
        
        return matches
    
    async def _evaluate_yara_rule(self, rule: Dict[str, Any], data: Dict[str, Any]) -> bool:
        """评估YARA规则"""
        try:
            # 简化实现：检查数据中是否包含可疑字符串
            content = json.dumps(data).lower()
            suspicious_strings = ["malware", "backdoor", "keylogger", "trojan"]
            
            return any(s in content for s in suspicious_strings)
            
        except Exception as e:
            logger.debug(f"YARA规则评估异常: {e}")
            return False
    
    async def _match_network_rules(self, data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """匹配网络规则"""
        matches = []
        
        try:
            network_data = data.get("network", {})
            if not network_data:
                return matches
            
            # 检查Suricata规则
            for rule in self.rules.get("suricata", []):
                if await self._evaluate_network_rule(rule, network_data):
                    matches.append({
                        "rule_type": "suricata",
                        "rule_action": rule.get("action"),
                        "rule_options": rule.get("options", {}),
                        "matched_data": network_data
                    })
            
            # 检查Snort规则
            for rule in self.rules.get("snort", []):
                if await self._evaluate_network_rule(rule, network_data):
                    matches.append({
                        "rule_type": "snort",
                        "rule_action": rule.get("action"),
                        "rule_options": rule.get("options", {}),
                        "matched_data": network_data
                    })
                    
        except Exception as e:
            logger.error(f"网络规则匹配失败: {e}")
        
        return matches
    
    async def _evaluate_network_rule(self, rule: Dict[str, Any], network_data: Dict[str, Any]) -> bool:
        """评估网络规则"""
        try:
            # 简化的网络规则评估
            protocol = rule.get("protocol", "").lower()
            action = rule.get("action", "").lower()
            
            # 检查协议匹配
            if protocol and protocol != "any":
                data_protocol = network_data.get("protocol", "").lower()
                if protocol != data_protocol:
                    return False
            
            # 检查是否为告警动作
            if action in ["alert", "drop", "reject"]:
                return True
            
            return False
            
        except Exception as e:
            logger.debug(f"网络规则评估异常: {e}")
            return False
    
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
    
    async def cleanup(self):
        """清理资源"""
        try:
            logger.info("正在清理规则引擎资源...")
            self.is_initialized = False
            logger.info("规则引擎资源清理完成")
        except Exception as e:
            logger.error(f"规则引擎清理失败: {e}")
            raise
    
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