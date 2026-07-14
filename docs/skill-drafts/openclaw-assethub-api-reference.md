# OpenClaw AssetHub 全量 API 调用参考

> 用途：本文件作为 OpenClaw skill 作者编写 `assethub` 工具描述时的路由蓝图。每个端点列出 HTTP 方法、完整路径、中间件约束、关键参数、响应要点与权限说明，便于直接生成符合 OpenClaw 规范的 tool descriptor。
>
> 数据来源：`backend/server.js`（路由挂载）、`backend/routes/**`、`backend/modules/**/routes/**` 中 `router.METHOD(path, ...)` 的实际定义、`docs/API_全量接口说明_供AI读取.md`（运行时汇总）、`backend/.env`（数据库/连接配置）。
>
> 端点总数：约 688 个，覆盖 60+ 模块。本文件按业务模块分组列出，每个端点描述 2–6 行。

---

## 0. 概览与全局约定

### 0.1 Base URL
- 所有业务接口前缀：`/api`（开发示例：`http://localhost:5183/api`）
- 健康检查例外：`/alive`、`/ready`、`/health`（无 `/api` 前缀）

### 0.2 认证方式
- 默认 `Authorization: Bearer <JWT>`，由 `backend/middleware/auth.js` 的 `authenticate` 校验。
- 公开端点（无需 Bearer）：`/api/users/login`、`/api/users/register`、`/api/users/refresh-token`（部分）、`/api/tendering/public/*`、`/api/assets/share/:token` 等。
- IoT 设备上行：`/api/iot/*/ingest`、`/api/iot/*/ingest/batch` 多采用设备 token + `X-IoT-Token` 头，不使用用户 JWT。

### 0.3 租户上下文（多租户隔离）
- 普通用户：租户从 JWT 推断，无需额外头。
- `super_admin`：需通过查询参数 `?tenant_id=<id>` 或请求头 `X-Tenant-ID` 显式指定租户，否则后端返回 `400 TENANT_REQUIRED`。
- 写入端点大多挂载 `requireTenantId` 中间件（缺租户直接 400）。
- `requireSystemAdmin`：限定 `system_admin` 角色（多用于租户/角色/菜单/系统配置管理）。
- `requireSuperAdmin`：限定 `super_admin`（数据库连接、备份等系统级操作）。

### 0.4 统一响应格式
```json
{ "success": true,  "data": { /* payload */ }, "timestamp": "ISO8601" }
{ "success": false, "message": "错误信息", "code": "ERROR_CODE", "path": "...", "method": "..." }
```
列表端点通常返回 `{ success, data: { list, total, page, pageSize }, pagination }` 或 `{ success, data: [...], pagination }`。

### 0.5 限流
- `loginLimiter`：登录/刷新接口。
- `registerLimiter`：注册接口。
- `apiLimiter`：全局 API 限流（每分钟请求数受环境变量配置）。
- 触发 429：`{ success:false, code:"RATE_LIMITED", message:"请求过于频繁" }`。

### 0.6 高危操作网关（highRiskActionGate）
- 通过后端中间件对破坏性/跨表写入做二次确认。
- 触发条件：删除、报废、转移、审批等。
- 响应：`HTTP 428`、`{ success:false, code:"HIGH_RISK_CONFIRMATION_REQUIRED", message, data:{ action, target, hint } }`。
- 客户端回放：必须携带显式确认标记（如 `ASSETHUB_HIGH_RISK_CONFIRM=YES` 或 body/header `confirm:true`），同一 `Idempotency-Key` 仅可重放一次。
- 维修申请安全入口：`POST /api/maintenance/ai/submit-request` 不走 highRiskActionGate（AI/skill 提交）。

### 0.7 审计日志
- `auditLogger(action, resource)` 中间件记录关键写操作（创建/更新/删除/审批）。
- 写入 `audit_logs` 表，可通过 `/api/audit-logs` 与 `/api/audit-logs-enhanced` 查询。

### 0.8 缓存与幂等
- 列表/统计接口默认无服务端缓存；OpenClaw skill 端建议缓存 `permission_definitions`、`roles`、`modules`、`categories/tree` 等低频变更数据。
- 写入必须携带 `Idempotency-Key` 头（推荐 UUID v4），跨重试保持一致可避免重复创建。

### 0.9 数据库连接
- 不硬编码任何连接字符串；统一读取 `backend/.env`（参见 `project_rules.md`）。

---

## 1. 认证与会话 (`/api/users`)

| 方法 | 路径 | 中间件 | 说明 |
|---|---|---|---|
| `POST` | `/api/users/login` | `loginLimiter` | 用户名/密码登录，返回 JWT 与 `tenant_id`、`role`、`permissions`。 |
| `POST` | `/api/users/register` | `registerLimiter` | 注册用户（通常仅 `super_admin` 调用或公开注册）。 |
| `POST` | `/api/users/refresh-token` | `authenticate` | 刷新 JWT。 |
| `POST` | `/api/users/logout` | `authenticate` | 注销（注销当前会话；服务端写入审计日志）。 |
| `GET` | `/api/users/me` | `authenticate` | 当前用户信息（与 `/profile` 同义）。 |
| `GET` | `/api/users/profile` | `authenticate` | 获取当前用户详情与角色。 |
| `PUT` | `/api/users/me` / `/api/users/profile` | `authenticate` | 更新个人资料。 |
| `PUT` | `/api/users/me/change-password` | `authenticate` | 修改当前用户密码。 |
| `PUT` | `/api/users/:id/change-password` | `authenticate` | 管理员/本人重置指定用户密码。 |
| `GET` | `/api/users/roles` | `authenticate` | 当前用户可见角色列表（按租户/系统过滤）。 |
| `GET` | `/api/users/pending` | `authenticate` + `authorize(['system_admin'])` | 待审批用户列表。 |
| `PUT` | `/api/users/:id/approve` | `authenticate` + `authorize(['system_admin'])` | 审批通过/拒绝用户加入。 |
| `GET` | `/api/users/role-requests/pending` | `authenticate` + `authorize(['system_admin'])` | 待审批角色申请。 |
| `PUT` | `/api/users/role-requests/:id/approve` | `authenticate` + `authorize(['system_admin'])` | 审批角色申请。 |
| `GET` | `/api/users/unconfigured` | `authenticate` + `authorize(['system_admin','asset_admin','department_admin'])` | 未分配角色/部门用户。 |
| `GET` | `/api/users/role-stats` | `authenticate` + `authorize(['system_admin','asset_admin','department_admin'])` | 角色分布统计。 |
| `POST` | `/api/users/batch-assign-role` | `authenticate` + `authorize(['system_admin'])` | 批量分配角色。 |
| `POST` | `/api/users/join-enterprise` | `authenticate` | 当前用户申请加入企业/租户。 |
| `GET` | `/api/users` | `authenticate` + `authorize('manage_users')` | 用户列表（分页、过滤）。 |
| `POST` | `/api/users` | `authenticate` + `authorize('manage_users')` | 创建用户。 |
| `GET` | `/api/users/by-username/:username` | `authenticate` | 按用户名查找。 |
| `GET` | `/api/users/:id` | `authenticate` + `authorize('manage_users')` | 用户详情。 |
| `PUT` | `/api/users/:id` | `authenticate` | 更新用户。 |
| `DELETE` | `/api/users/:id` | `authenticate` + `authorize('manage_users')` | 删除/停用用户。 |
| `GET` | `/api/users/:id/roles` | `authenticate` + `requireSystemAdmin` | 查看用户在指定租户的角色。 |
| `POST` | `/api/users/:id/roles` | `authenticate` + `requireSystemAdmin` | 分配角色。 |
| `DELETE` | `/api/users/:id/roles/:tenantId` | `authenticate` + `requireSystemAdmin` | 撤销角色。 |
| `GET` | `/api/users/export` | `authenticate` + `authorize('manage_users')` | 导出用户清单。 |

