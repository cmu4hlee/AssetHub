# AssetHub -> OpenClaw 技能调用说明

本文档用于让 OpenClaw 把 AssetHub 当作一组可调用的业务技能 API 来使用，而不是只把它当成普通聊天后端。

如果你是 OpenClaw，请优先按本文档的“工作流 + 接口映射 + 兼容字段”来调用；如果运行时接口文档和本文档冲突，优先以当前后端实现为准。

---

## 1. 你要怎么理解 AssetHub

AssetHub 是一个多租户资产管理系统，OpenClaw 调用它时要遵循下面的原则：

- 先登录，再调用业务接口。
- IoT 设备自动上报类接口是例外：设备监测 / 环境监测 / 定位上报优先走 IoT Token，而不是用户登录态。
- 先确定租户，再查询/写入数据。
- 先查资产、部门、单据等基础数据，再做写操作。
- 涉及写入时，不要猜字段；缺字段就继续追问用户。
- 任何查询和写入都必须遵守租户隔离、角色权限、模块启停约束。
- 对于“调配”能力，默认走“调配申请”流程，不走旧的“调配记录”流程。

推荐把 AssetHub 的使用分成三类：

1. 业务技能调用：直接调用 `/api/*` 业务接口。
2. 对话代理调用：调用 `/api/ai/chat/completions`，让 AssetHub 代你转发到 OpenClaw 网关。
3. 设备侧上报调用：调用 `/api/iot/*/ingest` 或 `/api/iot/location/*`，这类接口优先用 IoT Token。

对 OpenClaw 来说，默认优先用第 1 类，因为更稳定、可控、可审计。

---

## 2. 标准工作流

OpenClaw 调用 AssetHub 时，按这个顺序执行：

### 步骤 1：登录

- 接口：`POST /api/users/login`
- 作用：获取 JWT、当前用户信息、默认租户、可访问企业列表

请求示例：

```json
{
  "username": "alice",
  "password": "******"
}
```

成功后重点保存：

- `data.token`
- `data.user`
- `data.enterprises`
- `data.user.tenant_id`

### 步骤 2：确定租户上下文

- 普通用户：默认使用登录返回的 `data.user.tenant_id`
- 超级管理员：如果要切换企业，再额外传 Header `X-Tenant-ID`
- 非超级管理员：只有在自己被授权到其他租户时，才允许切换 `X-Tenant-ID`

### 步骤 3：选择技能路径

根据用户意图决定走哪类接口：

- 查资产 -> `/api/assets`
- 报修 -> `/api/maintenance/requests`
- 维修日志 -> `/api/maintenance/logs`
- 设备监测 / 设备故障上报 -> `/api/iot/asset-monitoring/ingest`
- 盘点 -> `/api/inventory`
- 闲置发布 -> `/api/idle`
- 报废申请 -> `/api/scrapping`
- 调配申请 -> `/api/assets/:id/transfer-apply`
- 调配审批 -> `/api/assets/transfer-requests/:request_id/approve`
- 验收查询 -> `/api/acceptance/records`
- 技术资料查询 -> `/api/technical-documents`
- 计量查询 -> `/api/quality-control/metrology`
- 不良事件查询 -> `/api/adverse-events`

### 步骤 4：先查后写

写操作前建议先查一次：

- 调配前先查资产，拿到真实 `id`
- 报修前先确认 `asset_code`
- 盘点新增明细前先确认盘点记录 `id`
- 闲置发布前先确认是“现有资产”还是“临时资产”

### 步骤 5：写入完成后回查确认

写操作完成后，建议再调用一次列表或详情接口确认结果，避免只依赖“创建成功”文案。

---

## 3. 基础调用约定

### 3.1 Base URL

- 推荐统一按相对前缀使用：`/api`
- 如果是外部部署环境，则是：`https://<你的域名>/api`

### 3.2 通用请求头

业务接口默认需要：

