# AssetHub Docker 部署故障排查指南

## 快速检查清单

### 1. 确认服务状态

```bash
# 查看所有容器状态
npm run docker:status

# 查看实时日志
npm run docker:logs:backend
npm run docker:logs:frontend
```

### 2. 确认网络连通性

```bash
# 测试后端健康检查
curl http://localhost:25183/api/health

# 预期输出：
# {"success":true,"status":"healthy","checks":{"database":"ok"}}
```

### 3. 确认数据库连接

```bash
# 进入后端容器
docker exec -it assetrob-backend sh

# 测试数据库连接
node -e "
const mysql = require('mysql2/promise');
mysql.createConnection({
  host: '192.168.1.111',
  user: 'root',
  password: 'Cmu19801008',
  database: 'zcgl'
}).then(conn => {
  console.log('✅ 数据库连接成功');
  return conn.execute('SELECT COUNT(*) as cnt FROM assets');
}).then(([rows]) => {
  console.log('资产数量:', rows[0].cnt);
}).catch(err => {
  console.error('❌ 数据库连接失败:', err.message);
});
"
```

## 常见问题及解决方案

### ❌ 问题：查询数据显示"拒绝访问"

#### 可能原因 1：用户未登录

**症状**：
- API 返回：`{"success":false,"message":"需要有效的认证令牌"}`
- 前端显示"未授权"或"登录"提示

**解决方案**：
1. 在浏览器中访问 http://localhost:25379
2. 点击"登录"按钮
3. 输入用户名和密码
4. 登录后再尝试查询数据

#### 可能原因 2：跨域请求被阻止

**症状**：
- 浏览器控制台显示 CORS 错误
- 请求被阻止

**解决方案**：
1. 检查浏览器控制台（F12）
2. 确认 CORS 配置正确
3. 添加正确的 Origin 到 `backend/.env`：
   ```
   CORS_ORIGIN=http://localhost:25379,http://localhost:13579
   ```

#### 可能原因 3：IP 白名单限制

**症状**：
- 日志显示 IP 被拒绝
- 返回 403 Forbidden

**解决方案**：
1. 检查 `backend/.env` 配置：
   ```env
   ENABLE_IP_WHITELIST=false
   ALLOWED_IPS=127.0.0.1,::1,192.168.1.0/24
   ```

### ❌ 问题：数据库连接失败

#### 可能原因 1：数据库地址错误

**检查**：
```bash
# 查看容器环境变量
docker exec assetrob-backend env | grep DB_
```

**解决方案**：
修改 `backend/.env`：
```env
DB_HOST=192.168.1.111
DB_PORT=3306
DB_USER=root
DB_PASSWORD=Cmu19801008
DB_NAME=zcgl
```

#### 可能原因 2：数据库权限不足

**检查**：
```bash
docker exec assetrob-backend node -e "
const mysql = require('mysql2/promise');
mysql.createConnection({
  host: '192.168.1.111',
  user: 'root',
  password: 'Cmu19801008'
}).then(conn => {
  return conn.execute('SHOW GRANTS FOR CURRENT_USER()');
}).then(([rows]) => {
  console.log(JSON.stringify(rows, null, 2));
}).catch(console.error);
"
```

**解决方案**：
在数据库服务器上执行：
```sql
GRANT ALL PRIVILEGES ON zcgl.* TO 'root'@'%' IDENTIFIED BY 'Cmu19801008';
FLUSH PRIVILEGES;
```

#### 可能原因 3：防火墙阻止连接

**检查**：
```bash
# 从容器内测试数据库端口
docker exec assetrob-backend sh -c 'echo > /dev/tcp/192.168.1.111/3306' && echo "端口开放" || echo "端口被阻止"
```

**解决方案**：
1. 在数据库服务器上开放 3306 端口
2. 或使用 VPN/内网连接
3. 或配置 SSH 隧道

### ❌ 问题：前端无法访问后端

#### 可能原因 1：Docker 网络问题

**检查**：
```bash
# 查看网络配置
docker network inspect assethub_assetrob

# 测试容器间通信
docker exec assetrob-frontend ping -c 2 assetrob-backend
```

**解决方案**：
```bash
# 重启服务
npm run docker:restart

# 或完全重建
npm run docker:rebuild
```

