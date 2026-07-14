# AssetTube 远程服务器部署指南

## 方案一：通过镜像文件部署（推荐离线环境）

### 在开发/构建服务器上操作

```bash
# 1. 构建镜像
./docker-build.sh v1.0.0

# 2. 导出镜像到文件
./docker-export.sh v1.0.0 ./docker-images

# 3. 查看导出文件
ls -lh docker-images/
# 输出示例:
# assettube-backend-v1.0.0.tar.gz   (约 500MB)
# assettube-frontend-v1.0.0.tar.gz  (约 50MB)
# deploy.sh
# docker-compose.prod.yml
# .env.example
```

### 传输到目标服务器

```bash
# 方式 1: 使用 scp
scp -r docker-images root@目标服务器IP:/opt/

# 方式 2: 使用 rsync（支持断点续传）
rsync -avz --progress docker-images/ root@目标服务器IP:/opt/assettube/

# 方式 3: 打包后传输
tar czvf assettube-deploy.tar.gz docker-images/
scp assettube-deploy.tar.gz root@目标服务器IP:/opt/
ssh root@目标服务器IP "cd /opt && tar xzvf assettube-deploy.tar.gz"
```

### 在目标服务器上部署

```bash
# 1. 进入目录
cd /opt/docker-images

# 2. 运行部署脚本（推荐）
./deploy.sh v1.0.0

# 或者手动部署
# 2.1 加载镜像
gunzip -c assettube-backend-v1.0.0.tar.gz | docker load
gunzip -c assettube-frontend-v1.0.0.tar.gz | docker load

# 2.2 配置环境变量
cp .env.example .env
vi .env

# 2.3 启动服务
docker-compose -f docker-compose.prod.yml up -d
```

---

## 方案二：通过 Docker Hub 部署（推荐在线环境）

### 1. 推送镜像到 Docker Hub

```bash
# 登录 Docker Hub
docker login

# 标记镜像（替换 yourusername 为你的 Docker Hub 用户名）
docker tag assettube/backend:v1.0.0 yourusername/assettube-backend:v1.0.0
docker tag assettube/frontend:v1.0.0 yourusername/assettube-frontend:v1.0.0

# 推送镜像
docker push yourusername/assettube-backend:v1.0.0
docker push yourusername/assettube-frontend:v1.0.0
```

### 2. 在目标服务器上部署

```bash
# 登录 Docker Hub
docker login

# 拉取镜像
docker pull yourusername/assettube-backend:v1.0.0
docker pull yourusername/assettube-frontend:v1.0.0

# 标记为本地镜像
docker tag yourusername/assettube-backend:v1.0.0 assettube/backend:v1.0.0
docker tag yourusername/assettube-frontend:v1.0.0 assettube/frontend:v1.0.0

# 创建 docker-compose.yml
cat > docker-compose.yml << 'EOF'
version: '3.8'
services:
  mysql:
    image: mysql:8.0
    container_name: assettube-mysql
    environment:
      MYSQL_ROOT_PASSWORD: ${DB_PASSWORD}
      MYSQL_DATABASE: ${DB_NAME:-zcgl}
    volumes:
      - mysql_data:/var/lib/mysql
    ports:
      - '3306:3306'
    restart: always
  redis:
    image: redis:7-alpine
    container_name: assettube-redis
    volumes:
      - redis_data:/data
    ports:
      - '6379:6379'
    restart: always
  backend:
    image: assettube/backend:v1.0.0
    container_name: assettube-backend
    env_file: .env
    depends_on:
      - mysql
      - redis
    ports:
      - '5183:5183'
    restart: always
  frontend:
    image: assettube/frontend:v1.0.0
    container_name: assettube-frontend
    depends_on:
      - backend
    ports:
      - '80:80'
    restart: always
volumes:
  mysql_data:
  redis_data:
EOF

# 配置环境变量
cat > .env << 'EOF'
DB_PASSWORD=your_secure_password
DB_NAME=zcgl
JWT_SECRET=your_jwt_secret_min_32_chars
FRONTEND_URL=http://your-server-ip
EOF

# 启动服务
docker-compose up -d
```

