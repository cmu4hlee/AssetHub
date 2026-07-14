# AssetHub Backend Docker Image (Fast Build)
FROM public.ecr.aws/docker/library/node:20-alpine

ENV NODE_ENV=production \
    PUPPETEER_SKIP_DOWNLOAD=true \
    HUSKY=0 \
    NPM_CONFIG_REGISTRY=https://registry.npmmirror.com \
    NODE_OPTIONS=--max-old-space-size=384

WORKDIR /app

# 运行时必需的 alpine 库
RUN apk add --no-cache \
    cairo \
    pango \
    libjpeg-turbo \
    giflib \
    librsvg \
    ca-certificates

# 复制后端代码
COPY backend/ ./

# 如果没有 node_modules，临时安装生产依赖
# 使用 --fetch-retries 增强网络重试，避免单包下载失败导致整个安装失败
RUN if [ ! -d node_modules ] || [ ! -f node_modules/.package-lock.json ]; then \
      npm install --omit=dev --ignore-scripts --legacy-peer-deps \
        --fetch-retries=5 --fetch-retry-mintimeout=10000 --fetch-retry-maxtimeout=60000; \
    fi

# 复制入口脚本
COPY deploy-local/backend/docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

# 复制初始化 SQL
COPY deploy-local/env/init-schema.sql /app/config/init-schema.sql
COPY deploy-local/env/init-seed-data.sql /app/config/init-seed-data.sql
COPY env/seed-demo-assets.sql /app/config/seed-demo-assets.sql

RUN mkdir -p uploads backups logs

EXPOSE 5183

ENTRYPOINT ["/app/docker-entrypoint.sh"]