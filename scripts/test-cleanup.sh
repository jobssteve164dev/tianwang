#!/bin/bash

# 天网安全监控系统 - 清理功能测试脚本
# TianWang Security System - Cleanup Function Test Script

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

# 测试清理功能
test_cleanup() {
    log_step "开始测试清理功能..."
    
    echo -e "${CYAN}"
    echo "=========================================="
    echo "    清理功能测试"
    echo "=========================================="
    echo -e "${NC}"
    
    # 切换到项目根目录
    cd "$(dirname "$0")/.."
    
    # 1. 测试状态查看功能
    log_step "测试状态查看功能..."
    ./scripts/dev-cleanup.sh --status
    
    # 2. 测试标准清理功能
    log_step "测试标准清理功能..."
    ./scripts/dev-cleanup.sh
    
    # 3. 测试激进清理功能（需要用户确认）
    log_step "测试激进清理功能..."
    echo "注意：这将提示用户确认，请手动确认"
    ./scripts/dev-cleanup.sh --aggressive
    
    # 4. 测试日志清理功能
    log_step "测试日志清理功能..."
    ./scripts/dev-cleanup.sh --clean-logs
    
    log_success "清理功能测试完成"
}

# 模拟进程创建测试
simulate_processes() {
    log_step "模拟创建测试进程..."
    
    # 创建一些模拟的PID文件
    echo "99999" > .test-pid-1.pid
    echo "99998" > .test-pid-2.pid
    
    # 启动一些后台进程来模拟项目进程
    sleep 1000 &
    SLEEP_PID_1=$!
    echo $SLEEP_PID_1 > .test-sleep-1.pid
    
    sleep 1000 &
    SLEEP_PID_2=$!
    echo $SLEEP_PID_2 > .test-sleep-2.pid
    
    log_info "创建了测试进程: $SLEEP_PID_1, $SLEEP_PID_2"
    log_info "创建了测试PID文件: .test-pid-1.pid, .test-pid-2.pid"
}

# 清理测试进程
cleanup_test_processes() {
    log_step "清理测试进程..."
    
    # 清理测试PID文件
    rm -f .test-pid-*.pid
    rm -f .test-sleep-*.pid
    
    # 清理测试进程
    local test_pids=$(pgrep -f "sleep 1000" 2>/dev/null || true)
    if [ -n "$test_pids" ]; then
        for pid in $test_pids; do
            kill $pid 2>/dev/null || true
        done
    fi
    
    log_success "测试进程清理完成"
}

# 主函数
main() {
    echo -e "${CYAN}"
    echo "=========================================="
    echo "    天网安全监控系统 - 清理功能测试"
    echo "    TianWang Security System - Cleanup Test"
    echo "=========================================="
    echo -e "${NC}"
    
    # 检查命令行参数
    while [[ $# -gt 0 ]]; do
        case $1 in
            --simulate|-s)
                simulate_processes
                exit 0
                ;;
            --cleanup-test|-c)
                cleanup_test_processes
                exit 0
                ;;
            --help|-h)
                echo "用法: $0 [选项]"
                echo "选项:"
                echo "  -s, --simulate      模拟创建测试进程"
                echo "  -c, --cleanup-test  清理测试进程"
                echo "  -h, --help          显示此帮助信息"
                echo ""
                echo "示例:"
                echo "  $0                  # 运行完整测试"
                echo "  $0 --simulate       # 创建测试进程"
                echo "  $0 --cleanup-test   # 清理测试进程"
                exit 0
                ;;
            *)
                log_error "未知参数: $1"
                echo "使用 --help 查看帮助信息"
                exit 1
                ;;
        esac
    done
    
    # 运行完整测试
    test_cleanup
}

# 脚本入口
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
