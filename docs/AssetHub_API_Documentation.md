# AssetHub 资产管理系统 API 完整文档

## 文档说明

本文档整理了 AssetHub 资产管理系统所有后台 API 接口，包含完整的接口地址、HTTP 方法、功能说明、请求参数和响应格式。

## 一、认证与用户管理

### 1.1 用户认证

#### POST /api/auth/login
**功能说明：** 用户登录验证

**请求参数：**
```json
{
  "tenant_code": "企业编码",
  "username": "用户名",
  "password": "密码"
}
```

**响应示例：**
```json
{
  "success": true,
  "data": {
    "token": "jwt_token",
    "user": {
      "id": 1,
      "username": "admin",
      "real_name": "管理员",
      "role": "system_admin",
      "tenant_id": 1
    }
  }
}
```

#### POST /api/auth/logout
**功能说明：** 用户登出

#### GET /api/auth/me
**功能说明：** 获取当前登录用户信息

**响应示例：**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "username": "admin",
    "real_name": "管理员",
    "role": "system_admin",
    "tenant_id": 1,
    "tenant_name": "测试企业",
    "managed_departments": ["*"]
  }
}
```

---

### 1.2 用户管理

#### GET /api/users
**功能说明：** 获取用户列表

**查询参数：**
| 参数名 | 类型 | 说明 |
|--------|------|------|
| page | int | 页码，默认1 |
| pageSize | int | 每页数量，默认20 |
| keyword | string | 关键词搜索 |
| role | string | 角色筛选 |

**响应示例：**
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

#### GET /api/users/:id
**功能说明：** 获取单个用户详情

#### POST /api/users
**功能说明：** 创建新用户

**请求参数：**
```json
{
  "username": "用户名",
  "password": "密码",
  "real_name": "真实姓名",
  "email": "邮箱",
  "phone": "电话",
  "role": "system_admin|asset_admin|user",
  "department_id": 1,
  "managed_departments": ["D001", "D002"]
}
```

#### PUT /api/users/:id
**功能说明：** 更新用户信息

#### DELETE /api/users/:id
**功能说明：** 删除用户

---

### 1.3 部门管理

#### GET /api/departments
**功能说明：** 获取部门列表

**查询参数：**
| 参数名 | 类型 | 说明 |
|--------|------|------|
| page | int | 页码 |
| pageSize | int | 每页数量 |
| keyword | string | 关键词搜索 |
| status | string | 状态筛选 |

**响应示例：**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "department_code": "D001",
      "department_name": "研发部",
      "parent_id": null,
      "manager": "张三",
      "status": "active"
    }
  ],
  "pagination": {...}
}
```

#### GET /api/departments/:id
**功能说明：** 获取单个部门详情

#### POST /api/departments
**功能说明：** 创建部门

**请求参数：**
```json
{
  "department_code": "部门编码",
  "department_name": "部门名称",
  "parent_id": null,
  "manager": "负责人",
  "contact": "联系方式",
  "remark": "备注"
}
```

#### PUT /api/departments/:id
**功能说明：** 更新部门信息

#### DELETE /api/departments/:id
**功能说明：** 删除部门

#### GET /api/departments/tree
**功能说明：** 获取部门树形结构

---

## 二、权限管理

### 2.1 角色管理

#### GET /api/roles
**功能说明：** 获取角色列表

#### POST /api/roles
**功能说明：** 创建角色

**请求参数：**
```json
{
  "role_name": "角色名称",
  "role_code": "角色编码",
  "description": "角色描述",
  "permissions": ["asset.create", "asset.read", "asset.update"]
}
```

#### PUT /api/roles/:id
**功能说明：** 更新角色

#### DELETE /api/roles/:id
**功能说明：** 删除角色

### 2.2 权限配置

#### GET /api/permissions
**功能说明：** 获取所有权限列表

#### POST /api/roles/:id/permissions
**功能说明：** 分配角色权限

**请求参数：**
```json
{
  "permissions": ["asset.create", "asset.read", "asset.update", "asset.delete"]
}
```

---

## 三、租户管理

### 3.1 企业管理

#### GET /api/tenants
**功能说明：** 获取租户列表（仅系统管理员）

**查询参数：**
| 参数名 | 类型 | 说明 |
|--------|------|------|
| page | int | 页码 |
| pageSize | int | 每页数量 |
| keyword | string | 关键词搜索 |
| status | string | 状态筛选 |

#### GET /api/tenants/:id
**功能说明：** 获取单个租户详情

**响应示例：**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "tenant_code": "TEST001",
    "tenant_name": "测试企业",
    "contact_person": "张三",
    "contact_phone": "13800138000",
    "status": "active",
    "max_users": 100,
    "max_assets": 10000,
    "statistics": {
      "user_count": 25,
      "asset_count": 500
    }
  }
}
```

#### POST /api/tenants
**功能说明：** 创建租户（仅超级管理员）

**请求参数：**
```json
{
  "tenant_code": "企业编码",
  "tenant_name": "企业名称",
  "contact_person": "联系人",
  "contact_phone": "联系电话",
  "contact_email": "邮箱",
  "address": "地址",
  "license_no": "营业执照号",
  "max_users": 100,
  "max_assets": 10000,
  "subscription_type": "free|standard|professional"
}
```

#### PUT /api/tenants/:id
**功能说明：** 更新租户信息

#### DELETE /api/tenants/:id
**功能说明：** 删除/停用租户

#### POST /api/tenants/verify
**功能说明：** 验证企业编码（登录第一步）

**请求参数：**
```json
{
  "tenant_code": "企业编码"
}
```

#### GET /api/tenants/current/info
**功能说明：** 获取当前用户所属租户信息

---

## 四、资产管理

### 4.1 资产查询

#### GET /api/assets
**功能说明：** 获取资产列表

**查询参数：**
| 参数名 | 类型 | 说明 |
|--------|------|------|
| page | int | 页码 |
| pageSize | int | 每页数量 |
| keyword | string | 关键词搜索 |
| category | string | 资产分类 |
| status | string | 资产状态（在用/闲置/维修/报废/调配中） |
| department | string | 所属部门 |
| start_date | date | 购置日期开始 |
| end_date | date | 购置日期结束 |

**响应示例：**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "asset_code": "ZC20240001",
      "asset_name": "办公电脑",
      "category": "电子设备",
      "brand": "联想",
      "model": "ThinkPad X1",
      "status": "在用",
      "purchase_price": 8000.00,
      "current_value": 6000.00,
      "department": "研发部",
      "location": "A栋101",
      "responsible_person": "张三",
      "purchase_date": "2024-01-15",
      "warranty_end_date": "2026-01-15"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 500,
    "totalPages": 25
  }
}
```

#### GET /api/assets/:asset_code
**功能说明：** 获取单个资产详情

**路径参数：** asset_code - 资产编码

**响应示例：**
```json
{
  "success": true,
  "data": {
    "asset_code": "ZC20240001",
    "asset_name": "办公电脑",
    "category": "电子设备",
    "category_id": 1,
    "brand": "联想",
    "model": "ThinkPad X1",
    "serial_number": "SN123456",
    "status": "在用",
    "purchase_price": 8000.00,
    "current_value": 6000.00,
    "purchase_date": "2024-01-15",
    "department": "研发部",
    "department_new": "研发部",
    "location": "A栋101",
    "responsible_person": "张三",
    "warranty_end_date": "2026-01-15",
    "depreciation_method": "直线法",
    "depreciation_years": 5,
    "remark": "",
    "created_at": "2024-01-15 10:00:00",
    "updated_at": "2024-01-15 10:00:00"
  }
}
```

#### POST /api/assets/search/advanced
**功能说明：** 高级资产搜索

**请求参数：**
```json
{
  "keyword": "关键词",
  "filters": [
    {"field": "status", "operator": "eq", "value": "在用"},
    {"field": "purchase_price", "operator": "gte", "value": 5000}
  ],
  "sort": {"field": "purchase_date", "order": "desc"},
  "page": 1,
  "pageSize": 20
}
```

#### GET /api/assets/by-barcode/:barcode
**功能说明：** 通过条码获取资产信息

---

### 4.2 资产变更

#### POST /api/assets
**功能说明：** 创建新资产

**请求参数：**
```json
{
  "asset_code": "ZC20240001",
  "asset_name": "资产名称",
  "category": "资产分类",
  "category_id": 1,
  "brand": "品牌",
  "model": "型号",
  "serial_number": "序列号",
  "specification": "规格",
  "purchase_price": 10000.00,
  "purchase_date": "2024-01-15",
  "department": "部门名称",
  "location": "存放位置",
  "responsible_person": "责任人",
  "warranty_end_date": "2026-01-15",
  "depreciation_method": "直线法",
  "depreciation_years": 5,
  "remark": "备注"
}
```

#### PUT /api/assets/:asset_code
**功能说明：** 更新资产信息

#### DELETE /api/assets/:asset_code
**功能说明：** 删除资产

#### POST /api/assets/:asset_code/status
**功能说明：** 更新资产状态

**请求参数：**
```json
{
  "status": "在用|闲置|维修|报废|调配中"
}
```

#### PUT /api/assets/:asset_code/fields
**功能说明：** 批量更新资产字段

**请求参数：**
```json
{
  "fields": {
    "location": "新位置",
    "responsible_person": "新责任人",
    "remark": "备注信息"
  }
}
```

---

### 4.3 资产分类

#### GET /api/assets/categories
**功能说明：** 获取资产分类列表

**响应示例：**
```json
{
  "success": true,
  "data": [
    {"id": 1, "name": "电子设备", "code": "ELEC", "count": 100},
    {"id": 2, "name": "办公家具", "code": "FURN", "count": 50}
  ]
}
```

#### POST /api/assets/categories
**功能说明：** 创建资产分类

**请求参数：**
```json
{
  "name": "分类名称",
  "code": "分类编码",
  "description": "分类描述",
  "parent_id": null
}
```

#### PUT /api/assets/categories/:id
**功能说明：** 更新资产分类

#### DELETE /api/assets/categories/:id
**功能说明：** 删除资产分类

---

### 4.4 资产导入导出

#### POST /api/assets/import
**功能说明：** 批量导入资产

**请求格式：** multipart/form-data

**表单字段：**
| 字段名 | 类型 | 说明 |
|--------|------|------|
| file | file | Excel文件 |
| category_id | int | 资产分类ID |
| department | string | 默认部门 |
| import_mode | string | skip（跳过）/update（更新） |

#### GET /api/assets/export
**功能说明：** 导出资产数据

