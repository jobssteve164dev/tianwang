FROM python:3.11-slim AS production

# 设置工作目录
WORKDIR /app

# 设置环境变量
ENV PYTHONPATH=/app
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV AI_DEBUG=false

# 安装系统依赖
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    make \
    libffi-dev \
    libssl-dev \
    curl \
    git \
    && apt-get clean

# 复制依赖文件
COPY requirements.txt .

# 安装Python依赖
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# 创建必要的目录
RUN mkdir -p /app/models /app/rules/sigma/custom /app/logs

# 复制应用代码
COPY . .

# 创建非root用户
RUN useradd --uid 1001 --create-home --shell /bin/bash app && \
    chown -R app:app /app
USER app

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8888/health || exit 1

# 暴露端口
EXPOSE 8888

# 启动命令
CMD ["python", "-m", "src.main"]
