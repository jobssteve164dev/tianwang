#!/bin/bash

# 天网安全监控系统 - 增强版开发环境启动脚本
# TianWang Security System - Enhanced Development Environment Startup Script

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "${PURPLE}[STEP]${NC} $1"
}

# 检查命令是否存在
check_command() {
    if ! command -v $1 &> /dev/null; then
        log_error "$1 未安装，请先安装 $1"
        exit 1
    fi
}

# 清理端口占用
cleanup_port() {
    local port=$1
    local service_name=$2
    
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null ; then
        log_warning "端口 $port 被占用，正在清理..."
        
        # 获取占用端口的进程PID
        local pids=$(lsof -ti:$port)
        
        if [ -n "$pids" ]; then
            # 尝试优雅地终止进程
            for pid in $pids; do
                log_info "正在终止进程 $pid (端口 $port)"
                kill $pid 2>/dev/null
            done
            
            # 等待进程终止
            sleep 2
            
            # 检查是否还有进程占用端口
            if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null ; then
                log_warning "优雅终止失败，强制终止进程..."
                for pid in $pids; do
                    kill -9 $pid 2>/dev/null
                done
                sleep 1
            fi
            
            # 最终检查
            if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null ; then
                log_error "无法清理端口 $port，请手动检查"
                return 1
            else
                log_success "端口 $port 清理完成"
                return 0
            fi
        else
            log_error "无法获取占用端口 $port 的进程信息"
            return 1
        fi
    else
        log_success "端口 $port 可用"
        return 0
    fi
}

# 检查端口是否被占用
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null ; then
        log_warning "端口 $1 已被占用"
        return 1
    else
        log_success "端口 $1 可用"
        return 0
    fi
}

# 等待服务启动
wait_for_service() {
    local host=$1
    local port=$2
    local service_name=$3
    local max_attempts=30
    local attempt=1
    
    log_info "等待 $service_name 启动..."
    
    while [ $attempt -le $max_attempts ]; do
        if nc -z $host $port 2>/dev/null; then
            log_success "$service_name 已启动 (${host}:${port})"
            return 0
        fi
        
        echo -n "."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    log_error "$service_name 启动超时"
    return 1
}

# 创建必要的目录
create_directories() {
    log_step "创建必要的目录..."
    
    mkdir -p server/logs
    mkdir -p server/uploads
    mkdir -p server/ssl
    mkdir -p server/models
    mkdir -p client/build
    mkdir -p logs/dev
    
    log_success "目录创建完成"
}

# 检查环境变量文件
check_env_file() {
    log_step "检查环境变量文件..."
    
    if [ ! -f "dev.local" ]; then
        log_error "dev.local 文件不存在"
        exit 1
    fi
    
    log_success "环境变量文件检查完成"
}

# 检查依赖服务
check_dependencies() {
    log_step "检查依赖服务..."
    
    # 检查 Node.js
    check_command "node"
    check_command "npm"
    
    # 检查 Python (用于 AI 引擎)
    check_command "python3"
    
    # 检查 PostgreSQL
    if ! pg_isready -h localhost -p 5432 >/dev/null 2>&1; then
        log_warning "PostgreSQL 未运行，请确保 PostgreSQL 服务已启动"
    else
        log_success "PostgreSQL 连接正常"
    fi
    
    # 检查 Redis
    if ! redis-cli ping >/dev/null 2>&1; then
        log_warning "Redis 未运行，请确保 Redis 服务已启动"
    else
        log_success "Redis 连接正常"
    fi
    
    # 检查 Kafka (可选)
    if command -v kafka-topics &> /dev/null; then
        if kafka-topics --bootstrap-server localhost:9092 --list >/dev/null 2>&1; then
            log_success "Kafka 连接正常"
        else
            log_warning "Kafka 未运行，请确保 Kafka 服务已启动"
        fi
    else
        log_warning "Kafka 未安装，跳过检查"
    fi
}