> 短信验证（`/api/sms-verification`，见第 14 节）配合注册/找回密码使用。

---

## 2. 租户与企业空间

### 2.1 `/api/tenants`
| 方法 | 路径 | 中间件 | 说明 |
|---|---|---|---|
| `GET` | `/api/tenants` | `authenticate` + `requireSystemAdmin` | 租户列表（仅系统管理员）。 |
| `POST` | `/api/tenants` | `authenticate` + `requireSystemAdmin` | 创建租户（企业空间）。 |
| `GET` | `/api/tenants/:id` | `authenticate` | 租户详情。 |
| `PUT` | `/api/tenants/:id` | `authenticate` + `requireSystemAdmin` | 更新租户信息。 |
| `DELETE` | `/api/tenants/:id` | `authenticate` + `requireSystemAdmin` | 停用/删除租户。 |

### 2.2 `/api/tenant-access-url`
| 方法 | 路径 | 中间件 | 说明 |
|---|---|---|---|
| `GET` | `/api/tenant-access-url/:tenantId` | `authenticate` + `requireSystemAdmin` | 获取租户访问地址（域名/链接）。 |
| `PUT` | `/api/tenant-access-url/:tenantId` | `authenticate` + `requireSystemAdmin` | 更新访问地址。 |
| `DELETE` | `/api/tenant-access-url/:tenantId` | `authenticate` + `requireSystemAdmin` | 删除访问地址。 |
| `GET` | `/api/tenant-access-url/_debug/build-url` | `authenticate` | 调试：构建 URL（内部用）。 |

### 2.3 `/api/tenant-association`
| 方法 | 路径 | 中间件 | 说明 |
|---|---|---|---|
| `GET/POST/PUT/DELETE` | `/api/tenant-association/*` | `authenticate` | 用户与租户的关联关系、邀请码、跨租户切换等。 |

### 2.4 `/api/tenant-module-config`
| 方法 | 路径 | 中间件 | 说明 |
|---|---|---|---|
| `GET` | `/api/tenant-module-config/:tenantId` | `authenticate` | 查询租户模块启用状态。 |
| `PUT` | `/api/tenant-module-config/:tenantId` | `authenticate` + `requireSystemAdmin` | 启停模块。 |
| `POST` | `/api/tenant-module-config/sync-menus` | `authenticate` + `requireSystemAdmin` | 同步菜单。 |

### 2.5 `/api/modules`
| 方法 | 路径 | 中间件 | 说明 |
|---|---|---|---|
| `GET` | `/api/modules` | `authenticate` | 系统模块清单（含依赖关系）。 |
| `GET` | `/api/modules/:id` | `authenticate` | 模块详情。 |
| `POST` | `/api/modules` | `authenticate` + `requireSystemAdmin` | 创建模块。 |
| `PUT` | `/api/modules/:id` | `authenticate` + `requireSystemAdmin` | 更新模块。 |
| `DELETE` | `/api/modules/:id` | `authenticate` + `requireSystemAdmin` | 删除模块。 |

### 2.6 `/api/module-configs`
| 方法 | 路径 | 中间件 | 说明 |
|---|---|---|---|
| `GET` | `/api/module-configs` | `authenticate` | 模块配置列表（按租户）。 |
| `GET/POST/PUT/DELETE` | `/api/module-configs/:id` | `authenticate` | 增删改查单条配置。 |
| `POST` | `/api/module-configs/batch` | `authenticate` + `requireSystemAdmin` | 批量更新配置。 |
| `POST` | `/api/module-configs/toggle` | `authenticate` + `requireSystemAdmin` | 切换模块开关。 |

---

## 3. 角色与权限

### 3.1 `/api/roles-permissions`
| 方法 | 路径 | 中间件 | 说明 |
|---|---|---|---|
| `GET` | `/api/roles-permissions/permissions/definitions` | `authenticate` | 权限定义字典（按模块）。 |
| `GET` | `/api/roles-permissions/permissions/list` | `authenticate` | 权限清单。 |
| `GET` | `/api/roles-permissions/roles` | `authenticate` | 角色列表。 |
| `POST` | `/api/roles-permissions/roles` | `authenticate` + `requireSystemAdmin` | 创建角色。 |
| `PUT` | `/api/roles-permissions/roles/:role` | `authenticate` + `requireSystemAdmin` | 更新角色。 |
| `DELETE` | `/api/roles-permissions/roles/:role` | `authenticate` + `requireSystemAdmin` | 删除角色。 |
| `GET` | `/api/roles-permissions/roles/:role/menus` | `authenticate` + `requireSystemAdmin` | 角色菜单权限。 |
| `GET` | `/api/roles-permissions/roles/:role/permissions` | `authenticate` | 角色权限位。 |
| `PUT` | `/api/roles-permissions/roles/:role/permissions` | `authenticate` + `requireSystemAdmin` | 设置角色权限。 |
| `PUT` | `/api/roles-permissions/roles/permissions/batch` | `authenticate` + `requireSystemAdmin` | 批量设置角色权限。 |
| `GET` | `/api/roles-permissions/user/permissions` | `authenticate` | 当前用户有效权限。 |
| `POST` | `/api/roles-permissions/user/check-permission` | `authenticate` | 检查权限码。 |
| `GET` | `/api/roles-permissions/menus/definitions` | `authenticate` | 菜单定义。 |
| `GET` | `/api/roles-permissions/menus/list` | `authenticate` | 菜单列表。 |
| `PUT` | `/api/roles-permissions/roles/:role/menus` | `authenticate` + `requireSystemAdmin` | 角色菜单授权。 |
| `POST` | `/api/roles-permissions/menus/force-update` | `authenticate` + `requireSystemAdmin` | 强制刷新菜单树。 |
| `GET` | `/api/roles-permissions/user/menus` | `authenticate` | 当前用户菜单树。 |

### 3.2 `/api/enhanced-permissions`
| 方法 | 路径 | 中间件 | 说明 |
|---|---|---|---|
| 16 个端点 | `/api/enhanced-permissions/*` | `authenticate` + 视接口而定 | 数据级/字段级权限增强；支持按部门、资产类型、角色组合过滤。 |
| `POST` | `/api/enhanced-permissions/check` | `authenticate` | 综合校验当前用户是否可对指定资源执行某动作。 |

