# === 阶段1: 依赖安装 ===
FROM docker.m.daocloud.io/library/node:20-alpine AS deps

ENV NPM_CONFIG_REGISTRY=https://registry.npmmirror.com

WORKDIR /app

# 先复制 package.json，利用 Docker 层缓存
COPY frontend/package.json ./

# 安装所有依赖（包括 devDependencies，构建需要 vite 等）
ENV NODE_ENV=development
RUN npm install --legacy-peer-deps && npm install react-is terser

# === 阶段2: 构建 ===
FROM docker.m.daocloud.io/library/node:20-alpine AS build

ARG VITE_API_BASE_URL=/api
ARG VITE_BACKEND_URL=

ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_BACKEND_URL=$VITE_BACKEND_URL
ENV NPM_CONFIG_REGISTRY=https://registry.npmmirror.com

WORKDIR /app

# 从依赖阶段复制 node_modules
COPY --from=deps /app/node_modules ./node_modules

# 复制源码
COPY frontend/ ./

# 写入 Docker 环境的 .env.production
RUN echo "VITE_API_BASE_URL=/api" > .env.production && \
    echo "VITE_ALLOWED_HOSTS=*" >> .env.production && \
    echo "VITE_BIND_HOST=::" >> .env.production && \
    echo "VITE_FRONTEND_PORT=80" >> .env.production && \
    echo "VITE_AI_BASE_URL=/api/ai" >> .env.production && \
    echo "VITE_AI_MODEL=openclaw" >> .env.production && \
    echo "VITE_AI_CHAT_COMPLETIONS_PATH=/ai/chat/completions" >> .env.production

ENV NODE_ENV=production
RUN npm run build

# === 阶段3: 运行时 ===
FROM docker.m.daocloud.io/library/nginx:1.27-alpine

RUN apk add --no-cache gzip

COPY frontend/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

RUN find /usr/share/nginx/html -type f \( -name "*.js" -o -name "*.css" -o -name "*.html" -o -name "*.svg" \) -exec gzip -k {} \; || true

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
