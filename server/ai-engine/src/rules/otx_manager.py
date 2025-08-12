"""
OTX威胁情报管理器
负责集成和管理AlienVault Open Threat Exchange的威胁情报数据
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

class OtxManager:
    """OTX威胁情报管理器"""
    
    def __init__(self, config: Dict[str, Any] = None):
        self.config = config or {}
        self.api_key = self.config.get("otx_api_key", "")
        self.base_url = "https://otx.alienvault.com/api/v1"
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
            if not self.api_key:
                logger.error("OTX API密钥未配置，无法获取威胁情报数据")
                return False
            
            logger.info(f"正在从OTX获取最近 {days} 天的威胁情报...")
            
            # 获取脉冲数据
            pulses = await self._fetch_pulses(days)
            if not pulses:
                logger.warning("未获取到OTX脉冲数据")
                return False
            
            # 处理脉冲数据
            await self._process_pulses(pulses)
            logger.info("成功获取OTX威胁情报数据")
            return True
            
        except Exception as e:
            logger.error(f"获取OTX威胁情报失败: {e}")
            return False
    
    async def _fetch_pulses(self, days: int = 7) -> List[Dict[str, Any]]:
        """获取OTX脉冲数据"""
        try:
            headers = {
                "X-OTX-API-KEY": self.api_key,
                "Accept": "application/json"
            }
            
            # 计算时间范围
            end_date = datetime.now()
            start_date = end_date - timedelta(days=days)
            
            # 获取脉冲列表
            params = {
                "limit": 100,
                "modified_since": start_date.isoformat(),
                "include_inactive": False
            }
            
            async with aiohttp.ClientSession() as session:
                url = f"{self.base_url}/search/pulses"
                async with session.get(url, headers=headers, params=params, timeout=60) as response:
                    if response.status == 200:
                        data = await response.json()
                        return data.get("results", [])
                    else:
                        logger.error(f"获取OTX脉冲失败，状态码: {response.status}")
                        return []
                        
        except Exception as e:
            logger.error(f"获取OTX脉冲失败: {e}")
            return []
    
    async def _process_pulses(self, pulses: List[Dict[str, Any]]):
        """处理OTX脉冲数据"""
        try:
            # 清空现有IOC数据
            for ioc_type in self.iocs:
                self.iocs[ioc_type].clear()
            
            for pulse in pulses:
                pulse_id = pulse.get("id")
                pulse_name = pulse.get("name", "")
                pulse_description = pulse.get("description", "")
                pulse_tags = pulse.get("tags", [])
                pulse_created = pulse.get("created", "")
                
                # 处理脉冲中的指标
                indicators = pulse.get("indicators", [])
                for indicator in indicators:
                    ioc_type = self._classify_ioc_type(indicator.get("type", ""))
                    if ioc_type:
                        ioc = {
                            "id": indicator.get("id"),
                            "value": indicator.get("indicator", ""),
                            "type": indicator.get("type", ""),
                            "category": pulse_name,
                            "comment": pulse_description,
                            "timestamp": pulse_created,
                            "pulse_id": pulse_id,
                            "confidence": self._calculate_confidence(indicator, pulse),
                            "source": "otx",
                            "tags": pulse_tags,
                            "created_at": datetime.now().isoformat()
                        }
                        self.iocs[ioc_type].append(ioc)
            
            self.last_update = datetime.now()
            
            # 统计信息
            total_iocs = sum(len(iocs) for iocs in self.iocs.values())
            logger.info(f"处理了 {total_iocs} 个OTX IOC指标")
            
        except Exception as e:
            logger.error(f"处理OTX脉冲数据失败: {e}")
    
    def _classify_ioc_type(self, otx_type: str) -> Optional[str]:
        """分类OTX IOC类型"""
        type_mapping = {
            "IPv4": "ip",
            "IPv6": "ip",
            "domain": "domain",
            "hostname": "domain",
            "url": "url",
            "URI": "url",
            "FileHash-MD5": "hash",
            "FileHash-SHA1": "hash",
            "FileHash-SHA256": "hash",
            "FileHash-SHA512": "hash",
            "email": "email",
            "email-subject": "email",
            "filename": "filename"
        }
        
        return type_mapping.get(otx_type)
    
    def _calculate_confidence(self, indicator: Dict[str, Any], pulse: Dict[str, Any]) -> float:
        """计算IOC置信度"""
        confidence = 0.5  # 基础置信度
        
        # 根据脉冲信息调整置信度
        pulse_tags = pulse.get("tags", [])
        if "malware" in pulse_tags:
            confidence += 0.2
        if "apt" in pulse_tags:
            confidence += 0.3
        if "ransomware" in pulse_tags:
            confidence += 0.2
        
        # 根据指标类型调整置信度
        indicator_type = indicator.get("type", "")
        if indicator_type in ["FileHash-SHA256", "FileHash-SHA512"]:
            confidence += 0.1
        elif indicator_type in ["IPv4", "IPv6"]:
            confidence += 0.05
        
        return min(confidence, 1.0)
    
    async def check_ioc(self, value: str, ioc_type: str) -> List[Dict[str, Any]]:
        """检查单个IOC"""
        matches = []
        
        try:
            # 标准化IOC类型
            normalized_type = self._classify_ioc_type(ioc_type)
            if not normalized_type:
                return matches
            
            # 在本地IOC数据中查找
            for ioc in self.iocs[normalized_type]:
                if ioc["value"].lower() == value.lower():
                    matches.append({
                        "ioc_id": ioc["id"],
                        "value": ioc["value"],
                        "type": ioc["type"],
                        "category": ioc["category"],
                        "confidence": ioc["confidence"],
                        "source": ioc["source"],
                        "tags": ioc.get("tags", []),
                        "timestamp": ioc["timestamp"]
                    })
            
            # 如果本地没有找到，尝试在线查询
            if not matches and self.api_key:
                online_match = await self._query_otx_online(value, ioc_type)
                if online_match:
                    matches.append(online_match)
                    
        except Exception as e:
            logger.error(f"检查OTX IOC失败: {e}")
        
        return matches
    
    async def _query_otx_online(self, value: str, ioc_type: str) -> Optional[Dict[str, Any]]:
        """在线查询OTX IOC"""
        try:
            headers = {
                "X-OTX-API-KEY": self.api_key,
                "Accept": "application/json"
            }
            
            # 构建查询URL
            query_url = f"{self.base_url}/indicators/{ioc_type}/{value}/general"
            
            async with aiohttp.ClientSession() as session:
                async with session.get(query_url, headers=headers, timeout=30) as response:
                    if response.status == 200:
                        data = await response.json()
                        
                        # 提取威胁信息
                        threat_info = {
                            "ioc_id": f"otx_online_{hash(value) % 100000}",
                            "value": value,
                            "type": ioc_type,
                            "category": "Online Query",
                            "confidence": 0.7,
                            "source": "otx_online",
                            "tags": data.get("tags", []),
                            "timestamp": datetime.now().isoformat()
                        }
                        
                        return threat_info
                    else:
                        logger.debug(f"在线查询OTX IOC失败，状态码: {response.status}")
                        return None
                        
        except Exception as e:
            logger.debug(f"在线查询OTX IOC失败: {e}")
            return None
    
    def get_statistics(self) -> Dict[str, Any]:
        """获取威胁情报统计信息"""
        stats = {
            "total_iocs": sum(len(iocs) for iocs in self.iocs.values()),
            "iocs_by_type": {ioc_type: len(iocs) for ioc_type, iocs in self.iocs.items()},
            "last_update": self.last_update.isoformat() if self.last_update else None,
            "data_sources": ["otx"],
            "configured": bool(self.api_key)
        }
        
        return stats
    
    def get_health_status(self) -> Dict[str, Any]:
        """获取OTX健康状态"""
        return {
            "configured": bool(self.api_key),
            "connected": False,  # 需要实际测试
            "last_update": self.last_update.isoformat() if self.last_update else None,
            "ioc_count": sum(len(iocs) for iocs in self.iocs.values()),
            "data_sources": ["otx"]
        }