# 检查依赖是否已安装
check_dependencies_installed() {
    local missing_deps=()
    local need_install=false
    local force_install=${1:-false}
    
    # 检查根目录依赖 - 使用更智能的检查方法
    if [ -f "package.json" ]; then
        if [ ! -d "node_modules" ] || [ ! "$(ls -A node_modules 2>/dev/null)" ]; then
            missing_deps+=("根目录依赖")
            need_install=true
        elif [ -f "package-lock.json" ] && [ "package.json" -nt "package-lock.json" ]; then
            missing_deps+=("根目录依赖(package.json已更新)")
            need_install=true
        fi
    fi
    
    # 检查服务端依赖
    if [ -f "server/package.json" ]; then
        if [ ! -d "server/node_modules" ] || [ ! "$(ls -A server/node_modules 2>/dev/null)" ]; then
            missing_deps+=("服务端依赖")
            need_install=true
        elif [ -f "server/package-lock.json" ] && [ "server/package.json" -nt "server/package-lock.json" ]; then
            missing_deps+=("服务端依赖(package.json已更新)")
            need_install=true
        fi
    fi
    
    # 检查客户端依赖
    if [ -f "client/package.json" ]; then
        if [ ! -d "client/node_modules" ] || [ ! "$(ls -A client/node_modules 2>/dev/null)" ]; then
            missing_deps+=("客户端依赖")
            need_install=true
        elif [ -f "client/package-lock.json" ] && [ "client/package.json" -nt "client/package-lock.json" ]; then
            missing_deps+=("客户端依赖(package.json已更新)")
            need_install=true
        fi
    fi
    
    # 检查 AI 引擎依赖 - 使用更可靠的时间戳检查
    if [ -f "server/ai-engine/requirements.txt" ] && [ ! -d "server/ai-engine/venv" ]; then
        missing_deps+=("AI引擎依赖")
        need_install=true
    elif [ -d "server/ai-engine/venv" ] && [ "server/ai-engine/requirements.txt" -nt "server/ai-engine/venv/pyvenv.cfg" ]; then
        missing_deps+=("AI引擎依赖(requirements.txt已更新)")
        need_install=true
    fi
    
    if [ "$need_install" = true ]; then
        # 只在非强制安装模式下显示警告
        if [ "$force_install" != true ]; then
            log_warning "发现需要安装的依赖: ${missing_deps[*]}"
        fi
        return 1
    fi
    
    log_success "所有依赖已安装且为最新版本"
    return 0
}

# 安装依赖
install_dependencies() {
    log_step "安装依赖..."
    
    # 安装根目录依赖
    if [ -f "package.json" ] && ( [ ! -d "node_modules" ] || [ ! "$(ls -A node_modules 2>/dev/null)" ] || ( [ -f "package-lock.json" ] && [ "package.json" -nt "package-lock.json" ] ) ); then
        if [ ! -d "node_modules" ] || [ ! "$(ls -A node_modules 2>/dev/null)" ]; then
            log_info "安装根目录依赖..."
        else
            log_info "根目录package.json已更新，重新安装依赖..."
        fi
        npm install
    fi
    
    # 安装服务端依赖
    if [ -f "server/package.json" ] && ( [ ! -d "server/node_modules" ] || [ ! "$(ls -A server/node_modules 2>/dev/null)" ] || ( [ -f "server/package-lock.json" ] && [ "server/package.json" -nt "server/package-lock.json" ] ) ); then
        if [ ! -d "server/node_modules" ] || [ ! "$(ls -A server/node_modules 2>/dev/null)" ]; then
            log_info "安装服务端依赖..."
        else
            log_info "服务端package.json已更新，重新安装依赖..."
        fi
        cd server
        npm install
        cd ..
    fi
    
    # 安装客户端依赖
    if [ -f "client/package.json" ] && ( [ ! -d "client/node_modules" ] || [ ! "$(ls -A client/node_modules 2>/dev/null)" ] || ( [ -f "client/package-lock.json" ] && [ "client/package.json" -nt "client/package-lock.json" ] ) ); then
        if [ ! -d "client/node_modules" ] || [ ! "$(ls -A client/node_modules 2>/dev/null)" ]; then
            log_info "安装客户端依赖..."
        else
            log_info "客户端package.json已更新，重新安装依赖..."
        fi
        cd client
        npm install
        cd ..
    fi
    
    # 安装 AI 引擎依赖
    if [ -f "server/ai-engine/requirements.txt" ] && ( [ ! -d "server/ai-engine/venv" ] || [ "server/ai-engine/requirements.txt" -nt "server/ai-engine/venv/pyvenv.cfg" ] ); then
        if [ ! -d "server/ai-engine/venv" ]; then
            cd server/ai-engine
            log_info "创建 AI 引擎虚拟环境..."
            python3 -m venv venv
            
            log_info "安装 AI 引擎依赖..."
            source venv/bin/activate
            pip install -r requirements.txt
            deactivate
            cd ../..
        else
            cd server/ai-engine
            log_info "AI引擎requirements.txt已更新，重新安装依赖..."
            source venv/bin/activate
            pip install -r requirements.txt
            deactivate
            cd ../..
        fi
    fi
    
    log_success "依赖安装完成"
}

