"""
数据处理工具类
用于处理训练数据和实时数据的预处理
"""
import numpy as np
import pandas as pd
from typing import Dict, List, Any, Optional
from loguru import logger
from sklearn.preprocessing import LabelEncoder, StandardScaler
import json

class DataProcessor:
    """数据处理器"""
    
    def __init__(self):
        self.label_encoders: Dict[str, LabelEncoder] = {}
        self.feature_columns = {
            "anomaly_detection": [],
            "malware_detection": [],
            "network_intrusion": [],
            "user_behavior": []
        }
    
    async def process_training_data(self, raw_data: List[Dict[str, Any]], 
                                  model_name: str) -> Dict[str, Any]:
        """处理训练数据"""
        try:
            logger.info(f"开始处理 {model_name} 的训练数据，样本数: {len(raw_data)}")
            
            if model_name == "anomaly_detection":
                return await self._process_anomaly_training_data(raw_data)
            elif model_name == "malware_detection":
                return await self._process_malware_training_data(raw_data)
            elif model_name == "network_intrusion":
                return await self._process_network_training_data(raw_data)
            elif model_name == "user_behavior":
                return await self._process_behavior_training_data(raw_data)
            else:
                raise ValueError(f"未知的模型类型: {model_name}")
                
        except Exception as e:
            logger.error(f"训练数据处理失败: {e}")
            raise
    
    async def _process_anomaly_training_data(self, raw_data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """处理异常检测训练数据"""
        features = []
        
        for data in raw_data:
            # 提取特征（这里简化处理）
            feature_vector = [
                data.get('cpu_usage', 0),
                data.get('memory_usage', 0),
                data.get('disk_usage', 0),
                data.get('network_activity', 0),
                len(data.get('processes', [])),
                len(data.get('connections', [])),
                data.get('bytes_sent', 0),
                data.get('bytes_recv', 0)
            ]
            
            # 补齐特征向量到固定长度
            while len(feature_vector) < 50:
                feature_vector.append(0.0)
            
            features.append(feature_vector[:50])
        
        return {
            "features": np.array(features),
            "labels": None  # 异常检测是无监督学习
        }
    
    async def _process_malware_training_data(self, raw_data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """处理恶意软件检测训练数据"""
        features = []
        labels = []
        
        for data in raw_data:
            # 提取特征
            feature_vector = [
                data.get('file_size', 0),
                1 if data.get('file_extension', '').lower() in ['.exe', '.dll', '.sys'] else 0,
                data.get('entropy', 0),
                len(data.get('api_calls', [])),
                len(data.get('strings', [])),
                data.get('network_activity', 0)
            ]
            
            # 补齐特征向量
            while len(feature_vector) < 40:
                feature_vector.append(0.0)
            
            features.append(feature_vector[:40])
            
            # 标签
            is_malware = data.get('is_malware', 0)
            labels.append(int(is_malware))
        
        return {
            "features": np.array(features),
            "labels": np.array(labels)
        }
    
    async def _process_network_training_data(self, raw_data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """处理网络入侵检测训练数据"""
        features = []
        labels = []
        
        for data in raw_data:
            # 提取网络特征
            feature_vector = [
                data.get('duration', 0),
                data.get('protocol_type', 0),  # 需要编码
                data.get('service', 0),  # 需要编码
                data.get('src_bytes', 0),
                data.get('dst_bytes', 0),
                data.get('count', 0),
                data.get('srv_count', 0),
                data.get('same_srv_rate', 0),
                data.get('diff_srv_rate', 0)
            ]
            
            # 补齐特征向量
            while len(feature_vector) < 35:
                feature_vector.append(0.0)
            
            features.append(feature_vector[:35])
            
            # 标签
            is_attack = data.get('is_attack', 0)
            labels.append(int(is_attack))
        
        return {
            "features": np.array(features),
            "labels": np.array(labels)
        }
    
    async def _process_behavior_training_data(self, raw_data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """处理用户行为分析训练数据"""
        features = []
        
        for data in raw_data:
            # 提取用户行为特征
            feature_vector = [
                data.get('login_frequency', 0),
                data.get('access_time_variance', 0),
                data.get('resource_usage_avg', 0),
                data.get('file_access_count', 0),
                data.get('network_usage', 0),
                data.get('session_duration', 0)
            ]
            
            # 补齐特征向量
            while len(feature_vector) < 30:
                feature_vector.append(0.0)
            
            features.append(feature_vector[:30])
        
        return {
            "features": np.array(features),
            "labels": None  # 聚类是无监督学习
        }
    
    def normalize_features(self, features: np.ndarray) -> np.ndarray:
        """标准化特征"""
        scaler = StandardScaler()
        return scaler.fit_transform(features)
    
    def encode_categorical_features(self, data: List[str], column_name: str) -> np.ndarray:
        """编码分类特征"""
        if column_name not in self.label_encoders:
            self.label_encoders[column_name] = LabelEncoder()
        
        return self.label_encoders[column_name].fit_transform(data)
    
    def preprocess_real_time_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """预处理实时数据"""
        try:
            # 数据清洗
            cleaned_data = self._clean_data(data)
            
            # 数据验证
            validated_data = self._validate_data(cleaned_data)
            
            # 数据转换
            transformed_data = self._transform_data(validated_data)
            
            return transformed_data
            
        except Exception as e:
            logger.error(f"实时数据预处理失败: {e}")
            raise
    
    def _clean_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """清洗数据"""
        cleaned = {}
        
        for key, value in data.items():
            # 处理空值
            if value is None:
                cleaned[key] = 0 if isinstance(value, (int, float)) else ""
            # 处理数值类型
            elif isinstance(value, str) and value.replace('.', '').isdigit():
                cleaned[key] = float(value)
            else:
                cleaned[key] = value
        
        return cleaned
    
    def _validate_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """验证数据"""
        validated = data.copy()
        
        # 验证数值范围
        numeric_fields = ['cpu_usage', 'memory_usage', 'disk_usage']
        for field in numeric_fields:
            if field in validated:
                value = validated[field]
                if isinstance(value, (int, float)):
                    # 限制在0-100范围内
                    validated[field] = max(0, min(100, value))
        
        return validated
    
    def _transform_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """转换数据"""
        transformed = data.copy()
        
        # 时间戳转换
        if 'timestamp' in transformed:
            try:
                from datetime import datetime
                if isinstance(transformed['timestamp'], str):
                    dt = datetime.fromisoformat(transformed['timestamp'].replace('Z', '+00:00'))
                    transformed['timestamp'] = dt.timestamp()
            except Exception:
                pass
        
        return transformed
    
    async def create_training_dataset(self, positive_samples: List[Dict[str, Any]], 
                                     negative_samples: List[Dict[str, Any]], 
                                     model_name: str) -> Dict[str, Any]:
        """创建训练数据集"""
        try:
            # 合并正负样本
            all_samples = []
            labels = []
            
            # 添加正样本（威胁/异常）
            for sample in positive_samples:
                sample['label'] = 1
                all_samples.append(sample)
                labels.append(1)
            
            # 添加负样本（正常）
            for sample in negative_samples:
                sample['label'] = 0
                all_samples.append(sample)
                labels.append(0)
            
            # 处理数据
            processed_data = await self.process_training_data(all_samples, model_name)
            
            return {
                "features": processed_data["features"],
                "labels": np.array(labels),
                "sample_count": len(all_samples),
                "positive_count": len(positive_samples),
                "negative_count": len(negative_samples)
            }
            
        except Exception as e:
            logger.error(f"创建训练数据集失败: {e}")
            raise
    
    def balance_dataset(self, features: np.ndarray, labels: np.ndarray) -> tuple:
        """平衡数据集"""
        try:
            from sklearn.utils import resample
            
            # 分离正负样本
            positive_indices = np.where(labels == 1)[0]
            negative_indices = np.where(labels == 0)[0]
            
            positive_features = features[positive_indices]
            negative_features = features[negative_indices]
            
            # 计算需要的样本数
            target_count = min(len(positive_indices), len(negative_indices))
            
            # 重采样
            if len(positive_indices) > target_count:
                positive_resampled = resample(positive_features, n_samples=target_count, random_state=42)
                positive_labels = np.ones(target_count)
            else:
                positive_resampled = positive_features
                positive_labels = np.ones(len(positive_features))
            
            if len(negative_indices) > target_count:
                negative_resampled = resample(negative_features, n_samples=target_count, random_state=42)
                negative_labels = np.zeros(target_count)
            else:
                negative_resampled = negative_features
                negative_labels = np.zeros(len(negative_features))
            
            # 合并数据
            balanced_features = np.vstack([positive_resampled, negative_resampled])
            balanced_labels = np.hstack([positive_labels, negative_labels])
            
            # 打乱数据
            indices = np.random.permutation(len(balanced_features))
            
            return balanced_features[indices], balanced_labels[indices]
            
        except Exception as e:
            logger.error(f"数据集平衡失败: {e}")
            raise 