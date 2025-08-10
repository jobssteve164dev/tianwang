#!/bin/bash

# 天网安全监控系统 - 本地开发环境测试脚本
# TianWang Security System - Local Development Environment Test Script

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

# 测试HTTP端点
test_endpoint() {
    local url=$1
    local service_name=$2
    local timeout=${3:-10}
    
    log_info "测试 $service_name: $url"
    
    if curl -s --max-time $timeout "$url" >/dev/null 2>&1; then
        log_success "$service_name 响应正常"
        return 0
    else
        log_error "$service_name 无响应"
        return 1
    fi
}

# 测试数据库连接
test_database() {
    log_step "测试数据库连接..."
    
    # 测试 PostgreSQL
    if pg_isready -h localhost -p 5432 >/dev/null 2>&1; then
        log_success "PostgreSQL 连接正常"
    else
        log_error "PostgreSQL 连接失败"
        return 1
    fi
    
    # 测试 Redis
    if redis-cli ping >/dev/null 2>&1; then
        log_success "Redis 连接正常"
    else
        log_error "Redis 连接失败"
        return 1
    fi
    
    return 0
}

# 测试应用服务
test_app_services() {
    log_step "测试应用服务..."
    
    local all_passed=true
    
    # 测试服务端健康检查
    if test_endpoint "http://localhost:5555/health" "服务端健康检查" 5; then
        log_success "服务端运行正常"
    else
        log_error "服务端无响应"
        all_passed=false
    fi
    
    # 测试服务端API
    if test_endpoint "http://localhost:5555/api" "服务端API" 5; then
        log_success "服务端API可访问"
    else
        log_warning "服务端API无响应"
    fi
    
    # 测试客户端
    if test_endpoint "http://localhost:3333" "客户端" 10; then
        log_success "客户端运行正常"
    else
        log_error "客户端无响应"
        all_passed=false
    fi
    
    # 测试AI引擎（可选）
    if test_endpoint "http://localhost:8888/health" "AI引擎健康检查" 5; then
        log_success "AI引擎运行正常"
    else
        log_warning "AI引擎无响应（可选服务）"
    fi
    
    if [ "$all_passed" = true ]; then
        return 0
    else
        return 1
    fi
}

# 测试环境变量
test_environment() {
    log_step "测试环境变量配置..."
    
    if [ -f "dev.local" ]; then
        log_success "dev.local 文件存在"
        
        # 检查关键环境变量
        local required_vars=(
            "DB_HOST"
            "DB_PORT"
            "DB_NAME"
            "REDIS_HOST"
            "REDIS_PORT"
            "JWT_SECRET"
        )
        
        local missing_vars=()
        
        for var in "${required_vars[@]}"; do
            if ! grep -q "^${var}=" dev.local; then
                missing_vars+=("$var")
            fi
        done
        
        if [ ${#missing_vars[@]} -eq 0 ]; then
            log_success "所有必需的环境变量都已配置"
        else
            log_warning "缺少环境变量: ${missing_vars[*]}"
        fi
    else
        log_error "dev.local 文件不存在"
        return 1
    fi
    
    return 0
}

# 测试文件结构
test_file_structure() {
    log_step "测试文件结构..."
    
    local required_dirs=(
        "server/src"
        "server/logs"
        "client/src"
        "server/ai-engine/src"
    )
    
    local missing_dirs=()
    
    for dir in "${required_dirs[@]}"; do
        if [ ! -d "$dir" ]; then
            missing_dirs+=("$dir")
        fi
    done
    
    if [ ${#missing_dirs[@]} -eq 0 ]; then
        log_success "项目文件结构完整"
    else
        log_warning "缺少目录: ${missing_dirs[*]}"
    fi
    
    return 0
}

# 显示测试结果摘要
show_test_summary() {
    echo ""
    echo "=========================================="
    echo "           测试结果摘要"
    echo "=========================================="
    
    if [ "$1" = true ]; then
        echo -e "${GREEN}✓ 所有测试通过${NC}"
        echo -e "开发环境运行正常"
        echo ""
        echo -e "访问地址："
        echo -e "  ${CYAN}客户端:     http://localhost:3333${NC}"
        echo -e "  ${CYAN}服务端API:  http://localhost:5555/api${NC}"
        echo -e "  ${CYAN}API文档:    http://localhost:5555/api-docs${NC}"
        echo -e "  ${CYAN}AI引擎:     http://localhost:8888${NC}"
    else
        echo -e "${RED}✗ 部分测试失败${NC}"
        echo -e "请检查上述错误信息并修复问题"
        echo ""
        echo -e "建议操作："
        echo -e "  1. 运行 ${CYAN}./scripts/dev-status.sh${NC} 查看服务状态"
        echo -e "  2. 运行 ${CYAN}./scripts/dev-cleanup.sh${NC} 清理环境"
        echo -e "  3. 重新启动开发环境"
    fi
    
    echo ""
}

# 主函数
main() {
    echo -e "${CYAN}"
    echo "=========================================="
    echo "    天网安全监控系统 - 开发环境测试"
    echo "    TianWang Security System - Dev Test"
    echo "=========================================="
    echo -e "${NC}"
    
    local all_tests_passed=true
    
    # 测试环境变量
    if ! test_environment; then
        all_tests_passed=false
    fi
    
    # 测试文件结构
    if ! test_file_structure; then
        all_tests_passed=false
    fi
    
    # 测试数据库连接
    if ! test_database; then
        all_tests_passed=false
    fi
    
    # 测试应用服务
    if ! test_app_services; then
        all_tests_passed=false
    fi
    
    # 显示测试结果
    show_test_summary $all_tests_passed
    
    if [ "$all_tests_passed" = true ]; then
        exit 0
    else
        exit 1
    fi
}

# 脚本入口
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