### 3.3 `/api/system-config`
| 方法 | 路径 | 中间件 | 说明 |
|---|---|---|---|
| `GET` | `/api/system-config` | — | 公开系统配置（如 logo、版本）。 |
| `GET` | `/api/system-config/database` | `authenticate` + `requireSuperAdmin` | 数据库连接状态。 |
| `POST` | `/api/system-config/database/test` | `authenticate` + `requireSuperAdmin` | 测试数据库连接。 |
| `GET` | `/api/system-config/feishu` | `authenticate` + `requireSystemAdmin` | 飞书集成配置。 |
| `POST` | `/api/system-config/feishu/test` | `authenticate` + `requireSystemAdmin` | 测试飞书连通性。 |
| `GET` | `/api/system-config/email` | `authenticate` + `requireSystemAdmin` | 邮件配置。 |
| `POST` | `/api/system-config/email/test` | `authenticate` + `requireSystemAdmin` | 发送测试邮件。 |

### 3.4 `/api/menus`
- `/menus/menu-tree`、`/menus/menus`（需认证）；`/menus/builtin-menus`、`/menus/default-menus`（公开）。

---

## 4. 组织架构 (`/api/departments`)

| 方法 | 路径 | 中间件 | 说明 |
|---|---|---|---|
| `GET` | `/api/departments` | `authenticate` | 部门列表（树形/扁平）。 |
| `GET` | `/api/departments/tree` | `authenticate` | 部门树。 |
| `GET` | `/api/departments/:id` | `authenticate` | 部门详情。 |
| `POST` | `/api/departments` | `authenticate` + `requireSystemAdmin` | 创建部门。 |
| `PUT` | `/api/departments/:id` | `authenticate` + `requireSystemAdmin` | 更新部门。 |
| `DELETE` | `/api/departments/:id` | `authenticate` + `requireSystemAdmin` | 删除/停用部门。 |
| `GET` | `/api/departments/:id/users` | `authenticate` | 部门用户列表。 |

---

## 5. 资产管理（核心）

### 5.1 资产 CRUD 与查询
| 方法 | 路径 | 中间件 | 说明 |
|---|---|---|---|
| `GET` | `/api/assets` | `authenticate` | 资产列表（分页/过滤），按 `asset_code` 主键识别。 |
| `GET` | `/api/assets/all` | `authenticate` | 全量资产（不分页）。 |
| `GET` | `/api/assets/duplicate-check` | `authenticate` + `requireTenantId` | 创建前查重（`name`、`asset_code`、`serial_number`）。 |
| `GET` | `/api/assets/departments/list` | `authenticate` | 用于过滤器的部门精简列表。 |
| `GET` | `/api/assets/:id` | `authenticate` | 资产详情。 |
| `GET` | `/api/assets/:id/change-logs` | `authenticate` | 资产变更历史。 |
| `GET` | `/api/assets/:id/transitions` | `authenticate` | 状态流转历史。 |
| `POST` | `/api/assets` | `authenticate` + `requireTenantId` | 创建资产（需 `asset_code`）。 |
| `PUT` | `/api/assets/:id` | `authenticate` | 更新资产。 |
| `DELETE` | `/api/assets/:id` | `authenticate` | 删除资产（高危，可能触发 highRiskActionGate）。 |

### 5.2 资产分类
| 方法 | 路径 | 中间件 | 说明 |
|---|---|---|---|
| `GET` | `/api/assets/categories` | `authenticate` | 分类列表（等价 `/list`）。 |
| `GET` | `/api/assets/categories/list` | `authenticate` | 分类扁平列表。 |
| `GET` | `/api/assets/categories/tree` | `authenticate` | 分类树。 |
| `POST` | `/api/assets/categories` | `authenticate` + `requireSystemAdmin` | 创建分类。 |
| `PUT` | `/api/assets/categories/:id` | `authenticate` + `requireSystemAdmin` | 更新分类。 |
| `DELETE` | `/api/assets/categories/:id` | `authenticate` + `requireSystemAdmin` | 删除分类。 |

### 5.3 资产导入/导出
| 方法 | 路径 | 中间件 | 说明 |
|---|---|---|---|
| `GET` | `/api/assets/import-template` | `authenticate` | 下载导入模板（Excel/CSV）。 |
| `POST` | `/api/assets/import` | `authenticate` + `requireTenantId` + `upload.single('file')` + `fileSecurity()` | 上传导入（multipart/form-data，字段名 `file`）。 |
| `GET` | `/api/assets/export/template` | `authenticate` | 导出模板。 |
| `GET` | `/api/assets/export` | `authenticate` + `requireTenantId` | 导出资产列表（query: `format=xlsx|csv`）。 |

### 5.4 资产统计
| 方法 | 路径 | 中间件 | 说明 |
|---|---|---|---|
| `GET` | `/api/assets/statistics/overview` | `authenticate` | 资产总览。 |
| `GET` | `/api/assets/statistics/by-department` | `authenticate` | 按部门统计。 |
| `GET` | `/api/assets/statistics/depreciation` | `authenticate` | 折旧统计。 |
| `GET` | `/api/assets/statistics/expiring-warranties` | `authenticate` | 即将到期保修。 |

### 5.5 资产转移（调拨）
| 方法 | 路径 | 中间件 | 说明 |
|---|---|---|---|
| `GET` | `/api/assets/transfer-requests` | `authenticate` | 转移申请列表。 |
| `POST` | `/api/assets/:id/transfer-apply` | `authenticate` | 提交转移申请。 |
| `POST` | `/api/assets/transfer-requests/:request_id/approve` | `authenticate` | 审批通过/拒绝。 |
| `POST` | `/api/assets/transfer-requests/:request_id/reject` | `authenticate` | 拒绝（视实现）。 |

### 5.6 资产共享（外链）
| 方法 | 路径 | 中间件 | 说明 |
|---|---|---|---|
| `POST` | `/api/assets/:id/share` | `authenticate` | 生成分享链接（可设置过期时间、密码）。 |
| `GET` | `/api/assets/:id/shares` | `authenticate` | 资产已生成的分享列表。 |
| `DELETE` | `/api/assets/shares/:share_id` | `authenticate` | 撤销分享。 |
| `GET` | `/api/assets/share/:token` | 公开 | 通过 `token` 访问资产详情（限只读）。 |

### 5.7 资产状态机
- 状态值：`在用`（in_use）/ `闲置`（idle）/ `维修`（maintenance）/ `报废`（scrapped）/ `调配中`（transferring）。
- 流转入口：`/api/assets/:id/transitions`（历史）、`/api/transfer/*`、`/api/maintenance-management/*`、`/api/scrapping/*`、`/api/idle/*`。
- `requireTenantId` 的差异：分类 CRUD 仅 `requireSystemAdmin`；资产 CRUD 写入必须 `requireTenantId`；查询接口仅 `authenticate`。

### 5.8 资产辅助端点
| 方法 | 路径 | 中间件 | 说明 |
|---|---|---|---|
| `POST/GET/DELETE` | `/api/asset-images` | `authenticate` | 资产图片（旧）。 |
| `GET/POST/PUT/DELETE` | `/api/asset-labels` | `authenticate` | 标签模板（`/api/assets/labels` 推荐）。 |
| `GET/POST/PUT/DELETE` | `/api/temp-assets` | `authenticate` | 临时资产（导入中临时表）。 |
| `GET/POST` | `/api/barcode-scan` | `authenticate` | 条码扫描入账。 |

---

## 6. 维修管理（maintenance-management + `/api/maintenance`）

