"""
天网AI分析引擎主应用
"""
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger
import uvicorn

from .config import config, validate_config
from .services.ai_service import AIService
from .services.kafka_service import KafkaService
from .services.rule_engine import RuleEngine
from .services.external_api_service import ExternalAPIService
from .api.routes import router as api_router

# 全局服务实例
ai_service: AIService = None
kafka_service: KafkaService = None
rule_engine: RuleEngine = None
external_api_service: ExternalAPIService = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    global ai_service, kafka_service, rule_engine, external_api_service
    
    # 启动时初始化
    logger.info("正在启动天网AI分析引擎...")
    
    # 验证配置
    if not validate_config():
        logger.error("配置验证失败")
        raise RuntimeError("配置验证失败")
    
    # 初始化服务
    ai_service = AIService()
    kafka_service = KafkaService()
    rule_engine = RuleEngine()
    external_api_service = ExternalAPIService()
    
    # 启动服务
    await ai_service.initialize()
    await kafka_service.start()
    await rule_engine.initialize()
    await external_api_service.initialize()
    
    # 设置服务间的引用关系
    ai_service.set_external_api_service(external_api_service)
    
    logger.info(f"AI分析引擎启动成功，监听端口: {config.port}")
    
    yield
    
    # 关闭时清理
    logger.info("正在关闭AI分析引擎...")
    await kafka_service.stop()
    await ai_service.cleanup()
    await rule_engine.cleanup()
    await external_api_service.cleanup()
    logger.info("AI分析引擎已关闭")

# 创建FastAPI应用
app = FastAPI(
    title="天网AI分析引擎",
    description="提供威胁检测、异常分析、智能决策等AI能力",
    version=config.app_version,
    lifespan=lifespan
)

# 配置CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(api_router, prefix="/api")

@app.get("/")
async def root():
    """根路径"""
    return {
        "name": config.app_name,
        "version": config.app_version,
        "status": "running"
    }

@app.get("/health")
async def health_check():
    """健康检查"""
    try:
        # 检查各个服务的状态
        services_status = {
            "ai_service": ai_service.is_healthy() if ai_service else False,
            "kafka_service": kafka_service.is_healthy() if kafka_service else False,
            "rule_engine": rule_engine.is_healthy() if rule_engine else False
        }
        
        all_healthy = all(services_status.values())
        
        return {
            "status": "healthy" if all_healthy else "unhealthy",
            "services": services_status,
            "timestamp": asyncio.get_event_loop().time()
        }
    except Exception as e:
        logger.error(f"健康检查失败: {e}")
        raise HTTPException(status_code=500, detail="健康检查失败")

@app.get("/metrics")
async def get_metrics():
    """获取系统指标"""
    try:
        metrics = {}
        
        if ai_service:
            metrics["ai_service"] = ai_service.get_metrics()
        
        if kafka_service:
            metrics["kafka_service"] = kafka_service.get_metrics()
            
        if rule_engine:
            metrics["rule_engine"] = rule_engine.get_metrics()
        
        return metrics
    except Exception as e:
        logger.error(f"获取指标失败: {e}")
        raise HTTPException(status_code=500, detail="获取指标失败")

def main():
    """主函数"""
    # 配置日志
    logger.add(
        config.log_file,
        rotation=config.log_rotation,
        retention=config.log_retention,
        level=config.log_level,
        format=config.log_format
    )
    
    # 启动服务器
    uvicorn.run(
        "src.main:app",
        host=config.host,
        port=config.port,
        reload=config.debug,
        log_level=config.log_level.lower()
    )

if __name__ == "__main__":
    main() 