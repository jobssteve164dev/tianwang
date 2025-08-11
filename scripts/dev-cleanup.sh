#!/bin/bash

# 天网安全监控系统 - 开发环境清理脚本
# TianWang Security System - Development Environment Cleanup Script

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

# 强制清理函数
force_cleanup() {
    log_step "执行强制清理..."
    
    # 定义项目相关的进程名称模式
    local process_patterns=(
        "node.*dev-logger-enhanced.js"
        "node.*server/src/index.js"
        "node.*client/node_modules/.bin/react-scripts"
        "python.*server/ai-engine/src/main.py"
        "kafka-server-start"
        "kafka-topics"
        "kafka-console-producer"
        "kafka-console-consumer"
        "tianwang"
        "dev-logger"
        "ai-engine"
    )
    
    # 定义项目相关的端口
    local project_ports=(8888 5555 3333 8889 9092 9093)
    
    # 1. 基于进程名称模式强制清理
    log_step "基于进程名称模式强制清理..."
    for pattern in "${process_patterns[@]}"; do
        local pids=$(pgrep -f "$pattern" 2>/dev/null || true)
        if [ -n "$pids" ]; then
            log_info "发现匹配模式 '$pattern' 的进程: $pids"
            for pid in $pids; do
                if ps -p $pid > /dev/null; then
                    local process_name=$(ps -p $pid -o comm= 2>/dev/null || echo "未知")
                    log_info "强制终止进程 $pid ($process_name)..."
                    kill -9 $pid 2>/dev/null
                fi
            done
        fi
    done
    
    # 2. 基于端口强制清理
    log_step "基于端口强制清理..."
    for port in "${project_ports[@]}"; do
        local pids=$(lsof -ti:$port 2>/dev/null || true)
        if [ -n "$pids" ]; then
            log_info "发现占用端口 $port 的进程: $pids"
            for pid in $pids; do
                if ps -p $pid > /dev/null; then
                    local process_name=$(ps -p $pid -o comm= 2>/dev/null || echo "未知")
                    log_info "强制终止占用端口 $port 的进程 $pid ($process_name)..."
                    kill -9 $pid 2>/dev/null
                fi
            done
        fi
    done
    
    # 3. 清理所有Node.js进程（谨慎使用）
    if [ "$1" = "--aggressive" ]; then
        log_warning "执行激进清理模式..."
        local node_pids=$(pgrep -f "node.*tianwang" 2>/dev/null || true)
        if [ -n "$node_pids" ]; then
            log_info "发现项目相关Node.js进程: $node_pids"
            for pid in $node_pids; do
                if ps -p $pid > /dev/null; then
                    local process_name=$(ps -p $pid -o comm= 2>/dev/null || echo "未知")
                    log_info "强制终止Node.js进程 $pid ($process_name)..."
                    kill -9 $pid 2>/dev/null
                fi
            done
        fi
    fi
    
    # 4. 清理临时文件和PID文件
    log_step "清理临时文件..."
    rm -f .enhanced-logger.pid
    rm -f server/ai-engine/.ai_engine.pid
    rm -f server/.server.pid
    rm -f client/.client.pid
    rm -f .kafka.pid
    
    # 5. 清理日志文件（可选）
    if [ "$1" = "--clean-logs" ]; then
        log_step "清理日志文件..."
        rm -f logs/dev/*.log
        rm -f server/logs/*.log
        rm -f server/ai-engine/logs/*.log
        log_info "日志文件已清理"
    fi
    
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
        log_info "建议使用 --aggressive 参数进行更彻底的清理"
    fi
}

# 显示当前状态
show_status() {
    log_step "当前项目进程状态..."
    
    echo ""
    echo "=========================================="
    echo "           项目进程状态"
    echo "=========================================="
    
    # 检查PID文件
    local pid_files=(
        ".enhanced-logger.pid:增强版日志收集器"
        "server/ai-engine/.ai_engine.pid:AI引擎"
        "server/.server.pid:服务端"
        "client/.client.pid:客户端"
        ".kafka.pid:Kafka"
    )
    
    for pid_file_info in "${pid_files[@]}"; do
        IFS=':' read -r pid_file service_name <<< "$pid_file_info"
        if [ -f "$pid_file" ]; then
            local pid=$(cat "$pid_file")
            if ps -p $pid > /dev/null; then
                echo -e "$service_name: ${GREEN}运行中${NC} (PID: $pid)"
            else
                echo -e "$service_name: ${RED}已停止${NC} (PID文件存在但进程不存在)"
            fi
        else
            echo -e "$service_name: ${YELLOW}未启动${NC}"
        fi
    done
    
    echo ""
    echo "=========================================="
    echo "           端口占用状态"
    echo "=========================================="
    
    local ports=(8888 5555 3333 8889 9092 9093)
    local services=("AI引擎" "服务端" "客户端" "WebSocket" "Kafka" "Kafka控制器")
    
    for i in "${!ports[@]}"; do
        local port=${ports[$i]}
        local service=${services[$i]}
        
        if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
            local pids=$(lsof -ti:$port 2>/dev/null || true)
            echo -e "$service (端口 $port): ${YELLOW}被占用${NC} (PID: $pids)"
        else
            echo -e "$service (端口 $port): ${GREEN}空闲${NC}"
        fi
    done
    
    echo ""
}

# 主函数
main() {
    echo -e "${CYAN}"
    echo "=========================================="
    echo "    天网安全监控系统 - 开发环境清理工具"
    echo "    TianWang Security System - Dev Cleanup Tool"
    echo "=========================================="
    echo -e "${NC}"
    
    # 检查命令行参数
    local show_status_only=false
    local aggressive_mode=false
    local clean_logs=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --status|-s)
                show_status_only=true
                shift
                ;;
            --aggressive|-a)
                aggressive_mode=true
                shift
                ;;
            --clean-logs|-l)
                clean_logs=true
                shift
                ;;
            --help|-h)
                echo "用法: $0 [选项]"
                echo "选项:"
                echo "  -s, --status        仅显示当前状态，不执行清理"
                echo "  -a, --aggressive    激进清理模式（包括所有Node.js进程）"
                echo "  -l, --clean-logs    同时清理日志文件"
                echo "  -h, --help          显示此帮助信息"
                echo ""
                echo "示例:"
                echo "  $0                  # 标准清理"
                echo "  $0 --status         # 仅查看状态"
                echo "  $0 --aggressive     # 激进清理"
                echo "  $0 --clean-logs     # 清理并删除日志"
                exit 0
                ;;
            *)
                log_error "未知参数: $1"
                echo "使用 --help 查看帮助信息"
                exit 1
                ;;
        esac
    done
    
    # 检查必要命令
    check_command "ps"
    check_command "pgrep"
    check_command "lsof"
    
    # 切换到项目根目录
    cd "$(dirname "$0")/.."
    
    if [ "$show_status_only" = true ]; then
        show_status
        exit 0
    fi
    
    # 确认清理操作
    if [ "$aggressive_mode" = true ]; then
        log_warning "即将执行激进清理模式，这将终止所有项目相关的Node.js进程"
        read -p "确认继续吗？(y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "操作已取消"
            exit 0
        fi
    fi
    
    # 执行清理
    if [ "$aggressive_mode" = true ] && [ "$clean_logs" = true ]; then
        force_cleanup "--aggressive" "--clean-logs"
    elif [ "$aggressive_mode" = true ]; then
        force_cleanup "--aggressive"
    elif [ "$clean_logs" = true ]; then
        force_cleanup "--clean-logs"
    else
        force_cleanup
    fi
    
    # 显示最终状态
    echo ""
    show_status
    
    log_success "清理操作完成"
}

# 脚本入口
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