# Kafka 调试和诊断函数
debug_kafka_connection() {
    log_step "Kafka 连接诊断..."
    
    echo ""
    echo "=========================================="
    echo "           Kafka 诊断信息"
    echo "=========================================="
    
    # 检查 Kafka 安装
    if command -v kafka-server-start &> /dev/null; then
        echo -e "Kafka 安装: ${GREEN}已安装${NC} ($(which kafka-server-start))"
        echo -e "Kafka 版本: ${CYAN}$(kafka-server-start --version 2>/dev/null | head -n1 || echo '未知')${NC}"
    else
        echo -e "Kafka 安装: ${RED}未安装${NC}"
        log_error "请先安装 Kafka: brew install kafka"
        return 1
    fi
    
    # 检查配置文件
    if [ -f "/usr/local/etc/kafka/server.properties" ]; then
        echo -e "配置文件: ${GREEN}存在${NC} (/usr/local/etc/kafka/server.properties)"
        
        # 检查关键配置
        local listeners=$(grep -E "^listeners=" /usr/local/etc/kafka/server.properties 2>/dev/null || echo "未配置")
        local advertised_listeners=$(grep -E "^advertised.listeners=" /usr/local/etc/kafka/server.properties 2>/dev/null || echo "未配置")
        
        echo -e "监听器配置: ${CYAN}$listeners${NC}"
        echo -e "广播监听器: ${CYAN}$advertised_listeners${NC}"
    else
        echo -e "配置文件: ${RED}不存在${NC}"
        log_error "Kafka 配置文件不存在，请检查安装"
        return 1
    fi
    
    # 检查端口状态
    if lsof -Pi :9092 -sTCP:LISTEN -t >/dev/null 2>&1; then
        local kafka_pid=$(lsof -ti:9092)
        echo -e "端口 9092: ${GREEN}被占用${NC} (PID: $kafka_pid)"
        
        # 检查是否是 Kafka 进程
        if ps -p $kafka_pid -o comm= | grep -q kafka; then
            echo -e "Kafka 进程: ${GREEN}正在运行${NC}"
        else
            echo -e "Kafka 进程: ${YELLOW}端口被其他进程占用${NC}"
        fi
    else
        echo -e "端口 9092: ${YELLOW}空闲${NC}"
    fi
    
    # 快速检查Kafka状态（不进行连接测试）
    if lsof -Pi :9092 -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "Kafka 状态: ${GREEN}端口已监听${NC}"
        return 0
    else
        echo -e "Kafka 状态: ${YELLOW}端口未监听${NC}"
        return 1
    fi
}

# 修复 Kafka 配置
fix_kafka_config() {
    log_step "修复 Kafka 配置..."
    
    local config_file="/usr/local/etc/kafka/server.properties"
    local backup_file="/usr/local/etc/kafka/server.properties.backup.$(date +%Y%m%d_%H%M%S)"
    
    # 备份原配置
    if [ -f "$config_file" ]; then
        cp "$config_file" "$backup_file"
        log_info "已备份原配置文件到: $backup_file"
    fi
    
    # 创建修复后的配置
    cat > "$config_file" << 'EOF'
# Kafka 服务器配置 - 开发环境优化版 (KRaft模式)
# Generated by TianWang Dev Script

# KRaft模式配置
process.roles=broker,controller
node.id=1
controller.quorum.voters=1@localhost:9093

# 基础配置
delete.topic.enable=true

# 网络配置
listeners=PLAINTEXT://localhost:9092,CONTROLLER://localhost:9093
advertised.listeners=PLAINTEXT://localhost:9092
listener.security.protocol.map=PLAINTEXT:PLAINTEXT,CONTROLLER:PLAINTEXT
inter.broker.listener.name=PLAINTEXT
controller.listener.names=CONTROLLER

# 日志配置
log.dirs=/tmp/kafka-logs
log.retention.hours=168
log.segment.bytes=1073741824
log.retention.check.interval.ms=300000

# 主题配置
num.partitions=1
default.replication.factor=1
min.insync.replicas=1

# 性能配置
num.network.threads=3
num.io.threads=8
socket.send.buffer.bytes=102400
socket.receive.buffer.bytes=102400
socket.request.max.bytes=104857600

# 消费者配置
group.initial.rebalance.delay.ms=0

# 生产者配置
compression.type=producer

# 安全配置（开发环境禁用）
authorizer.class.name=
EOF
    
    log_success "Kafka 配置已修复"
    log_info "配置文件: $config_file"
}

