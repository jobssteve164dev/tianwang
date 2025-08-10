#!/bin/bash
# 快速构建脚本
# Quick Build Script

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印带颜色的消息
print_message() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# 检查Docker是否运行
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker未运行，请先启动Docker"
        exit 1
    fi
    print_message "Docker运行正常"
}

# 启用BuildKit
enable_buildkit() {
    export DOCKER_BUILDKIT=1
    export COMPOSE_DOCKER_CLI_BUILD=1
    print_message "启用Docker BuildKit"
}

# 清理旧镜像
cleanup_old_images() {
    print_step "清理旧的构建镜像"
    docker image prune -f || true
    docker builder prune -f || true
}

# 构建服务
build_service() {
    local service=$1
    local context=$2
    local dockerfile=$3
    
    print_step "构建 $service 服务"
    
    docker build \
        --target production \
        --cache-from tianwang-$service:latest \
        --build-arg BUILDKIT_INLINE_CACHE=1 \
        -t tianwang-$service:latest \
        -f $dockerfile \
        $context
    
    print_message "$service 构建完成"
}

# 并行构建所有服务
build_all_services() {
    print_step "开始并行构建所有服务"
    
    # 并行构建
    (
        build_service "server" "./server" "./docker/server/Dockerfile" &
        build_service "client" "./client" "./docker/client/Dockerfile" &
        build_service "ai-engine" "./server/ai-engine" "./docker/ai-engine/Dockerfile" &
        wait
    )
    
    print_message "所有服务构建完成"
}

# 显示构建统计
show_build_stats() {
    print_step "构建统计"
    
    echo "镜像列表:"
    docker images | grep tianwang || true
    
    echo ""
    echo "构建缓存使用情况:"
    docker system df || true
}

# 主函数
main() {
    print_message "开始天网系统快速构建"
    
    # 检查环境
    check_docker
    enable_buildkit
    
    # 清理旧镜像
    cleanup_old_images
    
    # 构建服务
    build_all_services
    
    # 显示统计
    show_build_stats
    
    print_message "构建完成！"
    print_message "使用以下命令启动服务:"
    echo "  docker-compose up -d"
    echo "  docker-compose -f docker-compose.monitoring.yml up -d"
}

# 处理命令行参数
case "${1:-}" in
    --help|-h)
        echo "用法: $0 [选项]"
        echo "选项:"
        echo "  --help, -h     显示帮助信息"
        echo "  --clean        清理所有缓存后构建"
        echo "  --no-cache     不使用缓存构建"
        exit 0
        ;;
    --clean)
        print_warning "清理所有缓存"
        docker system prune -a -f
        ;;
    --no-cache)
        print_warning "禁用缓存构建"
        export DOCKER_BUILDKIT=0
        ;;
esac

# 运行主函数
main "$@"