**查询参数：**
| 参数名 | 类型 | 说明 |
|--------|------|------|
| format | string | xlsx/csv |
| fields | string | 导出字段，逗号分隔 |
| filters | json | 筛选条件 |

#### GET /api/assets/export/template
**功能说明：** 下载导入模板

---

### 4.5 资产统计

#### GET /api/assets/statistics/overview
**功能说明：** 获取资产概览统计

**响应示例：**
```json
{
  "success": true,
  "data": {
    "overview": {
      "total_count": 1000,
      "total_value": 5000000.00,
      "in_use_count": 800,
      "idle_count": 100,
      "repair_count": 50,
      "scrap_count": 30,
      "transfer_count": 20
    },
    "departmentsCount": 10,
    "byType": [...],
    "monthly_trend": [...]
  }
}
```

#### GET /api/assets/statistics/by-department
**功能说明：** 按部门统计资产

#### GET /api/assets/statistics/depreciation
**功能说明：** 资产折旧统计

#### GET /api/assets/statistics/expiring-warranties
**功能说明：** 即将到期保修统计

**查询参数：**
| 参数名 | 类型 | 说明 |
|--------|------|------|
| days | int | 提前预警天数，默认30 |

---

### 4.6 资产调拨

#### GET /api/assets/transfers
**功能说明：** 获取资产调拨记录列表

**查询参数：**
| 参数名 | 类型 | 说明 |
|--------|------|------|
| page | int | 页码 |
| pageSize | int | 每页数量 |
| status | string | 状态筛选 |

#### GET /api/assets/transfers/:id
**功能说明：** 获取调拨记录详情

#### POST /api/assets/transfers
**功能说明：** 创建资产调拨申请

**请求参数：**
```json
{
  "asset_code": "资产编码",
  "from_department": "调出部门",
  "to_department": "调入部门",
  "from_location": "调出位置",
  "to_location": "调入位置",
  "transfer_date": "2024-01-20",
  "reason": "调拨原因",
  "remark": "备注"
}
```

#### PUT /api/assets/transfers/:id/approve
**功能说明：** 审批调拨申请

**请求参数：**
```json
{
  "status": "approved|rejected",
  "approve_date": "2024-01-21",
  "comment": "审批意见"
}
```

#### PUT /api/assets/transfers/:id/complete
**功能说明：** 完成调拨执行

**请求参数：**
```json
{
  "to_department": "调入部门",
  "to_location": "调入位置",
  "to_person": "接收人"
}
```

---

## 五、盘点管理

### 5.1 盘点记录

#### GET /api/inventory
**功能说明：** 获取盘点记录列表

**查询参数：**
| 参数名 | 类型 | 说明 |
|--------|------|------|
| page | int | 页码 |
| pageSize | int | 每页数量 |
| status | string | 状态（进行中/已完成/已取消） |

**响应示例：**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "inventory_no": "PD202401001",
      "inventory_date": "2024-01-15",
      "inventory_type": "全面盘点",
      "inventory_person": "张三",
      "status": "进行中",
      "self_check_enabled": true,
      "self_check_start": "2024-01-16",
      "self_check_end": "2024-01-31"
    }
  ],
  "pagination": {...}
}
```

#### GET /api/inventory/:id
**功能说明：** 获取盘点记录详情（包含明细）

#### POST /api/inventory
**功能说明：** 创建盘点记录

**请求参数：**
```json
{
  "inventory_no": "PD202401001",
  "inventory_date": "2024-01-15",
  "inventory_type": "全面盘点|抽查盘点|专项盘点",
  "inventory_person": "盘点人",
  "remark": "备注",
  "self_check_enabled": true,
  "self_check_start": "2024-01-16",
  "self_check_end": "2024-01-31",
  "self_check_scope": "all|department|mine"
}
```

#### PUT /api/inventory/:id
**功能说明：** 更新盘点记录

#### DELETE /api/inventory/:id
**功能说明：** 删除盘点记录

#### PUT /api/inventory/:id/status
**功能说明：** 更新盘点状态

**请求参数：**
```json
{
  "status": "进行中|已完成|已取消"
}
```

#### POST /api/inventory/:id/complete
**功能说明：** 完成盘点

---

### 5.2 盘点明细

#### POST /api/inventory/:id/details
**功能说明：** 添加盘点明细

**请求参数：**
```json
{
  "asset_id": "资产编码",
  "expected_location": "期望位置",
  "actual_location": "实际位置",
  "expected_status": "期望状态",
  "actual_status": "实际状态",
  "discrepancy_type": "正常|位置不符|状态不符",
  "discrepancy_desc": "差异说明"
}
```

#### POST /api/inventory/:id/details/batch
**功能说明：** 批量添加盘点明细

**请求参数：**
```json
{
  "details": [
    {"asset_id": "ZC001", "expected_location": "A栋101"},
    {"asset_id": "ZC002", "expected_location": "A栋102"}
  ]
}
```

#### PUT /api/inventory/:id/details/:detailId
**功能说明：** 更新盘点明细

#### DELETE /api/inventory/:id/details/:detailId
**功能说明：** 删除盘点明细

#### GET /api/inventory/:id/statistics
**功能说明：** 获取盘点统计信息

**响应示例：**
```json
{
  "success": true,
  "data": {
    "total": 100,
    "normalCount": 80,
    "abnormalCount": 20,
    "typeStats": {
      "正常": 80,
      "位置不符": 15,
      "状态不符": 5
    }
  }
}
```

---

### 5.3 自助盘点

#### GET /api/inventory/self/windows
**功能说明：** 获取当前可用的自助盘点窗口

#### GET /api/inventory/self/assets
**功能说明：** 获取我的盘点资产

**查询参数：**
| 参数名 | 类型 | 说明 |
|--------|------|------|
| inventory_id | int | 盘点记录ID |

#### POST /api/inventory/self/confirm
**功能说明：** 提交自助盘点确认

**请求参数：**
```json
{
  "inventory_id": 1,
  "asset_code": "ZC20240001",
  "actual_location": "实际位置",
  "actual_status": "实际状态",
  "discrepancy_type": "正常|位置不符|状态不符",
  "discrepancy_desc": "差异说明"
}
```

---

### 5.4 扫码盘点

#### POST /api/inventory/:id/scan
**功能说明：** 移动端扫码盘点

**请求参数：**
```json
{
  "asset_code": "ZC20240001",
  "scan_time": "2024-01-20 10:30:00",
  "scan_type": "qr_code",
  "location": "实际位置",
  "status": "实际状态",
  "photo": "照片base64"
}
```

#### GET /api/inventory/:id/scan-logs
**功能说明：** 获取扫描历史

**查询参数：**
| 参数名 | 类型 | 说明 |
|--------|------|------|
| page | int | 页码 |
| pageSize | int | 每页数量 |

---

### 5.5 盘点统计

#### GET /api/inventory/statistics
**功能说明：** 获取盘点统计汇总

**响应示例：**
```json
{
  "success": true,
  "data": {
    "total": 50,
    "in_progress": 10,
    "completed": 35,
    "cancelled": 5
  }
}
```

---

## 六、维护管理

### 6.1 维护计划

#### GET /api/maintenance/plans
**功能说明：** 获取维护计划列表

**查询参数：**
| 参数名 | 类型 | 说明 |
|--------|------|------|
| page | int | 页码 |
| pageSize | int | 每页数量 |
| status | string | 状态筛选 |
| type | string | 计划类型 |

#### GET /api/maintenance/plans/:id
**功能说明：** 获取维护计划详情

#### POST /api/maintenance/plans
**功能说明：** 创建维护计划

**请求参数：**
```json
{
  "plan_name": "计划名称",
  "asset_code": "资产编码",
  "plan_type": "定期维护|预防性维护|故障维修",
  "frequency": "每月|每季度|每年",
  "next_date": "2024-02-01",
  "responsible_person": "负责人",
  "estimated_hours": 2,
  "estimated_cost": 500.00,
  "remark": "备注"
}
```

#### PUT /api/maintenance/plans/:id
**功能说明：** 更新维护计划

#### DELETE /api/maintenance/plans/:id
**功能说明：** 删除维护计划

---

### 6.2 维护工单

#### GET /api/maintenance/workorders
**功能说明：** 获取维护工单列表

**查询参数：**
| 参数名 | 类型 | 说明 |
|--------|------|------|
| page | int | 页码 |
| pageSize | int | 每页数量 |
| status | string | 状态筛选 |
| priority | string | 优先级 |

#### GET /api/maintenance/workorders/:id
**功能说明：** 获取工单详情

#### POST /api/maintenance/workorders
**功能说明：** 创建维护工单

**请求参数：**
```json
{
  "workorder_no": "WO20240001",
  "asset_code": "资产编码",
  "title": "工单标题",
  "description": "工单描述",
  "priority": "low|medium|high|urgent",
  "category": "维修|保养|检验",
  "assigned_to": "指派给",
  "due_date": "截止日期",
  "estimated_cost": 500.00
}
```

#### PUT /api/maintenance/workorders/:id
**功能说明：** 更新工单

#### PUT /api/maintenance/workorders/:id/status
**功能说明：** 更新工单状态

**请求参数：**
```json
{
  "status": "pending|in_progress|completed|cancelled",
  "actual_hours": 2.5,
  "actual_cost": 300.00,
  "solution": "处理方案",
  "remark": "备注"
}
```

---

### 6.3 维护日志

#### GET /api/maintenance/logs
**功能说明：** 获取维护日志列表

**查询参数：**
| 参数名 | 类型 | 说明 |
|--------|------|------|
| page | int | 页码 |
| pageSize | int | 每页数量 |
| asset_code | string | 资产编码 |
| status | string | 状态筛选 |

#### GET /api/maintenance/logs/:id
**功能说明：** 获取维护日志详情

#### POST /api/maintenance/logs
**功能说明：** 创建维护日志

**请求参数：**
```json
{
  "asset_code": "资产编码",
  "maintenance_type": "维修|保养|检验",
  "maintenance_date": "2024-01-15",
  "technician": "维修人员",
  "hours": 2.5,
  "cost": 300.00,
  "description": "维护描述",
  "result": "已解决|未解决",
  "next_date": "下次维护日期",
  "remark": "备注"
}
```

#### PUT /api/maintenance/logs/:id
**功能说明：** 更新维护日志

#### DELETE /api/maintenance/logs/:id
**功能说明：** 删除维护日志

#### GET /api/maintenance/logs/:id/attachments
**功能说明：** 获取维护日志附件列表

#### POST /api/maintenance/logs/:id/attachments
**功能说明：** 上传维护日志附件

**请求格式：** multipart/form-data

**表单字段：**
| 字段名 | 类型 | 说明 |
|--------|------|------|
| file | file | 附件文件 |
| originalFileName | string | 原始文件名 |

#### GET /api/maintenance/logs/:logId/attachments/:attachmentId
**功能说明：** 获取附件

#### GET /api/maintenance/logs/:logId/attachments/:attachmentId/download
**功能说明：** 下载附件

#### DELETE /api/maintenance/logs/:logId/attachments/:attachmentId
**功能说明：** 删除附件

#### GET /api/maintenance/statistics
**功能说明：** 获取维护统计信息

---

### 6.4 维护请求

#### GET /api/maintenance/requests
**功能说明：** 获取维护请求列表

#### POST /api/maintenance/requests
**功能说明：** 创建维护请求

**请求参数：**
```json
{
  "asset_code": "资产编码",
  "request_type": "报修|保养|其他",
  "description": "请求描述",
  "priority": "low|medium|high|urgent",
  "contact_person": "联系人",
  "contact_phone": "联系电话"
}
```

#### PUT /api/maintenance/requests/:id
**功能说明：** 更新维护请求

#### PUT /api/maintenance/requests/:id/process
**功能说明：** 处理维护请求

**请求参数：**
```json
{
  "action": "accept|reject|assign",
  "assigned_to": "指派给",
  "remark": "处理意见"
}
```

---

### 6.5 维护提醒

#### GET /api/maintenance/reminders
**功能说明：** 获取维护提醒列表

#### POST /api/maintenance/reminders
**功能说明：** 创建维护提醒

#### PUT /api/maintenance/reminders/:id
**功能说明：** 更新维护提醒

#### DELETE /api/maintenance/reminders/:id
**功能说明：** 删除维护提醒

---

### 6.6 维护成本

#### GET /api/maintenance/costs
**功能说明：** 获取维护成本统计

**查询参数：**
| 参数名 | 类型 | 说明 |
|--------|------|------|
| start_date | date | 开始日期 |
| end_date | date | 结束日期 |
| type | string | 成本类型 |

#### GET /api/maintenance/costs/by-asset
**功能说明：** 按资产统计维护成本

#### GET /api/maintenance/costs/by-department
**功能说明：** 按部门统计维护成本

---

### 6.7 维护评价

#### GET /api/maintenance/evaluations
**功能说明：** 获取维护评价列表

#### POST /api/maintenance/evaluations
**功能说明：** 创建维护评价

**请求参数：**
```json
{
  "workorder_id": 1,
  "rating": 5,
  "comment": "评价内容",
  "tags": ["及时", "专业"]
}
```

---

## 七、质量控制

### 7.1 计量管理

#### GET /api/quality-control/metrology
**功能说明：** 获取计量记录列表

**查询参数：**
| 参数名 | 类型 | 说明 |
|--------|------|------|
| page | int | 页码 |
| pageSize | int | 每页数量 |
| metrology_type | string | 计量类型 |
| start_date | date | 开始日期 |
| end_date | date | 结束日期 |

#### GET /api/quality-control/metrology/:id
**功能说明：** 获取计量记录详情

#### POST /api/quality-control/metrology
**功能说明：** 创建计量记录

**请求参数：**
```json
{
  "asset_code": "资产编码",
  "metrology_type": "强检|校准|期间核查",
  "metrology_date": "2024-01-15",
  "next_metrology_date": "2025-01-15",
  "metrology_agency": "计量机构",
  "certificate_no": "证书编号",
  "result": "合格|不合格|待检",
  "accuracy_level": "精度等级",
  "measurement_range": "测量范围",
  "cost": 500.00,
  "operator": "操作员",
  "metrology_cycle": 12,
  "warning_days": 30,
  "remark": "备注"
}
```

#### PUT /api/quality-control/metrology/:id
**功能说明：** 更新计量记录

#### DELETE /api/quality-control/metrology/:id
**功能说明：** 删除计量记录

#### GET /api/quality-control/metrology/statistics
**功能说明：** 获取计量统计

#### GET /api/quality-control/metrology/statistics/advanced
**功能说明：** 获取高级计量统计

#### GET /api/quality-control/metrology/expiring
**功能说明：** 获取即将到期计量记录

**查询参数：**
| 参数名 | 类型 | 说明 |
|--------|------|------|
| days | int | 提前预警天数，默认30 |

---

### 7.2 质量控制

#### GET /api/quality-control
**功能说明：** 获取质量控制记录列表

**查询参数：**
| 参数名 | 类型 | 说明 |
|--------|------|------|
| page | int | 页码 |
| pageSize | int | 每页数量 |
| keyword | string | 关键词搜索 |
| qc_type | string | 质控类型 |
| result | string | 检验结果 |
| status | string | 状态 |
| start_date | date | 开始日期 |
| end_date | date | 结束日期 |

#### GET /api/quality-control/:id
**功能说明：** 获取质量控制记录详情

#### POST /api/quality-control
**功能说明：** 创建质量控制记录

**请求参数：**
```json
{
  "asset_code": "资产编码",
  "qc_type": "质检类型",
  "qc_date": "2024-01-15",
  "qc_item": "检验项目",
  "standard_value": "标准值",
  "actual_value": "实际值",
  "tolerance": "允差",
  "result": "合格|不合格",
  "qc_method": "检验方法",
  "qc_person": "检验员",
  "department": "部门",
  "remark": "备注"
}
```

#### PUT /api/quality-control/:id
**功能说明：** 更新质量控制记录

#### DELETE /api/quality-control/:id
**功能说明：** 删除质量控制记录

#### GET /api/quality-control/statistics
**功能说明：** 获取质量控制统计

#### GET /api/quality-control/expiring
**功能说明：** 获取即将到期质控记录

---

### 7.3 资产质量历史

#### GET /api/quality-control/asset/:assetCode/history
**功能说明：** 获取资产质量管理历史

---

### 7.4 报告生成

#### GET /api/quality-control/reports/metrology
**功能说明：** 生成计量质量报告

**查询参数：**
| 参数名 | 类型 | 说明 |
|--------|------|------|
| start_date | date | 开始日期 |
| end_date | date | 结束日期 |
| format | string | json/pdf，默认json |

#### GET /api/quality-control/reports/quality-control
**功能说明：** 生成质量控制报告

#### GET /api/quality-control/reports/comprehensive
**功能说明：** 生成综合质量报告

---

## 八、调配管理

### 8.1 调配记录

#### GET /api/transfer
**功能说明：** 获取调配记录列表

**查询参数：**
| 参数名 | 类型 | 说明 |
|--------|------|------|
| page | int | 页码 |
| pageSize | int | 每页数量 |
| status | string | 状态（待审批/已批准/已完成/已取消） |

**响应示例：**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "transfer_no": "SQ00000001",
      "asset_code": "ZC20240001",
      "asset_name": "办公电脑",
      "from_department": "研发部",
      "to_department": "市场部",
      "transfer_date": "2024-01-15",
      "status": "待审批",
      "applicant": "张三",
      "approved_by": null
    }
  ],
  "pagination": {...}
}
```

