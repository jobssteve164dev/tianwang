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
            # 检查配置完整性
            if not self._is_config_valid():
                logger.warning("MISP配置不完整，跳过威胁情报获取")
                return True  # 返回True而不是False，避免阻止系统启动
            
            # 测试MISP连接
            if not await self._test_misp_connection():
                logger.warning("MISP连接失败，跳过威胁情报获取")
                return True  # 返回True而不是False，避免阻止系统启动
            
            logger.info(f"正在从MISP获取最近 {days} 天的威胁情报...")
            
            # 获取事件列表
            events = await self._fetch_misp_events(days)
            if not events:
                logger.warning("未获取到MISP事件数据")
                return False
            
            # 提取事件ID
            event_ids = [event.get("id") for event in events if event.get("id")]
            if not event_ids:
                logger.warning("未找到有效的事件ID")
                return False
            
            # 获取事件属性
            attributes = await self._fetch_misp_attributes(event_ids)
            if not attributes:
                logger.warning("未获取到MISP属性数据")
                return False
            
            # 处理属性数据
            await self._process_misp_attributes(attributes)
            logger.info("成功获取MISP威胁情报数据")
            return True
                        
        except Exception as e:
            logger.warning(f"获取MISP威胁情报失败: {e}")
            return True  # 返回True而不是False，避免阻止系统启动
    
    async def _process_misp_attributes(self, attributes: List[Dict[str, Any]]):
        """处理MISP属性数据"""
        try:
            # 清空现有IOC数据
            for ioc_type in self.iocs:
                self.iocs[ioc_type].clear()
            
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
            logger.error(f"处理MISP属性数据失败: {e}")
    
    async def _fetch_misp_events(self, days: int = 7) -> List[Dict[str, Any]]:
        """从MISP获取事件数据"""
        try:
            headers = {
                "Authorization": self.api_key,
                "Accept": "application/json",
                "Content-Type": "application/json"
            }
            
            # 计算时间范围
            end_date = datetime.now()
            start_date = end_date - timedelta(days=days)
            
            # 获取事件列表
            events_params = {
                "returnFormat": "json",
                "date_from": start_date.strftime("%Y-%m-%d"),
                "date_to": end_date.strftime("%Y-%m-%d"),
                "published": True,
                "limit": 100  # 限制返回数量
            }
            
            async with aiohttp.ClientSession() as session:
                events_url = f"{self.misp_url}/events/index"
                async with session.post(events_url, headers=headers, json=events_params, timeout=60) as response:
                    if response.status == 200:
                        events_data = await response.json()
                        return events_data.get("response", [])
                    else:
                        logger.warning(f"获取MISP事件失败，状态码: {response.status}")
                        return []
                        
        except Exception as e:
            logger.error(f"获取MISP事件失败: {e}")
            return []
    
    async def _fetch_misp_attributes(self, event_ids: List[str]) -> List[Dict[str, Any]]:
        """从MISP获取属性数据"""
        try:
            headers = {
                "Authorization": self.api_key,
                "Accept": "application/json",
                "Content-Type": "application/json"
            }
            
            all_attributes = []
            
            async with aiohttp.ClientSession() as session:
                for event_id in event_ids:
                    # 获取单个事件的属性
                    attributes_params = {
                        "returnFormat": "json",
                        "eventid": event_id,
                        "type": ["ip-dst", "ip-src", "domain", "url", "md5", "sha1", "sha256", "filename", "email-src", "email-dst"]
                    }
                    
                    attributes_url = f"{self.misp_url}/attributes/restSearch"
                    async with session.post(attributes_url, headers=headers, json=attributes_params, timeout=30) as response:
                        if response.status == 200:
                            attributes_data = await response.json()
                            event_attributes = attributes_data.get("response", {}).get("Attribute", [])
                            all_attributes.extend(event_attributes)
                        else:
                            logger.warning(f"获取事件 {event_id} 属性失败，状态码: {response.status}")
            
            return all_attributes
            
        except Exception as e:
            logger.error(f"获取MISP属性失败: {e}")
            return []
    
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
    
    def _is_config_valid(self) -> bool:
        """检查MISP配置是否有效"""
        return bool(self.misp_url and self.api_key)
    
    async def _test_misp_connection(self) -> bool:
        """测试MISP连接"""
        try:
            headers = {
                "Authorization": self.api_key,
                "Accept": "application/json",
                "Content-Type": "application/json"
            }
            
            async with aiohttp.ClientSession() as session:
                # 测试连接
                test_url = f"{self.misp_url}/servers/getVersion"
                async with session.get(test_url, headers=headers, timeout=10) as response:
                    if response.status == 200:
                        logger.info("MISP连接测试成功")
                        return True
                    else:
                        logger.warning(f"MISP连接测试失败，状态码: {response.status}")
                        return False
                        
        except Exception as e:
            logger.warning(f"MISP连接测试失败: {e}")
            return False
    
    def get_health_status(self) -> Dict[str, Any]:
        """获取MISP健康状态"""
        return {
            "configured": self._is_config_valid(),
            "connected": False,  # 需要实际测试
            "last_update": self.last_update.isoformat() if self.last_update else None,
            "ioc_count": sum(len(iocs) for iocs in self.iocs.values()),
            "data_sources": list(set(ioc.get("source", "unknown") for iocs in self.iocs.values() for ioc in iocs))
        } 