# 启动 Kafka
start_kafka() {
    log_step "启动 Kafka 服务..."
    
    # 首先进行诊断
    if debug_kafka_connection; then
        log_success "Kafka 已在运行且连接正常"
        return 0
    fi
    
    # 检查 Kafka 是否已安装
    if ! command -v kafka-server-start &> /dev/null; then
        log_error "Kafka 未安装，请先安装 Kafka"
        log_info "安装命令: brew install kafka"
        log_warning "AI 引擎将在离线模式下运行，Kafka 功能将不可用"
        return 1
    fi
    
    # 检查并清理端口
    if ! check_port 9092; then
        log_info "尝试清理 Kafka 端口 9092..."
        if cleanup_port 9092 "Kafka"; then
            log_success "端口清理成功，继续启动"
        else
            log_error "端口清理失败，无法启动 Kafka"
            log_warning "AI 引擎将在离线模式下运行，Kafka 功能将不可用"
            return 1
        fi
    fi
    
    # 检查配置文件
    if [ ! -f "/usr/local/etc/kafka/server.properties" ]; then
        log_error "Kafka 配置文件不存在"
        log_warning "AI 引擎将在离线模式下运行，Kafka 功能将不可用"
        return 1
    fi
    
    # 尝试修复配置
    log_info "检查并修复 Kafka 配置..."
    fix_kafka_config
    
    # 创建日志目录
    mkdir -p /tmp/kafka-logs
    
    # 格式化日志目录（KRaft模式需要）
    log_info "格式化 Kafka 日志目录..."
    if [ ! -f "/tmp/kafka-logs/meta.properties" ]; then
        kafka-storage format -t $(kafka-storage random-uuid) -c /usr/local/etc/kafka/server.properties > logs/dev/kafka-format.log 2>&1
        if [ $? -eq 0 ]; then
            log_success "日志目录格式化成功"
        else
            log_warning "日志目录格式化失败，查看日志: logs/dev/kafka-format.log"
        fi
    else
        log_info "日志目录已格式化"
    fi
    
    # 启动 Kafka
    log_info "启动 Kafka 服务..."
    kafka-server-start /usr/local/etc/kafka/server.properties > logs/dev/kafka.log 2>&1 &
    KAFKA_PID=$!
    echo $KAFKA_PID > .kafka.pid
    
    log_info "Kafka 启动中 (PID: $KAFKA_PID)..."
    log_info "Kafka 日志: logs/dev/kafka.log"
    
    # 等待 Kafka 启动
    if wait_for_service "localhost" "9092" "Kafka"; then
        log_success "Kafka 启动成功"
        
        # 创建必要的主题
        log_info "创建必要的 Kafka 主题..."
        create_kafka_topics
        
        # 快速连接测试
        log_info "验证 Kafka 连接..."
        if kafka-topics --bootstrap-server localhost:9092 --list >/dev/null 2>&1; then
            log_success "Kafka 服务完全就绪"
            return 0
        else
            log_warning "Kafka 启动但连接测试失败"
            log_warning "AI 引擎将在离线模式下运行，Kafka 功能将不可用"
            return 1
        fi
    else
        log_error "Kafka 启动失败"
        log_info "查看详细日志: tail -f logs/dev/kafka.log"
        log_warning "AI 引擎将在离线模式下运行，Kafka 功能将不可用"
        return 1
    fi
}

# 创建 Kafka 主题
create_kafka_topics() {
    local topics=("security-logs-dev" "security-alerts-dev" "protection-actions-dev")
    
    # 首先创建 __consumer_offsets 主题（KRaft模式需要）
    if ! kafka-topics --bootstrap-server localhost:9092 --topic "__consumer_offsets" --describe >/dev/null 2>&1; then
        log_info "创建 __consumer_offsets 主题..."
        kafka-topics --bootstrap-server localhost:9092 --create --topic "__consumer_offsets" --partitions 50 --replication-factor 1 --config cleanup.policy=compact --config retention.ms=604800000 >/dev/null 2>&1
    else
        log_info "__consumer_offsets 主题已存在"
    fi
    
    for topic in "${topics[@]}"; do
        if ! kafka-topics --bootstrap-server localhost:9092 --topic "$topic" --describe >/dev/null 2>&1; then
            log_info "创建主题: $topic"
            kafka-topics --bootstrap-server localhost:9092 --create --topic "$topic" --partitions 1 --replication-factor 1 >/dev/null 2>&1
        else
            log_info "主题已存在: $topic"
        fi
    done
}

