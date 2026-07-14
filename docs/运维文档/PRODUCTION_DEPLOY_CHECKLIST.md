# AssetHub 生产环境部署路径与域名配置清单

本清单帮助运维人员快速排查和解决生产环境中常见的"路径错误"和"localhost 访问"问题。

## 🚨 常见问题症状

| 症状 | 根本原因 |
|------|---------|
| 飞书卡片点击后跳转到 `http://localhost:13579/...` | 后端未读取 `FRONTEND_URL`，使用默认 localhost |
| 附件下载链接显示 `http://your-domain.com/...` 但客户端使用 `https` | 后端未读取 `X-Forwarded-Proto`，附件 URL 用 `http://` |
| 前端 API 请求失败 `CORS blocked: origin https://your-domain.com` | 后端 `CORS_ORIGIN` 未配置生产域名 |
| API 文档页点击"打开"跳转到 `http://localhost:5183/api-docs` | 前端 `VITE_BACKEND_URL` 指向了 localhost 或构建时未注入环境变量 |
| 飞书 OAuth 回调地址填写的是 `http://localhost:13579/...` | 前端 `FeishuConfigManagement.jsx` 占位符硬编码 |
| Hermes AI Chat 无法连接 | `VITE_HERMES_API_URL` 未配置或指向 localhost |

## ✅ 部署前必做配置

### 1. 后端 `.env` 配置（生产环境）

复制 `backend/.env.production.example` 为 `backend/.env`，**必须修改以下值**：

```bash
# 1. 环境标识
NODE_ENV=production

# 2. 前端域名（关键！所有对外链接、卡片、回调都依赖此项）
FRONTEND_URL=https://assethub.your-domain.com
FRONTEND_DOMAIN=assethub.your-domain.com

# 3. 数据库（必须使用真实凭据）
DB_HOST=mysql.your-domain.com
DB_USER=assethub_prod
DB_PASSWORD=<强密码>

# 4. CORS（必须显式列出生产域名）
CORS_ORIGIN=https://assethub.your-domain.com

# 5. 安全密钥（必须随机生成）
JWT_SECRET=$(openssl rand -hex 32)
IOT_TOKEN_PEPPER=$(openssl rand -hex 32)

# 6. 反向代理配置
TRUST_PROXY=true
TRUST_PROXY_IPS=10.0.0.0/8,192.168.0.0/16
```

### 2. 前端 `.env.production` 配置

复制 `frontend/.env.production.example` 为 `frontend/.env.production`，**必须修改以下值**：

```bash
# 1. 前端域名（用于 OAuth 回调、分享链接）
VITE_FRONTEND_URL=https://assethub.your-domain.com

# 2. 后端 API 地址（同源部署可不设置）
# 同源部署：通过 Nginx 反代，前端和后端在同一域名
# 跨域部署：设置为后端完整 URL
VITE_BACKEND_URL=
VITE_API_BASE_URL=/api

# 3. 备用 host（用于跨域跳转白名单）
VITE_FRONTEND_FALLBACK_HOSTS=assethub.your-domain.com
```

### 3. Nginx 反向代理配置（推荐）

生产环境**强烈推荐**使用 Nginx 反向代理实现前后端同源部署，避免跨域问题：

```nginx
server {
    listen 443 ssl http2;
    server_name assethub.your-domain.com;

    # SSL 证书
    ssl_certificate     /etc/ssl/certs/assethub.crt;
    ssl_certificate_key /etc/ssl/private/assethub.key;

    # 前端静态资源
    root /data/assethub/frontend/dist;
    index index.html;

    # 后端 API 反代
    location /api/ {
        proxy_pass http://127.0.0.1:5183/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_http_version 1.1;
        proxy_read_timeout 600s;
    }

    # Socket.IO 反代
    location /socket.io/ {
        proxy_pass http://127.0.0.1:5183/socket.io/;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
    }

    # 文件上传路径反代
    location /uploads/ {
        proxy_pass http://127.0.0.1:5183/uploads/;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # SPA 路由
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

## 🔍 部署后验证清单

执行以下检查确保没有 localhost 残留：

```bash
# 1. 检查前端构建产物中是否还包含 localhost
grep -r "localhost" frontend/dist/assets/ | head -20

# 2. 检查后端配置是否生效
curl -s http://127.0.0.1:5183/api/health | jq .

# 3. 检查 CORS 是否正确配置
curl -sI -H "Origin: https://assethub.your-domain.com" \
  http://127.0.0.1:5183/api/health | grep -i access-control

# 4. 测试附件 URL（创建一条带附件的维修日志）
# 然后访问 file_url，确认协议是 https:// 域名正确

# 5. 测试飞书消息卡片（创建一条报废/调拨记录，触发卡片）
# 检查卡片按钮链接：应当是 https://assethub.your-domain.com/scrapping 而不是 localhost
```

## ⚠️ 重要警告

1. **绝对不要在生产环境配置文件中使用 `localhost` 或内网 IP**
2. **`JWT_SECRET` 必须是 32+ 字符的强随机密钥**，使用 `openssl rand -hex 32` 生成
3. **`TRUST_PROXY=true` 必须设置**，否则附件 URL 会用 `http://` 而非 `https://`
4. **`CORS_ORIGIN` 必须显式列出生产域名**，不能用通配符 `*`
5. **数据库密码必须使用环境变量注入**，不要硬编码到代码中
6. **必须启用 HTTPS**，否则 JWT、Cookie 等敏感信息会明文传输

## 📞 故障排查

| 现象 | 排查步骤 |
|------|---------|
| API 请求 CORS 失败 | 1. 检查 `CORS_ORIGIN` 是否包含请求来源<br>2. 检查 `FRONTEND_URL` 是否正确<br>3. 检查 Nginx 是否传递了 `Origin` 头 |
| 附件 URL 显示 http | 1. 检查 `TRUST_PROXY=true` 是否设置<br>2. 检查 Nginx 是否传递 `X-Forwarded-Proto: https`<br>3. 设置 `PUBLIC_BASE_URL=https://your-domain.com` |
| 飞书卡片显示 localhost | 1. 检查后端 `FRONTEND_URL` 是否正确<br>2. 重启后端服务使配置生效<br>3. 检查 `feishu-notification.service.js` 是否使用了 `buildPageUrl()` |
| 前端 API 请求 404 | 1. 检查 Nginx `/api/` 路径代理配置<br>2. 检查 `VITE_API_BASE_URL` 是否为 `/api`<br>3. 检查后端是否绑定 `0.0.0.0` |
| Vite preview 拒绝访问 | 1. 设置 `VITE_ALLOWED_HOSTS=true`<br>2. 或显式列出允许的 host |