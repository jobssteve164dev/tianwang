# 多阶段构建 - 依赖缓存阶段
FROM node:18-alpine AS deps

# 设置工作目录
WORKDIR /app

# 复制package文件（利用Docker层缓存）
COPY package*.json ./

# 配置npm缓存和镜像源
RUN npm config set registry https://registry.npmmirror.com/ && \
    npm config set cache /tmp/npm-cache && \
    npm config set prefer-offline true

# 安装依赖（利用缓存）
RUN npm ci --cache /tmp/npm-cache && \
    npm cache clean --force

# 构建阶段
FROM node:18-alpine AS builder

# 设置工作目录
WORKDIR /app

# 复制package文件
COPY package*.json ./

# 配置npm缓存和镜像源
RUN npm config set registry https://registry.npmmirror.com/ && \
    npm config set cache /tmp/npm-cache && \
    npm config set prefer-offline true

# 安装依赖（利用缓存）
RUN npm ci --cache /tmp/npm-cache && \
    npm cache clean --force

# 复制源代码（分层复制，优化缓存）
COPY public/ ./public/
COPY src/ ./src/
COPY tsconfig.json ./
COPY .env* ./

# 设置构建环境变量
ENV CI=true
ENV NODE_ENV=production

# 构建应用（使用缓存）
RUN npm run build

# 生产阶段 - 使用nginx
FROM nginx:alpine AS production

# 安装必要的工具
RUN apk add --no-cache curl

# 复制构建产物
COPY --from=builder /app/build /usr/share/nginx/html

# 复制nginx配置
COPY nginx.conf /etc/nginx/nginx.conf

# 创建非root用户
RUN addgroup -g 1001 -S nginx && \
    adduser -S nginx -u 1001

# 设置权限
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    chown -R nginx:nginx /etc/nginx/conf.d

# 切换到非root用户
USER nginx

# 暴露端口
EXPOSE 80

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:80/ || exit 1

# 启动nginx
CMD ["nginx", "-g", "daemon off;"]
