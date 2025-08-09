"""
AI引擎API路由
提供威胁检测、模型训练等REST接口
"""
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Dict, List, Any, Optional
from loguru import logger
import asyncio
from datetime import datetime

# 导入服务实例（在main.py中初始化）
from ..main import ai_service, kafka_service, rule_engine, external_api_service

router = APIRouter()

# 请求模型
class AnalysisRequest(BaseModel):
    data: Dict[str, Any]
    analysis_types: List[str] = ["anomaly", "malware", "network", "behavior"]

class TrainingRequest(BaseModel):
    model_name: str
    training_data: List[Dict[str, Any]]

class LLMAnalysisRequest(BaseModel):
    """大模型分析请求"""
    content: str
    analysis_type: str = "log_analysis"  # log_analysis, threat_detection, behavior_analysis
    preferred_provider: Optional[str] = None
    use_cache: bool = True

class HybridAnalysisRequest(BaseModel):
    """混合智能分析请求"""
    data: Dict[str, Any]
    analysis_type: str = "comprehensive"  # comprehensive, anomaly, malware, network, behavior
    use_external_api: bool = True

class StatusRequest(BaseModel):
    detailed: bool = False
    
class ThreatData(BaseModel):
    data: Dict[str, Any]
    
class RuleMatchRequest(BaseModel):
    data: Dict[str, Any]

# 响应模型
class AnalysisResponse(BaseModel):
    success: bool
    results: Dict[str, Any]
    message: str = ""

@router.post("/analyze", response_model=AnalysisResponse)
async def analyze_threat(request: AnalysisRequest):
    """威胁分析接口"""
    try:
        if not ai_service or not ai_service.is_healthy():
            raise HTTPException(status_code=503, detail="AI服务不可用")
        
        results = {}
        
        # 执行各种分析
        for analysis_type in request.analysis_types:
            try:
                if analysis_type == "anomaly":
                    result = await ai_service.detect_anomaly(request.data)
                    results["anomaly_detection"] = result
                    
                elif analysis_type == "malware":
                    result = await ai_service.detect_malware(request.data)
                    results["malware_detection"] = result
                    
                elif analysis_type == "network":
                    result = await ai_service.detect_network_intrusion(request.data)
                    results["network_intrusion"] = result
                    
                elif analysis_type == "behavior":
                    result = await ai_service.analyze_user_behavior(request.data)
                    results["behavior_analysis"] = result
                    
                else:
                    logger.warning(f"未知的分析类型: {analysis_type}")
                    
            except Exception as e:
                logger.error(f"{analysis_type} 分析失败: {e}")
                results[f"{analysis_type}_error"] = str(e)
        
        # 规则匹配
        if rule_engine and rule_engine.is_healthy():
            try:
                rule_matches = await rule_engine.match_rules(request.data)
                results["rule_matches"] = rule_matches
            except Exception as e:
                logger.error(f"规则匹配失败: {e}")
                results["rule_match_error"] = str(e)
        
        # 发送分析结果到Kafka
        if kafka_service and kafka_service.is_healthy():
            try:
                await kafka_service.send_analysis_result({
                    "type": "analysis_complete",
                    "results": results,
                    "input_data": request.data
                })
            except Exception as e:
                logger.error(f"发送分析结果失败: {e}")
        
        return AnalysisResponse(
            success=True,
            results=results,
            message="分析完成"
        )
        
    except Exception as e:
        logger.error(f"威胁分析失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/llm-analysis", response_model=AnalysisResponse)
async def llm_analysis(request: LLMAnalysisRequest):
    """大模型智能分析接口"""
    try:
        if not external_api_service or not external_api_service.is_healthy():
            raise HTTPException(status_code=503, detail="外部API服务不可用")
        
        # 使用大模型进行分析
        result = await external_api_service.analyze_with_llm(
            prompt=request.content,
            analysis_type=request.analysis_type,
            preferred_provider=request.preferred_provider,
            use_cache=request.use_cache
        )
        
        if result.get("success", False):
            return AnalysisResponse(
                success=True,
                results={
                    "analysis": result.get("content", ""),
                    "provider": result.get("provider", ""),
                    "model": result.get("model", ""),
                    "tokens_used": result.get("tokens_used", 0),
                    "from_cache": result.get("from_cache", False)
                },
                message="大模型分析完成"
            )
        else:
            return AnalysisResponse(
                success=False,
                results={"error": result.get("error", "未知错误")},
                message="大模型分析失败"
            )
            
    except Exception as e:
        logger.error(f"大模型分析失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/hybrid-analysis", response_model=AnalysisResponse)