#### GET /api/transfer/:id
**功能说明：** 获取调配记录详情

#### POST /api/transfer
**功能说明：** 创建调配记录

**请求参数：**
```json
{
  "transfer_no": "SQ20240001",
  "asset_code": "资产编码",
  "from_department": "调出部门",
  "to_department": "调入部门",
  "from_location": "调出位置",
  "to_location": "调入位置",
  "from_person": "调出责任人",
  "to_person": "调入责任人",
  "transfer_date": "2024-01-20",
  "transfer_reason": "调配原因",
  "remark": "备注"
}
```

#### PUT /api/transfer/:id/approve
**功能说明：** 审批调配申请

**请求参数：**
```json
{
  "status": "已批准|已取消",
  "approve_date": "2024-01-21"
}
```

#### PUT /api/transfer/:id/complete
**功能说明：** 完成调配执行

**请求参数：**
```json
{
  "to_department": "调入部门",
  "to_location": "调入位置",
  "to_person": "调入责任人"
}
```

#### DELETE /api/transfer/:id
**功能说明：** 删除调配记录

---

### 8.2 调配统计

#### GET /api/transfer/statistics
**功能说明：** 获取调配统计汇总

**响应示例：**
```json
{
  "success": true,
  "data": {
    "total": 100,
    "pending": 10,
    "approved": 20,
    "rejected": 5
  }
}
```

---

## 九、报废管理

### 9.1 报废记录

#### GET /api/scrapping
**功能说明：** 获取报废记录列表

**查询参数：**
| 参数名 | 类型 | 说明 |
|--------|------|------|
| page | int | 页码 |
| pageSize | int | 每页数量 |
| status | string | 状态筛选 |
| asset_code | string | 资产编码 |
| start_date | date | 开始日期 |
| end_date | date | 结束日期 |

**响应示例：**
```json
{
  "success": true,
  "data": {
    "records": [
      {
        "id": 1,
        "asset_code": "ZC20240001",
        "asset_name": "办公电脑",
        "department": "研发部",
        "applicant": "张三",
        "apply_date": "2024-01-15",
        "scrapping_reason": "设备老旧",
        "estimated_value": 500.00,
        "current_status": "pending"
      }
    ],
    "pagination": {...}
  }
}
```

#### GET /api/scrapping/:id
**功能说明：** 获取报废记录详情（包含审批、鉴定、处置记录）

#### POST /api/scrapping
**功能说明：** 创建报废申请

**请求参数：**
```json
{
  "asset_code": "资产编码",
  "asset_name": "资产名称",
  "asset_model": "资产型号",
  "department": "所属部门",
  "applicant": "申请人",
  "scrapping_reason": "报废原因",
  "estimated_value": 500.00,
  "remark": "备注"
}
```

#### PUT /api/scrapping/:id
**功能说明：** 更新报废记录

#### DELETE /api/scrapping/:id
**功能说明：** 删除报废记录

---

### 9.2 报废流程

#### POST /api/scrapping/:id/appraise
**功能说明：** 提交鉴定结果

**请求参数：**
```json
{
  "appraiser": "鉴定人",
  "technical_condition": "技术状况",
  "scrapping_necessity": "报废必要性",
  "estimated_value": 500.00,
  "appraisal_result": "建议报废/不建议报废"
}
```

#### POST /api/scrapping/:id/approve
**功能说明：** 提交审批结果

**请求参数：**
```json
{
  "approver": "审批人",
  "approval_status": "approved|rejected",
  "approval_comment": "审批意见",
  "approval_level": 1
}
```