# 启动服务函数
start_services() {
    log_step "启动项目服务..."
    
    # 启动 AI 引擎（如果存在启动脚本）
    if [ -f "server/ai-engine/start.sh" ]; then
        log_info "启动 AI 引擎..."
        cd server/ai-engine
        ./start.sh > logs/ai_engine.log 2>&1 &
        AI_PID=$!
        echo $AI_PID > .ai_engine.pid
        cd ../..
        log_success "AI 引擎已启动 (PID: $AI_PID)"
    elif [ -f "server/ai-engine/src/main.py" ]; then
        log_info "启动 AI 引擎 (Python)..."
        cd server/ai-engine
        
        # 确保日志目录存在
        mkdir -p logs
        
        source venv/bin/activate
        python -m src.main > logs/ai_engine.log 2>&1 &
        AI_PID=$!
        echo $AI_PID > .ai_engine.pid
        deactivate
        cd ../..
        log_success "AI 引擎已启动 (PID: $AI_PID)"
    fi
    
    # 启动服务端（如果存在启动脚本）
    if [ -f "server/start.sh" ]; then
        log_info "启动服务端..."
        cd server
        ./start.sh > logs/server.log 2>&1 &
        SERVER_PID=$!
        echo $SERVER_PID > .server.pid
        cd ..
        log_success "服务端已启动 (PID: $SERVER_PID)"
    elif [ -f "server/src/index.js" ]; then
        log_info "启动服务端 (Node.js)..."
        cd server
        
        # 确保日志目录存在
        mkdir -p logs
        
        npm start > logs/server.log 2>&1 &
        SERVER_PID=$!
        echo $SERVER_PID > .server.pid
        cd ..
        log_success "服务端已启动 (PID: $SERVER_PID)"
    fi
    
    # 启动客户端（如果存在启动脚本）
    if [ -f "client/start.sh" ]; then
        log_info "启动客户端..."
        cd client
        ./start.sh > logs/client.log 2>&1 &
        CLIENT_PID=$!
        echo $CLIENT_PID > .client.pid
        cd ..
        log_success "客户端已启动 (PID: $CLIENT_PID)"
    elif [ -f "client/package.json" ]; then
        log_info "启动客户端 (React)..."
        cd client
        
        # 确保日志目录存在
        mkdir -p logs
        
        PORT=3333 npm start > logs/client.log 2>&1 &
        CLIENT_PID=$!
        echo $CLIENT_PID > .client.pid
        cd ..
        log_success "客户端已启动 (PID: $CLIENT_PID)"
    fi
}

# 启动增强版日志收集器
start_enhanced_logger() {
    log_step "启动增强版开发环境日志收集器..."
    
    # 检查增强版日志收集器脚本是否存在
    if [ ! -f "scripts/dev-logger-enhanced.js" ]; then
        log_error "增强版日志收集器脚本不存在: scripts/dev-logger-enhanced.js"
        exit 1
    fi
    
    # 检查ws依赖是否安装
    if [ ! -d "node_modules/ws" ]; then
        log_info "安装WebSocket依赖..."
        npm install ws
    fi
    
    # 启动增强版日志收集器
    node scripts/dev-logger-enhanced.js &
    LOGGER_PID=$!
    echo $LOGGER_PID > .enhanced-logger.pid
    
    log_success "增强版日志收集器已启动 (PID: $LOGGER_PID)"
    log_info "日志文件: logs/dev/dev-console.log"
    log_info "WebSocket服务器: ws://localhost:8889"
}