### 6.1 `/api/maintenance-management` 模块
| 方法 | 路径 | 中间件 | 说明 |
|---|---|---|---|
| `GET` | `/api/maintenance-management/requests` | `authenticate` | 维修申请列表。 |
| `GET` | `/api/maintenance-management/requests/:id` | `authenticate` | 详情。 |
| `POST` | `/api/maintenance-management/requests` | `authenticate` + `requireTenantId` | 创建申请（`asset_code`、`fault_description` 等）。 |
| `POST` | `/api/maintenance-management/requests/:id/approve` | `authenticate` + `requireTenantId` | 审批。 |
| `POST` | `/api/maintenance-management/requests/:id/start` | `authenticate` + `requireTenantId` | 开始维修。 |
| `POST` | `/api/maintenance-management/requests/:id/complete` | `authenticate` + `requireTenantId` | 完成。 |
| `POST` | `/api/maintenance-management/requests/:id/cancel` | `authenticate` + `requireTenantId` | 取消。 |
| `PUT` | `/api/maintenance-management/requests/:id` | `authenticate` + `requireTenantId` | 更新。 |
| `DELETE` | `/api/maintenance-management/requests/:id` | `authenticate` + `requireTenantId` | 删除（高危）。 |
| `GET` | `/api/maintenance-management/plans` | `authenticate` | 计划列表。 |
| `GET/POST/PUT/DELETE` | `/api/maintenance-management/plans/:id` | `authenticate` (+ `requireTenantId` 写入) | 计划 CRUD。 |
| `POST` | `/api/maintenance-management/plans/:id/complete` | `authenticate` + `requireTenantId` | 标记完成。 |
| `POST` | `/api/maintenance-management/plans/:id/trigger` | `authenticate` + `requireTenantId` | 触发执行（生成工单）。 |
| `GET` | `/api/maintenance-management/plans/:id/history` | `authenticate` | 历史。 |
| `GET` | `/api/maintenance-management/workorders` | `authenticate` | 工单列表。 |
| `GET` | `/api/maintenance-management/workorders/dispatch-panel` | `authenticate` | 派单面板。 |
| `GET` | `/api/maintenance-management/workorders/engineers` | `authenticate` | 工程师列表。 |
| `GET` | `/api/maintenance-management/workorders/:id` | `authenticate` | 工单详情。 |
| `POST` | `/api/maintenance-management/workorders` | `authenticate` + `requireTenantId` | 新建工单。 |
| `PUT` | `/api/maintenance-management/workorders/:id` | `authenticate` + `requireTenantId` | 更新。 |
| `POST` | `/api/maintenance-management/workorders/:id/materials` | `authenticate` + `requireTenantId` | 追加物料。 |
| `POST` | `/api/maintenance-management/workorders/:id/assign` | `authenticate` + `requireTenantId` | 派工。 |
| `POST` | `/api/maintenance-management/workorders/:id/start` | `authenticate` + `requireTenantId` | 开始。 |
| `POST` | `/api/maintenance-management/workorders/:id/complete` | `authenticate` + `requireTenantId` | 完成。 |
| `POST` | `/api/maintenance-management/workorders/:id/close` | `authenticate` + `requireTenantId` | 关闭。 |
| `POST` | `/api/maintenance-management/workorders/:id/cancel` | `authenticate` + `requireTenantId` | 取消。 |
| `DELETE` | `/api/maintenance-management/workorders/:id` | `authenticate` + `requireTenantId` | 删除。 |
| `GET` | `/api/maintenance-management/workorders/legacy*` | `authenticate` | 兼容旧路径（`/legacy/workorders`）。 |

### 6.2 `/api/maintenance`（拆分子路由）
- **请求** `/requests` —— 与 6.1 同义；**workorders** `/workorders*`、`/legacy/workorders*`；**plans** `/plans*`；**logs** `/logs`、`/logs/:id`、`/logs/:logId/attachments*`、`/statistics`。
- **模板** `/templates`、`/templates/recommend`、`/templates/recommend-by-asset`、`/templates/:id`，CRUD；另有 `/legacy/templates` 兼容路径。
- **评估** `/evaluations` CRUD。
- **成本** `/costs`、`/costs/trend`、`/costs/department`、`/costs/asset-type`、`/costs/maintenance-type`、`/costs/high-cost-assets`、`/costs/analysis`，CRUD。
- **分析** `/efficiency/*`、`/analysis/*`（响应时效、技术员绩效、类型分布等）。
- **使用度** `/usage/*`、`/usage-records`、`/usage-triggered`、`/usage-triggered/:id/process`、`/usage-triggered/check`、`/usage/asset-usage`、`/usage/records`、`/usage/triggered`、`/usage/triggered/:id/ignore`。
- **提醒** `/reminders`、`/reminders/send`、`/reminders/config`、`/reminders/check`。

### 6.3 `/api/maintenance-ai`（AI 提交入口，安全路径）
- `POST /api/maintenance/ai/submit-request`：**不触发 highRiskActionGate**；由 AI 或 skill 创建的维修申请，固定为 `待审批` 状态。请求体：`asset_code`、`fault_description`（兼容 `issue_description`）、`source`、`intent`。
- `POST /api/maintenance/ai/analyze`：基于故障描述生成建议（root cause、推荐模板、风险评分）。
- 其他端点见 `backend/routes/maintenance-ai.js`。

### 6.4 `/api/asset-usage-management`、`/api/preventive-maintenance-management`
- `asset-usage-management`：资产使用率统计与记录。
- `preventive-maintenance-management`：预防性维护计划与提醒（与 `/api/maintenance/plans` 协同）。

---

## 7. 合规与特种设备

### 7.1 `/api/compliance`（合规主入口）
| 方法 | 路径 | 中间件 | 说明 |
|---|---|---|---|
| `GET` | `/api/compliance` | `authenticate` | 合规首页。 |
| `GET` | `/api/compliance/status` | `authenticate` | 当前租户合规状态。 |
| `GET` | `/api/compliance/dashboard-stats` | `authenticate` | 仪表盘统计。 |
| `GET/POST/PUT/DELETE` | `/api/compliance/items` | `authenticate` | 合规项（规则）CRUD（按模块注册）。 |

### 7.2 `/api/safety-inspection`
| 方法 | 路径 | 中间件 | 说明 |
|---|---|---|---|
| `GET/POST` | `/api/safety-inspection` | `authenticate` | 安全检查记录 CRUD。 |
| `PUT` | `/api/safety-inspection/:id/rectification` | `authenticate` | 整改。 |
| `GET` | `/api/safety-inspection/expiring` | `authenticate` | 即将到期。 |
| `GET` | `/api/safety-inspection/statistics/overview` | `authenticate` | 统计。 |

### 7.3 `/api/special-equipment`
| 方法 | 路径 | 中间件 | 说明 |
|---|---|---|---|
| `GET/POST/PUT` | `/api/special-equipment`、`/api/special-equipment/:id` | `authenticate` | 特种设备档案。 |
| `GET/POST` | `/api/special-equipment/inspections`、`/api/special-equipment/inspections/:id` | `authenticate` | 检验记录。 |
| `GET` | `/api/special-equipment/expiring-inspections` | `authenticate` | 即将到期检验。 |
| `GET` | `/api/special-equipment/statistics/overview` | `authenticate` | 统计。 |

### 7.4 `/api/staff`（人员资质，旧）
| 方法 | 路径 | 中间件 | 说明 |
|---|---|---|---|
| `GET/POST/PUT/DELETE` | `/api/staff`、`/api/staff/:id` | `authenticate` | 人员资质档案（已迁移至 `/api/compliance/staff-qualification` 与 `/api/staff-qualification/*`）。 |

