# AssetTube 部署快速入门

## 🎯 选择适合你的部署方式

| 场景 | 推荐方案 | 文档 |
|------|----------|------|
| 离线服务器（无外网） | 镜像文件部署 | [REMOTE_DEPLOY.md#方案一](#) |
| 在线服务器 | Docker Hub 部署 | [REMOTE_DEPLOY.md#方案二](#) |
| 内网环境 | 私有仓库部署 | [REMOTE_DEPLOY.md#方案三](#) |
| 自动化部署 | CI/CD 部署 | [REMOTE_DEPLOY.md#方案四](#) |

---

## 📦 方式一：镜像文件部署（最常用）

### 第一步：在开发机构建并导出镜像

```bash
# 进入项目目录
cd AssetHub

# 构建镜像
./docker-build.sh v1.0.0

# 导出镜像到文件
./docker-export.sh v1.0.0 ./docker-images
```

完成后会在 `docker-images/` 目录生成：
```
docker-images/
├── assettube-backend-v1.0.0.tar.gz    # 后端镜像（约 500MB）
├── assettube-frontend-v1.0.0.tar.gz   # 前端镜像（约 50MB）
├── docker-compose.prod.yml            # 生产环境配置
├── .env.example                       # 环境变量模板
├── deploy.sh                          # 一键部署脚本
└── README.txt                         # 说明文件
```

### 第二步：传输到目标服务器

```bash
# 使用 scp 传输整个目录
scp -r docker-images root@目标服务器IP:/opt/

# 或者使用一键远程部署脚本
./docker-deploy-remote.sh root@目标服务器IP v1.0.0
```

### 第三步：在目标服务器部署

```bash
# SSH 登录目标服务器
ssh root@目标服务器IP

# 进入目录
cd /opt/docker-images

# 运行部署脚本
./deploy.sh v1.0.0

# 按提示配置环境变量，然后自动启动
```

部署完成后访问：
- 前端：http://目标服务器IP
- 后端：http://目标服务器IP:5183/api/health

---

## 🐳 方式二：Docker Hub 部署

### 第一步：推送镜像到 Docker Hub

```bash
# 登录
docker login

# 标记并推送
docker tag assettube/backend:v1.0.0 yourusername/assettube-backend:v1.0.0
docker tag assettube/frontend:v1.0.0 yourusername/assettube-frontend:v1.0.0
docker push yourusername/assettube-backend:v1.0.0
docker push yourusername/assettube-frontend:v1.0.0
```

### 第二步：在目标服务器拉取并部署

```bash
# 登录
docker login

# 拉取镜像
docker pull yourusername/assettube-backend:v1.0.0
docker pull yourusername/assettube-frontend:v1.0.0

# 启动
docker-compose up -d
```

---

## 🔧 常用命令

```bash
# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f

# 重启服务
docker-compose restart

# 停止服务
docker-compose down

# 更新版本（先构建新镜像）
docker-compose pull
docker-compose up -d
```

---

## 🗃️ 合规模块迁移（特种设备检验记录）

首次部署或升级到 2026-03-03 之后的版本时，建议在后端目录执行一次：

```bash
cd backend
npm run migrate:special-equipment-inspections
```

该脚本会自动创建/补齐 `special_equipment_inspections` 表结构、索引并回填缺失的 `inspection_code`。

---

## ⚙️ 环境变量配置

编辑 `.env` 文件：

```bash
# 数据库密码（必须修改）
DB_PASSWORD=your_secure_password

# JWT 密钥（必须修改，至少32字符）
JWT_SECRET=your_random_secret_key_here_min_32_chars

# 前端 URL
FRONTEND_URL=http://your-domain.com
```

---

## 📁 部署文件清单

| 文件 | 用途 | 是否必需 |
|------|------|----------|
| `assettube-backend-*.tar.gz` | 后端镜像 | ✅ |
| `assettube-frontend-*.tar.gz` | 前端镜像 | ✅ |
| `docker-compose.prod.yml` | 服务编排配置 | ✅ |
| `.env` | 环境变量 | ✅ |
| `deploy.sh` | 一键部署脚本 | 可选 |

---

## 🆘 故障排查

### 端口冲突
```bash
# 检查端口占用
netstat -tlnp | grep 5183

# 修改端口映射（编辑 docker-compose.yml）
ports:
  - '5184:5183'  # 主机5184映射到容器5183
```

### 数据库连接失败
```bash
# 检查 MySQL 日志
docker-compose logs mysql

# 检查环境变量
cat .env
```

### 镜像加载失败
```bash
# 重新加载
gunzip -c assettube-backend-v1.0.0.tar.gz | docker load
```

---

## 📚 详细文档

- [DOCKER_README.md](DOCKER_README.md) - Docker 快速指南
- [DOCKER_DEPLOY.md](DOCKER_DEPLOY.md) - 完整部署文档
- [REMOTE_DEPLOY.md](REMOTE_DEPLOY.md) - 远程部署方案