# 显示服务状态
show_status() {
    log_step "服务状态检查..."
    
    echo ""
    echo "=========================================="
    echo "           服务启动状态"
    echo "=========================================="
    
    # 检查增强版日志收集器
    if [ -f ".enhanced-logger.pid" ]; then
        LOGGER_PID=$(cat .enhanced-logger.pid)
        if ps -p $LOGGER_PID > /dev/null; then
            echo -e "增强版日志收集器: ${GREEN}运行中${NC} (PID: $LOGGER_PID)"
        else
            echo -e "增强版日志收集器: ${RED}已停止${NC}"
        fi
    else
        echo -e "增强版日志收集器: ${YELLOW}未启动${NC}"
    fi
    
    # 检查 AI 引擎
    if [ -f "server/ai-engine/.ai_engine.pid" ]; then
        AI_PID=$(cat server/ai-engine/.ai_engine.pid)
        if ps -p $AI_PID > /dev/null; then
            echo -e "AI 引擎:     ${GREEN}运行中${NC} (PID: $AI_PID)"
        else
            echo -e "AI 引擎:     ${RED}已停止${NC}"
        fi
    else
        echo -e "AI 引擎:     ${YELLOW}未启动${NC}"
    fi
    
    # 检查服务端
    if [ -f "server/.server.pid" ]; then
        SERVER_PID=$(cat server/.server.pid)
        if ps -p $SERVER_PID > /dev/null; then
            echo -e "服务端:     ${GREEN}运行中${NC} (PID: $SERVER_PID)"
        else
            echo -e "服务端:     ${RED}已停止${NC}"
        fi
    else
        echo -e "服务端:     ${YELLOW}未启动${NC}"
    fi
    
    # 检查客户端
    if [ -f "client/.client.pid" ]; then
        CLIENT_PID=$(cat client/.client.pid)
        if ps -p $CLIENT_PID > /dev/null; then
            echo -e "客户端:     ${GREEN}运行中${NC} (PID: $CLIENT_PID)"
        else
            echo -e "客户端:     ${RED}已停止${NC}"
        fi
    else
        echo -e "客户端:     ${YELLOW}未启动${NC}"
    fi
    
    echo ""
    echo "=========================================="
    echo "           访问地址"
    echo "=========================================="
    echo -e "客户端:     ${CYAN}http://localhost:3333${NC}"
    echo -e "服务端 API: ${CYAN}http://localhost:5555/api${NC}"
    echo -e "API 文档:   ${CYAN}http://localhost:5555/api-docs${NC}"
    echo -e "AI 引擎:    ${CYAN}http://localhost:8888${NC}"
    echo ""
    echo "=========================================="
    echo "           日志信息"
    echo "=========================================="
    echo -e "日志文件:   ${CYAN}logs/dev/dev-console.log${NC}"
    echo -e "实时查看:   ${CYAN}node scripts/dev-log-tail.js watch${NC}"
    echo -e "WebSocket:  ${CYAN}ws://localhost:8889${NC}"
    echo -e "浏览器日志: ${CYAN}已集成到客户端页面${NC}"
    echo ""
}