### 7.5 `/api/uptime`（设备开机率/运行时长）
| 方法 | 路径 | 中间件 | 说明 |
|---|---|---|---|
| `POST/GET` | `/api/uptime/operation-logs` | `authenticate` | 运行日志。 |
| `POST` | `/api/uptime/batch-operation-logs` | `authenticate` | 批量录入。 |
| `POST` | `/api/uptime/calculate` | `authenticate` | 触发计算。 |
| `GET` | `/api/uptime/statistics` | `authenticate` | 统计。 |
| `GET` | `/api/uptime/overview` | `authenticate` | 总览。 |

### 7.6 `/api/risk`（风险评估）
| 方法 | 路径 | 中间件 | 说明 |
|---|---|---|---|
| `GET/POST/PUT/DELETE` | `/api/risk/*` | `authenticate` | 风险评估、分类、控制措施、看板；推荐路径 `/api/asset-risk-management/*`。 |

---

## 8. 集成 / IoT / 文档

### 8.1 `/api/integration`
- 通用集成配置：11 个端点，覆盖钉钉、企业微信、飞书、Webhook、API 集成等。

### 8.2 `/api/message-integration`
- 消息通道（SMS、邮件、IM）配置与发送。

### 8.3 `/api/feishu`
- 飞书事件订阅、回调、机器人消息。
- `/api/feishu-binding/event`（公开 webhook）、`/diagnostic`、`/health`、`/`。

### 8.4 `/api/wx-cloud`
- 微信云开发相关：上传凭证、云函数调用、用户同步。

### 8.5 `/api/iot`（IoT 设备与环境监测）
| 子模块 | 关键端点 |
|---|---|
| 设备管理 (`/api/iot/devices`) | CRUD、绑定资产、上下线。 |
| 资产位置 (`/api/iot/locations`) | `/assets/:assetCode/latest`、`/series`、`/devices/:deviceId/latest`、`/pipeline/health`、`/pipeline/docs`。 |
| 环境监测 (`/api/iot/environment-monitoring`) | `/ingest`、`/ingest/batch`、`/devices/:deviceId/latest`、`/assets/:assetCode/latest`、`/assets/:assetCode/series`、`/pipeline/health`、`/pipeline/docs`。 |
| 资产监测 (`/api/iot/asset-monitoring`) | 同上模式。 |
| 区域定位 (`/api/iot/zone-location`) | 同上 + `/sample`（管理角色）。 |
| 地理定位 (`/api/iot/geo-location`) | 同上。 |
| 病人流量 (`/api/iot/patient-volume`) | `/ingest`、`/ingest/batch`、`/assets/usage-stats`、`/records/recent`、`/records/all`、`/assets/:assetCode/patients`。 |
- `/ingest*` 通常使用 IoT Token（`X-IoT-Token` 或设备证书），不是用户 JWT。

### 8.6 `/api/technical-documents`（技术资料 + AI）
- 59 个端点，覆盖文件上传、版本管理、检索、AI 摘要。
- `/api/technical-documents/enhanced/*`：增强元数据（设备、参数）。
- `/api/technical-documents/ai/*`：AI 检索/问答/总结。
- 兼容旧路径：`/api/technical-documents/enhanced`、`/api/technical-documents/ai`。

---

## 9. 质量、采购、验收、招投标

### 9.1 `/api/quality-control`、`/api/quality`
- `/quality-control` 30 个端点：质量检查计划/记录、计量器具、统计报告。
- `/quality` 25 个端点（兼容）：质量事件、不合格品、纠正预防。

### 9.2 `/api/procurement`
- 11 个端点：采购申请、审批、执行、附件、统计。

### 9.3 `/api/acceptance`、`/api/acceptance-management`
- `/acceptance` 12 个端点（兼容）：记录 CRUD、文件、状态流转。
- `/acceptance-management` 模块：标准化验收流程（待审批/已通过/已驳回），支持附件与签字。

### 9.4 `/api/tendering`
- 招投标管理（`tendering-management` 模块）：
  - `GET /api/tendering/dict` —— 字典。
  - `GET /api/tendering/public/supplier/:token` —— 供应商公开访问（无需 JWT）。
  - `GET /api/tendering/public/tender/:token`、`/public/tender/:token/files`、`/public/tender/:token/files/:fileId` —— 公开招标与文件下载。
  - `/projects` CRUD（需 `moduleGuard`，即模块启用）。
  - `/projects/:id/sections`、`/bidders`、`/evaluations`、`/awards` 等。

---

## 10. 盘点 / 闲置 / 调拨 / 报废

### 10.1 盘点
| 路径 | 说明 |
|---|---|
| `/api/inventory-plans` | 盘点计划 CRUD、复制。 |
| `/api/inventory-tasks` | 任务分配、开始、完成、取消（`/my/tasks` 仅个人）。 |
| `/api/inventory` | 综合盘点操作。 |
| `/api/inventory-reports` | 报告生成与导出。 |
| `/api/inventory-discrepancies` | 差异处理。 |

### 10.2 闲置资产 `/api/idle`
- 列表、详情、申请再利用、审批、导出。

### 10.3 调拨 `/api/transfer`（兼容，已迁移至 `/api/assets/transfer-*`）
- 旧路径保留：`/api/transfer` 系列 7 个端点。

### 10.4 报废 `/api/scrapping`
- 11 个端点：`POST /`（创建申请，触发审计日志）、`GET /`、`GET /:id`、`PUT /:id`、`POST /:id/approve`（高危审批）等。

---

## 11. AI 与智能分析

### 11.1 通用 AI 网关
| 路径 | 说明 |
|---|---|
| `POST /api/ai/chat/completions` | OpenAI 兼容 chat completions（流式支持）。 |
| `GET /api/ai/config` | 当前 AI 提供方、模型、限额。 |
| `POST /api/chat` | 同上（兼容）。 |

### 11.2 资产 AI 助手
| 路径 | 中间件 | 说明 |
|---|---|---|
| `/api/ai-assistant` | `authenticate` | 通用助手。 |
| `/api/asset-ai-assistant/*` | `authenticate` | 资产相关助手（模块入口）。 |
| `/api/asset-ai-analysis` | `authenticate` | 深度分析：`/analyze-asset/:assetCode`、`/analyze-assets`、`/custom-analysis`、`/datasources`、`/dimensions`、`/question-records`、`/reports/:id`、`/analysis-history`。 |

### 11.3 维修 AI 与文档 AI
- `/api/maintenance-ai/*`：见 6.3 节，含安全维修申请入口。
- `/api/technical-documents-ai/*`：技术资料 AI 检索与总结。

### 11.4 智能告警与分析
- `/api/intelligent-alerts` 14 个端点：规则、阈值、通知渠道、抑制窗口。
- `/api/analysis` 3 个端点：`/`、`/depreciation`、`/value-distribution`。
- `/api/agent-mesh` 10 个端点：智能体网格（topology、events、roadmap、health-index、risk-score、predictive-maintenance）。

### 11.5 工具调用协议
- 部分 AI 端点支持流式响应（SSE，header `Content-Type: text/event-stream`）；OpenClaw skill 需使用流式解析。
- 维修/故障场景使用 `/api/maintenance/ai/submit-request` 作为安全入口，无需二次确认。