#### POST /api/scrapping/:id/dispose
**功能说明：** 提交处置结果

**请求参数：**
```json
{
  "disposer": "处置人",
  "disposal_method": "变卖|报废|捐赠",
  "disposal_company": "处置公司",
  "actual_value": 300.00,
  "disposal_result": "处置结果",
  "disposal_certificate": "处置凭证"
}
```

#### POST /api/scrapping/:id/complete
**功能说明：** 完成处置

---

### 9.3 报废文件

#### POST /api/scrapping/:id/files
**功能说明：** 上传报废相关文件

**请求格式：** multipart/form-data

**表单字段：**
| 字段名 | 类型 | 说明 |
|--------|------|------|
| file | file | 文件 |
| file_type | string | 文件类型（application/appraisal/approval/disposal） |

---

### 9.4 报废统计

#### GET /api/scrapping/statistics/summary
**功能说明：** 获取报废统计汇总

---

## 十、技术文档

### 10.1 文档管理

#### GET /api/technical-documents
**功能说明：** 获取技术文档列表

**查询参数：**
| 参数名 | 类型 | 说明 |
|--------|------|------|
| page | int | 页码 |
| pageSize | int | 每页数量 |
| keyword | string | 关键词搜索 |
| category | string | 分类 |
| asset_type | string | 资产类型 |
| brand | string | 品牌 |
| asset_code | string | 关联资产编码 |
| status | string | 状态（active/archived/deleted） |
| review_status | string | 审核状态（pending/approved/rejected） |

**响应示例：**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "title": "设备操作手册",
      "description": "设备详细操作说明",
      "file_name": "manual.pdf",
      "file_type": "application/pdf",
      "file_size": 1024000,
      "category": "使用手册",
      "asset_type": "电子设备",
      "brand": "联想",
      "model": "ThinkPad X1",
      "version": "1.0",
      "upload_date": "2024-01-15",
      "uploaded_by": "张三",
      "view_count": 100,
      "download_count": 50,
      "review_status": "approved",
      "file_url": "/api/technical-documents/1/file"
    }
  ],
  "pagination": {...}
}
```

#### GET /api/technical-documents/:id
**功能说明：** 获取文档详情

#### POST /api/technical-documents
**功能说明：** 上传技术文档

**请求格式：** multipart/form-data

**表单字段：**
| 字段名 | 类型 | 说明 |
|--------|------|------|
| file | file | 文档文件（必填） |
| title | string | 文档标题（必填） |
| description | string | 文档描述 |
| category | string | 分类（使用手册/维修手册/技术规范/操作指南/其他） |
| asset_type | string | 资产类型 |
| brand | string | 品牌 |
| model | string | 型号 |
| version | string | 版本号 |
| asset_code | string | 关联单个资产编码 |
| asset_codes[] | array | 关联多个资产编码数组 |
| is_public | boolean | 是否公开 |

#### PUT /api/technical-documents/:id
**功能说明：** 更新文档信息

**请求参数：**
```json
{
  "title": "文档标题",
  "description": "文档描述",
  "category": "使用手册",
  "asset_codes": ["ZC001", "ZC002"]
}
```

#### DELETE /api/technical-documents/:id
**功能说明：** 删除文档（仅管理员）

---

### 10.2 文档下载

#### GET /api/technical-documents/:id/file
**功能说明：** 下载/预览文档

#### GET /api/technical-documents/:id/file/download
**功能说明：** 强制下载文档

---

### 10.3 资产关联

#### GET /api/technical-documents/assets/:assetIdOrCode
**功能说明：** 获取资产关联的文档列表

#### POST /api/technical-documents/assets/:assetIdOrCode/link/:documentId
**功能说明：** 关联文档到资产

#### DELETE /api/technical-documents/assets/:assetIdOrCode/link/:documentId
**功能说明：** 取消文档与资产的关联

---

### 10.4 文档审核

#### GET /api/technical-documents/pending
**功能说明：** 获取待审核文档列表

#### POST /api/technical-documents/:id/review
**功能说明：** 审核文档

**请求参数：**
```json
{
  "review_status": "approved|rejected",
  "review_comment": "审核意见"
}
```

---

### 10.5 分享链接

#### POST /api/technical-documents/:id/share
**功能说明：** 创建外部分享链接

**请求参数：**
```json
{
  "expires_days": 7,
  "max_uploads": 1,
  "remark": "备注",
  "supplier_name": "供应商名称",
  "supplier_contact": "供应商联系方式"
}
```

**响应示例：**
```json
{
  "success": true,
  "data": {
    "share_token": "xxx",
    "share_url": "https://xxx/technical-documents/upload/xxx",
    "expires_at": "2024-01-22",
    "max_uploads": 1
  }
}
```

#### GET /api/technical-documents/:id/shares
**功能说明：** 获取分享链接列表

#### DELETE /api/technical-documents/shares/:shareId
**功能说明：** 删除分享链接

---

### 10.6 外部上传

#### GET /api/technical-documents/upload/:token
**功能说明：** 验证分享令牌（无需认证）

**响应示例：**
```json
{
  "success": true,
  "data": {
    "document_id": 1,
    "document_title": "设备手册",
    "max_uploads": 1,
    "current_uploads": 0,
    "expires_at": "2024-01-22"
  }
}
```

#### POST /api/technical-documents/upload/:token
**功能说明：** 通过分享链接上传文件（无需认证）

**请求格式：** multipart/form-data

**表单字段：**
| 字段名 | 类型 | 说明 |
|--------|------|------|
| file | file | 文件 |
| title | string | 文档标题 |
| description | string | 文档描述 |
| uploader_name | string | 上传人姓名 |
| uploader_company | string | 上传人公司 |

---

### 10.7 文档分类

#### GET /api/technical-documents/categories
**功能说明：** 获取文档分类统计

---

## 十一、仪表盘

### 11.1 仪表盘数据

#### GET /api/dashboard
**功能说明：** 获取仪表盘统计数据

**响应示例：**
```json
{
  "success": true,
  "data": {
    "overview": {
      "total_assets": 1000,
      "total_value": 5000000.00,
      "active_count": 800,
      "idle_count": 100,
      "maintenance_count": 50,
      "scrapped_count": 30,
      "transfer_count": 20
    },
    "alerts": {
      "warranty_expiring": 10,
      "low_value_assets": 5,
      "pending_maintenance": 3,
      "pending_transfers": 2
    },
    "recent_assets": [...],
    "status_distribution": {
      "在用": 800,
      "闲置": 100,
      "维修": 50,
      "报废": 30,
      "调配中": 20
    }
  }
}
```

#### GET /api/dashboard/realtime
**功能说明：** 获取实时统计数据

**响应示例：**
```json
{
  "success": true,
  "data": {
    "total_assets": 1000,
    "today_added": 5,
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

---

## 十二、采购管理

### 12.1 采购申请

#### GET /api/procurement
**功能说明：** 获取采购申请列表

**查询参数：**
| 参数名 | 类型 | 说明 |
|--------|------|------|
| page | int | 页码 |
| pageSize | int | 每页数量 |
| status | string | 状态筛选 |
| keyword | string | 关键词搜索 |

**响应示例：**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "request_no": "CG20240001",
      "title": "采购办公设备",
      "requester": "张三",
      "department": "研发部",
      "total_amount": 50000.00,
      "status": "pending",
      "apply_date": "2024-01-15"
    }
  ]
}
```

#### GET /api/procurement/:id
**功能说明：** 获取采购申请详情

#### POST /api/procurement
**功能说明：** 创建采购申请

**请求参数：**
```json
{
  "title": "采购标题",
  "description": "采购描述",
  "requester": "申请人",
  "department": "申请部门",
  "total_amount": 50000.00,
  "budget_code": "预算编码",
  "expected_date": "2024-02-01",
  "items": [
    {
      "item_name": "物品名称",
      "specification": "规格型号",
      "quantity": 10,
      "unit_price": 5000.00,
      "supplier": "供应商"
    }
  ],
  "remark": "备注"
}
```

#### PUT /api/procurement/:id
**功能说明：** 更新采购申请

#### DELETE /api/procurement/:id
**功能说明：** 删除采购申请

### 12.2 采购审批

#### POST /api/procurement/:id/approve
**功能说明：** 审批采购申请

**请求参数：**
```json
{
  "status": "approved|rejected",
  "comment": "审批意见",
  "approval_level": 1
}
```

#### POST /api/procurement/:id/budget-check
**功能说明：** 预算检查

### 12.3 采购文件

#### POST /api/procurement/:id/files
**功能说明：** 上传采购相关文件

**请求格式：** multipart/form-data

### 12.4 采购统计

#### GET /api/procurement/statistics
**功能说明：** 获取采购统计

---

## 十三、物料管理

### 13.1 物料基础

#### GET /api/materials
**功能说明：** 获取物料列表

**查询参数：**
| 参数名 | 类型 | 说明 |
|--------|------|------|
| page | int | 页码 |
| pageSize | int | 每页数量 |
| category | string | 物料分类 |
| keyword | string | 关键词搜索 |

#### POST /api/materials
**功能说明：** 创建物料

**请求参数：**
```json
{
  "material_code": "物料编码",
  "material_name": "物料名称",
  "category": "分类",
  "specification": "规格",
  "unit": "单位",
  "unit_price": 100.00,
  "min_stock": 10,
  "max_stock": 100,
  "supplier": "供应商",
  "remark": "备注"
}
```

#### PUT /api/materials/:id
**功能说明：** 更新物料

#### DELETE /api/materials/:id
**功能说明：** 删除物料

### 13.2 库存管理

#### GET /api/materials/inventory
**功能说明：** 获取库存列表

**响应示例：**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "material_code": "WL001",
      "material_name": "螺丝",
      "quantity": 1000,
      "unit": "个",
      "warehouse": "仓库A",
      "location": "A-01-01",
      "last_inbound_date": "2024-01-10",
      "last_outbound_date": "2024-01-15"
    }
  ]
}
```

#### GET /api/materials/inventory/:id
**功能说明：** 获取库存详情

#### PUT /api/materials/inventory/:id
**功能说明：** 更新库存

### 13.3 入库管理

#### POST /api/materials/inventory/inbound
**功能说明：** 物料入库

**请求参数：**
```json
{
  "material_code": "物料编码",
  "quantity": 100,
  "warehouse": "仓库",
  "location": "库位",
  "inbound_type": "purchase|return|adjustment",
  "supplier": "供应商",
  "purchase_order_no": "采购单号",
  "operator": "操作员",
  "inbound_date": "2024-01-15",
  "remark": "备注"
}
```

