#!/bin/bash

# 天网安全监控系统 - 本地开发环境清理脚本
# TianWang Security System - Local Development Environment Cleanup Script

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

# 检查端口占用
check_port() {
    local port=$1
    local service_name=$2
    
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        local pid=$(lsof -Pi :$port -sTCP:LISTEN -t)
        local process=$(ps -p $pid -o comm= 2>/dev/null || echo "未知进程")
        echo -e "端口 $port ($service_name): ${RED}被占用${NC} (PID: $pid, 进程: $process)"
        return 1
    else
        echo -e "端口 $port ($service_name): ${GREEN}空闲${NC}"
        return 0
    fi
}

# 清理端口占用
cleanup_port() {
    local port=$1
    local service_name=$2
    
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        local pid=$(lsof -Pi :$port -sTCP:LISTEN -t)
        local process=$(ps -p $pid -o comm= 2>/dev/null || echo "未知进程")
        
        # 检查是否是系统进程
        if [[ "$process" == *"System"* ]] || [[ "$process" == *"ControlCenter"* ]] || [[ "$process" == *"postgres"* ]] || [[ "$process" == *"redis"* ]]; then
            log_warning "端口 $port 被系统进程占用 ($process)，跳过清理"
            return 1
        fi
        
        log_info "清理端口 $port 占用 (PID: $pid, 进程: $process)..."
        kill $pid
        sleep 2
        
        # 检查是否成功清理
        if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
            log_warning "进程未响应，强制停止..."
            kill -9 $pid
        fi
        
        log_success "端口 $port 已清理"
        return 0
    else
        log_info "端口 $port 未被占用"
        return 0
    fi
}

# 清理PID文件
cleanup_pid_files() {
    log_step "清理PID文件..."
    
    local pid_files=(
        "server/ai-engine/.ai_engine.pid"
        "server/.server.pid"
        "client/.client.pid"
    )
    
    for pid_file in "${pid_files[@]}"; do
        if [ -f "$pid_file" ]; then
            local pid=$(cat "$pid_file")
            if ps -p $pid > /dev/null 2>&1; then
                log_info "停止进程 $pid ($pid_file)..."
                kill $pid 2>/dev/null || true
                sleep 1
                if ps -p $pid > /dev/null 2>&1; then
                    kill -9 $pid 2>/dev/null || true
                fi
            fi
            rm -f "$pid_file"
            log_success "已清理 $pid_file"
        fi
    done
}

# 清理残留进程
cleanup_processes() {
    log_step "清理残留进程..."
    
    # 查找并停止相关的Node.js进程
    local node_processes=$(pgrep -f "nodemon.*server" 2>/dev/null || true)
    if [ ! -z "$node_processes" ]; then
        log_info "停止nodemon进程..."
        echo "$node_processes" | xargs kill 2>/dev/null || true
    fi
    
    local react_processes=$(pgrep -f "react-scripts start" 2>/dev/null || true)
    if [ ! -z "$react_processes" ]; then
        log_info "停止React进程..."
        echo "$react_processes" | xargs kill 2>/dev/null || true
    fi
    
    local python_processes=$(pgrep -f "python3.*ai-engine" 2>/dev/null || true)
    if [ ! -z "$python_processes" ]; then
        log_info "停止AI引擎进程..."
        echo "$python_processes" | xargs kill 2>/dev/null || true
    fi
    
    log_success "残留进程清理完成"
}

# 清理临时文件
cleanup_temp_files() {
    log_step "清理临时文件..."
    
    # 清理可能的临时文件
    find . -name "*.tmp" -delete 2>/dev/null || true
    find . -name "*.log" -path "*/logs/*" -delete 2>/dev/null || true
    
    log_success "临时文件清理完成"
}

# 检查并清理端口
check_and_cleanup_ports() {
    log_step "检查端口占用情况..."
    
    echo ""
    echo "=========================================="
    echo "           端口占用检查"
    echo "=========================================="
    
    local ports=(
        "3333:客户端"
        "5555:服务端"
        "8888:AI引擎"
    )
    
    local has_conflicts=false
    
    for port_info in "${ports[@]}"; do
        IFS=':' read -r port service <<< "$port_info"
        if ! check_port "$port" "$service"; then
            has_conflicts=true
        fi
    done
    
    if [ "$has_conflicts" = true ]; then
        echo ""
        log_step "开始清理端口占用..."
        
        for port_info in "${ports[@]}"; do
            IFS=':' read -r port service <<< "$port_info"
            cleanup_port "$port" "$service"
        done
        
        echo ""
        log_step "清理后的端口状态..."
        
        for port_info in "${ports[@]}"; do
            IFS=':' read -r port service <<< "$port_info"
            check_port "$port" "$service"
        done
    else
        log_success "所有端口都可用"
    fi
}

# 主函数
main() {
    echo -e "${CYAN}"
    echo "=========================================="
    echo "    天网安全监控系统 - 开发环境清理"
    echo "    TianWang Security System - Dev Cleanup"
    echo "=========================================="
    echo -e "${NC}"
    
    # 检查端口占用
    check_and_cleanup_ports
    
    # 清理PID文件
    cleanup_pid_files
    
    # 清理残留进程
    cleanup_processes
    
    # 清理临时文件
    cleanup_temp_files
    
    echo ""
    echo "=========================================="
    echo "           清理完成"
    echo "=========================================="
    echo -e "端口占用已清理"
    echo -e "PID文件已清理"
    echo -e "残留进程已清理"
    echo -e "临时文件已清理"
    echo ""
    echo -e "现在可以安全地启动开发环境："
    echo -e "${CYAN}./scripts/dev-start.sh${NC}"
    echo ""
}

# 脚本入口
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
