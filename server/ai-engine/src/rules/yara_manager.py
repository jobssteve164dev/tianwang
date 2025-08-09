"""
YARA规则管理器
负责下载、解析和管理YARA恶意软件检测规则
"""
import os
import re
import aiohttp
import asyncio
import git
from typing import Dict, List, Any, Optional
from loguru import logger
from datetime import datetime
import tempfile
import shutil

class YaraRuleManager:
    """YARA规则管理器"""
    
    def __init__(self, rules_dir: str = "./rules/yara"):
        self.rules_dir = rules_dir
        self.rules: List[Dict[str, Any]] = []
        self.rule_sources = {
            "yara_rules": {
                "url": "https://github.com/Yara-Rules/rules.git",
                "branch": "master",
                "description": "Yara-Rules Official Repository",
                "enabled": True
            },
            "awesome_yara": {
                "url": "https://github.com/InQuest/awesome-yara.git",
                "branch": "master", 
                "description": "Awesome YARA Rules",
                "enabled": True
            },
            "custom": {
                "description": "Custom YARA Rules",
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
                    logger.error(f"未知的YARA规则源: {source_name}")
                    return False
            else:
                sources_to_download = [name for name, config in self.rule_sources.items() 
                                     if config.get("enabled", False) and not config.get("local_only", False)]
            
            success_count = 0
            for source in sources_to_download:
                if await self._download_single_source(source):
                    success_count += 1
            
            logger.info(f"成功下载 {success_count}/{len(sources_to_download)} 个YARA规则源")
            return success_count > 0
            
        except Exception as e:
            logger.error(f"下载YARA规则失败: {e}")
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
                target_dir = os.path.join(self.rules_dir, source_name)
                
                if os.path.exists(target_dir):
                    shutil.rmtree(target_dir)
                
                # 复制整个仓库内容，但只保留.yar和.yara文件
                shutil.copytree(temp_dir, target_dir, ignore=shutil.ignore_patterns('*.git*'))
                
                # 清理非规则文件
                await self._cleanup_non_rule_files(target_dir)
                
                logger.info(f"成功下载 {source_name} 规则到 {target_dir}")
                return True
                    
        except Exception as e:
            logger.error(f"下载 {source_name} YARA规则失败: {e}")
            return False
    
    async def _cleanup_non_rule_files(self, directory: str):
        """清理非规则文件"""
        try:
            for root, dirs, files in os.walk(directory):
                for file in files:
                    if not file.endswith(('.yar', '.yara')):
                        file_path = os.path.join(root, file)
                        try:
                            os.remove(file_path)
                        except:
                            pass
                            
                # 删除空目录
                for dir_name in dirs[:]:
                    dir_path = os.path.join(root, dir_name)
                    try:
                        if not os.listdir(dir_path):
                            os.rmdir(dir_path)
                    except:
                        pass
                        
        except Exception as e:
            logger.debug(f"清理非规则文件失败: {e}")
    
    async def load_rules(self) -> int:
        """加载所有规则"""
        try:
            self.rules.clear()
            total_rules = 0
            
            # 遍历所有规则目录
            for source_name in os.listdir(self.rules_dir):
                source_path = os.path.join(self.rules_dir, source_name)
                if os.path.isdir(source_path):
                    rules_count = await self._load_rules_from_directory(source_path, source_name)
                    total_rules += rules_count
                    logger.info(f"从 {source_name} 加载了 {rules_count} 条YARA规则")
            
            logger.info(f"总共加载了 {total_rules} 条YARA规则")
            return total_rules
            
        except Exception as e:
            logger.error(f"加载YARA规则失败: {e}")
            return 0
    
    async def _load_rules_from_directory(self, directory: str, source_name: str) -> int:
        """从目录加载规则"""
        rules_count = 0
        
        try:
            for root, dirs, files in os.walk(directory):
                for file in files:
                    if file.endswith(('.yar', '.yara')):
                        file_path = os.path.join(root, file)
                        file_rules = await self._parse_yara_file(file_path, source_name)
                        self.rules.extend(file_rules)
                        rules_count += len(file_rules)
                        
        except Exception as e:
            logger.error(f"从目录 {directory} 加载YARA规则失败: {e}")
        
        return rules_count
    
    async def _parse_yara_file(self, file_path: str, source_name: str) -> List[Dict[str, Any]]:
        """解析YARA规则文件"""
        rules = []
        
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
            
            # 使用正则表达式解析YARA规则
            # YARA规则格式: rule rule_name { meta: ... strings: ... condition: ... }
            rule_pattern = r'rule\s+(\w+)\s*\{([^}]+(?:\{[^}]*\}[^}]*)*)\}'
            
            for match in re.finditer(rule_pattern, content, re.DOTALL | re.IGNORECASE):
                rule_name = match.group(1)
                rule_body = match.group(2)
                
                rule = await self._parse_single_yara_rule(rule_name, rule_body, file_path, source_name)
                if rule:
                    rules.append(rule)
                    
        except Exception as e:
            logger.debug(f"解析YARA文件 {file_path} 失败: {e}")
        
        return rules
    
    async def _parse_single_yara_rule(self, rule_name: str, rule_body: str, file_path: str, source_name: str) -> Optional[Dict[str, Any]]:
        """解析单条YARA规则"""
        try:
            # 解析meta部分
            meta = {}
            meta_match = re.search(r'meta:\s*([^}]+?)(?=strings:|condition:|\Z)', rule_body, re.DOTALL | re.IGNORECASE)
            if meta_match:
                meta_content = meta_match.group(1)
                # 解析meta键值对
                meta_pairs = re.findall(r'(\w+)\s*=\s*"([^"]*)"', meta_content)
                for key, value in meta_pairs:
                    meta[key] = value
            
            # 解析strings部分
            strings = {}
            strings_match = re.search(r'strings:\s*([^}]+?)(?=condition:|\Z)', rule_body, re.DOTALL | re.IGNORECASE)
            if strings_match:
                strings_content = strings_match.group(1)
                # 解析字符串定义
                string_pairs = re.findall(r'(\$\w+)\s*=\s*"([^"]*)"', strings_content)
                for var_name, string_value in string_pairs:
                    strings[var_name] = string_value
                
                # 解析十六进制字符串
                hex_pairs = re.findall(r'(\$\w+)\s*=\s*\{([^}]*)\}', strings_content)
                for var_name, hex_value in hex_pairs:
                    strings[var_name] = {"type": "hex", "value": hex_value.strip()}
            
            # 解析condition部分
            condition = ""
            condition_match = re.search(r'condition:\s*([^}]+)', rule_body, re.DOTALL | re.IGNORECASE)
            if condition_match:
                condition = condition_match.group(1).strip()
            
            rule = {
                "id": f"{source_name}_{rule_name}",
                "name": rule_name,
                "meta": meta,
                "strings": strings,
                "condition": condition,
                "file_path": file_path,
                "source": source_name,
                "type": "yara",
                "created_at": datetime.now().isoformat(),
                # 从meta中提取常用字段
                "description": meta.get("description", meta.get("desc", "")),
                "author": meta.get("author", ""),
                "date": meta.get("date", ""),
                "version": meta.get("version", ""),
                "malware_family": meta.get("family", meta.get("malware", "")),
                "reference": meta.get("reference", meta.get("ref", ""))
            }
            
            return rule
            
        except Exception as e:
            logger.debug(f"解析YARA规则 {rule_name} 失败: {e}")
            return None
    
    async def match_rule(self, file_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """匹配文件数据与YARA规则"""
        matches = []
        
        try:
            for rule in self.rules:
                if await self._evaluate_yara_rule(rule, file_data):
                    match = {
                        "rule_id": rule["id"],
                        "rule_name": rule["name"],
                        "description": rule["description"],
                        "author": rule["author"],
                        "malware_family": rule["malware_family"],
                        "severity": self._get_rule_severity(rule),
                        "matched_data": file_data,
                        "rule_source": rule["source"],
                        "timestamp": datetime.now().isoformat()
                    }
                    matches.append(match)
                    
        except Exception as e:
            logger.error(f"YARA规则匹配失败: {e}")
        
        return matches
    
    async def _evaluate_yara_rule(self, rule: Dict[str, Any], file_data: Dict[str, Any]) -> bool:
        """评估YARA规则是否匹配"""
        try:
            # 简化的YARA规则评估实现
            # 实际应该使用YARA库进行匹配
            
            strings = rule.get("strings", {})
            condition = rule.get("condition", "")
            
            # 获取文件内容
            file_content = ""
            if "content" in file_data:
                file_content = str(file_data["content"])
            elif "strings" in file_data:
                file_content = " ".join(file_data["strings"])
            else:
                # 尝试从其他字段获取文本内容
                file_content = str(file_data)
            
            file_content = file_content.lower()
            
            # 检查字符串匹配
            matched_strings = []
            for var_name, string_value in strings.items():
                if isinstance(string_value, dict):
                    # 十六进制字符串（简化处理）
                    if string_value.get("type") == "hex":
                        # 这里应该进行十六进制匹配，简化为跳过
                        continue
                else:
                    # 普通字符串匹配
                    if string_value.lower() in file_content:
                        matched_strings.append(var_name)
            
            # 简化的条件评估
            if condition:
                # 检查是否包含匹配的字符串变量
                for var_name in matched_strings:
                    if var_name in condition:
                        return True
                
                # 检查常见条件模式
                if "any of them" in condition and matched_strings:
                    return True
                if "all of them" in condition and len(matched_strings) == len(strings):
                    return True
            
            # 如果有字符串匹配但没有条件，也认为匹配
            return len(matched_strings) > 0
            
        except Exception as e:
            logger.debug(f"评估YARA规则失败: {e}")
            return False
    
    def _get_rule_severity(self, rule: Dict[str, Any]) -> str:
        """获取规则严重程度"""
        # 根据恶意软件家族和描述判断严重程度
        malware_family = rule.get("malware_family", "").lower()
        description = rule.get("description", "").lower()
        
        high_severity_keywords = ["trojan", "backdoor", "ransomware", "rootkit", "apt"]
        medium_severity_keywords = ["adware", "spyware", "pua", "suspicious"]
        
        if any(keyword in malware_family or keyword in description for keyword in high_severity_keywords):
            return "high"
        elif any(keyword in malware_family or keyword in description for keyword in medium_severity_keywords):
            return "medium"
        else:
            return "low"
    
    def get_statistics(self) -> Dict[str, Any]:
        """获取规则统计信息"""
        stats = {
            "total_rules": len(self.rules),
            "rules_by_source": {},
            "rules_by_family": {},
            "rules_by_author": {},
            "last_update": datetime.now().isoformat()
        }
        
        for rule in self.rules:
            # 按来源统计
            source = rule.get("source", "unknown")
            stats["rules_by_source"][source] = stats["rules_by_source"].get(source, 0) + 1
            
            # 按恶意软件家族统计
            family = rule.get("malware_family", "unknown")
            if family:
                stats["rules_by_family"][family] = stats["rules_by_family"].get(family, 0) + 1
            
            # 按作者统计
            author = rule.get("author", "unknown")
            if author:
                stats["rules_by_author"][author] = stats["rules_by_author"].get(author, 0) + 1
        
        return stats
    
    async def create_custom_rule(self, rule_data: Dict[str, Any]) -> bool:
        """创建自定义YARA规则"""
        try:
            # 验证规则数据
            if "name" not in rule_data or "strings" not in rule_data or "condition" not in rule_data:
                logger.error("自定义YARA规则缺少必需字段")
                return False
            
            rule_name = rule_data["name"]
            
            # 构建YARA规则内容
            rule_content = f"rule {rule_name}\n{{\n"
            
            # 添加meta部分
            if "meta" in rule_data:
                rule_content += "    meta:\n"
                for key, value in rule_data["meta"].items():
                    rule_content += f'        {key} = "{value}"\n'
            
            # 添加strings部分
            rule_content += "    strings:\n"
            for var_name, string_value in rule_data["strings"].items():
                if isinstance(string_value, dict) and string_value.get("type") == "hex":
                    rule_content += f'        {var_name} = {{{string_value["value"]}}}\n'
                else:
                    rule_content += f'        {var_name} = "{string_value}"\n'
            
            # 添加condition部分
            rule_content += f'    condition:\n        {rule_data["condition"]}\n'
            rule_content += "}\n"
            
            # 保存到文件
            custom_dir = os.path.join(self.rules_dir, "custom")
            os.makedirs(custom_dir, exist_ok=True)
            
            rule_file = os.path.join(custom_dir, f"{rule_name}.yar")
            with open(rule_file, 'w', encoding='utf-8') as f:
                f.write(rule_content)
            
            # 解析并添加到内存中的规则列表
            file_rules = await self._parse_yara_file(rule_file, "custom")
            self.rules.extend(file_rules)
            
            logger.info(f"成功创建自定义YARA规则: {rule_name}")
            return True
            
        except Exception as e:
            logger.error(f"创建自定义YARA规则失败: {e}")
            return False
    
    async def update_rules(self) -> bool:
        """更新规则库"""
        try:
            logger.info("开始更新YARA规则库...")
            
            # 下载最新规则
            download_success = await self.download_rules()
            if not download_success:
                logger.error("下载YARA规则失败")
                return False
            
            # 重新加载规则
            rules_count = await self.load_rules()
            if rules_count == 0:
                logger.error("加载YARA规则失败")
                return False
            
            logger.info(f"YARA规则库更新成功，共 {rules_count} 条规则")
            return True
            
        except Exception as e:
            logger.error(f"更新YARA规则库失败: {e}")
            return False 