async def hybrid_analysis(request: HybridAnalysisRequest):
    """混合智能分析接口 - 结合本地模型和外部大模型"""
    try:
        if not ai_service or not ai_service.is_initialized:
            raise HTTPException(status_code=503, detail="AI服务不可用")
        
        # 执行混合智能分析
        result = await ai_service.analyze_with_hybrid_intelligence(
            data=request.data,
            analysis_type=request.analysis_type,
            use_external_api=request.use_external_api
        )
        
        if "error" not in result:
            return AnalysisResponse(
                success=True,
                results=result,
                message="混合智能分析完成"
            )
        else:
            return AnalysisResponse(
                success=False,
                results={"error": result["error"]},
                message="混合智能分析失败"
            )
            
    except Exception as e:
        logger.error(f"混合智能分析失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/train")
async def train_model(request: TrainingRequest, background_tasks: BackgroundTasks):
    """模型训练接口"""
    try:
        if not ai_service or not ai_service.is_healthy():
            raise HTTPException(status_code=503, detail="AI服务不可用")
        
        # 在后台执行训练
        background_tasks.add_task(
            _train_model_background,
            request.model_name,
            request.training_data
        )
        
        return {
            "success": True,
            "message": f"模型 {request.model_name} 训练已开始",
            "model_name": request.model_name,
            "training_samples": len(request.training_data)
        }
        
    except Exception as e:
        logger.error(f"模型训练请求失败: {e}")
        raise HTTPException(status_code=500, detail=f"训练请求失败: {str(e)}")

async def _train_model_background(model_name: str, training_data: List[Dict[str, Any]]):
    """后台模型训练任务"""
    try:
        logger.info(f"开始后台训练模型: {model_name}")
        result = await ai_service.train_model(model_name, training_data)
        
        # 发送训练完成通知
        if kafka_service and kafka_service.is_healthy():
            await kafka_service.send_analysis_result({
                "type": "model_training_complete",
                "model_name": model_name,
                "result": result
            })
        
        logger.info(f"模型训练完成: {model_name}")
        
    except Exception as e:
        logger.error(f"后台模型训练失败 {model_name}: {e}")

@router.post("/detect/anomaly")
async def detect_anomaly(request: ThreatData):
    """异常检测接口"""
    try:
        if not ai_service or not ai_service.is_healthy():
            raise HTTPException(status_code=503, detail="AI服务不可用")
        
        result = await ai_service.detect_anomaly(request.data)
        
        return {
            "success": True,
            "result": result,
            "message": "异常检测完成"
        }
        
    except Exception as e:
        logger.error(f"异常检测失败: {e}")
        raise HTTPException(status_code=500, detail=f"异常检测失败: {str(e)}")

@router.post("/detect/malware")
async def detect_malware(request: ThreatData):
    """恶意软件检测接口"""
    try:
        if not ai_service or not ai_service.is_healthy():
            raise HTTPException(status_code=503, detail="AI服务不可用")
        
        result = await ai_service.detect_malware(request.data)
        
        return {
            "success": True,
            "result": result,
            "message": "恶意软件检测完成"
        }
        
    except Exception as e:
        logger.error(f"恶意软件检测失败: {e}")
        raise HTTPException(status_code=500, detail=f"恶意软件检测失败: {str(e)}")

@router.post("/detect/network")
async def detect_network_intrusion(request: ThreatData):
    """网络入侵检测接口"""
    try:
        if not ai_service or not ai_service.is_healthy():
            raise HTTPException(status_code=503, detail="AI服务不可用")
        
        result = await ai_service.detect_network_intrusion(request.data)
        
        return {
            "success": True,
            "result": result,
            "message": "网络入侵检测完成"
        }
        
    except Exception as e:
        logger.error(f"网络入侵检测失败: {e}")
        raise HTTPException(status_code=500, detail=f"网络入侵检测失败: {str(e)}")

@router.post("/analyze/behavior")
async def analyze_behavior(request: ThreatData):
    """用户行为分析接口"""
    try:
        if not ai_service or not ai_service.is_healthy():
            raise HTTPException(status_code=503, detail="AI服务不可用")
        
        result = await ai_service.analyze_user_behavior(request.data)
        
        return {
            "success": True,
            "result": result,
            "message": "用户行为分析完成"
        }
        
    except Exception as e:
        logger.error(f"用户行为分析失败: {e}")
        raise HTTPException(status_code=500, detail=f"用户行为分析失败: {str(e)}")

@router.post("/rules/match")
async def match_rules(request: RuleMatchRequest):
    """规则匹配接口"""
    try:
        if not rule_engine or not rule_engine.is_healthy():
            raise HTTPException(status_code=503, detail="规则引擎不可用")
        
        matches = await rule_engine.match_rules(request.data)
        
        return {
            "success": True,
            "matches": matches,
            "match_count": len(matches),
            "message": "规则匹配完成"
        }
        
    except Exception as e:
        logger.error(f"规则匹配失败: {e}")
        raise HTTPException(status_code=500, detail=f"规则匹配失败: {str(e)}")

