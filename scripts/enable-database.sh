#!/bin/bash

# 天网安全监控系统 - 数据库启用脚本
# TianWang Security System - Database Enable Script

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

# 检查PostgreSQL服务状态
check_postgres() {
    log_step "检查PostgreSQL服务状态..."
    
    if pg_isready -h localhost -p 5432 >/dev/null 2>&1; then
        log_success "PostgreSQL服务正在运行"
        return 0
    else
        log_error "PostgreSQL服务未运行"
        log_info "请先启动PostgreSQL服务："
        log_info "  macOS: brew services start postgresql"
        log_info "  Linux: sudo systemctl start postgresql"
        return 1
    fi
}

# 修改配置文件
update_config() {
    log_step "更新数据库配置..."
    
    local config_file="dev.local"
    
    if [ ! -f "$config_file" ]; then
        log_error "配置文件 $config_file 不存在"
        return 1
    fi
    
    # 备份原配置文件
    cp "$config_file" "${config_file}.backup.$(date +%Y%m%d_%H%M%S)"
    log_info "已备份原配置文件"
    
    # 修改SKIP_DB配置
    if sed -i.bak 's/^SKIP_DB=true$/SKIP_DB=false/' "$config_file"; then
        log_success "已启用数据库连接 (SKIP_DB=false)"
    else
        log_warning "SKIP_DB配置修改失败，请手动检查"
    fi
    
    # 检查数据库名称配置
    if grep -q "DB_NAME=tianwang_dev" "$config_file"; then
        log_warning "发现数据库名称配置为 tianwang_dev，建议修改为 tianwang"
        log_info "请手动编辑 $config_file 文件，将 DB_NAME 改为 tianwang"
    fi
    
    # 清理临时文件
    rm -f "${config_file}.bak"
}

# 验证数据库连接
test_connection() {
    log_step "验证数据库连接..."
    
    # 测试基本连接
    if psql -h localhost -p 5432 -U tianwang -d postgres -c "SELECT 1;" >/dev/null 2>&1; then
        log_success "PostgreSQL连接成功"
    else
        log_error "PostgreSQL连接失败"
        log_info "请检查以下配置："
        log_info "  - 用户名: tianwang"
        log_info "  - 密码: tianwang123"
        log_info "  - 主机: localhost"
        log_info "  - 端口: 5432"
        return 1
    fi
}

# 检查数据库是否存在
check_database() {
    log_step "检查数据库是否存在..."
    
    local db_name="tianwang"
    
    if psql -h localhost -p 5432 -U tianwang -d postgres -c "SELECT 1 FROM pg_database WHERE datname = '$db_name';" | grep -q "1 row"; then
        log_success "数据库 $db_name 已存在"
        return 0
    else
        log_warning "数据库 $db_name 不存在，需要创建"
        return 1
    fi
}

# 创建数据库
create_database() {
    log_step "创建数据库..."
    
    if cd server && npm run db:init >/dev/null 2>&1; then
        log_success "数据库创建成功"
        cd ..
        return 0
    else
        log_error "数据库创建失败"
        cd ..
        return 1
    fi
}

# 验证表结构
check_tables() {
    log_step "检查数据库表结构..."
    
    local table_count=$(psql -h localhost -p 5432 -U tianwang -d tianwang -c "\dt" 2>/dev/null | grep -c "table" || echo "0")
    
    if [ "$table_count" -gt 0 ]; then
        log_success "数据库表已存在 ($table_count 个表)"
        return 0
    else
        log_warning "数据库表不存在，需要启动服务同步表结构"
        return 1
    fi
}

# 显示下一步操作
show_next_steps() {
    log_step "数据库启用完成！"
    echo ""
    echo "=========================================="
    echo "           下一步操作"
    echo "=========================================="
    echo ""
    echo "1. 启动开发环境："
    echo "   npm run dev"
    echo ""
    echo "2. 验证服务状态："
    echo "   ./scripts/dev-status.sh"
    echo ""
    echo "3. 访问应用："
    echo "   前端: http://localhost:3333"
    echo "   后端API: http://localhost:5555/api"
    echo "   API文档: http://localhost:5555/api-docs"
    echo ""
    echo "4. 如果需要重置数据库："
    echo "   cd server && npm run db:reset"
    echo ""
    echo "5. 查看数据库日志："
    echo "   tail -f server/logs/dev.log | grep -i database"
    echo ""
}

# 主函数
main() {
    echo "=========================================="
    echo "    天网安全监控系统 - 数据库启用"
    echo "    TianWang Security System - DB Enable"
    echo "=========================================="
    echo ""
    
    # 检查PostgreSQL服务
    if ! check_postgres; then
        exit 1
    fi
    
    # 更新配置文件
    if ! update_config; then
        exit 1
    fi
    
    # 测试数据库连接
    if ! test_connection; then
        exit 1
    fi
    
    # 检查数据库是否存在
    if ! check_database; then
        if ! create_database; then
            exit 1
        fi
    fi
    
    # 检查表结构
    check_tables
    
    # 显示下一步操作
    show_next_steps
    
    log_success "数据库启用脚本执行完成！"
}

# 执行主函数
main "$@"