#### GET /api/materials/inventory/inbound-records
**功能说明：** 获取入库记录列表

### 13.4 出库管理

#### POST /api/materials/inventory/outbound
**功能说明：** 物料出库

**请求参数：**
```json
{
  "material_code": "物料编码",
  "quantity": 50,
  "warehouse": "仓库",
  "location": "库位",
  "outbound_type": "production|maintenance|return",
  "purpose": "用途",
  "asset_code": "关联资产编码",
  "operator": "操作员",
  "outbound_date": "2024-01-15",
  "remark": "备注"
}
```

#### GET /api/materials/inventory/outbound-records
**功能说明：** 获取出库记录列表

### 13.5 库存预警

#### GET /api/materials/inventory/warnings
**功能说明：** 获取库存预警列表

**响应示例：**
```json
{
  "success": true,
  "data": {
    "low_stock": [...],
    "overstock": [...],
    "expiring": [...]
  }
}
```

### 13.6 库存事务

#### GET /api/materials/transactions
**功能说明：** 获取库存事务记录

**查询参数：**
| 参数名 | 类型 | 说明 |
|--------|------|------|
| material_code | string | 物料编码 |
| type | string | 事务类型 |
| start_date | date | 开始日期 |
| end_date | date | 结束日期 |

### 13.7 维修物料需求

#### GET /api/materials/maintenance-requirements
**功能说明：** 获取维修物料需求列表

#### POST /api/materials/maintenance-requirements
**功能说明：** 创建维修物料需求

---

## 十四、AI 助手

### 14.1 AI 对话模式

#### GET /api/ai-assistant/modes
**功能说明：** 获取可用的 AI 对话模式

**响应示例：**
```json
{
  "success": true,
  "data": [
    {
      "mode": "sqlbot",
      "name": "SQL 查询助手",
      "description": "通过自然语言生成 SQL 查询"
    },
    {
      "mode": "documents",
      "name": "文档分析助手",
      "description": "分析技术文档内容"
    },
    {
      "mode": "maintenance",
      "name": "维修助手",
      "description": "智能维修故障诊断"
    },
    {
      "mode": "search",
      "name": "智能搜索",
      "description": "语义化资产搜索"
    }
  ]
}
```

### 14.2 AI 查询

#### POST /api/ai-assistant/query
**功能说明：** 发送 AI 查询请求

**请求参数：**
```json
{
  "mode": "sqlbot|documents|maintenance|search",
  "message": "用户消息内容",
  "context": {
    "asset_code": "资产编码",
    "category": "资产分类"
  }
}
```

**响应示例：**
```json
{
  "success": true,
  "data": {
    "response": "AI 回复内容",
    "suggestions": ["建议1", "建议2"],
    "metadata": {}
  }
}
```

#### POST /api/ai-assistant/conversation
**功能说明：** 创建对话会话

#### GET /api/ai-assistant/conversation/:id
**功能说明：** 获取对话历史

### 14.3 资产 AI 分析

#### POST /api/asset-ai-analysis/analyze
**功能说明：** AI 资产分析

**请求参数：**
```json
{
  "asset_code": "资产编码",
  "analysis_type": "value|depreciation|maintenance"
}
```

#### POST /api/asset-ai-analysis/predict
**功能说明：** AI 预测分析

**请求参数：**
```json
{
  "asset_code": "资产编码",
  "prediction_type": "lifespan|maintenance|value"
}
```

### 14.4 技术文档 AI

#### POST /api/technical-documents/ai/analyze
**功能说明：** AI 分析技术文档

#### POST /api/technical-documents/ai/search
**功能说明：** AI 智能搜索文档

#### POST /api/technical-documents/ai/summary
**功能说明：** AI 生成文档摘要

---

## 十五、特种设备管理

### 15.1 特种设备列表

#### GET /api/compliance/special-equipment
**功能说明：** 获取特种设备列表

**查询参数：**
| 参数名 | 类型 | 说明 |
|--------|------|------|
| page | int | 页码 |
| pageSize | int | 每页数量 |
| equipment_type | string | 设备类型 |
| use_status | string | 使用状态 |
| inspection_status | string | 检验状态 |

**响应示例：**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "asset_code": "ZC001",
      "asset_name": "压力容器",
      "equipment_type": "压力容器",
      "registration_no": "注册编号",
      "next_inspection_date": "2024-06-15",
      "days_until_inspection": 150,
      "status": "in_use"
    }
  ]
}
```

#### POST /api/compliance/special-equipment
**功能说明：** 添加特种设备

**请求参数：**
```json
{
  "asset_id": 1,
  "equipment_type": "压力容器",
  "equipment_category": "Ⅰ类|Ⅱ类|Ⅲ类",
  "registration_no": "注册编号",
  "registration_date": "2020-01-01",
  "registrant": "登记人",
  "manufacturer_license_no": "制造许可证号",
  "product_serial_no": "产品序列号",
  "manufacturing_date": "2020-01-01",
  "first_inspection_date": "2020-06-01",
  "inspection_cycle_months": 36,
  "next_inspection_date": "2024-06-01",
  "safety_manager": "安全管理员",
  "operator_certificate_no": "操作证号",
  "remarks": "备注"
}
```

#### PUT /api/compliance/special-equipment/:id
**功能说明：** 更新特种设备信息

### 15.2 特种设备检验

#### GET /api/compliance/special-equipment/inspections
**功能说明：** 获取特种设备检验记录

**查询参数：**
| 参数名 | 类型 | 说明 |
|--------|------|------|
| equipment_id | int | 设备ID |
| inspection_type | string | 检验类型 |
| page | int | 页码 |
| pageSize | int | 每页数量 |

#### POST /api/compliance/special-equipment/inspections
**功能说明：** 添加检验记录

**请求参数：**
```json
{
  "equipment_id": 1,
  "inspection_type": "定期检验|首次检验|年度检验",
  "inspection_date": "2024-01-15",
  "inspection_agency": "检验机构",
  "inspector": "检验员",
  "inspection_items": ["项目1", "项目2"],
  "inspection_content": "检验内容",
  "inspection_result": "合格|不合格",
  "issues_found": "发现的问题",
  "rectification_measures": "整改措施",
  "rectification_deadline": "整改期限",
  "certificate_no": "证书编号",
  "certificate_image": "证书图片路径",
  "next_inspection_date": "2027-01-15",
  "remarks": "备注"
}
```

#### GET /api/compliance/special-equipment/expiring-inspections
**功能说明：** 获取即将到期的检验

**查询参数：**
| 参数名 | 类型 | 说明 |
|--------|------|------|
| days | int | 提前预警天数，默认90 |

### 15.3 特种设备统计

#### GET /api/compliance/special-equipment/statistics/overview
**功能说明：** 获取特种设备统计概览

**响应示例：**
```json
{
  "success": true,
  "data": {
    "type_statistics": [
      {"equipment_type": "压力容器", "total_count": 10, "in_use_count": 8}
    ],
    "inspection_status": {
      "normal_count": 50,
      "expiring_count": 5,
      "expired_count": 2
    },
    "expiring_count": 5
  }
}
```

---

## 十六、安全检测管理

### 16.1 安全检测记录

#### GET /api/compliance/safety-inspection
**功能说明：** 获取安全检测记录列表

**查询参数：**
| 参数名 | 类型 | 说明 |
|--------|------|------|
| page | int | 页码 |
| pageSize | int | 每页数量 |
| inspection_type | string | 检测类型 |
| inspection_result | string | 检测结果 |
| risk_level | string | 风险等级 |

#### POST /api/compliance/safety-inspection
**功能说明：** 添加安全检测记录

**请求参数：**
```json
{
  "asset_id": 1,
  "inspection_type": "电气安全|辐射安全|机械安全",
  "inspection_category": "检测分类",
  "inspection_name": "检测名称",
  "inspection_standard": "检测标准",
  "standard_code": "标准编号",
  "inspection_date": "2024-01-15",
  "inspection_cycle_months": 12,
  "next_inspection_date": "2025-01-15",
  "inspection_agency": "检测机构",
  "inspector": "检测员",
  "inspection_result": "qualified|unqualified",
  "inspection_items": ["检测项1", "检测项2"],
  "inspection_data": {"key": "value"},
  "issues_found": "发现的问题",
  "risk_level": "low|medium|high|critical",
  "rectification_required": true,
  "rectification_measures": "整改措施",
  "rectification_deadline": "2024-02-15",
  "certificate_no": "证书编号",
  "certificate_image": "证书图片",
  "report_file": "报告文件",
  "remarks": "备注"
}
```

#### PUT /api/compliance/safety-inspection/:id/rectification
**功能说明：** 更新整改信息

**请求参数：**
```json
{
  "rectification_completed_date": "2024-02-10",
  "rectification_result": "整改结果"
}
```

### 16.2 安全检测预警

#### GET /api/compliance/safety-inspection/expiring
**功能说明：** 获取即将到期的安全检测

**查询参数：**
| 参数名 | 类型 | 说明 |
|--------|------|------|
| days | int | 提前预警天数 |
| inspection_type | string | 检测类型 |

### 16.3 安全检测统计

#### GET /api/compliance/safety-inspection/statistics/overview
**功能说明：** 获取安全检测统计

**响应示例：**
```json
{
  "success": true,
  "data": {
    "type_statistics": [
      {"inspection_type": "电气安全", "total_count": 50, "qualified_count": 48}
    ],
    "risk_statistics": [
      {"risk_level": "high", "count": 3}
    ],
    "expiring_count": 10,
    "pending_rectification_count": 5
  }
}
```

---

## 十七、人员资质管理

### 17.1 资质管理

#### GET /api/compliance/staff/qualifications
**功能说明：** 获取人员资质列表

**查询参数：**
| 参数名 | 类型 | 说明 |
|--------|------|------|
| page | int | 页码 |
| pageSize | int | 每页数量 |
| user_id | int | 用户ID |
| qualification_type | string | 资质类型 |
| status | string | 状态 |

**响应示例：**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "user_id": 1,
      "username": "张三",
      "qualification_type": "特种作业",
      "qualification_name": "电工证",
      "certificate_no": "证书编号",
      "issue_date": "2020-01-01",
      "expiry_date": "2025-01-01",
      "days_until_expiry": 180,
      "status": "active"
    }
  ]
}
```

#### POST /api/compliance/staff/qualifications
**功能说明：** 添加人员资质

