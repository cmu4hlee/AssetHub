# AssetHub 飞牛 NAS 部署说明

## 目标环境
- 飞牛 NAS (fnOS)，局域网 IP `192.168.1.132`
- Web 管理面板：`http://192.168.1.132:5666/`
- 应用访问入口：`http://192.168.1.132:5666/`（同端口）

## 部署步骤

### 方式 A：通过飞牛 Web 面板（推荐）

1. **登录飞牛 Web 面板**
   浏览器访问 `http://192.168.1.132:5666/`，进入飞牛 OS 管理后台。

2. **打开 Container Manager / Docker 应用**
   在飞牛应用中心打开「Container Manager」或类似 Docker 管理工具（飞牛内置）。

3. **创建项目目录**
   在飞牛文件管理器创建：
   ```
   /vol1/1000/assethub/        # 部署包解压目录
   /vol1/1000/assethub/data/    # 持久化数据
   ```

4. **上传并解压部署包**
   将本目录（`deploy-fnnas/`）打包为 `assethub.tar.gz` 后上传到飞牛，并解压：
   ```bash
   cd /vol1/1000/assethub
   tar -xzf assethub.tar.gz
   ```

5. **SSH 飞牛并启动**（如果面板不支持 Compose）
   ```bash
   ssh admin@192.168.1.132
   cd /vol1/1000/assethub/deploy-fnnas
   bash scripts/start-fnnas.sh
   ```

6. **等待 3-5 分钟**首次启动会构建镜像并初始化 194 张数据库表。

7. **访问应用**
   浏览器打开 `http://192.168.1.132:5666/`

### 方式 B：直接 SSH 到 NAS 后部署

```bash
# 1. 从本地推送部署包到飞牛
scp -r deploy-fnnas/ admin@192.168.1.132:/vol1/1000/assethub/

# 2. SSH 登录
ssh admin@192.168.1.132

# 3. 启动
cd /vol1/1000/assethub/deploy-fnnas
bash scripts/start-fnnas.sh
```

## 端口规划

| 服务 | 容器内端口 | NAS 暴露端口 | 用途 |
|------|----------|------------|------|
| frontend | 80 | **5666** | Web 入口（飞牛面板 + AssetHub 同端口） |
| backend | 5183 | 不暴露 | 仅供前端 Nginx 反向代理 |
| mysql | 3306 | 不暴露 | 容器内访问 |
| redis | 6379 | 不暴露 | 容器内访问 |

## 注意事项

### 1. OpenClaw AI 助手
当前 `backend.env` 配置的是**当前开发机的 OpenClaw**：
```
GATEWAY_BASE_URL=http://host.docker.internal:18789
OPENCLAW_GATEWAY_TOKEN=9046940c9e45cffd9640df5a2773a1fc8867e06adaa43c36
```
- 如果 NAS 本身没运行 OpenClaw，AI 助手会连接失败（不影响其它功能）
- 如需在 NAS 上启用 AI：把 OpenClaw 装到 NAS 上后，改 `GATEWAY_BASE_URL` 为 NAS 内 OpenClaw 的 IP

### 2. 端口冲突
如果 NAS 上 5666 端口已被占用，编辑 `docker-compose.yml` 中 frontend 的 `ports`：
```yaml
ports:
  - '5777:80'   # 改为其它端口
```

### 3. 默认账号
- 用户名：`admin`
- 密码：见 `init-seed-data.sql` 中 admin 用户的密码（首次部署后请在系统中修改）

### 4. 数据持久化
所有上传文件、备份、日志都保存在：
```
/vol1/1000/assethub/deploy-fnnas/data/backend/
```

### 5. 飞牛特殊的网络配置
- 飞牛 Docker 默认使用 bridge 网络
- `extra_hosts: host.docker.internal:host-gateway` 已配置，让容器能访问宿主 NAS 的 OpenClaw
- 如遇网络问题，可临时把容器加入 host 网络模式（修改 docker-compose.yml）

## 常用命令

```bash
# 查看服务状态
docker compose ps

# 查看后端日志
docker compose logs -f backend

# 重启某个服务
docker compose restart backend

# 完全清理并重建
docker compose down -v
docker compose build --no-cache
docker compose up -d

# 进入后端容器调试
docker compose exec backend sh
```

## 故障排查

| 现象 | 排查 |
|------|------|
| 5666 端口连不上 | 防火墙是否放行；docker compose ps 看 frontend 是否 healthy |
| 后端一直 starting | `docker compose logs backend` 查看；MySQL 初始化需要 1-3 分钟 |
| AI 助手报错 | OpenClaw 没在 NAS 上运行；改 `OPENCLAW_ENABLED=false` 临时关闭 |
| 登录后模块禁用 | 容器首次启动会插入模块配置；如失败手动执行 SQL |