```http
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

切换租户时追加：

```http
X-Tenant-ID: <tenant_id>
```

### 3.3 通用响应判断

优先按下面逻辑判断：

1. `success === true` 视为成功
2. 真正数据优先看 `data`
3. 列表结果可能出现在：
   - `data` 为数组
   - `data.list`
   - `data.records`
4. 分页通常在：
   - `pagination`
   - `data.pagination`

### 3.4 常见错误处理

- `400`：参数缺失或业务校验失败，向用户补齐字段
- `401`：Token 无效或过期，需要重新登录
- `403`：无权限、租户切换非法、模块未启用，不要重试写操作
- `404`：资源不存在，重新确认资产/单据 ID
- `500`：后端异常，保留请求参数并提示稍后重试

额外注意：

- 某些接口会因为模块未启用返回 `403`，错误体里可能带 `MODULE_DISABLED`
- 非超级管理员乱传 `X-Tenant-ID` 会被拒绝

---

## 4. OpenClaw 运行时发现接口的方法

运行时可以用以下接口做“模块发现”和“只读接口总览”：

- `GET /api/api-documentation/modules`
- `GET /api/api-documentation/endpoints`
- `GET /api/api-documentation/module/{path}`

推荐方式：

1. 先调用 `/api/api-documentation/modules`
2. 再按模块调用 `/api/api-documentation/module/assets`、`/api/api-documentation/module/maintenance` 等

但要注意一个重要例外：

- “调配申请”相关接口目前不一定完整出现在运行时接口文档中
- OpenClaw 做调配时，优先信任本文档和实际后端路由，不要只依赖 `/api/api-documentation`

---

## 5. 业务技能映射表

| 意图/技能 | 推荐接口 | 调用前提 | 关键字段 | 调用后建议 |
|---|---|---|---|---|
| 资产查询 | `GET /api/assets` | 已登录 | `page`, `pageSize`, `search`, `status`, `department_id` | 多结果时让用户确认目标资产 |
| 资产详情 | `GET /api/assets/{id}` | 已有资产 `id` | path `id` | 如需上下文，可继续查变更日志 |
| 报修申请 | `POST /api/maintenance/requests` | 已确认 `asset_code` | `asset_code`, `fault_description` | 回查 `/api/maintenance/requests?asset_code=...` |
| 维修日志登记 | `POST /api/maintenance/logs` | 已确认 `asset_code` | `asset_code`, `maintenance_type`, `maintenance_date`, `maintenance_person` | 回查 `/api/maintenance/logs?asset_code=...` |
| 设备监测数据接收 | `POST /api/iot/asset-monitoring/ingest` | 已配置 IoT Token | `device_id` + 至少一个监测字段（推荐带 `error_code`） | 回查 latest / series |
| 设备监测批量接收 | `POST /api/iot/asset-monitoring/ingest/batch` | 已配置 IoT Token | `events[]` | 回查 latest / series |
| 设备监测最新状态 | `GET /api/iot/asset-monitoring/devices/{deviceId}/latest` | 已登录或带有效查询上下文 | path `deviceId` | 解析 `payload_json` 中扩展错误字段 |
| 盘点列表 | `GET /api/inventory` | 已登录 | `page`, `pageSize`, `status` | 可继续查统计或详情 |
| 发起盘点 | `POST /api/inventory` | 已收集必填项 | `inventory_no`, `inventory_date`, `inventory_type`, `inventory_person` | 回查 `/api/inventory/{id}` |
| 盘点新增明细 | `POST /api/inventory/{id}/details` | 已有盘点 `id` | `asset_code` 为核心 | 回查盘点详情或统计 |
| 闲置发布 | `POST /api/idle` | 已确认现有资产或临时资产 | `publish_person`，以及 `asset_code` 或 `asset_name` 二选一 | 回查 `/api/idle` |
| 报废申请 | `POST /api/scrapping` | 已确认资产 | `asset_code`, `asset_name`, `applicant`, `scrapping_reason` | 回查 `/api/scrapping` |
| 调配申请 | `POST /api/assets/{id}/transfer-apply` | 必须先查资产拿到真实 `id` | path `id`，body `to_department_id`, `reason` | 回查 `/api/assets/transfer-requests` |
| 调配申请列表 | `GET /api/assets/transfer-requests` | 已登录 | `page`, `pageSize`, `status` | 用于审批前确认 |
| 调配审批 | `POST /api/assets/transfer-requests/{request_id}/approve` | 仅管理员 | `action`, `comment` | 回查申请列表 |
| 验收记录查询 | `GET /api/acceptance/records` | 已登录 | 视部署支持的筛选项而定 | 汇总返回 |
| 技术资料查询 | `GET /api/technical-documents` | 已登录 | `page`, `pageSize`, `keyword`, `category`, `status` | 结果多时建议摘要输出 |
| 计量记录查询 | `GET /api/quality-control/metrology` | 已登录 | `page`, `pageSize`, `asset_code` | 可进一步提示到期风险 |
| 不良事件查询 | `GET /api/adverse-events` | 已登录 | 以部署实际筛选项为准 | 汇总返回 |

---

## 6. 关键能力的推荐调用流程

### 6.1 查资产

1. `GET /api/assets?page=1&pageSize=20&search=<keyword>`
2. 如果命中多条，先让用户确认
3. 确认后用 `GET /api/assets/{id}` 拉详情

推荐示例：

```http
GET /api/assets?page=1&pageSize=20&search=TEST001
Authorization: Bearer <token>
X-Tenant-ID: 2
```

### 6.2 报修

最小流程：

1. 先确认 `asset_code`
2. 收集故障描述
3. 调 `POST /api/maintenance/requests`
4. 再回查列表确认创建结果

### 6.3 维修日志登记

最小流程：

1. 确认 `asset_code`
2. 收集 `maintenance_type`、`maintenance_date`、`maintenance_person`
3. 如果用户给了内容/成本，一并传入
4. 调 `POST /api/maintenance/logs`

### 6.4 调配申请

这是最容易踩坑的流程，必须按下面步骤：

1. 先查资产列表或详情，拿到资产真实 `id`
2. 不要直接把 `asset_code` 当作 path 参数
3. 调用 `POST /api/assets/{id}/transfer-apply`
4. 再查 `/api/assets/transfer-requests`

### 6.5 调配审批

1. 先查 `GET /api/assets/transfer-requests`
2. 确认目标申请 `request_id`
3. 调 `POST /api/assets/transfer-requests/{request_id}/approve`
4. `action=approve` 表示通过，`action=reject` 表示拒绝

### 6.6 发起盘点

1. 收集 `inventory_no`
2. 收集 `inventory_date`
3. 收集 `inventory_type`，仅允许：
   - `全面盘点`
   - `抽查盘点`
   - `专项盘点`
4. 收集 `inventory_person`
5. 调 `POST /api/inventory`

### 6.7 闲置发布

有两种模式：

- 现有资产：传 `asset_code`
- 临时闲置资产：没有 `asset_code` 时传 `asset_name`

两种模式共同要求：

- `publish_person` 必填

### 6.8 报废申请

至少收集：

- `asset_code`
- `asset_name`
- `applicant`
- `scrapping_reason`

### 6.9 设备监测 / 设备故障上报

这是一个和普通业务接口不同的例外流程：

1. 不优先走 `/api/users/login`
2. 优先准备 IoT Token，推荐 scope 为 `asset-monitoring`
3. 调 `POST /api/iot/asset-monitoring/ingest` 或 `/ingest/batch`
4. 最小必填是 `device_id`，并且至少带一个监测字段；故障场景建议至少带 `error_code`
5. 如果还有 `error_message`、`error_analysis`、`screenshot_url`，可以作为扩展字段一起上报
6. 上报后回查：
   - `GET /api/iot/asset-monitoring/devices/{deviceId}/latest`
   - `GET /api/iot/asset-monitoring/assets/{assetCode}/latest`
   - `GET /api/iot/asset-monitoring/assets/{assetCode}/series`

详细说明见：

- `/Users/cjlee/PJ/AssetHub/docs/OpenClaw设备监测与故障上报说明.md`

---

## 7. 兼容字段与实现差异

仓库里存在“文档字段”和“当前代码字段”不完全一致的情况。为了让 OpenClaw 在不同部署版本上更稳，推荐按下面方式传参。

### 7.1 报修接口

当前后端实现以 `fault_description` 为准，但有些文档里写的是 `issue_description`。

推荐兼容传法：

```json
{
  "asset_code": "TEST001",
  "fault_description": "设备无法开机",
  "issue_description": "设备无法开机",
  "fault_level": "紧急"
}
```

### 7.2 维修日志接口

当前后端实现以 `maintenance_cost` 为准，部分文档会写 `cost`。

推荐兼容传法：

```json
{
  "asset_code": "TEST001",
  "maintenance_type": "故障维修",
  "maintenance_date": "2026-03-24",
  "maintenance_person": "张三",
  "maintenance_content": "更换电源模块",
  "maintenance_cost": 500,
  "cost": 500
}
```

### 7.3 调配申请接口

当前后端实现有 3 个要点：

1. path 参数实际按资产 `id` 查询，不要默认传 `asset_code`
2. body 当前实现读取 `to_department_id`
3. 业务语义文档常写 `target_department`

推荐兼容传法：

```json
{
  "to_department_id": "DEP90",
  "target_department": "DEP90",
  "reason": "科室调整"
}
```

### 7.4 调配审批接口

当前后端实现读取 `action`，但部分业务文档写 `approved` 布尔值。

推荐兼容传法：

```json
{
  "action": "approve",
  "approved": true,
  "comment": "同意调配"
}
```

拒绝时：

```json
{
  "action": "reject",
  "approved": false,
  "comment": "信息不完整，驳回"
}
```

### 7.5 调配接口选型

AssetHub 当前同时存在两套路由：

- 推荐默认使用：`/api/assets/*` 下的“调配申请”流程
- 兼容旧流程：`/api/transfer/*` 下的“调配记录”流程

OpenClaw 默认应这样选：

- 用户说“申请调配 / 发起调配 / 审批调配” -> 走 `/api/assets/*`
- 用户明确要操作“调配记录单 / 调配完成单 / 旧流程” -> 才考虑 `/api/transfer/*`

### 7.6 设备监测接口的扩展字段

当前设备监测时序表的标准字段主要是：

- `device_id`
- `asset_code`
- `runtime_state`
- `signal_strength`
- `battery_level`
- `cpu_usage`
- `memory_usage`
- `error_code`

如果还要传：

- `error_message`
- `error_analysis`
- `severity`
- `screenshot_url`
- `screenshot_base64`

当前实现不会把这些字段拆成独立列，但会跟随原始请求一起进入 `payload_json`。

因此 OpenClaw 查询设备监测结果时，不能只看标准列，还要进一步解析 `payload_json`。

---

## 8. 可直接复用的请求示例

### 8.1 登录

```bash
curl -X POST "https://<host>/api/users/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "alice",
    "password": "******"
  }'
```

### 8.2 查询资产

```bash
curl -X GET "https://<host>/api/assets?page=1&pageSize=20&search=TEST001" \
  -H "Authorization: Bearer <token>" \
  -H "X-Tenant-ID: 2"
```

### 8.3 报修

```bash
curl -X POST "https://<host>/api/maintenance/requests" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: 2" \
  -d '{
    "asset_code": "TEST001",
    "fault_description": "设备无法开机",
    "issue_description": "设备无法开机",
    "fault_level": "紧急",
    "request_department": "放射科"
  }'
```

### 8.4 发起盘点

```bash
curl -X POST "https://<host>/api/inventory" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: 2" \
  -d '{
    "inventory_no": "INV20260324001",
    "inventory_date": "2026-03-24",
    "inventory_type": "专项盘点",
    "inventory_person": "李四",
    "remark": "OpenClaw 发起"
  }'
```

### 8.5 调配申请

先查资产拿 `id=26523`，再调用：

```bash
curl -X POST "https://<host>/api/assets/26523/transfer-apply" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: 2" \
  -d '{
    "to_department_id": "DEP90",
    "target_department": "DEP90",
    "reason": "科室调整"
  }'
```

### 8.6 调配审批

```bash
curl -X POST "https://<host>/api/assets/transfer-requests/18/approve" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: 2" \
  -d '{
    "action": "approve",
    "approved": true,
    "comment": "同意调配"
  }'
```

### 8.7 设备监测故障上报

设备监测建议走 IoT Token，而不是普通用户 JWT：

```bash
curl -X POST "https://<host>/api/iot/asset-monitoring/ingest" \
  -H "Content-Type: application/json" \
  -H "x-iot-token: <YOUR_IOT_TOKEN>" \
  -d '{
    "device_id": "MON-001",
    "asset_code": "ASSET-001",
    "runtime_state": "error",
    "error_code": "E101",
    "error_message": "高压模块过温，设备已自动停机",
    "error_analysis": "疑似风扇卡滞或散热孔堵塞，建议停机检查散热模组",
    "screenshot_url": "/uploads/device-errors/mon-001-20260325103000.png",
    "event_time": "2026-03-25T10:30:00+08:00"
  }'
```

---

## 9. OpenClaw 对话代理模式（可选）

如果你不是把 AssetHub 当“业务技能库”，而是想让 AssetHub 代你接 OpenClaw 对话网关，可以用：

- `POST /api/ai/chat/completions`

这个接口是 OpenAI 兼容风格，适合“会话型 AI 调用”，不适合代替所有业务写接口。

### 9.1 请求体核心字段

- `model`
- `messages`
- `session_id`
- `client_request_id`
- `metadata`

可选的 OpenClaw 首次鉴权字段：

- `openclaw_username`
- `openclaw_password`
- `openclaw_auth`

### 9.2 第一次会话建议

只在同一会话首次调用时传 OpenClaw 凭据，成功后不要重复发送密码。

示例：

```json
{
  "model": "openclaw",
  "session_id": "session-asset-001",
  "client_request_id": "req-asset-001",
  "messages": [
    { "role": "system", "content": "你只能调用 AssetHub 已授权的接口。" },
    { "role": "user", "content": "帮我查询 TEST001 的资产信息" }
  ],
  "openclaw_username": "alice",
  "openclaw_password": "******",
  "openclaw_auth": {
    "username": "alice",
    "password": "******",
    "source": "assethub_login",
    "first_call": true
  }
}
```

### 9.3 请求头建议

```http
Authorization: Bearer <JWT_TOKEN>
X-AI-Trace-ID: <trace_id>
X-AI-Session-ID: <session_id>
X-AI-Request-ID: <client_request_id>
```

### 9.4 返回特点

- 返回体会被整理成 OpenAI 兼容结构
- 重点读取 `choices[0].message.content`
- 后端对重复 `client_request_id` 有去重机制
- 响应头可能包含：
  - `X-AI-Trace-ID`
  - `X-AI-Deduplicated`

### 9.5 什么时候用它

适合：

- 让 AssetHub 充当 OpenClaw 会话代理
- 需要保留 `session_id`、trace、请求去重

不适合：

- 直接创建报修、盘点、调配、报废等确定性业务动作

对于确定性业务，还是优先直接调业务接口。

---

## 10. OpenClaw 执行规则

如果你是 OpenClaw，在调用 AssetHub 时请遵守下面规则：

- 不要跨租户猜数据，租户不明确时先确认企业上下文。
- 不要假设用户一定有管理员权限；审批、配置、跨租户操作前先判断角色。
- 写操作前，必须检查必填字段是否齐全。
- 对调配申请，必须先查资产拿真实 `id`。
- 对调配审批，默认发 `action + approved` 双字段兼容包。
- 对报修，默认发 `fault_description + issue_description` 双字段兼容包。
- 对维修日志，默认发 `maintenance_cost + cost` 双字段兼容包。
- 如果 `/api/api-documentation` 里找不到某个接口，不代表接口不存在；尤其是调配申请相关接口要以本文档和后端实现为准。
- 返回成功后，最好再回查一次列表或详情，确保业务状态真正落库。

---

## 11. 建议的参考顺序

OpenClaw 侧如果需要继续深挖，可按这个顺序读项目内资料：

1. `docs/OpenClaw技能调用说明.md`
2. `docs/API_全量接口说明_供AI读取.md`
3. `docs/AI助手全面整理与适配说明.md`
4. `docs/资产调配逻辑整理.md`
5. `backend/routes/ai.js`
6. `backend/routes/assets/asset.transfer.js`
7. `backend/routes/maintenance/requests.router.js`
8. `backend/routes/maintenance/logs.router.js`
9. `backend/routes/inventory.js`
10. `backend/middleware/auth.js`

这份文档的目的不是取代全量接口文档，而是给 OpenClaw 一个“先做什么、再调什么、哪些地方容易踩坑”的稳定操作手册。