# 清理函数
cleanup() {
    log_info "正在停止所有服务..."
    
    # 定义项目相关的进程名称模式
    local process_patterns=(
        "node.*dev-logger-enhanced.js"
        "node.*server/src/index.js"
        "node.*src/index.js"
        "node.*client/node_modules/.bin/react-scripts"
        "python.*server/ai-engine/src/main.py"
        "kafka-server-start"
        "kafka-topics"
        "kafka-console-producer"
        "kafka-console-consumer"
    )
    
    # 定义项目相关的端口
    local project_ports=(8888 5555 3333 8889 9092 9093)
    
    # 1. 基于PID文件停止服务
    log_step "基于PID文件停止服务..."
    
    # 停止增强版日志收集器
    if [ -f ".enhanced-logger.pid" ]; then
        LOGGER_PID=$(cat .enhanced-logger.pid)
        if ps -p $LOGGER_PID > /dev/null; then
            log_info "停止增强版日志收集器 (PID: $LOGGER_PID)..."
            kill $LOGGER_PID 2>/dev/null
            sleep 1
            if ps -p $LOGGER_PID > /dev/null; then
                log_warning "强制终止增强版日志收集器..."
                kill -9 $LOGGER_PID 2>/dev/null
            fi
            log_info "增强版日志收集器已停止"
        fi
        rm -f .enhanced-logger.pid
    fi
    
    # 停止 AI 引擎
    if [ -f "server/ai-engine/.ai_engine.pid" ]; then
        AI_PID=$(cat server/ai-engine/.ai_engine.pid)
        if ps -p $AI_PID > /dev/null; then
            log_info "停止 AI 引擎 (PID: $AI_PID)..."
            kill $AI_PID 2>/dev/null
            sleep 1
            if ps -p $AI_PID > /dev/null; then
                log_warning "强制终止 AI 引擎..."
                kill -9 $AI_PID 2>/dev/null
            fi
            log_info "AI 引擎已停止"
        fi
        rm -f server/ai-engine/.ai_engine.pid
    fi
    
    # 停止服务端
    if [ -f "server/.server.pid" ]; then
        SERVER_PID=$(cat server/.server.pid)
        if ps -p $SERVER_PID > /dev/null; then
            log_info "停止服务端 (PID: $SERVER_PID)..."
            kill $SERVER_PID 2>/dev/null
            sleep 1
            if ps -p $SERVER_PID > /dev/null; then
                log_warning "强制终止服务端..."
                kill -9 $SERVER_PID 2>/dev/null
            fi
            log_info "服务端已停止"
        fi
        rm -f server/.server.pid
    fi
    
    # 停止客户端
    if [ -f "client/.client.pid" ]; then
        CLIENT_PID=$(cat client/.client.pid)
        if ps -p $CLIENT_PID > /dev/null; then
            log_info "停止客户端 (PID: $CLIENT_PID)..."
            kill $CLIENT_PID 2>/dev/null
            sleep 1
            if ps -p $CLIENT_PID > /dev/null; then
                log_warning "强制终止客户端..."
                kill -9 $CLIENT_PID 2>/dev/null
            fi
            log_info "客户端已停止"
        fi
        rm -f client/.client.pid
    fi
    
    # 停止 Kafka
    if [ -f ".kafka.pid" ]; then
        KAFKA_PID=$(cat .kafka.pid)
        if ps -p $KAFKA_PID > /dev/null; then
            log_info "停止 Kafka (PID: $KAFKA_PID)..."
            kill $KAFKA_PID 2>/dev/null
            sleep 2
            if ps -p $KAFKA_PID > /dev/null; then
                log_warning "强制终止 Kafka..."
                kill -9 $KAFKA_PID 2>/dev/null
            fi
            log_info "Kafka 已停止"
        fi
        rm -f .kafka.pid
    fi
    
    # 2. 基于进程名称模式清理残留进程
    log_step "清理基于进程名称的残留进程..."
    for pattern in "${process_patterns[@]}"; do
        local pids=$(pgrep -f "$pattern" 2>/dev/null || true)
        if [ -n "$pids" ]; then
            log_info "发现匹配模式 '$pattern' 的进程: $pids"
            for pid in $pids; do
                if ps -p $pid > /dev/null; then
                    log_info "终止进程 $pid (模式: $pattern)..."
                    kill $pid 2>/dev/null
                    sleep 1
                    if ps -p $pid > /dev/null; then
                        log_warning "强制终止进程 $pid..."
                        kill -9 $pid 2>/dev/null
                    fi
                fi
            done
        fi
    done
    
    # 3. 基于端口清理残留进程
    log_step "清理基于端口的残留进程..."
    for port in "${project_ports[@]}"; do
        local pids=$(lsof -ti:$port 2>/dev/null || true)
        if [ -n "$pids" ]; then
            log_info "发现占用端口 $port 的进程: $pids"
            for pid in $pids; do
                if ps -p $pid > /dev/null; then
                    local process_name=$(ps -p $pid -o comm= 2>/dev/null || echo "未知")
                    log_info "终止占用端口 $port 的进程 $pid ($process_name)..."
                    kill $pid 2>/dev/null
                    sleep 1
                    if ps -p $pid > /dev/null; then
                        log_warning "强制终止进程 $pid..."
                        kill -9 $pid 2>/dev/null
                    fi
                fi
            done
        fi
    done
    
    # 4. 清理子进程（防止僵尸进程）
    log_step "清理子进程..."
    local child_pids=$(pgrep -P $$ 2>/dev/null || true)
    if [ -n "$child_pids" ]; then
        log_info "发现子进程: $child_pids"
        for pid in $child_pids; do
            if ps -p $pid > /dev/null; then
                local process_name=$(ps -p $pid -o comm= 2>/dev/null || echo "未知")
                log_info "终止子进程 $pid ($process_name)..."
                kill $pid 2>/dev/null
                sleep 1
                if ps -p $pid > /dev/null; then
                    log_warning "强制终止子进程 $pid..."
                    kill -9 $pid 2>/dev/null
                fi
            fi
        done
    fi
    
    # 5. 清理临时文件和PID文件
    log_step "清理临时文件..."
    rm -f .enhanced-logger.pid
    rm -f server/ai-engine/.ai_engine.pid
    rm -f server/.server.pid
    rm -f client/.client.pid
    rm -f .kafka.pid
    
    # 6. 最终验证
    log_step "验证清理结果..."
    local remaining_processes=0
    
    # 检查是否还有项目相关进程
    for pattern in "${process_patterns[@]}"; do
        local pids=$(pgrep -f "$pattern" 2>/dev/null || true)
        if [ -n "$pids" ]; then
            log_warning "仍有进程匹配模式 '$pattern': $pids"
            remaining_processes=$((remaining_processes + 1))
        fi
    done
    
    # 检查是否还有端口被占用
    for port in "${project_ports[@]}"; do
        if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
            local pids=$(lsof -ti:$port 2>/dev/null || true)
            log_warning "端口 $port 仍被占用: $pids"
            remaining_processes=$((remaining_processes + 1))
        fi
    done
    
    if [ $remaining_processes -eq 0 ]; then
        log_success "所有项目相关进程已彻底清理"
    else
        log_warning "仍有 $remaining_processes 个进程或端口未完全清理"
        log_info "如需手动清理，请使用: pkill -f 'tianwang|dev-logger|ai-engine'"
    fi
}

