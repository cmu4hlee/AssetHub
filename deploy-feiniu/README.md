# AssetHub 飞牛服务器部署指南

## 系统要求

- 目标服务器：192.168.1.132
- 操作系统：Linux (建议 CentOS 7+ 或 Ubuntu 18.04+)
- Docker 20.10+
- Docker Compose 1.27+
- 数据库：192.168.1.111:3306 (MySQL)

## 目录结构

```
deploy-feiniu/
├── Dockerfile.backend       # 后端镜像构建文件
├── Dockerfile.frontend      # 前端镜像构建文件
├── docker-compose.yml       # Docker Compose 配置
├── nginx/
│   └── default.conf         # Nginx 配置文件
├── build.sh                 # 构建镜像脚本
├── run.sh                   # 本地运行脚本
├── stop.sh                  # 停止服务脚本
├── save-images.sh           # 保存镜像脚本
├── load-images.sh           # 加载镜像脚本
├── deploy.sh                # 部署脚本
├── data/                    # 数据目录（自动创建）
│   ├── uploads/
│   ├── backups/
│   └── logs/
└── README.md                # 本文件
```

## 部署步骤

### 第一步：本地构建镜像

1. 进入部署目录：
   ```bash
   cd /Volumes/移动硬盘（500）/AssetHub/deploy-feiniu
   ```

2. 给脚本添加执行权限：
   ```bash
   chmod +x *.sh
   ```

3. 构建 Docker 镜像：
   ```bash
   ./build.sh
   ```

4. （可选）本地测试：
   ```bash
   ./run.sh
   # 测试完成后停止
   ./stop.sh
   ```

### 第二步：保存并上传镜像

1. 保存镜像到压缩包：
   ```bash
   ./save-images.sh
   ```

2. 将生成的镜像文件（例如 `assethub-images-20250501_120000.tar.gz`）上传到飞牛服务器 192.168.1.132

   可以使用 scp 命令：
   ```bash
   scp assethub-images-*.tar.gz user@192.168.1.132:/path/to/deploy/
   ```

### 第三步：在飞牛服务器上部署

1. 将 deploy-feiniu 整个目录复制到飞牛服务器
2. 在飞牛服务器上执行：
   ```bash
   # 进入部署目录
   cd /path/to/deploy-feiniu
   
   # 给脚本添加执行权限
   chmod +x *.sh
   
   # 加载镜像
   ./load-images.sh
   
   # 部署服务
   ./deploy.sh
   ```

## 访问地址

部署完成后，可以通过以下地址访问：

- **前端界面**：http://192.168.1.132
- **后端 API**：http://192.168.1.132:5183

## 登录账号

默认超级管理员账号：
- 用户名：`su`
- 密码：`123`

## 常用命令

### 在飞牛服务器上操作

```bash
# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f

# 查看后端日志
docker-compose logs -f backend

# 查看前端日志
docker-compose logs -f frontend

# 重启服务
docker-compose restart

# 停止服务
./stop.sh

# 重新启动服务
./run.sh
```

## 配置说明

### 数据库配置

在 `docker-compose.yml` 中配置：

```yaml
environment:
  - DB_HOST=192.168.1.111
  - DB_PORT=3306
  - DB_USER=root
  - DB_PASSWORD=Cmu19801008
  - DB_NAME=zcgl
```

### 修改端口

如需修改访问端口，编辑 `docker-compose.yml`：

```yaml
ports:
  - "80:80"      # 前端端口（主机:容器）
  - "5183:5183"  # 后端端口（主机:容器）
```

### 数据持久化

数据保存在 `data/` 目录：
- `data/uploads/` - 文件上传
- `data/backups/` - 数据库备份
- `data/logs/` - 日志文件

## 故障排查

### 服务无法启动

```bash
# 查看日志
docker-compose logs

# 检查端口占用
netstat -tulpn | grep -E '(:80|:5183)'
```

### 数据库连接失败

1. 确认数据库服务在 192.168.1.111 上运行
2. 确认网络连通性
3. 检查数据库账号密码是否正确

### 前端无法访问后端

1. 检查 CORS 配置
2. 确认后端服务健康
3. 检查防火墙设置

## 更新部署

当需要更新代码时：

```bash
# 1. 本地重新构建
./build.sh

# 2. 保存新镜像
./save-images.sh

# 3. 上传新镜像到飞牛服务器

# 4. 在飞牛服务器上
cd /path/to/deploy-feiniu
docker-compose down
./load-images.sh
./deploy.sh
```

## 安全建议

1. 修改默认的 JWT_SECRET
2. 定期备份数据库
3. 配置防火墙规则
4. 使用 HTTPS（生产环境）

## 技术支持

如有问题，请查看：
- 后端日志：`data/logs/` 或 `docker-compose logs backend`
- 前端控制台：浏览器 F12
