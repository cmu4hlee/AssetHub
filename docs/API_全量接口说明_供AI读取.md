# API全量接口说明（供AI读取）

> 生成时间：2026-03-21 22:25:26
> 文档来源：运行中后端 `GET /api/api-documentation` 自动汇总（OpenAPI Runtime Specs）
> 接口总数：688，模块数：60

## 1. 文档用途
- 本文档用于让 AI 快速读取系统全部接口的路径、方法、参数与调用要点。
- 如接口行为与本文档不一致，以后端实时返回和数据库状态为准。

## 2. 基础调用说明
- Base URL：`/api`（本地示例完整地址：`http://localhost:5183/api`）
- 认证方式：Bearer Token，Header：`Authorization`
- 认证示例：`Bearer <JWT_TOKEN>`
- 建议调用顺序：先登录获取 Token，再按业务模块调用。

## 3. 通用请求头与分页参数
| 参数 | 类型 | 说明 |
|---|---|---|
| `Authorization` | `string` | Bearer Token，格式：Bearer <token> |
| `X-Tenant-ID` | `integer` | 可选租户上下文头，超级管理员跨租户时使用 |
| `page` | `integer` | 分页页码，默认1 |
| `pageSize` | `integer` | 分页大小，常见默认值为10/20 |

## 4. 通用响应格式
### success
```json
{
  "success": true,
  "data": {
    "any": "payload"
  },
  "timestamp": "2026-02-26T08:00:00.000Z"
}
```

### error
```json
{
  "success": false,
  "message": "错误信息",
  "code": "BAD_REQUEST",
  "timestamp": "2026-02-26T08:00:00.000Z",
  "path": "/api/example",
  "method": "GET",
  "data": null
}
```

### pagination
```json
{
  "page": 1,
  "pageSize": 20,
  "total": 100,
  "totalPages": 5
}
```

## 5. 错误码参考
| HTTP状态码 | 含义 | 说明 |
|---|---|---|
| `400` | 请求参数错误 | 参数缺失、格式错误或业务校验失败 |
| `401` | 未授权 | 未登录或Token无效 |
| `403` | 无权限访问 | 当前用户权限不足或缺少租户上下文 |
| `404` | 资源不存在 | 请求路径或资源ID不存在 |
| `429` | 请求过于频繁 | 触发接口限流策略 |
| `500` | 服务器内部错误 | 服务内部异常，请查看日志排查 |

## 6. 模块索引
| 模块路径 | 模块名 | 接口数 | 模块说明 |
|---|---:|---:|---|
| `/acceptance` | 验收模块 | 12 | 资产验收记录与流程相关接口。 |
| `/adverse-events` | adverse events 模块 | 18 | 来自 /adverse-events 的接口集合 |
| `/adverse-reaction` | adverse reaction 模块 | 18 | 来自 /adverse-reaction 的接口集合 |
| `/agent-mesh` | agent mesh 模块 | 10 | 来自 /agent-mesh 的接口集合 |
| `/ai` | ai 模块 | 2 | 来自 /ai 的接口集合 |
| `/alive` | alive 模块 | 1 | 来自 /alive 的接口集合 |
| `/analysis` | analysis 模块 | 3 | 来自 /analysis 的接口集合 |
| `/api-documentation` | api documentation 模块 | 4 | 来自 /api-documentation 的接口集合 |
| `/asset-ai-analysis` | asset ai analysis 模块 | 8 | 来自 /asset-ai-analysis 的接口集合 |
| `/asset-depreciation` | asset depreciation 模块 | 10 | 来自 /asset-depreciation 的接口集合 |
| `/asset-images` | asset images 模块 | 1 | 来自 /asset-images 的接口集合 |
| `/asset-labels` | 资产标签模块 | 14 | 标签模板、生成与打印相关接口。 |
| `/asset-location` | 资产定位模块 | 13 | 资产定位与位置数据相关接口。 |
| `/assets` | 资产模块 | 16 | 资产全生命周期管理，包括台账、导入导出与统计。 |
| `/audit-logs` | 审计日志模块 | 3 | 系统操作审计与统计接口。 |
| `/backup` | 备份模块 | 6 | 数据备份与恢复相关接口。 |
| `/barcode-scan` | barcode scan 模块 | 5 | 来自 /barcode-scan 的接口集合 |
| `/circuit-breakers` | circuit breakers 模块 | 2 | 来自 /circuit-breakers 的接口集合 |
| `/compliance` | compliance 模块 | 3 | 来自 /compliance 的接口集合 |
| `/dashboard` | dashboard 模块 | 2 | 来自 /dashboard 的接口集合 |
| `/departments` | 部门模块 | 6 | 部门组织与科室管理相关接口。 |
| `/depreciation` | depreciation 模块 | 18 | 来自 /depreciation 的接口集合 |
| `/enhanced-permissions` | enhanced permissions 模块 | 16 | 来自 /enhanced-permissions 的接口集合 |
| `/health` | 系统健康模块 | 2 | 服务健康检查接口。 |
| `/i18n` | i18n 模块 | 4 | 来自 /i18n 的接口集合 |
| `/idle` | 闲置资产模块 | 7 | 闲置资产管理和再利用相关接口。 |
| `/integration` | integration 模块 | 11 | 来自 /integration 的接口集合 |
| `/intelligent-alerts` | intelligent alerts 模块 | 14 | 来自 /intelligent-alerts 的接口集合 |
| `/inventory` | 盘点模块 | 18 | 盘点任务与盘点执行相关接口。 |
| `/inventory-discrepancies` | inventory discrepancies 模块 | 6 | 来自 /inventory-discrepancies 的接口集合 |
| `/inventory-plans` | inventory plans 模块 | 8 | 来自 /inventory-plans 的接口集合 |
| `/inventory-tasks` | inventory tasks 模块 | 10 | 来自 /inventory-tasks 的接口集合 |
| `/iot` | 物联网模块 | 48 | IoT 设备与采集管道相关接口。 |
| `/iot-devices` | IoT设备模块 | 11 | IoT设备管理相关接口。 |
| `/location-alerts` | location alerts 模块 | 5 | 来自 /location-alerts 的接口集合 |
| `/location-codes` | location codes 模块 | 5 | 来自 /location-codes 的接口集合 |
| `/maintenance` | 维修维护模块 | 92 | 维修申请、工单、日志、计划与分析相关接口。 |
| `/menus` | menus 模块 | 4 | 来自 /menus 的接口集合 |
| `/metrics` | metrics 模块 | 1 | 来自 /metrics 的接口集合 |
| `/module-configs` | 模块配置模块 | 16 | 租户模块启停、配置、菜单权限相关接口。 |
| `/modules` | 模块管理模块 | 14 | 系统模块定义与依赖关系管理接口。 |
| `/procurement` | 采购管理模块 | 11 | 采购申请、审批、执行、附件与统计接口。 |
| `/quality` | quality 模块 | 25 | 来自 /quality 的接口集合 |
| `/quality-control` | 质量管理模块 | 30 | 计量与质量控制记录、统计与报告接口。 |
| `/ready` | ready 模块 | 1 | 来自 /ready 的接口集合 |
| `/risk` | risk 模块 | 3 | 来自 /risk 的接口集合 |
| `/roles-permissions` | 权限模块 | 18 | 角色、权限与菜单相关接口。 |
| `/safety-inspection` | safety inspection 模块 | 1 | 来自 /safety-inspection 的接口集合 |
| `/scrapping` | scrapping 模块 | 11 | 来自 /scrapping 的接口集合 |
| `/special-equipment` | special equipment 模块 | 1 | 来自 /special-equipment 的接口集合 |
| `/staff` | staff 模块 | 1 | 来自 /staff 的接口集合 |
| `/system-config` | system config 模块 | 11 | 来自 /system-config 的接口集合 |
| `/technical-documents` | 技术资料模块 | 59 | 技术资料上传、检索、AI分析相关接口。 |
| `/temp-assets` | temp assets 模块 | 5 | 来自 /temp-assets 的接口集合 |
| `/tenant-module-config` | 租户模块配置模块 | 11 | 租户维度模块配置与菜单同步接口。 |
| `/tenants` | tenants 模块 | 4 | 来自 /tenants 的接口集合 |
| `/transfer` | 调配模块 | 7 | 资产调配申请、审批与记录相关接口。 |
| `/uptime` | uptime 模块 | 2 | 来自 /uptime 的接口集合 |
| `/users` | 用户模块 | 15 | 用户登录、信息与认证相关接口。 |
| `/workflow` | workflow 模块 | 5 | 来自 /workflow 的接口集合 |

## 7. 全量接口清单（含使用说明）

### 模块 `/acceptance` - 验收模块
- 模块说明：资产验收记录与流程相关接口。
- 接口数量：12

| 方法 | 路径 | 接口摘要 | 参数说明 | 请求体说明 | 返回结构 | 使用说明 |
|---|---|---|---|---|---|---|
| `GET` | `/acceptance` | [Auto] GET /acceptance | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `DELETE` | `/acceptance/files/{id}` | [Auto] DELETE /acceptance/files/{id} | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于删除/撤销；调用前替换路径参数 {id} 等占位符 |
| `GET` | `/acceptance/files/{id}/download` | [Auto] GET /acceptance/files/{id}/download | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询；调用前替换路径参数 {id} 等占位符 |
| `GET` | `/acceptance/records` | [Auto] GET /acceptance/records | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `POST` | `/acceptance/records` | [Auto] POST /acceptance/records | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作 |
| `GET` | `/acceptance/records/{id}` | [Auto] GET /acceptance/records/{id} | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询；调用前替换路径参数 {id} 等占位符 |
| `PUT` | `/acceptance/records/{id}` | [Auto] PUT /acceptance/records/{id} | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于整体更新；调用前替换路径参数 {id} 等占位符 |
| `DELETE` | `/acceptance/records/{id}` | [Auto] DELETE /acceptance/records/{id} | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于删除/撤销；调用前替换路径参数 {id} 等占位符 |
| `GET` | `/acceptance/records/{id}/files` | [Auto] GET /acceptance/records/{id}/files | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询；调用前替换路径参数 {id} 等占位符 |
| `POST` | `/acceptance/records/{id}/files` | [Auto] POST /acceptance/records/{id}/files | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作；调用前替换路径参数 {id} 等占位符 |
| `PUT` | `/acceptance/records/{id}/status` | [Auto] PUT /acceptance/records/{id}/status | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于整体更新；调用前替换路径参数 {id} 等占位符 |
| `GET` | `/acceptance/statistics` | [Auto] GET /acceptance/statistics | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |

### 模块 `/adverse-events` - adverse events 模块
- 模块说明：来自 /adverse-events 的接口集合
- 接口数量：18

| 方法 | 路径 | 接口摘要 | 参数说明 | 请求体说明 | 返回结构 | 使用说明 |
|---|---|---|---|---|---|---|
| `GET` | `/adverse-events` | [Auto] GET /adverse-events | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `POST` | `/adverse-events` | [Auto] POST /adverse-events | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作 |
| `GET` | `/adverse-events/{id}` | [Auto] GET /adverse-events/{id} | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询；调用前替换路径参数 {id} 等占位符 |
| `PUT` | `/adverse-events/{id}` | [Auto] PUT /adverse-events/{id} | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于整体更新；调用前替换路径参数 {id} 等占位符 |
| `DELETE` | `/adverse-events/{id}` | [Auto] DELETE /adverse-events/{id} | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于删除/撤销；调用前替换路径参数 {id} 等占位符 |
| `POST` | `/adverse-events/{id}/approve` | [Auto] POST /adverse-events/{id}/approve | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作；调用前替换路径参数 {id} 等占位符 |
| `POST` | `/adverse-events/{id}/attachments` | [Auto] POST /adverse-events/{id}/attachments | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作；调用前替换路径参数 {id} 等占位符 |
| `POST` | `/adverse-events/{id}/close` | [Auto] POST /adverse-events/{id}/close | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作；调用前替换路径参数 {id} 等占位符 |
| `POST` | `/adverse-events/{id}/restore` | [Auto] POST /adverse-events/{id}/restore | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作；调用前替换路径参数 {id} 等占位符 |
| `GET` | `/adverse-events/{id}/workflow` | [Auto] GET /adverse-events/{id}/workflow | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询；调用前替换路径参数 {id} 等占位符 |
| `GET` | `/adverse-events/alerts/overdue` | [Auto] GET /adverse-events/alerts/overdue | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `DELETE` | `/adverse-events/attachments/{id}` | [Auto] DELETE /adverse-events/attachments/{id} | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于删除/撤销；调用前替换路径参数 {id} 等占位符 |
| `GET` | `/adverse-events/export/excel` | [Auto] GET /adverse-events/export/excel | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/adverse-events/recycle-bin` | [Auto] GET /adverse-events/recycle-bin | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/adverse-events/statistics/by-asset` | [Auto] GET /adverse-events/statistics/by-asset | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/adverse-events/statistics/by-department` | [Auto] GET /adverse-events/statistics/by-department | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/adverse-events/statistics/handle-efficiency` | [Auto] GET /adverse-events/statistics/handle-efficiency | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/adverse-events/statistics/overview` | [Auto] GET /adverse-events/statistics/overview | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |

### 模块 `/adverse-reaction` - adverse reaction 模块
- 模块说明：来自 /adverse-reaction 的接口集合
- 接口数量：18

| 方法 | 路径 | 接口摘要 | 参数说明 | 请求体说明 | 返回结构 | 使用说明 |
|---|---|---|---|---|---|---|
| `GET` | `/adverse-reaction` | [Auto] GET /adverse-reaction | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `POST` | `/adverse-reaction` | [Auto] POST /adverse-reaction | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作 |
| `GET` | `/adverse-reaction/{id}` | [Auto] GET /adverse-reaction/{id} | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询；调用前替换路径参数 {id} 等占位符 |
| `PUT` | `/adverse-reaction/{id}` | [Auto] PUT /adverse-reaction/{id} | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于整体更新；调用前替换路径参数 {id} 等占位符 |
| `DELETE` | `/adverse-reaction/{id}` | [Auto] DELETE /adverse-reaction/{id} | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于删除/撤销；调用前替换路径参数 {id} 等占位符 |
| `POST` | `/adverse-reaction/{id}/approve` | [Auto] POST /adverse-reaction/{id}/approve | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作；调用前替换路径参数 {id} 等占位符 |
| `POST` | `/adverse-reaction/{id}/attachments` | [Auto] POST /adverse-reaction/{id}/attachments | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作；调用前替换路径参数 {id} 等占位符 |
| `POST` | `/adverse-reaction/{id}/close` | [Auto] POST /adverse-reaction/{id}/close | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作；调用前替换路径参数 {id} 等占位符 |
| `POST` | `/adverse-reaction/{id}/restore` | [Auto] POST /adverse-reaction/{id}/restore | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作；调用前替换路径参数 {id} 等占位符 |
| `GET` | `/adverse-reaction/{id}/workflow` | [Auto] GET /adverse-reaction/{id}/workflow | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询；调用前替换路径参数 {id} 等占位符 |
| `GET` | `/adverse-reaction/alerts/overdue` | [Auto] GET /adverse-reaction/alerts/overdue | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `DELETE` | `/adverse-reaction/attachments/{id}` | [Auto] DELETE /adverse-reaction/attachments/{id} | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于删除/撤销；调用前替换路径参数 {id} 等占位符 |
| `GET` | `/adverse-reaction/export/excel` | [Auto] GET /adverse-reaction/export/excel | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/adverse-reaction/recycle-bin` | [Auto] GET /adverse-reaction/recycle-bin | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/adverse-reaction/statistics/by-asset` | [Auto] GET /adverse-reaction/statistics/by-asset | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/adverse-reaction/statistics/by-department` | [Auto] GET /adverse-reaction/statistics/by-department | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/adverse-reaction/statistics/handle-efficiency` | [Auto] GET /adverse-reaction/statistics/handle-efficiency | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/adverse-reaction/statistics/overview` | [Auto] GET /adverse-reaction/statistics/overview | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |

### 模块 `/agent-mesh` - agent mesh 模块
- 模块说明：来自 /agent-mesh 的接口集合
- 接口数量：10

