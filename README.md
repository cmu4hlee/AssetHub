# AssetHub — 企业级资产管理系统

> 面向多租户医院的全生命周期资产管理平台: 资产入库 → 调配 → 预防性维护 → 维修 → 报废 + AI 助手驱动业务操作

[![Build](https://img.shields.io/badge/build-passing-brightgreen)](.github/workflows/ci-cd.yml)
[![Node](https://img.shields.io/badge/node-%3E%3D20-blue)](backend/package.json)
[![License](https://img.shields.io/badge/license-private-red)]()

---

## 核心能力

- 🏷️ **资产主数据** — 48 个业务模块, 60+ 顶层页面
- 🔧 **维修工单** — 全流程状态机 (pending → in_progress → pending_acceptance → closed), 含历史时间线
- 📋 **预防性维护** — Hub 中心 (计划 + 模板 + 提醒), 多级保养 (使用科室/临床工程师 2 大类)
- 🛡️ **合规管理** — 特种设备/计量/质控/安全检查, 5+ 法规领域
- 🤖 **AI 助手** — 自然语言驱动业务操作 (OpenAI/通义/Ollama 多 provider)
- 🏢 **多租户隔离** — 严格 `tenant_id` 过滤 + 开发环境守卫告警
- 📡 **IoT 集成** — 4 个子模块 (位置/环境/设备/地理围栏)

## 技术栈

| 层 | 选型 |
|---|------|
| **前端** | React 19 + Vite 6 + Antd 6 + dayjs + xlsx |
| **后端** | Node 20 + Express 4 + mysql2 + Redis + ioredis |
| **实时** | Socket.IO + Redis pub/sub |
| **认证** | JWT + 角色/资源粒度 RBAC |
| **监控** | Prometheus /metrics + 健康检查 + 熔断器 |
| **部署** | Docker + docker-compose × 5 (prod/local/feiniu/fnnas) |
| **测试** | Jest + supertest (97 后端 test 文件) + vitest (前端) |
| **CI/CD** | GitHub Actions (lint / test / build / security / deploy) |

## 架构

```
┌─────────────────────────────────────────────────┐
│ Frontend (React 19 + Vite 6 + Antd 6)          │
│ - 9 modules (clinical/compliance/risk/...)    │
│ - 23 API domains + 17 utils                    │
└──────────┬──────────────────────────────────────┘
           │ /api/* (vite proxy → 5183)
           ▼
┌─────────────────────────────────────────────────┐
│ Backend (Express 4 + Node 20)                  │
│ ┌─────────┐ ┌─────────┐ ┌──────────┐ ┌───────┐ │
│ │Routes   │ │Modules  │ │Services  │ │  Core │ │
│ │70+ root │ │48 biz   │ │80+ cross │ │  16   │ │
│ └─────────┘ └─────────┘ └──────────┘ └───────┘ │
│  + Middleware (auth/rate-limit/tenant/error)  │
│  + EventBus / ServiceContainer / ModuleManager│
└──────────┬──────────────────┬───────────────────┘
           ▼                  ▼
    ┌──────────┐         ┌──────────┐
    │MySQL 8.x │         │ Redis 7  │
    │  (zcgl)  │         │ (cache + │
    │  pool    │         │ pubsub)  │
    └──────────┘         └──────────┘
```

**核心基础设施** (16 个 core 文件): `ModuleManager` / `ModuleInterface` / `ServiceContainer` / `EventBus` / `module-router` / `module-health` / `module-loader` / `module-contract` / `data-access-guard` / `route-registry` / `socket` / ...

## 快速开始 (开发)

### 1. 环境要求

- Node.js 20+
- MySQL 8.0+
- Redis 7+
- npm 10+

### 2. 克隆 & 安装

```bash
git clone https://github.com/cmu4hlee/AssetHub.git
cd AssetHub
cp backend/.env.example backend/.env
# 编辑 backend/.env 填实际 DB/Redis/JWT_SECRET
```

### 3. 启动后端

```bash
cd backend
npm install
npm run migrate:up        # 跑迁移建表
npm run dev               # nodemon 监听 5183
```

### 4. 启动前端

```bash
cd frontend
npm install
npm run dev               # vite 启动 13579
```

### 5. 登录

打开 <http://localhost:13579>，用 admin/admin123 登录（开发环境默认账号）

### 6. 验证

```bash
# 后端
curl http://localhost:5183/api/health
# → {"success":true,"status":"healthy",...}

# 前端
# 浏览器访问 http://localhost:13579
```

## 部署 (生产)

### Docker Compose (推荐)

```bash
# 本地开发
cp .env.example .env  # 编辑
docker-compose up -d

# 生产环境 (不同配置)
docker-compose -f docker-compose.prod.yml up -d
```

### 手动部署

```bash
# 后端
cd backend
NODE_ENV=production npm install --production
NODE_ENV=production node server.js

# 前端
cd frontend
npm run build
# 部署 dist/ 到 nginx
```

### 部署文档

- `deploy-fnnas/` — 飞牛 NAS 部署
- `deploy-feiniu/` — 飞牛云部署
- `deploy-local/` — 本地部署
- `运维文档/` — 监控/备份/升级

## 测试

```bash
# 后端 (Jest + supertest, 97 test files)
cd backend
npm test
npm run test:coverage    # 生成 coverage 报告

# 前端 (Vitest)
cd frontend
npm test

# 项目级审计
npm run audit:routes      # 路由挂载审计
npm run audit:docs        # API 文档覆盖审计
```

## 项目结构

```
AssetHub/
├── backend/                # Node 20 + Express 4
│   ├── modules/            # 48 业务模块 (独立 config/routes/services)
│   ├── routes/             # 70+ 横向路由
│   ├── services/           # 80+ 横向服务 (auth/cache/notification/...)
│   ├── core/               # 16 基础设施 (Module/ServiceContainer/EventBus/...)
│   ├── middleware/         # 22 中间件 (auth/rate-limit/tenant/error/...)
│   ├── config/             # 配置 (database/logger/security/...)
│   ├── tests/              # 97 测试文件 (api/support/unit)
│   ├── docs/               # 28K 行 API 文档 + 设计文档
│   └── Dockerfile
├── frontend/               # React 19 + Vite 6 + Antd 6
│   ├── src/
│   │   ├── modules/        # 9 业务模块 (clinical/compliance/risk/...)
│   │   ├── pages/          # 60+ 顶层页面
│   │   ├── api/domains/    # 23 API 域名封装
│   │   ├── components/     # 通用组件
│   │   ├── hooks/          # 自定义 hooks
│   │   ├── utils/          # 17 工具 (auth/error/performance/...)
│   │   └── App.jsx         # 路由 + Provider
│   └── Dockerfile
├── docs/                    # 80+ 设计/部署/分析文档 (中文为主)
├── .github/workflows/       # CI/CD (lint/test/build/deploy)
├── docker-compose*.yml      # 5 部署配置
├── deploy-*/                # 各种部署场景
└── package.json             # 根脚本 (统一管理 dev/test/lint/docker)
```

## 关键特性 (生产级)

- **多租户隔离** — 30+ 表白名单 + 守卫 + 自动注入 tenant_id
- **RBAC** — 角色 × 资源粒度 (e.g. `maintenance:plan:read/write/update/delete`)
- **限流** — API 5000/15min + 登录 50/5min
- **幂等** — 高风险操作防重 (POST + Idempotency-Key + X-Risk-Confirm-Token)
- **审计** — 全部写操作记录 + 查询 API
- **安全** — helmet/CORS/SQL 参数化/文件 MIME 校验/JWT 强密钥
- **熔断** — `/api/circuit-breakers` 端点
- **可观测** — Prometheus /metrics + 4 健康检查端点
- **容器化** — Dockerfile + 5 docker-compose 场景
- **微服务化** — 已规划, 详见 `agent-mesh-architecture.md`

## 模块清单

### 资产主数据
- `asset-management` — 资产 CRUD + 导入导出 + 标签
- `asset-allocation` — 调配/转移
- `idle-asset-management` — 闲置资产
- `scrapping` — 报废

### 维修与维护
- `maintenance-management` — 维修申请/工单/日志
- `preventive-maintenance-management` — 预防性维护计划
- `maintenance-temporary-management` — 临时维修
- `warranty-management` — 保修管理

### 合规与质量
- `compliance-management` — 5+ 法规领域 (特种设备/计量/质控/...)
- `quality-assurance-management` — 质量保证
- `safety-inspection-management` — 安全检查
- `metrology-management` — 计量管理
- `poct-quality-control` — POCT 质控

### 业务运营
- `tendering-management` — 招投标
- `contract-management` — 合同
- `supplier-management` — 供应商
- `inventory-management` — 盘点
- `acceptance-management` — 资产验收
- `adverse-event` — 不良事件

### 智能化
- `asset-ai-assistant` — 资产 AI 助手
- `ct-maintenance-assistant-management` — CT 维护助手
- `knowledge-base` — 知识库
- `agent-mesh` — 智能体网格 (微服务化基础)

### IoT 与监测
- `iot-management` / `iot-asset-monitoring-management` / `iot-environment-monitoring-management` / `iot-geo-location-management` / `iot-zone-location-management` — 5 个 IoT 子模块

### 体系支撑
- `user-management` / `department-management` / `workflow-management` / `form-customization-management` / `event-reminder-management` / `notification` / `staff-qualification` / `emergency-allocation-management` / `feishu-binding` / `wechat-mp-binding` / `label-management` / `uploads` / `depreciation-management` / `pdca-management` / `risk-management` / `uptime-management` / `dashboard`

## 文档

- 📘 [完整文档索引](docs/README.md) — 80+ 文档分类导航
- 📗 [API 完整文档](backend/docs/api-documentation.md) — 28K 行所有 API
- 📕 [Swagger UI](http://localhost:5183/api-docs) — 在线交互文档 (启动后)
- 📙 [模块化架构设计](docs/modular-architecture-design.md) — 模块拆分规范
- 📓 [生产级标准审计报告](docs/PRODUCTION_AUDIT_2026-07-18.md) — 8.2/10 B+ 级

## 贡献

- Pre-commit 自动 lint/format (husky + lint-staged)
- CI 必跑 lint + test + build (PR 不能合并除非通过)
- 详见 `docs/module-development-guide.md`

## 许可证

Private — 内部使用

---

**AssetHub** · 2026 · 资产让管理更简单
