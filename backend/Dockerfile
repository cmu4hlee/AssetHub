FROM node:20-alpine

ENV NODE_ENV=production \
    PUPPETEER_SKIP_DOWNLOAD=true \
    NPM_CONFIG_REGISTRY=https://registry.npmmirror.com

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
    ca-certificates \
    tzdata

COPY package.json package-lock.json* ./
RUN npm config set registry $NPM_CONFIG_REGISTRY && \
    npm ci --only=production --legacy-peer-deps

COPY . .

RUN mkdir -p uploads backups logs && \
    chown -R node:node /app

USER node

EXPOSE 5183

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://127.0.0.1:5183/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "server.js"]