# 清理所有项目相关端口
cleanup_all_ports() {
    log_step "清理项目相关端口..."
    
    # 首先清理项目相关的进程
    log_info "清理项目相关进程..."
    local process_patterns=(
        "node.*dev-logger-enhanced.js"
        "node.*server/src/index.js"
        "node.*src/index.js"
        "node.*client/node_modules/.bin/react-scripts"
        "python.*server/ai-engine/src/main.py"
        "kafka-server-start"
        "kafka-topics"
        "kafka-console-producer"
        "kafka-console-consumer"
    )
    
    for pattern in "${process_patterns[@]}"; do
        local pids=$(pgrep -f "$pattern" 2>/dev/null || true)
        if [ -n "$pids" ]; then
            log_info "发现匹配模式 '$pattern' 的进程: $pids"
            for pid in $pids; do
                if ps -p $pid > /dev/null; then
                    local process_name=$(ps -p $pid -o comm= 2>/dev/null || echo "未知")
                    log_info "终止进程 $pid ($process_name)..."
                    kill $pid 2>/dev/null
                    sleep 1
                    if ps -p $pid > /dev/null; then
                        log_warning "强制终止进程 $pid..."
                        kill -9 $pid 2>/dev/null
                    fi
                fi
            done
        fi
    done
    
    # 然后清理端口占用
    local ports=(8888 5555 3333 8889)
    local services=("AI引擎" "服务端" "客户端" "WebSocket")
    
    for i in "${!ports[@]}"; do
        local port=${ports[$i]}
        local service=${services[$i]}
        
        if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null ; then
            log_info "发现 $service 端口 $port 被占用，正在清理..."
            cleanup_port $port "$service"
        fi
    done
    
    log_success "端口清理完成"
}

# 主函数
main() {
    echo -e "${CYAN}"
    echo "=========================================="
    echo "    天网安全监控系统 - 增强版开发环境启动"
    echo "    TianWang Security System - Enhanced Dev Start"
    echo "    包含浏览器日志收集功能"
    echo "=========================================="
    echo -e "${NC}"
    
    # 检查命令行参数
    local force_install=false
    while [[ $# -gt 0 ]]; do
        case $1 in
            --force-install|-f)
                force_install=true
                shift
                ;;
            --help|-h)
                echo "用法: $0 [选项]"
                echo "选项:"
                echo "  -f, --force-install    强制重新安装所有依赖"
                echo "  -h, --help             显示此帮助信息"
                exit 0
                ;;
            *)
                log_error "未知参数: $1"
                echo "使用 --help 查看帮助信息"
                exit 1
                ;;
        esac
    done
    
    # 设置信号处理 - 增强版
    # 捕获更多退出信号以确保彻底清理
    trap cleanup EXIT INT TERM HUP QUIT ABRT USR1 USR2
    
    # 执行启动流程
    create_directories
    check_env_file
    check_dependencies
    cleanup_all_ports
    
    # 智能依赖检查和安装
    if [ "$force_install" = true ]; then
        log_step "强制重新安装所有依赖..."
        install_dependencies
    elif ! check_dependencies_installed "$force_install"; then
        log_step "检测到缺失依赖，自动安装..."
        install_dependencies
    else
        log_step "所有依赖已就绪，跳过安装步骤"
    fi
    
    start_kafka
    start_enhanced_logger
    
    # 启动其他服务（如果存在启动脚本）
    start_services
    
    show_status
    
    log_success "增强版开发环境启动完成！"
    log_info "按 Ctrl+C 停止所有服务"
    log_info "查看实时日志: node scripts/dev-log-tail.js watch"
    log_info "浏览器日志已自动收集到统一日志文件"
    log_info "如需强制重新安装依赖，请使用: $0 --force-install"
    log_info "如需手动清理所有进程，请使用: ./scripts/dev-cleanup.sh"
    
    # 等待用户中断
    wait
}

# 脚本入口
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
