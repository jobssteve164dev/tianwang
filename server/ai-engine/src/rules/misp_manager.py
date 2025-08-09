"""
MISP威胁情报管理器
负责集成和管理MISP威胁情报平台的IOC数据
"""
import os
import json
import aiohttp
import asyncio
from typing import Dict, List, Any, Optional
from loguru import logger
from datetime import datetime, timedelta
import hashlib
import ipaddress

class MispManager:
    """MISP威胁情报管理器"""
    
    def __init__(self, config: Dict[str, Any] = None):
        self.config = config or {}
        self.misp_url = self.config.get("misp_url", "")
        self.api_key = self.config.get("misp_api_key", "")
        self.iocs: Dict[str, List[Dict[str, Any]]] = {
            "ip": [],
            "domain": [],
            "url": [],
            "hash": [],
            "email": [],
            "filename": []
        }
        self.last_update = None
        
    async def fetch_threat_intelligence(self, days: int = 7) -> bool:
        """获取威胁情报数据"""
        try:
            if not self.misp_url or not self.api_key:
                logger.warning("MISP配置不完整，使用模拟威胁情报数据")
                await self._load_mock_iocs()
                return True
            
            logger.info(f"正在从MISP获取最近 {days} 天的威胁情报...")
            
            # 计算时间范围
            end_date = datetime.now()
            start_date = end_date - timedelta(days=days)
            
            # 构建MISP API请求
            headers = {
                "Authorization": self.api_key,
                "Accept": "application/json",
                "Content-Type": "application/json"
            }
            
            # 获取事件数据
            search_params = {
                "returnFormat": "json",
                "type": "json",
                "category": ["Network activity", "Payload delivery", "Artifacts dropped"],
                "date_from": start_date.strftime("%Y-%m-%d"),
                "date_to": end_date.strftime("%Y-%m-%d"),
                "published": True
            }
            
            async with aiohttp.ClientSession() as session:
                url = f"{self.misp_url}/attributes/restSearch"
                
                async with session.post(url, headers=headers, json=search_params, timeout=60) as response:
                    if response.status == 200:
                        data = await response.json()
                        await self._process_misp_data(data)
                        logger.info("成功获取MISP威胁情报数据")
                        return True
                    else:
                        logger.error(f"MISP API请求失败，状态码: {response.status}")
                        # 回退到模拟数据
                        await self._load_mock_iocs()
                        return True
                        
        except Exception as e:
            logger.error(f"获取MISP威胁情报失败: {e}")
            # 回退到模拟数据
            await self._load_mock_iocs()
            return True
    
    async def _process_misp_data(self, data: Dict[str, Any]):
        """处理MISP数据"""
        try:
            # 清空现有IOC数据
            for ioc_type in self.iocs:
                self.iocs[ioc_type].clear()
            
            attributes = data.get("response", {}).get("Attribute", [])
            
            for attr in attributes:
                ioc_type = self._classify_ioc_type(attr.get("type", ""))
                if ioc_type:
                    ioc = {
                        "id": attr.get("id"),
                        "value": attr.get("value", ""),
                        "type": attr.get("type", ""),
                        "category": attr.get("category", ""),
                        "comment": attr.get("comment", ""),
                        "timestamp": attr.get("timestamp", ""),
                        "event_id": attr.get("event_id", ""),
                        "confidence": self._calculate_confidence(attr),
                        "source": "misp",
                        "created_at": datetime.now().isoformat()
                    }
                    self.iocs[ioc_type].append(ioc)
            
            self.last_update = datetime.now()
            
            # 统计信息
            total_iocs = sum(len(iocs) for iocs in self.iocs.values())
            logger.info(f"处理了 {total_iocs} 个IOC指标")
            
        except Exception as e:
            logger.error(f"处理MISP数据失败: {e}")
    
    async def _load_mock_iocs(self):
        """加载模拟威胁情报数据"""
        try:
            logger.info("加载模拟威胁情报数据...")
            
            # 清空现有数据
            for ioc_type in self.iocs:
                self.iocs[ioc_type].clear()
            
            # 模拟IP威胁情报
            malicious_ips = [
                "192.168.100.100", "10.0.0.200", "172.16.1.50",
                "203.0.113.100", "198.51.100.200", "192.0.2.150"
            ]
            
            for ip in malicious_ips:
                self.iocs["ip"].append({
                    "id": f"mock_ip_{hash(ip) % 10000}",
                    "value": ip,
                    "type": "ip-dst",
                    "category": "Network activity",
                    "comment": "Malicious IP address",
                    "confidence": 0.8,
                    "source": "mock",
                    "created_at": datetime.now().isoformat()
                })
            
            # 模拟域名威胁情报
            malicious_domains = [
                "malware-c2.example.com", "phishing-site.fake",
                "trojan-download.bad", "suspicious-domain.net"
            ]
            
            for domain in malicious_domains:
                self.iocs["domain"].append({
                    "id": f"mock_domain_{hash(domain) % 10000}",
                    "value": domain,
                    "type": "domain",
                    "category": "Network activity",
                    "comment": "Malicious domain",
                    "confidence": 0.7,
                    "source": "mock",
                    "created_at": datetime.now().isoformat()
                })
            
            # 模拟文件哈希威胁情报
            malicious_hashes = [
                "d41d8cd98f00b204e9800998ecf8427e",
                "5d41402abc4b2a76b9719d911017c592",
                "098f6bcd4621d373cade4e832627b4f6"
            ]
            
            for hash_value in malicious_hashes:
                self.iocs["hash"].append({
                    "id": f"mock_hash_{hash(hash_value) % 10000}",
                    "value": hash_value,
                    "type": "md5",
                    "category": "Artifacts dropped",
                    "comment": "Malicious file hash",
                    "confidence": 0.9,
                    "source": "mock",
                    "created_at": datetime.now().isoformat()
                })
            
            self.last_update = datetime.now()
            logger.info("模拟威胁情报数据加载完成")
            
        except Exception as e:
            logger.error(f"加载模拟威胁情报数据失败: {e}")
    
    def _classify_ioc_type(self, misp_type: str) -> Optional[str]:
        """分类IOC类型"""
        type_mapping = {
            "ip-src": "ip",
            "ip-dst": "ip",
            "ip": "ip",
            "domain": "domain",
            "hostname": "domain",
            "url": "url",
            "link": "url",
            "md5": "hash",
            "sha1": "hash",
            "sha256": "hash",
            "sha512": "hash",
            "email-src": "email",
            "email-dst": "email",
            "filename": "filename"
        }
        
        return type_mapping.get(misp_type.lower())
    
    def _calculate_confidence(self, attr: Dict[str, Any]) -> float:
        """计算IOC置信度"""
        # 基于MISP属性计算置信度
        confidence = 0.5  # 默认置信度
        
        # 根据来源调整置信度
        if attr.get("to_ids", False):
            confidence += 0.2
        
        # 根据类别调整置信度
        category = attr.get("category", "").lower()
        if "malware" in category or "trojan" in category:
            confidence += 0.3
        elif "suspicious" in category:
            confidence += 0.1
        
        return min(confidence, 1.0)
    
    async def check_ioc(self, ioc_value: str, ioc_type: str = None) -> List[Dict[str, Any]]:
        """检查IOC指标"""
        matches = []
        
        try:
            # 如果指定了类型，只检查该类型
            if ioc_type and ioc_type in self.iocs:
                types_to_check = [ioc_type]
            else:
                # 自动检测类型
                types_to_check = self._detect_ioc_types(ioc_value)
            
            for check_type in types_to_check:
                if check_type in self.iocs:
                    for ioc in self.iocs[check_type]:
                        if await self._match_ioc(ioc_value, ioc):
                            match = {
                                "ioc_id": ioc["id"],
                                "ioc_value": ioc["value"],
                                "ioc_type": ioc["type"],
                                "category": ioc["category"],
                                "comment": ioc["comment"],
                                "confidence": ioc["confidence"],
                                "source": ioc["source"],
                                "matched_value": ioc_value,
                                "timestamp": datetime.now().isoformat()
                            }
                            matches.append(match)
            
        except Exception as e:
            logger.error(f"检查IOC失败: {e}")
        
        return matches
    
    def _detect_ioc_types(self, value: str) -> List[str]:
        """自动检测IOC类型"""
        types = []
        
        # 检查IP地址
        try:
            ipaddress.ip_address(value)
            types.append("ip")
        except ValueError:
            pass
        
        # 检查域名
        if "." in value and not value.replace(".", "").replace("-", "").isdigit():
            types.append("domain")
        
        # 检查哈希
        if len(value) == 32 and value.isalnum():  # MD5
            types.append("hash")
        elif len(value) == 40 and value.isalnum():  # SHA1
            types.append("hash")
        elif len(value) == 64 and value.isalnum():  # SHA256
            types.append("hash")
        
        # 检查URL
        if value.startswith(("http://", "https://", "ftp://")):
            types.append("url")
        
        # 检查邮箱
        if "@" in value and "." in value:
            types.append("email")
        
        return types
    
    async def _match_ioc(self, value: str, ioc: Dict[str, Any]) -> bool:
        """匹配IOC"""
        try:
            ioc_value = ioc["value"]
            
            # 精确匹配
            if value.lower() == ioc_value.lower():
                return True
            
            # 域名子域匹配
            if ioc.get("type") == "domain":
                if value.lower().endswith(f".{ioc_value.lower()}"):
                    return True
            
            # URL包含匹配
            if ioc.get("type") == "url":
                if ioc_value.lower() in value.lower():
                    return True
            
            return False
            
        except Exception as e:
            logger.debug(f"IOC匹配失败: {e}")
            return False
    
    async def check_network_data(self, network_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """检查网络数据中的IOC"""
        matches = []
        
        try:
            # 检查IP地址
            for ip_field in ["src_ip", "dst_ip", "remote_ip", "server_ip"]:
                if ip_field in network_data:
                    ip_matches = await self.check_ioc(network_data[ip_field], "ip")
                    matches.extend(ip_matches)
            
            # 检查域名
            for domain_field in ["domain", "hostname", "server_name"]:
                if domain_field in network_data:
                    domain_matches = await self.check_ioc(network_data[domain_field], "domain")
                    matches.extend(domain_matches)
            
            # 检查URL
            for url_field in ["url", "request_url", "referer"]:
                if url_field in network_data:
                    url_matches = await self.check_ioc(network_data[url_field], "url")
                    matches.extend(url_matches)
                    
        except Exception as e:
            logger.error(f"检查网络数据IOC失败: {e}")
        
        return matches
    
    async def check_file_data(self, file_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """检查文件数据中的IOC"""
        matches = []
        
        try:
            # 检查文件哈希
            for hash_field in ["md5", "sha1", "sha256", "hash"]:
                if hash_field in file_data:
                    hash_matches = await self.check_ioc(file_data[hash_field], "hash")
                    matches.extend(hash_matches)
            
            # 检查文件名
            if "filename" in file_data:
                filename_matches = await self.check_ioc(file_data["filename"], "filename")
                matches.extend(filename_matches)
                
        except Exception as e:
            logger.error(f"检查文件数据IOC失败: {e}")
        
        return matches
    
    def get_statistics(self) -> Dict[str, Any]:
        """获取威胁情报统计信息"""
        stats = {
            "total_iocs": sum(len(iocs) for iocs in self.iocs.values()),
            "iocs_by_type": {ioc_type: len(iocs) for ioc_type, iocs in self.iocs.items()},
            "last_update": self.last_update.isoformat() if self.last_update else None,
            "data_sources": set()
        }
        
        # 统计数据源
        for iocs in self.iocs.values():
            for ioc in iocs:
                stats["data_sources"].add(ioc.get("source", "unknown"))
        
        stats["data_sources"] = list(stats["data_sources"])
        
        return stats
    
    async def add_custom_ioc(self, ioc_data: Dict[str, Any]) -> bool:
        """添加自定义IOC"""
        try:
            # 验证IOC数据
            if "value" not in ioc_data or "type" not in ioc_data:
                logger.error("自定义IOC缺少必需字段")
                return False
            
            ioc_type = self._classify_ioc_type(ioc_data["type"])
            if not ioc_type:
                logger.error(f"不支持的IOC类型: {ioc_data['type']}")
                return False
            
            # 创建IOC记录
            ioc = {
                "id": f"custom_{hash(ioc_data['value']) % 100000}",
                "value": ioc_data["value"],
                "type": ioc_data["type"],
                "category": ioc_data.get("category", "Custom"),
                "comment": ioc_data.get("comment", "Custom IOC"),
                "confidence": ioc_data.get("confidence", 0.5),
                "source": "custom",
                "created_at": datetime.now().isoformat()
            }
            
            # 添加到对应类型的IOC列表
            self.iocs[ioc_type].append(ioc)
            
            logger.info(f"成功添加自定义IOC: {ioc_data['value']}")
            return True
            
        except Exception as e:
            logger.error(f"添加自定义IOC失败: {e}")
            return False
    
    async def update_threat_intelligence(self) -> bool:
        """更新威胁情报"""
        try:
            logger.info("开始更新威胁情报...")
            
            success = await self.fetch_threat_intelligence()
            if success:
                logger.info("威胁情报更新成功")
            else:
                logger.error("威胁情报更新失败")
            
            return success
            
        except Exception as e:
            logger.error(f"更新威胁情报失败: {e}")
            return False 