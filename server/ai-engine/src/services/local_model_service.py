"""
本地AI模型推理服务
集成多种本地训练的异常检测模型和预训练的网络安全模型
"""

import logging
import numpy as np
import pandas as pd
from typing import Dict, List, Optional, Tuple, Any, Union
import joblib
try:
    import torch
    import torch.nn as nn
    from transformers import AutoTokenizer, AutoModel
    DEEP_LEARNING_AVAILABLE = True
    TorchModule = nn.Module
except ImportError:
    torch = None
    nn = None
    AutoTokenizer = None
    AutoModel = None
    DEEP_LEARNING_AVAILABLE = False
    TorchModule = object
from sklearn.preprocessing import StandardScaler
import asyncio
from pathlib import Path

from ..config import config
from ..utils.feature_extractor import FeatureExtractor

logger = logging.getLogger(__name__)

class NetworkAnomalyAutoEncoder(TorchModule):
    """网络异常检测自编码器"""

    def __init__(self, input_dim: int, hidden_dims: List[int] = [64, 32, 16]):
        if not DEEP_LEARNING_AVAILABLE:
            raise RuntimeError("深度学习扩展未安装")
        super(NetworkAnomalyAutoEncoder, self).__init__()

        # 编码器
        encoder_layers = []
        prev_dim = input_dim
        for hidden_dim in hidden_dims:
            encoder_layers.extend([
                nn.Linear(prev_dim, hidden_dim),
                nn.ReLU(),
                nn.Dropout(0.1)
            ])
            prev_dim = hidden_dim

        # 解码器
        decoder_layers = []
        for i in range(len(hidden_dims) - 1, -1, -1):
            if i == 0:
                next_dim = input_dim
            else:
                next_dim = hidden_dims[i-1]
            decoder_layers.extend([
                nn.Linear(prev_dim, next_dim),
                nn.ReLU() if i > 0 else nn.Sigmoid(),
            ])
            if i > 0:
                decoder_layers.append(nn.Dropout(0.1))
            prev_dim = next_dim

        self.encoder = nn.Sequential(*encoder_layers)
        self.decoder = nn.Sequential(*decoder_layers)

    def forward(self, x):
        encoded = self.encoder(x)
        decoded = self.decoder(encoded)
        return decoded

    def get_reconstruction_error(self, x):
        """计算重构误差"""
        with torch.no_grad():
            reconstructed = self.forward(x)
            error = torch.mean((x - reconstructed) ** 2, dim=1)
            return error.numpy()

class LSTMAnomalyDetector(TorchModule):
    """LSTM异常检测模型"""

    def __init__(self, input_size: int, hidden_size: int = 50, num_layers: int = 2):
        if not DEEP_LEARNING_AVAILABLE:
            raise RuntimeError("深度学习扩展未安装")
        super(LSTMAnomalyDetector, self).__init__()

        self.hidden_size = hidden_size
        self.num_layers = num_layers

        self.lstm = nn.LSTM(input_size, hidden_size, num_layers,
                           batch_first=True, dropout=0.2)
        self.fc = nn.Linear(hidden_size, input_size)

    def forward(self, x):
        # x shape: (batch_size, seq_length, input_size)
        h0 = torch.zeros(self.num_layers, x.size(0), self.hidden_size)
        c0 = torch.zeros(self.num_layers, x.size(0), self.hidden_size)

        out, _ = self.lstm(x, (h0, c0))
        out = self.fc(out[:, -1, :])  # 只使用最后一个时间步的输出
        return out

class CyberSecurityBERT:
    """网络安全专用BERT模型封装"""

    def __init__(self, model_name: str = "jackaduma/SecBERT"):
        if not DEEP_LEARNING_AVAILABLE:
            raise RuntimeError("深度学习扩展未安装")
        self.tokenizer = AutoTokenizer.from_pretrained(model_name)
        self.model = AutoModel.from_pretrained(model_name)
        self.model.eval()

    def encode_text(self, text: str) -> np.ndarray:
        """将文本编码为向量"""
        inputs = self.tokenizer(text, return_tensors="pt",
                               truncation=True, max_length=512)

        with torch.no_grad():
            outputs = self.model(**inputs)
            # 使用[CLS] token的嵌入作为文本表示
            embeddings = outputs.last_hidden_state[:, 0, :].numpy()

        return embeddings.flatten()

