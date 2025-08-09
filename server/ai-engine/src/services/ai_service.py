"""
AI服务核心类
负责本地AI模型的管理、训练和推理
"""
import asyncio
import os
import pickle
import numpy as np
import pandas as pd
from typing import Dict, List, Any, Optional
from loguru import logger
from sklearn.ensemble import IsolationForest
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, confusion_matrix
import joblib
import json
from datetime import datetime

from ..config import config
from ..utils.data_processor import DataProcessor
from ..utils.feature_extractor import FeatureExtractor

class AIService:
    """AI服务主类"""
    
    def __init__(self):
        self.models: Dict[str, Any] = {}
        self.scalers: Dict[str, StandardScaler] = {}
        self.data_processor = DataProcessor()
        self.feature_extractor = FeatureExtractor()
        self.is_initialized = False
        self.metrics = {
            "predictions_count": 0,
            "anomalies_detected": 0,
            "threats_identified": 0,
            "last_prediction_time": None,
            "model_accuracy": {}
        }
    
    async def initialize(self):
        """初始化AI服务"""
        try:
            logger.info("正在初始化AI服务...")
            
            # 创建模型目录
            os.makedirs(config.model_path, exist_ok=True)
            
            # 初始化各种AI模型
            await self._initialize_anomaly_detection_model()
            await self._initialize_malware_detection_model()
            await self._initialize_network_intrusion_model()
            await self._initialize_user_behavior_model()
            
            self.is_initialized = True
            logger.info("AI服务初始化完成")
            
        except Exception as e:
            logger.error(f"AI服务初始化失败: {e}")
            raise
    
    async def _initialize_anomaly_detection_model(self):
        """初始化异常检测模型"""
        model_name = "anomaly_detection"
        model_path = os.path.join(config.model_path, f"{model_name}.joblib")
        
        try:
            if os.path.exists(model_path):
                # 加载已训练的模型
                self.models[model_name] = joblib.load(model_path)
                logger.info(f"已加载异常检测模型: {model_path}")
            else:
                # 创建新模型
                model_config = config.models[model_name]
                self.models[model_name] = IsolationForest(
                    contamination=model_config["contamination"],
                    n_estimators=model_config["n_estimators"],
                    random_state=model_config["random_state"]
                )
                logger.info("已创建新的异常检测模型")
                
        except Exception as e:
            logger.error(f"异常检测模型初始化失败: {e}")
            raise
    
    async def _initialize_malware_detection_model(self):
        """初始化恶意软件检测模型"""
        model_name = "malware_detection"
        # 这里先创建一个简单的分类器，后续可以替换为CNN
        try:
            from sklearn.ensemble import RandomForestClassifier
            self.models[model_name] = RandomForestClassifier(
                n_estimators=100,
                random_state=42
            )
            logger.info("已创建恶意软件检测模型")
        except Exception as e:
            logger.error(f"恶意软件检测模型初始化失败: {e}")
            raise
    
    async def _initialize_network_intrusion_model(self):
        """初始化网络入侵检测模型"""
        model_name = "network_intrusion"
        # 简单的分类器，后续可以替换为LSTM
        try:
            from sklearn.ensemble import GradientBoostingClassifier
            self.models[model_name] = GradientBoostingClassifier(
                n_estimators=100,
                random_state=42
            )
            logger.info("已创建网络入侵检测模型")
        except Exception as e:
            logger.error(f"网络入侵检测模型初始化失败: {e}")
            raise
    
    async def _initialize_user_behavior_model(self):
        """初始化用户行为分析模型"""
        model_name = "user_behavior"
        model_path = os.path.join(config.model_path, f"{model_name}.joblib")
        
        try:
            if os.path.exists(model_path):
                self.models[model_name] = joblib.load(model_path)
                logger.info(f"已加载用户行为分析模型: {model_path}")
            else:
                model_config = config.models[model_name]
                self.models[model_name] = KMeans(
                    n_clusters=model_config["n_clusters"],
                    random_state=model_config["random_state"]
                )
                logger.info("已创建新的用户行为分析模型")
                
        except Exception as e:
            logger.error(f"用户行为分析模型初始化失败: {e}")
            raise
    
    async def detect_anomaly(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """异常检测"""
        try:
            model = self.models.get("anomaly_detection")
            if not model:
                raise ValueError("异常检测模型未初始化")
            
            # 特征提取
            features = await self.feature_extractor.extract_anomaly_features(data)
            features_array = np.array(features).reshape(1, -1)
            
            # 标准化
            scaler_name = "anomaly_detection"
            if scaler_name not in self.scalers:
                self.scalers[scaler_name] = StandardScaler()
                # 如果模型已训练，尝试加载对应的scaler
                scaler_path = os.path.join(config.model_path, f"{scaler_name}_scaler.joblib")
                if os.path.exists(scaler_path):
                    self.scalers[scaler_name] = joblib.load(scaler_path)
                else:
                    # 使用当前数据拟合scaler（在生产环境中应该使用训练数据）
                    self.scalers[scaler_name].fit(features_array)
            
            features_scaled = self.scalers[scaler_name].transform(features_array)
            
            # 预测
            prediction = model.predict(features_scaled)[0]
            anomaly_score = model.score_samples(features_scaled)[0]
            
            # 更新指标
            self.metrics["predictions_count"] += 1
            self.metrics["last_prediction_time"] = datetime.now().isoformat()
            
            if prediction == -1:  # 异常
                self.metrics["anomalies_detected"] += 1
            
            result = {
                "is_anomaly": prediction == -1,
                "anomaly_score": float(anomaly_score),
                "confidence": float(abs(anomaly_score)),
                "model": "isolation_forest",
                "timestamp": datetime.now().isoformat()
            }
            
            logger.debug(f"异常检测结果: {result}")
            return result
            
        except Exception as e:
            logger.error(f"异常检测失败: {e}")
            raise
    
    async def detect_malware(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """恶意软件检测"""
        try:
            model = self.models.get("malware_detection")
            if not model:
                raise ValueError("恶意软件检测模型未初始化")
            
            # 特征提取
            features = await self.feature_extractor.extract_malware_features(data)
            features_array = np.array(features).reshape(1, -1)
            
            # 预测（这里假设模型已经训练过）
            try:
                prediction = model.predict(features_array)[0]
                probabilities = model.predict_proba(features_array)[0]
                confidence = float(max(probabilities))
            except Exception:
                # 如果模型未训练，返回默认结果
                prediction = 0
                confidence = 0.5
            
            # 更新指标
            self.metrics["predictions_count"] += 1
            if prediction == 1:
                self.metrics["threats_identified"] += 1
            
            result = {
                "is_malware": prediction == 1,
                "confidence": confidence,
                "threat_type": "malware" if prediction == 1 else "benign",
                "model": "random_forest",
                "timestamp": datetime.now().isoformat()
            }
            
            logger.debug(f"恶意软件检测结果: {result}")
            return result
            
        except Exception as e:
            logger.error(f"恶意软件检测失败: {e}")
            raise
    
    async def detect_network_intrusion(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """网络入侵检测"""
        try:
            model = self.models.get("network_intrusion")
            if not model:
                raise ValueError("网络入侵检测模型未初始化")
            
            # 特征提取
            features = await self.feature_extractor.extract_network_features(data)
            features_array = np.array(features).reshape(1, -1)
            
            # 预测
            try:
                prediction = model.predict(features_array)[0]
                probabilities = model.predict_proba(features_array)[0]
                confidence = float(max(probabilities))
            except Exception:
                prediction = 0
                confidence = 0.5
            
            # 更新指标
            self.metrics["predictions_count"] += 1
            if prediction == 1:
                self.metrics["threats_identified"] += 1
            
            result = {
                "is_intrusion": prediction == 1,
                "confidence": confidence,
                "attack_type": "network_intrusion" if prediction == 1 else "normal",
                "model": "gradient_boosting",
                "timestamp": datetime.now().isoformat()
            }
            
            logger.debug(f"网络入侵检测结果: {result}")
            return result
            
        except Exception as e:
            logger.error(f"网络入侵检测失败: {e}")
            raise
    
    async def analyze_user_behavior(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """用户行为分析"""
        try:
            model = self.models.get("user_behavior")
            if not model:
                raise ValueError("用户行为分析模型未初始化")
            
            # 特征提取
            features = await self.feature_extractor.extract_behavior_features(data)
            features_array = np.array(features).reshape(1, -1)
            
            # 标准化
            scaler_name = "user_behavior"
            if scaler_name not in self.scalers:
                self.scalers[scaler_name] = StandardScaler()
                scaler_path = os.path.join(config.model_path, f"{scaler_name}_scaler.joblib")
                if os.path.exists(scaler_path):
                    self.scalers[scaler_name] = joblib.load(scaler_path)
                else:
                    self.scalers[scaler_name].fit(features_array)
            
            features_scaled = self.scalers[scaler_name].transform(features_array)
            
            # 预测聚类
            try:
                cluster = model.predict(features_scaled)[0]
                # 计算到聚类中心的距离作为异常分数
                distances = model.transform(features_scaled)[0]
                min_distance = min(distances)
            except Exception:
                cluster = 0
                min_distance = 0.5
            
            result = {
                "behavior_cluster": int(cluster),
                "anomaly_score": float(min_distance),
                "is_suspicious": min_distance > 2.0,  # 阈值可调整
                "model": "kmeans",
                "timestamp": datetime.now().isoformat()
            }
            
            logger.debug(f"用户行为分析结果: {result}")
            return result
            
        except Exception as e:
            logger.error(f"用户行为分析失败: {e}")
            raise
    
    async def train_model(self, model_name: str, training_data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """训练指定的模型"""
        try:
            if model_name not in self.models:
                raise ValueError(f"未知的模型类型: {model_name}")
            
            logger.info(f"开始训练模型: {model_name}")
            
            # 数据预处理
            processed_data = await self.data_processor.process_training_data(
                training_data, model_name
            )
            
            X = processed_data["features"]
            y = processed_data.get("labels")
            
            # 数据分割
            if y is not None:
                X_train, X_test, y_train, y_test = train_test_split(
                    X, y, test_size=0.2, random_state=42
                )
            else:
                X_train = X
                X_test = None
                y_train = None
                y_test = None
            
            # 标准化
            scaler = StandardScaler()
            X_train_scaled = scaler.fit_transform(X_train)
            
            # 训练模型
            model = self.models[model_name]
            if y_train is not None:
                model.fit(X_train_scaled, y_train)
            else:
                model.fit(X_train_scaled)
            
            # 保存模型和scaler
            model_path = os.path.join(config.model_path, f"{model_name}.joblib")
            scaler_path = os.path.join(config.model_path, f"{model_name}_scaler.joblib")
            
            joblib.dump(model, model_path)
            joblib.dump(scaler, scaler_path)
            self.scalers[model_name] = scaler
            
            # 评估模型
            evaluation_results = {}
            if X_test is not None and y_test is not None:
                X_test_scaled = scaler.transform(X_test)
                y_pred = model.predict(X_test_scaled)
                
                evaluation_results = {
                    "accuracy": float(model.score(X_test_scaled, y_test)),
                    "classification_report": classification_report(y_test, y_pred, output_dict=True)
                }
                
                self.metrics["model_accuracy"][model_name] = evaluation_results["accuracy"]
            
            result = {
                "model_name": model_name,
                "training_samples": len(X_train),
                "model_path": model_path,
                "scaler_path": scaler_path,
                "evaluation": evaluation_results,
                "timestamp": datetime.now().isoformat()
            }
            
            logger.info(f"模型训练完成: {model_name}")
            return result
            
        except Exception as e:
            logger.error(f"模型训练失败 {model_name}: {e}")
            raise
    
    def is_healthy(self) -> bool:
        """检查服务健康状态"""
        return self.is_initialized and len(self.models) > 0
    
    def get_metrics(self) -> Dict[str, Any]:
        """获取服务指标"""
        return {
            "service_status": "healthy" if self.is_healthy() else "unhealthy",
            "models_loaded": list(self.models.keys()),
            "metrics": self.metrics,
            "timestamp": datetime.now().isoformat()
        }
    
    async def cleanup(self):
        """清理资源"""
        try:
            logger.info("正在清理AI服务资源...")
            self.models.clear()
            self.scalers.clear()
            self.is_initialized = False
            logger.info("AI服务资源清理完成")
        except Exception as e:
            logger.error(f"AI服务清理失败: {e}")
            raise 