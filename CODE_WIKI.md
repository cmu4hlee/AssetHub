# AssetHub Code Wiki

> AssetHub / AssetRob 企业级医疗资产管理系统代码知识库
>
> 最后更新：2026-06-21

---

## 目录

1. [项目概览](#1-项目概览)
2. [整体架构](#2-整体架构)
3. [仓库目录结构](#3-仓库目录结构)
4. [技术栈与依赖](#4-技术栈与依赖)
5. [后端架构](#5-后端架构)
6. [前端架构](#6-前端架构)
7. [数据库与数据访问](#7-数据库与数据访问)
8. [认证、权限与多租户](#8-认证权限与多租户)
9. [主要业务模块](#9-主要业务模块)
10. [关键类、函数与服务](#10-关键类函数与服务)
11. [依赖关系与调用链路](#11-依赖关系与调用链路)
12. [项目运行方式](#12-项目运行方式)
13. [部署与运维](#13-部署与运维)
14. [辅助子系统](#14-辅助子系统)
15. [测试、代码规范与质量保障](#15-测试代码规范与质量保障)
16. [开发导航](#16-开发导航)

---

## 1. 项目概览

AssetHub 是一个面向医疗机构和多企业场景的资产全生命周期管理平台。项目覆盖资产建档、资产图片与文档、盘点、调拨、闲置、报废、维修维护、预防性维护、采购、验收、质量控制、计量管理、合规管理、风险管理、人员资质、IoT 监测、AI 助手、审计日志、备份、租户模块配置等功能。

项目形态是“前后端分离 + Express 单体后端 + 模块化业务目录 + React/Vite 前端 + Docker 部署 + 桌面服务管理器 + MCP AI 集成工具”。当前主线仍以后端 `backend/server.js` 和前端 `frontend/src/App.jsx` 为核心，`microservices/` 目录更偏向微服务化演进骨架，不是当前主要可运行路径。

### 1.1 核心能力

| 能力 | 说明 |
|---|---|
| 资产全生命周期 | 登记、查询、详情、图片、文档、标签、盘点、调拨、闲置、报废、折旧 |
| 医疗设备运维 | 日常维修、预防性维护、维修工单、维护提醒、维护效率分析 |
| 质量与合规 | 计量管理、质量控制、合规检查、保养等级、安全巡检、特种设备 |
| 风险与人员 | 资产风险分类、风险评估、风险控制、人员资质、培训、能力评估 |
| IoT 监控 | 设备连接、资产监测、环境监测、区域定位、地理定位、开机率 |
| 多租户隔离 | 基于 `tenant_id` 和 `X-Tenant-ID` 的企业空间隔离与切换 |
| 权限控制 | JWT 认证、角色权限、菜单权限、模块权限、数据范围控制 |
| AI 集成 | 资产 AI 助手、维修 AI、文档 AI、OpenClaw、Chat2DB、MCP 工具层 |
| 部署运维 | Docker Compose、本地部署、生产部署、飞牛 NAS 部署、Electron 服务管理器 |

### 1.2 重要项目规则

- 数据库配置优先参考 `backend/.env` 或环境变量。
- `assets` 表中的 `asset_id` 字段不再使用，资产业务应使用 `asset_code`。
- 后端环境变量模板位于 `backend/.env.example`。
- 当前前端实际入口是 `frontend/src/main.jsx` 导入的 `frontend/src/App.jsx`，不是 `App.tsx`。

---

## 2. 整体架构

```text
用户浏览器 / 桌面客户端 / AI 代理
        │
        ├───────────────────────────────────────────────┐
        │                                               │
        ▼                                               ▼
React + Vite 前端                                 ServiceManager / MCP
frontend/                                       Electron / Go MCP Server
        │                                               │
        │ axios / fetch                                 │ HTTP API / stdio
        ▼                                               │
Nginx 或 Vite Dev Server                            │
        │                                               │
        ▼                                               ▼
Express 后端 backend/server.js
        │
        ├─ 全局中间件
        │  ├─ CORS / Helmet / Compression / BodyParser
        │  ├─ AccessControl / RateLimit / HighRiskActionGate
        │  ├─ RequestId / Logging / ErrorHandler
        │  ├─ Auth / TenantFilter / ModulePermission
        │  └─ CacheService / AsyncQueue 注入
        │
        ├─ 系统级路由 routes/*
        ├─ 模块路由 backend/modules/*/routes
        ├─ 旧版路由 backend/routes/*
        ├─ Swagger / API 文档
        └─ ModuleLoader / RouteRegistry
        │
        ▼
服务层 services/* 与 modules/*/services
        │
        ├─ BaseService / DatabaseInterface / ServiceContainer
        ├─ EventBus / ModuleContract / DataAccessGuard
        └─ Redis / AsyncQueue / Shared Services
        │
        ▼
MySQL 主库/从库 + Redis 可选缓存 + 文件目录 uploads/backups/logs
```

### 2.1 架构分层

| 层级 | 目录/文件 | 职责 |
|---|---|---|
| 入口层 | `backend/server.js`, `frontend/src/main.jsx` | 应用启动、运行时初始化、全局 Provider/中间件注册 |
| 路由层 | `backend/routes`, `backend/modules/*/routes`, `frontend/src/App.jsx` | 后端 API 暴露、前端页面路由 |
| 业务层 | `backend/services`, `backend/modules/*/services`, `frontend/src/pages` | 核心业务规则与页面交互 |
| 核心框架层 | `backend/core`, `frontend/src/core` | 模块管理、依赖注入、事件总线、模块路由守卫 |
| 数据访问层 | `backend/config/database.js`, `backend/core/DatabaseInterface.js`, `backend/utils/db-helper.js` | MySQL 连接池、事务、分页、缓存查询 |
| 权限层 | `backend/middleware/auth.js`, `tenant-filter.js`, `frontend/src/components/ProtectedRoute.jsx` | JWT、租户、角色、模块和菜单权限 |
| 通信层 | `frontend/src/api/client.js`, `frontend/src/api/domains/*` | axios 实例、请求拦截、错误处理、业务 API 封装 |
| 部署层 | `Dockerfile`, `docker-compose*.yml`, `deploy-*` | 容器构建、服务编排、生产/本地/NAS 部署 |
| 工具层 | `ServiceManager`, `tools/mcp-assethub`, `scripts` | 桌面管理、AI 工具接入、数据库与运维脚本 |

---

## 3. 仓库目录结构

```text
AssetHub/
├── backend/                         后端 Express 服务
│   ├── server.js                    后端主入口
│   ├── config/                      应用、数据库、Swagger、角色、安全配置
│   ├── core/                        模块化框架、服务容器、事件总线、数据守卫
│   ├── middleware/                  认证、租户、限流、安全、错误处理等中间件
│   ├── modules/                     模块化业务实现
│   ├── routes/                      系统级和旧版业务路由
│   ├── services/                    跨模块共享服务和核心业务服务
│   ├── scripts/                     初始化、迁移、导入、审计、修复脚本
│   ├── utils/                       响应、错误、数据库、文件、性能等工具
│   ├── tests/                       Jest 测试
│   ├── docs/                        后端 API/Swagger 文档
│   ├── Dockerfile                   后端镜像构建
│   └── package.json                 后端依赖与脚本
│
├── frontend/                        React + Vite 前端
│   ├── src/
│   │   ├── main.jsx                 前端实际入口
│   │   ├── App.jsx                  当前主应用路由
│   │   ├── App.tsx                  模块化示例入口，当前不是主入口
│   │   ├── api/                     axios 客户端与业务 API domain
│   │   ├── components/              通用 UI 组件
│   │   ├── contexts/                React Context 状态
│   │   ├── core/                    前端模块注册、模块上下文、路由守卫
│   │   ├── hooks/                   自定义 Hooks
│   │   ├── i18n/                    国际化资源
│   │   ├── modules/                 合规、风险、人员、开机率等模块页面
│   │   ├── pages/                   主要业务页面
│   │   ├── routes/                  模块化路由映射
│   │   ├── styles/                  全局样式与响应式样式
│   │   └── utils/                   auth、crypto、权限、格式化、性能等工具
│   ├── tests/                       Vitest 测试
│   ├── nginx/                       前端容器 Nginx 配置
│   ├── Dockerfile                   前端构建与 Nginx 托管镜像
│   ├── vite.config.js               Vite 配置
│   └── package.json                 前端依赖与脚本
│
├── tools/
│   ├── mcp-assethub/                Go 实现的 AssetHub MCP Server
│   └── mcp-assethub-code-helper/    MCP 辅助工具
│
├── ServiceManager/                  Electron 桌面服务管理器
├── ServiceManagerTauri/             Tauri 版本服务管理器
├── microservices/                   微服务化演进骨架
├── deploy-local/                    本地一体化 Docker 部署
├── deploy-fnnas/                    飞牛 NAS 部署
├── deploy-feiniu/                   部署脚本与镜像配置
├── docs/                            项目文档集合
├── analysis/                        权限矩阵、页面/API/表映射分析
├── ai-design/                       AI 对话与交互设计文档
├── assethub-api-assistant/          API 助手技能
├── docker-compose.yml               根目录轻量 Compose，backend + frontend
├── docker-compose.prod.yml          生产完整 Compose，MySQL + Redis + backend + frontend + nginx
├── package.json                     根目录聚合脚本
└── CODE_WIKI.md                     本文档
```

---

## 4. 技术栈与依赖

### 4.1 后端技术栈

| 类别 | 技术/库 | 用途 |
|---|---|---|
| 运行时 | Node.js | 后端运行环境 |
| Web 框架 | Express 4 | HTTP API 服务 |
| 数据库 | MySQL + mysql2 | 主数据存储、连接池、事务 |
| 缓存 | Redis / ioredis / node-cache | 缓存、降级缓存、队列辅助 |
| 认证 | jsonwebtoken | JWT Bearer Token |
| 密码 | bcryptjs | 密码哈希 |
| 安全 | helmet, express-rate-limit, cors | 安全头、限流、跨域 |
| 文件 | multer, mammoth, pdf-parse, pdf-lib | 上传、Office/PDF 解析 |
| Excel/CSV | exceljs, csv-parser | 导入导出 |
| 二维码/标签 | qrcode, canvas | 二维码与标签渲染 |
| AI | openai, axios | OpenAI 兼容模型、DeepSeek、OpenClaw 等 |
| 实时通信 | socket.io | WebSocket 通信能力 |
| API 文档 | swagger-jsdoc, swagger-ui-express | Swagger 文档 |
| 测试 | jest, supertest | 单元测试与接口测试 |
| 代码规范 | eslint, prettier | 代码检查与格式化 |

### 4.2 前端技术栈

| 类别 | 技术/库 | 用途 |
|---|---|---|
| 构建 | Vite 6 | 开发服务器、构建、代理 |
| UI 框架 | React 19 | SPA 前端 |
| 路由 | react-router-dom 7 | 页面路由 |
| UI 组件 | Ant Design 6 | 表单、表格、布局、消息等 |
| HTTP | axios | API 请求 |
| 图表 | recharts | 仪表盘与统计图表 |
| 日期 | dayjs | 日期格式化 |
| Markdown | react-markdown, remark-gfm, rehype-raw | AI/文档 Markdown 渲染 |
| 二维码/条码 | qrcode, jsbarcode, jsqr | 标签、扫码、二维码 |
| 音频 | howler, wavesurfer.js | 音频相关交互 |
| 测试 | vitest, testing-library, jsdom | 单元与组件测试 |
| 代码规范 | eslint, prettier | 检查与格式化 |

### 4.3 工具与部署技术

| 子系统 | 技术 | 用途 |
|---|---|---|
| Docker 部署 | Docker, Docker Compose, Nginx | 容器化运行 |
| ServiceManager | Electron, mysql2 | 本机服务启停与配置管理 |
| ServiceManagerTauri | Tauri / Rust / JS | 轻量桌面管理器备选实现 |
| MCP Server | Go | AssetHub API 转 MCP 工具 |
| CI/CD | GitHub Actions | 工作流自动化 |
| Git hooks | Husky, lint-staged | 提交前检查 |

---

## 5. 后端架构

### 5.1 入口与启动流程

后端入口是 `backend/server.js`，根目录脚本 `npm run dev:backend` 会进入 `backend` 并执行 `npm run dev`，后者运行 `nodemon server.js`。

启动链路：

```text
server.js
  ├─ 加载 dotenv 与短信环境变量
  ├─ 加载 config/database.js 与 config/app.config.js
  ├─ 初始化 Redis/cache 服务，失败时降级
  ├─ 初始化 async queue 服务，失败时降级
  ├─ 创建 Express app
  ├─ 注册全局中间件
  ├─ 注册静态资源与 Swagger
  ├─ 注册系统路由
  ├─ 注册模块路由
  ├─ 注册旧版路由
  ├─ 注册 /api/system/modules
  ├─ 注册 /api/health
  ├─ 注册 404 与 errorHandler
  └─ 监听 HTTP/HTTPS 并注册优雅关闭
```

### 5.2 中间件管道

`server.js` 中间件顺序决定了安全、权限、租户和错误处理的行为。

| 顺序 | 中间件 | 文件/来源 | 职责 |
|---|---|---|---|
| 1 | `cors()` | `cors` | 开发/生产跨域控制 |
| 2 | `helmet()` | `helmet` | 安全响应头和 CSP |
| 3 | `compression()` | `compression` | `/api` 响应压缩 |
| 4 | `bodyParser.json/urlencoded` | `body-parser` | 请求体解析 |
| 5 | `trust proxy` | Express 配置 | 支持代理后的真实 IP |
| 6 | `accessControlMiddleware` | `middleware/accessControl.js` | IP/域名白名单 |
| 7 | 请求 ID/日志 | `server.js` | 注入 `req.id` 和响应日志 |
| 8 | cache/queue 注入 | `server.js` | 注入 `req.cacheService` 与 `req.asyncQueueService` |
| 9 | `highRiskActionGate` | `middleware/high-risk-action-gate.js` | 高风险操作确认拦截 |
| 10 | 静态资源 | `express.static` | `/uploads` 与前端 dist |
| 11 | Swagger | `swagger-ui-express` | `/api-docs` 与 `/api-docs.json` |
| 12 | `apiLimiter` | `middleware/rate-limit.js` | `/api` 全局限流 |
| 13 | 业务路由 | `routes` / `modules` | 系统、模块、旧版 API |
| 14 | 404 handler | `server.js` | 统一接口不存在响应 |
| 15 | `errorHandler` | `middleware/errorHandler.js` | 全局错误响应 |

### 5.3 路由组织

后端路由分为三类：

| 类型 | 目录/注册方式 | 说明 |
|---|---|---|
| 系统级路由 | `backend/routes/*`，直接 `app.use` | 菜单、租户、权限、审计、备份、仪表盘、模块配置、API 文档等 |
| 模块路由 | `backend/modules/*/routes`，通过 `moduleRoute()` | 新模块体系推荐路径，记录模块 ID 与 API 前缀 |
| 旧版路由 | `backend/routes/*`，通过 `deprecatedRoute()` | 保持兼容，返回弃用提示响应头，逐步迁移到模块目录 |

主要系统路由包括：

| API 前缀 | 路由文件 | 职责 |
|---|---|---|
| `/api` | `routes/health.js`, `routes/menus.js` | 健康检查、菜单 |
| `/api/roles-permissions` | `routes/roles-permissions.js` | 角色权限 |
| `/api/enhanced-permissions` | `routes/enhanced-permissions.js` | 增强权限 |
| `/api/system-config` | `routes/system-config.js` | 系统配置 |
| `/api/tenants` | `routes/tenants.js` | 租户管理 |
| `/api/tenant-module-config` | `routes/tenant-module-config.js` | 租户模块配置 |
| `/api/modules` | `routes/modules.js` | 模块管理 |
| `/api/audit-logs` | `routes/audit-logs.js` | 审计日志 |
| `/api/backup` | `routes/backup.js` | 备份管理 |
| `/api/workflow` | `routes/workflow.js` | 工作流 |
| `/api/dashboard` | `routes/dashboard.js` | 仪表盘数据 |
| `/api/api-documentation` | `routes/api-documentation.js` | API 文档数据 |
| `/api/agent-mesh` | `routes/agent-mesh.js` | Agent Mesh |

### 5.4 核心框架层

`backend/core` 是后端模块化能力的核心。

| 文件 | 关键类/函数 | 职责 |
|---|---|---|
| `BaseService.js` | `BaseService` | 服务基类，统一 DB、缓存、事件能力 |
| `DatabaseInterface.js` | `DatabaseInterface` | 数据库访问抽象，封装 query/execute/transaction/find/paginate |
| `ServiceContainer.js` | `ServiceContainer` | 依赖注入容器，支持服务、实例、工厂和父子容器 |
| `EventBus.js` | `EventBus`, `ModuleEventManager` | 模块事件发布订阅、异步事件处理 |
| `ModuleInterface.js` | `ModuleInterface` | 模块抽象接口，定义配置、服务、路由、API 暴露 |
| `ModuleManager.js` | `ModuleManager` | 注册模块、初始化服务、事件处理器 |
| `module-loader.js` | `ModuleLoader` | 扫描 `modules`，读取配置，挂载路由，暴露模块元数据接口 |
| `module-router.js` | `createModuleRouter`, `protectModuleRouter` | 创建带认证、租户、模块权限、数据隔离的模块路由 |
| `module-contract.js` | `ModuleContractManager` | 模块间接口契约与跨模块调用 |
| `data-access-guard.js` | `dataAccessGuard`, `validateSQLAccess` | 模块数据访问边界控制 |
| `route-registry.js` | `RouteRegistry` | 记录模块路由和旧版路由 |
| `service-registry.js` | `registerAllServices`, `getService` | 集中注册主要业务服务 |

### 5.5 模块加载机制

模块通常采用以下结构：

```text
backend/modules/<module-name>/
├── config/module.config.js
├── routes/index.js
├── routes/*.js
└── services/*.js
```

模块配置至少应包含：

| 字段 | 说明 |
|---|---|
| `id` | 模块唯一 ID |
| `name` | 模块名称 |
| `version` | 模块版本 |
| `backend_config` | 后端配置，包括 API 前缀、路由路径、服务、数据表等 |
| `permissions` | 模块权限定义 |
| `dependencies` | 模块依赖 |
| `features` | 功能开关 |

`ModuleLoader` 会扫描 `backend/modules`，读取每个模块的 `config/module.config.js`，按依赖顺序加载，并注册 `/api/system/modules` 供前端读取模块状态。

### 5.6 服务层

服务层分两类：

1. `backend/services/*`：跨模块共享服务、基础设施服务、兼容旧路由服务。
2. `backend/modules/*/services/*`：模块内部业务服务。

常见职责包括：

| 服务 | 职责 |
|---|---|
| `user.service.js` | 用户列表、详情、创建、更新、密码校验 |
| `inventory.service.js` | 盘点记录、开始盘点、完成盘点、删除盘点 |
| `transfer.service.js` | 调拨申请、审批、完成，完成时更新资产科室 |
| `scrapping.service.js` | 报废申请、审批、驳回、完成，完成时更新资产状态 |
| `audit-log.service.js` | 审计日志记录与查询 |
| `permission.service.js` | 角色权限、模块权限、数据范围 |
| `redis.service.js` / `redis.js` | Redis 连接、缓存、关闭与降级 |
| `cache.service.js` | 本地缓存、缓存装饰器、预热 |
| `async-queue.js` | 异步任务队列 |
| `asset-ai-analysis.js` | 资产 AI 分析 |
| `maintenance-ai-service.js` | 维修维护 AI 能力 |
| `metrology-service.js` | 计量记录、统计、到期提醒 |
| `depreciation.service.js` | 折旧计算、批量折旧、趋势与导出 |
| `wx-cloud-db.service.js` | 微信云数据库操作 |
| `shared/index.js` | 跨模块共享资产、用户、部门查询 |

---

## 6. 前端架构

### 6.1 入口与初始化

前端实际入口是 `frontend/src/main.jsx`。启动时会：

```text
main.jsx
  ├─ 初始化 crypto 缓存，最多等待 5 秒
  ├─ 初始化 Ant Design 静态 message 桥接
  ├─ 创建 React root
  ├─ React.StrictMode
  ├─ ErrorBoundary
  ├─ PageErrorBoundary
  └─ 渲染 App.jsx
```

`main.jsx` 明确导入 `./App.jsx`，因此 `App.tsx` 虽存在模块化示例结构，但不是当前主运行入口。

### 6.2 路由系统

当前主路由集中在 `frontend/src/App.jsx`，使用 `React.lazy` 懒加载页面，并通过 `Suspense` 展示加载态。

路由分为：

| 类型 | 路径 | 说明 |
|---|---|---|
| 公共路由 | `/`, `/intro`, `/login`, `/register`, `/tenant-association`, `/enterprise-select` | 不需要主布局，登录/注册/介绍页 |
| 弹窗路由 | `/popup/*` | 无侧边栏和顶部栏，复用主业务页面 |
| 受保护路由 | `/*` | 包裹 `ProtectedRoute` 与 `AppLayout` |
| 管理员路由 | `/users`, `/roles-permissions`, `/modules`, `/departments` 等 | 包裹 `AdminOnly`，仅系统管理员/超级管理员可访问 |

`frontend/src/routes/module-routes.js` 维护按模块分组的路由映射，提供 `getAllRoutes`、`getRoutesByModule`、`getPublicRoutes`、`getProtectedRoutes`。当前主应用尚未完全基于该配置动态生成路由，更多是模块化演进辅助配置。

### 6.3 页面模块

主要页面集中在 `frontend/src/pages`，部分新版模块页面在 `frontend/src/modules`。

| 模块 | 代表页面 |
|---|---|
| 登录与租户 | `Login`, `Register`, `TenantAssociation`, `EnterpriseSelect` |
| 资产 | `AssetList`, `AssetForm`, `AssetDetail`, `AssetOverview`, `AssetImages`, `AssetDocuments` |
| 盘点 | `InventoryList`, `InventoryForm`, `InventoryDetail`, `InventoryScanner`, `InventorySelfCheck` |
| 调拨/闲置 | `TransferList`, `TransferForm`, `TransferRequestList`, `IdleAssetList`, `IdleAssetForm` |
| 仪表盘 | `Dashboard`, `DashboardDesktop`, `DashboardConfigManager` |
| 用户权限 | `UserList`, `UserForm`, `RolePermissionManagement`, `EnhancedPermissionManagement` |
| 维修维护 | `MaintenanceLogList`, `MaintenanceRequestList`, `MaintenanceWorkOrderList`, `PreventiveMaintenanceList` |
| 技术文档 | `TechnicalDocumentsList`, `TechnicalDocumentsUpload`, `TechnicalDocumentsReview`, `TechnicalDocumentsAI` |
| 质量计量 | `MetrologyList`, `QualityControlList`, `QualityControlPage`, `StatisticsPage` |
| 合规 | `modules/compliance/pages/*`, `pages/compliance/*` |
| 风险 | `modules/risk/pages/*`, `pages/risk/*` |
| 人员资质 | `modules/staff/pages/*`, `pages/staff/*` |
| 开机率 | `modules/uptime/pages/*`, `pages/uptime/*` |
| IoT | `IoTDeviceManagement`, `AssetMonitoring`, `EnvironmentMonitoring`, `AssetLocationMap`, `BeaconLocation` |
| AI | `AIAssistant`, `HermesAIChat`, `AIQuestionRecords`, `AssetAIAssistant` |
| 系统 | `AuditLogsList`, `BackupManagement`, `DatabaseConnectionManagement`, `ApiDocs`, `APIDocumentation` |

### 6.4 API 通信层

核心文件是 `frontend/src/api/client.js`。

Axios 实例特性：

| 能力 | 说明 |
|---|---|
| 基础路径 | `baseURL` 为 `/api`，由 Vite/Nginx 代理到后端 |
| Token 注入 | 自动从 `auth.getToken()` 读取 token，设置 `Authorization: Bearer <token>` |
| 租户注入 | 自动解析有效租户，设置 `X-Tenant-ID` |
| 幂等键 | `POST/PUT/PATCH/DELETE` 自动补 `Idempotency-Key` |
| AI 长超时 | AI 助手相关接口提高到长超时 |
| 响应解包 | 普通响应返回 `response.data`，Blob 保留原响应 |
| 错误处理 | 401 清理登录态并跳转登录页，网络/服务错误统一提示 |
| 重试与去重 | 对部分状态码进行指数退避重试，相同请求去重 |
| 性能统计 | 记录请求耗时与成功失败统计 |

业务 API 按 domain 拆分：

| 文件 | 主要导出 |
|---|---|
| `api/domains/assets.js` | `assetAPI`, `assetImageAPI`, `inventoryAPI`, `transferAPI`, `idleAPI`, `scrappingAPI`, `depreciationAPI` |
| `api/domains/maintenance.js` | `maintenanceAPI`, `acceptanceAPI`, `qualityControlAPI`, `adverseReactionAPI`, `aiAPI` |
| `api/domains/users.js` | `userAPI`, `rolesPermissionsAPI`, `enhancedPermissionsAPI`, `tenantAPI`, `departmentsAPI` |
| `api/domains/documents.js` | `technicalDocumentsAPI`, `technicalDocumentsAI`, `auditLogsAPI`, `backupAPI` |
| `api/domains/platform.js` | `systemConfigAPI`, `moduleAPI`, `moduleConfigAPI`, `dashboardAPI`, `cloudSyncAPI`, `integrationAPI`, `menuAPI` |
| `api/domains/modules.js` | `complianceAPI`, `riskAPI`, `staffAPI`, `uptimeAPI` |

### 6.5 状态管理

项目没有使用 Redux/Zustand，主要使用 React Context、Hook 与加密本地缓存。

| 文件 | 导出 | 职责 |
|---|---|---|
| `contexts/DepartmentContext.jsx` | `DepartmentProvider`, `useDepartment` | 全局选中科室，持久化到 `localStorage.selectedDepartmentId` |
| `contexts/AppStateContext.jsx` | `AppStateProvider`, `useAppState`, `useLoading` | 全局 loading、网络状态、后端健康检查、通知 |
| `contexts/ThemeContext.jsx` | `ThemeProvider`, `useThemeMode` | light/dark 主题，URL 参数和 localStorage 持久化 |
| `core/ModuleContext.tsx` | `ModuleProvider`, `useModule` | 拉取 `/api/system/modules`，判断模块/功能是否启用 |
| `hooks/useCurrentUser.js` | `useCurrentUser` | 异步读取当前用户 |
| `hooks/useApi.js` | `useApiRequest`, `useListRequest` | 请求 loading/error/cancel/retry 与列表分页 |

当前 `App.jsx` 顶层实际使用 `DepartmentProvider`。`AppStateProvider`、`ThemeProvider`、`ModuleProvider` 已实现，但并非全部在当前主入口顶层启用。

### 6.6 权限与本地安全

| 文件 | 职责 |
|---|---|
| `components/ProtectedRoute.jsx` | 登录态检查、超级管理员放行、模块路由访问判断 |
| `utils/auth.js` | token、user、selectedEnterprise、OpenClaw 凭证读取和保存 |
| `utils/crypto.js` | 敏感数据 AES-GCM 加密存储、Base64 兼容存储、内存缓存 |
| `utils/roleUtils.js` | 角色等级、管理员判断、菜单和模块访问判断 |
| `utils/module-access.js` | 路径到模块 ID 的映射和模块访问 fallback |
| `core/module-route-guard.js` | 根据路径和启用模块判断路由可访问性 |
| `utils/menu-route-access.js` | 根据路径映射菜单 key 并判断菜单路由权限 |

---

## 7. 数据库与数据访问

### 7.1 配置来源

数据库配置来自 `backend/config/app.config.js`，实际值可由 `backend/.env` 或环境变量覆盖。模板位于 `backend/.env.example`。

常用变量：

| 变量 | 说明 |
|---|---|
| `DB_HOST` | 主库地址 |
| `DB_PORT` | 主库端口 |
| `DB_USER` | 数据库用户 |
| `DB_PASSWORD` | 数据库密码 |
| `DB_NAME` | 数据库名，默认 `zcgl` |
| `DB_READ_WRITE_SPLIT` | 是否启用读写分离 |
| `DB_USE_SLAVE_FOR_READS` | 是否读操作走从库 |
| `DB_SLAVE_HOST` / `DB_SLAVE_PORT` / `DB_SLAVE_USER` | 从库配置 |
| `REDIS_ENABLED` | 是否启用 Redis |

### 7.2 连接池与读写分离

`backend/config/database.js` 创建主库和从库连接池，同时提供 callback 风格和 Promise 风格连接池。主要能力：

| 方法 | 说明 |
|---|---|
| `execute(sql, values, options)` | 执行 SQL |
| `query(sql, values, options)` | 查询，内部代理到 execute |
| `getConnection()` | 获取主库连接 |
| `getMasterConnection()` | 获取主库连接 |
| `getSlaveConnection()` | 获取从库连接 |
| `transaction(callback)` | 执行事务 |
| `ping()` | 健康检查 |
| `end()` | 关闭连接池 |
| `getPoolStats()` | 连接池状态 |

读写分离由 `app.config.js` 中的 `database.readWriteSplit` 控制，写操作或包含写关键字的 SQL 强制走主库。

### 7.3 数据访问抽象

`backend/core/DatabaseInterface.js` 在数据库连接基础上封装：

- `query`
- `execute`
- `transaction`
- `batchInsert`
- `paginate`
- `cachedQuery`
- `insert`
- `update`
- `deleteFrom`
- `count`
- `exists`

`backend/core/BaseService.js` 又将这些能力注入业务服务，让服务类统一使用 `this.query()`、`this.execute()`、`this.transaction()`、`this.findOne()`、`this.paginate()` 等方法。

### 7.4 多租户数据模型

多租户隔离主要依赖：

- 表级 `tenant_id` 字段。
- 请求头 `X-Tenant-ID`。
- JWT 中的用户租户信息。
- 后端 `tenant-filter.js` 构建 WHERE 条件。
- 前端 `auth.getEffectiveTenantId()` 解析当前有效租户。

业务 SQL 应始终关注租户过滤，尤其是资产、用户、部门、盘点、维护、质量、IoT 等企业数据表。

### 7.5 资产标识规则

资产表 `assets` 中 `asset_id` 字段不再使用，代码应使用 `asset_code` 作为资产业务标识。调拨、报废、盘点、文档关联、标签、AI 分析等与资产关联的逻辑都应优先以 `asset_code` 为准。

---

## 8. 认证、权限与多租户

### 8.1 后端认证流程

后端认证核心在 `backend/middleware/auth.js`。

典型流程：

```text
请求进入 /api
  ├─ 读取 Authorization: Bearer <token>
  ├─ 验证 JWT
  ├─ 解析用户 ID、角色、租户信息
  ├─ 结合 X-Tenant-ID 判断当前租户上下文
  ├─ 写入 req.user / req.tenantId
  └─ 后续中间件和业务路由使用该上下文
```

常见导出：

| 函数 | 职责 |
|---|---|
| `generateToken` | 生成 JWT |
| `authenticate` | 验证请求身份 |
| `authorize` | 角色授权 |
| `requireSystemAdmin` | 系统管理员限制 |
| `requireSuperAdmin` | 超级管理员限制 |
| `restrictToOwnDepartment` | 限制访问当前部门范围 |

### 8.2 前端登录态

前端登录态由 `utils/crypto.js` 和 `utils/auth.js` 管理。

敏感 key 包括：

- `token`
- `user`
- `enterprises`
- `selectedEnterprise`
- `openclaw_credentials`

启动时 `main.jsx` 会调用 `crypto.initCache()`，将加密数据解密到内存缓存，避免页面首次权限判断反复异步解密。

### 8.3 角色体系

前端 `utils/roleUtils.js` 中维护角色工具，系统管理员角色包括：

- `super_admin`
- `system_admin`

业务角色包括资产管理员、维护工程师、质控人员、采购人员、科室用户等。不同页面和菜单通过角色、模块启用状态和菜单可见性共同决定是否可访问。

### 8.4 模块权限

后端模块路由可通过 `core/module-router.js` 自动挂载保护链：

```text
authenticate
  → tenantFilterMiddleware
  → requireModuleAccess(moduleId)
  → dataAccessGuard(moduleId)
  → moduleIsolationMiddleware(moduleId)
```

前端模块权限由以下文件协作：

| 文件 | 职责 |
|---|---|
| `utils/module-access.js` | 路径到模块 ID 的规则映射 |
| `core/module-route-guard.js` | 根据启用模块判断路由可访问性 |
| `utils/menu-route-access.js` | 菜单 key 与路由路径的访问判断 |
| `components/ProtectedRoute.jsx` | 登录、模块、菜单的总入口保护 |

---

## 9. 主要业务模块

### 9.1 后端模块清单

当前 `backend/modules` 下包含以下配置化模块：

| 模块目录 | 模块 ID | 名称 | API 前缀/说明 | 主要数据表 |
|---|---|---|---|---|
| `asset-management` | `asset-management` | 库存管理 | 资产主模块 | `assets`, `asset_categories`, `asset_locations`, `asset_images` |
| `user-management` | `user-management` | 用户管理 | 用户、角色、租户角色 | `users`, `user_roles`, `user_tenant_roles`, `super_users` |
| `department-management` | `department-management` | 部门管理 | 部门树与部门 CRUD | `departments` |
| `inventory-management` | `inventory-management` | 盘点管理 | 盘点计划、记录、扫描 | `inventory_records`, `inventory_details`, `inventory_scan_logs` |
| `maintenance-management` | `maintenance-management` | 日常维修 | 维修记录、工单、申请、费用 | `maintenance_logs`, `maintenance_workorders`, `maintenance_requests` |
| `preventive-maintenance-management` | `preventive-maintenance-management` | 预防性维护 | 预防性维护计划与提醒 | `preventive_maintenance_plans`, `maintenance_templates`, `maintenance_reminders` |
| `procurement-management` | `procurement-management` | 采购管理 | 采购申请与附件 | `procurement_requests`, `procurement_files` |
| `depreciation-management` | `depreciation-management` | 折旧管理 | 折旧计算与资产价值 | `assets` |
| `quality-control` | `quality-control` | 计量管理 | 计量与质控记录 | `metrology_records`, `quality_control_records` |
| `quality-assurance-management` | `quality-assurance-management` | 质控管理 | 质量记录、附件、周期 | `quality_control_records`, `quality_management_cycles` |
| `quality-common` | `quality-common` | 平台公共能力 | 质量模块公共权限、字典、日志 | `quality_permissions`, `quality_dictionary_items`, `quality_logs` |
| `compliance-management` | `compliance-management` | 合规性管理 | `/api/compliance` | `maintenance_level_templates`, `preventive_maintenance_plans` |
| `safety-inspection-management` | `safety-inspection-management` | 安全检测管理 | `/api/safety-inspection` | `safety_inspections` |
| `special-equipment-management` | `special-equipment-management` | 特种设备管理 | `/api/special-equipment` | `special_equipment`, `special_equipment_inspections` |
| `asset-risk-management` | `asset-risk-management` | 风险管理 | `/api/risk` | `asset_risk_levels`, `risk_control_measures`, `risk_assessment_records` |
| `staff-qualification` | `staff-qualification` | 人员资质管理 | `/api/staff` | `staff_qualifications`, `staff_training_records` |
| `uptime-management` | `uptime-management` | 开机率管理 | `/api/uptime` | `uptime_statistics`, `asset_operation_logs`, `operation_logs` |
| `iot-management` | `iot-management` | 物联网管理 | IoT 综合模块 | `iot_devices`, `iot_device_connectors`, `asset_locations` |
| `iot-asset-monitoring-management` | `iot-asset-monitoring-management` | 资产监测模块 | `/api/iot-asset-monitoring` | `iot_asset_monitor_ts` |
| `iot-environment-monitoring-management` | `iot-environment-monitoring-management` | 环境监测模块 | `/api/iot-environment-monitoring` | `iot_environment_monitor_ts` |
| `iot-geo-location-management` | `iot-geo-location-management` | 地理定位模块 | `/api/iot-geo-location` | `iot_geo_location_ts` |
| `iot-zone-location-management` | `iot-zone-location-management` | 区域定位模块 | `/api/iot-zone-location` | `iot_zone_location_ts`, `asset_locations` |
| `technical-documents` | `technical-documents` | 技术资料管理 | 技术资料上传、审核、分享 | `technical_documents`, `technical_document_asset_relations` |
| `label-management` | `label-management` | 标签管理 | 标签模板与打印队列 | `asset_label_templates`, `asset_label_print_queue` |
| `asset-usage-management` | `asset-usage-management` | 资产使用管理 | 资产使用记录 | `asset_usage_records` |
| `asset-ai-assistant` | `asset-ai-assistant` | 资产AI助手 | 资产 AI 问答与分析 | 依赖后端 AI 能力 |
| `ct-maintenance-assistant-management` | `ct-maintenance-assistant-management` | CT维护助手模块 | CT 维护辅助 | 依赖 AI/维护数据 |
| `message-integration` | `message-integration` | 消息平台集成 | 集成通道配置与绑定日志 | `integration_channel_configs`, `integration_binding_logs` |
| `sms-notification` | `sms-notification` | 短信通知 | 短信记录与模板 | `sms_notification_records`, `sms_notification_templates` |
| `adverse-event` | `adverse-event` | 不良事件 | 不良反应、根因分析、预防措施 | `adverse_reaction_records`, `root_cause_analyses` |
| `dingtalk-binding` | `dingtalk-binding` | 钉钉绑定 | 第三方账号绑定 | `dingtalk_binding` |
| `feishu-binding` | `feishu-binding` | 飞书绑定 | 第三方账号绑定 | `feishu_binding` |
| `wechat-binding` | `wechat-binding` | 微信绑定 | 第三方账号绑定 | `wechat_binding` |

### 9.2 前端模块映射

前端模块主要由路由、页面和 API domain 共同构成。

| 前端功能域 | 页面目录 | API domain | 后端对应 |
|---|---|---|---|
| 资产 | `pages/asset`, `pages/Asset*` | `api/domains/assets.js` | `asset-management`, `routes/assets/*` |
| 盘点 | `pages/Inventory*` | `inventoryAPI` | `inventory-management`, `routes/inventory*` |
| 调拨/闲置/报废 | `pages/Transfer*`, `Idle*` | `transferAPI`, `idleAPI`, `scrappingAPI` | `transfer`, `idle`, `scrapping` 相关服务/路由 |
| 维修维护 | `pages/Maintenance*`, `PreventiveMaintenance*` | `maintenanceAPI` | `maintenance-management`, `preventive-maintenance-management` |
| 质量计量 | `pages/quality-control`, `pages/Metrology*`, `QualityControl*` | `qualityControlAPI` | `quality-control`, `quality-assurance-management` |
| 合规 | `modules/compliance`, `pages/compliance` | `complianceAPI` | `compliance-management`, `safety-inspection-management`, `special-equipment-management` |
| 风险 | `modules/risk`, `pages/risk` | `riskAPI` | `asset-risk-management` |
| 人员 | `modules/staff`, `pages/staff` | `staffAPI` | `staff-qualification` |
| 开机率 | `modules/uptime`, `pages/uptime` | `uptimeAPI` | `uptime-management` |
| IoT | `IoTDeviceManagement`, `AssetMonitoring`, `EnvironmentMonitoring` | `iotDeviceAPI` 与模块 API | `iot-management` 与 IoT 子模块 |
| 技术文档 | `TechnicalDocuments*` | `technicalDocumentsAPI` | `technical-documents` |
| 系统平台 | `Tenant*`, `Module*`, `Audit*`, `Backup*` | `platform.js`, `users.js`, `documents.js` | 系统路由 |

---

## 10. 关键类、函数与服务

### 10.1 后端核心类

#### `BaseService`

位置：`backend/core/BaseService.js`

职责：

- 统一保存服务名、数据库、缓存、事件总线引用。
- 提供数据库快捷方法：`query`, `execute`, `transaction`, `findOne`, `findMany`, `paginate`。
- 提供缓存快捷方法：`cacheGet`, `cacheSet`, `cacheDelete`。
- 提供事件方法：`emitEvent`, `onEvent`。

适用场景：新业务服务建议继承该类，保证数据库、缓存和事件行为一致。

#### `DatabaseInterface`

位置：`backend/core/DatabaseInterface.js`

职责：

- 封装底层数据库连接。
- 提供查询、执行、事务、批量插入、分页、缓存查询等能力。
- 提供 `getInstance()` 单例模式。

#### `ServiceContainer`

位置：`backend/core/ServiceContainer.js`

职责：

- 注册服务、实例和工厂函数。
- 解析单例服务。
- 支持父子容器和资源释放。

典型用途：`service-registry.js` 将数据库、事件总线和业务服务集中注册到容器。

#### `EventBus`

位置：`backend/core/EventBus.js`

职责：

- 模块间事件发布订阅。
- 支持异步事件处理。
- `ModuleEventManager` 为模块级事件提供更清晰的命名空间。

#### `ModuleLoader`

位置：`backend/core/module-loader.js`

职责：

- 扫描 `backend/modules`。
- 读取并校验模块配置。
- 按依赖加载模块。
- 加载模块路由。
- 注册 `/api/system/modules`。

#### `ModuleContractManager`

位置：`backend/core/module-contract.js`

职责：

- 管理模块间接口契约。
- 注册接口实现。
- 通过契约调用跨模块能力。

#### `dataAccessGuard`

位置：`backend/core/data-access-guard.js`

职责：

- 对模块 SQL 访问边界做检查。
- 降低模块越界访问其他模块数据表的风险。

### 10.2 后端关键中间件

| 中间件 | 文件 | 关键能力 |
|---|---|---|
| `authenticate` | `middleware/auth.js` | JWT 验证、用户上下文 |
| `authorize` | `middleware/auth.js` | 角色授权 |
| `tenantFilterMiddleware` | `middleware/tenant-filter.js` | 租户上下文、租户过滤 |
| `requireModuleAccess` | `middleware/module-permission.js` | 模块访问权限 |
| `apiLimiter` | `middleware/rate-limit.js` | API 限流 |
| `highRiskActionGate` | `middleware/high-risk-action-gate.js` | 高风险操作确认 |
| `accessControlMiddleware` | `middleware/accessControl.js` | IP/域名白名单 |
| `fileSecurity` | `middleware/fileSecurity.js` | 上传文件安全检查 |
| `errorHandler` | `middleware/errorHandler.js` | 统一错误响应 |
| `deprecatedRoute` | `middleware/route-deprecation.js` | 旧路由兼容与弃用提示 |
| `moduleRoute` | `middleware/route-deprecation.js` | 模块路由注册记录 |

### 10.3 前端关键函数与组件

| 文件 | 函数/组件 | 职责 |
|---|---|---|
| `src/main.jsx` | `initWithTimeout` | 初始化加密缓存，超时后继续渲染 |
| `src/App.jsx` | `App` | 当前主路由和布局入口 |
| `src/App.jsx` | `AdminOnly` | 管理员路由保护 |
| `components/ProtectedRoute.jsx` | `ProtectedRoute` | 登录态、模块权限、菜单权限保护 |
| `api/client.js` | `api` | axios 实例 |
| `api/client.js` | `buildApiUrl` | 构建 API URL |
| `api/client.js` | `getApiErrorMessage` | 统一错误消息提取 |
| `api/client.js` | `apiWithBatching`, `smartApi` | 请求去重、批处理、重试 |
| `api/normalizers.js` | `normalizeListResult` | 统一列表响应结构 |
| `hooks/useApi.js` | `useApiRequest` | 通用 API 请求 Hook |
| `hooks/useApi.js` | `useListRequest` | 列表分页请求 Hook |
| `utils/auth.js` | `getEffectiveTenantId` | 解析当前有效租户 |
| `utils/crypto.js` | `initCache` | 启动时解密敏感本地数据 |
| `utils/roleUtils.js` | `isAdminRole`, `isSuperAdmin` | 角色判断 |
| `core/module-route-guard.js` | `checkRouteAccess` | 模块路由访问判断 |

---

## 11. 依赖关系与调用链路

### 11.1 前端到后端调用链

```text
页面组件 pages/* 或 modules/*
  ├─ 调用 api/domains/* 中的业务 API
  ├─ 业务 API 调用 api/client.js 的 axios 实例
  ├─ 请求拦截器注入 Authorization、X-Tenant-ID、Idempotency-Key
  ├─ Vite proxy 或 Nginx 将 /api 转发到后端
  ├─ Express 全局中间件处理安全、限流、租户、权限
  ├─ 进入 routes/* 或 modules/*/routes
  ├─ 调用 services/* 或 modules/*/services
  ├─ 通过 BaseService / DatabaseInterface / db-helper 访问 MySQL
  └─ 响应拦截器解包 response.data 并统一错误处理
```

### 11.2 后端模块依赖链

```text
server.js
  ├─ moduleRoute(path, moduleId, router)
  ├─ RouteRegistry 记录路由归属
  ├─ ModuleLoader 扫描模块配置
  ├─ ModuleManager 管理模块生命周期
  ├─ ServiceContainer 注入共享服务
  ├─ ModuleContractManager 支持跨模块调用
  └─ EventBus 支持模块事件通信
```

### 11.3 权限依赖链

```text
前端登录
  ├─ token/user 存入 crypto 加密缓存
  ├─ ProtectedRoute 读取 token/user
  ├─ auth.getEffectiveTenantId 解析租户
  ├─ api/client 注入 Authorization 和 X-Tenant-ID
  ▼
后端请求
  ├─ authenticate 验证 JWT
  ├─ tenantFilterMiddleware 解析租户上下文
  ├─ requireModuleAccess 判断模块权限
  ├─ dataAccessGuard 限制模块数据访问
  └─ 服务层 SQL 加入 tenant_id 条件
```

### 11.4 部署依赖链

```text
本地开发
  ├─ backend: node/nodemon + MySQL + 可选 Redis
  └─ frontend: Vite dev server + /api 代理

Docker 轻量部署
  ├─ backend container 读取 backend/.env
  └─ frontend container 依赖 backend healthcheck

Docker 生产部署
  ├─ mysql container
  ├─ redis container
  ├─ backend container 依赖 mysql/redis
  ├─ frontend container 依赖 backend
  └─ nginx container 反向代理 frontend/backend
```

---

## 12. 项目运行方式

### 12.1 前置依赖

建议准备：

- Node.js 20+
- npm
- MySQL 8 或兼容版本
- Redis，可选
- Docker 与 Docker Compose，可选
- Go，用于构建 `tools/mcp-assethub`
- Electron 运行环境，用于 `ServiceManager`

### 12.2 安装依赖

根目录只有聚合脚本和 husky/lint-staged。前后端依赖分别安装：

```bash
cd /Volumes/移动硬盘（500）/AssetHub/backend
npm install

cd /Volumes/移动硬盘（500）/AssetHub/frontend
npm install
```

如需根目录脚本：

```bash
cd /Volumes/移动硬盘（500）/AssetHub
npm install
```

### 12.3 配置后端环境变量

复制模板：

```bash
cd /Volumes/移动硬盘（500）/AssetHub/backend
cp .env.example .env
```

至少确认：

```text
NODE_ENV=development
PORT=5183
SERVER_HOST=0.0.0.0
FRONTEND_URL=http://localhost:13579
JWT_SECRET=<强随机密钥>
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=<数据库密码>
DB_NAME=zcgl
REDIS_ENABLED=false
```

### 12.4 初始化数据库

后端提供脚本：

```bash
cd /Volumes/移动硬盘（500）/AssetHub/backend
npm run init-db
npm run migrate
```

也可以使用部署目录中的初始化 SQL，例如 `deploy-local/env/init-schema.sql`、`deploy-local/env/init-seed-data.sql`。

### 12.5 启动开发环境

根目录聚合启动：

```bash
cd /Volumes/移动硬盘（500）/AssetHub
npm run dev
```

分别启动：

```bash
cd /Volumes/移动硬盘（500）/AssetHub/backend
npm run dev
```

```bash
cd /Volumes/移动硬盘（500）/AssetHub/frontend
npm run dev
```

默认端口：

| 服务 | 默认端口 | 说明 |
|---|---:|---|
| 后端 | 5183 | `backend/.env` 中 `PORT` |
| 前端开发 | 13579 | `frontend/vite.config.js` 中默认 `VITE_FRONTEND_PORT` |
| 前端预览 | 80 或配置端口 | `vite preview` |

前端 Vite 默认将 `/api`、`/api/health`、`/uploads` 代理到 `VITE_BACKEND_URL`，未配置时默认 `http://127.0.0.1:5183`。

### 12.6 构建

根目录：

```bash
cd /Volumes/移动硬盘（500）/AssetHub
npm run build
```

前端：

```bash
cd /Volumes/移动硬盘（500）/AssetHub/frontend
npm run build
```

后端没有编译步骤，生产运行命令是：

```bash
cd /Volumes/移动硬盘（500）/AssetHub/backend
npm start
```

---

## 13. 部署与运维

### 13.1 根目录轻量 Docker Compose

文件：`docker-compose.yml`

包含：

- `backend`：构建 `backend/Dockerfile`，读取 `backend/.env`，映射 `25183:5183`。
- `frontend`：构建 `frontend/Dockerfile`，依赖 backend 健康检查，映射 `25379:80`。

命令：

```bash
cd /Volumes/移动硬盘（500）/AssetHub
docker-compose up -d --build
```

查看日志：

```bash
docker-compose logs -f backend
docker-compose logs -f frontend
```

停止：

```bash
docker-compose down
```

### 13.2 生产完整 Docker Compose

文件：`docker-compose.prod.yml`

包含：

- MySQL 8
- Redis 7
- backend
- frontend
- 可选 nginx

命令示例：

```bash
cd /Volumes/移动硬盘（500）/AssetHub
docker-compose -f docker-compose.prod.yml up -d --build
```

### 13.3 deploy-local

文件：`deploy-local/docker-compose.yml`

特点：

| 服务 | 映射端口 |
|---|---:|
| MySQL | 13306 |
| Redis | 16379 |
| backend | 15183 |
| frontend | 15379 |

适合本地一体化验证。

### 13.4 deploy-fnnas

文件：`deploy-fnnas/docker-compose.yml`

特点：

- 面向飞牛 NAS / fnOS。
- 前端映射端口为 `5666`。
- 后端支持通过 `host.docker.internal` 访问宿主机 OpenClaw。

### 13.5 前后端 Dockerfile

后端 `backend/Dockerfile`：

- 基于 `node:20-alpine`。
- 安装生产依赖。
- 拷贝后端代码。
- 暴露 `5183`。
- 执行 `node server.js`。

前端 `frontend/Dockerfile`：

- 第一阶段使用 Node 构建 Vite dist。
- 第二阶段使用 Nginx 托管 `/usr/share/nginx/html`。
- 拷贝 `frontend/nginx/default.conf`。
- 暴露 `80`。

---

## 14. 辅助子系统

### 14.1 ServiceManager

目录：`ServiceManager/`

ServiceManager 是 Electron 桌面服务管理器，用于本机启动、停止、重启、监控 AssetHub 前后端服务，并提供数据库配置读写、数据库连接测试、Redis 检查等能力。

运行：

```bash
cd /Volumes/移动硬盘（500）/AssetHub/ServiceManager
npm install
npm start
```

构建：

```bash
npm run build:mac
npm run build:win
npm run build:all
```

关键文件：

| 文件 | 职责 |
|---|---|
| `main.js` | Electron 主进程，管理服务进程、配置、IPC |
| `preload.js` | 安全桥接 renderer 与主进程 IPC |
| `renderer.js` | UI 交互逻辑 |
| `package.json` | Electron 启动与打包配置 |

ServiceManager 不走 Docker，它会直接在本机执行后端 `node server.js` 和前端 `npm run dev` 或 `npm run preview`。

### 14.2 ServiceManagerTauri

目录：`ServiceManagerTauri/`

Tauri 版本是桌面服务管理器的轻量备选实现，包含前端资源和 Rust/Tauri 配置。可根据其 README 和 package 脚本启动开发或构建。

### 14.3 tools/mcp-assethub

目录：`tools/mcp-assethub/`

这是 Go 实现的 AssetHub MCP Server，用于把 AssetHub HTTP API 封装成 MCP 工具，供 OpenCode、Cursor 或其他 AI 代理通过 stdio 调用。

构建：

```bash
cd /Volumes/移动硬盘（500）/AssetHub/tools/mcp-assethub
go build -o mcp-assethub .
```

运行方式一：用户名密码登录

```bash
export ASSETHUB_API_URL=http://localhost:5183/api
export ASSETHUB_USERNAME=admin
export ASSETHUB_PASSWORD=your-password
./mcp-assethub
```

运行方式二：JWT Token

```bash
export ASSETHUB_API_URL=http://localhost:5183/api
export ASSETHUB_TOKEN=your-jwt-token
./mcp-assethub
```

主要环境变量：

| 变量 | 说明 |
|---|---|
| `ASSETHUB_API_URL` | AssetHub API 地址，默认 `http://localhost:5183/api` |
| `ASSETHUB_TOKEN` | JWT Token |
| `ASSETHUB_USERNAME` / `ASSETHUB_PASSWORD` | 登录凭据 |
| `ASSETHUB_TENANT_ID` | 默认租户 ID |
| `ASSETHUB_TOOL_PREFIX` | 工具名前缀，默认 `assethub` |
| `ASSETHUB_RUNTIME_AUTH_STORE_DIR` | 运行时短期认证上下文目录 |

关键文件：

| 文件 | 职责 |
|---|---|
| `main.go` | 入口，加载配置、创建 API client、启动 MCP server |
| `config.go` | 环境变量解析 |
| `client.go` | AssetHub HTTP API Client、登录、租户、运行时鉴权 |
| `server.go` | MCP JSON-RPC/stdin/stdout 协议、工具注册与调用 |
| `tool_handlers.go` | 工具实现，转发到后端 API |
| `tools_*.go` | 工具定义和业务分类 |
| `metrics.go` | MCP 请求指标 |

### 14.4 microservices

目录：`microservices/`

该目录是微服务化演进骨架，当前不是主运行路径。已有内容包括共享认证、租户过滤和配置服务，但缺少完整 package 脚本和部分服务入口实现。

现状判断：

- `microservices/shared/auth.js` 可作为微服务认证中间件。
- `microservices/shared/tenant-filter-factory.js` 可构建租户过滤中间件和 SQL 条件。
- `microservices/shared/config-service.js` 提供轻量数据库、Redis、JWT 配置读取。
- `api-gateway/src/index.js` 和 `user-service/src/index.js` 当前引用上级 `../index`，但磁盘上缺少对应实现。

因此，当前应将 `microservices/` 视为架构演进参考，而非完整可运行服务体系。

---

## 15. 测试、代码规范与质量保障

### 15.1 根目录脚本

| 命令 | 说明 |
|---|---|
| `npm run dev` | 同时启动后端和前端开发服务 |
| `npm run dev:backend` | 启动后端开发服务 |
| `npm run dev:frontend` | 启动前端开发服务 |
| `npm run build` | 构建前端 |
| `npm run lint` | 依次运行后端和前端 lint |
| `npm run test` | 依次运行后端和前端测试 |
| `npm run format` | 格式化后端和前端文件 |
| `npm run audit:routes` | 后端路由挂载审计 |
| `npm run audit:docs` | 后端 API 文档覆盖审计 |
| `npm run migrate` | 后端数据库迁移 |

### 15.2 后端脚本

| 命令 | 说明 |
|---|---|
| `npm start` | `node server.js` |
| `npm run dev` | `nodemon server.js` |
| `npm run lint` | ESLint 检查 JS |
| `npm run lint:fix` | 自动修复 ESLint |
| `npm run format` | Prettier 格式化 |
| `npm test` | Jest 测试 |
| `npm run test:coverage` | Jest 覆盖率 |
| `npm run migrate` | 数据库迁移 |
| `npm run init-db` | 初始化数据库 |
| `npm run import-assets` | 导入资产 |

### 15.3 前端脚本

| 命令 | 说明 |
|---|---|
| `npm run dev` | Vite 开发服务 |
| `npm run build` | Vite 构建 |
| `npm run preview` | Vite 预览，端口 4000 |
| `npm run lint` | ESLint 检查 JS/JSX |
| `npm run lint:fix` | 自动修复 ESLint |
| `npm run format` | Prettier 格式化 src |
| `npm run test` | Vitest 测试 |
| `npm run test:coverage` | Vitest 覆盖率 |
| `npm run test:ui` | Vitest UI |

### 15.4 测试目录

| 目录 | 说明 |
|---|---|
| `backend/tests/unit` | 后端单元测试 |
| `backend/tests/api` | 后端 API/E2E 测试 |
| `backend/test` | 历史测试脚本 |
| `frontend/tests/api` | 前端 API client 测试 |
| `frontend/tests/components` | 前端组件测试 |
| `frontend/tests/utils` | 前端工具函数测试 |

---

## 16. 开发导航

### 16.1 想了解后端启动

优先阅读：

1. `backend/server.js`
2. `backend/config/app.config.js`
3. `backend/config/database.js`
4. `backend/middleware/auth.js`
5. `backend/middleware/tenant-filter.js`

### 16.2 想新增后端业务模块

优先阅读：

1. `backend/core/module-loader.js`
2. `backend/core/module-router.js`
3. `backend/core/BaseService.js`
4. `backend/modules/asset-management/config/module.config.js`
5. `backend/modules/<existing-module>/routes/index.js`
6. `docs/module-development-guide.md`

建议步骤：

1. 在 `backend/modules/<module-name>/config/module.config.js` 定义模块元数据。
2. 在 `routes/index.js` 或子路由文件中定义 API。
3. 在 `services/` 中封装业务逻辑，优先继承 `BaseService`。
4. 在需要模块级保护时使用 `createModuleRouter` 或 `protectModuleRouter`。
5. 为 SQL 加入租户条件，资产关联优先使用 `asset_code`。
6. 更新前端 API domain 和页面路由。

### 16.3 想了解前端启动与路由

优先阅读：

1. `frontend/src/main.jsx`
2. `frontend/src/App.jsx`
3. `frontend/src/components/ProtectedRoute.jsx`
4. `frontend/src/routes/module-routes.js`
5. `frontend/src/core/module-route-guard.js`
6. `frontend/src/utils/module-access.js`

### 16.4 想新增前端页面

建议步骤：

1. 在 `frontend/src/pages` 或 `frontend/src/modules/<module>/pages` 添加页面组件。
2. 在 `frontend/src/api/domains/*` 中补充 API 方法。
3. 在 `frontend/src/App.jsx` 添加懒加载和路由。
4. 如需模块权限，在 `module-access.js`、`module-route-guard.js` 或菜单权限中补充映射。
5. 对列表接口优先使用 `normalizeListResult` 或 `useListRequest` 统一分页结构。

### 16.5 想排查 API 问题

排查顺序：

1. 前端 Network 面板确认请求 URL、Header、状态码。
2. 检查 `Authorization` 和 `X-Tenant-ID` 是否正确注入。
3. 查看 `frontend/src/api/client.js` 的拦截器错误处理。
4. 查看后端 `server.js` 路由挂载顺序。
5. 查看对应 `backend/routes/*` 或 `backend/modules/*/routes/*`。
6. 查看服务层 SQL 是否包含正确租户过滤。
7. 查看 `backend/logs` 或后端控制台日志。

### 16.6 想排查权限问题

排查顺序：

1. 前端 `crypto` 缓存中的 `token`、`user`、`selectedEnterprise`。
2. `auth.getEffectiveTenantId()` 返回值。
3. `ProtectedRoute` 是否拦截。
4. `module-access.js` 路由前缀是否映射到正确模块。
5. 后端 `authenticate` 是否正确解析 JWT。
6. 后端 `tenantFilterMiddleware` 是否得到正确租户。
7. 后端 `requireModuleAccess` 是否允许当前模块。
8. 数据服务 SQL 是否使用正确 `tenant_id`。

### 16.7 关键源码入口索引

| 目标 | 文件 |
|---|---|
| 后端主入口 | `backend/server.js` |
| 后端配置 | `backend/config/app.config.js` |
| 数据库连接 | `backend/config/database.js` |
| 服务基类 | `backend/core/BaseService.js` |
| 模块加载 | `backend/core/module-loader.js` |
| 模块路由保护 | `backend/core/module-router.js` |
| 认证中间件 | `backend/middleware/auth.js` |
| 租户过滤 | `backend/middleware/tenant-filter.js` |
| 前端入口 | `frontend/src/main.jsx` |
| 前端主路由 | `frontend/src/App.jsx` |
| 前端 API Client | `frontend/src/api/client.js` |
| 前端 API Domain | `frontend/src/api/domains/*` |
| 前端路由保护 | `frontend/src/components/ProtectedRoute.jsx` |
| 前端加密缓存 | `frontend/src/utils/crypto.js` |
| 前端认证工具 | `frontend/src/utils/auth.js` |
| 前端模块权限 | `frontend/src/utils/module-access.js` |
| Docker 轻量部署 | `docker-compose.yml` |
| Docker 生产部署 | `docker-compose.prod.yml` |
| Electron 管理器 | `ServiceManager/main.js` |
| MCP Server | `tools/mcp-assethub/main.go` |

---

本文档基于当前仓库代码生成，用于快速理解 AssetHub 的架构、模块、依赖、关键类函数和运行方式。后续新增模块、路由或部署方式时，应同步更新本文档。