---

## 12. 仪表盘与统计

### 12.1 仪表盘
| 路径 | 说明 |
|---|---|
| `/api/dashboard` | 仪表盘数据（按角色动态）。 |
| `/api/dashboard-configs` | 用户自定义仪表盘布局。 |
| `/api/desktop-preferences` | 桌面偏好。 |
| `/api/page-views` | 页面访问埋点。 |

### 12.2 折旧
- `/api/asset-depreciation` 10 个端点：月度/年/部门/类型汇总；`/depreciation/calculate`、`/depreciation/schedule/:assetId`、`/depreciation/export`。
- `/api/depreciation` 18 个端点（兼容）。

### 12.3 资产附件与标签
- `/api/asset-images`、`/api/asset-labels`、`/api/temp-assets`、`/api/barcode-scan`：见 5.8 节。

### 12.4 工作流
- `/api/workflow` 5 个端点：流程定义、启动、流转、状态查询。

---

## 13. 审计 / 备份 / 国际化 / 文档化

### 13.1 审计
- `/api/audit-logs` 3 个端点：列表、详情、统计。
- `/api/audit-logs-enhanced` 增强查询（多维过滤、导出）。

### 13.2 备份
- `/api/backup` 6 个端点：创建备份、列表、下载、恢复、删除、状态。

### 13.3 国际化
- `/api/i18n` 4 个端点：语言列表、词条加载、翻译上传。

### 13.4 API 文档化
- `/api/api-documentation` 4 个端点：列表、单模块、模块详情、原始 OpenAPI 摘要（通常匿名）。

### 13.5 物料与短信验证
- `/api/materials`：物料字典（CRUD）。
- `/api/sms-verification`：发送验证码、校验（`loginLimiter`）。

### 13.6 云同步与位置码
- `/api/cloud-sync`：跨云同步任务管理。
- `/api/location-codes` 5 个端点：位置码字典。
- `/api/location-alerts` 5 个端点：位置异常告警。

### 13.7 不良事件
- `/api/adverse-reaction`、`/api/adverse-events` 各 18 个端点：报告、审批、关闭、恢复、附件、统计、回收站、导出。

### 13.8 集成通道
- `/api/integration-channels`：第三方消息通道配置。

### 13.9 健康检查
- `/alive`、`/ready`、`/health`（无前缀）。
- `/api/circuit-breakers`：熔断器状态。
- `/api/metrics`：Prometheus 指标。

---

## 14. 错误码与状态

| HTTP | 触发条件 | 响应要点 |
|---|---|---|
| 400 | 业务校验失败、缺租户上下文 | `code: "VALIDATION_ERROR"` 或 `"TENANT_REQUIRED"`。 |
| 401 | 缺/失效 JWT | `code: "UNAUTHORIZED"`。 |
| 403 | 权限不足、跨租户访问 | `code: "FORBIDDEN"`、`requireSystemAdmin` 失败。 |
| 404 | 资源/路径不存在 | `code: "NOT_FOUND"`。 |
| 409 | 唯一键冲突（如 `asset_code`、`username`） | `code: "CONFLICT"`。 |
| 410 | 资源已废弃（如旧版兼容路由下线） | `code: "GONE"`。 |
| 422 | 业务规则不满足（如状态机非法流转） | `code: "UNPROCESSABLE_ENTITY"`。 |
| 428 | 高危操作需二次确认 | `code: "HIGH_RISK_CONFIRMATION_REQUIRED"`、`data.action`、`data.target`、`data.hint`。 |
| 429 | 触发 `loginLimiter`/`registerLimiter`/`apiLimiter` | `code: "RATE_LIMITED"`。 |
| 500 | 服务内部异常 | `code: "INTERNAL_ERROR"`。 |
| 503 | 数据库不可用/熔断 | `code: "SERVICE_UNAVAILABLE"`。 |

**高危网关响应示例：**
```json
{
  "success": false,
  "code": "HIGH_RISK_CONFIRMATION_REQUIRED",
  "message": "该操作影响 N 条记录，需要显式确认",
  "data": {
    "action": "scrapping:approve",
    "target": { "id": "SR-2026-0007" },
    "hint": "请在确认后重试，并携带相同的 Idempotency-Key"
  }
}
```

---

## 15. 中间件速查

| 中间件 | 来源 | 行为 |
|---|---|---|
| `authenticate` | `backend/middleware/auth.js` | 校验 JWT，写入 `req.user`。 |
| `requireTenantId` | `backend/middleware/tenant.js` | 缺租户上下文时 400；`super_admin` 必须传 `?tenant_id=` 或 `X-Tenant-ID`。 |
| `requireSystemAdmin` | `backend/middleware/roles.js` | 限定 `system_admin`。 |
| `requireSuperAdmin` | 同上 | 限定平台 `super_admin`（仅用于 DB/备份/系统级）。 |
| `authorize(permission)` | 同上 | 单权限码校验。 |
| `authorize([...])` | 同上 | 多权限码 OR 校验。 |
| `auditLogger(action, resource)` | `backend/middleware/audit.js` | 写入审计日志。 |
| `highRiskActionGate` | `backend/middleware/risk.js` | 二次确认（428）。 |
| `apiLimiter`/`loginLimiter`/`registerLimiter` | `backend/middleware/rateLimit.js` | 触发 429。 |
| `upload.single(field)` | `backend/middleware/upload.js` | `multipart/form-data` 单文件。 |
| `fileSecurity()` | 同上 | 文件类型/大小校验。 |
| `moduleGuard` | `backend/middleware/moduleGuard.js` | 模块启用校验。 |

---

## 16. 资产状态机（详细）

```
在用 (in_use)  ──► 闲置 (idle)         ──► 在用（再利用）
        │                                      
        ├──► 维修 (maintenance) ──► 在用 / 报废
        │                        ──► 报废 (scrapped)
        ├──► 调配中 (transferring) ──► 在用（新部门）
        └──► 报废 (scrapped)
```
- 状态流转入口：`/api/assets/:id/transitions`（只读历史）、`/api/maintenance-management/requests/:id/*`、`/api/idle/*`、`/api/scrapping/*`、`/api/assets/:id/transfer-apply`。
- 字段：`status` 为枚举；`status_transitions` 表记录流转事件。

---

## 17. 路由挂载总览（来自 `backend/server.js`）

