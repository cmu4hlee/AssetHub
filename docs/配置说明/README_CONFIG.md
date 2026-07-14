# 系统配置说明

## 配置文件位置

系统统一配置文件位于：`backend/config/app.config.js`

## 配置方式

### 方式一：环境变量（推荐）

创建 `.env` 文件（可参考 `.env.example`），设置环境变量：

```bash
# 数据库配置
DB_HOST=101.37.236.101
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=zcgl

# 服务器配置
PORT=4001
SERVER_HOST=0.0.0.0

# 前端配置
FRONTEND_URL=http://localhost:4000

# 外网访问控制
ENABLE_IP_WHITELIST=true
ALLOWED_IPS=192.168.1.100,10.0.0.0/8
ENABLE_DOMAIN_WHITELIST=true
ALLOWED_DOMAINS=example.com,*.example.com
```

### 方式二：直接修改配置文件

直接编辑 `backend/config/app.config.js` 文件，修改默认值。

## 主要配置项说明

### 数据库配置

- `DB_HOST`: 数据库主机地址
- `DB_PORT`: 数据库端口（默认 3306）
- `DB_USER`: 数据库用户名
- `DB_PASSWORD`: 数据库密码
- `DB_NAME`: 数据库名称

### 服务器配置

- `PORT`: 服务器监听端口（默认 4001）
- `SERVER_HOST`: 服务器监听地址（0.0.0.0 表示所有网络接口）

### 外网访问控制

#### IP 白名单

启用 IP 白名单后，只有白名单中的 IP 才能访问系统。

```bash
# 启用 IP 白名单
ENABLE_IP_WHITELIST=true

# 设置允许的 IP（支持 CIDR 格式）
ALLOWED_IPS=192.168.1.100,10.0.0.0/8,172.16.0.0/12
```

#### 域名白名单

启用域名白名单后，只有白名单中的域名才能访问系统。

```bash
# 启用域名白名单
ENABLE_DOMAIN_WHITELIST=true

# 设置允许的域名（支持通配符）
ALLOWED_DOMAINS=example.com,*.example.com,localhost
```

### CORS 配置

控制跨域资源共享：

```bash
# 允许的源（* 表示允许所有源）
CORS_ORIGIN=*

# 是否允许携带凭证
CORS_CREDENTIALS=false
```

### JWT 配置

```bash
# 生产环境必须设置此密钥！
JWT_SECRET=your-secret-key-here

# Token 过期时间（秒，默认 7 天）
JWT_EXPIRES_IN=604800
```

## 部署建议

### 开发环境

使用默认配置或 `.env` 文件，无需启用访问控制。

### 生产环境

1. **必须设置 JWT_SECRET**：使用强随机字符串
2. **启用访问控制**：根据实际需求配置 IP 或域名白名单
3. **使用环境变量**：不要将敏感信息提交到代码仓库
4. **配置 HTTPS**：启用 HTTPS 并配置证书

### 示例：生产环境配置

```bash
NODE_ENV=production

# 数据库（使用环境变量，不要硬编码）
DB_HOST=your-db-host
DB_USER=your-db-user
DB_PASSWORD=your-secure-password
DB_NAME=your-db-name

# 服务器
PORT=4001
SERVER_HOST=0.0.0.0

# 前端
FRONTEND_URL=https://your-domain.com
FRONTEND_DOMAIN=your-domain.com

# 访问控制
ENABLE_IP_WHITELIST=true
ALLOWED_IPS=your-office-ip,10.0.0.0/8

ENABLE_DOMAIN_WHITELIST=true
ALLOWED_DOMAINS=your-domain.com,*.your-domain.com

# JWT（必须设置）
JWT_SECRET=your-very-secure-random-secret-key-here

# HTTPS
HTTPS=true
SSL_CERT=/path/to/cert.pem
SSL_KEY=/path/to/key.pem
```

## 配置验证

启动服务器时，系统会自动验证配置：

```bash
node backend/server.js
```

如果配置有问题，会显示警告信息。

## 注意事项

1. **安全性**：生产环境必须设置强密码和 JWT_SECRET
2. **IP 白名单**：启用后，确保管理员 IP 在白名单中，否则无法访问
3. **域名白名单**：启用后，确保前端域名在白名单中
4. **环境变量优先级**：环境变量会覆盖配置文件中的默认值
5. **不要提交敏感信息**：`.env` 文件应添加到 `.gitignore`
