# Docker部署说明

## 1. 前置条件

- 已安装 Docker 与 Docker Compose（`docker compose`）
- 数据库可从容器访问（当前项目默认使用 `backend/.env` 里的远程 MySQL）

## 2. 构建并启动

在项目根目录执行：

```bash
docker compose up -d --build
```

启动后端口：

- 前端：`http://localhost:13579`
- 后端健康检查：`http://localhost:5183/api/health`

## 3. 常用命令

```bash
# 查看服务状态
docker compose ps

# 查看日志
docker compose logs -f backend
docker compose logs -f frontend

# 重启服务
docker compose restart backend
docker compose restart frontend

# 停止并删除容器
docker compose down
```

## 4. 数据持久化

`docker-compose.yml` 已挂载以下目录：

- `backend/uploads -> /app/uploads`
- `backend/backups -> /app/backups`
- `backend/logs -> /app/logs`

## 5. 配置说明

容器使用 `backend/.env` 作为后端配置源，建议重点确认：

- `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` / `DB_NAME`
- `JWT_SECRET`
- `CORS_ORIGIN`

如果部署在公网域名，请把 `FRONTEND_URL` 与 `CORS_ORIGIN` 改成实际域名。

## 6. 首次部署排查

- 前端能打开但接口报错：优先检查数据库连通性与后端日志
- 前端白屏：检查 `docker compose logs -f frontend`
- 后端启动失败：检查 `docker compose logs -f backend` 是否为数据库连接失败或环境变量缺失
