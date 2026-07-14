# 🚀 AssetHub 飞牛服务器部署 - 快速开始

## 快速部署流程

### 在开发机器上（本地）

```bash
# 1. 进入部署目录
cd /Volumes/移动硬盘（500）/AssetHub/deploy-feiniu

# 2. 构建镜像
./build.sh

# 3. （可选）本地测试
./run.sh
# 测试完成后
./stop.sh

# 4. 保存镜像
./save-images.sh
```

### 将文件传输到飞牛服务器 (192.168.1.132)

```bash
# 复制整个 deploy-feiniu 目录到服务器
# 方式1: 使用 scp
scp -r deploy-feiniu user@192.168.1.132:/opt/

# 方式2: 使用 rsync
rsync -avz deploy-feiniu/ user@192.168.1.132:/opt/assethub/
```

### 在飞牛服务器上 (192.168.1.132)

```bash
# 1. 登录服务器
ssh user@192.168.1.132

# 2. 进入部署目录
cd /opt/assethub  # 或你的部署路径

# 3. 加载镜像
./load-images.sh

# 4. 部署服务
./deploy.sh
```

## 访问系统

部署完成后，在浏览器中打开：

- **系统地址**：http://192.168.1.132

### 登录凭证

- **用户名**：`su`
- **密码**：`123`

## 常用运维命令

```bash
# 查看服务状态
docker-compose ps

# 查看实时日志
docker-compose logs -f

# 查看后端日志
docker-compose logs -f backend

# 查看前端日志
docker-compose logs -f frontend

# 重启服务
docker-compose restart

# 停止服务
./stop.sh

# 重新启动
./run.sh
```

## 文件说明

| 文件 | 说明 |
|------|------|
| `Dockerfile.backend` | 后端镜像构建文件 |
| `Dockerfile.frontend` | 前端镜像构建文件 |
| `docker-compose.yml` | 服务编排配置 |
| `nginx/default.conf` | Nginx 配置 |
| `build.sh` | 构建镜像脚本 |
| `run.sh` | 启动服务脚本 |
| `stop.sh` | 停止服务脚本 |
| `save-images.sh` | 保存镜像脚本 |
| `load-images.sh` | 加载镜像脚本 |
| `deploy.sh` | 一键部署脚本 |
| `README.md` | 详细部署文档 |
| `QUICKSTART.md` | 本文件 |

## 数据目录

```
data/
├── uploads/   # 文件上传目录
├── backups/   # 备份目录
└── logs/      # 日志目录
```

## 配置数据库连接

如需修改数据库配置，编辑 `docker-compose.yml`：

```yaml
environment:
  - DB_HOST=192.168.1.111
  - DB_PORT=3306
  - DB_USER=root
  - DB_PASSWORD=Cmu19801008
  - DB_NAME=zcgl
```

修改后重启服务：
```bash
docker-compose restart
```

## 故障排查

### 服务未启动？
```bash
# 查看日志
docker-compose logs

# 检查端口
netstat -tulpn | grep -E '(:80|:5183)'
```

### 数据库连接失败？
1. 确认 192.168.1.111 的 MySQL 服务运行正常
2. 检查网络连通性 `ping 192.168.1.111`
3. 验证账号密码

### 前端无法访问？
检查防火墙是否开放 80 端口

---

详细文档请查看 [README.md](./README.md)
