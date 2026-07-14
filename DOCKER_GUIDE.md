# AssetHub Docker 部署指南

## 快速开始

### 1. 构建镜像

```bash
# 完整构建（不缓存）
npm run docker:build

# 仅构建后端
npm run docker:build:backend

# 仅构建前端
npm run docker:build:frontend

# 边构建边启动
npm run docker:up:build
```

### 2. 启动服务

```bash
# 启动所有服务
npm run docker:up

# 查看状态
npm run docker:status
```

### 3. 查看日志

```bash
# 查看所有日志
npm run docker:logs

# 仅查看后端日志
npm run docker:logs:backend

# 仅查看前端日志
npm run docker:logs:frontend
```

### 4. 重启服务

```bash
# 重启所有服务
npm run docker:restart

# 完全重建（停止、构建、启动）
npm run docker:rebuild
```

### 5. 停止服务

```bash
# 停止所有服务
npm run docker:down

# 清理数据和镜像
npm run docker:clean
```

## 访问地址

- **前端**: http://localhost:25379
- **后端 API**: http://localhost:25183/api
- **健康检查**: http://localhost:25183/api/health

## 环境配置

后端配置通过 `backend/.env` 文件管理，Docker 容器会自动加载。

主要配置项：
- `DB_HOST`: 数据库地址（Docker 中使用 `host.docker.internal`）
- `DB_PORT`: 数据库端口
- `DB_USER`: 数据库用户名
- `DB_PASSWORD`: 数据库密码
- `DB_NAME`: 数据库名称

## 性能优化特性

### 1. 多阶段构建
前端使用 Node.js 构建镜像进行编译，Nginx 镜像运行最终产品，减少镜像体积。

### 2. 资源限制
- 后端：CPU 2核，内存 2GB
- 前端：CPU 1核，内存 1GB

### 3. Gzip 压缩
- 构建时预压缩静态资源
- Nginx 运行时动态压缩
- 支持 Brotli 压缩（需要额外配置）

### 4. 缓存策略
- 静态资源：1年缓存
- API 响应：不缓存
- HTML 文件：不缓存（支持 SPA 路由）

### 5. 安全头
- X-Frame-Options
- X-Content-Type-Options
- X-XSS-Protection

## 健康检查

后端容器配置了健康检查：
- 检查间隔：30秒
- 超时时间：10秒
- 重试次数：3次
- 启动延迟：40秒

## 日志管理

日志存储在 Docker Volume 中：
- `backend-uploads`: 上传文件
- `backend-backups`: 备份文件
- `backend-logs`: 日志文件

查看日志：
```bash
# 进入容器
docker exec -it assetrob-backend sh

# 查看日志文件
ls -la /app/logs/
```

## 故障排查

### 1. 容器启动失败

```bash
# 查看详细日志
docker-compose logs backend

# 检查容器状态
docker ps -a | grep assetrob
```

### 2. 数据库连接失败

确保数据库服务正在运行，并且 `backend/.env` 中的 `DB_HOST` 配置正确。

### 3. 前端无法访问后端

```bash
# 检查网络连接
docker network inspect assethub_assetrob

# 检查 DNS 解析
docker exec assetrob-frontend nslookup assetrob-backend
```

### 4. 重新初始化

```bash
# 停止并删除容器
docker-compose down

# 删除数据卷（谨慎使用）
docker volume rm assethub_backend-uploads assethub_backend-backups assethub_backend-logs

# 重新构建和启动
npm run docker:up:build
```

## 生产环境部署

### 1. 使用生产配置文件

创建 `docker-compose.prod.yml`：
```yaml
services:
  backend:
    environment:
      NODE_ENV: production
      # 其他生产环境变量
    restart: always
```

启动：
```bash
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### 2. 使用外部数据库

修改 `docker-compose.yml` 中的 `DB_HOST` 为实际数据库地址。

### 3. 负载均衡

可以使用 Nginx 作为反向代理，将流量分发到多个容器实例。

## 备份和恢复

### 备份数据

```bash
# 备份上传文件
docker cp assetrob-backend:/app/uploads ./backup-uploads

# 备份数据库（需要进入容器）
docker exec assetrob-backend mysqldump -u root -p zcgl > backup.sql
```

### 恢复数据

```bash
# 恢复上传文件
docker cp ./backup-uploads assetrob-backend:/app/uploads

# 恢复数据库
docker exec -i assetrob-backend mysql -u root -p zcgl < backup.sql
```

## 监控

### 容器资源使用

```bash
docker stats
```

### 查看资源限制

```bash
docker inspect assetrob-backend | grep -A 20 "Resources"
```

## 常见问题

**Q: 如何查看容器内部？**
```bash
docker exec -it assetrob-backend sh
```

**Q: 如何修改配置后生效？**
```bash
npm run docker:up:build
```

**Q: 如何查看环境变量？**
```bash
docker exec assetrob-backend env | grep -E "NODE|DB|PORT"
```