### 17.1 直接挂载（顶级路由）
| 前缀 | 文件 |
|---|---|
| `/api/roles-permissions` | `backend/routes/roles-permissions.js` |
| `/api/enhanced-permissions` | `backend/routes/enhanced-permissions.js` |
| `/api/system-config` | `backend/routes/system-config.js` |
| `/api/tenants` | `backend/routes/tenants.js` |
| `/api/tenant-access-url` | `backend/routes/tenant-access-url.js` |
| `/api/tenant-association` | `backend/routes/tenant-association.js` |
| `/api/tenant-module-config` | `backend/routes/tenant-module-config.js` |
| `/api/modules` | `backend/routes/modules.js` |
| `/api/module-configs` | `backend/routes/module-configs.js` |
| `/api/audit-logs` | `backend/routes/audit-logs.js` |
| `/api/audit-logs-enhanced` | `backend/routes/audit-logs-enhanced.js` |
| `/api/backup` | `backend/routes/backup.js` |
| `/api/workflow` | `backend/routes/workflow.js` |
| `/api/i18n` | `backend/routes/i18n.routes.js` |
| `/api/api-documentation` | `backend/routes/api-documentation.js` |
| `/api/agent-mesh` | `backend/routes/agent-mesh.js` |
| `/api/dashboard` | `backend/routes/dashboard.js` |
| `/api/dashboard-configs` | `backend/routes/dashboard-configs.js` |
| `/api/desktop-preferences` | `backend/routes/desktop-preferences.js` |
| `/api/page-views` | `backend/routes/page-views.js` |
| `/api/analysis` | `backend/routes/analysis.js` |
| `/api/wx-cloud` | `backend/routes/wx-cloud.js` |
| `/api/menus` | `backend/routes/menus.js` |
| `/api/maintenance-ai` | `backend/routes/maintenance-ai.js` |
| `/api/maintenance` | `backend/routes/maintenance.js`（兼容入口）+ 子路由 `maintenance/*.router.js` |
| `/api/technical-documents` | `backend/routes/technical-documents.js` |
| `/api/technical-documents-enhanced` | `backend/routes/technical-documents-enhanced.js` |
| `/api/technical-documents-ai` | `backend/routes/technical-documents-ai.js` |
| `/api/asset-ai-analysis` | `backend/routes/asset-ai-analysis.js` |
| `/api/asset-images` | `backend/routes/asset-images.js` |
| `/api/asset-labels` | `backend/routes/asset-labels.js` |
| `/api/asset-location` | `backend/routes/asset-location.js` |
| `/api/asset-depreciation` | `backend/routes/asset-depreciation.js` |
| `/api/temp-assets` | `backend/routes/temp-assets.js` |
| `/api/barcode-scan` | `backend/routes/barcode-scan.js` |
| `/api/intelligent-alerts` | `backend/routes/intelligent-alerts.js` |
| `/api/idle` | `backend/routes/idle.js` |
| `/api/scrapping` | `backend/routes/scrapping.js` |
| `/api/transfer` | `backend/routes/transfer.js` |
| `/api/depreciation` | `backend/routes/depreciation.js` |
| `/api/inventory` | `backend/routes/inventory.js` |
| `/api/inventory-plans` | `backend/routes/inventory-plans.js` |
| `/api/inventory-tasks` | `backend/routes/inventory-tasks.js` |
| `/api/inventory-reports` | `backend/routes/inventory-reports.js` |
| `/api/inventory-discrepancies` | `backend/routes/inventory-discrepancies.js` |
| `/api/quality-control` | `backend/routes/quality-control.js` |
| `/api/quality` | （兼容，部分入口） |
| `/api/procurement` | `backend/routes/procurement.js` |
| `/api/acceptance` | `backend/routes/acceptance.js` |
| `/api/adverse-reaction` | `backend/routes/adverse-reaction.js` |
| `/api/adverse-events` | `backend/routes/adverse-events.js`（亦在 `modules/adverse-event`） |
| `/api/ai` | `backend/routes/ai.js` |
| `/api/ai-assistant` | `backend/routes/ai-assistant.js` |
| `/api/chat` | `backend/routes/ai.js` 内 alias |
| `/api/materials` | `backend/routes/materials.js` |
| `/api/sms-verification` | `backend/routes/sms-verification.js` |
| `/api/cloud-sync` | `backend/routes/cloud-sync.js` |
| `/api/location-codes` | `backend/routes/location-codes.js` |
| `/api/location-alerts` | `backend/routes/location-alerts.js` |
| `/api/integration` | `backend/routes/integration.js` |
| `/api/integration-channels` | `backend/routes/integration-channels.js` |
| `/api/message-integration` | `backend/routes/message-integration.js` |
| `/api/feishu` | `backend/modules/feishu-binding/routes/index.js` |
| `/api/health` | `backend/routes/health.js` |
| `/api/circuit-breakers` | `backend/routes/circuit-breakers.js` |
| `/api/metrics` | `backend/routes/metrics.js` |

### 17.2 模块挂载
| 前缀 | 模块文件 |
|---|---|
| `/api/users` | `backend/modules/user-management/routes/users.js` + `backend/routes/users.js` |
| `/api/departments` | `backend/modules/department-management/routes/departments.js` |
| `/api/assets` | `backend/routes/assets/index.js` 聚合 + 子路由 `asset.{mutation,query,category,statistics,share,transfer,import-export}.js` 与 `backend/modules/asset-management/routes/*.js` |
| `/api/compliance` | `backend/routes/compliance/index.js` + `compliance/{maintenance-level,uptime-statistics,safety-inspection,special-equipment,staff-qualification}.js` + `backend/modules/compliance-management/routes/*` |
| `/api/safety-inspection` | 同上 safety 子模块 |
| `/api/special-equipment` | 同上 special 子模块 |
| `/api/staff` | 旧路径，主体已迁移至 `compliance/staff-qualification` 与 `staff-qualification` 模块 |
| `/api/uptime` | 旧路径，主体已迁移至 `compliance/uptime-statistics` 与 `uptime-management` 模块 |
| `/api/risk` | 旧路径，主体已迁移至 `asset-risk-management` |
| `/api/iot` | `backend/modules/iot-management/routes/*`（含 `asset-monitoring`、`environment-monitoring`、`zone-location`、`patient-volume`、`iot-devices`、`asset-location`）+ 子模块 `iot-asset-monitoring-management`、`iot-environment-monitoring-management`、`iot-geo-location-management`、`iot-zone-location-management` |
| `/api/iot-devices` | `backend/modules/iot-management/routes/iot-devices.js` |
| `/api/asset-location` | `backend/modules/iot-management/routes/asset-location.js` |
| `/api/technical-documents` | `backend/modules/technical-documents/routes/*` |
| `/api/asset-usage` | `backend/modules/asset-usage-management/routes/*` |
| `/api/preventive-maintenance` | `backend/modules/preventive-maintenance-management/routes/*` |
| `/api/maintenance-management` | `backend/modules/maintenance-management/routes/*` |
| `/api/acceptance-management` | `backend/modules/acceptance-management/routes/*` |
| `/api/quality-assurance` | `backend/modules/quality-assurance-management/routes/*` |
| `/api/asset-ai-assistant` | `backend/modules/asset-ai-assistant/routes/*` |
| `/api/tendering` | `backend/modules/tendering-management/routes/*` |
| `/api/quality-common` | `backend/modules/quality-common/routes/*` |
| `/api/ct-maintenance-assistant-management` | `backend/modules/ct-maintenance-assistant-management/routes/*` |
| `/api/dingtalk-binding` | `backend/modules/dingtalk-binding/routes/*` |
| `/api/wechat-binding` | `backend/modules/wechat-binding/routes/*` |

---

## 18. OpenClaw skill 编写 checklist

### 18.1 命名与作用域
- 工具命名采用 `assethub_<verb>_<noun>` 形式，例如：
  - `assethub_login`、`assethub_query_asset`、`assethub_create_maintenance_request`、`assethub_approve_transfer`。
- 同一动作多版本时加后缀区分：`assethub_list_assets_v2`（用 `/api/assets`）、`assethub_list_assets_legacy`（用 `/api/inventory*`）。