---

## 方案三：使用私有镜像仓库

### 1. 搭建私有仓库（可选）

```bash
# 在任意服务器上启动私有仓库
docker run -d -p 5000:5000 --name registry registry:2
```

### 2. 推送镜像到私有仓库

```bash
# 标记镜像（假设私有仓库地址为 192.168.1.100:5000）
docker tag assettube/backend:v1.0.0 192.168.1.100:5000/assettube-backend:v1.0.0
docker tag assettube/frontend:v1.0.0 192.168.1.100:5000/assettube-frontend:v1.0.0

# 推送
docker push 192.168.1.100:5000/assettube-backend:v1.0.0
docker push 192.168.1.100:5000/assettube-frontend:v1.0.0
```

### 3. 目标服务器配置

```bash
# 配置 Docker 允许非 HTTPS 仓库（如果是内网）
# 编辑 /etc/docker/daemon.json
{
  "insecure-registries": ["192.168.1.100:5000"]
}

# 重启 Docker
systemctl restart docker

# 拉取并部署
docker pull 192.168.1.100:5000/assettube-backend:v1.0.0
docker pull 192.168.1.100:5000/assettube-frontend:v1.0.0
```

---

## 方案四：CI/CD 自动部署

### GitHub Actions 示例

创建 `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Server

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    
    - name: Build Images
      run: |
        docker build -t assettube/backend:${{ github.sha }} ./backend
        docker build -t assettube/frontend:${{ github.sha }} ./frontend
    
    - name: Save Images
      run: |
        docker save assettube/backend:${{ github.sha }} | gzip > backend.tar.gz
        docker save assettube/frontend:${{ github.sha }} | gzip > frontend.tar.gz
    
    - name: Deploy to Server
      uses: appleboy/scp-action@master
      with:
        host: ${{ secrets.SERVER_HOST }}
        username: ${{ secrets.SERVER_USER }}
        password: ${{ secrets.SERVER_PASSWORD }}
        source: "backend.tar.gz,frontend.tar.gz,docker-compose.prod.yml,.env.docker"
        target: "/opt/assettube"
    
    - name: Start Services
      uses: appleboy/ssh-action@master
      with:
        host: ${{ secrets.SERVER_HOST }}
        username: ${{ secrets.SERVER_USER }}
        password: ${{ secrets.SERVER_PASSWORD }}
        script: |
          cd /opt/assettube
          gunzip -c backend.tar.gz | docker load
          gunzip -c frontend.tar.gz | docker load
          docker-compose -f docker-compose.prod.yml up -d
```

---

## 常用管理命令

```bash
# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f backend
docker-compose logs -f frontend

# 重启服务
docker-compose restart backend

# 停止所有服务
docker-compose down

# 停止并删除数据（谨慎使用）
docker-compose down -v

# 更新部署（拉取新镜像后）
docker-compose pull
docker-compose up -d

# 进入容器调试
docker exec -it assettube-backend /bin/sh
docker exec -it assettube-mysql mysql -u root -p
```

---

## 故障排查

### 1. 服务启动失败

```bash
# 查看详细日志
docker-compose logs -f --tail=100

# 检查端口占用
netstat -tlnp | grep -E '5183|13579|3306|6379'

# 检查环境变量
cat .env
docker-compose config  # 查看合并后的配置
```

### 2. 数据库连接失败

```bash
# 进入 MySQL 容器
docker exec -it assettube-mysql mysql -u root -p

# 检查后端数据库配置
docker exec assettube-backend env | grep DB_
```

### 3. 镜像加载失败

```bash
# 检查镜像是否完整
docker images | grep assettube

# 重新加载
gunzip -c assettube-backend-v1.0.0.tar.gz | docker load
```

---

## 安全建议

1. **修改默认密码**: 生产环境务必修改所有默认密码
2. **使用 HTTPS**: 配置 SSL 证书
3. **防火墙配置**: 只开放必要端口（80, 443）
4. **定期备份**: 设置定时任务备份数据库
5. **日志监控**: 配置日志收集和分析