**请求参数：**
```json
{
  "user_id": 1,
  "qualification_type": "特种作业|专业证书|上岗证",
  "qualification_name": "资质名称",
  "qualification_level": "等级",
  "certificate_no": "证书编号",
  "issuing_authority": "发证机构",
  "issue_date": "2020-01-01",
  "expiry_date": "2025-01-01",
  "professional_field": "专业领域",
  "applicable_equipment": "适用设备",
  "certificate_image": "证书图片",
  "attachments": ["附件1", "附件2"],
  "remarks": "备注"
}
```

#### GET /api/compliance/staff/qualifications/expiring
**功能说明：** 获取即将到期的人员资质

**查询参数：**
| 参数名 | 类型 | 说明 |
|--------|------|------|
| days | int | 提前预警天数，默认90 |

### 17.2 培训记录

#### GET /api/compliance/staff/training-records
**功能说明：** 获取培训记录列表

**查询参数：**
| 参数名 | 类型 | 说明 |
|--------|------|------|
| page | int | 页码 |
| pageSize | int | 每页数量 |
| user_id | int | 用户ID |
| training_type | string | 培训类型 |
| start_date | date | 开始日期 |
| end_date | date | 结束日期 |

#### POST /api/compliance/staff/training-records
**功能说明：** 添加培训记录

**请求参数：**
```json
{
  "user_id": 1,
  "training_type": "岗前培训|在岗培训|技能培训|安全培训",
  "training_name": "培训名称",
  "training_content": "培训内容",
  "training_method": "线上|线下|实操",
  "training_date": "2024-01-15",
  "training_duration": 8,
  "training_location": "培训地点",
  "trainer": "培训讲师",
  "assessment_required": true,
  "assessment_score": 85,
  "assessment_result": "合格|不合格",
  "certificate_no": "证书编号",
  "related_equipment": "相关设备",
  "attachments": ["附件"],
  "remarks": "备注"
}
```

### 17.3 资质统计

#### GET /api/compliance/staff/statistics
**功能说明：** 获取人员资质统计

**响应示例：**
```json
{
  "success": true,
  "data": {
    "qualification_type_stats": [
      {"qualification_type": "特种作业", "total_count": 50, "active_count": 45}
    ],
    "training_stats": [
      {"training_type": "安全培训", "total_count": 100, "total_hours": 800}
    ],
    "expiring_count": 10,
    "expired_count": 3
  }
}
```

---

## 十八、开机率统计

### 18.1 运行记录

#### POST /api/compliance/uptime-statistics/operation-logs
**功能说明：** 记录设备运行数据

**请求参数：**
```json
{
  "asset_id": 1,
  "operation_date": "2024-01-15",
  "planned_operating_hours": 8,
  "actual_operating_hours": 7.5,
  "downtime_hours": 0.5,
  "status_changes": ["在用→待机"],
  "downtime_reason": "设备调试",
  "downtime_type": "maintenance|repair|fault",
  "data_source": "manual|auto",
  "remarks": "备注"
}
```

#### GET /api/compliance/uptime-statistics/operation-logs
**功能说明：** 获取设备运行记录

**查询参数：**
| 参数名 | 类型 | 说明 |
|--------|------|------|
| asset_id | int | 资产ID |
| start_date | date | 开始日期 |
| end_date | date | 结束日期 |

#### POST /api/compliance/uptime-statistics/batch-operation-logs
**功能说明：** 批量录入运行数据

**请求参数：**
```json
{
  "logs": [
    {"asset_id": 1, "operation_date": "2024-01-15", "planned_operating_hours": 8},
    {"asset_id": 2, "operation_date": "2024-01-15", "planned_operating_hours": 8}
  ]
}
```

### 18.2 开机率计算

#### POST /api/compliance/uptime-statistics/calculate
**功能说明：** 计算并更新开机率统计

**请求参数：**
```json
{
  "year": 2024,
  "month": 1
}
```

### 18.3 开机率统计

#### GET /api/compliance/uptime-statistics/statistics
**功能说明：** 获取开机率统计

**查询参数：**
| 参数名 | 类型 | 说明 |
|--------|------|------|
| asset_id | int | 资产ID |
| year | int | 年份 |
| month | int | 月份 |
| department | string | 部门 |
| asset_type | string | 资产类型 |

#### GET /api/compliance/uptime-statistics/overview
**功能说明：** 获取开机率概览

**响应示例：**
```json
{
  "success": true,
  "data": {
    "period": "2024年1月",
    "category_statistics": [
      {
        "equipment_category": "life_support",
        "total_count": 20,
        "avg_uptime_rate": 98.5,
        "qualified_count": 18
      }
    ],
    "department_ranking": [
      {"department": "ICU", "equipment_count": 10, "avg_uptime_rate": 99.5}
    ],
    "low_uptime_equipment": [
      {"asset_code": "ZC001", "asset_name": "设备A", "uptime_rate": 92.0}
    ],
    "downtime_statistics": {
      "maintenance_count": 5,
      "repair_count": 3,
      "fault_count": 2
    }
  }
}
```

---

## 十九、分级保养管理

### 19.1 保养模板

#### GET /api/compliance/maintenance-level/templates
**功能说明：** 获取分级保养模板列表

**查询参数：**
| 参数名 | 类型 | 说明 |
|--------|------|------|
| page | int | 页码 |
| pageSize | int | 每页数量 |
| maintenance_level | string | 保养级别 |
| asset_category | string | 资产分类 |
| status | string | 状态 |

#### POST /api/compliance/maintenance-level/templates
**功能说明：** 创建分级保养模板

**请求参数：**
```json
{
  "template_code": "模板编码",
  "template_name": "模板名称",
  "maintenance_level": "一级|二级|三级|四级",
  "asset_category": "资产分类",
  "asset_type": "资产类型",
  "risk_level": "low|medium|high|critical",
  "cycle_days": 30,
  "cycle_type": "day|week|month|quarter|year",
  "maintenance_items": ["保养项1", "保养项2"],
  "required_tools": "所需工具",
  "required_materials": "所需材料",
  "estimated_hours": 2,
  "standards": "保养标准",
  "safety_requirements": "安全要求"
}
```

#### PUT /api/compliance/maintenance-level/templates/:id
**功能说明：** 更新保养模板

### 19.2 保养计划

#### GET /api/compliance/maintenance-level/plans
**功能说明：** 获取分级保养计划列表

**查询参数：**
| 参数名 | 类型 | 说明 |
|--------|------|------|
| page | int | 页码 |
| pageSize | int | 每页数量 |
| status | string | 状态 |

#### POST /api/compliance/maintenance-level/plans/generate
**功能说明：** 生成分级保养计划

**请求参数：**
```json
{
  "asset_ids": [1, 2, 3],
  "start_date": "2024-02-01",
  "months": 3
}
```

---

## 二十、资产折旧管理

### 20.1 折旧计算

#### GET /api/depreciation
**功能说明：** 获取资产折旧列表

**查询参数：**
| 参数名 | 类型 | 说明 |
|--------|------|------|
| page | int | 页码 |
| pageSize | int | 每页数量 |
| asset_code | string | 资产编码 |

#### GET /api/depreciation/depreciation/:id
**功能说明：** 获取资产折旧详情

### 20.2 折旧汇总

#### GET /api/depreciation/summary/by-department
**功能说明：** 按部门汇总折旧

#### GET /api/depreciation/summary/by-type
**功能说明：** 按资产类型汇总折旧

#### GET /api/depreciation/summary/by-month
**功能说明：** 按月统计折旧

### 20.3 折旧计算

#### POST /api/depreciation/calculate
**功能说明：** 执行折旧计算

**请求参数：**
```json
{
  "year": 2024,
  "month": 1,
  "assets": ["ZC001", "ZC002"]
}
```

#### GET /api/depreciation/export
**功能说明：** 导出折旧数据

#### GET /api/depreciation/methods
**功能说明：** 获取支持的折旧方法

---

## 二十一、闲置资产管理

### 21.1 闲置资产

#### GET /api/idle
**功能说明：** 获取闲置资产列表

**查询参数：**
| 参数名 | 类型 | 说明 |
|--------|------|------|
| page | int | 页码 |
| pageSize | int | 每页数量 |
| department | string | 部门 |

#### POST /api/idle
**功能说明：** 标记资产为闲置

**请求参数：**
```json
{
  "asset_code": "资产编码",
  "idle_reason": "闲置原因",
  "expected_reuse_date": "预计再利用日期",
  "remark": "备注"
}
```

#### PUT /api/idle/:id
**功能说明：** 更新闲置资产信息

### 21.2 闲置资产再利用

#### POST /api/idle/:id/reuse
**功能说明：** 重新利用闲置资产

**请求参数：**
```json
{
  "to_department": "调入部门",
  "to_location": "调入位置",
  "to_person": "接收人",
  "reuse_purpose": "再利用用途"
}
```

### 21.3 闲置统计

#### GET /api/idle/statistics
**功能说明：** 获取闲置资产统计

---

## 二十二、物联网设备管理

### 22.1 IoT 设备

#### GET /api/iot-devices
**功能说明：** 获取 IoT 设备列表

**查询参数：**
| 参数名 | 类型 | 说明 |
|--------|------|------|
| page | int | 页码 |
| pageSize | int | 每页数量 |
| device_type | string | 设备类型 |
| status | string | 状态 |

#### GET /api/iot-devices/:id
**功能说明：** 获取 IoT 设备详情

#### POST /api/iot-devices
**功能说明：** 注册 IoT 设备

**请求参数：**
```json
{
  "device_code": "设备编码",
  "device_name": "设备名称",
  "device_type": "sensor|camera|gps|rfid",
  "asset_code": "关联资产编码",
  "manufacturer": "制造商",
  "model": "型号",
  "location": "安装位置",
  "ip_address": "IP地址",
  "mac_address": "MAC地址",
  "config": {"key": "value"}
}
```

#### PUT /api/iot-devices/:id
**功能说明：** 更新 IoT 设备

#### DELETE /api/iot-devices/:id
**功能说明：** 删除 IoT 设备

### 22.2 设备数据

#### GET /api/iot-devices/:id/data
**功能说明：** 获取 IoT 设备采集数据

**查询参数：**
| 参数名 | 类型 | 说明 |
|--------|------|------|
| start_time | datetime | 开始时间 |
| end_time | datetime | 结束时间 |
| data_type | string | 数据类型 |

#### POST /api/iot-devices/:id/commands
**功能说明：** 发送设备命令

---

## 二十三、条码管理

### 23.1 条码生成

#### GET /api/barcode-scan/generate/:asset_code
**功能说明：** 生成资产条码

**响应：** 条码图片

### 23.2 条码验证

#### POST /api/barcode-scan/verify
**功能说明：** 验证条码

