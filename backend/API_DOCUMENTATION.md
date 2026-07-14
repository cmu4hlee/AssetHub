# AssetHub 维修维护模块 API 完整文档

**版本：** 1.0.0
**更新日期：** 2026-05-01
**API基础URL：** `http://localhost:5183/api`

---

## 📑 目录

1. [认证与授权](#认证与授权)
2. [幂等性机制](#幂等性机制)
3. [错误处理](#错误处理)
4. [维修日志管理](#维修日志管理)
5. [预防性维护](#预防性维护)
6. [故障维修申请](#故障维修申请)
7. [维修工单管理](#维修工单管理)
8. [维修模板](#维修模板)
9. [维护提醒](#维护提醒)
10. [资产使用量追踪](#资产使用量追踪)
11. [维修成本统计](#维修成本统计)
12. [维修效率分析](#维修效率分析)
13. [AI维修助手](#ai维修助手)
14. [通用响应格式](#通用响应格式)

---

## 认证与授权

### 认证方式

API使用 **JWT Bearer Token** 进行认证。

**请求头格式：**
```
Authorization: Bearer <your_jwt_token>
```

**示例：**
```bash
curl -X GET "http://localhost:5183/api/maintenance/logs" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### 租户隔离

多租户环境下，需要在请求头中指定租户ID：

```
X-Tenant-ID: <tenant_id>
```

**示例：**
```bash
curl -X GET "http://localhost:5183/api/maintenance/logs" \
  -H "Authorization: Bearer <token>" \
  -H "X-Tenant-ID: 1"
```

---

## 幂等性机制

### 什么是幂等性

幂等性机制用于防止重复提交，确保相同请求不会产生多次副作用。

### 使用方式

在 POST、PUT、DELETE 请求中添加幂等性键：

**请求头：**
```
Idempotency-Key: <唯一标识符>
```

**格式要求：**
- 长度不超过128字符
- 推荐使用UUID格式

**示例：**
```bash
curl -X POST "http://localhost:5183/api/maintenance/logs" \
  -H "Authorization: Bearer <token>" \
  -H "Idempotency-Key: $(uuidgen)" \
  -H "Content-Type: application/json" \
  -d '{"asset_code":"000000555",...}'
```

### 高风险操作确认

某些高风险操作（如创建、更新、删除）可能需要二次确认：

**流程：**
1. 首次请求返回 428 状态码
2. 响应包含 `confirmToken`
3. 使用 `confirmToken` 重新请求
4. 操作成功执行

**响应示例：**
```json
{
  "success": false,
  "code": "HIGH_RISK_CONFIRMATION_REQUIRED",
  "message": "高风险操作需要二次确认后才能执行",
  "requiresConfirmation": true,
  "actionId": "hra_xxx",
  "confirmToken": "eyJhbGciOiJIUzI1NiJ9...",
  "confirmTokenHeader": "X-Risk-Confirm-Token",
  "expiresInMs": 300000
}
```

**二次确认请求：**
```bash
curl -X POST "http://localhost:5183/api/maintenance/logs" \
  -H "Authorization: Bearer <token>" \
  -H "Idempotency-Key: xxx" \
  -H "X-Risk-Confirm-Token: <confirmToken>" \
  -H "Content-Type: application/json" \
  -d '{...}'
```

---

## 错误处理

### HTTP状态码

| 状态码 | 说明 | 处理建议 |
|--------|------|----------|
| 200 | 成功 | 正常处理响应 |
| 201 | 创建成功 | 资源已创建 |
| 400 | 请求参数错误 | 检查请求参数 |
| 401 | 未认证 | 重新登录 |
| 403 | 无权限 | 联系管理员 |
| 404 | 资源不存在 | 检查资源ID |
| 428 | 需要幂等性键/确认 | 添加相应头部 |
| 500 | 服务器错误 | 联系技术支持 |

### 错误响应格式

```json
{
  "success": false,
  "message": "错误描述信息",
  "code": "ERROR_CODE",
  "errors": [
    {
      "field": "字段名",
      "message": "具体错误"
    }
  ]
}
```

### 常见错误码

| 错误码 | 说明 |
|--------|------|
| `VALIDATION_ERROR` | 参数验证失败 |
| `IDEMPOTENCY_KEY_REQUIRED` | 需要幂等性键 |
| `HIGH_RISK_CONFIRMATION_REQUIRED` | 需要高风险确认 |
| `RESOURCE_NOT_FOUND` | 资源不存在 |
| `PERMISSION_DENIED` | 权限不足 |
| `DUPLICATE_ENTRY` | 重复记录 |

---

## 维修日志管理

### 获取维修日志列表

获取分页的维修日志列表。

**端点：** `GET /maintenance/logs`

**参数：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| page | integer | 否 | 页码，默认1 |
| pageSize | integer | 否 | 每页数量，默认20 |
| asset_code | string | 否 | 资产编号（模糊搜索） |
| maintenance_type | string | 否 | 维修类型 |
| status | string | 否 | 状态 |
| start_date | string | 否 | 开始日期（YYYY-MM-DD） |
| end_date | string | 否 | 结束日期（YYYY-MM-DD） |
| keyword | string | 否 | 关键词 |

**请求示例：**
```bash
curl -X GET "http://localhost:5183/api/maintenance/logs?page=1&pageSize=10&maintenance_type=故障维修" \
  -H "Authorization: Bearer <token>"
```

**响应示例：**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "asset_code": "000000555",
      "asset_name": "心电图机",
      "maintenance_type": "故障维修",
      "maintenance_date": "2026-05-01",
      "maintenance_person": "张三",
      "maintenance_content": "设备检修",
      "maintenance_cost": 500.00,
      "status": "已完成"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 10,
    "total": 100,
    "totalPages": 10
  }
}
```

### 创建维修日志

创建新的维修日志记录。

**端点：** `POST /maintenance/logs`

**请求体：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| asset_code | string | 是 | 资产编号 |
| maintenance_type | string | 是 | 维修类型 |
| maintenance_date | string | 是 | 维修日期（YYYY-MM-DD） |
| maintenance_person | string | 是 | 维修人员 |
| maintenance_content | string | 是 | 维修内容 |
| maintenance_cost | number | 否 | 维修成本 |
| maintenance_duration | number | 否 | 维修时长（小时） |
| parts_replaced | string | 否 | 更换部件 |
| remark | string | 否 | 备注 |

**请求示例：**
```bash
curl -X POST "http://localhost:5183/api/maintenance/logs" \
  -H "Authorization: Bearer <token>" \
  -H "Idempotency-Key: $(uuidgen)" \
  -H "Content-Type: application/json" \
  -d '{
    "asset_code": "000000555",
    "maintenance_type": "故障维修",
    "maintenance_date": "2026-05-01",
    "maintenance_person": "张三",
    "maintenance_content": "设备检修",
    "maintenance_cost": 500.00
  }'
```

**响应示例：**
```json
{
  "success": true,
  "data": {
    "id": 123,
    "asset_code": "000000555",
    "maintenance_type": "故障维修"
  }
}
```

### 获取维修日志详情

根据ID获取单条维修日志的详细信息。

**端点：** `GET /maintenance/logs/{id}`

**路径参数：**
- `id` (integer, 必填): 维修日志ID

**请求示例：**
```bash
curl -X GET "http://localhost:5183/api/maintenance/logs/123" \
  -H "Authorization: Bearer <token>"
```

### 更新维修日志

更新已有的维修日志信息。

**端点：** `PUT /maintenance/logs/{id}`

**路径参数：**
- `id` (integer, 必填): 维修日志ID

**请求体：** 支持部分字段更新

**请求示例：**
```bash
curl -X PUT "http://localhost:5183/api/maintenance/logs/123" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "maintenance_content": "更新后的维修内容",
    "maintenance_cost": 600.00
  }'
```

### 删除维修日志

删除指定的维修日志（仅允许删除未完成的日志）。

**端点：** `DELETE /maintenance/logs/{id}`

**路径参数：**
- `id` (integer, 必填): 维修日志ID

**请求示例：**
```bash
curl -X DELETE "http://localhost:5183/api/maintenance/logs/123" \
  -H "Authorization: Bearer <token>"
```

### 获取维修日志附件

**端点：** `GET /maintenance/logs/{id}/attachments`

**请求示例：**
```bash
curl -X GET "http://localhost:5183/api/maintenance/logs/123/attachments" \
  -H "Authorization: Bearer <token>"
```

### 上传维修日志附件

**端点：** `POST /maintenance/logs/{id}/attachments`

**请求体：** `multipart/form-data`
- `file`: 附件文件
- `originalFileName`: 原始文件名（URL编码）

**支持的文件类型：**
- 图片：JPG, PNG, GIF, WebP, BMP
- 文档：PDF, DOC, DOCX, XLS, XLSX, TXT
- 文件大小限制：50MB
- 文件数量限制：10个

### 下载维修日志附件

**端点：** `GET /maintenance/logs/{logId}/attachments/{attachmentId}/download`

### 获取维修统计

**端点：** `GET /maintenance/statistics`

**参数：**
- `start_date`: 开始日期
- `end_date`: 结束日期
- `department`: 部门筛选

**响应示例：**
```json
{
  "success": true,
  "data": {
    "total_count": 150,
    "total_cost": 50000.00,
    "fault_repair_count": 80,
    "preventive_count": 50,
    "avg_cost": 333.33
  }
}
```

---

## 预防性维护

### 获取预防性维护计划列表

**端点：** `GET /maintenance/plans`

**参数：**
- `page`, `pageSize`: 分页参数
- `asset_code`: 资产编号
- `status`: 计划状态（active/paused/completed/cancelled）
- `keyword`: 关键词

### 创建预防性维护计划

**端点：** `POST /maintenance/plans`

**请求体：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| asset_code | string | 是 | 资产编号 |
| plan_name | string | 是 | 计划名称 |
| maintenance_type | string | 是 | 维护类型 |
| cycle_type | string | 是 | 周期类型 |
| cycle_value | integer | 是 | 周期值 |
| next_maintenance_date | string | 否 | 下次维护日期 |
| maintenance_content | string | 否 | 维护内容 |
| responsible_person | string | 否 | 负责人 |
| status | string | 否 | 计划状态 |
| remark | string | 否 | 备注 |

**周期类型枚举：**
- `按天` - 每天
- `按周` - 每周
- `按月` - 每月
- `按季度` - 每季度
- `按年` - 每年

### 完成预防性维护计划

执行完成预防性维护计划，系统会自动创建维修日志并更新下次维护日期。

**端点：** `POST /maintenance/plans/{id}/complete`

**请求体：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| maintenance_date | string | 否 | 维护日期 |
| maintenance_person | string | 否 | 维护人员 |
| maintenance_content | string | 否 | 维护内容 |
| maintenance_cost | number | 否 | 维护成本 |
| parts_replaced | string | 否 | 更换部件 |
| actual_hours | number | 否 | 实际工时 |
| maintenance_result | string | 否 | 维护结果 |
| remark | string | 否 | 备注 |

**响应示例：**
```json
{
  "success": true,
  "data": {
    "plan": {...},
    "log": {...},
    "next_maintenance_date": "2026-06-01"
  }
}
```

### 获取预防性维护计划历史

**端点：** `GET /maintenance/plans/{id}/history`

**响应示例：**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "completed_date": "2026-05-01",
      "maintenance_person": "张三",
      "maintenance_content": "季度保养",
      "maintenance_cost": 200.00
    }
  ]
}
```

### 删除预防性维护计划

**端点：** `DELETE /maintenance/plans/{id}`

---

## 故障维修申请

### 获取故障维修申请列表

**端点：** `GET /maintenance/requests`

**参数：**
- `page`, `pageSize`: 分页参数
- `asset_code`: 资产编号
- `status`: 申请状态
- `fault_level`: 故障等级
- `start_date`, `end_date`: 日期范围
- `keyword`: 关键词

**状态枚举：**
- `pending` - 待审批
- `approved` - 已批准
- `rejected` - 已拒绝
- `in_progress` - 维修中
- `completed` - 已完成
- `cancelled` - 已取消

### 创建故障维修申请

**端点：** `POST /maintenance/requests`

**请求体：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| asset_code | string | 是 | 资产编号 |
| fault_description | string | 是 | 故障描述 |
| fault_level | string | 否 | 故障等级 |
| request_date | string | 否 | 申请日期 |
| request_department | string | 否 | 报修部门 |
| contact_phone | string | 否 | 联系电话 |
| expected_repair_date | string | 否 | 期望维修日期 |
| remark | string | 否 | 备注 |

**故障等级枚举：**
- `紧急`
- `一般`
- `轻微`

### 审批故障维修申请

**端点：** `POST /maintenance/requests/{id}/approve`

**请求体：**
```json
{
  "approved": true,
  "comment": "审批意见"
}
```

### 开始执行维修

**端点：** `POST /maintenance/requests/{id}/start`

**请求体：**
```json
{
  "repair_person": "维修人员",
  "repair_start_date": "2026-05-01"
}
```

### 完成维修

完成维修后系统会自动沉淀维修日志。

**端点：** `POST /maintenance/requests/{id}/complete`

**请求体：**
```json
{
  "repair_end_date": "2026-05-01",
  "repair_cost": 800.00,
  "repair_content": "更换电源模块",
  "parts_replaced": "电源模块A",
  "remark": "故障已排除"
}
```

### 取消故障维修申请

**端点：** `POST /maintenance/requests/{id}/cancel`

---

## 维修工单管理

### 获取维修工单列表

**端点：** `GET /maintenance/workorders`

**参数：**
- `page`, `pageSize`: 分页参数
- `asset_code`: 资产编号
- `status`: 工单状态
- `priority`: 优先级（1-5）
- `assigned_to`: 负责人
- `keyword`: 关键词

**状态枚举：**
- `pending` - 待分配
- `assigned` - 已分配
- `in_progress` - 进行中
- `completed` - 已完成
- `closed` - 已关闭
- `cancelled` - 已取消

**优先级说明：**
- 1 - 最高优先级
- 2 - 高优先级
- 3 - 中优先级
- 4 - 低优先级
- 5 - 最低优先级

### 创建维修工单

**端点：** `POST /maintenance/workorders`

**请求体：**
```json
{
  "asset_code": "000000555",
  "title": "设备年度检修",
  "description": "进行全面检查",
  "priority": 2,
  "planned_start_date": "2026-05-01",
  "planned_end_date": "2026-05-03",
  "estimated_hours": 16.0,
  "assigned_to": "工程师A",
  "materials": [
    {"name": "润滑油", "quantity": 2, "unit_price": 50}
  ],
  "remark": "备注"
}
```

### 工单状态操作

**分配工单：** `POST /maintenance/workorders/{id}/assign`
```json
{"assigned_to": "工程师B"}
```

**开始工单：** `POST /maintenance/workorders/{id}/start`

**完成工单：** `POST /maintenance/workorders/{id}/complete`
```json
{
  "work_content": "已完成全部检修",
  "actual_hours": 15.5,
  "labor_cost": 1000.00,
  "materials": [...]
}
```

**关闭工单：** `POST /maintenance/workorders/{id}/close`

**取消工单：** `POST /maintenance/workorders/{id}/cancel`
```json
{"cancel_reason": "取消原因"}
```

---

## 维修模板

### 获取维修模板列表

**端点：** `GET /maintenance/templates`

### 获取推荐模板（按资产类型）

**端点：** `GET /maintenance/templates/recommend`

**参数：**
- `asset_type` (必填): 资产类型
- `brand`: 品牌
- `model`: 型号

### 根据资产编号获取推荐模板

**端点：** `GET /maintenance/templates/recommend-by-asset`

**参数：**
- `asset_code` (必填): 资产编号

**响应示例：**
```json
{
  "success": true,
  "asset_info": {
    "asset_type": "医疗设备",
    "brand": "GE",
    "model": "CT-001"
  },
  "data": [
    {
      "id": 1,
      "name": "CT设备标准保养模板",
      "content": "...",
      "check_items": ["电源检查", "球管预热", "图像校正"]
    }
  ]
}
```

### 创建维修模板

**端点：** `POST /maintenance/templates`

---

## 维护提醒

### 获取维护提醒列表

**端点：** `GET /maintenance/reminders`

**参数：**
- `page`, `pageSize`: 分页参数
- `status`: 提醒状态（pending/sent/expired）

### 发送维护提醒

**端点：** `POST /maintenance/reminders/send`

**请求体：**
```json
{
  "plan_id": 1,
  "reminder_type": "email",
  "recipient": "engineer@example.com"
}
```

**提醒类型枚举：**
- `email` - 邮件
- `sms` - 短信
- `system` - 系统通知

### 配置提醒规则

**端点：** `POST /maintenance/reminders/config`

**请求体：**
```json
{
  "plan_id": 1,
  "reminder_days": 7,
  "reminder_types": ["email", "sms"],
  "recipient": "engineer@example.com"
}
```

### 检查维护提醒

检查近期即将到期的维护计划并生成提醒。

**端点：** `GET /maintenance/reminders/check`

**响应示例：**
```json
{
  "success": true,
  "data": {
    "pending_reminders": [...],
    "overdue_plans": [...]
  }
}
```

---

## 资产使用量追踪

### 获取使用量记录列表

**端点：** `GET /maintenance/usage/records`

**参数：**
- `page`, `pageSize`: 分页参数
- `asset_code`: 资产编号
- `usage_type`: 使用量类型

### 记录使用量

**端点：** `POST /maintenance/usage/records`

**请求体：**
```json
{
  "asset_code": "000000555",
  "usage_date": "2026-05-01",
  "usage_value": 150.5,
  "usage_type": "运行时长",
  "cumulative_value": 5000.0,
  "operator": "操作员A",
  "remark": "备注"
}
```

### 获取使用量触发的维护记录

**端点：** `GET /maintenance/usage/triggered`

**状态枚举：** pending/processing/processed

### 处理使用量触发记录

**端点：** `POST /maintenance/usage/triggered/{id}/process`

**请求体：**
```json
{
  "work_order_id": 123
}
```

---

## 维修成本统计

### 获取维修成本统计

**端点：** `GET /maintenance/costs`

**参数：**
- `start_date`, `end_date`: 日期范围
- `department`: 部门

**响应示例：**
```json
{
  "success": true,
  "data": {
    "total_cost": 50000.00,
    "labor_cost": 20000.00,
    "material_cost": 25000.00,
    "outsourcing_cost": 5000.00,
    "by_department": [...],
    "by_asset_type": [...],
    "trend": [...]
  }
}
```

---

## 维修效率分析

### 获取维修效率概览

**端点：** `GET /maintenance/efficiency/overview`

**响应示例：**
```json
{
  "success": true,
  "data": {
    "total_requests": 150,
    "completed_requests": 140,
    "pending_requests": 10,
    "avg_completion_time": 24.5,
    "first_response_rate": 95.5,
    "satisfaction_score": 4.8
  }
}
```

### 获取响应时间统计

**端点：** `GET /maintenance/efficiency/response-time`

### 获取技术人员统计

**端点：** `GET /maintenance/efficiency/technician`

### 获取资产维护频率分析

**端点：** `GET /maintenance/efficiency/asset-frequency`

### 获取分析相关接口

- `GET /maintenance/analysis/asset-history` - 资产维护历史分析
- `GET /maintenance/analysis/effectiveness-stats` - 维护效果统计
- `GET /maintenance/analysis/cost-trend` - 成本趋势分析
- `GET /maintenance/analysis/technician-performance` - 技术人员绩效
- `GET /maintenance/analysis/type-distribution` - 类型分布
- `GET /maintenance/analysis/frequency` - 维护频率分析
- `GET /asset-types/secondary` - 二级资产类型

---

## AI维修助手

### 初始化AI对话

**端点：** `POST /maintenance/ai/init`

**请求体：**
```json
{
  "type": "maintenance",
  "userId": "user123"
}
```

**响应示例：**
```json
{
  "success": true,
  "conversationId": "uuid-xxx",
  "message": "您好，我是维修助手",
  "pendingRequests": {
    "repairs": [...],
    "transfers": [...]
  }
}
```

### 发送AI消息

**端点：** `POST /maintenance/ai/message`

**请求体：**
```json
{
  "conversationId": "uuid-xxx",
  "message": "设备故障",
  "context": {},
  "history": []
}
```

**响应示例：**
```json
{
  "success": true,
  "response": "已理解您的故障描述",
  "intent": "repair_request",
  "maintenanceForm": {
    "asset_code": "000000555",
    "fault_description": "设备故障"
  },
  "assetLookup": {...}
}
```

### 获取AI待处理请求

**端点：** `GET /maintenance/ai/pending`

### 提交AI生成的维修申请

**端点：** `POST /maintenance/ai/submit-request`

---

## 通用响应格式

### 成功响应

```json
{
  "success": true,
  "data": {...}
}
```

### 分页响应

```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

### 错误响应

```json
{
  "success": false,
  "message": "错误信息",
  "code": "ERROR_CODE"
}
```

---

## 使用示例

### 使用Python requests

```python
import requests

BASE_URL = "http://localhost:5183/api"
TOKEN = "your-jwt-token"

headers = {
    "Authorization": f"Bearer {TOKEN}",
    "Content-Type": "application/json"
}

# 获取维修日志
response = requests.get(
    f"{BASE_URL}/maintenance/logs",
    headers=headers,
    params={"page": 1, "pageSize": 10}
)

# 创建维修日志（带幂等性）
import uuid
response = requests.post(
    f"{BASE_URL}/maintenance/logs",
    headers={
        **headers,
        "Idempotency-Key": str(uuid.uuid4())
    },
    json={
        "asset_code": "000000555",
        "maintenance_type": "故障维修",
        "maintenance_date": "2026-05-01",
        "maintenance_person": "张三",
        "maintenance_content": "设备检修"
    }
)

# 处理高风险确认
if response.status_code == 428:
    result = response.json()
    confirm_token = result["confirmToken"]
    headers["X-Risk-Confirm-Token"] = confirm_token
    response = requests.post(
        f"{BASE_URL}/maintenance/logs",
        headers=headers,
        json={...}
    )
```

### 使用curl

```bash
# 获取列表
curl -X GET "http://localhost:5183/api/maintenance/logs?page=1&pageSize=10" \
  -H "Authorization: Bearer <token>"

# 创建记录
curl -X POST "http://localhost:5183/api/maintenance/logs" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{"asset_code":"000000555","maintenance_type":"故障维修","maintenance_date":"2026-05-01","maintenance_person":"张三","maintenance_content":"设备检修"}'
```

---

## 联系方式

**技术支持：** support@assethub.com
**文档版本：** v1.0.0
**最后更新：** 2026-05-01