| 方法 | 路径 | 接口摘要 | 参数说明 | 请求体说明 | 返回结构 | 使用说明 |
|---|---|---|---|---|---|---|
| `POST` | `/agent-mesh/init` | [Auto] POST /agent-mesh/init | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作 |
| `POST` | `/agent-mesh/intelligence/health-index` | [Auto] POST /agent-mesh/intelligence/health-index | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作 |
| `GET` | `/agent-mesh/intelligence/health-trend` | [Auto] GET /agent-mesh/intelligence/health-trend | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `POST` | `/agent-mesh/intelligence/predictive-maintenance` | [Auto] POST /agent-mesh/intelligence/predictive-maintenance | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作 |
| `POST` | `/agent-mesh/intelligence/risk-score` | [Auto] POST /agent-mesh/intelligence/risk-score | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作 |
| `GET` | `/agent-mesh/intelligence/risk-trend` | [Auto] GET /agent-mesh/intelligence/risk-trend | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `POST` | `/agent-mesh/message` | [Auto] POST /agent-mesh/message | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作 |
| `GET` | `/agent-mesh/microservice/events` | [Auto] GET /agent-mesh/microservice/events | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/agent-mesh/microservice/roadmap` | [Auto] GET /agent-mesh/microservice/roadmap | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/agent-mesh/topology` | [Auto] GET /agent-mesh/topology | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |

### 模块 `/ai` - ai 模块
- 模块说明：来自 /ai 的接口集合
- 接口数量：2

| 方法 | 路径 | 接口摘要 | 参数说明 | 请求体说明 | 返回结构 | 使用说明 |
|---|---|---|---|---|---|---|
| `POST` | `/ai/chat/completions` | [Auto] POST /ai/chat/completions | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作 |
| `GET` | `/ai/config` | [Auto] GET /ai/config | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |

### 模块 `/alive` - alive 模块
- 模块说明：来自 /alive 的接口集合
- 接口数量：1

| 方法 | 路径 | 接口摘要 | 参数说明 | 请求体说明 | 返回结构 | 使用说明 |
|---|---|---|---|---|---|---|
| `GET` | `/alive` | [Auto] GET /alive | - | - | object: success, data, message, timestamp | 通常可匿名访问；用于查询 |

### 模块 `/analysis` - analysis 模块
- 模块说明：来自 /analysis 的接口集合
- 接口数量：3

| 方法 | 路径 | 接口摘要 | 参数说明 | 请求体说明 | 返回结构 | 使用说明 |
|---|---|---|---|---|---|---|
| `GET` | `/analysis` | [Auto] GET /analysis | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/analysis/depreciation` | [Auto] GET /analysis/depreciation | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/analysis/value-distribution` | [Auto] GET /analysis/value-distribution | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |

### 模块 `/api-documentation` - api documentation 模块
- 模块说明：来自 /api-documentation 的接口集合
- 接口数量：4

| 方法 | 路径 | 接口摘要 | 参数说明 | 请求体说明 | 返回结构 | 使用说明 |
|---|---|---|---|---|---|---|
| `GET` | `/api-documentation` | [Auto] GET /api-documentation | - | - | object: success, data, message, timestamp | 通常可匿名访问；用于查询 |
| `GET` | `/api-documentation/endpoints` | [Auto] GET /api-documentation/endpoints | - | - | object: success, data, message, timestamp | 通常可匿名访问；用于查询 |
| `GET` | `/api-documentation/module/{path}` | [Auto] GET /api-documentation/module/{path} | path(string,必填): path 参数 | - | object: success, data, message, timestamp | 通常可匿名访问；用于查询；调用前替换路径参数 {id} 等占位符 |
| `GET` | `/api-documentation/modules` | [Auto] GET /api-documentation/modules | - | - | object: success, data, message, timestamp | 通常可匿名访问；用于查询 |

### 模块 `/asset-ai-analysis` - asset ai analysis 模块
- 模块说明：来自 /asset-ai-analysis 的接口集合
- 接口数量：8

