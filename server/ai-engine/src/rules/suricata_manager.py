"""
Suricata规则管理器
负责下载、解析和管理Suricata网络入侵检测规则
"""
import os
import re
import aiohttp
import asyncio
from typing import Dict, List, Any, Optional
from loguru import logger
import zipfile
import tempfile
from datetime import datetime

class SuricataRuleManager:
    """Suricata规则管理器"""
    
    def __init__(self, rules_dir: str = "./rules/suricata"):
        self.rules_dir = rules_dir
        self.rules: List[Dict[str, Any]] = []
        self.rule_sources = {
            "emerging_threats": {
                "url": "https://rules.emergingthreats.net/open/suricata/emerging.rules.zip",
                "description": "Emerging Threats Open Ruleset",
                "enabled": True
            },
            "suricata_rules": {
                "url": "https://rules.emergingthreats.net/open/suricata-5.0/emerging.rules.zip",
                "description": "Suricata 5.0 Rules",
                "enabled": True
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
                    logger.error(f"未知的规则源: {source_name}")
                    return False
            else:
                sources_to_download = [name for name, config in self.rule_sources.items() 
                                     if config.get("enabled", False)]
            
            success_count = 0
            for source in sources_to_download:
                if await self._download_single_source(source):
                    success_count += 1
            
            logger.info(f"成功下载 {success_count}/{len(sources_to_download)} 个规则源")
            return success_count > 0
            
        except Exception as e:
            logger.error(f"下载Suricata规则失败: {e}")
            return False
    
    async def _download_single_source(self, source_name: str) -> bool:
        """下载单个规则源"""
        try:
            source_config = self.rule_sources[source_name]
            url = source_config["url"]
            
            logger.info(f"正在下载 {source_config['description']} 从 {url}")
            
            async with aiohttp.ClientSession() as session:
                async with session.get(url, timeout=300) as response:
                    if response.status == 200:
                        # 保存到临时文件
                        with tempfile.NamedTemporaryFile(delete=False, suffix='.zip') as tmp_file:
                            content = await response.read()
                            tmp_file.write(content)
                            tmp_file_path = tmp_file.name
                        
                        # 解压规则文件
                        await self._extract_rules(tmp_file_path, source_name)
                        
                        # 清理临时文件
                        os.unlink(tmp_file_path)
                        
                        logger.info(f"成功下载并解压 {source_name} 规则")
                        return True
                    else:
                        logger.error(f"下载失败，状态码: {response.status}")
                        return False
                        
        except Exception as e:
            logger.error(f"下载 {source_name} 规则失败: {e}")
            return False
    
    async def _extract_rules(self, zip_path: str, source_name: str):
        """解压规则文件"""
        try:
            source_dir = os.path.join(self.rules_dir, source_name)
            os.makedirs(source_dir, exist_ok=True)
            
            with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                # 只提取.rules文件
                for file_info in zip_ref.filelist:
                    if file_info.filename.endswith('.rules'):
                        # 提取到源目录
                        zip_ref.extract(file_info, source_dir)
                        logger.debug(f"解压规则文件: {file_info.filename}")
            
            logger.info(f"规则文件已解压到: {source_dir}")
            
        except Exception as e:
            logger.error(f"解压规则文件失败: {e}")
            raise
    
    async def load_rules(self) -> int:
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
                        logger.info(f"从 {source_name} 加载了 {rules_count} 条Suricata规则")
            
            # 如果本地规则不足，尝试下载外部规则
            if total_rules < 10:
                logger.info("本地Suricata规则数量不足，尝试下载外部规则...")
                download_success = await self.download_rules()
                if download_success:
                    # 重新加载规则
                    for source_name in os.listdir(self.rules_dir):
                        source_path = os.path.join(self.rules_dir, source_name)
                        if os.path.isdir(source_path):
                            rules_count = await self._load_rules_from_directory(source_path, source_name)
                            total_rules += rules_count
                            logger.info(f"从 {source_name} 加载了 {rules_count} 条Suricata规则")
            
            # 如果仍然没有规则，创建默认规则
            if total_rules == 0:
                logger.warning("未找到任何Suricata规则，创建默认规则...")
                await self._create_default_rules()
                total_rules = await self._load_rules_from_directory(self.rules_dir, "default")
            
            logger.info(f"总共加载了 {total_rules} 条Suricata规则")
            return total_rules
            
        except Exception as e:
            logger.error(f"加载Suricata规则失败: {e}")
            # 最后的回退：创建默认规则
            try:
                await self._create_default_rules()
                return await self._load_rules_from_directory(self.rules_dir, "default")
            except Exception as fallback_error:
                logger.error(f"创建默认Suricata规则也失败: {fallback_error}")
                return 0
    
    async def _load_rules_from_directory(self, directory: str, source_name: str) -> int:
        """从目录加载规则"""
        rules_count = 0
        
        try:
            for root, dirs, files in os.walk(directory):
                for file in files:
                    if file.endswith('.rules'):
                        file_path = os.path.join(root, file)
                        file_rules = await self._parse_rules_file(file_path, source_name)
                        self.rules.extend(file_rules)
                        rules_count += len(file_rules)
                        
        except Exception as e:
            logger.error(f"从目录 {directory} 加载规则失败: {e}")
        
        return rules_count
    
    async def _parse_rules_file(self, file_path: str, source_name: str) -> List[Dict[str, Any]]:
        """解析规则文件"""
        rules = []
        
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                lines = f.readlines()
            
            for line_num, line in enumerate(lines, 1):
                line = line.strip()
                
                # 跳过注释和空行
                if not line or line.startswith('#'):
                    continue
                
                rule = self._parse_rule_line(line, file_path, line_num, source_name)
                if rule:
                    rules.append(rule)
                    
        except Exception as e:
            logger.error(f"解析规则文件 {file_path} 失败: {e}")
        
        return rules
    
    def _parse_rule_line(self, line: str, file_path: str, line_num: int, source_name: str) -> Optional[Dict[str, Any]]:
        """解析单条规则"""
        try:
            # Suricata规则格式: action protocol src_ip src_port direction dst_ip dst_port (options)
            # 例: alert tcp any any -> any 80 (msg:"HTTP GET"; content:"GET"; sid:1;)
            
            # 使用正则表达式解析规则
            rule_pattern = r'^(\w+)\s+(\w+)\s+([^\s]+)\s+([^\s]+)\s+(->|<>|<-)\s+([^\s]+)\s+([^\s]+)\s+\((.+)\)$'
            match = re.match(rule_pattern, line)
            
            if not match:
                return None
            
            action, protocol, src_ip, src_port, direction, dst_ip, dst_port, options_str = match.groups()
            
            # 解析选项
            options = self._parse_rule_options(options_str)
            
            rule = {
                "id": f"{source_name}_{line_num}",
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
                "source": source_name,
                "type": "suricata",
                "created_at": datetime.now().isoformat()
            }
            
            return rule
            
        except Exception as e:
            logger.debug(f"解析规则行失败 (行 {line_num}): {e}")
            return None
    
    def _parse_rule_options(self, options_str: str) -> Dict[str, Any]:
        """解析规则选项"""
        options = {}
        
        try:
            # 分割选项，处理引号内的内容
            option_parts = []
            current_part = ""
            in_quotes = False
            
            for char in options_str:
                if char == '"' and (not current_part or current_part[-1] != '\\'):
                    in_quotes = not in_quotes
                    current_part += char
                elif char == ';' and not in_quotes:
                    if current_part.strip():
                        option_parts.append(current_part.strip())
                    current_part = ""
                else:
                    current_part += char
            
            if current_part.strip():
                option_parts.append(current_part.strip())
            
            # 解析每个选项
            for part in option_parts:
                if ':' in part:
                    key, value = part.split(':', 1)
                    key = key.strip()
                    value = value.strip().strip('"')
                    options[key] = value
                else:
                    # 无值选项
                    options[part.strip()] = True
                    
        except Exception as e:
            logger.debug(f"解析规则选项失败: {e}")
        
        return options
    
    async def match_rule(self, network_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """匹配网络数据与规则"""
        matches = []
        
        try:
            for rule in self.rules:
                if await self._evaluate_rule(rule, network_data):
                    match = {
                        "rule_id": rule["id"],
                        "action": rule["action"],
                        "protocol": rule["protocol"],
                        "message": rule["options"].get("msg", ""),
                        "sid": rule["options"].get("sid", ""),
                        "severity": self._get_rule_severity(rule),
                        "matched_data": network_data,
                        "rule_source": rule["source"],
                        "timestamp": datetime.now().isoformat()
                    }
                    matches.append(match)
                    
        except Exception as e:
            logger.error(f"规则匹配失败: {e}")
        
        return matches
    
    async def _evaluate_rule(self, rule: Dict[str, Any], network_data: Dict[str, Any]) -> bool:
        """评估规则是否匹配"""
        try:
            # 检查协议
            if rule["protocol"] != "any":
                data_protocol = network_data.get("protocol", "").lower()
                if rule["protocol"].lower() != data_protocol:
                    return False
            
            # 检查端口
            if rule["dst_port"] != "any":
                data_port = network_data.get("dst_port")
                if data_port and str(data_port) != rule["dst_port"]:
                    return False
            
            # 检查IP地址（简化实现）
            if rule["dst_ip"] != "any":
                data_dst_ip = network_data.get("dst_ip")
                if data_dst_ip and data_dst_ip != rule["dst_ip"]:
                    # 可以在这里添加更复杂的IP匹配逻辑
                    pass
            
            # 检查内容匹配
            if "content" in rule["options"]:
                content_pattern = rule["options"]["content"]
                # 在网络数据中查找内容
                payload = network_data.get("payload", "")
                if isinstance(payload, str) and content_pattern.lower() not in payload.lower():
                    return False
            
            # 如果是告警规则，则匹配
            if rule["action"] in ["alert", "drop", "reject"]:
                return True
            
            return False
            
        except Exception as e:
            logger.debug(f"评估规则失败: {e}")
            return False
    
    def _get_rule_severity(self, rule: Dict[str, Any]) -> str:
        """获取规则严重程度"""
        # 根据规则类型和选项判断严重程度
        if rule["action"] == "drop":
            return "high"
        elif rule["action"] == "alert":
            msg = rule["options"].get("msg", "").lower()
            if any(keyword in msg for keyword in ["critical", "severe", "malware"]):
                return "high"
            elif any(keyword in msg for keyword in ["warning", "suspicious"]):
                return "medium"
            else:
                return "low"
        else:
            return "low"
    
    def get_statistics(self) -> Dict[str, Any]:
        """获取规则统计信息"""
        stats = {
            "total_rules": len(self.rules),
            "rules_by_action": {},
            "rules_by_protocol": {},
            "rules_by_source": {},
            "last_update": datetime.now().isoformat()
        }
        
        for rule in self.rules:
            # 按动作统计
            action = rule["action"]
            stats["rules_by_action"][action] = stats["rules_by_action"].get(action, 0) + 1
            
            # 按协议统计
            protocol = rule["protocol"]
            stats["rules_by_protocol"][protocol] = stats["rules_by_protocol"].get(protocol, 0) + 1
            
            # 按来源统计
            source = rule["source"]
            stats["rules_by_source"][source] = stats["rules_by_source"].get(source, 0) + 1
        
        return stats
    
    async def update_rules(self) -> bool:
        """更新规则库"""
        try:
            logger.info("开始更新Suricata规则库...")
            
            # 下载最新规则
            download_success = await self.download_rules()
            if not download_success:
                logger.error("下载规则失败")
                return False
            
            # 重新加载规则
            rules_count = await self.load_rules()
            if rules_count == 0:
                logger.error("加载规则失败")
                return False
            
            logger.info(f"Suricata规则库更新成功，共 {rules_count} 条规则")
            return True
            
        except Exception as e:
            logger.error(f"更新Suricata规则库失败: {e}")
            return False
    
    async def _create_default_rules(self):
        """创建默认的Suricata规则"""
        try:
            default_rules = [
                {
                    "action": "alert",
                    "protocol": "tcp",
                    "src_ip": "any",
                    "src_port": "any",
                    "direction": "->",
                    "dst_ip": "any",
                    "dst_port": "any",
                    "options": {
                        "msg": "Default Malware Detection",
                        "content": "malware",
                        "sid": "20250001"
                    }
                },
                {
                    "action": "alert",
                    "protocol": "tcp",
                    "src_ip": "any",
                    "src_port": "any",
                    "direction": "->",
                    "dst_ip": "any",
                    "dst_port": "any",
                    "options": {
                        "msg": "Default Suspicious Activity",
                        "content": "suspicious",
                        "sid": "20250002"
                    }
                },
                {
                    "action": "alert",
                    "protocol": "tcp",
                    "src_ip": "any",
                    "src_port": "any",
                    "direction": "->",
                    "dst_ip": "any",
                    "dst_port": "any",
                    "options": {
                        "msg": "Default Network Scan",
                        "content": "scan",
                        "sid": "20250003"
                    }
                }
            ]
            
            # 确保默认规则目录存在
            default_dir = os.path.join(self.rules_dir, "default")
            os.makedirs(default_dir, exist_ok=True)
            
            # 创建默认规则文件
            rule_file = os.path.join(default_dir, "default_rules.rules")
            with open(rule_file, 'w', encoding='utf-8') as f:
                for rule in default_rules:
                    f.write(f"{rule['action']} {rule['protocol']} {rule['src_ip']} {rule['src_port']} {rule['direction']} {rule['dst_ip']} {rule['dst_port']} (msg:\"{rule['options']['msg']}\"; content:\"{rule['options']['content']}\"; sid:{rule['options']['sid']};)\n")
            
            logger.info("成功创建默认Suricata规则")
            
        except Exception as e:
            logger.error(f"创建默认Suricata规则失败: {e}")
            raise 