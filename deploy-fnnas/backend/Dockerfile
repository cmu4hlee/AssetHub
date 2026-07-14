# === 阶段1: 构建 - 安装编译依赖和 npm 包 ===
FROM docker.m.daocloud.io/library/node:20-alpine AS builder

ENV PUPPETEER_SKIP_DOWNLOAD=true \
    NPM_CONFIG_REGISTRY=https://registry.npmmirror.com \
    HUSKY=0

WORKDIR /app

RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    cairo-dev \
    pango-dev \
    jpeg-dev \
    giflib-dev \
    librsvg-dev \
    pkgconfig \
    ca-certificates

# 先复制源码（.dockerignore 排除了 node_modules）
COPY backend/ ./
RUN rm -rf node_modules

# 在容器内安装依赖
RUN npm config set registry $NPM_CONFIG_REGISTRY && \
    npm install --ignore-scripts --legacy-peer-deps

# === 阶段2: 运行时 - 仅包含运行所需的最小依赖 ===
FROM docker.m.daocloud.io/library/node:20-alpine

ENV NODE_ENV=production \
    PUPPETEER_SKIP_DOWNLOAD=true \
    HUSKY=0 \
    NODE_OPTIONS=--max-old-space-size=384

WORKDIR /app

# 仅安装运行时所需的系统库（不含 -dev 包和编译工具）
RUN apk add --no-cache \
    cairo \
    pango \
    libjpeg-turbo \
    giflib \
    librsvg \
    ca-certificates

# 从构建阶段复制应用代码和 node_modules
COPY --from=builder /app ./

# 复制 Docker 入口脚本
COPY deploy-fnnas/backend/docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

# 复制数据库初始化文件
COPY deploy-fnnas/env/init-schema.sql /app/config/init-schema.sql
COPY deploy-fnnas/env/init-seed-data.sql /app/config/init-seed-data.sql

RUN mkdir -p uploads backups logs

EXPOSE 5183

ENTRYPOINT ["/app/docker-entrypoint.sh"]