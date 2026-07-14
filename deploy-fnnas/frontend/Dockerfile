# === 阶段1: 构建 ===
FROM docker.m.daocloud.io/library/node:20-alpine AS builder

ENV NPM_CONFIG_REGISTRY=https://registry.npmmirror.com

WORKDIR /app
COPY frontend/package*.json ./
RUN npm install --ignore-scripts --legacy-peer-deps
COPY frontend/ ./
RUN npm run build

# === 阶段2: Nginx 静态托管 ===
FROM docker.m.daocloud.io/library/nginx:1.27-alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY deploy-fnnas/frontend/nginx/default.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]