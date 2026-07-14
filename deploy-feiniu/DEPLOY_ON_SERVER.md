# AssetHub 飞牛服务器部署 - 在服务器上执行

## 第一步：创建目录并确认文件

在 SSH 终端 (leon@CJLeon) 执行：

```bash
mkdir -p /tmp/assethub
cd /tmp/assethub
ls -la
```

## 第二步：传输镜像文件

在 Mac 终端执行：

```bash
cd "/Volumes/移动硬盘（500）/AssetHub/deploy-feiniu"
scp assethub-frontend-feiniu.tar leon@192.168.1.132:/tmp/assethub/
scp assethub-backend-feiniu.tar leon@192.168.1.132:/tmp/assethub/
```

## 第三步：创建 docker-compose.yml

在 SSH 终端执行：

```bash
cd /tmp/assethub

cat > docker-compose.yml << 'ENDOFFILE'
version: "3.8"

services:
  backend:
    image: assethub/backend:feiniu
    container_name: assethub-backend
    ports:
      - "5183:5183"
    volumes:
      - ./data/uploads:/app/uploads
      - ./data/backups:/app/backups
      - ./data/logs:/app/logs
    environment:
      - NODE_ENV=production
      - PORT=5183
      - DB_HOST=192.168.1.111
      - DB_PORT=3306
      - DB_USER=root
      - DB_PASSWORD=Cmu19801008
      - DB_NAME=zcgl
      - JWT_SECRET=AssetMgmtSys2025FeiniuSecretKey
      - CORS_ORIGIN=http://192.168.1.132
      - REDIS_ENABLED=false
    restart: unless-stopped
    networks:
      - assethub-network

  frontend:
    image: assethub/frontend:feiniu
    container_name: assethub-frontend
    ports:
      - "80:80"
    volumes:
      - ./nginx/default.conf:/etc/nginx/conf.d/default.conf:ro
    depends_on:
      - backend
    restart: unless-stopped
    networks:
      - assethub-network

networks:
  assethub-network:
    driver: bridge
ENDOFFILE
```

## 第四步：创建 nginx 配置

```bash
mkdir -p nginx

cat > nginx/default.conf << 'ENDOFFILE'
server {
  listen 80;
  server_name 192.168.1.132 localhost;
  client_max_body_size 100m;
  root /usr/share/nginx/html;
  index index.html;

  gzip on;
  gzip_vary on;
  gzip_min_length 1024;
  gzip_types text/plain text/css text/xml text/javascript application/javascript application/json application/xml+rss application/xml;

  location / {
    try_files $uri $uri/ /index.html;
  }

  location /api/ {
    proxy_pass http://assethub-backend:5183/api/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location /uploads/ {
    proxy_pass http://assethub-backend:5183/uploads/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location /socket.io/ {
    proxy_pass http://assethub-backend:5183/socket.io/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
ENDOFFILE
```

## 第五步：加载镜像

```bash
cd /tmp/assethub
docker load -i assethub-frontend-feiniu.tar
docker load -i assethub-backend-feiniu.tar
```

## 第六步：启动服务

```bash
mkdir -p data/uploads data/backups data/logs
docker-compose up -d
```

## 第七步：检查状态

```bash
docker-compose ps
docker-compose logs
```

## 第八步：初始化用户

```bash
./init-users.sh
```

完成后访问 http://192.168.1.132
