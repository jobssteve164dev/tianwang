#!/bin/bash

# 天网安全监控系统 - 本地开发环境启动脚本
# TianWang Security System - Local Development Environment Startup Script

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
    
    # 检查根目录依赖
    if [ ! -d "node_modules" ]; then
        missing_deps+=("根目录依赖")
    fi
    
    # 检查服务端依赖
    if [ ! -d "server/node_modules" ]; then
        missing_deps+=("服务端依赖")
    fi
    
    # 检查客户端依赖
    if [ ! -d "client/node_modules" ]; then
        missing_deps+=("客户端依赖")
    fi
    
    # 检查 AI 引擎依赖
    if [ -f "server/ai-engine/requirements.txt" ]; then
        # 检查关键Python包是否已安装
        if ! python3 -c "import fastapi, uvicorn, pydantic_settings" 2>/dev/null; then
            missing_deps+=("AI引擎依赖")
        fi
    fi
    
    if [ ${#missing_deps[@]} -eq 0 ]; then
        log_success "所有依赖已安装"
        return 0
    else
        log_warning "发现缺失依赖: ${missing_deps[*]}"
        return 1
    fi
}

# 安装依赖
install_dependencies() {
    log_step "检查项目依赖..."
    
    if check_dependencies_installed; then
        log_success "依赖检查完成，无需安装"
        return
    fi
    
    log_step "安装缺失的依赖..."
    
    # 安装根目录依赖
    if [ ! -d "node_modules" ]; then
        log_info "安装根目录依赖..."
        npm install
    fi
    
    # 安装服务端依赖
    if [ ! -d "server/node_modules" ]; then
        log_info "安装服务端依赖..."
        cd server && npm install && cd ..
    fi
    
    # 安装客户端依赖
    if [ ! -d "client/node_modules" ]; then
        log_info "安装客户端依赖..."
        cd client && npm install && cd ..
    fi
    
    # 安装 AI 引擎依赖
    if [ -f "server/ai-engine/requirements.txt" ]; then
        if ! python3 -c "import fastapi, uvicorn, pydantic_settings" 2>/dev/null; then
            log_info "安装 AI 引擎依赖..."
            cd server/ai-engine && pip3 install -r requirements.txt && cd ../..
        fi
    fi
    
    log_success "依赖安装完成"
}

# 启动 Kafka 服务
start_kafka() {
    log_step "启动 Kafka 服务..."
    
    # 确保在项目根目录
    cd /Volumes/备份/QSYNCS/Qsync/00.AI_PROJECT/tianwang
    
    # 检查 Kafka 是否已安装
    if ! command -v kafka-server-start &> /dev/null; then
        log_error "Kafka 未安装，请先安装 Kafka"
        log_info "安装命令: brew install kafka"
        return 1
    fi
    
    # 检查并清理端口 9092
    if ! check_port 9092; then
        log_info "尝试清理 Kafka 端口 9092..."
        if cleanup_port 9092 "Kafka"; then
            log_success "端口清理成功，继续启动"
        else
            log_error "端口清理失败，无法启动 Kafka"
            return 1
        fi
    fi
    
    # 检查并清理端口 9093 (KRaft controller)
    if ! check_port 9093; then
        log_info "尝试清理 Kafka Controller 端口 9093..."
        if cleanup_port 9093 "Kafka Controller"; then
            log_success "端口清理成功，继续启动"
        else
            log_error "端口清理失败，无法启动 Kafka"
            return 1
        fi
    fi
    
    # 启动 Kafka (KRaft 模式，不需要 Zookeeper)
    log_info "启动 Kafka 服务 (KRaft 模式)..."
    kafka-server-start /usr/local/etc/kafka/server.properties &
    KAFKA_PID=$!
    echo $KAFKA_PID > .kafka.pid
    
    # 等待 Kafka 启动
    wait_for_service "localhost" "9092" "Kafka"
}

# 启动 AI 引擎
start_ai_engine() {
    log_step "启动 AI 引擎..."
    
    # 确保在项目根目录
    cd /Volumes/备份/QSYNCS/Qsync/00.AI_PROJECT/tianwang
    
    if [ -f "server/ai-engine/src/main.py" ]; then
        cd server/ai-engine
        
        # 检查并清理端口 8888
        if ! check_port 8888; then
            log_info "尝试清理 AI 引擎端口 8888..."
            if cleanup_port 8888 "AI 引擎"; then
                log_success "端口清理成功，继续启动"
            else
                log_error "端口清理失败，跳过 AI 引擎启动"
                cd ../..
                return
            fi
        fi
        
        log_info "启动 AI 引擎服务..."
        # 设置AI引擎环境变量
        export AI_PORT=8888
        export AI_HOST=0.0.0.0
        export AI_DEBUG=true
        
        # 使用模块方式启动，避免相对导入问题
        python3 -m src.main &
        AI_ENGINE_PID=$!
        echo $AI_ENGINE_PID > .ai_engine.pid
        
        # 等待 AI 引擎启动
        wait_for_service "localhost" "8888" "AI 引擎"
        
        cd ../..
    else
        log_warning "AI 引擎文件不存在，跳过启动"

    fi
}

# 启动服务端
start_server() {
    log_step "启动服务端..."
    
    # 确保在项目根目录
    cd /Volumes/备份/QSYNCS/Qsync/00.AI_PROJECT/tianwang
    cd server
    
    # 检查并清理端口 5555
    if ! check_port 5555; then
        log_info "尝试清理服务端端口 5555..."
        if cleanup_port 5555 "服务端"; then
            log_success "端口清理成功，继续启动"
        else
            log_error "端口清理失败，无法启动服务端"
            exit 1
        fi
    fi
    
    log_info "启动服务端服务..."
    
    # 设置环境变量
    export $(cat ../../dev.local | xargs)
    
    # 启动服务
    npm run dev &
    SERVER_PID=$!
    echo $SERVER_PID > .server.pid
    
    # 等待服务端启动
    wait_for_service "localhost" "5555" "服务端"
    
    cd ..
}

# 启动客户端
start_client() {
    log_step "启动客户端..."
    
    # 确保在项目根目录
    cd /Volumes/备份/QSYNCS/Qsync/00.AI_PROJECT/tianwang
    cd client
    
    # 检查并清理端口 3333
    if ! check_port 3333; then
        log_info "尝试清理客户端端口 3333..."
        if cleanup_port 3333 "客户端"; then
            log_success "端口清理成功，继续启动"
        else
            log_error "端口清理失败，无法启动客户端"
            exit 1
        fi
    fi
    
    log_info "启动客户端服务..."
    
    # 设置环境变量
    export $(cat ../../dev.local | grep REACT_APP_ | xargs)
    
    # 启动服务
    PORT=3333 npm start &
    CLIENT_PID=$!
    echo $CLIENT_PID > .client.pid
    
    # 等待客户端启动
    wait_for_service "localhost" "3333" "客户端"
    
    cd ..
}

# 显示服务状态
show_status() {
    log_step "服务状态检查..."
    
    echo ""
    echo "=========================================="
    echo "           服务启动状态"
    echo "=========================================="
    
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
}

# 清理函数
cleanup() {
    log_info "正在停止所有服务..."
    
    # 停止 AI 引擎
    if [ -f "server/ai-engine/.ai_engine.pid" ]; then
        AI_PID=$(cat server/ai-engine/.ai_engine.pid)
        if ps -p $AI_PID > /dev/null; then
            kill $AI_PID
            log_info "AI 引擎已停止"
        fi
        rm -f server/ai-engine/.ai_engine.pid
    fi
    
    # 停止服务端
    if [ -f "server/.server.pid" ]; then
        SERVER_PID=$(cat server/.server.pid)
        if ps -p $SERVER_PID > /dev/null; then
            kill $SERVER_PID
            log_info "服务端已停止"
        fi
        rm -f server/.server.pid
    fi
    
    # 停止客户端
    if [ -f "client/.client.pid" ]; then
        CLIENT_PID=$(cat client/.client.pid)
        if ps -p $CLIENT_PID > /dev/null; then
            kill $CLIENT_PID
            log_info "客户端已停止"
        fi
        rm -f client/.client.pid
    fi
    
    # 停止 Kafka
    if [ -f ".kafka.pid" ]; then
        KAFKA_PID=$(cat .kafka.pid)
        if ps -p $KAFKA_PID > /dev/null; then
            kill $KAFKA_PID
            log_info "Kafka 已停止"
        fi
        rm -f .kafka.pid
    fi
    

    
    log_success "所有服务已停止"
}

# 清理所有项目相关端口
cleanup_all_ports() {
    log_step "清理项目相关端口..."
    
    local ports=(8888 5555 3333)
    local services=("AI引擎" "服务端" "客户端")
    
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
    echo "    天网安全监控系统 - 开发环境启动"
    echo "    TianWang Security System - Dev Start"
    echo "=========================================="
    echo -e "${NC}"
    
    # 设置信号处理
    trap cleanup EXIT INT TERM
    
    # 执行启动流程
    create_directories
    check_env_file
    check_dependencies
    cleanup_all_ports
    install_dependencies
    start_kafka
    start_ai_engine
    start_server
    start_client
    show_status
    
    log_success "开发环境启动完成！"
    log_info "按 Ctrl+C 停止所有服务"
    log_info "查看日志: node scripts/dev-log-tail.js"
    log_info "实时监控: node scripts/dev-log-tail.js watch"
    
    # 等待用户中断
    wait
}

# 脚本入口
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