class LocalModelService:
    """本地AI模型推理服务"""

    def __init__(self):
        self.models = {}
        self.scalers = {}
        self.feature_extractor = FeatureExtractor()
        self.security_bert = None

        # 模型配置
        self.model_config = {
            'autoencoder': {
                'threshold': 0.1,  # 异常阈值
                'input_dim': 41,   # 特征维度
                'hidden_dims': [64, 32, 16, 8]
            },
            'lstm': {
                'sequence_length': 10,
                'threshold': 0.05
            },
            'isolation_forest': {
                'contamination': 0.1
            }
        }

        self._initialize_models()

    def _initialize_models(self):
        """初始化所有模型"""
        try:
            if DEEP_LEARNING_AVAILABLE:
                self._load_autoencoder()
                self._load_lstm_model()
                self._load_security_bert()
            else:
                logger.info("未安装可选深度学习扩展，启用传统机器学习模型")
            self._load_traditional_models()
            logger.info("本地模型服务初始化完成")
        except Exception as e:
            logger.error(f"模型初始化失败: {e}")

    def _load_autoencoder(self):
        """加载自编码器模型"""
        model_path = Path(config.ai_model_path) / "autoencoder_model.pth"
        scaler_path = Path(config.ai_model_path) / "autoencoder_scaler.pkl"

        if model_path.exists():
            # 加载预训练模型
            self.models['autoencoder'] = NetworkAnomalyAutoEncoder(
                input_dim=self.model_config['autoencoder']['input_dim'],
                hidden_dims=self.model_config['autoencoder']['hidden_dims']
            )
            self.models['autoencoder'].load_state_dict(torch.load(model_path))
            self.models['autoencoder'].eval()

            # 加载标准化器
            if scaler_path.exists():
                self.scalers['autoencoder'] = joblib.load(scaler_path)
            else:
                self.scalers['autoencoder'] = StandardScaler()

            logger.info("自编码器模型加载成功")
        else:
            # 创建新模型（需要训练）
            self.models['autoencoder'] = NetworkAnomalyAutoEncoder(
                input_dim=self.model_config['autoencoder']['input_dim'],
                hidden_dims=self.model_config['autoencoder']['hidden_dims']
            )
            self.scalers['autoencoder'] = StandardScaler()
            logger.warning("未找到预训练的自编码器模型，使用未训练模型")

    def _load_lstm_model(self):
        """加载LSTM模型"""
        model_path = Path(config.ai_model_path) / "lstm_model.pth"

        if model_path.exists():
            self.models['lstm'] = LSTMAnomalyDetector(
                input_size=self.model_config['autoencoder']['input_dim']
            )
            self.models['lstm'].load_state_dict(torch.load(model_path))
            self.models['lstm'].eval()
            logger.info("LSTM模型加载成功")
        else:
            self.models['lstm'] = LSTMAnomalyDetector(
                input_size=self.model_config['autoencoder']['input_dim']
            )
            logger.warning("未找到预训练的LSTM模型，使用未训练模型")

    def _load_traditional_models(self):
        """加载传统机器学习模型"""
        model_dir = Path(config.ai_model_path)

        # Isolation Forest
        iso_forest_path = model_dir / "isolation_forest.pkl"
        if iso_forest_path.exists():
            self.models['isolation_forest'] = joblib.load(iso_forest_path)
            logger.info("Isolation Forest模型加载成功")
        else:
            from sklearn.ensemble import IsolationForest
            self.models['isolation_forest'] = IsolationForest(
                contamination=self.model_config['isolation_forest']['contamination'],
                random_state=42
            )
            logger.warning("未找到预训练的Isolation Forest模型")

        # Local Outlier Factor
        lof_path = model_dir / "local_outlier_factor.pkl"
        if lof_path.exists():
            self.models['lof'] = joblib.load(lof_path)
            logger.info("LOF模型加载成功")
        else:
            from sklearn.neighbors import LocalOutlierFactor
            self.models['lof'] = LocalOutlierFactor(contamination=0.1)
            logger.warning("未找到预训练的LOF模型")

        # One-Class SVM
        svm_path = model_dir / "one_class_svm.pkl"
        if svm_path.exists():
            self.models['one_class_svm'] = joblib.load(svm_path)
            logger.info("One-Class SVM模型加载成功")
        else:
            from sklearn.svm import OneClassSVM
            self.models['one_class_svm'] = OneClassSVM(gamma='scale')
            logger.warning("未找到预训练的One-Class SVM模型")

    def _load_security_bert(self):
        """加载网络安全BERT模型"""
        try:
            self.security_bert = CyberSecurityBERT()
            logger.info("SecBERT模型加载成功")
        except Exception as e:
            logger.error(f"SecBERT模型加载失败: {e}")
            self.security_bert = None

    async def detect_anomaly(
        self,
        features: Dict[str, Any],
        method: str = "ensemble"
    ) -> Dict[str, Any]:
        """
        异常检测

        Args:
            features: 特征字典
            method: 检测方法 ("autoencoder", "lstm", "isolation_forest", "ensemble")

        Returns:
            检测结果
        """
        try:
            # 特征预处理
            feature_array = self._prepare_features(features)

            if method == "ensemble":
                return await self._ensemble_detection(feature_array)
            else:
                return await self._single_model_detection(feature_array, method)

        except Exception as e:
            logger.error(f"异常检测失败: {e}")
            return {
                'is_anomaly': False,
                'confidence': 0.0,
                'method': method,
                'error': str(e)
            }

    def _prepare_features(self, features: Dict[str, Any]) -> np.ndarray:
        """准备特征数组"""
        # 提取标准特征
        feature_list = self.feature_extractor.extract_network_features(features)

        # 转换为numpy数组
        feature_array = np.array(feature_list).reshape(1, -1)

        return feature_array

    async def _ensemble_detection(self, features: np.ndarray) -> Dict[str, Any]:
        """集成多个模型进行异常检测"""
        results = {}
        scores = []
        weights = {
            'autoencoder': 0.3,
            'isolation_forest': 0.25,
            'one_class_svm': 0.25,
            'lof': 0.2
        }

        # 自编码器检测
        if 'autoencoder' in self.models:
            ae_result = await self._autoencoder_detection(features)
            results['autoencoder'] = ae_result
            scores.append(ae_result['anomaly_score'] * weights['autoencoder'])

        # Isolation Forest检测
        if 'isolation_forest' in self.models:
            iso_result = await self._isolation_forest_detection(features)
            results['isolation_forest'] = iso_result
            scores.append(iso_result['anomaly_score'] * weights['isolation_forest'])

        # One-Class SVM检测
        if 'one_class_svm' in self.models:
            svm_result = await self._svm_detection(features)
            results['one_class_svm'] = svm_result
            scores.append(svm_result['anomaly_score'] * weights['one_class_svm'])

        # LOF检测
        if 'lof' in self.models:
            lof_result = await self._lof_detection(features)
            results['lof'] = lof_result
            scores.append(lof_result['anomaly_score'] * weights['lof'])

        # 计算加权平均分数
        if scores:
            ensemble_score = sum(scores) / sum(weights.values())
            is_anomaly = ensemble_score > 0.5
        else:
            ensemble_score = 0.0
            is_anomaly = False

        return {
            'is_anomaly': is_anomaly,
            'anomaly_score': ensemble_score,
            'confidence': min(ensemble_score * 2, 1.0),  # 转换为置信度
            'method': 'ensemble',
            'individual_results': results
        }

    async def _single_model_detection(
        self,
        features: np.ndarray,
        method: str
    ) -> Dict[str, Any]:
        """单个模型异常检测"""

        if method == "autoencoder":
            return await self._autoencoder_detection(features)
        elif method == "lstm":
            return await self._lstm_detection(features)
        elif method == "isolation_forest":
            return await self._isolation_forest_detection(features)
        elif method == "one_class_svm":
            return await self._svm_detection(features)
        elif method == "lof":
            return await self._lof_detection(features)
        else:
            raise ValueError(f"未知的检测方法: {method}")

    async def _autoencoder_detection(self, features: np.ndarray) -> Dict[str, Any]:
        """自编码器异常检测"""
        # 特征标准化
        if 'autoencoder' in self.scalers:
            features_scaled = self.scalers['autoencoder'].transform(features)
        else:
            features_scaled = features

        # 转换为tensor
        features_tensor = torch.FloatTensor(features_scaled)

        # 计算重构误差
        model = self.models['autoencoder']
        reconstruction_error = model.get_reconstruction_error(features_tensor)[0]

        # 判断是否异常
        threshold = self.model_config['autoencoder']['threshold']
        is_anomaly = reconstruction_error > threshold
        anomaly_score = min(reconstruction_error / threshold, 1.0)

        return {
            'is_anomaly': bool(is_anomaly),
            'anomaly_score': float(anomaly_score),
            'reconstruction_error': float(reconstruction_error),
            'threshold': threshold,
            'method': 'autoencoder'
        }

    async def _lstm_detection(self, features: np.ndarray) -> Dict[str, Any]:
        """LSTM异常检测"""
        # 创建序列数据（简化处理，实际应该使用历史数据）
        seq_length = self.model_config['lstm']['sequence_length']

        # 重复当前特征创建序列（实际应该使用时间窗口数据）
        sequence = np.tile(features, (seq_length, 1))
        sequence_tensor = torch.FloatTensor(sequence).unsqueeze(0)

        # LSTM预测
        model = self.models['lstm']
        with torch.no_grad():
            predicted = model(sequence_tensor)
            mse = torch.mean((predicted - torch.FloatTensor(features)) ** 2).item()

        # 判断异常
        threshold = self.model_config['lstm']['threshold']
        is_anomaly = mse > threshold
        anomaly_score = min(mse / threshold, 1.0)

        return {
            'is_anomaly': bool(is_anomaly),
            'anomaly_score': float(anomaly_score),
            'mse': float(mse),
            'threshold': threshold,
            'method': 'lstm'
        }

    async def _isolation_forest_detection(self, features: np.ndarray) -> Dict[str, Any]:
        """Isolation Forest异常检测"""
        model = self.models['isolation_forest']

        # 预测
        prediction = model.predict(features)[0]  # -1为异常，1为正常
        anomaly_score_raw = model.decision_function(features)[0]

        # 转换分数到0-1范围
        anomaly_score = max(0, -anomaly_score_raw / 0.5)  # 简化的分数转换
        is_anomaly = prediction == -1

        return {
            'is_anomaly': bool(is_anomaly),
            'anomaly_score': float(min(anomaly_score, 1.0)),
            'raw_score': float(anomaly_score_raw),
            'method': 'isolation_forest'
        }

    async def _svm_detection(self, features: np.ndarray) -> Dict[str, Any]:
        """One-Class SVM异常检测"""
        model = self.models['one_class_svm']

        prediction = model.predict(features)[0]
        decision_score = model.decision_function(features)[0]

        # 转换分数
        anomaly_score = max(0, -decision_score)
        is_anomaly = prediction == -1

        return {
            'is_anomaly': bool(is_anomaly),
            'anomaly_score': float(min(anomaly_score, 1.0)),
            'decision_score': float(decision_score),
            'method': 'one_class_svm'
        }

    async def _lof_detection(self, features: np.ndarray) -> Dict[str, Any]:
        """LOF异常检测"""
        # 注意：LOF需要训练数据来计算局部异常因子
        # 这里假设模型已经fit过训练数据
        model = self.models['lof']

        try:
            # LOF的predict方法
            prediction = model.predict(features)[0]

            # 获取异常分数（负异常因子）
            negative_outlier_factor = model.negative_outlier_factor_
            if len(negative_outlier_factor) > 0:
                # 使用最近计算的分数
                anomaly_score = max(0, -negative_outlier_factor[-1] - 1)
            else:
                anomaly_score = 0.5 if prediction == -1 else 0.1

            is_anomaly = prediction == -1

        except Exception as e:
            # 如果模型未训练，返回默认值
            logger.warning(f"LOF检测失败: {e}")
            is_anomaly = False
            anomaly_score = 0.0

        return {
            'is_anomaly': bool(is_anomaly),
            'anomaly_score': float(min(anomaly_score, 1.0)),
            'method': 'lof'
        }

    async def analyze_log_text(self, log_text: str) -> Dict[str, Any]:
        """使用SecBERT分析日志文本"""
        if not self.security_bert:
            return {
                'embeddings': None,
                'analysis': 'SecBERT模型未加载',
                'confidence': 0.0
            }

        try:
            # 获取文本嵌入
            embeddings = self.security_bert.encode_text(log_text)

            # 简单的异常检测（基于嵌入向量的统计特征）
            embedding_norm = np.linalg.norm(embeddings)
            embedding_mean = np.mean(embeddings)
            embedding_std = np.std(embeddings)

            # 基于统计特征的简单异常判断
            is_suspicious = (
                embedding_norm > 50 or  # 向量模长异常
                abs(embedding_mean) > 0.5 or  # 均值异常
                embedding_std > 1.0  # 标准差异常
            )

            confidence = min((embedding_norm / 50 + abs(embedding_mean) / 0.5 + embedding_std) / 3, 1.0)

            return {
                'embeddings': embeddings.tolist(),
                'is_suspicious': is_suspicious,
                'confidence': float(confidence),
                'embedding_stats': {
                    'norm': float(embedding_norm),
                    'mean': float(embedding_mean),
                    'std': float(embedding_std)
                },
                'analysis': '基于SecBERT嵌入的文本分析'
            }

        except Exception as e:
            logger.error(f"SecBERT分析失败: {e}")
            return {
                'embeddings': None,
                'analysis': f'分析失败: {e}',
                'confidence': 0.0
            }

    def get_model_info(self) -> Dict[str, Any]:
        """获取模型信息"""
        info = {
            'loaded_models': list(self.models.keys()),
            'model_configs': self.model_config,
            'security_bert_available': self.security_bert is not None
        }

        # 获取模型参数信息
        for name, model in self.models.items():
            if hasattr(model, 'parameters'):
                total_params = sum(p.numel() for p in model.parameters())
                info[f'{name}_parameters'] = total_params

        return info

    async def batch_detect(
        self,
        features_list: List[Dict[str, Any]],
        method: str = "ensemble"
    ) -> List[Dict[str, Any]]:
        """批量异常检测"""
        results = []

        for features in features_list:
            result = await self.detect_anomaly(features, method)
            results.append(result)

        return results