### 18.2 认证与租户继承
- OpenClaw 会话级注入 `_auth_context_id`（来自上游 SSO 或本地登录工具 `assethub_login`）。
- 任何工具实现内部都应：
  1. 调用 `assethub_login`（若 token 过期）刷新 token 与租户上下文。
  2. 对 `super_admin`：在工具 schema 中显式声明 `tenant_id: integer` 必填；写入前调用 `assethub_validate_tenant`。
  3. 对普通用户：禁止让用户传入 `tenant_id`，强制从 token 推断。

### 18.3 必填字段与默认
- 资产类工具一律要求 `asset_code`（字符串主键），禁用 `asset_id`。
- 列表查询默认 `page=1`、`pageSize=20`；超 100 条请客户端继续翻页。
- 时间字段统一 ISO8601。

### 18.4 查询前写入（query-before-write）
- 任何 `create/update/delete/approve/cancel/complete/close` 工具：
  1. 先用对应 `*_get` 工具查询目标。
  2. 校验状态机（如 `status` 是否允许本次动作）。
  3. 写入时携带稳定 `Idempotency-Key`（UUID）。
  4. 触发 428 时**停止自动化**，仅在用户明确确认（`ASSETHUB_HIGH_RISK_CONFIRM=YES`）后重放一次；仍 428 则告警并提示走 Web 审批。

### 18.5 限流与缓存
- `assethub_login`、`assethub_register` 命中 `loginLimiter`，工具说明应注明冷却时间。
- 列表与统计工具建议：
  - `permission_definitions`、`roles`、`modules`、`categories/tree` 缓存 5 分钟。
  - 仪表盘数据缓存 30–60 秒。
  - 资产详情/状态机缓存 ≤ 30 秒。

### 18.6 文件与多媒体
- 仅以下端点使用 `multipart/form-data`，文件字段必须为 `file`：
  - `POST /api/assets/import`
  - `POST /api/acceptance-management/records/:id/files`
  - `POST /api/technical-documents/...`（多个上传端点）
  - `POST /api/maintenance-management/workorders/:id/materials`（视实现）
- 描述中需声明 `Content-Type: multipart/form-data` 与最大尺寸。

### 18.7 流式响应
- `POST /api/ai/chat/completions`、`POST /api/ai-assistant/stream`、`POST /api/maintenance-ai/analyze` 可能为 SSE。
- 工具描述需注明 `Content-Type: text/event-stream` 与 `delta` 字段累积方式。

### 18.8 高危入口（专用工具）
- `assethub_submit_repair_request`：固定调用 `POST /api/maintenance/ai/submit-request`，**不**触发 highRiskActionGate，状态固定为 `待审批`。
- `assethub_submit_idempotent_write`：通用高危写入工具，需在 schema 中声明 `confirm: boolean`、`idempotency_key: string`、`action: string`、`target: object`。

### 18.9 租户隔离与权限
- 工具内部调用 `assethub_user_check_permission(permission_code, resource?)`：
  - 系统级：`manage_users`、`system_config`、`backup`。
  - 资产级：`asset_create`、`asset_delete`、`asset_share`、`asset_import`。
  - 维修级：`maintenance_request_create`、`maintenance_workorder_assign`。
- 缺权限时返回结构化错误（不要直接抛异常），便于模型给出降级方案。

### 18.10 调用顺序约定
1. `assethub_login`（若未登录）。
2. `assethub_discover_modules` → `assethub_discover_module <path>`（了解端点）。
3. `assethub_query_*` 验证对象存在。
4. `assethub_submit_*` 写入（带 `Idempotency-Key`）。
5. `assethub_query_*` 回读校验。
6. 在最终答复中以中文总结前后状态。

### 18.11 文档与一致性
- 工具 schema 与本文件保持一致；如后端新增端点，先更新本文件再实现工具。
- OpenClaw skill 描述中**禁止**硬编码 token/租户/凭据。

---

## 19. 附录 A：核心端点速查（精选）

| 工具 | 方法+路径 | 关键 body/参数 | 备注 |
|---|---|---|---|
| 登录 | `POST /api/users/login` | `{username, password}` | 返回 `token`、`user`、`tenant_id`。 |
| 当前用户 | `GET /api/users/me` | - | 返回角色与有效租户。 |
| 资产列表 | `GET /api/assets?page&pageSize&status&category_id&department_id` | - | 用 `asset_code` 而非 `asset_id`。 |
| 资产详情 | `GET /api/assets/:id` | - | `:id` 兼容 `asset_code` 或数字 ID。 |
| 创建资产 | `POST /api/assets` | `{asset_code, name, category_id, department_id, status, ...}` | 必填 `requireTenantId`。 |
| 创建维修申请 | `POST /api/maintenance-management/requests` | `{asset_code, fault_description, priority}` | 可被 highRiskActionGate 拦截。 |
| AI 安全维修 | `POST /api/maintenance/ai/submit-request` | `{asset_code, fault_description, issue_description?, source, intent}` | 不触发 428。 |
| 资产转移申请 | `POST /api/assets/:id/transfer-apply` | `{to_department_id, reason}` | 高危。 |
| 转移审批 | `POST /api/assets/transfer-requests/:request_id/approve` | `{approve: true, comment}` | 高危。 |
| 报废申请 | `POST /api/scrapping` | `{asset_code, reason}` | 高危 + 审计。 |
| 盘点任务分配 | `PUT /api/inventory-tasks/:id/assign` | `{assignee_id}` | - |
| AI 资产分析 | `POST /api/asset-ai-analysis/analyze-asset/:assetCode` | `{dimensions?: string[]}` | 异步，可轮询 `/reports/:id`。 |
| 工单派工 | `POST /api/maintenance-management/workorders/:id/assign` | `{engineer_id}` | - |
| 智能告警 | `GET /api/intelligent-alerts?rule_id&severity&status` | - | - |

---

## 20. 附录 B：常见集成模式

1. **登录 → 列表 → 详情 → 创建/更新 → 回读** —— 最常用流程。
2. **查询 → 校验 → 高危写入（二次确认）→ 回读** —— 适用于 transfer、scrapping、maintenance 审批类动作。
3. **上传 → 查询处理进度 → 下载结果** —— 适用于 `import`、`backup`、`technical-documents` 大文件场景。
4. **AI 流式问答 → 触发后续动作** —— `chat/completions` → `analyze-asset` → `submit-request`。
5. **定时巡检** —— `intelligent-alerts` + `analysis` + `dashboard`，按 `cron` 触发告警。

---

## 21. 附录 C：参考资料

- `backend/server.js` —— 路由挂载入口。
- `backend/routes/` 与 `backend/modules/*/routes/` —— 端点定义源码。
- `backend/middleware/` —— 认证、租户、限流、审计、高危网关实现。
- `backend/.env` —— 数据库/连接配置（参考 `project_rules.md`）。
- `docs/API_全量接口说明_供AI读取.md` —— 运行时汇总（OpenAPI 自动生成）。
- 现有 skill 草稿：`docs/skill-drafts/openclaw-assethub/SKILL.md`、`docs/skill-drafts/openclaw-assethub-direct-api/SKILL.md`。
- `docs/AGENTS.md` —— 项目级 AI 协作说明。

> 后续如发现路由与本文档不一致，以 `backend/server.js` 与路由文件源码为准，并同步更新本文档。