@router.get("/models/status")
async def get_models_status():
    """获取模型状态"""
    try:
        if not ai_service:
            raise HTTPException(status_code=503, detail="AI服务不可用")
        
        metrics = ai_service.get_metrics()
        
        return {
            "success": True,
            "status": metrics,
            "message": "模型状态获取成功"
        }
        
    except Exception as e:
        logger.error(f"获取模型状态失败: {e}")
        raise HTTPException(status_code=500, detail=f"获取状态失败: {str(e)}")

@router.get("/rules/status")
async def get_rules_status():
    """获取规则状态"""
    try:
        if not rule_engine:
            raise HTTPException(status_code=503, detail="规则引擎不可用")
        
        metrics = rule_engine.get_metrics()
        
        return {
            "success": True,
            "status": metrics,
            "message": "规则状态获取成功"
        }
        
    except Exception as e:
        logger.error(f"获取规则状态失败: {e}")
        raise HTTPException(status_code=500, detail=f"获取状态失败: {str(e)}")

@router.post("/rules/update")
async def update_rules(background_tasks: BackgroundTasks):
    """更新规则库"""
    try:
        if not rule_engine:
            raise HTTPException(status_code=503, detail="规则引擎不可用")
        
        # 在后台更新规则
        background_tasks.add_task(_update_rules_background)
        
        return {
            "success": True,
            "message": "规则库更新已开始"
        }
        
    except Exception as e:
        logger.error(f"规则更新请求失败: {e}")
        raise HTTPException(status_code=500, detail=f"更新请求失败: {str(e)}")

async def _update_rules_background():
    """后台规则更新任务"""
    try:
        logger.info("开始后台更新规则库")
        await rule_engine._update_rules()
        
        # 发送更新完成通知
        if kafka_service and kafka_service.is_healthy():
            await kafka_service.send_analysis_result({
                "type": "rules_update_complete",
                "timestamp": asyncio.get_event_loop().time()
            })
        
        logger.info("规则库更新完成")
        
    except Exception as e:
        logger.error(f"后台规则更新失败: {e}")

@router.get("/kafka/status")
async def get_kafka_status():
    """获取Kafka状态"""
    try:
        if not kafka_service:
            raise HTTPException(status_code=503, detail="Kafka服务不可用")
        
        metrics = kafka_service.get_metrics()
        consumer_info = await kafka_service.get_consumer_info()
        
        return {
            "success": True,
            "metrics": metrics,
            "consumer_info": consumer_info,
            "message": "Kafka状态获取成功"
        }
        
    except Exception as e:
        logger.error(f"获取Kafka状态失败: {e}")
        raise HTTPException(status_code=500, detail=f"获取状态失败: {str(e)}")

@router.post("/alert/threat")
async def send_threat_alert(threat_info: Dict[str, Any]):
    """发送威胁告警"""
    try:
        if not kafka_service:
            raise HTTPException(status_code=503, detail="Kafka服务不可用")
        
        await kafka_service.send_threat_alert(threat_info)
        
        return {
            "success": True,
            "message": "威胁告警已发送"
        }
        
    except Exception as e:
        logger.error(f"发送威胁告警失败: {e}")
        raise HTTPException(status_code=500, detail=f"发送告警失败: {str(e)}")

@router.post("/action/protection")
async def send_protection_action(action: Dict[str, Any]):
    """发送防护动作"""
    try:
        if not kafka_service:
            raise HTTPException(status_code=503, detail="Kafka服务不可用")
        
        await kafka_service.send_protection_action(action)
        
        return {
            "success": True,
            "message": "防护动作已发送"
        }
        
    except Exception as e:
        logger.error(f"发送防护动作失败: {e}")
        raise HTTPException(status_code=500, detail=f"发送动作失败: {str(e)}") 

@router.get("/api-status")
async def get_api_status(detailed: bool = False):
    """获取API状态信息"""
    try:
        status = {
            "ai_service": ai_service.is_healthy() if ai_service else False,
            "kafka_service": kafka_service.is_healthy() if kafka_service else False,
            "rule_engine": rule_engine.is_healthy() if rule_engine else False,
            "external_api_service": external_api_service.is_healthy() if external_api_service else False
        }
        
        if detailed and external_api_service:
            external_status = await external_api_service.get_api_status()
            status["external_apis"] = external_status
        
        return {
            "success": True,
            "status": status,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"获取API状态失败: {e}")
        raise HTTPException(status_code=500, detail=str(e)) 