"""
Sigma规则管理器
负责下载、解析和管理Sigma日志分析规则
"""
import os
import aiohttp
import asyncio
import yaml
import git
from typing import Dict, List, Any, Optional
from loguru import logger
from datetime import datetime
import tempfile
import shutil

class SigmaRuleManager:
    """Sigma规则管理器"""
    
    def __init__(self, rules_dir: str = "./rules/sigma"):
        self.rules_dir = rules_dir
        self.rules: List[Dict[str, Any]] = []
        self.rule_sources = {
            "sigmahq": {
                "url": "https://github.com/SigmaHQ/sigma.git",
                "branch": "master",
                "description": "SigmaHQ Official Rules",
                "enabled": True,
                "rules_path": "rules"
            },
            "custom": {
                "description": "Custom Sigma Rules",
                "enabled": True,
                "local_only": True
            }
        }
        
        # 确保规则目录存在
        os.makedirs(self.rules_dir, exist_ok=True)
    
    async def download_rules(self, source_name: str = None) -> bool:
        """下载规则"""
        try:
            sources_to_download = []
            
            if source_name:
                if source_name in self.rule_sources:
                    sources_to_download = [source_name]
                else:
                    logger.error(f"未知的Sigma规则源: {source_name}")
                    return False
            else:
                sources_to_download = [name for name, config in self.rule_sources.items() 
                                     if config.get("enabled", False) and not config.get("local_only", False)]
            
            success_count = 0
            for source in sources_to_download:
                if await self._download_single_source(source):
                    success_count += 1
            
            logger.info(f"成功下载 {success_count}/{len(sources_to_download)} 个Sigma规则源")
            return success_count > 0
            
        except Exception as e:
            logger.error(f"下载Sigma规则失败: {e}")
            return False
    
    async def _download_single_source(self, source_name: str) -> bool:
        """下载单个规则源"""
        try:
            source_config = self.rule_sources[source_name]
            
            if source_config.get("local_only", False):
                logger.info(f"跳过本地规则源: {source_name}")
                return True
            
            url = source_config["url"]
            branch = source_config.get("branch", "master")
            
            logger.info(f"正在克隆 {source_config['description']} 从 {url}")
            
            # 创建临时目录
            with tempfile.TemporaryDirectory() as temp_dir:
                # 克隆仓库
                repo = git.Repo.clone_from(url, temp_dir, branch=branch, depth=1)
                
                # 复制规则文件
                source_rules_path = os.path.join(temp_dir, source_config.get("rules_path", ""))
                target_dir = os.path.join(self.rules_dir, source_name)
                
                if os.path.exists(target_dir):
                    shutil.rmtree(target_dir)
                
                if os.path.exists(source_rules_path):
                    shutil.copytree(source_rules_path, target_dir)
                    logger.info(f"成功下载 {source_name} 规则到 {target_dir}")
                    return True
                else:
                    logger.error(f"规则路径不存在: {source_rules_path}")
                    return False
                    
        except Exception as e:
            logger.error(f"下载 {source_name} Sigma规则失败: {e}")
            return False
    
    async def load_rules(self, allow_download: bool = True) -> int:
        """加载所有规则"""
        try:
            self.rules.clear()
            total_rules = 0
            
            # 首先尝试加载本地规则
            if os.path.exists(self.rules_dir):
                for source_name in os.listdir(self.rules_dir):
                    source_path = os.path.join(self.rules_dir, source_name)
                    if os.path.isdir(source_path):
                        rules_count = await self._load_rules_from_directory(source_path, source_name)
                        total_rules += rules_count
                        logger.info(f"从 {source_name} 加载了 {rules_count} 条Sigma规则")
            
            # 如果本地规则不足，尝试下载外部规则
            if total_rules < 5 and allow_download:
                logger.info("本地Sigma规则数量不足，尝试下载外部规则...")
                download_success = await self.download_rules()
                if download_success:
                    # 重新加载规则
                    for source_name in os.listdir(self.rules_dir):
                        source_path = os.path.join(self.rules_dir, source_name)
                        if os.path.isdir(source_path):
                            rules_count = await self._load_rules_from_directory(source_path, source_name)
                            total_rules += rules_count
                            logger.info(f"从 {source_name} 加载了 {rules_count} 条Sigma规则")
            
            # 如果仍然没有规则，创建默认规则
            if total_rules == 0:
                logger.warning("未找到任何Sigma规则，创建默认规则...")
                await self._create_default_rules()
                total_rules = await self._load_rules_from_directory(self.rules_dir, "default")
            
            logger.info(f"总共加载了 {total_rules} 条Sigma规则")
            return total_rules
            
        except Exception as e:
            logger.error(f"加载Sigma规则失败: {e}")
            # 最后的回退：创建默认规则
            try:
                await self._create_default_rules()
                return await self._load_rules_from_directory(self.rules_dir, "default")
            except Exception as fallback_error:
                logger.error(f"创建默认Sigma规则也失败: {fallback_error}")
                return 0
    
    async def _load_rules_from_directory(self, directory: str, source_name: str) -> int:
        """从目录加载规则"""
        rules_count = 0
        
        try:
            for root, dirs, files in os.walk(directory):
                for file in files:
                    if file.endswith(('.yml', '.yaml')):
                        file_path = os.path.join(root, file)
                        rule = await self._parse_sigma_rule(file_path, source_name)
                        if rule:
                            self.rules.append(rule)
                            rules_count += 1
                            
        except Exception as e:
            logger.error(f"从目录 {directory} 加载Sigma规则失败: {e}")
        
        return rules_count
    
    async def _parse_sigma_rule(self, file_path: str, source_name: str) -> Optional[Dict[str, Any]]:
        """解析Sigma规则文件"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                rule_data = yaml.safe_load(f)
            
            if not rule_data or not isinstance(rule_data, dict):
                return None
            
            # 验证必需字段
            if 'title' not in rule_data or 'detection' not in rule_data:
                return None
            
            rule = {
                "id": rule_data.get("id", f"{source_name}_{os.path.basename(file_path)}"),
                "title": rule_data.get("title", ""),
                "description": rule_data.get("description", ""),
                "status": rule_data.get("status", "experimental"),
                "level": rule_data.get("level", "medium"),
                "author": rule_data.get("author", ""),
                "date": rule_data.get("date", ""),
                "modified": rule_data.get("modified", ""),
                "logsource": rule_data.get("logsource", {}),
                "detection": rule_data.get("detection", {}),
                "enabled": rule_data.get("enabled", True),
                "falsepositives": rule_data.get("falsepositives", []),
                "tags": rule_data.get("tags", []),
                "references": rule_data.get("references", []),
                "file_path": file_path,
                "source": source_name,
                "type": "sigma",
                "created_at": datetime.now().isoformat()
            }
            
            return rule
            
        except Exception as e:
            logger.debug(f"解析Sigma规则文件 {file_path} 失败: {e}")
            return None
    
    async def match_rule(self, log_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """匹配日志数据与Sigma规则"""
        matches = []
        
        try:
            for rule in self.rules:
                if not rule.get("enabled", True):
                    continue
                if await self._evaluate_sigma_rule(rule, log_data):
                    match = {
                        "rule_id": rule["id"],
                        "title": rule["title"],
                        "level": rule["level"],
                        "status": rule["status"],
                        "description": rule["description"],
                        "tags": rule["tags"],
                        "matched_data": log_data,
                        "rule_source": rule["source"],
                        "timestamp": datetime.now().isoformat()
                    }
                    matches.append(match)
                    
        except Exception as e:
            logger.error(f"Sigma规则匹配失败: {e}")
        
        return matches
    
    async def _evaluate_sigma_rule(self, rule: Dict[str, Any], log_data: Dict[str, Any]) -> bool:
        """评估Sigma规则是否匹配"""
        try:
            detection = rule.get("detection", {})
            condition = detection.get("condition", "")
            
            # 简化的Sigma规则评估实现
            # 实际应该使用专门的Sigma引擎如pySigma
            
            # 检查日志源匹配
            logsource = rule.get("logsource", {})
            if logsource:
                product = logsource.get("product", "")
                service = logsource.get("service", "")
                category = logsource.get("category", "")
                
                # 简单的日志源匹配
                if product and product.lower() not in str(log_data).lower():
                    return False
            
            # 检查选择条件
            for key, selection in detection.items():
                if key == "condition":
                    continue
                
                if isinstance(selection, dict):
                    if await self._match_selection(selection, log_data):
                        # 简化处理：如果任何选择条件匹配，就认为规则匹配
                        return True
            
            return False
            
        except Exception as e:
            logger.debug(f"评估Sigma规则失败: {e}")
            return False
    
    async def _match_selection(self, selection: Dict[str, Any], log_data: Dict[str, Any]) -> bool:
        """匹配选择条件"""
        try:
            for field, values in selection.items():
                if field in log_data:
                    log_value = str(log_data[field]).lower()
                    
                    if isinstance(values, list):
                        # 列表匹配：任意一个值匹配即可
                        for value in values:
                            if str(value).lower() in log_value:
                                return True
                    elif isinstance(values, str):
                        # 字符串匹配
                        if str(values).lower() in log_value:
                            return True
                    elif isinstance(values, dict):
                        # 复杂匹配条件（如contains, startswith等）
                        if "contains" in values:
                            if str(values["contains"]).lower() in log_value:
                                return True
                        if "startswith" in values:
                            if log_value.startswith(str(values["startswith"]).lower()):
                                return True
                        if "endswith" in values:
                            if log_value.endswith(str(values["endswith"]).lower()):
                                return True
            
            return False
            
        except Exception as e:
            logger.debug(f"匹配选择条件失败: {e}")
            return False
    
    def get_statistics(self) -> Dict[str, Any]:
        """获取规则统计信息"""
        stats = {
            "total_rules": len(self.rules),
            "rules_by_level": {},
            "rules_by_status": {},
            "rules_by_source": {},
            "rules_by_category": {},
            "last_update": datetime.now().isoformat()
        }
        
        for rule in self.rules:
            # 按级别统计
            level = rule.get("level", "unknown")
            stats["rules_by_level"][level] = stats["rules_by_level"].get(level, 0) + 1
            
            # 按状态统计
            status = rule.get("status", "unknown")
            stats["rules_by_status"][status] = stats["rules_by_status"].get(status, 0) + 1
            
            # 按来源统计
            source = rule.get("source", "unknown")
            stats["rules_by_source"][source] = stats["rules_by_source"].get(source, 0) + 1
            
            # 按类别统计（从logsource获取）
            logsource = rule.get("logsource", {})
            category = logsource.get("category", "unknown")
            stats["rules_by_category"][category] = stats["rules_by_category"].get(category, 0) + 1
        
        return stats
    
    async def create_custom_rule(self, rule_data: Dict[str, Any]) -> bool:
        """创建自定义Sigma规则"""
        try:
            # 验证规则数据
            if "title" not in rule_data or "detection" not in rule_data:
                logger.error("自定义Sigma规则缺少必需字段")
                return False
            
            # 生成规则ID
            rule_id = rule_data.get("id", f"custom_{datetime.now().strftime('%Y%m%d_%H%M%S')}")
            
            # 补充默认字段
            rule = {
                "id": rule_id,
                "title": rule_data["title"],
                "description": rule_data.get("description", ""),
                "status": rule_data.get("status", "experimental"),
                "level": rule_data.get("level", "medium"),
                "author": rule_data.get("author", "AI Engine"),
                "date": datetime.now().strftime("%Y/%m/%d"),
                "logsource": rule_data.get("logsource", {}),
                "detection": rule_data["detection"],
                "tags": rule_data.get("tags", []),
                "references": rule_data.get("references", [])
            }
            
            # 保存到文件
            custom_dir = os.path.join(self.rules_dir, "custom")
            os.makedirs(custom_dir, exist_ok=True)
            
            rule_file = os.path.join(custom_dir, f"{rule_id}.yml")
            with open(rule_file, 'w', encoding='utf-8') as f:
                yaml.dump(rule, f, default_flow_style=False, allow_unicode=True)
            
            # 添加到内存中的规则列表
            rule["file_path"] = rule_file
            rule["source"] = "custom"
            rule["type"] = "sigma"
            rule["created_at"] = datetime.now().isoformat()
            
            self.rules.append(rule)
            
            logger.info(f"成功创建自定义Sigma规则: {rule_id}")
            return True
            
        except Exception as e:
            logger.error(f"创建自定义Sigma规则失败: {e}")
            return False
    
    async def update_rules(self) -> bool:
        """更新规则库"""
        try:
            logger.info("开始更新Sigma规则库...")
            
            # 下载最新规则
            download_success = await self.download_rules()
            if not download_success:
                logger.error("下载Sigma规则失败")
                return False
            
            # 重新加载规则
            rules_count = await self.load_rules()
            if rules_count == 0:
                logger.error("加载Sigma规则失败")
                return False
            
            logger.info(f"Sigma规则库更新成功，共 {rules_count} 条规则")
            return True
            
        except Exception as e:
            logger.error(f"更新Sigma规则库失败: {e}")
            return False
    
    async def _create_default_rules(self):
        """创建默认的Sigma规则"""
        try:
            default_rules = [
                {
                    "title": "Default Malware Detection",
                    "id": "2025-001",
                    "status": "stable",
                    "description": "Default malware detection rule",
                    "level": "medium",
                    "logsource": {
                        "product": "windows",
                        "service": "security"
                    },
                    "detection": {
                        "selection": {
                            "EventID": 4688,
                            "CommandLine|contains": ["cmd.exe", "powershell.exe"]
                        },
                        "condition": "selection"
                    }
                },
                {
                    "title": "Default Suspicious Activity",
                    "id": "2025-002",
                    "status": "stable",
                    "description": "Default suspicious activity detection",
                    "level": "medium",
                    "logsource": {
                        "product": "windows",
                        "service": "security"
                    },
                    "detection": {
                        "selection": {
                            "EventID": 4663,
                            "ObjectName|contains": [".exe", ".dll"]
                        },
                        "condition": "selection"
                    }
                }
            ]
            
            # 确保默认规则目录存在
            default_dir = os.path.join(self.rules_dir, "default")
            os.makedirs(default_dir, exist_ok=True)
            
            # 创建默认规则文件
            for i, rule in enumerate(default_rules):
                rule_file = os.path.join(default_dir, f"default_rule_{i+1}.yml")
                with open(rule_file, 'w', encoding='utf-8') as f:
                    yaml.dump(rule, f, default_flow_style=False, allow_unicode=True)
            
            logger.info("成功创建默认Sigma规则")
            
        except Exception as e:
            logger.error(f"创建默认Sigma规则失败: {e}")
            raise
