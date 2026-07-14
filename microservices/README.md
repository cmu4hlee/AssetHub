# AssetHub Microservices

## 快速启动

```bash
cd microservices
npm run bootstrap
npm run start:core
```

- `bootstrap`: 安装网关与各微服务依赖
- `start:core`: 启动网关 + 认证 + 用户 + 资产 + 维保 + 质量服务
- `start:all`: 启动全部微服务

## 常用脚本

- `npm run start:gateway`
- `npm run start:auth`
- `npm run start:user`
- `npm run start:asset`
- `npm run start:maintenance`
- `npm run start:quality`
- `npm run start:inventory`
- `npm run start:document`
- `npm run start:notification`

## 环境变量

建议在启动前设置以下变量（未设置时使用默认值）：

- `JWT_SECRET`（认证令牌密钥，开发环境支持默认值）
- `DATABASE_HOST` / `DATABASE_PORT` / `DATABASE_USER` / `DATABASE_PASSWORD` / `DATABASE_NAME`
- `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD`
- `ASSET_SERVICE_URL` / `USER_SERVICE_URL` / `MAINTENANCE_SERVICE_URL` / `QUALITY_SERVICE_URL` 等（网关代理目标）

## 兼容说明

- `api-gateway/src/index.js` 与 `user-service/src/index.js` 保留为兼容入口，实际实现统一到同级 `index.js`。
- 网关已兼容历史质量接口路径：`/api/quality-control/quality-control`。
