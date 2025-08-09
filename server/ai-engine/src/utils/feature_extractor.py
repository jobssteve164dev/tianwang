"""
特征提取工具类
从安全数据中提取AI模型所需的特征
"""
import re
import hashlib
import numpy as np
from typing import Dict, List, Any
from datetime import datetime, timedelta
from loguru import logger

class FeatureExtractor:
    """特征提取器"""
    
    def __init__(self):
        self.suspicious_keywords = [
            'malware', 'virus', 'trojan', 'backdoor', 'rootkit',
            'keylogger', 'spyware', 'adware', 'ransomware', 'botnet',
            'exploit', 'payload', 'shell', 'inject', 'bypass'
        ]
        
        self.network_ports = {
            'http': 80, 'https': 443, 'ftp': 21, 'ssh': 22,
            'telnet': 23, 'smtp': 25, 'dns': 53, 'dhcp': 67,
            'pop3': 110, 'imap': 143, 'snmp': 161, 'ldap': 389
        }
    
    async def extract_anomaly_features(self, data: Dict[str, Any]) -> List[float]:
        """提取异常检测特征"""
        features = []
        
        try:
            # 基础特征
            features.extend(self._extract_basic_features(data))
            
            # 网络特征
            features.extend(self._extract_network_features_basic(data))
            
            # 进程特征
            features.extend(self._extract_process_features(data))
            
            # 时间特征
            features.extend(self._extract_temporal_features(data))
            
            # 统计特征
            features.extend(self._extract_statistical_features(data))
            
            # 确保特征向量长度固定
            target_length = 50
            if len(features) < target_length:
                features.extend([0.0] * (target_length - len(features)))
            elif len(features) > target_length:
                features = features[:target_length]
            
            return features
            
        except Exception as e:
            logger.error(f"异常检测特征提取失败: {e}")
            # 返回零向量
            return [0.0] * 50
    
    async def extract_malware_features(self, data: Dict[str, Any]) -> List[float]:
        """提取恶意软件检测特征"""
        features = []
        
        try:
            # 文件特征
            features.extend(self._extract_file_features(data))
            
            # 行为特征
            features.extend(self._extract_behavior_features_basic(data))
            
            # 网络行为特征
            features.extend(self._extract_network_behavior_features(data))
            
            # 字符串特征
            features.extend(self._extract_string_features(data))
            
            # API调用特征
            features.extend(self._extract_api_features(data))
            
            # 确保特征向量长度固定
            target_length = 40
            if len(features) < target_length:
                features.extend([0.0] * (target_length - len(features)))
            elif len(features) > target_length:
                features = features[:target_length]
            
            return features
            
        except Exception as e:
            logger.error(f"恶意软件特征提取失败: {e}")
            return [0.0] * 40
    
    async def extract_network_features(self, data: Dict[str, Any]) -> List[float]:
        """提取网络入侵检测特征"""
        features = []
        
        try:
            # 连接特征
            features.extend(self._extract_connection_features(data))
            
            # 流量特征
            features.extend(self._extract_traffic_features(data))
            
            # 协议特征
            features.extend(self._extract_protocol_features(data))
            
            # 端口特征
            features.extend(self._extract_port_features(data))
            
            # 地理位置特征
            features.extend(self._extract_geo_features(data))
            
            # 确保特征向量长度固定
            target_length = 35
            if len(features) < target_length:
                features.extend([0.0] * (target_length - len(features)))
            elif len(features) > target_length:
                features = features[:target_length]
            
            return features
            
        except Exception as e:
            logger.error(f"网络特征提取失败: {e}")
            return [0.0] * 35
    
    async def extract_behavior_features(self, data: Dict[str, Any]) -> List[float]:
        """提取用户行为分析特征"""
        features = []
        
        try:
            # 用户活动特征
            features.extend(self._extract_user_activity_features(data))
            
            # 访问模式特征
            features.extend(self._extract_access_pattern_features(data))
            
            # 时间模式特征
            features.extend(self._extract_time_pattern_features(data))
            
            # 资源使用特征
            features.extend(self._extract_resource_usage_features(data))
            
            # 确保特征向量长度固定
            target_length = 30
            if len(features) < target_length:
                features.extend([0.0] * (target_length - len(features)))
            elif len(features) > target_length:
                features = features[:target_length]
            
            return features
            
        except Exception as e:
            logger.error(f"行为特征提取失败: {e}")
            return [0.0] * 30
    
    def _extract_basic_features(self, data: Dict[str, Any]) -> List[float]:
        """提取基础特征"""
        features = []
        
        # CPU使用率
        cpu_usage = data.get('system', {}).get('cpu_usage', 0)
        features.append(float(cpu_usage))
        
        # 内存使用率
        memory_usage = data.get('system', {}).get('memory_usage', 0)
        features.append(float(memory_usage))
        
        # 磁盘使用率
        disk_usage = data.get('system', {}).get('disk_usage', 0)
        features.append(float(disk_usage))
        
        # 进程数量
        process_count = len(data.get('processes', []))
        features.append(float(process_count))
        
        # 网络连接数
        connection_count = len(data.get('network', {}).get('connections', []))
        features.append(float(connection_count))
        
        return features
    
    def _extract_network_features_basic(self, data: Dict[str, Any]) -> List[float]:
        """提取基础网络特征"""
        features = []
        
        network_data = data.get('network', {})
        
        # 网络流量
        bytes_sent = network_data.get('bytes_sent', 0)
        bytes_recv = network_data.get('bytes_recv', 0)
        features.extend([float(bytes_sent), float(bytes_recv)])
        
        # 数据包数量
        packets_sent = network_data.get('packets_sent', 0)
        packets_recv = network_data.get('packets_recv', 0)
        features.extend([float(packets_sent), float(packets_recv)])
        
        # 错误和丢包
        errors = network_data.get('errors', 0)
        dropped = network_data.get('dropped', 0)
        features.extend([float(errors), float(dropped)])
        
        return features
    
    def _extract_process_features(self, data: Dict[str, Any]) -> List[float]:
        """提取进程特征"""
        features = []
        
        processes = data.get('processes', [])
        
        if not processes:
            return [0.0] * 8
        
        # 进程CPU使用率统计
        cpu_usages = [p.get('cpu_percent', 0) for p in processes]
        features.extend([
            np.mean(cpu_usages),
            np.std(cpu_usages),
            np.max(cpu_usages)
        ])
        
        # 进程内存使用统计
        memory_usages = [p.get('memory_percent', 0) for p in processes]
        features.extend([
            np.mean(memory_usages),
            np.std(memory_usages),
            np.max(memory_usages)
        ])
        
        # 可疑进程名称计数
        suspicious_count = 0
        for process in processes:
            name = process.get('name', '').lower()
            if any(keyword in name for keyword in self.suspicious_keywords):
                suspicious_count += 1
        
        features.append(float(suspicious_count))
        
        # 系统进程vs用户进程比例
        system_processes = sum(1 for p in processes if p.get('username') == 'SYSTEM')
        user_processes = len(processes) - system_processes
        ratio = system_processes / (user_processes + 1)  # 避免除零
        features.append(float(ratio))
        
        return features
    
    def _extract_temporal_features(self, data: Dict[str, Any]) -> List[float]:
        """提取时间特征"""
        features = []
        
        try:
            timestamp = data.get('timestamp', datetime.now().isoformat())
            dt = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
            
            # 时间特征
            features.extend([
                float(dt.hour),
                float(dt.weekday()),
                float(dt.day),
                float(dt.month)
            ])
            
            # 是否工作时间
            is_work_hour = 1.0 if 9 <= dt.hour <= 17 else 0.0
            is_weekend = 1.0 if dt.weekday() >= 5 else 0.0
            features.extend([is_work_hour, is_weekend])
            
        except Exception:
            features = [0.0] * 6
        
        return features
    
    def _extract_statistical_features(self, data: Dict[str, Any]) -> List[float]:
        """提取统计特征"""
        features = []
        
        # 数据完整性特征
        total_fields = 20  # 预期字段数
        actual_fields = len(data)
        completeness = actual_fields / total_fields
        features.append(float(completeness))
        
        # 数据变化率（简化计算）
        change_rate = 0.5  # 默认值，实际应该基于历史数据计算
        features.append(float(change_rate))
        
        return features
    
    def _extract_file_features(self, data: Dict[str, Any]) -> List[float]:
        """提取文件特征"""
        features = []
        
        file_info = data.get('file', {})
        
        # 文件大小
        file_size = file_info.get('size', 0)
        features.append(float(file_size))
        
        # 文件类型特征
        file_ext = file_info.get('extension', '').lower()
        executable_exts = ['.exe', '.dll', '.sys', '.bat', '.cmd', '.scr']
        is_executable = 1.0 if file_ext in executable_exts else 0.0
        features.append(is_executable)
        
        # 文件熵（复杂度指标）
        entropy = file_info.get('entropy', 0)
        features.append(float(entropy))
        
        return features
    
    def _extract_behavior_features_basic(self, data: Dict[str, Any]) -> List[float]:
        """提取基础行为特征"""
        features = []
        
        behavior = data.get('behavior', {})
        
        # 网络活动
        network_activity = behavior.get('network_activity', 0)
        features.append(float(network_activity))
        
        # 文件操作
        file_operations = behavior.get('file_operations', 0)
        features.append(float(file_operations))
        
        # 注册表操作
        registry_operations = behavior.get('registry_operations', 0)
        features.append(float(registry_operations))
        
        return features
    
    def _extract_network_behavior_features(self, data: Dict[str, Any]) -> List[float]:
        """提取网络行为特征"""
        features = []
        
        network = data.get('network', {})
        
        # 连接到的域名数量
        domains = network.get('domains', [])
        features.append(float(len(domains)))
        
        # 可疑域名数量
        suspicious_domains = sum(1 for domain in domains 
                               if any(keyword in domain.lower() 
                                     for keyword in self.suspicious_keywords))
        features.append(float(suspicious_domains))
        
        return features
    
    def _extract_string_features(self, data: Dict[str, Any]) -> List[float]:
        """提取字符串特征"""
        features = []
        
        strings = data.get('strings', [])
        
        # 字符串总数
        features.append(float(len(strings)))
        
        # 可疑字符串数量
        suspicious_strings = sum(1 for s in strings 
                               if any(keyword in s.lower() 
                                     for keyword in self.suspicious_keywords))
        features.append(float(suspicious_strings))
        
        return features
    
    def _extract_api_features(self, data: Dict[str, Any]) -> List[float]:
        """提取API调用特征"""
        features = []
        
        api_calls = data.get('api_calls', [])
        
        # API调用总数
        features.append(float(len(api_calls)))
        
        # 危险API调用数量
        dangerous_apis = ['CreateProcess', 'WriteProcessMemory', 'VirtualAlloc', 
                         'RegSetValue', 'CreateFile', 'InternetOpen']
        dangerous_count = sum(1 for api in api_calls 
                            if any(dangerous_api in api 
                                  for dangerous_api in dangerous_apis))
        features.append(float(dangerous_count))
        
        return features
    
    def _extract_connection_features(self, data: Dict[str, Any]) -> List[float]:
        """提取连接特征"""
        features = []
        
        connections = data.get('network', {}).get('connections', [])
        
        # 连接状态统计
        states = [conn.get('status', '') for conn in connections]
        established_count = states.count('ESTABLISHED')
        listening_count = states.count('LISTEN')
        
        features.extend([float(established_count), float(listening_count)])
        
        return features
    
    def _extract_traffic_features(self, data: Dict[str, Any]) -> List[float]:
        """提取流量特征"""
        features = []
        
        traffic = data.get('traffic', {})
        
        # 流量速率
        upload_rate = traffic.get('upload_rate', 0)
        download_rate = traffic.get('download_rate', 0)
        features.extend([float(upload_rate), float(download_rate)])
        
        return features
    
    def _extract_protocol_features(self, data: Dict[str, Any]) -> List[float]:
        """提取协议特征"""
        features = []
        
        protocols = data.get('protocols', {})
        
        # 协议分布
        tcp_count = protocols.get('tcp', 0)
        udp_count = protocols.get('udp', 0)
        features.extend([float(tcp_count), float(udp_count)])
        
        return features
    
    def _extract_port_features(self, data: Dict[str, Any]) -> List[float]:
        """提取端口特征"""
        features = []
        
        ports = data.get('ports', [])
        
        # 端口数量
        features.append(float(len(ports)))
        
        # 标准端口vs非标准端口
        standard_ports = sum(1 for port in ports if port in self.network_ports.values())
        non_standard_ports = len(ports) - standard_ports
        features.extend([float(standard_ports), float(non_standard_ports)])
        
        return features
    
    def _extract_geo_features(self, data: Dict[str, Any]) -> List[float]:
        """提取地理位置特征"""
        features = []
        
        geo_info = data.get('geo', {})
        
        # 国家代码（简化为数值）
        country_code = geo_info.get('country_code', 'US')
        country_risk = {'CN': 0.3, 'RU': 0.5, 'US': 0.1}.get(country_code, 0.2)
        features.append(float(country_risk))
        
        return features
    
    def _extract_user_activity_features(self, data: Dict[str, Any]) -> List[float]:
        """提取用户活动特征"""
        features = []
        
        activity = data.get('user_activity', {})
        
        # 活动统计
        login_count = activity.get('login_count', 0)
        file_access_count = activity.get('file_access_count', 0)
        features.extend([float(login_count), float(file_access_count)])
        
        return features
    
    def _extract_access_pattern_features(self, data: Dict[str, Any]) -> List[float]:
        """提取访问模式特征"""
        features = []
        
        patterns = data.get('access_patterns', {})
        
        # 访问频率
        access_frequency = patterns.get('frequency', 0)
        features.append(float(access_frequency))
        
        return features
    
    def _extract_time_pattern_features(self, data: Dict[str, Any]) -> List[float]:
        """提取时间模式特征"""
        features = []
        
        time_patterns = data.get('time_patterns', {})
        
        # 活动时间分布
        day_activity = time_patterns.get('day_activity', 0.5)
        night_activity = time_patterns.get('night_activity', 0.5)
        features.extend([float(day_activity), float(night_activity)])
        
        return features
    
    def _extract_resource_usage_features(self, data: Dict[str, Any]) -> List[float]:
        """提取资源使用特征"""
        features = []
        
        resources = data.get('resource_usage', {})
        
        # 资源使用统计
        avg_cpu = resources.get('avg_cpu', 0)
        avg_memory = resources.get('avg_memory', 0)
        features.extend([float(avg_cpu), float(avg_memory)])
        
        return features 