| 方法 | 路径 | 接口摘要 | 参数说明 | 请求体说明 | 返回结构 | 使用说明 |
|---|---|---|---|---|---|---|
| `GET` | `/asset-ai-analysis/analysis-history` | [Auto] GET /asset-ai-analysis/analysis-history | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `POST` | `/asset-ai-analysis/analyze-asset/{assetCode}` | [Auto] POST /asset-ai-analysis/analyze-asset/{assetCode} | assetCode(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作；调用前替换路径参数 {id} 等占位符 |
| `POST` | `/asset-ai-analysis/analyze-assets` | [Auto] POST /asset-ai-analysis/analyze-assets | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作 |
| `POST` | `/asset-ai-analysis/custom-analysis` | [Auto] POST /asset-ai-analysis/custom-analysis | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作 |
| `GET` | `/asset-ai-analysis/datasources` | [Auto] GET /asset-ai-analysis/datasources | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/asset-ai-analysis/dimensions` | [Auto] GET /asset-ai-analysis/dimensions | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/asset-ai-analysis/question-records` | [Auto] GET /asset-ai-analysis/question-records | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/asset-ai-analysis/reports/{id}` | [Auto] GET /asset-ai-analysis/reports/{id} | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询；调用前替换路径参数 {id} 等占位符 |

### 模块 `/asset-depreciation` - asset depreciation 模块
- 模块说明：来自 /asset-depreciation 的接口集合
- 接口数量：10

| 方法 | 路径 | 接口摘要 | 参数说明 | 请求体说明 | 返回结构 | 使用说明 |
|---|---|---|---|---|---|---|
| `GET` | `/asset-depreciation` | [Auto] GET /asset-depreciation | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/asset-depreciation/depreciation` | [Auto] GET /asset-depreciation/depreciation | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `POST` | `/asset-depreciation/depreciation/calculate` | [Auto] POST /asset-depreciation/depreciation/calculate | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作 |
| `GET` | `/asset-depreciation/depreciation/export` | [Auto] GET /asset-depreciation/depreciation/export | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/asset-depreciation/depreciation/methods` | [Auto] GET /asset-depreciation/depreciation/methods | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/asset-depreciation/depreciation/monthly-summary` | [Auto] GET /asset-depreciation/depreciation/monthly-summary | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/asset-depreciation/depreciation/schedule/{assetId}` | [Auto] GET /asset-depreciation/depreciation/schedule/{assetId} | assetId(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询；调用前替换路径参数 {id} 等占位符 |
| `GET` | `/asset-depreciation/depreciation/summary/by-department` | [Auto] GET /asset-depreciation/depreciation/summary/by-department | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/asset-depreciation/depreciation/summary/by-type` | [Auto] GET /asset-depreciation/depreciation/summary/by-type | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/asset-depreciation/depreciation/years-summary` | [Auto] GET /asset-depreciation/depreciation/years-summary | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |

### 模块 `/asset-images` - asset images 模块
- 模块说明：来自 /asset-images 的接口集合
- 接口数量：1

| 方法 | 路径 | 接口摘要 | 参数说明 | 请求体说明 | 返回结构 | 使用说明 |
|---|---|---|---|---|---|---|
| `GET` | `/asset-images` | [Auto] GET /asset-images | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |

### 模块 `/asset-labels` - 资产标签模块
- 模块说明：标签模板、生成与打印相关接口。
- 接口数量：14

| 方法 | 路径 | 接口摘要 | 参数说明 | 请求体说明 | 返回结构 | 使用说明 |
|---|---|---|---|---|---|---|
| `GET` | `/asset-labels` | [Auto] GET /asset-labels | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/asset-labels/assets-by-code-range` | [Auto] GET /asset-labels/assets-by-code-range | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `POST` | `/asset-labels/generate-zpl-batch` | 批量生成ZPL标签 | - | asset_codes(array,必填): 资产编码列表; template_id(integer,必填): 模板ID; quantity_per_asset(integer,可选): 每个资产打印数量 | object: success, message | 默认需 Bearer Token；用于创建/触发动作；Body 采用 JSON（除 file 字段外） |
| `GET` | `/asset-labels/generate-zpl/{templateId}/{assetCode}` | 生成ZPL标签 | templateId(integer,必填): path 参数; assetCode(string,必填): path 参数 | - | object: success, message | 默认需 Bearer Token；用于查询；调用前替换路径参数 {id} 等占位符 |
| `POST` | `/asset-labels/print` | 打印标签 | - | asset_code(string,必填): 资产编码; template_id(integer,必填): 模板ID; printer_ip(string,必填): 打印机IP地址; printer_port(integer,可选): 打印机端口; quantity(integer,必填): 打印数量; print_timeout_ms(integer,可选): 打印超时(毫秒); retry_count(integer,可选): 失败重试次数 | object: success, message | 默认需 Bearer Token；用于创建/触发动作；Body 采用 JSON（除 file 字段外） |
| `GET` | `/asset-labels/print-queue` | 获取打印队列 | status(string,可选): 任务状态 | - | object: success, message | 默认需 Bearer Token；用于查询 |
| `PUT` | `/asset-labels/print-queue/{id}/status` | 更新打印任务状态 | id(integer,必填): 任务ID | status(string,必填); error_message(string,可选): 错误信息 | object: success, message | 默认需 Bearer Token；用于整体更新；Body 采用 JSON（除 file 字段外）；调用前替换路径参数 {id} 等占位符 |
| `POST` | `/asset-labels/print/batch` | 批量打印标签 | - | asset_codes(array,必填): 资产编码列表; template_id(integer,必填): 模板ID; printer_ip(string,必填): 打印机IP地址; printer_port(integer,可选): 打印机端口; quantity_per_asset(integer,可选): 每个资产打印数量; print_timeout_ms(integer,可选): 打印超时(毫秒); retry_count(integer,可选): 失败重试次数 | object: success, message | 默认需 Bearer Token；用于创建/触发动作；Body 采用 JSON（除 file 字段外） |
| `POST` | `/asset-labels/printer/test-connection` | 测试打印机连通性 | - | printer_ip(string,必填): 打印机IP地址; printer_port(integer,可选): 打印机端口; timeout_ms(integer,可选): 连接超时(毫秒) | object: success, message | 默认需 Bearer Token；用于创建/触发动作；Body 采用 JSON（除 file 字段外） |
| `GET` | `/asset-labels/templates` | 获取标签模板列表 | page(integer,可选): 页码; pageSize(integer,可选): 每页数量 | - | object: success, message | 默认需 Bearer Token；用于查询 |
| `POST` | `/asset-labels/templates` | 创建标签模板 | - | name(string,必填): 模板名称; description(string,可选): 模板描述; width(number,必填): 标签宽度（英寸）; height(number,必填): 标签高度（英寸）; dpi(number,可选): 打印机DPI; fields(array,必填): 标签字段列表 | object: success, message | 默认需 Bearer Token；用于创建/触发动作；Body 采用 JSON（除 file 字段外） |
| `GET` | `/asset-labels/templates/{id}` | 获取标签模板详情 | id(integer,必填): 模板ID | - | object: success, message | 默认需 Bearer Token；用于查询；调用前替换路径参数 {id} 等占位符 |
| `PUT` | `/asset-labels/templates/{id}` | 更新标签模板 | id(integer,必填): 模板ID | name(string,可选): 模板名称; description(string,可选): 模板描述; width(number,可选): 标签宽度（英寸）; height(number,可选): 标签高度（英寸）; dpi(number,可选): 打印机DPI; fields(array,可选): 标签字段列表 | object: success, message | 默认需 Bearer Token；用于整体更新；Body 采用 JSON（除 file 字段外）；调用前替换路径参数 {id} 等占位符 |
| `DELETE` | `/asset-labels/templates/{id}` | 删除标签模板 | id(integer,必填): 模板ID | - | object: success, message | 默认需 Bearer Token；用于删除/撤销；调用前替换路径参数 {id} 等占位符 |

### 模块 `/asset-location` - 资产定位模块
- 模块说明：资产定位与位置数据相关接口。
- 接口数量：13

| 方法 | 路径 | 接口摘要 | 参数说明 | 请求体说明 | 返回结构 | 使用说明 |
|---|---|---|---|---|---|---|
| `GET` | `/asset-location` | [Auto] GET /asset-location | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `POST` | `/asset-location/assets/{assetIdOrCode}/bind-device` | [Auto] POST /asset-location/assets/{assetIdOrCode}/bind-device | assetIdOrCode(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作；调用前替换路径参数 {id} 等占位符 |
| `GET` | `/asset-location/assets/{assetIdOrCode}/devices` | [Auto] GET /asset-location/assets/{assetIdOrCode}/devices | assetIdOrCode(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询；调用前替换路径参数 {id} 等占位符 |
| `GET` | `/asset-location/assets/{assetIdOrCode}/location` | [Auto] GET /asset-location/assets/{assetIdOrCode}/location | assetIdOrCode(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询；调用前替换路径参数 {id} 等占位符 |
| `POST` | `/asset-location/assets/{assetIdOrCode}/location` | [Auto] POST /asset-location/assets/{assetIdOrCode}/location | assetIdOrCode(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作；调用前替换路径参数 {id} 等占位符 |
| `GET` | `/asset-location/assets/{assetIdOrCode}/location/history` | [Auto] GET /asset-location/assets/{assetIdOrCode}/location/history | assetIdOrCode(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询；调用前替换路径参数 {id} 等占位符 |
| `POST` | `/asset-location/assets/{assetIdOrCode}/unbind-device` | [Auto] POST /asset-location/assets/{assetIdOrCode}/unbind-device | assetIdOrCode(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作；调用前替换路径参数 {id} 等占位符 |
| `POST` | `/asset-location/assets/in-area` | [Auto] POST /asset-location/assets/in-area | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作 |
| `POST` | `/asset-location/assets/locations` | [Auto] POST /asset-location/assets/locations | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作 |
| `GET` | `/asset-location/beacon-assets` | [Auto] GET /asset-location/beacon-assets | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `POST` | `/asset-location/beacon-location` | [Auto] POST /asset-location/beacon-location | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作 |
| `GET` | `/asset-location/devices` | [Auto] GET /asset-location/devices | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `POST` | `/asset-location/devices` | [Auto] POST /asset-location/devices | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作 |

### 模块 `/assets` - 资产模块
- 模块说明：资产全生命周期管理，包括台账、导入导出与统计。
- 接口数量：16

| 方法 | 路径 | 接口摘要 | 参数说明 | 请求体说明 | 返回结构 | 使用说明 |
|---|---|---|---|---|---|---|
| `GET` | `/assets` | 获取资产列表 | page(integer,可选): query 参数; pageSize(integer,可选): query 参数; search(string,可选): query 参数; status(string,可选): query 参数; department_id(integer,可选): query 参数 | - | object: success, message | 默认需 Bearer Token；用于查询 |
| `POST` | `/assets` | 创建资产 | - | payload(string,必填): application/json 请求体 | object: success, message | 默认需 Bearer Token；用于创建/触发动作；Body 采用 JSON（除 file 字段外） |
| `GET` | `/assets/{assetId}/images` | [Auto] GET /assets/{assetId}/images | assetId(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询；调用前替换路径参数 {id} 等占位符 |
| `POST` | `/assets/{assetId}/images` | [Auto] POST /assets/{assetId}/images | assetId(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作；调用前替换路径参数 {id} 等占位符 |
| `GET` | `/assets/{id}` | 获取资产详情 | id(integer,必填): path 参数 | - | object: success, message | 默认需 Bearer Token；用于查询；调用前替换路径参数 {id} 等占位符 |
| `PUT` | `/assets/{id}` | 更新资产 | id(integer,必填): path 参数 | payload(string,必填): application/json 请求体 | - | 默认需 Bearer Token；用于整体更新；Body 采用 JSON（除 file 字段外）；调用前替换路径参数 {id} 等占位符 |
| `DELETE` | `/assets/{id}` | 删除资产 | id(integer,必填): path 参数 | - | - | 默认需 Bearer Token；用于删除/撤销；调用前替换路径参数 {id} 等占位符 |
| `GET` | `/assets/{id}/change-logs` | 获取资产变更日志 | - | - | - | 默认需 Bearer Token；用于查询；调用前替换路径参数 {id} 等占位符 |
| `GET` | `/assets/{id}/transitions` | 获取资产可执行的状态迁移 | - | - | - | 默认需 Bearer Token；用于查询；调用前替换路径参数 {id} 等占位符 |
| `GET` | `/assets/departments/list` | 获取部门列表（用于资产筛选） | - | - | - | 默认需 Bearer Token；用于查询 |
| `GET` | `/assets/duplicate-check` | 检查资产编码是否重复 | asset_code(string,必填): query 参数 | - | object: success, message | 默认需 Bearer Token；用于查询 |
| `GET` | `/assets/export` | 导出资产Excel | status(string,可选): query 参数; keyword(string,可选): query 参数 | - | object: success, message | 默认需 Bearer Token；用于查询 |
| `PUT` | `/assets/images/{imageId}` | [Auto] PUT /assets/images/{imageId} | imageId(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于整体更新；调用前替换路径参数 {id} 等占位符 |
| `DELETE` | `/assets/images/{imageId}` | [Auto] DELETE /assets/images/{imageId} | imageId(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于删除/撤销；调用前替换路径参数 {id} 等占位符 |
| `POST` | `/assets/import` | 导入资产Excel | - | file(file,必填) | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作；Body 采用 JSON（除 file 字段外） |
| `GET` | `/assets/import-template` | 下载资产导入模板 | - | - | object: success, message | 默认需 Bearer Token；用于查询 |

### 模块 `/audit-logs` - 审计日志模块
- 模块说明：系统操作审计与统计接口。
- 接口数量：3

| 方法 | 路径 | 接口摘要 | 参数说明 | 请求体说明 | 返回结构 | 使用说明 |
|---|---|---|---|---|---|---|
| `GET` | `/audit-logs` | 获取操作日志列表 | page(integer,可选): 页码; pageSize(integer,可选): 每页数量; user_id(integer,可选): 用户ID筛选; username(string,可选): 用户名筛选; action_type(string,可选): 操作类型筛选; module(string,可选): 模块筛选（assets, users, technical-documents等）; resource_type(string,可选): 资源类型筛选; resource_id(integer,可选): 资源ID筛选; start_date(string,可选): 开始日期（YYYY-MM-DD）; end_date(string,可选): 结束日期（YYYY-MM-DD）; keyword(string,可选): 关键词搜索（操作描述、资源名称） | - | object: success, message | 默认需 Bearer Token；用于查询 |
| `GET` | `/audit-logs/{id}` | 获取操作日志详情 | id(integer,必填): 日志ID | - | object: success, message | 默认需 Bearer Token；用于查询；调用前替换路径参数 {id} 等占位符 |
| `GET` | `/audit-logs/stats` | 获取操作日志统计 | start_date(string,可选): 开始日期（YYYY-MM-DD）; end_date(string,可选): 结束日期（YYYY-MM-DD） | - | object: success, message | 默认需 Bearer Token；用于查询 |

### 模块 `/backup` - 备份模块
- 模块说明：数据备份与恢复相关接口。
- 接口数量：6

| 方法 | 路径 | 接口摘要 | 参数说明 | 请求体说明 | 返回结构 | 使用说明 |
|---|---|---|---|---|---|---|
| `GET` | `/backup` | 获取备份列表 | - | - | object: success, message | 默认需 Bearer Token；用于查询 |
| `POST` | `/backup` | 创建数据库备份 | - | description(string,可选): 备份描述（可选） | object: success, message | 默认需 Bearer Token；用于创建/触发动作；Body 采用 JSON（除 file 字段外） |
| `DELETE` | `/backup/{id}` | 删除备份文件 | id(integer,必填): 备份ID | - | object: success, message | 默认需 Bearer Token；用于删除/撤销；调用前替换路径参数 {id} 等占位符 |
| `GET` | `/backup/{id}/download` | 下载备份文件 | id(integer,必填): 备份ID | - | object: success, message | 默认需 Bearer Token；用于查询；调用前替换路径参数 {id} 等占位符 |
| `POST` | `/backup/{id}/restore` | 恢复数据库备份 | id(integer,必填): 备份ID | confirm(boolean,必填): 确认恢复（必须为 true） | object: success, message | 默认需 Bearer Token；用于创建/触发动作；Body 采用 JSON（除 file 字段外）；调用前替换路径参数 {id} 等占位符 |
| `POST` | `/backup/add-tenant-id` | 为表添加tenant_id字段 | - | - | object: success, message | 默认需 Bearer Token；用于创建/触发动作 |

### 模块 `/barcode-scan` - barcode scan 模块
- 模块说明：来自 /barcode-scan 的接口集合
- 接口数量：5

| 方法 | 路径 | 接口摘要 | 参数说明 | 请求体说明 | 返回结构 | 使用说明 |
|---|---|---|---|---|---|---|
| `GET` | `/barcode-scan` | [Auto] GET /barcode-scan | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/barcode-scan/generate/{asset_code}` | [Auto] GET /barcode-scan/generate/{asset_code} | asset_code(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询；调用前替换路径参数 {id} 等占位符 |
| `POST` | `/barcode-scan/inventory` | [Auto] POST /barcode-scan/inventory | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作 |
| `GET` | `/barcode-scan/logs` | [Auto] GET /barcode-scan/logs | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `POST` | `/barcode-scan/verify` | [Auto] POST /barcode-scan/verify | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作 |

### 模块 `/circuit-breakers` - circuit breakers 模块
- 模块说明：来自 /circuit-breakers 的接口集合
- 接口数量：2

| 方法 | 路径 | 接口摘要 | 参数说明 | 请求体说明 | 返回结构 | 使用说明 |
|---|---|---|---|---|---|---|
| `GET` | `/circuit-breakers` | [Auto] GET /circuit-breakers | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `POST` | `/circuit-breakers/{name}/reset` | [Auto] POST /circuit-breakers/{name}/reset | name(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作；调用前替换路径参数 {id} 等占位符 |

### 模块 `/compliance` - compliance 模块
- 模块说明：来自 /compliance 的接口集合
- 接口数量：3

| 方法 | 路径 | 接口摘要 | 参数说明 | 请求体说明 | 返回结构 | 使用说明 |
|---|---|---|---|---|---|---|
| `GET` | `/compliance` | [Auto] GET /compliance | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/compliance/dashboard-stats` | [Auto] GET /compliance/dashboard-stats | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/compliance/status` | [Auto] GET /compliance/status | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |

### 模块 `/dashboard` - dashboard 模块
- 模块说明：来自 /dashboard 的接口集合
- 接口数量：2

| 方法 | 路径 | 接口摘要 | 参数说明 | 请求体说明 | 返回结构 | 使用说明 |
|---|---|---|---|---|---|---|
| `GET` | `/dashboard` | [Auto] GET /dashboard | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/dashboard/realtime` | [Auto] GET /dashboard/realtime | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |

### 模块 `/departments` - 部门模块
- 模块说明：部门组织与科室管理相关接口。
- 接口数量：6

| 方法 | 路径 | 接口摘要 | 参数说明 | 请求体说明 | 返回结构 | 使用说明 |
|---|---|---|---|---|---|---|
| `GET` | `/departments` | 获取部门列表 | keyword(string,可选): 关键词搜索（部门名称或编码）; page(integer,可选): 页码; pageSize(integer,可选): 每页数量 | - | object: success, data, pagination | 默认需 Bearer Token；用于查询 |
| `POST` | `/departments` | 创建部门 | - | department_name(string,必填): 部门名称; parent_code(string,可选): 父部门编码 | object: success, message | 默认需 Bearer Token；用于创建/触发动作；Body 采用 JSON（除 file 字段外） |
| `GET` | `/departments/{id}` | 获取部门详情 | id(integer,必填): 部门ID | - | object: success, message | 默认需 Bearer Token；用于查询；调用前替换路径参数 {id} 等占位符 |
| `PUT` | `/departments/{id}` | 更新部门 | id(integer,必填): 部门ID | department_name(string,可选): 部门名称; parent_code(string,可选): 父部门编码 | object: success, message | 默认需 Bearer Token；用于整体更新；Body 采用 JSON（除 file 字段外）；调用前替换路径参数 {id} 等占位符 |
| `DELETE` | `/departments/{id}` | 删除部门 | id(integer,必填): 部门ID | - | object: success, message | 默认需 Bearer Token；用于删除/撤销；调用前替换路径参数 {id} 等占位符 |
| `GET` | `/departments/tree` | [Auto] GET /departments/tree | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |

### 模块 `/depreciation` - depreciation 模块
- 模块说明：来自 /depreciation 的接口集合
- 接口数量：18

| 方法 | 路径 | 接口摘要 | 参数说明 | 请求体说明 | 返回结构 | 使用说明 |
|---|---|---|---|---|---|---|
| `GET` | `/depreciation` | [Auto] GET /depreciation | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `POST` | `/depreciation/calculate` | [Auto] POST /depreciation/calculate | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作 |
| `GET` | `/depreciation/depreciation` | [Auto] GET /depreciation/depreciation | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `POST` | `/depreciation/depreciation/calculate` | [Auto] POST /depreciation/depreciation/calculate | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作 |
| `GET` | `/depreciation/depreciation/export` | [Auto] GET /depreciation/depreciation/export | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/depreciation/depreciation/methods` | [Auto] GET /depreciation/depreciation/methods | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/depreciation/depreciation/monthly-summary` | [Auto] GET /depreciation/depreciation/monthly-summary | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/depreciation/depreciation/summary/by-department` | [Auto] GET /depreciation/depreciation/summary/by-department | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/depreciation/depreciation/summary/by-month` | [Auto] GET /depreciation/depreciation/summary/by-month | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/depreciation/depreciation/summary/by-type` | [Auto] GET /depreciation/depreciation/summary/by-type | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/depreciation/depreciation/summary/by-year` | [Auto] GET /depreciation/depreciation/summary/by-year | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/depreciation/depreciation/years-summary` | [Auto] GET /depreciation/depreciation/years-summary | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/depreciation/export` | [Auto] GET /depreciation/export | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/depreciation/methods` | [Auto] GET /depreciation/methods | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/depreciation/summary/by-department` | [Auto] GET /depreciation/summary/by-department | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/depreciation/summary/by-month` | [Auto] GET /depreciation/summary/by-month | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/depreciation/summary/by-type` | [Auto] GET /depreciation/summary/by-type | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/depreciation/summary/by-year` | [Auto] GET /depreciation/summary/by-year | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |

### 模块 `/enhanced-permissions` - enhanced permissions 模块
- 模块说明：来自 /enhanced-permissions 的接口集合
- 接口数量：16

| 方法 | 路径 | 接口摘要 | 参数说明 | 请求体说明 | 返回结构 | 使用说明 |
|---|---|---|---|---|---|---|
| `GET` | `/enhanced-permissions` | [Auto] GET /enhanced-permissions | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/enhanced-permissions/audit-logs` | [Auto] GET /enhanced-permissions/audit-logs | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/enhanced-permissions/data-scopes/definitions` | [Auto] GET /enhanced-permissions/data-scopes/definitions | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/enhanced-permissions/resource-permissions` | [Auto] GET /enhanced-permissions/resource-permissions | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/enhanced-permissions/roles/{role}/data-scope` | [Auto] GET /enhanced-permissions/roles/{role}/data-scope | role(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询；调用前替换路径参数 {id} 等占位符 |
| `PUT` | `/enhanced-permissions/roles/{role}/data-scope` | [Auto] PUT /enhanced-permissions/roles/{role}/data-scope | role(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于整体更新；调用前替换路径参数 {id} 等占位符 |
| `GET` | `/enhanced-permissions/users/{userId}/data-scope` | [Auto] GET /enhanced-permissions/users/{userId}/data-scope | userId(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询；调用前替换路径参数 {id} 等占位符 |
| `PUT` | `/enhanced-permissions/users/{userId}/data-scope` | [Auto] PUT /enhanced-permissions/users/{userId}/data-scope | userId(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于整体更新；调用前替换路径参数 {id} 等占位符 |
| `GET` | `/enhanced-permissions/users/{userId}/menu-permissions` | [Auto] GET /enhanced-permissions/users/{userId}/menu-permissions | userId(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询；调用前替换路径参数 {id} 等占位符 |
| `POST` | `/enhanced-permissions/users/{userId}/menu-permissions` | [Auto] POST /enhanced-permissions/users/{userId}/menu-permissions | userId(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作；调用前替换路径参数 {id} 等占位符 |
| `DELETE` | `/enhanced-permissions/users/{userId}/menu-permissions/{menuKey}` | [Auto] DELETE /enhanced-permissions/users/{userId}/menu-permissions/{menuKey} | userId(string,必填): path 参数; menuKey(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于删除/撤销；调用前替换路径参数 {id} 等占位符 |
| `GET` | `/enhanced-permissions/users/{userId}/permissions` | [Auto] GET /enhanced-permissions/users/{userId}/permissions | userId(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询；调用前替换路径参数 {id} 等占位符 |
| `POST` | `/enhanced-permissions/users/{userId}/permissions` | [Auto] POST /enhanced-permissions/users/{userId}/permissions | userId(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作；调用前替换路径参数 {id} 等占位符 |
| `DELETE` | `/enhanced-permissions/users/{userId}/permissions/{permission}` | [Auto] DELETE /enhanced-permissions/users/{userId}/permissions/{permission} | userId(string,必填): path 参数; permission(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于删除/撤销；调用前替换路径参数 {id} 等占位符 |
| `POST` | `/enhanced-permissions/users/{userId}/permissions/deny` | [Auto] POST /enhanced-permissions/users/{userId}/permissions/deny | userId(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作；调用前替换路径参数 {id} 等占位符 |
| `DELETE` | `/enhanced-permissions/users/{userId}/permissions/deny/{permission}` | [Auto] DELETE /enhanced-permissions/users/{userId}/permissions/deny/{permission} | userId(string,必填): path 参数; permission(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于删除/撤销；调用前替换路径参数 {id} 等占位符 |

### 模块 `/health` - 系统健康模块
- 模块说明：服务健康检查接口。
- 接口数量：2

| 方法 | 路径 | 接口摘要 | 参数说明 | 请求体说明 | 返回结构 | 使用说明 |
|---|---|---|---|---|---|---|
| `GET` | `/health` | 服务健康检查 | - | - | object: success, data, message, timestamp | 通常可匿名访问；用于查询 |
| `GET` | `/health/detailed` | [Auto] GET /health/detailed | - | - | object: success, data, message, timestamp | 通常可匿名访问；用于查询 |

### 模块 `/i18n` - i18n 模块
- 模块说明：来自 /i18n 的接口集合
- 接口数量：4

| 方法 | 路径 | 接口摘要 | 参数说明 | 请求体说明 | 返回结构 | 使用说明 |
|---|---|---|---|---|---|---|
| `GET` | `/i18n/locales` | 获取支持的语言列表 | - | - | object: success, message | 默认需 Bearer Token；用于查询 |
| `GET` | `/i18n/messages/{locale}` | 获取指定语言的翻译消息 | locale(string,必填): 语言代码 (zh, en) | - | object: success, message | 默认需 Bearer Token；用于查询；调用前替换路径参数 {id} 等占位符 |
| `POST` | `/i18n/switch` | 切换用户语言偏好（需要登录） | - | locale(string,可选) | object: success, message | 默认需 Bearer Token；用于创建/触发动作；Body 采用 JSON（除 file 字段外） |
| `POST` | `/i18n/translate` | 翻译文本 | - | key(string,可选); locale(string,可选); namespace(string,可选); params(object,可选) | object: success, message | 默认需 Bearer Token；用于创建/触发动作；Body 采用 JSON（除 file 字段外） |

### 模块 `/idle` - 闲置资产模块
- 模块说明：闲置资产管理和再利用相关接口。
- 接口数量：7

| 方法 | 路径 | 接口摘要 | 参数说明 | 请求体说明 | 返回结构 | 使用说明 |
|---|---|---|---|---|---|---|
| `GET` | `/idle` | [Auto] GET /idle | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `POST` | `/idle` | [Auto] POST /idle | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作 |
| `GET` | `/idle/{id}` | [Auto] GET /idle/{id} | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询；调用前替换路径参数 {id} 等占位符 |
| `DELETE` | `/idle/{id}` | [Auto] DELETE /idle/{id} | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于删除/撤销；调用前替换路径参数 {id} 等占位符 |
| `PUT` | `/idle/{id}/allocate` | [Auto] PUT /idle/{id}/allocate | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于整体更新；调用前替换路径参数 {id} 等占位符 |
| `PUT` | `/idle/{id}/cancel` | [Auto] PUT /idle/{id}/cancel | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于整体更新；调用前替换路径参数 {id} 等占位符 |
| `GET` | `/idle/statistics` | [Auto] GET /idle/statistics | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |

### 模块 `/integration` - integration 模块
- 模块说明：来自 /integration 的接口集合
- 接口数量：11

| 方法 | 路径 | 接口摘要 | 参数说明 | 请求体说明 | 返回结构 | 使用说明 |
|---|---|---|---|---|---|---|
| `GET` | `/integration` | [Auto] GET /integration | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/integration/channels` | [Auto] GET /integration/channels | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/integration/channels/{channel}` | [Auto] GET /integration/channels/{channel} | channel(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询；调用前替换路径参数 {id} 等占位符 |
| `POST` | `/integration/channels/{channel}` | [Auto] POST /integration/channels/{channel} | channel(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作；调用前替换路径参数 {id} 等占位符 |
| `PUT` | `/integration/channels/{channel}` | [Auto] PUT /integration/channels/{channel} | channel(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于整体更新；调用前替换路径参数 {id} 等占位符 |
| `DELETE` | `/integration/channels/{channel}` | [Auto] DELETE /integration/channels/{channel} | channel(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于删除/撤销；调用前替换路径参数 {id} 等占位符 |
| `POST` | `/integration/channels/{channel}/send-test` | [Auto] POST /integration/channels/{channel}/send-test | channel(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作；调用前替换路径参数 {id} 等占位符 |
| `GET` | `/integration/channels/{channel}/templates` | [Auto] GET /integration/channels/{channel}/templates | channel(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询；调用前替换路径参数 {id} 等占位符 |
| `POST` | `/integration/channels/{channel}/templates` | [Auto] POST /integration/channels/{channel}/templates | channel(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作；调用前替换路径参数 {id} 等占位符 |
| `DELETE` | `/integration/channels/{channel}/templates/{templateId}` | [Auto] DELETE /integration/channels/{channel}/templates/{templateId} | channel(string,必填): path 参数; templateId(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于删除/撤销；调用前替换路径参数 {id} 等占位符 |
| `POST` | `/integration/channels/{channel}/test` | [Auto] POST /integration/channels/{channel}/test | channel(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作；调用前替换路径参数 {id} 等占位符 |

### 模块 `/intelligent-alerts` - intelligent alerts 模块
- 模块说明：来自 /intelligent-alerts 的接口集合
- 接口数量：14

| 方法 | 路径 | 接口摘要 | 参数说明 | 请求体说明 | 返回结构 | 使用说明 |
|---|---|---|---|---|---|---|
| `GET` | `/intelligent-alerts` | [Auto] GET /intelligent-alerts | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `POST` | `/intelligent-alerts/{alertId}/handle` | [Auto] POST /intelligent-alerts/{alertId}/handle | alertId(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作；调用前替换路径参数 {id} 等占位符 |
| `POST` | `/intelligent-alerts/{alertId}/read` | [Auto] POST /intelligent-alerts/{alertId}/read | alertId(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作；调用前替换路径参数 {id} 等占位符 |
| `POST` | `/intelligent-alerts/{alertId}/unhandle` | [Auto] POST /intelligent-alerts/{alertId}/unhandle | alertId(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作；调用前替换路径参数 {id} 等占位符 |
| `POST` | `/intelligent-alerts/handle-all` | [Auto] POST /intelligent-alerts/handle-all | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作 |
| `GET` | `/intelligent-alerts/inspections` | [Auto] GET /intelligent-alerts/inspections | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/intelligent-alerts/maintenance` | [Auto] GET /intelligent-alerts/maintenance | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/intelligent-alerts/overview` | [Auto] GET /intelligent-alerts/overview | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/intelligent-alerts/qualifications` | [Auto] GET /intelligent-alerts/qualifications | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `POST` | `/intelligent-alerts/read-all` | [Auto] POST /intelligent-alerts/read-all | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作 |
| `GET` | `/intelligent-alerts/safety` | [Auto] GET /intelligent-alerts/safety | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/intelligent-alerts/settings` | [Auto] GET /intelligent-alerts/settings | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `POST` | `/intelligent-alerts/settings` | [Auto] POST /intelligent-alerts/settings | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作 |
| `GET` | `/intelligent-alerts/uptime` | [Auto] GET /intelligent-alerts/uptime | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |

### 模块 `/inventory` - 盘点模块
- 模块说明：盘点任务与盘点执行相关接口。
- 接口数量：18

| 方法 | 路径 | 接口摘要 | 参数说明 | 请求体说明 | 返回结构 | 使用说明 |
|---|---|---|---|---|---|---|
| `GET` | `/inventory` | [Auto] GET /inventory | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `POST` | `/inventory` | [Auto] POST /inventory | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作 |
| `GET` | `/inventory/{id}` | [Auto] GET /inventory/{id} | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询；调用前替换路径参数 {id} 等占位符 |
| `PUT` | `/inventory/{id}` | [Auto] PUT /inventory/{id} | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于整体更新；调用前替换路径参数 {id} 等占位符 |
| `DELETE` | `/inventory/{id}` | [Auto] DELETE /inventory/{id} | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于删除/撤销；调用前替换路径参数 {id} 等占位符 |
| `POST` | `/inventory/{id}/complete` | [Auto] POST /inventory/{id}/complete | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作；调用前替换路径参数 {id} 等占位符 |
| `POST` | `/inventory/{id}/details` | [Auto] POST /inventory/{id}/details | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作；调用前替换路径参数 {id} 等占位符 |
| `PUT` | `/inventory/{id}/details/{detailId}` | [Auto] PUT /inventory/{id}/details/{detailId} | id(string,必填): path 参数; detailId(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于整体更新；调用前替换路径参数 {id} 等占位符 |
| `DELETE` | `/inventory/{id}/details/{detailId}` | [Auto] DELETE /inventory/{id}/details/{detailId} | id(string,必填): path 参数; detailId(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于删除/撤销；调用前替换路径参数 {id} 等占位符 |
| `POST` | `/inventory/{id}/details/batch` | [Auto] POST /inventory/{id}/details/batch | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作；调用前替换路径参数 {id} 等占位符 |
| `POST` | `/inventory/{id}/scan` | [Auto] POST /inventory/{id}/scan | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作；调用前替换路径参数 {id} 等占位符 |
| `GET` | `/inventory/{id}/scan-logs` | [Auto] GET /inventory/{id}/scan-logs | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询；调用前替换路径参数 {id} 等占位符 |
| `GET` | `/inventory/{id}/statistics` | [Auto] GET /inventory/{id}/statistics | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询；调用前替换路径参数 {id} 等占位符 |
| `PUT` | `/inventory/{id}/status` | [Auto] PUT /inventory/{id}/status | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于整体更新；调用前替换路径参数 {id} 等占位符 |
| `GET` | `/inventory/self/assets` | [Auto] GET /inventory/self/assets | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `POST` | `/inventory/self/confirm` | [Auto] POST /inventory/self/confirm | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作 |
| `GET` | `/inventory/self/windows` | [Auto] GET /inventory/self/windows | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/inventory/statistics` | [Auto] GET /inventory/statistics | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |

### 模块 `/inventory-discrepancies` - inventory discrepancies 模块
- 模块说明：来自 /inventory-discrepancies 的接口集合
- 接口数量：6

| 方法 | 路径 | 接口摘要 | 参数说明 | 请求体说明 | 返回结构 | 使用说明 |
|---|---|---|---|---|---|---|
| `GET` | `/inventory-discrepancies` | [Auto] GET /inventory-discrepancies | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/inventory-discrepancies/{id}` | [Auto] GET /inventory-discrepancies/{id} | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询；调用前替换路径参数 {id} 等占位符 |
| `PUT` | `/inventory-discrepancies/{id}/handle` | [Auto] PUT /inventory-discrepancies/{id}/handle | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于整体更新；调用前替换路径参数 {id} 等占位符 |
| `GET` | `/inventory-discrepancies/{inventory_id}/statistics` | [Auto] GET /inventory-discrepancies/{inventory_id}/statistics | inventory_id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询；调用前替换路径参数 {id} 等占位符 |
| `POST` | `/inventory-discrepancies/batch-handle` | [Auto] POST /inventory-discrepancies/batch-handle | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作 |
| `POST` | `/inventory-discrepancies/generate-from-details` | [Auto] POST /inventory-discrepancies/generate-from-details | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作 |

### 模块 `/inventory-plans` - inventory plans 模块
- 模块说明：来自 /inventory-plans 的接口集合
- 接口数量：8

| 方法 | 路径 | 接口摘要 | 参数说明 | 请求体说明 | 返回结构 | 使用说明 |
|---|---|---|---|---|---|---|
| `GET` | `/inventory-plans` | [Auto] GET /inventory-plans | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `POST` | `/inventory-plans` | [Auto] POST /inventory-plans | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作 |
| `GET` | `/inventory-plans/{id}` | [Auto] GET /inventory-plans/{id} | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询；调用前替换路径参数 {id} 等占位符 |
| `PUT` | `/inventory-plans/{id}` | [Auto] PUT /inventory-plans/{id} | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于整体更新；调用前替换路径参数 {id} 等占位符 |
| `DELETE` | `/inventory-plans/{id}` | [Auto] DELETE /inventory-plans/{id} | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于删除/撤销；调用前替换路径参数 {id} 等占位符 |
| `PUT` | `/inventory-plans/{id}/activate` | [Auto] PUT /inventory-plans/{id}/activate | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于整体更新；调用前替换路径参数 {id} 等占位符 |
| `PUT` | `/inventory-plans/{id}/cancel` | [Auto] PUT /inventory-plans/{id}/cancel | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于整体更新；调用前替换路径参数 {id} 等占位符 |
| `PUT` | `/inventory-plans/{id}/complete` | [Auto] PUT /inventory-plans/{id}/complete | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于整体更新；调用前替换路径参数 {id} 等占位符 |

### 模块 `/inventory-tasks` - inventory tasks 模块
- 模块说明：来自 /inventory-tasks 的接口集合
- 接口数量：10

| 方法 | 路径 | 接口摘要 | 参数说明 | 请求体说明 | 返回结构 | 使用说明 |
|---|---|---|---|---|---|---|
| `GET` | `/inventory-tasks` | [Auto] GET /inventory-tasks | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `POST` | `/inventory-tasks` | [Auto] POST /inventory-tasks | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作 |
| `GET` | `/inventory-tasks/{id}` | [Auto] GET /inventory-tasks/{id} | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询；调用前替换路径参数 {id} 等占位符 |
| `PUT` | `/inventory-tasks/{id}` | [Auto] PUT /inventory-tasks/{id} | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于整体更新；调用前替换路径参数 {id} 等占位符 |
| `DELETE` | `/inventory-tasks/{id}` | [Auto] DELETE /inventory-tasks/{id} | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于删除/撤销；调用前替换路径参数 {id} 等占位符 |
| `PUT` | `/inventory-tasks/{id}/assign` | [Auto] PUT /inventory-tasks/{id}/assign | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于整体更新；调用前替换路径参数 {id} 等占位符 |
| `PUT` | `/inventory-tasks/{id}/cancel` | [Auto] PUT /inventory-tasks/{id}/cancel | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于整体更新；调用前替换路径参数 {id} 等占位符 |
| `PUT` | `/inventory-tasks/{id}/complete` | [Auto] PUT /inventory-tasks/{id}/complete | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于整体更新；调用前替换路径参数 {id} 等占位符 |
| `PUT` | `/inventory-tasks/{id}/start` | [Auto] PUT /inventory-tasks/{id}/start | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于整体更新；调用前替换路径参数 {id} 等占位符 |
| `GET` | `/inventory-tasks/my/tasks` | [Auto] GET /inventory-tasks/my/tasks | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |

### 模块 `/iot` - 物联网模块
- 模块说明：IoT 设备与采集管道相关接口。
- 接口数量：48

| 方法 | 路径 | 接口摘要 | 参数说明 | 请求体说明 | 返回结构 | 使用说明 |
|---|---|---|---|---|---|---|
| `GET` | `/iot/asset-monitoring/assets/{assetCode}/latest` | [Auto] GET /iot/asset-monitoring/assets/{assetCode}/latest | assetCode(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询；调用前替换路径参数 {id} 等占位符 |
| `GET` | `/iot/asset-monitoring/assets/{assetCode}/series` | [Auto] GET /iot/asset-monitoring/assets/{assetCode}/series | assetCode(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询；调用前替换路径参数 {id} 等占位符 |
| `GET` | `/iot/asset-monitoring/devices/{deviceId}/latest` | [Auto] GET /iot/asset-monitoring/devices/{deviceId}/latest | deviceId(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询；调用前替换路径参数 {id} 等占位符 |
| `POST` | `/iot/asset-monitoring/ingest` | [Auto] POST /iot/asset-monitoring/ingest | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作 |
| `POST` | `/iot/asset-monitoring/ingest/batch` | [Auto] POST /iot/asset-monitoring/ingest/batch | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作 |
| `GET` | `/iot/asset-monitoring/pipeline/docs` | [Auto] GET /iot/asset-monitoring/pipeline/docs | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/iot/asset-monitoring/pipeline/health` | [Auto] GET /iot/asset-monitoring/pipeline/health | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/iot/devices` | [Auto] GET /iot/devices | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `POST` | `/iot/devices` | [Auto] POST /iot/devices | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作 |
| `GET` | `/iot/devices/{deviceId}/assets` | [Auto] GET /iot/devices/{deviceId}/assets | deviceId(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询；调用前替换路径参数 {id} 等占位符 |
| `GET` | `/iot/devices/{id}` | [Auto] GET /iot/devices/{id} | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询；调用前替换路径参数 {id} 等占位符 |
| `PUT` | `/iot/devices/{id}` | [Auto] PUT /iot/devices/{id} | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于整体更新；调用前替换路径参数 {id} 等占位符 |
| `DELETE` | `/iot/devices/{id}` | [Auto] DELETE /iot/devices/{id} | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于删除/撤销；调用前替换路径参数 {id} 等占位符 |
| `GET` | `/iot/devices/{id}/connector` | [Auto] GET /iot/devices/{id}/connector | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询；调用前替换路径参数 {id} 等占位符 |
| `PUT` | `/iot/devices/{id}/connector` | [Auto] PUT /iot/devices/{id}/connector | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于整体更新；调用前替换路径参数 {id} 等占位符 |
| `POST` | `/iot/devices/{id}/connector/health-check` | [Auto] POST /iot/devices/{id}/connector/health-check | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作；调用前替换路径参数 {id} 等占位符 |
| `GET` | `/iot/devices/{id}/data` | [Auto] GET /iot/devices/{id}/data | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询；调用前替换路径参数 {id} 等占位符 |
| `GET` | `/iot/devices/assets/{assetCode}/devices` | [Auto] GET /iot/devices/assets/{assetCode}/devices | assetCode(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询；调用前替换路径参数 {id} 等占位符 |
| `POST` | `/iot/devices/assets/{assetCode}/link` | [Auto] POST /iot/devices/assets/{assetCode}/link | assetCode(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作；调用前替换路径参数 {id} 等占位符 |
| `POST` | `/iot/devices/assets/{assetCode}/unlink` | [Auto] POST /iot/devices/assets/{assetCode}/unlink | assetCode(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作；调用前替换路径参数 {id} 等占位符 |
| `GET` | `/iot/devices/connectors/capabilities` | [Auto] GET /iot/devices/connectors/capabilities | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `POST` | `/iot/devices/connectors/health-check` | [Auto] POST /iot/devices/connectors/health-check | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作 |
| `POST` | `/iot/devices/connectors/validate` | [Auto] POST /iot/devices/connectors/validate | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作 |
| `GET` | `/iot/devices/types` | [Auto] GET /iot/devices/types | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/iot/environment-monitoring/assets/{assetCode}/latest` | [Auto] GET /iot/environment-monitoring/assets/{assetCode}/latest | assetCode(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询；调用前替换路径参数 {id} 等占位符 |
| `GET` | `/iot/environment-monitoring/assets/{assetCode}/series` | [Auto] GET /iot/environment-monitoring/assets/{assetCode}/series | assetCode(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询；调用前替换路径参数 {id} 等占位符 |
| `GET` | `/iot/environment-monitoring/devices/{deviceId}/latest` | [Auto] GET /iot/environment-monitoring/devices/{deviceId}/latest | deviceId(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询；调用前替换路径参数 {id} 等占位符 |
| `POST` | `/iot/environment-monitoring/ingest` | [Auto] POST /iot/environment-monitoring/ingest | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作 |
| `POST` | `/iot/environment-monitoring/ingest/batch` | [Auto] POST /iot/environment-monitoring/ingest/batch | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作 |
| `GET` | `/iot/environment-monitoring/pipeline/docs` | [Auto] GET /iot/environment-monitoring/pipeline/docs | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/iot/environment-monitoring/pipeline/health` | [Auto] GET /iot/environment-monitoring/pipeline/health | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/iot/health` | [Auto] GET /iot/health | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/iot/location/assets/{assetCode}/location` | [Auto] GET /iot/location/assets/{assetCode}/location | assetCode(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询；调用前替换路径参数 {id} 等占位符 |
| `POST` | `/iot/location/assets/{assetCode}/location` | [Auto] POST /iot/location/assets/{assetCode}/location | assetCode(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作；调用前替换路径参数 {id} 等占位符 |
| `GET` | `/iot/location/assets/{assetCode}/location/history` | [Auto] GET /iot/location/assets/{assetCode}/location/history | assetCode(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询；调用前替换路径参数 {id} 等占位符 |
| `POST` | `/iot/location/assets/in-area` | [Auto] POST /iot/location/assets/in-area | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作 |
| `POST` | `/iot/location/assets/locations` | [Auto] POST /iot/location/assets/locations | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作 |
| `POST` | `/iot/location/beacon-location` | [Auto] POST /iot/location/beacon-location | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作 |
| `POST` | `/iot/location/devices/{deviceId}/data` | [Auto] POST /iot/location/devices/{deviceId}/data | deviceId(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作；调用前替换路径参数 {id} 等占位符 |
| `GET` | `/iot/location/pipeline/docs` | [Auto] GET /iot/location/pipeline/docs | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/iot/location/pipeline/health` | [Auto] GET /iot/location/pipeline/health | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/iot/zone-location/assets/{assetCode}/latest` | [Auto] GET /iot/zone-location/assets/{assetCode}/latest | assetCode(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询；调用前替换路径参数 {id} 等占位符 |
| `GET` | `/iot/zone-location/assets/{assetCode}/series` | [Auto] GET /iot/zone-location/assets/{assetCode}/series | assetCode(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询；调用前替换路径参数 {id} 等占位符 |
| `GET` | `/iot/zone-location/devices/{deviceId}/latest` | [Auto] GET /iot/zone-location/devices/{deviceId}/latest | deviceId(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询；调用前替换路径参数 {id} 等占位符 |
| `POST` | `/iot/zone-location/ingest` | [Auto] POST /iot/zone-location/ingest | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作 |
| `POST` | `/iot/zone-location/ingest/batch` | [Auto] POST /iot/zone-location/ingest/batch | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作 |
| `GET` | `/iot/zone-location/pipeline/docs` | [Auto] GET /iot/zone-location/pipeline/docs | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/iot/zone-location/pipeline/health` | [Auto] GET /iot/zone-location/pipeline/health | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |

### 模块 `/iot-devices` - IoT设备模块
- 模块说明：IoT设备管理相关接口。
- 接口数量：11

| 方法 | 路径 | 接口摘要 | 参数说明 | 请求体说明 | 返回结构 | 使用说明 |
|---|---|---|---|---|---|---|
| `GET` | `/iot-devices` | [Auto] GET /iot-devices | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `POST` | `/iot-devices` | [Auto] POST /iot-devices | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作 |
| `GET` | `/iot-devices/{deviceId}/assets` | [Auto] GET /iot-devices/{deviceId}/assets | deviceId(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询；调用前替换路径参数 {id} 等占位符 |
| `GET` | `/iot-devices/{deviceId}/data` | [Auto] GET /iot-devices/{deviceId}/data | deviceId(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询；调用前替换路径参数 {id} 等占位符 |
| `POST` | `/iot-devices/{deviceId}/data` | [Auto] POST /iot-devices/{deviceId}/data | deviceId(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作；调用前替换路径参数 {id} 等占位符 |
| `GET` | `/iot-devices/{id}` | [Auto] GET /iot-devices/{id} | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询；调用前替换路径参数 {id} 等占位符 |
| `PUT` | `/iot-devices/{id}` | [Auto] PUT /iot-devices/{id} | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于整体更新；调用前替换路径参数 {id} 等占位符 |
| `DELETE` | `/iot-devices/{id}` | [Auto] DELETE /iot-devices/{id} | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于删除/撤销；调用前替换路径参数 {id} 等占位符 |
| `GET` | `/iot-devices/assets/{assetCode}/devices` | [Auto] GET /iot-devices/assets/{assetCode}/devices | assetCode(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询；调用前替换路径参数 {id} 等占位符 |
| `POST` | `/iot-devices/assets/{assetCode}/link` | [Auto] POST /iot-devices/assets/{assetCode}/link | assetCode(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作；调用前替换路径参数 {id} 等占位符 |
| `POST` | `/iot-devices/assets/{assetCode}/unlink` | [Auto] POST /iot-devices/assets/{assetCode}/unlink | assetCode(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作；调用前替换路径参数 {id} 等占位符 |

### 模块 `/location-alerts` - location alerts 模块
- 模块说明：来自 /location-alerts 的接口集合
- 接口数量：5

| 方法 | 路径 | 接口摘要 | 参数说明 | 请求体说明 | 返回结构 | 使用说明 |
|---|---|---|---|---|---|---|
| `GET` | `/location-alerts` | [Auto] GET /location-alerts | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `DELETE` | `/location-alerts/{id}` | [Auto] DELETE /location-alerts/{id} | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于删除/撤销；调用前替换路径参数 {id} 等占位符 |
| `PUT` | `/location-alerts/{id}/handle` | [Auto] PUT /location-alerts/{id}/handle | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于整体更新；调用前替换路径参数 {id} 等占位符 |
| `POST` | `/location-alerts/batch/handle` | [Auto] POST /location-alerts/batch/handle | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作 |
| `GET` | `/location-alerts/stats` | [Auto] GET /location-alerts/stats | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |

### 模块 `/location-codes` - location codes 模块
- 模块说明：来自 /location-codes 的接口集合
- 接口数量：5

| 方法 | 路径 | 接口摘要 | 参数说明 | 请求体说明 | 返回结构 | 使用说明 |
|---|---|---|---|---|---|---|
| `GET` | `/location-codes` | [Auto] GET /location-codes | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `POST` | `/location-codes` | [Auto] POST /location-codes | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作 |
| `GET` | `/location-codes/{id}` | [Auto] GET /location-codes/{id} | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询；调用前替换路径参数 {id} 等占位符 |
| `PUT` | `/location-codes/{id}` | [Auto] PUT /location-codes/{id} | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于整体更新；调用前替换路径参数 {id} 等占位符 |
| `DELETE` | `/location-codes/{id}` | [Auto] DELETE /location-codes/{id} | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于删除/撤销；调用前替换路径参数 {id} 等占位符 |

### 模块 `/maintenance` - 维修维护模块
- 模块说明：维修申请、工单、日志、计划与分析相关接口。
- 接口数量：92

| 方法 | 路径 | 接口摘要 | 参数说明 | 请求体说明 | 返回结构 | 使用说明 |
|---|---|---|---|---|---|---|
| `GET` | `/maintenance` | [Auto] GET /maintenance | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/maintenance/ai/analysis` | [Auto] GET /maintenance/ai/analysis | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `POST` | `/maintenance/ai/audio` | [Auto] POST /maintenance/ai/audio | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作 |
| `GET` | `/maintenance/ai/debug-asset` | [Auto] GET /maintenance/ai/debug-asset | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `POST` | `/maintenance/ai/feedback` | [Auto] POST /maintenance/ai/feedback | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作 |
| `POST` | `/maintenance/ai/init` | [Auto] POST /maintenance/ai/init | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作 |
| `POST` | `/maintenance/ai/message` | [Auto] POST /maintenance/ai/message | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作 |
| `GET` | `/maintenance/ai/pending` | [Auto] GET /maintenance/ai/pending | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `POST` | `/maintenance/ai/test` | [Auto] POST /maintenance/ai/test | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作 |
| `GET` | `/maintenance/analysis/asset-history` | [Auto] GET /maintenance/analysis/asset-history | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/maintenance/analysis/cost-trend` | [Auto] GET /maintenance/analysis/cost-trend | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/maintenance/analysis/effectiveness-stats` | [Auto] GET /maintenance/analysis/effectiveness-stats | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/maintenance/analysis/frequency` | [Auto] GET /maintenance/analysis/frequency | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/maintenance/analysis/technician-performance` | [Auto] GET /maintenance/analysis/technician-performance | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/maintenance/analysis/type-distribution` | [Auto] GET /maintenance/analysis/type-distribution | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/maintenance/asset-types/secondary` | [Auto] GET /maintenance/asset-types/secondary | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/maintenance/costs` | [Auto] GET /maintenance/costs | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `POST` | `/maintenance/costs` | [Auto] POST /maintenance/costs | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作 |
| `PUT` | `/maintenance/costs/{id}` | [Auto] PUT /maintenance/costs/{id} | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于整体更新；调用前替换路径参数 {id} 等占位符 |
| `DELETE` | `/maintenance/costs/{id}` | [Auto] DELETE /maintenance/costs/{id} | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于删除/撤销；调用前替换路径参数 {id} 等占位符 |
| `GET` | `/maintenance/costs/analysis` | [Auto] GET /maintenance/costs/analysis | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/maintenance/costs/asset-type` | [Auto] GET /maintenance/costs/asset-type | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/maintenance/costs/department` | [Auto] GET /maintenance/costs/department | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/maintenance/costs/high-cost-assets` | [Auto] GET /maintenance/costs/high-cost-assets | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/maintenance/costs/maintenance-type` | [Auto] GET /maintenance/costs/maintenance-type | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/maintenance/costs/trend` | [Auto] GET /maintenance/costs/trend | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/maintenance/efficiency/asset-frequency` | [Auto] GET /maintenance/efficiency/asset-frequency | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/maintenance/efficiency/overview` | [Auto] GET /maintenance/efficiency/overview | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/maintenance/efficiency/response-time` | [Auto] GET /maintenance/efficiency/response-time | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/maintenance/efficiency/technician` | [Auto] GET /maintenance/efficiency/technician | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/maintenance/evaluations` | [Auto] GET /maintenance/evaluations | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `POST` | `/maintenance/evaluations` | [Auto] POST /maintenance/evaluations | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作 |
| `PUT` | `/maintenance/evaluations/{id}` | [Auto] PUT /maintenance/evaluations/{id} | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于整体更新；调用前替换路径参数 {id} 等占位符 |
| `GET` | `/maintenance/legacy/templates` | [Auto] GET /maintenance/legacy/templates | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `POST` | `/maintenance/legacy/templates` | [Auto] POST /maintenance/legacy/templates | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作 |
| `GET` | `/maintenance/legacy/templates/{id}` | [Auto] GET /maintenance/legacy/templates/{id} | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询；调用前替换路径参数 {id} 等占位符 |
| `PUT` | `/maintenance/legacy/templates/{id}` | [Auto] PUT /maintenance/legacy/templates/{id} | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于整体更新；调用前替换路径参数 {id} 等占位符 |
| `DELETE` | `/maintenance/legacy/templates/{id}` | [Auto] DELETE /maintenance/legacy/templates/{id} | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于删除/撤销；调用前替换路径参数 {id} 等占位符 |
| `GET` | `/maintenance/legacy/workorders` | [Auto] GET /maintenance/legacy/workorders | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `POST` | `/maintenance/legacy/workorders` | [Auto] POST /maintenance/legacy/workorders | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作 |
| `GET` | `/maintenance/legacy/workorders/{id}` | [Auto] GET /maintenance/legacy/workorders/{id} | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询；调用前替换路径参数 {id} 等占位符 |
| `PUT` | `/maintenance/legacy/workorders/{id}` | [Auto] PUT /maintenance/legacy/workorders/{id} | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于整体更新；调用前替换路径参数 {id} 等占位符 |
| `DELETE` | `/maintenance/legacy/workorders/{id}` | [Auto] DELETE /maintenance/legacy/workorders/{id} | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于删除/撤销；调用前替换路径参数 {id} 等占位符 |
| `GET` | `/maintenance/logs` | 获取维护日志列表 | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `POST` | `/maintenance/logs` | 创建维护日志 | - | asset_code(string,必填); maintenance_type(string,必填); maintenance_date(string,必填); cost(number,可选) | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作；Body 采用 JSON（除 file 字段外） |
| `GET` | `/maintenance/logs/{id}` | 获取维护日志详情 | id(integer,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询；调用前替换路径参数 {id} 等占位符 |
| `PUT` | `/maintenance/logs/{id}` | 更新维护日志 | id(integer,必填): path 参数 | payload(object,必填): application/json 请求体 | object: success, data, message, timestamp | 默认需 Bearer Token；用于整体更新；Body 采用 JSON（除 file 字段外）；调用前替换路径参数 {id} 等占位符 |
| `DELETE` | `/maintenance/logs/{id}` | 删除维护日志 | id(integer,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于删除/撤销；调用前替换路径参数 {id} 等占位符 |
| `GET` | `/maintenance/logs/{id}/attachments` | [Auto] GET /maintenance/logs/{id}/attachments | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询；调用前替换路径参数 {id} 等占位符 |
| `POST` | `/maintenance/logs/{id}/attachments` | [Auto] POST /maintenance/logs/{id}/attachments | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作；调用前替换路径参数 {id} 等占位符 |
| `GET` | `/maintenance/logs/{logId}/attachments/{attachmentId}` | [Auto] GET /maintenance/logs/{logId}/attachments/{attachmentId} | logId(string,必填): path 参数; attachmentId(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询；调用前替换路径参数 {id} 等占位符 |
| `DELETE` | `/maintenance/logs/{logId}/attachments/{attachmentId}` | [Auto] DELETE /maintenance/logs/{logId}/attachments/{attachmentId} | logId(string,必填): path 参数; attachmentId(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于删除/撤销；调用前替换路径参数 {id} 等占位符 |
| `GET` | `/maintenance/logs/{logId}/attachments/{attachmentId}/download` | [Auto] GET /maintenance/logs/{logId}/attachments/{attachmentId}/download | logId(string,必填): path 参数; attachmentId(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询；调用前替换路径参数 {id} 等占位符 |
| `GET` | `/maintenance/plans` | [Auto] GET /maintenance/plans | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `POST` | `/maintenance/plans` | [Auto] POST /maintenance/plans | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作 |
| `GET` | `/maintenance/plans/{id}` | [Auto] GET /maintenance/plans/{id} | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询；调用前替换路径参数 {id} 等占位符 |
| `PUT` | `/maintenance/plans/{id}` | [Auto] PUT /maintenance/plans/{id} | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于整体更新；调用前替换路径参数 {id} 等占位符 |
| `DELETE` | `/maintenance/plans/{id}` | [Auto] DELETE /maintenance/plans/{id} | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于删除/撤销；调用前替换路径参数 {id} 等占位符 |
| `POST` | `/maintenance/plans/{id}/complete` | [Auto] POST /maintenance/plans/{id}/complete | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作；调用前替换路径参数 {id} 等占位符 |
| `GET` | `/maintenance/plans/{id}/history` | [Auto] GET /maintenance/plans/{id}/history | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询；调用前替换路径参数 {id} 等占位符 |
| `GET` | `/maintenance/reminders` | [Auto] GET /maintenance/reminders | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/maintenance/reminders/check` | [Auto] GET /maintenance/reminders/check | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `POST` | `/maintenance/reminders/config` | [Auto] POST /maintenance/reminders/config | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作 |
| `POST` | `/maintenance/reminders/send` | [Auto] POST /maintenance/reminders/send | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作 |
| `GET` | `/maintenance/requests` | 获取维修申请列表 | page(integer,可选): query 参数; pageSize(integer,可选): query 参数; status(string,可选): query 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `POST` | `/maintenance/requests` | 创建维修申请 | - | asset_code(string,必填); issue_description(string,必填); priority(string,可选) | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作；Body 采用 JSON（除 file 字段外） |
| `GET` | `/maintenance/requests/{id}` | 获取维修申请详情 | id(integer,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询；调用前替换路径参数 {id} 等占位符 |
| `PUT` | `/maintenance/requests/{id}` | 更新维修申请 | id(integer,必填): path 参数 | payload(object,必填): application/json 请求体 | object: success, data, message, timestamp | 默认需 Bearer Token；用于整体更新；Body 采用 JSON（除 file 字段外）；调用前替换路径参数 {id} 等占位符 |
| `DELETE` | `/maintenance/requests/{id}` | 删除维修申请 | id(integer,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于删除/撤销；调用前替换路径参数 {id} 等占位符 |
| `POST` | `/maintenance/requests/{id}/approve` | 审批维修申请 | id(integer,必填): path 参数 | approved(boolean,可选); opinion(string,可选) | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作；Body 采用 JSON（除 file 字段外）；调用前替换路径参数 {id} 等占位符 |
| `POST` | `/maintenance/requests/{id}/cancel` | [Auto] POST /maintenance/requests/{id}/cancel | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作；调用前替换路径参数 {id} 等占位符 |
| `POST` | `/maintenance/requests/{id}/complete` | [Auto] POST /maintenance/requests/{id}/complete | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作；调用前替换路径参数 {id} 等占位符 |
| `POST` | `/maintenance/requests/{id}/start` | [Auto] POST /maintenance/requests/{id}/start | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作；调用前替换路径参数 {id} 等占位符 |
| `GET` | `/maintenance/statistics` | 获取维护统计 | start_date(string,可选): query 参数; end_date(string,可选): query 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/maintenance/templates` | [Auto] GET /maintenance/templates | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `POST` | `/maintenance/templates` | [Auto] POST /maintenance/templates | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作 |
| `PUT` | `/maintenance/templates/{id}` | [Auto] PUT /maintenance/templates/{id} | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于整体更新；调用前替换路径参数 {id} 等占位符 |
| `DELETE` | `/maintenance/templates/{id}` | [Auto] DELETE /maintenance/templates/{id} | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于删除/撤销；调用前替换路径参数 {id} 等占位符 |
| `POST` | `/maintenance/templates/generate-medical-defaults` | [Auto] POST /maintenance/templates/generate-medical-defaults | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作 |
| `GET` | `/maintenance/templates/recommend` | [Auto] GET /maintenance/templates/recommend | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/maintenance/templates/recommend-by-asset` | [Auto] GET /maintenance/templates/recommend-by-asset | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/maintenance/workorders` | [Auto] GET /maintenance/workorders | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `POST` | `/maintenance/workorders` | [Auto] POST /maintenance/workorders | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作 |
| `GET` | `/maintenance/workorders/{id}` | [Auto] GET /maintenance/workorders/{id} | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询；调用前替换路径参数 {id} 等占位符 |
| `PUT` | `/maintenance/workorders/{id}` | [Auto] PUT /maintenance/workorders/{id} | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于整体更新；调用前替换路径参数 {id} 等占位符 |
| `DELETE` | `/maintenance/workorders/{id}` | [Auto] DELETE /maintenance/workorders/{id} | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于删除/撤销；调用前替换路径参数 {id} 等占位符 |
| `POST` | `/maintenance/workorders/{id}/assign` | [Auto] POST /maintenance/workorders/{id}/assign | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作；调用前替换路径参数 {id} 等占位符 |
| `POST` | `/maintenance/workorders/{id}/cancel` | [Auto] POST /maintenance/workorders/{id}/cancel | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作；调用前替换路径参数 {id} 等占位符 |
| `POST` | `/maintenance/workorders/{id}/close` | [Auto] POST /maintenance/workorders/{id}/close | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作；调用前替换路径参数 {id} 等占位符 |
| `POST` | `/maintenance/workorders/{id}/complete` | [Auto] POST /maintenance/workorders/{id}/complete | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作；调用前替换路径参数 {id} 等占位符 |
| `POST` | `/maintenance/workorders/{id}/materials` | [Auto] POST /maintenance/workorders/{id}/materials | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作；调用前替换路径参数 {id} 等占位符 |
| `POST` | `/maintenance/workorders/{id}/start` | [Auto] POST /maintenance/workorders/{id}/start | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作；调用前替换路径参数 {id} 等占位符 |

### 模块 `/menus` - menus 模块
- 模块说明：来自 /menus 的接口集合
- 接口数量：4

| 方法 | 路径 | 接口摘要 | 参数说明 | 请求体说明 | 返回结构 | 使用说明 |
|---|---|---|---|---|---|---|
| `GET` | `/menus` | [Auto] GET /menus | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/menus/builtin-menus` | [Auto] GET /menus/builtin-menus | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/menus/menu-tree` | [Auto] GET /menus/menu-tree | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/menus/menus` | [Auto] GET /menus/menus | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |

### 模块 `/metrics` - metrics 模块
- 模块说明：来自 /metrics 的接口集合
- 接口数量：1

| 方法 | 路径 | 接口摘要 | 参数说明 | 请求体说明 | 返回结构 | 使用说明 |
|---|---|---|---|---|---|---|
| `GET` | `/metrics` | [Auto] GET /metrics | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |

### 模块 `/module-configs` - 模块配置模块
- 模块说明：租户模块启停、配置、菜单权限相关接口。
- 接口数量：16

| 方法 | 路径 | 接口摘要 | 参数说明 | 请求体说明 | 返回结构 | 使用说明 |
|---|---|---|---|---|---|---|
| `GET` | `/module-configs` | [Auto] GET /module-configs | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/module-configs/{moduleId}` | 获取单模块租户配置 | moduleId(string,必填): path 参数; tenant_id(integer,可选): query 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询；调用前替换路径参数 {id} 等占位符 |
| `PUT` | `/module-configs/{moduleId}` | 更新单模块租户配置 | moduleId(string,必填): path 参数 | tenant_id(integer,可选); enabled(boolean,可选); config(object,可选) | object: success, data, message, timestamp | 默认需 Bearer Token；用于整体更新；Body 采用 JSON（除 file 字段外）；调用前替换路径参数 {id} 等占位符 |
| `GET` | `/module-configs/{moduleId}/backup` | [Auto] GET /module-configs/{moduleId}/backup | moduleId(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询；调用前替换路径参数 {id} 等占位符 |
| `GET` | `/module-configs/{moduleId}/menus` | 获取模块菜单启用状态 | moduleId(string,必填): path 参数; tenant_id(integer,可选): query 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询；调用前替换路径参数 {id} 等占位符 |
| `PUT` | `/module-configs/{moduleId}/menus` | 批量更新模块菜单启用状态 | moduleId(string,必填): path 参数 | tenant_id(integer,可选); menus(array,必填) | object: success, data, message, timestamp | 默认需 Bearer Token；用于整体更新；Body 采用 JSON（除 file 字段外）；调用前替换路径参数 {id} 等占位符 |
| `POST` | `/module-configs/{moduleId}/restore` | [Auto] POST /module-configs/{moduleId}/restore | moduleId(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作；调用前替换路径参数 {id} 等占位符 |
| `POST` | `/module-configs/{moduleId}/rollback` | [Auto] POST /module-configs/{moduleId}/rollback | moduleId(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作；调用前替换路径参数 {id} 等占位符 |
| `GET` | `/module-configs/{moduleId}/validate` | [Auto] GET /module-configs/{moduleId}/validate | moduleId(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询；调用前替换路径参数 {id} 等占位符 |
| `GET` | `/module-configs/{moduleId}/versions` | [Auto] GET /module-configs/{moduleId}/versions | moduleId(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询；调用前替换路径参数 {id} 等占位符 |
| `POST` | `/module-configs/{moduleId}/versions` | [Auto] POST /module-configs/{moduleId}/versions | moduleId(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作；调用前替换路径参数 {id} 等占位符 |
| `DELETE` | `/module-configs/{moduleId}/versions/{versionId}` | [Auto] DELETE /module-configs/{moduleId}/versions/{versionId} | moduleId(string,必填): path 参数; versionId(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于删除/撤销；调用前替换路径参数 {id} 等占位符 |
| `GET` | `/module-configs/{moduleId}/versions/{versionId}/compare` | [Auto] GET /module-configs/{moduleId}/versions/{versionId}/compare | moduleId(string,必填): path 参数; versionId(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询；调用前替换路径参数 {id} 等占位符 |
| `POST` | `/module-configs/disable` | 停用模块 | - | module_id(string,必填); tenant_id(integer,可选) | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作；Body 采用 JSON（除 file 字段外） |
| `POST` | `/module-configs/enable` | 启用模块 | - | module_id(string,必填); tenant_id(integer,可选); config(object,可选) | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作；Body 采用 JSON（除 file 字段外） |
| `GET` | `/module-configs/list` | 获取租户模块配置列表 | tenant_id(integer,可选): 超级管理员可指定租户ID; category(string,可选): 按分类过滤（如 资产生命周期 / 分析与智能） | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |

### 模块 `/modules` - 模块管理模块
- 模块说明：系统模块定义与依赖关系管理接口。
- 接口数量：14

| 方法 | 路径 | 接口摘要 | 参数说明 | 请求体说明 | 返回结构 | 使用说明 |
|---|---|---|---|---|---|---|
| `GET` | `/modules` | 获取模块清单 | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/modules/{moduleId}` | [Auto] GET /modules/{moduleId} | moduleId(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询；调用前替换路径参数 {id} 等占位符 |
| `PUT` | `/modules/{moduleId}` | [Auto] PUT /modules/{moduleId} | moduleId(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于整体更新；调用前替换路径参数 {id} 等占位符 |
| `DELETE` | `/modules/{moduleId}` | [Auto] DELETE /modules/{moduleId} | moduleId(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于删除/撤销；调用前替换路径参数 {id} 等占位符 |
| `GET` | `/modules/{moduleId}/dependencies` | 获取模块依赖 | moduleId(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询；调用前替换路径参数 {id} 等占位符 |
| `POST` | `/modules/{moduleId}/dependencies` | [Auto] POST /modules/{moduleId}/dependencies | moduleId(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作；调用前替换路径参数 {id} 等占位符 |
| `DELETE` | `/modules/{moduleId}/dependencies/{depId}` | [Auto] DELETE /modules/{moduleId}/dependencies/{depId} | moduleId(string,必填): path 参数; depId(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于删除/撤销；调用前替换路径参数 {id} 等占位符 |
| `GET` | `/modules/{moduleId}/logs` | [Auto] GET /modules/{moduleId}/logs | moduleId(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询；调用前替换路径参数 {id} 等占位符 |
| `GET` | `/modules/{moduleId}/status` | [Auto] GET /modules/{moduleId}/status | moduleId(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询；调用前替换路径参数 {id} 等占位符 |
| `PUT` | `/modules/{moduleId}/status` | [Auto] PUT /modules/{moduleId}/status | moduleId(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于整体更新；调用前替换路径参数 {id} 等占位符 |
| `GET` | `/modules/check-conflicts` | [Auto] GET /modules/check-conflicts | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/modules/dependency-graph` | [Auto] GET /modules/dependency-graph | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/modules/list` | [Auto] GET /modules/list | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `POST` | `/modules/register` | [Auto] POST /modules/register | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作 |

### 模块 `/procurement` - 采购管理模块
- 模块说明：采购申请、审批、执行、附件与统计接口。
- 接口数量：11

| 方法 | 路径 | 接口摘要 | 参数说明 | 请求体说明 | 返回结构 | 使用说明 |
|---|---|---|---|---|---|---|
| `GET` | `/procurement` | [Auto] GET /procurement | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/procurement/files/{fileId}/download` | [Auto] GET /procurement/files/{fileId}/download | fileId(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询；调用前替换路径参数 {id} 等占位符 |
| `GET` | `/procurement/requests` | 获取采购单列表 | status(string,可选): query 参数; keyword(string,可选): query 参数 | - | object: success, data | 默认需 Bearer Token；用于查询 |
| `POST` | `/procurement/requests` | 创建采购单 | - | title(string,必填); department(string,可选); applicant(string,可选); budget(number,可选); remark(string,可选) | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作；Body 采用 JSON（除 file 字段外） |
| `PUT` | `/procurement/requests/{id}` | 更新采购单 | id(integer,必填): path 参数 | payload(object,必填): application/json 请求体 | object: success, data, message, timestamp | 默认需 Bearer Token；用于整体更新；Body 采用 JSON（除 file 字段外）；调用前替换路径参数 {id} 等占位符 |
| `PUT` | `/procurement/requests/{id}/acceptance` | [Auto] PUT /procurement/requests/{id}/acceptance | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于整体更新；调用前替换路径参数 {id} 等占位符 |
| `PUT` | `/procurement/requests/{id}/approve` | 审批采购单 | id(integer,必填): path 参数 | approved(boolean,可选); opinion(string,可选) | object: success, data, message, timestamp | 默认需 Bearer Token；用于整体更新；Body 采用 JSON（除 file 字段外）；调用前替换路径参数 {id} 等占位符 |
| `PUT` | `/procurement/requests/{id}/execute` | 更新采购执行状态 | id(integer,必填): path 参数 | completed(boolean,可选); result(string,可选) | object: success, data, message, timestamp | 默认需 Bearer Token；用于整体更新；Body 采用 JSON（除 file 字段外）；调用前替换路径参数 {id} 等占位符 |
| `GET` | `/procurement/requests/{id}/files` | 获取采购单附件列表 | id(integer,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询；调用前替换路径参数 {id} 等占位符 |
| `POST` | `/procurement/requests/{id}/files` | 上传采购单附件 | id(integer,必填): path 参数 | file(file,必填); file_type(string,可选) | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作；Body 采用 JSON（除 file 字段外）；调用前替换路径参数 {id} 等占位符 |
| `GET` | `/procurement/stats` | 获取采购统计 | - | - | object: success, data | 默认需 Bearer Token；用于查询 |

### 模块 `/quality` - quality 模块
- 模块说明：来自 /quality 的接口集合
- 接口数量：25

| 方法 | 路径 | 接口摘要 | 参数说明 | 请求体说明 | 返回结构 | 使用说明 |
|---|---|---|---|---|---|---|
| `GET` | `/quality` | [Auto] GET /quality | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `POST` | `/quality` | [Auto] POST /quality | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作 |
| `GET` | `/quality/{id}` | [Auto] GET /quality/{id} | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询；调用前替换路径参数 {id} 等占位符 |
| `PUT` | `/quality/{id}` | [Auto] PUT /quality/{id} | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于整体更新；调用前替换路径参数 {id} 等占位符 |
| `DELETE` | `/quality/{id}` | [Auto] DELETE /quality/{id} | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于删除/撤销；调用前替换路径参数 {id} 等占位符 |
| `GET` | `/quality/asset/{assetCode}/history` | [Auto] GET /quality/asset/{assetCode}/history | assetCode(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询；调用前替换路径参数 {id} 等占位符 |
| `GET` | `/quality/expiring` | [Auto] GET /quality/expiring | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/quality/metrology` | [Auto] GET /quality/metrology | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `POST` | `/quality/metrology` | [Auto] POST /quality/metrology | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作 |
| `GET` | `/quality/metrology/{id}` | [Auto] GET /quality/metrology/{id} | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询；调用前替换路径参数 {id} 等占位符 |
| `PUT` | `/quality/metrology/{id}` | [Auto] PUT /quality/metrology/{id} | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于整体更新；调用前替换路径参数 {id} 等占位符 |
| `DELETE` | `/quality/metrology/{id}` | [Auto] DELETE /quality/metrology/{id} | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于删除/撤销；调用前替换路径参数 {id} 等占位符 |
| `POST` | `/quality/metrology/analyze-report` | [Auto] POST /quality/metrology/analyze-report | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作 |
| `POST` | `/quality/metrology/batch-delete` | [Auto] POST /quality/metrology/batch-delete | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作 |
| `GET` | `/quality/metrology/expiring` | [Auto] GET /quality/metrology/expiring | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/quality/metrology/export` | [Auto] GET /quality/metrology/export | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `POST` | `/quality/metrology/from-file` | [Auto] POST /quality/metrology/from-file | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作 |
| `GET` | `/quality/metrology/statistics` | [Auto] GET /quality/metrology/statistics | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/quality/metrology/statistics/advanced` | [Auto] GET /quality/metrology/statistics/advanced | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/quality/quality-control` | [Auto] GET /quality/quality-control | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/quality/reports/comprehensive` | [Auto] GET /quality/reports/comprehensive | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/quality/reports/metrology` | [Auto] GET /quality/reports/metrology | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/quality/reports/quality` | [Auto] GET /quality/reports/quality | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/quality/statistics` | [Auto] GET /quality/statistics | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/quality/statistics/advanced` | [Auto] GET /quality/statistics/advanced | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |

### 模块 `/quality-control` - 质量管理模块
- 模块说明：计量与质量控制记录、统计与报告接口。
- 接口数量：30

| 方法 | 路径 | 接口摘要 | 参数说明 | 请求体说明 | 返回结构 | 使用说明 |
|---|---|---|---|---|---|---|
| `GET` | `/quality-control` | [Auto] GET /quality-control | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `POST` | `/quality-control` | [Auto] POST /quality-control | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作 |
| `GET` | `/quality-control/{id}` | [Auto] GET /quality-control/{id} | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询；调用前替换路径参数 {id} 等占位符 |
| `PUT` | `/quality-control/{id}` | [Auto] PUT /quality-control/{id} | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于整体更新；调用前替换路径参数 {id} 等占位符 |
| `DELETE` | `/quality-control/{id}` | [Auto] DELETE /quality-control/{id} | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于删除/撤销；调用前替换路径参数 {id} 等占位符 |
| `GET` | `/quality-control/asset/{assetCode}/history` | [Auto] GET /quality-control/asset/{assetCode}/history | assetCode(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询；调用前替换路径参数 {id} 等占位符 |
| `GET` | `/quality-control/expiring` | [Auto] GET /quality-control/expiring | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/quality-control/metrology` | 获取计量记录列表 | page(integer,可选): query 参数; pageSize(integer,可选): query 参数; asset_code(string,可选): query 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `POST` | `/quality-control/metrology` | 创建计量记录 | - | asset_code(string,必填); metrology_type(string,必填); metrology_date(string,必填); result(string,可选) | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作；Body 采用 JSON（除 file 字段外） |
| `GET` | `/quality-control/metrology/{id}` | 获取计量记录详情 | id(integer,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询；调用前替换路径参数 {id} 等占位符 |
| `PUT` | `/quality-control/metrology/{id}` | 更新计量记录 | id(integer,必填): path 参数 | payload(object,必填): application/json 请求体 | object: success, data, message, timestamp | 默认需 Bearer Token；用于整体更新；Body 采用 JSON（除 file 字段外）；调用前替换路径参数 {id} 等占位符 |
| `DELETE` | `/quality-control/metrology/{id}` | 删除计量记录 | id(integer,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于删除/撤销；调用前替换路径参数 {id} 等占位符 |
| `POST` | `/quality-control/metrology/analyze-report` | [Auto] POST /quality-control/metrology/analyze-report | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作 |
| `POST` | `/quality-control/metrology/batch-delete` | [Auto] POST /quality-control/metrology/batch-delete | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作 |
| `GET` | `/quality-control/metrology/expiring` | [Auto] GET /quality-control/metrology/expiring | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/quality-control/metrology/export` | [Auto] GET /quality-control/metrology/export | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `POST` | `/quality-control/metrology/from-file` | [Auto] POST /quality-control/metrology/from-file | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作 |
| `GET` | `/quality-control/metrology/statistics` | [Auto] GET /quality-control/metrology/statistics | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/quality-control/metrology/statistics/advanced` | [Auto] GET /quality-control/metrology/statistics/advanced | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/quality-control/quality-control` | 获取质量控制记录列表 | page(integer,可选): query 参数; pageSize(integer,可选): query 参数; qc_type(string,可选): query 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `POST` | `/quality-control/quality-control` | 创建质量控制记录 | - | asset_code(string,必填); qc_type(string,必填); qc_date(string,必填); result(string,可选) | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作；Body 采用 JSON（除 file 字段外） |
| `GET` | `/quality-control/quality-control/{id}` | 获取质量控制记录详情 | id(integer,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询；调用前替换路径参数 {id} 等占位符 |
| `PUT` | `/quality-control/quality-control/{id}` | 更新质量控制记录 | id(integer,必填): path 参数 | payload(object,必填): application/json 请求体 | object: success, data, message, timestamp | 默认需 Bearer Token；用于整体更新；Body 采用 JSON（除 file 字段外）；调用前替换路径参数 {id} 等占位符 |
| `DELETE` | `/quality-control/quality-control/{id}` | 删除质量控制记录 | id(integer,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于删除/撤销；调用前替换路径参数 {id} 等占位符 |
| `GET` | `/quality-control/quality-control/statistics` | 获取质量控制统计 | start_date(string,可选): query 参数; end_date(string,可选): query 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/quality-control/reports/comprehensive` | [Auto] GET /quality-control/reports/comprehensive | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/quality-control/reports/metrology` | [Auto] GET /quality-control/reports/metrology | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/quality-control/reports/quality` | [Auto] GET /quality-control/reports/quality | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/quality-control/statistics` | [Auto] GET /quality-control/statistics | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/quality-control/statistics/advanced` | [Auto] GET /quality-control/statistics/advanced | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |

### 模块 `/ready` - ready 模块
- 模块说明：来自 /ready 的接口集合
- 接口数量：1

| 方法 | 路径 | 接口摘要 | 参数说明 | 请求体说明 | 返回结构 | 使用说明 |
|---|---|---|---|---|---|---|
| `GET` | `/ready` | [Auto] GET /ready | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |

### 模块 `/risk` - risk 模块
- 模块说明：来自 /risk 的接口集合
- 接口数量：3

| 方法 | 路径 | 接口摘要 | 参数说明 | 请求体说明 | 返回结构 | 使用说明 |
|---|---|---|---|---|---|---|
| `GET` | `/risk` | [Auto] GET /risk | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/risk/dashboard` | [Auto] GET /risk/dashboard | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/risk/status` | [Auto] GET /risk/status | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |

### 模块 `/roles-permissions` - 权限模块
- 模块说明：角色、权限与菜单相关接口。
- 接口数量：18

| 方法 | 路径 | 接口摘要 | 参数说明 | 请求体说明 | 返回结构 | 使用说明 |
|---|---|---|---|---|---|---|
| `GET` | `/roles-permissions` | [Auto] GET /roles-permissions | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/roles-permissions/menus/definitions` | [Auto] GET /roles-permissions/menus/definitions | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `POST` | `/roles-permissions/menus/force-update` | [Auto] POST /roles-permissions/menus/force-update | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作 |
| `GET` | `/roles-permissions/menus/list` | [Auto] GET /roles-permissions/menus/list | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/roles-permissions/permissions/definitions` | [Auto] GET /roles-permissions/permissions/definitions | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/roles-permissions/permissions/list` | [Auto] GET /roles-permissions/permissions/list | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/roles-permissions/roles` | [Auto] GET /roles-permissions/roles | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `POST` | `/roles-permissions/roles` | [Auto] POST /roles-permissions/roles | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作 |
| `PUT` | `/roles-permissions/roles/{role}` | [Auto] PUT /roles-permissions/roles/{role} | role(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于整体更新；调用前替换路径参数 {id} 等占位符 |
| `DELETE` | `/roles-permissions/roles/{role}` | [Auto] DELETE /roles-permissions/roles/{role} | role(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于删除/撤销；调用前替换路径参数 {id} 等占位符 |
| `GET` | `/roles-permissions/roles/{role}/menus` | [Auto] GET /roles-permissions/roles/{role}/menus | role(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询；调用前替换路径参数 {id} 等占位符 |
| `PUT` | `/roles-permissions/roles/{role}/menus` | [Auto] PUT /roles-permissions/roles/{role}/menus | role(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于整体更新；调用前替换路径参数 {id} 等占位符 |
| `GET` | `/roles-permissions/roles/{role}/permissions` | [Auto] GET /roles-permissions/roles/{role}/permissions | role(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询；调用前替换路径参数 {id} 等占位符 |
| `PUT` | `/roles-permissions/roles/{role}/permissions` | [Auto] PUT /roles-permissions/roles/{role}/permissions | role(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于整体更新；调用前替换路径参数 {id} 等占位符 |
| `PUT` | `/roles-permissions/roles/permissions/batch` | [Auto] PUT /roles-permissions/roles/permissions/batch | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于整体更新 |
| `POST` | `/roles-permissions/user/check-permission` | [Auto] POST /roles-permissions/user/check-permission | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作 |
| `GET` | `/roles-permissions/user/menus` | 获取当前用户菜单权限 | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/roles-permissions/user/permissions` | [Auto] GET /roles-permissions/user/permissions | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |

### 模块 `/safety-inspection` - safety inspection 模块
- 模块说明：来自 /safety-inspection 的接口集合
- 接口数量：1

| 方法 | 路径 | 接口摘要 | 参数说明 | 请求体说明 | 返回结构 | 使用说明 |
|---|---|---|---|---|---|---|
| `GET` | `/safety-inspection/status` | [Auto] GET /safety-inspection/status | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |

### 模块 `/scrapping` - scrapping 模块
- 模块说明：来自 /scrapping 的接口集合
- 接口数量：11

| 方法 | 路径 | 接口摘要 | 参数说明 | 请求体说明 | 返回结构 | 使用说明 |
|---|---|---|---|---|---|---|
| `GET` | `/scrapping` | [Auto] GET /scrapping | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `POST` | `/scrapping` | [Auto] POST /scrapping | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作 |
| `GET` | `/scrapping/{id}` | [Auto] GET /scrapping/{id} | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询；调用前替换路径参数 {id} 等占位符 |
| `PUT` | `/scrapping/{id}` | [Auto] PUT /scrapping/{id} | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于整体更新；调用前替换路径参数 {id} 等占位符 |
| `DELETE` | `/scrapping/{id}` | [Auto] DELETE /scrapping/{id} | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于删除/撤销；调用前替换路径参数 {id} 等占位符 |
| `POST` | `/scrapping/{id}/appraise` | [Auto] POST /scrapping/{id}/appraise | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作；调用前替换路径参数 {id} 等占位符 |
| `POST` | `/scrapping/{id}/approve` | [Auto] POST /scrapping/{id}/approve | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作；调用前替换路径参数 {id} 等占位符 |
| `POST` | `/scrapping/{id}/complete` | [Auto] POST /scrapping/{id}/complete | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作；调用前替换路径参数 {id} 等占位符 |
| `POST` | `/scrapping/{id}/dispose` | [Auto] POST /scrapping/{id}/dispose | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作；调用前替换路径参数 {id} 等占位符 |
| `POST` | `/scrapping/{id}/files` | [Auto] POST /scrapping/{id}/files | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作；调用前替换路径参数 {id} 等占位符 |
| `GET` | `/scrapping/statistics/summary` | [Auto] GET /scrapping/statistics/summary | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |

### 模块 `/special-equipment` - special equipment 模块
- 模块说明：来自 /special-equipment 的接口集合
- 接口数量：1

| 方法 | 路径 | 接口摘要 | 参数说明 | 请求体说明 | 返回结构 | 使用说明 |
|---|---|---|---|---|---|---|
| `GET` | `/special-equipment/status` | [Auto] GET /special-equipment/status | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |

### 模块 `/staff` - staff 模块
- 模块说明：来自 /staff 的接口集合
- 接口数量：1

| 方法 | 路径 | 接口摘要 | 参数说明 | 请求体说明 | 返回结构 | 使用说明 |
|---|---|---|---|---|---|---|
| `GET` | `/staff/status` | [Auto] GET /staff/status | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |

### 模块 `/system-config` - system config 模块
- 模块说明：来自 /system-config 的接口集合
- 接口数量：11

| 方法 | 路径 | 接口摘要 | 参数说明 | 请求体说明 | 返回结构 | 使用说明 |
|---|---|---|---|---|---|---|
| `GET` | `/system-config` | [Auto] GET /system-config | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/system-config/database` | [Auto] GET /system-config/database | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `PUT` | `/system-config/database` | [Auto] PUT /system-config/database | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于整体更新 |
| `POST` | `/system-config/database/test` | [Auto] POST /system-config/database/test | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作 |
| `GET` | `/system-config/iot-tokens` | [Auto] GET /system-config/iot-tokens | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `POST` | `/system-config/iot-tokens/{id}/revoke` | [Auto] POST /system-config/iot-tokens/{id}/revoke | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作；调用前替换路径参数 {id} 等占位符 |
| `POST` | `/system-config/iot-tokens/{id}/rotate` | [Auto] POST /system-config/iot-tokens/{id}/rotate | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作；调用前替换路径参数 {id} 等占位符 |
| `POST` | `/system-config/iot-tokens/generate` | [Auto] POST /system-config/iot-tokens/generate | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作 |
| `GET` | `/system-config/iot-tokens/scopes` | [Auto] GET /system-config/iot-tokens/scopes | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/system-config/iot-tokens/usage-guide` | [Auto] GET /system-config/iot-tokens/usage-guide | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `POST` | `/system-config/iot-tokens/verify` | [Auto] POST /system-config/iot-tokens/verify | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作 |

### 模块 `/technical-documents` - 技术资料模块
- 模块说明：技术资料上传、检索、AI分析相关接口。
- 接口数量：59

| 方法 | 路径 | 接口摘要 | 参数说明 | 请求体说明 | 返回结构 | 使用说明 |
|---|---|---|---|---|---|---|
| `GET` | `/technical-documents` | 获取技术资料列表 | page(integer,可选): 页码; pageSize(integer,可选): 每页数量; keyword(string,可选): 关键词搜索（标题、描述、文件名）; category(string,可选): 分类筛选; asset_type(string,可选): 资产类型筛选; brand(string,可选): 品牌筛选; status(string,可选): 状态筛选; review_status(string,可选): 审核状态筛选（不指定时，active 状态默认只显示 approved） | - | object: success, message | 默认需 Bearer Token；用于查询 |
| `POST` | `/technical-documents` | 上传技术资料 | - | file(file,必填): 技术资料文件; title(string,必填): 资料标题（必填）; description(string,可选): 资料描述; category(string,可选): 资料分类; asset_type(string,可选): 资产类型; brand(string,可选): 品牌; model(string,可选): 型号; version(string,可选): 版本号; language(string,可选): 语言; asset_code(string,可选): 单个资产编码（关联单个资产）; asset_codes(array,可选): 多个资产编码数组（关联多个资产）; is_public(boolean,可选): 是否公开 | object: success, message | 默认需 Bearer Token；用于创建/触发动作；Body 采用 JSON（除 file 字段外） |
| `GET` | `/technical-documents/{id}` | [Auto] GET /technical-documents/{id} | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询；调用前替换路径参数 {id} 等占位符 |
| `PUT` | `/technical-documents/{id}` | [Auto] PUT /technical-documents/{id} | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于整体更新；调用前替换路径参数 {id} 等占位符 |
| `DELETE` | `/technical-documents/{id}` | [Auto] DELETE /technical-documents/{id} | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于删除/撤销；调用前替换路径参数 {id} 等占位符 |
| `GET` | `/technical-documents/{id}/file` | [Auto] GET /technical-documents/{id}/file | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询；调用前替换路径参数 {id} 等占位符 |
| `POST` | `/technical-documents/{id}/review` | [Auto] POST /technical-documents/{id}/review | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作；调用前替换路径参数 {id} 等占位符 |
| `POST` | `/technical-documents/{id}/share` | [Auto] POST /technical-documents/{id}/share | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作；调用前替换路径参数 {id} 等占位符 |
| `GET` | `/technical-documents/{id}/shares` | [Auto] GET /technical-documents/{id}/shares | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询；调用前替换路径参数 {id} 等占位符 |
| `POST` | `/technical-documents/ai/ask` | [Auto] POST /technical-documents/ai/ask | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作 |
| `POST` | `/technical-documents/ai/batch/ocr` | [Auto] POST /technical-documents/ai/batch/ocr | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作 |
| `POST` | `/technical-documents/ai/batch/summary` | [Auto] POST /technical-documents/ai/batch/summary | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作 |
| `POST` | `/technical-documents/ai/compare` | [Auto] POST /technical-documents/ai/compare | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作 |
| `GET` | `/technical-documents/ai/conversations` | [Auto] GET /technical-documents/ai/conversations | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/technical-documents/ai/conversations/{id}` | [Auto] GET /technical-documents/ai/conversations/{id} | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询；调用前替换路径参数 {id} 等占位符 |
| `DELETE` | `/technical-documents/ai/conversations/{id}` | [Auto] DELETE /technical-documents/ai/conversations/{id} | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于删除/撤销；调用前替换路径参数 {id} 等占位符 |
| `POST` | `/technical-documents/ai/extract` | [Auto] POST /technical-documents/ai/extract | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作 |
| `POST` | `/technical-documents/ai/ocr` | [Auto] POST /technical-documents/ai/ocr | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作 |
| `GET` | `/technical-documents/ai/preview/{id}` | [Auto] GET /technical-documents/ai/preview/{id} | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询；调用前替换路径参数 {id} 等占位符 |
| `POST` | `/technical-documents/ai/recommend` | [Auto] POST /technical-documents/ai/recommend | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作 |
| `POST` | `/technical-documents/ai/search` | [Auto] POST /technical-documents/ai/search | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作 |
| `POST` | `/technical-documents/ai/suggest-category` | [Auto] POST /technical-documents/ai/suggest-category | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作 |
| `POST` | `/technical-documents/ai/suggest-tags` | [Auto] POST /technical-documents/ai/suggest-tags | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作 |
| `POST` | `/technical-documents/ai/summary` | [Auto] POST /technical-documents/ai/summary | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作 |
| `GET` | `/technical-documents/assets/{assetId}` | 获取资产的技术资料列表 | assetId(integer,必填): 资产ID | - | object: success, message | 默认需 Bearer Token；用于查询；调用前替换路径参数 {id} 等占位符 |
| `GET` | `/technical-documents/assets/{assetIdOrCode}` | [Auto] GET /technical-documents/assets/{assetIdOrCode} | assetIdOrCode(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询；调用前替换路径参数 {id} 等占位符 |
| `POST` | `/technical-documents/assets/{assetIdOrCode}/link/{documentId}` | [Auto] POST /technical-documents/assets/{assetIdOrCode}/link/{documentId} | assetIdOrCode(string,必填): path 参数; documentId(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作；调用前替换路径参数 {id} 等占位符 |
| `DELETE` | `/technical-documents/assets/{assetIdOrCode}/link/{documentId}` | [Auto] DELETE /technical-documents/assets/{assetIdOrCode}/link/{documentId} | assetIdOrCode(string,必填): path 参数; documentId(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于删除/撤销；调用前替换路径参数 {id} 等占位符 |
| `GET` | `/technical-documents/categories` | [Auto] GET /technical-documents/categories | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `POST` | `/technical-documents/enhanced/batch/category` | [Auto] POST /technical-documents/enhanced/batch/category | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作 |
| `POST` | `/technical-documents/enhanced/batch/delete` | [Auto] POST /technical-documents/enhanced/batch/delete | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作 |
| `GET` | `/technical-documents/enhanced/categories` | [Auto] GET /technical-documents/enhanced/categories | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `POST` | `/technical-documents/enhanced/categories` | [Auto] POST /technical-documents/enhanced/categories | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作 |
| `PUT` | `/technical-documents/enhanced/categories/{id}` | [Auto] PUT /technical-documents/enhanced/categories/{id} | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于整体更新；调用前替换路径参数 {id} 等占位符 |
| `DELETE` | `/technical-documents/enhanced/categories/{id}` | [Auto] DELETE /technical-documents/enhanced/categories/{id} | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于删除/撤销；调用前替换路径参数 {id} 等占位符 |
| `PUT` | `/technical-documents/enhanced/comments/{id}/resolve` | [Auto] PUT /technical-documents/enhanced/comments/{id}/resolve | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于整体更新；调用前替换路径参数 {id} 等占位符 |
| `GET` | `/technical-documents/enhanced/documents/{id}/comments` | [Auto] GET /technical-documents/enhanced/documents/{id}/comments | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询；调用前替换路径参数 {id} 等占位符 |
| `POST` | `/technical-documents/enhanced/documents/{id}/comments` | [Auto] POST /technical-documents/enhanced/documents/{id}/comments | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作；调用前替换路径参数 {id} 等占位符 |
| `POST` | `/technical-documents/enhanced/documents/{id}/favorite` | [Auto] POST /technical-documents/enhanced/documents/{id}/favorite | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作；调用前替换路径参数 {id} 等占位符 |
| `DELETE` | `/technical-documents/enhanced/documents/{id}/favorite` | [Auto] DELETE /technical-documents/enhanced/documents/{id}/favorite | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于删除/撤销；调用前替换路径参数 {id} 等占位符 |
| `GET` | `/technical-documents/enhanced/documents/{id}/tags` | [Auto] GET /technical-documents/enhanced/documents/{id}/tags | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询；调用前替换路径参数 {id} 等占位符 |
| `POST` | `/technical-documents/enhanced/documents/{id}/tags` | [Auto] POST /technical-documents/enhanced/documents/{id}/tags | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作；调用前替换路径参数 {id} 等占位符 |
| `GET` | `/technical-documents/enhanced/documents/{id}/versions` | [Auto] GET /technical-documents/enhanced/documents/{id}/versions | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询；调用前替换路径参数 {id} 等占位符 |
| `POST` | `/technical-documents/enhanced/documents/{id}/versions` | [Auto] POST /technical-documents/enhanced/documents/{id}/versions | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作；调用前替换路径参数 {id} 等占位符 |
| `POST` | `/technical-documents/enhanced/documents/{id}/view` | [Auto] POST /technical-documents/enhanced/documents/{id}/view | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作；调用前替换路径参数 {id} 等占位符 |
| `GET` | `/technical-documents/enhanced/my/favorites` | [Auto] GET /technical-documents/enhanced/my/favorites | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/technical-documents/enhanced/my/history` | [Auto] GET /technical-documents/enhanced/my/history | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/technical-documents/enhanced/statistics` | [Auto] GET /technical-documents/enhanced/statistics | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/technical-documents/enhanced/tags` | [Auto] GET /technical-documents/enhanced/tags | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `POST` | `/technical-documents/enhanced/tags` | [Auto] POST /technical-documents/enhanced/tags | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作 |
| `DELETE` | `/technical-documents/enhanced/tags/{id}` | [Auto] DELETE /technical-documents/enhanced/tags/{id} | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于删除/撤销；调用前替换路径参数 {id} 等占位符 |
| `GET` | `/technical-documents/enhanced/templates` | [Auto] GET /technical-documents/enhanced/templates | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `POST` | `/technical-documents/enhanced/templates` | [Auto] POST /technical-documents/enhanced/templates | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作 |
| `DELETE` | `/technical-documents/enhanced/templates/{id}` | [Auto] DELETE /technical-documents/enhanced/templates/{id} | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于删除/撤销；调用前替换路径参数 {id} 等占位符 |
| `GET` | `/technical-documents/pending` | [Auto] GET /technical-documents/pending | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `DELETE` | `/technical-documents/shares/{shareId}` | [Auto] DELETE /technical-documents/shares/{shareId} | shareId(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于删除/撤销；调用前替换路径参数 {id} 等占位符 |
| `GET` | `/technical-documents/test/assets/{assetIdOrCode}` | [Auto] GET /technical-documents/test/assets/{assetIdOrCode} | assetIdOrCode(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询；调用前替换路径参数 {id} 等占位符 |
| `GET` | `/technical-documents/upload/{token}` | [Auto] GET /technical-documents/upload/{token} | token(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询；调用前替换路径参数 {id} 等占位符 |
| `POST` | `/technical-documents/upload/{token}` | [Auto] POST /technical-documents/upload/{token} | token(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作；调用前替换路径参数 {id} 等占位符 |

### 模块 `/temp-assets` - temp assets 模块
- 模块说明：来自 /temp-assets 的接口集合
- 接口数量：5

| 方法 | 路径 | 接口摘要 | 参数说明 | 请求体说明 | 返回结构 | 使用说明 |
|---|---|---|---|---|---|---|
| `GET` | `/temp-assets` | [Auto] GET /temp-assets | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `POST` | `/temp-assets` | [Auto] POST /temp-assets | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作 |
| `GET` | `/temp-assets/{id}` | [Auto] GET /temp-assets/{id} | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询；调用前替换路径参数 {id} 等占位符 |
| `PUT` | `/temp-assets/{id}` | [Auto] PUT /temp-assets/{id} | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于整体更新；调用前替换路径参数 {id} 等占位符 |
| `DELETE` | `/temp-assets/{id}` | [Auto] DELETE /temp-assets/{id} | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于删除/撤销；调用前替换路径参数 {id} 等占位符 |

### 模块 `/tenant-module-config` - 租户模块配置模块
- 模块说明：租户维度模块配置与菜单同步接口。
- 接口数量：11

| 方法 | 路径 | 接口摘要 | 参数说明 | 请求体说明 | 返回结构 | 使用说明 |
|---|---|---|---|---|---|---|
| `GET` | `/tenant-module-config` | [Auto] GET /tenant-module-config | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/tenant-module-config/logs` | 获取配置变更日志 | tenantId(string,可选): 企业空间ID; moduleId(string,可选): 模块ID; startDate(string,可选): 开始日期; endDate(string,可选): 结束日期; page(integer,可选): 页码; pageSize(integer,可选): 每页数量 | - | object: total, records | 默认需 Bearer Token；用于查询 |
| `GET` | `/tenant-module-config/modules` | 获取所有可用模块 | - | - | array | 默认需 Bearer Token；用于查询 |
| `POST` | `/tenant-module-config/modules/{moduleId}/check-dependencies` | 检查模块依赖关系 | moduleId(string,必填): 模块ID | action(string,可选): 操作类型 | object: valid, message | 默认需 Bearer Token；用于创建/触发动作；Body 采用 JSON（除 file 字段外）；调用前替换路径参数 {id} 等占位符 |
| `GET` | `/tenant-module-config/modules/{moduleId}/dependencies` | 获取指定模块的依赖关系 | moduleId(string,必填): 模块ID | - | array | 默认需 Bearer Token；用于查询；调用前替换路径参数 {id} 等占位符 |
| `GET` | `/tenant-module-config/modules/{moduleId}/menus` | 获取指定模块的菜单列表 | moduleId(string,必填): 模块ID | - | array | 默认需 Bearer Token；用于查询；调用前替换路径参数 {id} 等占位符 |
| `GET` | `/tenant-module-config/tenants` | 获取企业空间列表 | search(string,可选): 按企业名称或ID搜索; page(integer,可选): 页码; pageSize(integer,可选): 每页数量 | - | object: total, records | 默认需 Bearer Token；用于查询 |
| `GET` | `/tenant-module-config/tenants/{tenantId}/modules` | 获取指定企业空间的模块配置 | tenantId(string,必填): 企业空间ID | - | array | 默认需 Bearer Token；用于查询；调用前替换路径参数 {id} 等占位符 |
| `PUT` | `/tenant-module-config/tenants/{tenantId}/modules` | 更新企业空间的模块配置 | tenantId(string,必填): 企业空间ID | payload(array,必填): application/json 请求体 | object: success, message | 默认需 Bearer Token；用于整体更新；Body 采用 JSON（除 file 字段外）；调用前替换路径参数 {id} 等占位符 |
| `GET` | `/tenant-module-config/tenants/{tenantId}/modules/{moduleId}/menus` | 获取指定企业空间的模块菜单配置 | tenantId(string,必填): 企业空间ID; moduleId(string,必填): 模块ID | - | array | 默认需 Bearer Token；用于查询；调用前替换路径参数 {id} 等占位符 |
| `PUT` | `/tenant-module-config/tenants/{tenantId}/modules/{moduleId}/menus` | 更新指定企业空间的模块菜单配置 | tenantId(string,必填): 企业空间ID; moduleId(string,必填): 模块ID | payload(array,必填): application/json 请求体 | object: success, message | 默认需 Bearer Token；用于整体更新；Body 采用 JSON（除 file 字段外）；调用前替换路径参数 {id} 等占位符 |

### 模块 `/tenants` - tenants 模块
- 模块说明：来自 /tenants 的接口集合
- 接口数量：4

| 方法 | 路径 | 接口摘要 | 参数说明 | 请求体说明 | 返回结构 | 使用说明 |
|---|---|---|---|---|---|---|
| `GET` | `/tenants` | [Auto] GET /tenants | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `POST` | `/tenants` | [Auto] POST /tenants | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作 |
| `GET` | `/tenants/current/info` | [Auto] GET /tenants/current/info | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `POST` | `/tenants/verify` | [Auto] POST /tenants/verify | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作 |

### 模块 `/transfer` - 调配模块
- 模块说明：资产调配申请、审批与记录相关接口。
- 接口数量：7

| 方法 | 路径 | 接口摘要 | 参数说明 | 请求体说明 | 返回结构 | 使用说明 |
|---|---|---|---|---|---|---|
| `GET` | `/transfer` | [Auto] GET /transfer | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `POST` | `/transfer` | [Auto] POST /transfer | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作 |
| `GET` | `/transfer/{id}` | [Auto] GET /transfer/{id} | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询；调用前替换路径参数 {id} 等占位符 |
| `DELETE` | `/transfer/{id}` | [Auto] DELETE /transfer/{id} | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于删除/撤销；调用前替换路径参数 {id} 等占位符 |
| `PUT` | `/transfer/{id}/approve` | [Auto] PUT /transfer/{id}/approve | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于整体更新；调用前替换路径参数 {id} 等占位符 |
| `PUT` | `/transfer/{id}/complete` | [Auto] PUT /transfer/{id}/complete | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于整体更新；调用前替换路径参数 {id} 等占位符 |
| `GET` | `/transfer/statistics` | [Auto] GET /transfer/statistics | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |

### 模块 `/uptime` - uptime 模块
- 模块说明：来自 /uptime 的接口集合
- 接口数量：2

| 方法 | 路径 | 接口摘要 | 参数说明 | 请求体说明 | 返回结构 | 使用说明 |
|---|---|---|---|---|---|---|
| `GET` | `/uptime/config` | [Auto] GET /uptime/config | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/uptime/status` | [Auto] GET /uptime/status | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |

### 模块 `/users` - 用户模块
- 模块说明：用户登录、信息与认证相关接口。
- 接口数量：15

| 方法 | 路径 | 接口摘要 | 参数说明 | 请求体说明 | 返回结构 | 使用说明 |
|---|---|---|---|---|---|---|
| `GET` | `/users` | [Auto] GET /users | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `POST` | `/users` | [Auto] POST /users | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作 |
| `DELETE` | `/users/batch` | [Auto] DELETE /users/batch | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于删除/撤销 |
| `PUT` | `/users/batch/status` | [Auto] PUT /users/batch/status | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于整体更新 |
| `GET` | `/users/export` | [Auto] GET /users/export | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `POST` | `/users/join-enterprise` | [Auto] POST /users/join-enterprise | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作 |
| `POST` | `/users/login` | 用户登录 | - | username(string,必填): 用户名; password(string,必填): 密码 | object: success, message | 默认需 Bearer Token；用于创建/触发动作；Body 采用 JSON（除 file 字段外） |
| `GET` | `/users/me` | [Auto] GET /users/me | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/users/pending` | [Auto] GET /users/pending | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/users/profile` | [Auto] GET /users/profile | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `POST` | `/users/refresh-token` | 刷新令牌 | - | - | object: success, message | 默认需 Bearer Token；用于创建/触发动作 |
| `POST` | `/users/register` | [Auto] POST /users/register | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作 |
| `PUT` | `/users/role-requests/{id}/approve` | [Auto] PUT /users/role-requests/{id}/approve | id(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于整体更新；调用前替换路径参数 {id} 等占位符 |
| `GET` | `/users/role-requests/pending` | [Auto] GET /users/role-requests/pending | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/users/roles` | [Auto] GET /users/roles | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |

### 模块 `/workflow` - workflow 模块
- 模块说明：来自 /workflow 的接口集合
- 接口数量：5

| 方法 | 路径 | 接口摘要 | 参数说明 | 请求体说明 | 返回结构 | 使用说明 |
|---|---|---|---|---|---|---|
| `GET` | `/workflow` | [Auto] GET /workflow | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/workflow/default` | [Auto] GET /workflow/default | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `GET` | `/workflow/states` | [Auto] GET /workflow/states | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |
| `POST` | `/workflow/transition/{assetId}` | [Auto] POST /workflow/transition/{assetId} | assetId(string,必填): path 参数 | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于创建/触发动作；调用前替换路径参数 {id} 等占位符 |
| `GET` | `/workflow/transitions` | [Auto] GET /workflow/transitions | - | - | object: success, data, message, timestamp | 默认需 Bearer Token；用于查询 |

## 8. AI调用建议（用于提示词）
- 先根据用户意图匹配模块，再按 `方法+路径` 精确调用。
- 若路径包含 `{id}` 等占位符，先通过查询接口拿到真实ID。
- 对写操作（POST/PUT/PATCH/DELETE）先做参数补全与校验，再调用。
- 调用失败时优先检查：Token、租户上下文(`X-Tenant-ID`)、必填参数、数据权限。
- 遇到 `401/403` 直接走权限分支，不要重试同样请求。
- 遇到 `429/503` 做退避重试并提示服务压力或依赖不可用。