**请求参数：**
```json
{
  "barcode": "条码内容",
  "expected_asset_code": "期望的资产编码"
}
```

### 23.3 扫码盘点

#### POST /api/barcode-scan/inventory
**功能说明：** 通过扫描条码完成资产盘点

**请求参数：**
```json
{
  "inventory_id": 1,
  "asset_code": "资产编码",
  "actual_location": "实际位置",
  "actual_status": "实际状态",
  "scan_time": "2024-01-15 10:30:00"
}
```

### 23.4 扫描日志

#### GET /api/barcode-scan/logs
**功能说明：** 获取条码扫描操作日志

---

## 二十四、工作流管理

### 24.1 工作流定义

#### GET /api/workflow
**功能说明：** 获取工作流列表

#### GET /api/workflow/default
**功能说明：** 获取当前租户的默认工作流

### 24.2 状态管理

#### GET /api/workflow/states
**功能说明：** 获取工作流状态定义

#### GET /api/workflow/transitions
**功能说明：** 获取状态迁移规则

### 24.3 状态迁移

#### POST /api/workflow/transition/:assetId
**功能说明：** 对指定资产执行状态迁移

**请求参数：**
```json
{
  "from_status": "在用",
  "to_status": "闲置",
  "reason": "迁移原因",
  "remark": "备注"
}
```

---

## 二十五、审计日志

### 25.1 审计日志查询

#### GET /api/audit-logs
**功能说明：** 获取审计日志列表

**查询参数：**
| 参数名 | 类型 | 说明 |
|--------|------|------|
| page | int | 页码 |
| pageSize | int | 每页数量 |
| user_id | int | 用户ID |
| action | string | 操作类型 |
| resource_type | string | 资源类型 |
| start_date | date | 开始日期 |
| end_date | date | 结束日期 |

**响应示例：**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "user_id": 1,
      "username": "张三",
      "action": "create",
      "resource_type": "asset",
      "resource_id": "ZC001",
      "ip_address": "192.168.1.1",
      "user_agent": "Mozilla/5.0...",
      "details": {"field": "changed"},
      "created_at": "2024-01-15 10:30:00"
    }
  ]
}
```

#### GET /api/audit-logs/:id
**功能说明：** 获取审计日志详情

### 25.2 增强审计

#### GET /api/audit-logs-enhanced/enhanced
**功能说明：** 获取增强版审计日志

#### GET /api/audit-logs-enhanced/statistics
**功能说明：** 获取审计统计

#### GET /api/audit-logs-enhanced/operations
**功能说明：** 获取操作类型统计

#### GET /api/audit-logs-enhanced/resource-types
**功能说明：** 获取资源类型统计

#### GET /api/audit-logs-enhanced/export
**功能说明：** 导出审计日志

#### POST /api/audit-logs-enhanced/cleanup
**功能说明：** 清理过期审计日志

---

## 二十六、集成渠道

### 26.1 渠道管理

#### GET /api/integration-channels/channels
**功能说明：** 获取集成渠道列表

#### GET /api/integration-channels/channels/:channel
**功能说明：** 获取渠道详情

#### POST /api/integration-channels/channels/:channel
**功能说明：** 创建集成渠道

**请求参数：**
```json
{
  "name": "渠道名称",
  "type": "webhook|email|sms|wechat",
  "config": {
    "webhook_url": "https://...",
    "secret_key": "xxx"
  },
  "enabled": true
}
```

#### DELETE /api/integration-channels/channels/:channel
**功能说明：** 删除集成渠道

### 26.2 渠道测试

#### POST /api/integration-channels/channels/:channel/test
**功能说明：** 测试渠道连接

#### POST /api/integration-channels/channels/:channel/send-test
**功能说明：** 发送测试消息

### 26.3 消息模板

#### GET /api/integration-channels/channels/:channel/templates
**功能说明：** 获取消息模板列表

#### POST /api/integration-channels/channels/:channel/templates
**功能说明：** 创建消息模板

#### DELETE /api/integration-channels/channels/:channel/templates/:templateId
**功能说明：** 删除消息模板

---

## 二十七、云同步

### 27.1 Webhook

#### POST /api/cloud-sync/webhook/:sourceId
**功能说明：** 接收第三方数据同步 Webhook

### 27.2 同步源管理

#### GET /api/cloud-sync/sources
**功能说明：** 获取同步源列表

#### POST /api/cloud-sync/sources
**功能说明：** 创建同步源

**请求参数：**
```json
{
  "name": "同步源名称",
  "type": "api|file|database",
  "config": {
    "endpoint": "https://...",
    "api_key": "xxx"
  },
  "enabled": true
}
```

#### PUT /api/cloud-sync/sources/:id
**功能说明：** 更新同步源

#### DELETE /api/cloud-sync/sources/:id
**功能说明：** 删除同步源

### 27.3 同步事件

#### GET /api/cloud-sync/events
**功能说明：** 获取同步事件记录

#### GET /api/cloud-sync/events/stream
**功能说明：** 获取实时同步事件流

---

## 二十八、系统配置

### 28.1 配置管理

#### GET /api/system-config
**功能说明：** 获取系统配置

#### PUT /api/system-config
**功能说明：** 更新系统配置

**请求参数：**
```json
{
  "config_key": "配置键",
  "config_value": "配置值",
  "description": "配置描述"
}
```

### 28.2 模块配置

#### GET /api/modules
**功能说明：** 获取系统模块列表

#### POST /api/modules
**功能说明：** 创建系统模块

#### PUT /api/modules/:id
**功能说明：** 更新模块

#### PUT /api/modules/:id/enable
**功能说明：** 启用模块

#### PUT /api/modules/:id/disable
**功能说明：** 禁用模块

### 28.3 租户模块配置

#### GET /api/tenant-module-config
**功能说明：** 获取租户模块配置

#### POST /api/tenant-module-config
**功能说明：** 创建租户模块配置

#### PUT /api/tenant-module-config/:id
**功能说明：** 更新租户模块配置

---

## 二十九、数据备份

### 29.1 备份管理

#### GET /api/backup
**功能说明：** 获取备份列表

**响应示例：**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "backup_name": "backup_20240115",
      "backup_type": "full|incremental",
      "backup_size": 1024000,
      "status": "completed",
      "created_at": "2024-01-15 10:00:00"
    }
  ]
}
```

#### POST /api/backup
**功能说明：** 创建备份

**请求参数：**
```json
{
  "backup_name": "备份名称",
  "backup_type": "full|incremental"
}
```

#### GET /api/backup/:id
**功能说明：** 获取备份详情

#### POST /api/backup/:id/restore
**功能说明：** 从备份恢复数据

#### DELETE /api/backup/:id
**功能说明：** 删除备份

---

## 三十、位置编码管理

### 30.1 位置编码

#### GET /api/location-codes
**功能说明：** 获取位置编码列表

#### POST /api/location-codes
**功能说明：** 创建位置编码

**请求参数：**
```json
{
  "code": "A-01-01",
  "name": "A栋1层1号房间",
  "parent_id": 1,
  "type": "building|floor|room|area",
  "description": "描述"
}
```

#### PUT /api/location-codes/:id
**功能说明：** 更新位置编码

#### DELETE /api/location-codes/:id
**功能说明：** 删除位置编码

---

## 三十一、资产标签

### 31.1 标签生成

#### POST /api/asset-labels/generate
**功能说明：** 生成资产标签

**请求参数：**
```json
{
  "asset_codes": ["ZC001", "ZC002"],
  "label_type": "qrcode|barcode|both",
  "size": "small|medium|large",
  "include_info": ["name", "code", "location"]
}
```

### 31.2 标签打印

#### POST /api/asset-labels/print
**功能说明：** 批量打印资产标签

**请求参数：**
```json
{
  "asset_codes": ["ZC001", "ZC002"],
  "printer": "打印机名称",
  "copies": 1
}
```

---

## 三十二、页面浏览统计

### 32.1 浏览统计

#### GET /api/page-views/:pageKey
**功能说明：** 获取页面浏览量

**响应示例：**
```json
{
  "success": true,
  "data": {
    "page_key": "dashboard",
    "views": 1000,
    "unique_views": 500,
    "period": "day|week|month"
  }
}
```

#### POST /api/page-views/:pageKey
**功能说明：** 记录页面浏览

---

## 三十三、智能告警

### 33.1 告警列表

#### GET /api/intelligent-alerts
**功能说明：** 获取智能告警列表

**查询参数：**
| 参数名 | 类型 | 说明 |
|--------|------|------|
| page | int | 页码 |
| pageSize | int | 每页数量 |
| alert_type | string | 告警类型 |
| status | string | 状态 |

#### GET /api/intelligent-alerts/overview
**功能说明：** 获取告警概览

### 33.2 告警处理

#### POST /api/intelligent-alerts/:alertId/read
**功能说明：** 标记告警已读

#### POST /api/intelligent-alerts/:alertId/handle
**功能说明：** 处理告警

#### POST /api/intelligent-alerts/:alertId/unhandle
**功能说明：** 取消处理

#### POST /api/intelligent-alerts/read-all
**功能说明：** 全部标记已读

#### POST /api/intelligent-alerts/handle-all
**功能说明：** 批量处理告警

### 33.3 告警分类

#### GET /api/intelligent-alerts/maintenance
**功能说明：** 获取维修相关告警

#### GET /api/intelligent-alerts/qualifications
**功能说明：** 获取资质相关告警

#### GET /api/intelligent-alerts/inspections
**功能说明：** 获取巡检相关告警

#### GET /api/intelligent-alerts/safety
**功能说明：** 获取安全相关告警

#### GET /api/intelligent-alerts/uptime
**功能说明：** 获取运行时间告警

### 33.4 告警设置

#### GET /api/intelligent-alerts/settings
**功能说明：** 获取告警设置

#### POST /api/intelligent-alerts/settings
**功能说明：** 更新告警设置

---

## 三十四、位置告警

### 34.1 位置告警

#### GET /api/location-alerts
**功能说明：** 获取位置告警列表

#### GET /api/location-alerts/stats
**功能说明：** 获取位置告警统计

#### PUT /api/location-alerts/:id/handle
**功能说明：** 处理位置告警

#### DELETE /api/location-alerts/:id
**功能说明：** 删除位置告警

#### POST /api/location-alerts/batch/handle
**功能说明：** 批量处理位置告警

---

## 三十五、数据分析

### 35.1 综合分析

#### GET /api/analysis
**功能说明：** 获取综合分析数据

#### GET /api/analysis/value-distribution
**功能说明：** 获取资产价值分布分析

