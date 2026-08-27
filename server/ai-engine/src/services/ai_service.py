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
        self.external_api_service = None  # 外部API服务引用
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
            os.makedirs(config.ai_model_path, exist_ok=True)

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

    def set_external_api_service(self, external_api_service):
        """设置外部API服务引用"""
        self.external_api_service = external_api_service
        logger.info("外部API服务引用已设置")

    async def analyze_with_hybrid_intelligence(
        self,
        data: Dict[str, Any],
        analysis_type: str = "comprehensive",
        use_external_api: bool = True
    ) -> Dict[str, Any]:
        """混合智能分析 - 结合本地模型和外部大模型"""
        try:
            results = {
                "local_analysis": {},
                "llm_analysis": {},
                "hybrid_conclusion": {},
                "confidence_score": 0.0,
                "timestamp": datetime.now().isoformat()
            }

            # 1. 本地模型分析
            logger.info("开始本地模型分析...")
            local_results = await self._perform_local_analysis(data, analysis_type)
            results["local_analysis"] = local_results

            # 2. 外部大模型分析（如果可用且启用）
            if use_external_api and self.external_api_service and self.external_api_service.is_healthy():
                logger.info("开始外部大模型分析...")
                llm_prompt = self._generate_llm_prompt(data, local_results, analysis_type)

                llm_result = await self.external_api_service.analyze_with_llm(
                    prompt=llm_prompt,
                    analysis_type=analysis_type,
                    use_cache=True
                )

                if llm_result.get("success", False):
                    results["llm_analysis"] = {
                        "content": llm_result.get("content", ""),
                        "provider": llm_result.get("provider", ""),
                        "model": llm_result.get("model", ""),
                        "from_cache": llm_result.get("from_cache", False)
                    }
                else:
                    results["llm_analysis"] = {
                        "error": llm_result.get("error", "外部API调用失败")
                    }

            # 3. 混合推理结论
            hybrid_conclusion = await self._generate_hybrid_conclusion(
                results["local_analysis"],
                results["llm_analysis"]
            )
            results["hybrid_conclusion"] = hybrid_conclusion
            results["confidence_score"] = hybrid_conclusion.get("confidence", 0.0)

            # 4. 更新指标
            self.metrics["predictions_count"] += 1
            self.metrics["last_prediction_time"] = datetime.now().isoformat()

            if hybrid_conclusion.get("threat_detected", False):
                self.metrics["threats_identified"] += 1

            if hybrid_conclusion.get("anomaly_detected", False):
                self.metrics["anomalies_detected"] += 1

            return results

        except Exception as e:
            logger.error(f"混合智能分析失败: {e}")
            return {
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }

    async def _perform_local_analysis(self, data: Dict[str, Any], analysis_type: str) -> Dict[str, Any]:
        """执行本地模型分析"""
        try:
            local_results = {}

            if analysis_type in ["comprehensive", "anomaly"]:
                anomaly_result = await self.detect_anomaly(data)
                local_results["anomaly_detection"] = anomaly_result

            if analysis_type in ["comprehensive", "malware"]:
                malware_result = await self.detect_malware(data)
                local_results["malware_detection"] = malware_result

            if analysis_type in ["comprehensive", "network"]:
                network_result = await self.detect_network_intrusion(data)
                local_results["network_intrusion"] = network_result

            if analysis_type in ["comprehensive", "behavior"]:
                behavior_result = await self.analyze_user_behavior(data)
                local_results["behavior_analysis"] = behavior_result

            return local_results

        except Exception as e:
            logger.error(f"本地分析失败: {e}")
            return {"error": str(e)}

    def _generate_llm_prompt(
        self,
        data: Dict[str, Any],
        local_results: Dict[str, Any],
        analysis_type: str
    ) -> str:
        """生成大模型分析提示词"""
        try:
            # 基础上下文
            context = f"""
作为网络安全专家，请分析以下数据和本地AI模型的初步分析结果：

## 原始数据：
{json.dumps(data, indent=2, ensure_ascii=False)}

## 本地AI模型分析结果：
{json.dumps(local_results, indent=2, ensure_ascii=False)}

## 分析类型：{analysis_type}
"""

            # 根据分析类型添加特定指导
            if analysis_type == "log_analysis":
                context += """
请重点关注：
1. 日志中是否存在异常模式或可疑活动
2. 时间序列分析，识别异常时间点
3. 用户行为异常检测
4. 系统资源使用异常
5. 网络通信异常模式
"""
            elif analysis_type == "threat_detection":
                context += """
请重点关注：
1. 已知威胁特征匹配
2. 攻击向量分析
3. 恶意代码特征识别
4. 网络入侵指标(IOCs)
5. 威胁等级评估
"""
            elif analysis_type == "behavior_analysis":
                context += """
请重点关注：
1. 用户行为基线偏差
2. 权限滥用检测
3. 异常登录模式
4. 数据访问异常
5. 系统操作异常
"""

            context += """
请提供：
1. 详细的安全分析报告
2. 威胁等级评估（高/中/低/无）
3. 具体的威胁类型识别
4. 建议的响应措施
5. 置信度评分（0-100）

请以结构化的JSON格式回复，包含以下字段：
- threat_level: 威胁等级
- threat_types: 威胁类型列表
- confidence: 置信度(0-100)
- summary: 分析摘要
- recommendations: 建议措施列表
- technical_details: 技术细节
"""

            return context

        except Exception as e:
            logger.error(f"生成LLM提示词失败: {e}")
            return f"请分析以下安全数据：{json.dumps(data, ensure_ascii=False)}"

    async def _generate_hybrid_conclusion(
        self,
        local_results: Dict[str, Any],
        llm_results: Dict[str, Any]
    ) -> Dict[str, Any]:
        """生成混合推理结论"""
        try:
            conclusion = {
                "threat_detected": False,
                "anomaly_detected": False,
                "threat_level": "无",
                "threat_types": [],
                "confidence": 0.0,
                "summary": "",
                "recommendations": [],
                "analysis_method": "hybrid"
            }

            # 分析本地结果
            local_threats = []
            local_confidence = 0.0

            for analysis_type, result in local_results.items():
                if isinstance(result, dict) and result.get("anomaly_detected", False):
                    conclusion["anomaly_detected"] = True
                    local_threats.append(analysis_type)
                    local_confidence += result.get("confidence", 0.5)

            # 分析LLM结果
            llm_confidence = 0.0
            llm_threats = []

            if llm_results.get("content") and not llm_results.get("error"):
                try:
                    # 尝试解析LLM的JSON响应
                    llm_content = llm_results["content"]
                    if llm_content.strip().startswith("{"):
                        llm_analysis = json.loads(llm_content)

                        if llm_analysis.get("threat_level", "无") != "无":
                            conclusion["threat_detected"] = True
                            conclusion["threat_level"] = llm_analysis.get("threat_level", "低")
                            llm_threats = llm_analysis.get("threat_types", [])
                            llm_confidence = llm_analysis.get("confidence", 0) / 100.0
                            conclusion["summary"] = llm_analysis.get("summary", "")
                            conclusion["recommendations"] = llm_analysis.get("recommendations", [])

                except json.JSONDecodeError:
                    # 如果不是JSON格式，进行文本分析
                    content_lower = llm_content.lower()
                    if any(keyword in content_lower for keyword in ["威胁", "攻击", "异常", "可疑", "恶意"]):
                        conclusion["threat_detected"] = True
                        conclusion["summary"] = llm_content[:500] + "..." if len(llm_content) > 500 else llm_content
                        llm_confidence = 0.7  # 默认置信度

            # 混合决策逻辑
            if local_threats and llm_threats:
                # 本地和LLM都检测到威胁
                conclusion["confidence"] = min(1.0, (local_confidence + llm_confidence) / 2)
                conclusion["threat_types"] = list(set(local_threats + llm_threats))
                conclusion["threat_detected"] = True
            elif local_threats or llm_threats:
                # 只有一种方法检测到威胁
                conclusion["confidence"] = max(local_confidence, llm_confidence)
                conclusion["threat_types"] = local_threats + llm_threats
                conclusion["threat_detected"] = len(conclusion["threat_types"]) > 0
            else:
                # 都没有检测到威胁
                conclusion["confidence"] = 0.9  # 高置信度认为安全
                conclusion["threat_level"] = "无"

            # 确保置信度在合理范围内
            conclusion["confidence"] = max(0.0, min(1.0, conclusion["confidence"]))

            return conclusion

        except Exception as e:
            logger.error(f"生成混合结论失败: {e}")
            return {
                "threat_detected": False,
                "anomaly_detected": False,
                "threat_level": "未知",
                "confidence": 0.0,
                "summary": f"分析失败: {str(e)}",
                "analysis_method": "hybrid",
                "error": str(e)
            }

    async def _initialize_anomaly_detection_model(self):
        """初始化异常检测模型"""
        model_name = "anomaly_detection"
        model_path = os.path.join(config.ai_model_path, f"{model_name}.joblib")

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
        model_path = os.path.join(config.ai_model_path, f"{model_name}.joblib")

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
            if model is None:
                raise ValueError("异常检测模型未初始化")

            if not hasattr(model, "estimators_"):
                system = data.get("system", {})
                utilization = max(float(system.get(key, 0) or 0) for key in ("cpu_usage", "memory_usage", "disk_usage"))
                is_anomaly = utilization >= 90
                self.metrics["predictions_count"] += 1
                self.metrics["last_prediction_time"] = datetime.now().isoformat()
                if is_anomaly:
                    self.metrics["anomalies_detected"] += 1
                return {
                    "is_anomaly": is_anomaly,
                    "anomaly_score": utilization / 100,
                    "confidence": min(1.0, abs(utilization - 90) / 10),
                    "model": "resource_threshold_baseline",
                    "timestamp": datetime.now().isoformat()
                }

            # 特征提取
            features = await self.feature_extractor.extract_anomaly_features(data)
            features_array = np.array(features).reshape(1, -1)

            # 标准化
            scaler_name = "anomaly_detection"
            if scaler_name not in self.scalers:
                self.scalers[scaler_name] = StandardScaler()
                # 如果模型已训练，尝试加载对应的scaler
                scaler_path = os.path.join(config.ai_model_path, f"{scaler_name}_scaler.joblib")
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
            if model is None:
                raise ValueError("恶意软件检测模型未初始化")

            if not hasattr(model, "estimators_"):
                suspicious_terms = ("malware", "mimikatz", "ransom", "cryptominer", "suspicious")
                matched = [
                    process.get("name", "") for process in data.get("processes", [])
                    if any(term in process.get("name", "").lower() for term in suspicious_terms)
                ]
                prediction = 1 if matched else 0
                confidence = min(1.0, 0.7 + 0.1 * len(matched)) if matched else 0.7
                model_name = "process_signature_baseline"
            else:
                features = await self.feature_extractor.extract_malware_features(data)
                features_array = np.array(features).reshape(1, -1)
                prediction = model.predict(features_array)[0]
                probabilities = model.predict_proba(features_array)[0]
                confidence = float(max(probabilities))
                model_name = "random_forest"

            # 更新指标
            self.metrics["predictions_count"] += 1
            if prediction == 1:
                self.metrics["threats_identified"] += 1

            result = {
                "is_malware": prediction == 1,
                "confidence": confidence,
                "threat_type": "malware" if prediction == 1 else "benign",
                "model": model_name,
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
            if model is None:
                raise ValueError("网络入侵检测模型未初始化")

            if hasattr(model, "estimators_"):
                features = await self.feature_extractor.extract_network_features(data)
                features_array = np.array(features).reshape(1, -1)
                prediction = model.predict(features_array)[0]
                probabilities = model.predict_proba(features_array)[0]
                confidence = float(max(probabilities))
                model_name = "gradient_boosting"
            else:
                network = data.get("network", {})
                connections = network.get("connections", [])
                high_risk_ports = {23, 445, 1433, 3389, 4444, 5900}
                matched_ports = [
                    connection.get("remote_port") or connection.get("dst_port")
                    for connection in connections
                    if (connection.get("remote_port") or connection.get("dst_port")) in high_risk_ports
                ]
                connection_count = len(connections)
                prediction = 1 if matched_ports or connection_count > 1000 else 0
                confidence = min(1.0, 0.7 + 0.05 * len(matched_ports)) if prediction else 0.7
                model_name = "network_policy_baseline"

            # 更新指标
            self.metrics["predictions_count"] += 1
            if prediction == 1:
                self.metrics["threats_identified"] += 1

            result = {
                "is_intrusion": prediction == 1,
                "confidence": confidence,
                "attack_type": "network_intrusion" if prediction == 1 else "normal",
                "model": model_name,
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
            if model is None:
                raise ValueError("用户行为分析模型未初始化")

            if not hasattr(model, "cluster_centers_"):
                behavior = data.get("behavior", data.get("user_behavior", {}))
                failed_logins = int(behavior.get("failed_logins", 0) or 0)
                privilege_changes = int(behavior.get("privilege_changes", 0) or 0)
                score = min(1.0, failed_logins / 10 + privilege_changes / 3)
                return {
                    "behavior_cluster": -1,
                    "anomaly_score": score,
                    "is_suspicious": score >= 0.7,
                    "model": "behavior_policy_baseline",
                    "timestamp": datetime.now().isoformat()
                }

            # 特征提取
            features = await self.feature_extractor.extract_behavior_features(data)
            features_array = np.array(features).reshape(1, -1)

            # 标准化
            scaler_name = "user_behavior"
            if scaler_name not in self.scalers:
                self.scalers[scaler_name] = StandardScaler()
                scaler_path = os.path.join(config.ai_model_path, f"{scaler_name}_scaler.joblib")
                if os.path.exists(scaler_path):
                    self.scalers[scaler_name] = joblib.load(scaler_path)
                else:
                    self.scalers[scaler_name].fit(features_array)

            features_scaled = self.scalers[scaler_name].transform(features_array)

            # 预测聚类
            cluster = model.predict(features_scaled)[0]
            distances = model.transform(features_scaled)[0]
            min_distance = min(distances)

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
            model_path = os.path.join(config.ai_model_path, f"{model_name}.joblib")
            scaler_path = os.path.join(config.ai_model_path, f"{model_name}_scaler.joblib")

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

    async def set_model_enabled(self, model_name: str, enabled: bool) -> Dict[str, Any]:
        """启用或停用一个内置模型。"""
        initializers = {
            "anomaly_detection": self._initialize_anomaly_detection_model,
            "malware_detection": self._initialize_malware_detection_model,
            "network_intrusion": self._initialize_network_intrusion_model,
            "user_behavior": self._initialize_user_behavior_model,
        }
        if model_name not in initializers:
            raise ValueError(f"未知的模型类型: {model_name}")
        if enabled and model_name not in self.models:
            await initializers[model_name]()
        if not enabled:
            self.models.pop(model_name, None)
            self.scalers.pop(model_name, None)
        return {"model_name": model_name, "status": "active" if enabled else "inactive"}

    async def reload_model(self, model_name: str) -> Dict[str, Any]:
        """从持久化模型文件重新加载内置模型。"""
        await self.set_model_enabled(model_name, False)
        return await self.set_model_enabled(model_name, True)

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
