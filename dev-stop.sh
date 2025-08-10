#!/bin/bash

# 天网安全监控系统 - 本地开发环境停止脚本
# TianWang Security System - Local Development Environment Stop Script

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

# 停止服务函数
stop_service() {
    local pid_file=$1
    local service_name=$2
    
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if ps -p $pid > /dev/null 2>&1; then
            log_info "停止 $service_name (PID: $pid)..."
            kill $pid
            sleep 2
            
            # 检查是否成功停止
            if ps -p $pid > /dev/null 2>&1; then
                log_warning "$service_name 未响应，强制停止..."
                kill -9 $pid
            fi
            
            log_success "$service_name 已停止"
        else
            log_warning "$service_name 进程不存在"
        fi
        rm -f "$pid_file"
    else
        log_warning "$service_name PID 文件不存在"
    fi
}

# 主函数
main() {
    echo -e "${CYAN}"
    echo "=========================================="
    echo "    天网安全监控系统 - 开发环境停止"
    echo "    TianWang Security System - Dev Stop"
    echo "=========================================="
    echo -e "${NC}"
    
    log_step "停止所有开发服务..."
    
    # 停止 AI 引擎
    stop_service "server/ai-engine/.ai_engine.pid" "AI 引擎"
    
    # 停止服务端
    stop_service "server/.server.pid" "服务端"
    
    # 停止客户端
    stop_service "client/.client.pid" "客户端"
    
    # 清理可能的残留进程
    log_step "清理残留进程..."
    
    # 查找并停止可能的 Node.js 进程
    pkill -f "nodemon.*server" 2>/dev/null || true
    pkill -f "react-scripts start" 2>/dev/null || true
    pkill -f "python3.*ai-engine" 2>/dev/null || true
    
    log_success "所有服务已停止"
    
    echo ""
    echo "=========================================="
    echo "           清理完成"
    echo "=========================================="
    echo -e "所有开发服务已停止"
    echo -e "PID 文件已清理"
    echo -e "残留进程已清理"
    echo ""
}

# 脚本入口
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
