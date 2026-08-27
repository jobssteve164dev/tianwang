#!/bin/bash

# 天网安全监控系统 - 本地开发环境状态检查脚本
# TianWang Security System - Local Development Environment Status Script

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

# 检查服务状态
check_service_status() {
    local pid_file=$1
    local service_name=$2
    local port=$3
    local url=$4
    
    echo -n "$service_name: "
    
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if ps -p $pid > /dev/null 2>&1; then
            # 检查端口是否可访问
            if nc -z localhost $port 2>/dev/null; then
                echo -e "${GREEN}运行中${NC} (PID: $pid, 端口: $port)"
                echo -e "  ${CYAN}访问地址: $url${NC}"
            else
                echo -e "${YELLOW}进程存在但端口不可访问${NC} (PID: $pid, 端口: $port)"
            fi
        else
            echo -e "${RED}PID 记录已过期${NC} (PID: $pid)"
        fi
    elif nc -z localhost "$port" 2>/dev/null; then
        echo -e "${GREEN}运行中${NC} (端口: $port)"
        echo -e "  ${CYAN}访问地址: $url${NC}"
    else
        echo -e "${YELLOW}未启动${NC}"
    fi
}

# 检查端口占用情况
check_port_usage() {
    local port=$1
    local service_name=$2
    
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        local pid=$(lsof -Pi :$port -sTCP:LISTEN -t)
        local process=$(ps -p $pid -o comm= 2>/dev/null || echo "未知进程")
        echo -e "端口 $port: ${GREEN}被占用${NC} (PID: $pid, 进程: $process)"
    else
        echo -e "端口 $port: ${YELLOW}空闲${NC}"
    fi
}

# 检查依赖服务
check_dependencies() {
    log_step "检查依赖服务状态..."
    
    echo ""
    echo "=========================================="
    echo "           依赖服务状态"
    echo "=========================================="
    
    # 检查 PostgreSQL
    if pg_isready -h localhost -p 5432 >/dev/null 2>&1; then
        echo -e "PostgreSQL: ${GREEN}运行中${NC} (localhost:5432)"
    else
        echo -e "PostgreSQL: ${RED}未运行${NC} (localhost:5432)"
    fi
    
    # 检查 Redis
    if redis-cli ping >/dev/null 2>&1; then
        echo -e "Redis:      ${GREEN}运行中${NC} (localhost:6379)"
    else
        echo -e "Redis:      ${RED}未运行${NC} (localhost:6379)"
    fi
    
    # 检查 Kafka (可选)
    if command -v kafka-topics &> /dev/null; then
        if kafka-topics --bootstrap-server localhost:9092 --list >/dev/null 2>&1; then
            echo -e "Kafka:      ${GREEN}运行中${NC} (localhost:9092)"
        else
            echo -e "Kafka:      ${RED}未运行${NC} (localhost:9092)"
        fi
    else
        echo -e "Kafka:      ${YELLOW}未安装${NC}"
    fi
    
    # 检查 InfluxDB (可选)
    if curl -s http://localhost:8086/health >/dev/null 2>&1; then
        echo -e "InfluxDB:   ${GREEN}运行中${NC} (localhost:8086)"
    else
        echo -e "InfluxDB:   ${YELLOW}未运行${NC} (localhost:8086)"
    fi
}

# 检查应用服务
check_app_services() {
    log_step "检查应用服务状态..."
    
    echo ""
    echo "=========================================="
    echo "           应用服务状态"
    echo "=========================================="
    
    # 检查 AI 引擎
    check_service_status "server/ai-engine/.ai_engine.pid" "AI 引擎" "8888" "http://localhost:8888"
    
    # 检查服务端
    check_service_status "server/.server.pid" "服务端" "8000" "http://localhost:8000/health"
    
    # 检查客户端
    check_service_status "client/.client.pid" "客户端" "3000" "http://localhost:3000"
}

# 检查端口占用
check_ports() {
    log_step "检查端口占用情况..."
    
    echo ""
    echo "=========================================="
    echo "           端口占用情况"
    echo "=========================================="
    
    check_port_usage "3000" "客户端"
    check_port_usage "8000" "服务端"
    check_port_usage "8888" "AI 引擎"
    check_port_usage "5432" "PostgreSQL"
    check_port_usage "6379" "Redis"
    check_port_usage "9092" "Kafka"
    check_port_usage "8086" "InfluxDB"
}

# 检查环境变量文件
check_env_file() {
    log_step "检查环境变量文件..."
    
    echo ""
    echo "=========================================="
    echo "           环境变量文件"
    echo "=========================================="
    
    if [ -f "dev.local" ]; then
        echo -e "dev.local:  ${GREEN}存在${NC}"
        local line_count=$(wc -l < dev.local)
        echo -e "  行数: $line_count"
    else
        echo -e "dev.local:  ${RED}不存在${NC}"
    fi
    
    if [ -f "server/.env" ]; then
        echo -e "server/.env: ${GREEN}存在${NC}"
    else
        echo -e "server/.env: ${YELLOW}不存在${NC}"
    fi
}

# 检查日志文件
check_logs() {
    log_step "检查日志文件..."
    
    echo ""
    echo "=========================================="
    echo "           日志文件状态"
    echo "=========================================="
    
    if [ -f "server/logs/dev.log" ]; then
        local size=$(du -h server/logs/dev.log | cut -f1)
        local lines=$(wc -l < server/logs/dev.log)
        echo -e "服务端日志: ${GREEN}存在${NC} (大小: $size, 行数: $lines)"
    else
        echo -e "服务端日志: ${YELLOW}不存在${NC}"
    fi
    
    if [ -f "server/ai-engine/logs/app.log" ]; then
        local size=$(du -h server/ai-engine/logs/app.log | cut -f1)
        local lines=$(wc -l < server/ai-engine/logs/app.log)
        echo -e "AI引擎日志: ${GREEN}存在${NC} (大小: $size, 行数: $lines)"
    else
        echo -e "AI引擎日志: ${YELLOW}不存在${NC}"
    fi
}

# 主函数
main() {
    echo -e "${CYAN}"
    echo "=========================================="
    echo "    天网安全监控系统 - 开发环境状态"
    echo "    TianWang Security System - Dev Status"
    echo "=========================================="
    echo -e "${NC}"
    
    check_env_file
    check_dependencies
    check_app_services
    check_ports
    check_logs
    
    echo ""
    echo "=========================================="
    echo "           快速操作"
    echo "=========================================="
    echo -e "启动服务:   ${CYAN}npm run dev${NC}"
    echo -e "停止服务:   ${CYAN}在运行终端按 Ctrl+C${NC}"
    echo -e "查看状态:   ${CYAN}npm run dev:status${NC}"
    echo ""
}

# 脚本入口
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