#### GET /api/analysis/depreciation
**功能说明：** 获取资产折旧分析报告

---

## 三十六、维修效率分析

### 36.1 效率统计

#### GET /api/maintenance/analytics/efficiency/overview
**功能说明：** 获取维修效率概览

#### GET /api/maintenance/analytics/efficiency/response-time
**功能说明：** 获取维修响应时间统计

#### GET /api/maintenance/analytics/efficiency/technician
**功能说明：** 获取技术人员统计

#### GET /api/maintenance/analytics/efficiency/asset-frequency
**功能说明：** 获取资产维修频率统计

### 36.2 维修分析

#### GET /api/maintenance/analytics/analysis/asset-history
**功能说明：** 获取资产维修历史分析

#### GET /api/maintenance/analytics/analysis/effectiveness-stats
**功能说明：** 获取维修效能统计

#### GET /api/maintenance/analytics/analysis/cost-trend
**功能说明：** 获取维修费用趋势

#### GET /api/maintenance/analytics/analysis/technician-performance
**功能说明：** 获取维修人员绩效

#### GET /api/maintenance/analytics/analysis/type-distribution
**功能说明：** 获取维修类型分布

---

## 三十七、维修模板

### 37.1 模板管理

#### GET /api/maintenance/templates
**功能说明：** 获取维修模板列表

#### POST /api/maintenance/templates
**功能说明：** 创建维修模板

**请求参数：**
```json
{
  "template_name": "模板名称",
  "category": "维修类别",
  "steps": ["步骤1", "步骤2"],
  "estimated_time": 60,
  "required_parts": ["配件1", "配件2"],
  "instructions": "操作说明"
}
```

#### PUT /api/maintenance/templates/:id
**功能说明：** 更新维修模板

#### DELETE /api/maintenance/templates/:id
**功能说明：** 删除维修模板

### 37.2 模板推荐

#### GET /api/maintenance/templates/recommend
**功能说明：** 获取推荐模板

#### GET /api/maintenance/templates/recommend-by-asset
**功能说明：** 根据资产推荐模板

---

## 三十八、资产使用量

### 38.1 使用量追踪

#### POST /api/maintenance/usage/update
**功能说明：** 更新资产使用量

**请求参数：**
```json
{
  "asset_code": "资产编码",
  "usage_value": 100,
  "usage_type": "hours|km|pages",
  "record_date": "2024-01-15"
}
```

#### GET /api/maintenance/usage/history
**功能说明：** 获取使用量历史

#### GET /api/maintenance/usage/statistics
**功能说明：** 获取使用量统计

### 38.2 使用量触发维护

#### GET /api/maintenance/usage/check-thresholds
**功能说明：** 检查是否达到维护阈值

#### GET /api/maintenance/usage/usage-records
**功能说明：** 获取使用记录

#### POST /api/maintenance/usage/usage-records
**功能说明：** 创建使用记录

#### GET /api/maintenance/usage/usage-triggered
**功能说明：** 获取触发的维护记录

#### POST /api/maintenance/usage/usage-triggered/:id/process
**功能说明：** 处理触发的维护

---

## 三十九、增强技术文档

### 39.1 文档分类

#### GET /api/technical-documents-enhanced/categories
**功能说明：** 获取文档分类列表

#### POST /api/technical-documents-enhanced/categories
**功能说明：** 创建文档分类

#### PUT /api/technical-documents-enhanced/categories/:id
**功能说明：** 更新文档分类

#### DELETE /api/technical-documents-enhanced/categories/:id
**功能说明：** 删除文档分类

### 39.2 文档标签

#### GET /api/technical-documents-enhanced/tags
**功能说明：** 获取文档标签列表

#### POST /api/technical-documents-enhanced/tags
**功能说明：** 创建文档标签

#### DELETE /api/technical-documents-enhanced/tags/:id
**功能说明：** 删除文档标签

#### POST /api/technical-documents-enhanced/documents/:id/tags
**功能说明：** 为文档添加标签

#### GET /api/technical-documents-enhanced/documents/:id/tags
**功能说明：** 获取文档标签

### 39.3 文档版本

#### GET /api/technical-documents-enhanced/documents/:id/versions
**功能说明：** 获取文档版本历史

#### POST /api/technical-documents-enhanced/documents/:id/versions
**功能说明：** 创建文档新版本

### 39.4 文档收藏

#### POST /api/technical-documents-enhanced/documents/:id/favorite
**功能说明：** 收藏文档

#### DELETE /api/technical-documents-enhanced/documents/:id/favorite
**功能说明：** 取消收藏

#### GET /api/technical-documents-enhanced/my/favorites
**功能说明：** 获取我的收藏

### 39.5 文档评论

#### GET /api/technical-documents-enhanced/documents/:id/comments
**功能说明：** 获取文档评论

#### POST /api/technical-documents-enhanced/documents/:id/comments
**功能说明：** 添加文档评论

#### PUT /api/technical-documents-enhanced/comments/:id/resolve
**功能说明：** 标记评论已解决

### 39.6 浏览历史

#### POST /api/technical-documents-enhanced/documents/:id/view
**功能说明：** 记录文档浏览

#### GET /api/technical-documents-enhanced/my/history
**功能说明：** 获取浏览历史

### 39.7 文档统计

#### GET /api/technical-documents-enhanced/statistics
**功能说明：** 获取文档统计

### 39.8 文档模板

#### GET /api/technical-documents-enhanced/templates
**功能说明：** 获取文档模板列表

#### POST /api/technical-documents-enhanced/templates
**功能说明：** 创建文档模板

#### DELETE /api/technical-documents-enhanced/templates/:id
**功能说明：** 删除文档模板

### 39.9 批量操作

#### POST /api/technical-documents-enhanced/batch/delete
**功能说明：** 批量删除文档

#### POST /api/technical-documents-enhanced/batch/category
**功能说明：** 批量更新文档分类

---

## 四十、健康检查

### 40.1 系统健康

#### GET /api/health
**功能说明：** 基础健康检查（无需认证）

#### GET /api/health/detailed
**功能说明：** 详细健康检查

#### GET /api/ready
**功能说明：** 系统就绪检查

#### GET /api/alive
**功能说明：** 服务存活检查

#### GET /api/health/metrics
**功能说明：** 获取系统指标

#### GET /api/health/circuit-breakers
**功能说明：** 获取熔断器状态

#### POST /api/health/circuit-breakers/:name/reset
**功能说明：** 重置熔断器

---

## 四十一、API 文档

### 41.1 文档接口

#### GET /api-docs
**功能说明：** 获取 API 文档概览

#### GET /api-docs/modules
**功能说明：** 获取模块列表

#### GET /api-docs/module/:path
**功能说明：** 获取指定模块详情

#### GET /api-docs/endpoints
**功能说明：** 获取所有接口列表

---

## 四十二、通用说明

### 12.1 认证方式

所有需要认证的接口都需要在请求头中携带 Token：

```
Authorization: Bearer <token>
```

对于多租户系统，还需要携带租户ID：

```
X-Tenant-Id: <tenant_id>
```

### 12.2 通用响应格式

**成功响应：**
```json
{
  "success": true,
  "message": "操作成功",
  "data": {...},
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

**错误响应：**
```json
{
  "success": false,
  "message": "错误信息",
  "error": "详细错误信息"
}
```

### 12.3 HTTP 状态码

| 状态码 | 说明 |
|--------|------|
| 200 | 成功 |
| 201 | 创建成功 |
| 400 | 请求参数错误 |
| 401 | 未认证 |
| 403 | 无权限 |
| 404 | 资源不存在 |
| 500 | 服务器错误 |

### 12.4 分页参数

所有列表接口支持分页：

| 参数名 | 类型 | 说明 |
|--------|------|------|
| page | int | 页码，默认1 |
| pageSize | int | 每页数量，默认20 |

响应中包含分页信息：
```json
{
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

### 12.5 日期格式

- 请求参数：YYYY-MM-DD 或 YYYY-MM-DD HH:mm:ss
- 响应格式：YYYY-MM-DD HH:mm:ss

---

## 十三、常用资产状态

| 状态值 | 说明 |
|--------|------|
| 在用 | 正常使用中 |
| 闲置 | 暂时未使用 |
| 维修 | 正在维修中 |
| 报废 | 已报废 |
| 调配中 | 正在进行部门调配 |

---

## 十四、盘点状态

| 状态值 | 说明 |
|--------|------|
| 进行中 | 盘点正在进行 |
| 已完成 | 盘点已完成 |
| 已取消 | 盘点已取消 |

---

## 十五、维护状态

| 状态值 | 说明 |
|--------|------|
| pending | 待处理 |
| in_progress | 进行中 |
| completed | 已完成 |
| cancelled | 已取消 |

---

## 十六、调配状态

| 状态值 | 说明 |
|--------|------|
| pending | 待审批 |
| approved | 已批准 |
| rejected | 已拒绝/已取消 |
| completed | 已完成 |

---

## 十七、报废状态

| 状态值 | 说明 |
|--------|------|
| pending | 待处理 |
| appraising | 鉴定中 |
| approved | 已批准 |
| rejected | 已拒绝 |
| disposing | 处置中 |
| completed | 已完成 |

---

## 十八、审核状态

| 状态值 | 说明 |
|--------|------|
| pending | 待审核 |
| approved | 已通过 |
| rejected | 已拒绝 |

---

## 十九、文件上传说明

### 19.1 通用文件上传

**请求格式：** multipart/form-data

**响应格式：**
```json
{
  "success": true,
  "message": "上传成功",
  "data": {
    "url": "/uploads/xxx/file.pdf",
    "filename": "原文件名.pdf",
    "size": 1024000,
    "mimetype": "application/pdf"
  }
}
```

### 19.2 文件大小限制

- 技术文档：10MB
- 维护附件：50MB
- 报废文件：50MB

### 19.3 支持的文件类型

**技术文档：**
- PDF、Word、Excel、PPT
- 图片（JPG、PNG、GIF、BMP、WebP）
- 文本文件、Markdown
- 压缩文件（ZIP、RAR、7Z）

**维护附件：**
- 图片、PDF、Word、Excel、文本文件

---

## 二十、错误代码参考

| 错误代码 | 说明 |
|---------|------|
| E001 | 认证失败 |
| E002 | 权限不足 |
| E003 | 资源不存在 |
| E004 | 参数错误 |
| E005 | 业务规则错误 |
| E006 | 文件上传失败 |
| E007 | 租户不匹配 |
| E008 | 数据冲突 |

---

*文档更新时间：2024年*
