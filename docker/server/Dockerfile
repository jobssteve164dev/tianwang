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

# 安装依赖（仅安装生产依赖，利用缓存）
RUN npm ci --only=production --cache /tmp/npm-cache && \
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

# 安装所有依赖（包括开发依赖）
RUN npm ci --cache /tmp/npm-cache && \
    npm cache clean --force

# 复制源代码（分层复制，优化缓存）
COPY src/ ./src/
COPY config/ ./config/
COPY scripts/ ./scripts/
COPY tests/ ./tests/

# 运行测试和构建（可选）
RUN npm test --if-present

# 生产阶段
FROM node:18-alpine AS production

# 安装必要的系统包
RUN apk add --no-cache dumb-init

# 创建非root用户
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# 设置工作目录
WORKDIR /app

# 从依赖阶段复制node_modules
COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules

# 从构建阶段复制源代码
COPY --from=builder --chown=nodejs:nodejs /app/src ./src
COPY --from=builder --chown=nodejs:nodejs /app/config ./config
COPY --from=builder --chown=nodejs:nodejs /app/package*.json ./

# 创建必要的目录
RUN mkdir -p /app/logs /app/uploads && \
    chown -R nodejs:nodejs /app/logs /app/uploads

# 切换到非root用户
USER nodejs

# 暴露端口
EXPOSE 8000

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=8000

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8000/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# 使用dumb-init启动
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/index.js"]