#### 可能原因 2：Nginx 配置错误

**检查**：
```bash
# 查看 Nginx 配置
docker exec assetrob-frontend cat /etc/nginx/conf.d/default.conf
```

**解决方案**：
确保 `proxy_pass` 指向正确地址：
```nginx
location /api/ {
    proxy_pass http://assetrob-backend:5183/api/;
}
```

### ❌ 问题：容器启动失败

#### 可能原因：端口被占用

**检查**：
```bash
lsof -i :25183
lsof -i :25379
```

**解决方案**：
1. 停止占用端口的进程：
   ```bash
   kill $(lsof -t -i :25183)
   ```
2. 或修改 `docker-compose.yml` 中的端口映射

#### 可能原因：Docker 资源不足

**检查**：
```bash
docker stats
```

**解决方案**：
1. 分配更多资源给 Docker Desktop
2. 清理未使用的容器和镜像：
   ```bash
   docker system prune -a
   ```

## 调试技巧

### 1. 查看详细日志

```bash
# 后端完整日志
docker-compose logs -f backend --tail=1000

# 实时请求日志
docker-compose logs -f backend | grep -E "GET|POST|PUT|DELETE"

# 错误日志
docker-compose logs -f backend | grep -i error
```

### 2. 进入容器调试

```bash
# 后端容器
docker exec -it assetrob-backend sh

# 前端容器
docker exec -it assetrob-frontend sh

# 查看进程
ps aux

# 查看网络连接
netstat -tlnp

# 测试 API
curl -v http://localhost:5183/api/health
```

### 3. 数据库直接查询

```bash
docker exec -it assetrob-backend sh
node -e "
const mysql = require('mysql2/promise');
const conn = await mysql.createConnection({
  host: '192.168.1.111',
  user: 'root',
  password: 'Cmu19801008',
  database: 'zcgl'
});

// 测试查询
const [rows] = await conn.execute('SELECT * FROM assets LIMIT 5');
console.log('样本数据:', rows);

await conn.end();
"
```

### 4. 测试认证流程

```bash
# 1. 获取 token（根据实际登录接口）
curl -X POST http://localhost:25183/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password"}'

# 2. 使用 token 访问受保护的 API
curl http://localhost:25183/api/assets \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## 环境配置检查

### backend/.env 必需配置

```env
# 数据库配置（必须正确）
DB_HOST=192.168.1.111
DB_PORT=3306
DB_USER=root
DB_PASSWORD=Cmu19801008
DB_NAME=zcgl

# 服务器配置
PORT=5183
NODE_ENV=production

# CORS 配置（允许前端访问）
CORS_ORIGIN=http://localhost:25379,http://localhost:13579
```

### docker-compose.yml 检查

```yaml
services:
  backend:
    env_file:
      - ./backend/.env  # 确保引用正确的 .env 文件
    environment:
      NODE_ENV: production
```

## 性能监控

### 查看资源使用

```bash
# 实时资源监控
docker stats

# 查看容器详细信息
docker inspect assetrob-backend | grep -A 10 "HostConfig"
```

### 查看数据库性能

```sql
-- 在数据库服务器上执行
SHOW PROCESSLIST;
SHOW STATUS LIKE 'Threads_connected';
SHOW VARIABLES LIKE 'max_connections';
```

## 紧急恢复

### 完全重建

```bash
# 1. 停止所有服务
npm run docker:down

# 2. 删除数据卷（谨慎！）
docker volume rm assethub_backend-uploads assethub_backend-backups assethub_backend-logs

# 3. 重新构建和启动
npm run docker:up:build
```

### 使用开发模式替代

如果 Docker 有问题，可以临时使用开发模式：

```bash
# 在项目根目录
npm run dev

# 访问
# 前端：http://localhost:13579
# 后端：http://localhost:5183
```

## 获取帮助

如果问题仍然存在，请提供以下信息：

1. `docker-compose ps` 输出
2. `docker-compose logs backend` 最近 50 行
3. `docker exec assetrob-backend env | grep DB_` 输出
4. 浏览器控制台错误信息
5. 尝试访问的具体 URL

---

**文档版本**: 1.0.0
**最后更新**: 2026-05-14
