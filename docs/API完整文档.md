# AssetHub API 完整文档

> 基于 OpenAPI 3.0.3 规范 | 版本: 1.1.0 | 更新时间: 2026-03-28

---

## 目录

- [概述](#概述)
- [认证与授权](#认证与授权)
- [用户管理](#用户管理)
- [资产管理](#资产管理)
- [库存管理](#库存管理)
- [维修维护](#维修维护)
- [质量管理](#质量管理)
- [采购管理](#采购管理)
- [资产管理（闲置/调拨/报废）](#资产管理闲置调拨报废)
- [部门与租户](#部门与租户)
- [角色权限](#角色权限)
- [系统配置](#系统配置)
- [模块管理](#模块管理)
- [质量计量](#质量计量)
- [物联网设备](#物联网设备)
- [技术文档](#技术文档)
- [AI 助手](#ai-助手)
- [数据备份](#数据备份)
- [工作流引擎](#工作流引擎)
- [健康检查与监控](#健康检查与监控)
- [通用查询参数](#通用查询参数)
- [响应格式](#响应格式)

---

## 概述

### 服务器

| 环境 | URL |
|------|-----|
| 本地开发 | `http://localhost:5183/api` |
| 生产环境 | `http://101.37.236.101:13578/api` |

### 全局安全机制

| 机制 | 说明 |
|------|------|
| JWT Bearer Token | 除登录/注册接口外，所有接口均需携带 `Authorization: Bearer <token>` |
| 租户隔离 | 通过 `tenant_id` 过滤数据，超级管理员可通过 `X-Tenant-ID` 头切换租户 |
| 角色权限 | 基于 `role_code` 的 RBAC 权限控制 |
| 速率限制 | 登录接口 5 分钟内最多 5 次，通用 API 每分钟 100 次 |

### 全局响应格式

```json
// 成功响应
{
  "success": true,
  "data": { ... },
  "message": "操作成功",
  "timestamp": "2026-03-28T10:00:00.000Z"
}

// 分页响应
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 100,
    "totalPages": 5
  }
}

// 错误响应
{
  "success": false,
  "message": "错误信息",
  "code": "BAD_REQUEST",
  "timestamp": "2026-03-28T10:00:00.000Z",
  "path": "/api/assets",
  "method": "GET"
}
```

---

## 认证与授权

### 用户登录

```
POST /api/users/login
```

**标签:** 认证

**安全:** 无需认证

**请求体:**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| username | string | 是 | 用户名 |
| password | string | 是 | 密码 |
| captcha | string | 否 | 验证码（如已开启） |

**响应示例 (200):**

```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 1,
      "username": "admin",
      "display_name": "系统管理员",
      "role": "super_admin",
      "tenant_id": 1,
      "department_code": "D001"
    },
    "expires_in": 86400
  },
  "message": "登录成功"
}
```

**错误码:**

| code | 说明 |
|------|------|
| INVALID_CREDENTIALS | 用户名或密码错误 |
| ACCOUNT_LOCKED | 账户已被锁定 |
| RATE_LIMIT_EXCEEDED | 登录尝试过于频繁 |

---

### 用户注册

```
POST /api/users/register
```

**标签:** 认证

**安全:** 无需认证

**请求体:**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| username | string | 是 | 用户名（3-20字符） |
| password | string | 是 | 密码（8位以上） |
| display_name | string | 是 | 显示名称 |
| email | string | 否 | 邮箱 |
| phone | string | 否 | 手机号 |
| department_code | string | 否 | 部门代码 |
| tenant_id | integer | 否 | 租户ID（系统管理员创建用户时必填） |

**响应示例 (201):**

```json
{
  "success": true,
  "data": {
    "id": 2,
    "username": "newuser",
    "display_name": "新用户"
  },
  "message": "注册成功"
}
```

---

### 用户登出

```
POST /api/users/logout
```

**标签:** 认证

**请求体:** 无

**响应示例 (200):**

```json
{
  "success": true,
  "message": "登出成功"
}
```

---

### 修改密码

```
POST /api/users/change-password
```

**标签:** 认证

**请求体:**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| old_password | string | 是 | 原密码 |
| new_password | string | 是 | 新密码（8位以上） |

**响应示例 (200):**

```json
{
  "success": true,
  "message": "密码修改成功"
}
```

---

### 获取当前用户资料

```
GET /api/users/profile
```

**标签:** 认证

**响应示例 (200):**

```json
{
  "success": true,
  "data": {
    "id": 1,
    "username": "admin",
    "display_name": "系统管理员",
    "email": "admin@example.com",
    "phone": "13800138000",
    "role": "super_admin",
    "tenant_id": 1,
    "tenant_name": "默认租户",
    "department_code": "D001",
    "department_name": "信息中心",
    "language": "zh-CN",
    "avatar": "https://..."
  }
}
```

---

### 更新用户资料

```
PUT /api/users/profile
```

**标签:** 认证

**请求体:**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| display_name | string | 否 | 显示名称 |
| email | string | 否 | 邮箱 |
| phone | string | 否 | 手机号 |
| language | string | 否 | 语言偏好 (zh-CN / en-US) |

---

## 用户管理

### 用户列表

```
GET /api/users
```

**标签:** 用户管理

**查询参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| page | integer | 页码（默认1） |
| pageSize | integer | 每页数量（默认20） |
| search | string | 搜索关键词（用户名/显示名） |
| role | string | 按角色筛选 |
| department_code | string | 按部门筛选 |
| status | string | 状态 (active/inactive/locked) |
| sortField | string | 排序字段 |
| sortOrder | string | 排序方向 (asc/desc) |

**响应示例 (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "username": "admin",
      "display_name": "系统管理员",
      "role": "super_admin",
      "status": "active",
      "last_login": "2026-03-28T08:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 50,
    "totalPages": 3
  }
}
```

---

### 创建用户（系统管理员）

```
POST /api/users
```

**标签:** 用户管理

**权限:** 需要 `system_admin` 或 `super_admin`

**请求体:**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| username | string | 是 | 用户名 |
| password | string | 是 | 初始密码 |
| display_name | string | 是 | 显示名称 |
| role | string | 是 | 角色代码 |
| email | string | 否 | 邮箱 |
| phone | string | 否 | 手机号 |
| department_code | string | 否 | 部门代码 |
| tenant_id | integer | 是 | 租户ID |

---

### 更新用户

```
PUT /api/users/:id
```

**标签:** 用户管理

**路径参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| id | integer | 用户ID |

**请求体:** 同创建用户，可部分更新

---

### 删除用户

```
DELETE /api/users/:id
```

**标签:** 用户管理

**权限:** 需要 `super_admin`

**响应示例 (200):**

```json
{
  "success": true,
  "message": "用户已删除"
}
```

---

### 重置用户密码

```
POST /api/users/:id/reset-password
```

**标签:** 用户管理

**权限:** 需要 `system_admin`

**响应示例 (200):**

```json
{
  "success": true,
  "data": {
    "temp_password": "Ab123456"
  },
  "message": "密码已重置"
}
```

---

### 批量创建用户

```
POST /api/users/batch
```

**标签:** 用户管理

**权限:** 需要 `system_admin`

**请求体:**

```json
{
  "users": [
    {
      "username": "user1",
      "password": "Password123",
      "display_name": "用户1",
      "role": "user",
      "department_code": "D001"
    },
    {
      "username": "user2",
      "password": "Password123",
      "display_name": "用户2",
      "role": "user",
      "department_code": "D002"
    }
  ]
}
```

---

## 资产管理

### 资产列表

```
GET /api/assets
```

**标签:** 资产管理

**查询参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| page / pageNum | integer | 页码 |
| pageSize / size / limit | integer | 每页数量 |
| search | string | 搜索关键词 |
| asset_code | string | 资产编号（精确匹配） |
| asset_name | string | 资产名称 |
| category_id | integer | 资产类别ID |
| status | string | 资产状态 (在用/闲置/报废/调拨中) |
| department_id | integer | 所属部门ID |
| location | string | 存放地点 |
| acquisition_date_from | string | 购置日期起 |
| acquisition_date_to | string | 购置日期止 |
| min_value | number | 购置金额下限 |
| max_value | number | 购置金额上限 |
| supplier | string | 供应商 |
| manufacturer | string | 制造商 |
| model | string | 规格型号 |
| serial_number | string | 出厂编号 |
| is_self_check | boolean | 是否自主盘点 |
| sortField | string | 排序字段 |
| sortOrder | string | 排序方向 |

**响应示例 (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "asset_code": "A20260001",
      "asset_name": "联想ThinkPad笔记本",
      "category_id": 5,
      "category_name": "电子设备",
      "specification": "ThinkPad X1 Carbon",
      "unit": "台",
      "quantity": 1,
      "acquisition_date": "2026-01-15",
      "acquisition_value": 12000.00,
      "status": "在用",
      "department_id": 1,
      "department_name": "信息中心",
      "location": "办公楼301",
      "responsible_person": "张三",
      "supplier": "联想经销商",
      "manufacturer": "联想集团",
      "depreciation_method": "直线法",
      "service_life": 5,
      "salvage_value": 600.00,
      "current_value": 10800.00,
      "image_url": "https://...",
      "qr_code": "...",
      "created_at": "2026-01-15T10:00:00.000Z",
      "updated_at": "2026-03-20T14:30:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

---

### 获取资产详情

```
GET /api/assets/:id
```

**标签:** 资产管理

**路径参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| id | integer | 资产ID |

**响应示例 (200):**

```json
{
  "success": true,
  "data": {
    "id": 1,
    "asset_code": "A20260001",
    "asset_name": "联想ThinkPad笔记本",
    "category": {
      "id": 5,
      "name": "电子设备",
      "code": "ELEC"
    },
    "specification": "ThinkPad X1 Carbon",
    "unit": "台",
    "quantity": 1,
    "acquisition_date": "2026-01-15",
    "acquisition_value": 12000.00,
    "net_value": 10800.00,
    "status": "在用",
    "source": "采购",
    "department": {
      "id": 1,
      "name": "信息中心",
      "code": "D001"
    },
    "location": "办公楼301",
    "responsible_person": "张三",
    "supplier": "联想经销商",
    "manufacturer": "联想集团",
    "model": "X1 Carbon Gen 11",
    "serial_number": "PF2ABCD1",
    "warranty_period": "2027-01-15",
    "depreciation": {
      "method": "直线法",
      "rate": 0.2,
      "service_life": 5,
      "accumulated": 1200.00,
      "current_value": 10800.00
    },
    "images": [
      {
        "id": 1,
        "url": "https://...",
        "is_primary": true
      }
    ],
    "labels": [...],
    "transfer_history": [...],
    "maintenance_history": [...],
    "created_at": "2026-01-15T10:00:00.000Z",
    "updated_at": "2026-03-20T14:30:00.000Z"
  }
}
```

---

### 创建资产

```
POST /api/assets
```

**标签:** 资产管理

**权限:** 需要 `asset_admin` 或更高

**请求体:**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| asset_code | string | 是 | 资产编号（系统内唯一） |
| asset_name | string | 是 | 资产名称 |
| category_id | integer | 是 | 资产类别ID |
| specification | string | 否 | 规格型号 |
| unit | string | 否 | 计量单位 |
| quantity | number | 否 | 数量 |
| acquisition_date | string | 否 | 购置日期 (YYYY-MM-DD) |
| acquisition_value | number | 否 | 购置金额 |
| status | string | 否 | 状态 (默认"在用") |
| department_id | integer | 否 | 所属部门 |
| location | string | 否 | 存放地点 |
| responsible_person | string | 否 | 负责人 |
| supplier | string | 否 | 供应商 |
| manufacturer | string | 否 | 制造商 |
| model | string | 否 | 规格型号 |
| serial_number | string | 否 | 出厂编号 |
| warranty_period | string | 否 | 保修期 |
| depreciation_method | string | 否 | 折旧方法 |
| service_life | integer | 否 | 使用年限 |
| notes | string | 否 | 备注 |

**响应示例 (201):**

```json
{
  "success": true,
  "data": {
    "id": 100,
    "asset_code": "A20260002",
    "asset_name": "Dell显示器",
    "created_at": "2026-03-28T10:00:00.000Z"
  },
  "message": "资产创建成功"
}
```

---

### 更新资产

```
PUT /api/assets/:id
```

**标签:** 资产管理

**权限:** 需要 `asset_admin` 或更高

**请求体:** 同创建资产，可部分更新

---

### 删除资产

```
DELETE /api/assets/:id
```

**标签:** 资产管理

**权限:** 需要 `super_admin`

**说明:** 资产删除为软删除，实际标记为已报废状态

**响应示例 (200):**

```json
{
  "success": true,
  "message": "资产已删除"
}
```

---

### 批量导入资产

```
POST /api/assets/import
```

**标签:** 资产管理

**权限:** 需要 `asset_admin`

**Content-Type:** `multipart/form-data`

**表单字段:**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| file | file | 是 | Excel文件 (.xlsx/.xls) |
| overwrite | boolean | 否 | 是否覆盖已存在数据（默认false） |

**响应示例 (200):**

```json
{
  "success": true,
  "data": {
    "total": 100,
    "success": 95,
    "failed": 5,
    "errors": [
      {
        "row": 5,
        "asset_code": "A20260005",
        "error": "资产编号已存在"
      }
    ]
  },
  "message": "导入完成"
}
```

---

### 导出资产

```
GET /api/assets/export
```

**标签:** 资产管理

**查询参数:** 同资产列表查询参数

**响应:** Excel文件下载 (`Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`)

---

### 获取资产变更日志

```
GET /api/assets/:id/changes
```

**标签:** 资产管理

**响应示例 (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "field": "status",
      "old_value": "在用",
      "new_value": "闲置",
      "changed_by": "张三",
      "changed_at": "2026-03-20T14:30:00.000Z",
      "reason": "设备升级替换"
    }
  ]
}
```

---

## 资产类别管理

### 资产类别列表

```
GET /api/assets/categories
```

**标签:** 资产管理

**查询参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| parent_id | integer | 父类别ID（空则获取顶级） |
| tree | boolean | 是否返回树形结构 |

**响应示例 (200) - tree=true:**

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "固定资产",
      "code": "FIXED",
      "parent_id": null,
      "children": [
        {
          "id": 2,
          "name": "电子设备",
          "code": "ELEC",
          "parent_id": 1,
          "children": []
        }
      ]
    }
  ]
}
```

---

### 创建资产类别

```
POST /api/assets/categories
```

**标签:** 资产管理

**权限:** 需要 `system_admin`

**请求体:**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | 是 | 类别名称 |
| code | string | 是 | 类别代码（唯一） |
| parent_id | integer | 否 | 父类别ID |
| description | string | 否 | 描述 |
| icon | string | 否 | 图标 |
| sort_order | integer | 否 | 排序 |

---

### 更新资产类别

```
PUT /api/assets/categories/:id
```

**标签:** 资产管理

**权限:** 需要 `system_admin`

---

### 删除资产类别

```
DELETE /api/assets/categories/:id
```

**标签:** 资产管理

**权限:** 需要 `system_admin`

**说明:** 如果类别下有资产，则不允许删除

---

## 资产统计

### 资产总览统计

```
GET /api/assets/statistics/overview
```

**标签:** 资产管理

**响应示例 (200):**

```json
{
  "success": true,
  "data": {
    "total_count": 1500,
    "total_value": 50000000.00,
    "by_status": {
      "在用": 1200,
      "闲置": 150,
      "报废": 100,
      "调拨中": 50
    },
    "by_category": [
      {
        "category_id": 1,
        "category_name": "电子设备",
        "count": 500,
        "value": 15000000.00
      }
    ],
    "by_department": [
      {
        "department_id": 1,
        "department_name": "信息中心",
        "count": 300,
        "value": 10000000.00
      }
    ],
    "recent_additions": 25,
    "recent_scrapped": 5
  }
}
```

---

### 资产价值统计

```
GET /api/assets/statistics/value
```

**标签:** 资产管理

**响应示例 (200):**

```json
{
  "success": true,
  "data": {
    "total_acquisition_value": 50000000.00,
    "total_net_value": 35000000.00,
    "total_depreciation": 15000000.00,
    "depreciation_rate": 0.30,
    "monthly_depreciation": 250000.00,
    "value_trend": [
      {
        "month": "2026-01",
        "net_value": 36000000.00
      },
      {
        "month": "2026-02",
        "net_value": 35500000.00
      }
    ]
  }
}
```

---

## 资产标签管理

### 标签模板列表

```
GET /api/asset-labels/templates
```

**标签:** 资产标签

**响应示例 (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "标准资产标签",
      "width": 40,
      "height": 20,
      "unit": "mm",
      "content": {
        "asset_code": true,
        "asset_name": true,
        "qr_code": true,
        "department": true,
        "acquisition_date": false
      },
      "is_default": true
    }
  ]
}
```

---

### 创建标签模板

```
POST /api/asset-labels/templates
```

**标签:** 资产标签

**权限:** 需要 `asset_admin`

**请求体:**

```json
{
  "name": "自定义标签",
  "width": 50,
  "height": 30,
  "unit": "mm",
  "content": {
    "asset_code": true,
    "asset_name": true,
    "qr_code": true,
    "location": true,
    "responsible_person": true
  }
}
```

---

### 打印资产标签

```
GET /api/asset-labels/print
```

**标签:** 资产标签

**查询参数:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| asset_ids | string | 是 | 资产ID列表 (逗号分隔) |
| template_id | integer | 否 | 模板ID |

**响应:** PDF 文件

---

## 资产图片管理

### 上传资产图片

```
POST /api/asset-images/upload
```

**标签:** 资产管理

**Content-Type:** `multipart/form-data`

**表单字段:**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| asset_id | integer | 是 | 资产ID |
| images | file | 是 | 图片文件（最多9张） |
| is_primary | boolean | 否 | 是否设为主图 |

---

### 获取资产图片

```
GET /api/assets/:id/images
```

**标签:** 资产管理

---

### 删除资产图片

```
DELETE /api/asset-images/:id
```

**标签:** 资产管理

---

## 资产位置管理

### 获取资产位置列表

```
GET /api/asset-location
```

**标签:** 资产管理

**查询参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| asset_id | integer | 资产ID |
| zone_id | integer | 区域ID |
| device_id | integer | 设备ID |

---

### 更新资产位置

```
PUT /api/asset-location/:asset_id
```

**标签:** 资产管理

**请求体:**

```json
{
  "zone_id": 1,
  "location": "A栋2层201室",
  "latitude": 30.5728,
  "longitude": 114.2526,
  "timestamp": "2026-03-28T10:00:00.000Z"
}
```

---

## 资产管理（闲置/调拨/报废）

### 申请资产调拨

```
POST /api/assets/:id/transfer-apply
```

**标签:** 资产调配

**权限:** 需要 `transfer_admin` 或资产所属部门管理员

**请求体:**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| target_department_id | integer | 是 | 目标部门ID |
| reason | string | 是 | 调拨原因 |
| expected_date | string | 否 | 期望日期 |

---

### 资产调拨列表

```
GET /api/transfers
```

**标签:** 资产调配

**查询参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| status | string | 状态 (pending/approved/rejected/completed) |
| source_department_id | integer | 源部门 |
| target_department_id | integer | 目标部门 |
| page | integer | 页码 |

**响应示例 (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "asset": {
        "id": 1,
        "asset_code": "A20260001",
        "asset_name": "联想笔记本"
      },
      "source_department": {
        "id": 1,
        "name": "信息中心"
      },
      "target_department": {
        "id": 2,
        "name": "财务部"
      },
      "status": "pending",
      "reason": "设备调配",
      "applicant": "张三",
      "applied_at": "2026-03-20T10:00:00.000Z"
    }
  ],
  "pagination": {...}
}
```

---

### 审批调拨

```
PUT /api/transfers/:id/approve
```

**标签:** 资产调配

**权限:** 需要 `transfer_admin`

**请求体:**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| approved | boolean | 是 | 是否批准 |
| comment | string | 否 | 审批意见 |

---

### 执行调拨

```
POST /api/transfers/:id/execute
```

**标签:** 资产调配

**权限:** 需要 `transfer_admin`

**说明:** 执行后资产所有权转移到目标部门

---

### 闲置资产列表

```
GET /api/idle-assets
```

**标签:** 资产调配

**说明:** 等同于 `GET /api/assets?status=闲置`

---

### 标记为闲置

```
POST /api/assets/:id/mark-idle
```

**标签:** 资产调配

**请求体:**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| reason | string | 否 | 闲置原因 |
| expected_reuse_date | string | 否 | 期望再次使用日期 |

---

### 申请报废

```
POST /api/assets/:id/scrapping-apply
```

**标签:** 资产调配

**请求体:**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| reason | string | 是 | 报废原因 |
| disposal_method | string | 否 | 处置方式 |
| estimated_value | number | 否 | 估计残值 |

---

### 报废审批

```
PUT /api/scrapping/:id/approve
```

**标签:** 资产调配

**权限:** 需要 `asset_admin`

---

## 库存管理

### 盘点计划列表

```
GET /api/inventory/plans
```

**标签:** 库存管理

**查询参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| status | string | 状态 |
| department_id | integer | 部门 |
| start_date_from | string | 开始日期起 |
| start_date_to | string | 开始日期止 |

---

### 创建盘点计划

```
POST /api/inventory/plans
```

**标签:** 库存管理

**权限:** 需要 `inventory_admin`

**请求体:**

```json
{
  "name": "2026年第一季度盘点",
  "department_id": 1,
  "start_date": "2026-04-01",
  "end_date": "2026-04-15",
  "type": "full",
  "assets_filter": {
    "category_ids": [1, 2, 3],
    "include_all": false
  },
  "assignees": [1, 2, 3]
}
```

---

### 执行盘点

```
POST /api/inventory/tasks/:id/self-check
```

**标签:** 库存管理

**请求体:**

```json
{
  "task_id": 1,
  "check_result": [
    {
      "asset_id": 1,
      "status": "matched",
      "actual_location": "办公楼301",
      "actual_condition": "良好",
      "notes": ""
    },
    {
      "asset_id": 2,
      "status": "missing",
      "notes": "未找到该资产"
    }
  ]
}
```

---

### 盘点差异列表

```
GET /api/inventory/discrepancies
```

**标签:** 库存管理

**查询参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| plan_id | integer | 盘点计划ID |
| type | string | 差异类型 (missing/surplus/damaged) |
| status | string | 状态 |

---

### 盘点统计

```
GET /api/inventory/statistics
```

**标签:** 库存管理

**响应示例 (200):**

```json
{
  "success": true,
  "data": {
    "total_plans": 10,
    "completed_plans": 8,
    "total_assets": 1500,
    "checked_assets": 1200,
    "match_rate": 0.95,
    "discrepancies": {
      "missing": 15,
      "surplus": 5,
      "damaged": 3
    }
  }
}
```

---

## 维修维护

### 维修日志列表

```
GET /api/maintenance/logs
```

**标签:** 维修维护

**查询参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| asset_id | integer | 资产ID |
| type | string | 维修类型 |
| start_date | string | 开始日期 |
| end_date | string | 结束日期 |
| technician | string | 维修人员 |
| page | integer | 页码 |

**响应示例 (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "asset": {
        "id": 1,
        "asset_code": "A20260001",
        "asset_name": "联想笔记本"
      },
      "type": "corrective",
      "description": "屏幕更换",
      "technician": "李师傅",
      "cost": 500.00,
      "status": "completed",
      "start_time": "2026-03-20T09:00:00.000Z",
      "end_time": "2026-03-20T12:00:00.000Z",
      "result": "维修完成"
    }
  ],
  "pagination": {...}
}
```

---

### 创建维修工单

```
POST /api/maintenance/workorders
```

**标签:** 维修维护

**请求体:**

```json
{
  "asset_id": 1,
  "type": "corrective",
  "priority": "high",
  "description": "设备无法开机",
  "reported_by": "张三",
  "assigned_to": 5,
  "scheduled_date": "2026-03-29",
  "estimated_hours": 4
}
```

---

### 工单列表

```
GET /api/maintenance/workorders
```

**标签:** 维修维护

**查询参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| status | string | 状态 (pending/in_progress/completed/cancelled) |
| priority | string | 优先级 (low/medium/high/urgent) |
| assigned_to | integer | 维修人员ID |
| page | integer | 页码 |

---

### 更新工单状态

```
PUT /api/maintenance/workorders/:id/status
```

**标签:** 维修维护

**请求体:**

```json
{
  "status": "in_progress",
  "actual_start_time": "2026-03-29T09:00:00.000Z",
  "notes": "已开始维修"
}
```

---

### 预防性维护计划列表

```
GET /api/maintenance/plans
```

**标签:** 维修维护

---

### 创建预防性维护计划

```
POST /api/maintenance/plans
```

**标签:** 维修维护

**请求体:**

```json
{
  "name": "季度设备保养",
  "asset_ids": [1, 2, 3],
  "frequency": "quarterly",
  "tasks": [
    {
      "name": "清洁保养",
      "description": "设备内外清洁",
      "estimated_hours": 2
    },
    {
      "name": "性能检测",
      "description": "关键指标检测",
      "estimated_hours": 1
    }
  ],
  "assigned_to": 5
}
```

---

### 维修申请列表

```
GET /api/maintenance/requests
```

**标签:** 维修维护

---

### 创建维修申请

```
POST /api/maintenance/requests
```

**标签:** 维修维护

**请求体:**

```json
{
  "asset_id": 1,
  "type": "repair",
  "urgency": "normal",
  "description": "设备故障描述",
  "contact_person": "张三",
  "contact_phone": "13800138000"
}
```

---

### 维修模板列表

```
GET /api/maintenance/templates
```

**标签:** 维修维护

---

### 维修成本统计

```
GET /api/maintenance/costs
```

**标签:** 维修维护

**查询参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| start_date | string | 开始日期 |
| end_date | string | 结束日期 |
| department_id | integer | 部门 |
| group_by | string | 分组方式 (month/department/asset_type) |

**响应示例 (200):**

```json
{
  "success": true,
  "data": {
    "total_cost": 50000.00,
    "by_category": {
      "维修材料": 20000.00,
      "人工费用": 25000.00,
      "外部服务": 5000.00
    },
    "by_month": [
      {
        "month": "2026-01",
        "cost": 15000.00
      },
      {
        "month": "2026-02",
        "cost": 18000.00
      }
    ],
    "top_assets": [
      {
        "asset_id": 1,
        "asset_name": "空调用",
        "total_cost": 5000.00
      }
    ]
  }
}
```

---

### 维修提醒列表

```
GET /api/maintenance/reminders
```

**标签:** 维修维护

**响应示例 (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "asset_id": 1,
      "asset_name": "联想笔记本",
      "type": "preventive",
      "due_date": "2026-04-01",
      "description": "季度保养",
      "status": "pending"
    }
  ]
}
```

---

## 质量管理

### 质量控制记录列表

```
GET /api/quality-control/records
```

**标签:** 质量管理

**查询参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| type | string | 记录类型 (inspection/calibration/verification) |
| status | string | 状态 |
| asset_id | integer | 资产ID |
| start_date | string | 开始日期 |
| end_date | string | 结束日期 |
| page | integer | 页码 |

---

### 创建质量控制记录

```
POST /api/quality-control/records
```

**标签:** 质量管理

**请求体:**

```json
{
  "asset_id": 1,
  "type": "calibration",
  "inspection_date": "2026-03-20",
  "result": "qualified",
  "next_inspection_date": "2027-03-20",
  "inspector": "王工程师",
  "equipment_used": "校准仪X1",
  "ambient_temperature": 23.5,
  "ambient_humidity": 45,
  "results": [
    {
      "parameter": "测量精度",
      "standard": "±0.01mm",
      "actual": "0.008mm",
      "verdict": "pass"
    }
  ],
  "notes": ""
}
```

---

### 质量统计

```
GET /api/quality-control/statistics
```

**标签:** 质量管理

**响应示例 (200):**

```json
{
  "success": true,
  "data": {
    "total_records": 500,
    "qualified_rate": 0.96,
    "by_type": {
      "inspection": 200,
      "calibration": 150,
      "verification": 150
    },
    "recent_trend": [
      {
        "month": "2026-01",
        "qualified_rate": 0.94
      },
      {
        "month": "2026-02",
        "qualified_rate": 0.95
      }
    ]
  }
}
```

---

## 质量计量

### 计量器具列表

```
GET /api/quality-control/metrology
```

**标签:** 质量计量

**查询参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| category | string | 器具类别 |
| status | string | 状态 (在用/送检/报废) |
| calibration_due | boolean | 是否到期送检 |

---

### 创建计量器具

```
POST /api/quality-control/metrology
```

**标签:** 质量计量

**请求体:**

```json
{
  "name": "电子天平",
  "model": "FA2004N",
  "serial_number": "SN2026001",
  "measurement_range": "0-200g",
  "accuracy_class": "E2",
  "location": "实验室01",
  "custodian": "张实验员",
  "calibration_interval": 12,
  "last_calibration_date": "2026-01-15",
  "next_calibration_date": "2027-01-15",
  "certificate_number": "2026-001"
}
```

---

### 送检记录

```
POST /api/quality-control/metrology/:id/calibration
```

**标签:** 质量计量

**请求体:**

```json
{
  "calibration_date": "2026-03-20",
  "calibration_lab": "市计量院",
  "result": "合格",
  "next_calibration_date": "2027-03-20",
  "certificate_number": "2026-0301",
  "cost": 500.00,
  "notes": ""
}
```

---

## 采购管理

### 采购需求列表

```
GET /api/procurement/requests
```

**标签:** 采购管理

**查询参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| status | string | 状态 (pending/approved/rejected/purchased/cancelled) |
| department_id | integer | 部门 |
| type | string | 采购类型 |
| page | integer | 页码 |

---

### 创建采购需求

```
POST /api/procurement/requests
```

**标签:** 采购管理

**权限:** 需要 `purchase_admin` 或部门负责人

**请求体:**

```json
{
  "title": "采购办公电脑",
  "type": "equipment",
  "department_id": 1,
  "applicant": "张三",
  "items": [
    {
      "name": "联想ThinkPad笔记本",
      "specification": "ThinkPad X1 Carbon",
      "quantity": 5,
      "unit": "台",
      "estimated_unit_price": 12000.00,
      "estimated_total_price": 60000.00,
      "intended_use": "员工办公使用"
    }
  ],
  "total_estimated_value": 60000.00,
  "expected_date": "2026-04-15",
  "reason": "现有设备老化，需要更新"
}
```

---

### 审批采购需求

```
PUT /api/procurement/requests/:id/approve
```

**标签:** 采购管理

**权限:** 需要 `purchase_admin` 或更高

**请求体:**

```json
{
  "approved": true,
  "approved_value": 58000.00,
  "comment": "同意采购，建议选择标配版"
}
```

---

### 执行采购

```
POST /api/procurement/requests/:id/execute
```

**标签:** 采购管理

**权限:** 需要 `purchase_admin`

**说明:** 执行后生成资产入库记录

---

## 验收管理

### 验收记录列表

```
GET /api/acceptance
```

**标签:** 验收管理

---

### 创建验收记录

```
POST /api/acceptance
```

**标签:** 验收管理

**请求体:**

```json
{
  "procurement_id": 1,
  "acceptance_date": "2026-03-20",
  "inspector": "李验收",
  "result": "qualified",
  "items": [
    {
      "asset_id": 100,
      "quality_check": true,
      "quantity_check": true,
      "specification_check": true,
      "notes": ""
    }
  ],
  "documents": ["验收单.pdf", "出厂合格证.pdf"],
  "notes": ""
}
```

---

### 资产验收

```
POST /api/acceptance/asset/:procurement_item_id
```

**标签:** 验收管理

---

## 部门与租户

### 部门列表

```
GET /api/departments
```

**标签:** 部门管理

**查询参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| parent_id | integer | 父部门ID |
| include_children | boolean | 是否包含子部门 |
| tree | boolean | 是否返回树形结构 |

**响应示例 (200) - tree=true:**

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "总公司",
      "code": "HQ",
      "parent_id": null,
      "children": [
        {
          "id": 2,
          "name": "信息中心",
          "code": "IT",
          "parent_id": 1,
          "children": []
        }
      ]
    }
  ]
}
```

---

### 创建部门

```
POST /api/departments
```

**标签:** 部门管理

**权限:** 需要 `system_admin`

**请求体:**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | 是 | 部门名称 |
| code | string | 是 | 部门代码（唯一） |
| parent_id | integer | 否 | 父部门ID |
| manager_id | integer | 否 | 部门经理ID |
| description | string | 否 | 描述 |

---

### 更新部门

```
PUT /api/departments/:id
```

**标签:** 部门管理

---

### 删除部门

```
DELETE /api/departments/:id
```

**标签:** 部门管理

**说明:** 如果部门下有用户或资产，则不允许删除

---

### 租户列表

```
GET /api/tenants
```

**标签:** 租户管理

**权限:** 需要 `super_admin`

**响应示例 (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "默认租户",
      "code": "DEFAULT",
      "status": "active",
      "modules": ["asset-management", "maintenance-management"],
      "max_users": 100,
      "current_users": 25,
      "expires_at": null,
      "created_at": "2026-01-01T00:00:00.000Z"
    }
  ]
}
```

---

### 创建租户

```
POST /api/tenants
```

**标签:** 租户管理

**权限:** 需要 `super_admin`

**请求体:**

```json
{
  "name": "新租户",
  "code": "NEW_TENANT",
  "modules": ["asset-management", "maintenance-management", "quality-control"],
  "max_users": 50,
  "expires_at": "2027-01-01"
}
```

---

### 更新租户

```
PUT /api/tenants/:id
```

**标签:** 租户管理

**权限:** 需要 `super_admin`

---

### 切换租户（超级管理员）

```
POST /api/tenants/switch
```

**标签:** 租户管理

**请求头:** `X-Tenant-ID: <target_tenant_id>`

**说明:** 超级管理员可切换到任意租户的操作上下文

---

## 角色权限

### 角色列表

```
GET /api/roles
```

**标签:** 角色权限

**响应示例 (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "code": "super_admin",
      "name": "超级管理员",
      "description": "系统最高权限",
      "permissions": ["*"],
      "is_system": true
    },
    {
      "id": 2,
      "code": "asset_admin",
      "name": "资产管理员",
      "description": "资产管理权限",
      "permissions": ["assets:*", "asset_categories:*"],
      "is_system": true
    }
  ]
}
```

---

### 创建角色

```
POST /api/roles
```

**标签:** 角色权限

**权限:** 需要 `system_admin`

**请求体:**

```json
{
  "name": "部门资产管理员",
  "code": "dept_asset_admin",
  "description": "部门级资产管理员",
  "permissions": [
    "assets:read",
    "assets:create",
    "assets:update",
    "assets:delete",
    "assets:transfer"
  ]
}
```

---

### 更新角色权限

```
PUT /api/roles/:id/permissions
```

**标签:** 角色权限

**权限:** 需要 `system_admin`

**请求体:**

```json
{
  "permissions": [
    "assets:read",
    "assets:create",
    "assets:update"
  ]
}
```

---

### 权限列表

```
GET /api/permissions
```

**标签:** 角色权限

**说明:** 返回系统中所有可用的权限定义

---

## 系统配置

### 获取系统配置

```
GET /api/system-config
```

**标签:** 系统管理

**查询参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| group | string | 配置分组 |

---

### 更新系统配置

```
PUT /api/system-config
```

**标签:** 系统管理

**权限:** 需要 `system_admin`

**请求体:**

```json
{
  "group": "asset",
  "settings": {
    "auto_generate_code": true,
    "code_prefix": "A",
    "default_depreciation_method": "straight_line",
    "approval_required_for_transfer": true
  }
}
```

---

### 审计日志列表

```
GET /api/audit-logs
```

**标签:** 系统管理

**查询参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| user_id | integer | 用户ID |
| action | string | 操作类型 |
| resource_type | string | 资源类型 |
| start_date | string | 开始日期 |
| end_date | string | 结束日期 |
| page | integer | 页码 |

**响应示例 (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "user": {
        "id": 1,
        "username": "admin",
        "display_name": "系统管理员"
      },
      "action": "asset.create",
      "resource_type": "asset",
      "resource_id": 100,
      "resource_name": "联想笔记本",
      "ip_address": "192.168.1.100",
      "user_agent": "Mozilla/5.0...",
      "changes": {
        "old": null,
        "new": { "asset_name": "联想笔记本" }
      },
      "timestamp": "2026-03-28T10:00:00.000Z"
    }
  ],
  "pagination": {...}
}
```

---

## 模块管理

### 获取已注册模块列表

```
GET /api/modules/list
```

**标签:** 模块管理

**响应示例 (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "code": "asset-management",
      "name": "资产管理",
      "version": "1.0.0",
      "description": "固定资产全生命周期管理",
      "status": "active",
      "dependencies": ["department-management"],
      "routes_count": 25,
      "menus": [
        {
          "name": "资产管理",
          "path": "/assets",
          "icon": "box"
        }
      ]
    }
  ]
}
```

---

### 获取模块详情

```
GET /api/modules/:code
```

**标签:** 模块管理

---

### 注册新模块

```
POST /api/modules/register
```

**标签:** 模块管理

**权限:** 需要 `super_admin`

**请求体:**

```json
{
  "code": "new-module",
  "name": "新模块",
  "version": "1.0.0",
  "description": "模块描述",
  "dependencies": [],
  "config": {}
}
```

---

### 获取模块配置列表

```
GET /api/module-configs
```

**标签:** 模块管理

**查询参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| module_code | string | 模块代码 |
| page | integer | 页码 |

---

### 创建模块配置

```
POST /api/module-configs
```

**标签:** 模块管理

**权限:** 需要 `system_admin`

**请求体:**

```json
{
  "module_code": "asset-management",
  "config_key": "custom_field_1",
  "config_value": {
    "type": "text",
    "label": "自定义字段1",
    "required": false
  },
  "description": "资产自定义字段配置"
}
```

---

### 更新模块配置

```
PUT /api/module-configs/:id
```

**标签:** 模块管理

**权限:** 需要 `system_admin`

---

### 删除模块配置

```
DELETE /api/module-configs/:id
```

**标签:** 模块管理

**权限:** 需要 `super_admin`

---

### 租户模块配置

```
GET /api/tenant-module-config/:tenant_id/:module_code
```

**标签:** 模块管理

**响应示例 (200):**

```json
{
  "success": true,
  "data": {
    "tenant_id": 1,
    "module_code": "asset-management",
    "config": {
      "enabled": true,
      "features": ["asset_create", "asset_transfer"],
      "limits": {
        "max_assets": 1000
      }
    }
  }
}
```

---

### 更新租户模块配置

```
POST /api/tenant-module-config
```

**标签:** 模块管理

**权限:** 需要 `system_admin`

**请求体:**

```json
{
  "tenant_id": 1,
  "module_code": "asset-management",
  "config": {
    "enabled": true,
    "features": ["asset_create", "asset_transfer", "asset_export"]
  }
}
```

---

## 物联网设备

### IoT设备列表

```
GET /api/iot/devices
```

**标签:** 物联网设备

**查询参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| type | string | 设备类型 (sensor/camera/gateway/beacon) |
| status | string | 状态 (online/offline/error) |
| zone_id | integer | 区域ID |
| page | integer | 页码 |

**响应示例 (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "device_code": "IOT-001",
      "name": "温湿度传感器A1",
      "type": "sensor",
      "model": "TH-100",
      "manufacturer": "XX传感",
      "status": "online",
      "zone_id": 1,
      "zone_name": "办公楼A栋",
      "location": "3层301室",
      "last_report": "2026-03-28T10:00:00.000Z",
      "battery_level": 85,
      "firmware_version": "1.2.3"
    }
  ],
  "pagination": {...}
}
```

---

### 创建设备

```
POST /api/iot/devices
```

**标签:** 物联网设备

**权限:** 需要 `iot_admin`

**请求体:**

```json
{
  "device_code": "IOT-002",
  "name": "新传感器",
  "type": "sensor",
  "model": "TH-100",
  "manufacturer": "XX传感",
  "zone_id": 1,
  "location": "位置描述",
  "install_date": "2026-03-20",
  "config": {
    "reporting_interval": 60,
    "thresholds": {
      "temperature": { "min": 15, "max": 35 },
      "humidity": { "min": 30, "max": 80 }
    }
  }
}
```

---

### 设备详情

```
GET /api/iot/devices/:id
```

**标签:** 物联网设备

---

### 更新设备

```
PUT /api/iot/devices/:id
```

**标签:** 物联网设备

---

### 删除设备

```
DELETE /api/iot/devices/:id
```

**标签:** 物联网设备

---

### 获取设备最新数据

```
GET /api/iot/devices/:id/latest-data
```

**标签:** 物联网设备

**响应示例 (200):**

```json
{
  "success": true,
  "data": {
    "device_id": 1,
    "timestamp": "2026-03-28T10:00:00.000Z",
    "values": {
      "temperature": 25.5,
      "humidity": 55.0
    },
    "status": "normal"
  }
}
```

---

### 获取设备历史数据

```
GET /api/iot/devices/:id/history
```

**标签:** 物联网设备

**查询参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| start_time | string | 开始时间 ISO8601 |
| end_time | string | 结束时间 ISO8601 |
| interval | string | 聚合间隔 (1m/5m/1h/1d) |

---

### 区域位置管理

```
GET /api/iot/zones
```

**标签:** 物联网设备

---

### 创建区域

```
POST /api/iot/zones
```

**标签:** 物联网设备

**请求体:**

```json
{
  "name": "办公楼A栋",
  "code": "BLDG-A",
  "parent_id": null,
  "description": "主办公楼",
  "boundary": {
    "type": "polygon",
    "coordinates": [[114.25, 30.57], [114.26, 30.57], [114.26, 30.58], [114.25, 30.58]]
  }
}
```

---

### 资产位置监控

```
GET /api/iot/asset-monitoring
```

**标签:** 物联网设备

**说明:** 获取资产实时位置监控数据

---

### 资产位置历史

```
GET /api/iot/asset-monitoring/:asset_id/history
```

**标签:** 物联网设备

**查询参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| start_time | string | 开始时间 |
| end_time | string | 结束时间 |

---

### 环境监测数据

```
GET /api/iot/environment-monitoring
```

**标签:** 物联网设备

**查询参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| zone_id | integer | 区域 |
| type | string | 监测类型 (temperature/humidity/air_quality) |
| start_date | string | 开始日期 |
| end_date | string | 结束日期 |

---

### 位置告警列表

```
GET /api/location-alerts
```

**标签:** 物联网设备

**响应示例 (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "alert_type": "asset_leave_zone",
      "asset_id": 1,
      "asset_name": "重要设备",
      "zone_name": "允许区域",
      "location": { "lat": 30.57, "lng": 114.25 },
      "message": "资产离开允许区域",
      "level": "warning",
      "status": "acknowledged",
      "created_at": "2026-03-28T09:00:00.000Z"
    }
  ]
}
```

---

### 告警详情

```
GET /api/location-alerts/:id
```

**标签:** 物联网设备

---

### 确认告警

```
PUT /api/location-alerts/:id/acknowledge
```

**标签:** 物联网设备

**请求体:**

```json
{
  "comment": "已安排人员核实"
}
```

---

## 技术文档

### 文档列表

```
GET /api/technical-documents
```

**标签:** 技术文档

**查询参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| category | string | 文档类别 |
| asset_id | integer | 关联资产ID |
| search | string | 搜索关键词 |
| page | integer | 页码 |

---

### 上传文档

```
POST /api/technical-documents/upload
```

**标签:** 技术文档

**Content-Type:** `multipart/form-data`

**表单字段:**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| file | file | 是 | 文档文件 |
| name | string | 是 | 文档名称 |
| category | string | 是 | 文档类别 |
| asset_id | integer | 否 | 关联资产ID |
| tags | string | 否 | 标签（逗号分隔） |

---

### 获取文档

```
GET /api/technical-documents/:id
```

**标签:** 技术文档

---

### 下载文档

```
GET /api/technical-documents/:id/download
```

**标签:** 技术文档

---

### 更新文档

```
PUT /api/technical-documents/:id
```

**标签:** 技术文档

---

### 删除文档

```
DELETE /api/technical-documents/:id
```

**标签:** 技术文档

---

### AI文档分析

```
POST /api/technical-documents-ai/analyze
```

**标签:** 技术文档

**请求体:**

```json
{
  "document_id": 1,
  "question": "这份设备说明书的主要维护要点是什么？"
}
```

---

## AI 助手

### 聊天补全

```
POST /api/ai/chat/completions
```

**标签:** AI助手

**说明:** 代理到 AI 网关服务，遵循 OpenAI Chat Completions 格式

**请求体:**

```json
{
  "model": "gpt-4",
  "messages": [
    {
      "role": "user",
      "content": "帮我分析一下这批资产的折旧情况"
    }
  ],
  "temperature": 0.7,
  "max_tokens": 1000
}
```

---

### 获取AI配置

```
GET /api/ai/config
```

**标签:** AI助手

**响应示例 (200):**

```json
{
  "success": true,
  "data": {
    "provider": "openai",
    "model": "gpt-4",
    "api_endpoint": "https://api.openai.com/v1",
    "features": ["asset_analysis", "maintenance_suggestions", "document_understanding"]
  }
}
```

---

### 资产AI分析

```
POST /api/asset-ai-analysis/analyze
```

**标签:** AI助手

**请求体:**

```json
{
  "asset_ids": [1, 2, 3],
  "analysis_type": "health_score"
}
```

**响应示例 (200):**

```json
{
  "success": true,
  "data": {
    "summary": "分析了3个资产，整体健康状况良好",
    "details": [
      {
        "asset_id": 1,
        "health_score": 85,
        "risk_level": "low",
        "suggestions": ["建议6个月后进行保养"]
      }
    ]
  }
}
```

---

### 维修AI助手

```
POST /api/maintenance-ai/diagnose
```

**标签:** AI助手

**请求体:**

```json
{
  "asset_id": 1,
  "symptoms": ["设备无法开机", "显示屏无显示"],
  "maintenance_history": "最近一次保养是3个月前"
}
```

---

## 数据备份

### 备份列表

```
GET /api/backup
```

**标签:** 系统管理

**权限:** 需要 `system_admin`

**响应示例 (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "filename": "backup_2026_03_28_100000.sql",
      "size": 15728640,
      "type": "full",
      "status": "completed",
      "created_by": "admin",
      "created_at": "2026-03-28T10:00:00.000Z"
    }
  ]
}
```

---

### 创建备份

```
POST /api/backup
```

**标签:** 系统管理

**权限:** 需要 `system_admin`

**请求体:**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| type | string | 否 | 备份类型 (full/incremental，默认full) |

---

### 恢复备份

```
POST /api/backup/:id/restore
```

**标签:** 系统管理

**权限:** 需要 `super_admin`

**说明:** 恢复操作会覆盖当前数据，执行前会创建临时备份

---

### 下载备份

```
GET /api/backup/:id/download
```

**标签:** 系统管理

**权限:** 需要 `system_admin`

---

### 删除备份

```
DELETE /api/backup/:id
```

**标签:** 系统管理

**权限:** 需要 `super_admin`

---

## 工作流引擎

### 工作流定义列表

```
GET /api/workflow/definitions
```

**标签:** 工作流引擎

---

### 创建工作流定义

```
POST /api/workflow/definitions
```

**标签:** 工作流引擎

**权限:** 需要 `system_admin`

**请求体:**

```json
{
  "name": "资产报废审批流",
  "key": "asset_scrapping_flow",
  "description": "资产报废多级审批流程",
  "version": 1,
  "nodes": [
    {
      "id": "start",
      "type": "start",
      "name": "开始"
    },
    {
      "id": "submit",
      "type": "userTask",
      "name": "提交申请",
      "assignee": "${initiator}"
    },
    {
      "id": "dept_approve",
      "type": "userTask",
      "name": "部门主管审批",
      "assignee": "${department_manager}"
    },
    {
      "id": "finance_approve",
      "type": "userTask",
      "name": "财务审批",
      "assignee": "finance_admin"
    },
    {
      "id": "end",
      "type": "end",
      "name": "结束"
    }
  ],
  "transitions": [
    { "from": "start", "to": "submit", "condition": null },
    { "from": "submit", "to": "dept_approve", "condition": null },
    { "from": "dept_approve", "to": "finance_approve", "condition": "approved" },
    { "from": "dept_approve", "to": "end", "condition": "rejected" },
    { "from": "finance_approve", "to": "end", "condition": null }
  ]
}
```

---

### 启动工作流实例

```
POST /api/workflow/instances
```

**标签:** 工作流引擎

**请求体:**

```json
{
  "definition_key": "asset_scrapping_flow",
  "business_key": "asset_scrapping_100",
  "variables": {
    "asset_id": 100,
    "reason": "设备老化",
    "initiator": "zhangsan"
  }
}
```

---

### 工作流实例列表

```
GET /api/workflow/instances
```

**标签:** 工作流引擎

**查询参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| definition_key | string | 工作流定义key |
| status | string | 状态 (running/completed/terminated) |
| page | integer | 页码 |

---

### 执行工作流任务

```
POST /api/workflow/tasks/:id/complete
```

**标签:** 工作流引擎

**请求体:**

```json
{
  "variables": {
    "approved": true,
    "comment": "同意报废"
  }
}
```

---

### 获取待办任务

```
GET /api/workflow/tasks/todo
```

**标签:** 工作流引擎

**说明:** 获取当前用户待处理的工作流任务

---

## 健康检查与监控

### 基本健康检查

```
GET /api/health
```

**标签:** 健康检查

**安全:** 无需认证

**响应示例 (200):**

```json
{
  "status": "healthy",
  "timestamp": "2026-03-28T10:00:00.000Z",
  "uptime": 86400
}
```

---

### 详细健康检查

```
GET /api/health/detailed
```

**标签:** 健康检查

**响应示例 (200):**

```json
{
  "status": "healthy",
  "components": {
    "database": { "status": "up", "latency_ms": 5 },
    "redis": { "status": "up", "latency_ms": 2 },
    "storage": { "status": "up" }
  },
  "memory": {
    "used": 536870912,
    "total": 2147483648,
    "percentage": 25
  }
}
```

---

### 就绪探针

```
GET /api/ready
```

**标签:** 健康检查

**说明:** Kubernetes 就绪探针

---

### 存活探针

```
GET /api/alive
```

**标签:** 健康检查

**说明:** Kubernetes 存活探针

---

### Prometheus指标

```
GET /api/metrics
```

**标签:** 健康检查

**说明:** Prometheus 格式的 metrics

---

### 熔断器状态

```
GET /api/circuit-breakers
```

**标签:** 健康检查

**响应示例 (200):**

```json
{
  "success": true,
  "data": {
    "ai-service": {
      "status": "closed",
      "failure_count": 0,
      "threshold": 5
    },
    "external-api": {
      "status": "open",
      "failure_count": 10,
      "last_failure": "2026-03-28T09:55:00.000Z"
    }
  }
}
```

---

### 重置熔断器

```
POST /api/circuit-breakers/:name/reset
```

**标签:** 健康检查

**权限:** 需要 `system_admin`

---

## 通用查询参数

以下参数适用于所有列表类 API：

| 参数 | 别名 | 类型 | 默认值 | 说明 |
|------|------|------|--------|------|
| page | pageNum, current | integer | 1 | 页码 |
| pageSize | size, limit, perPage | integer | 20 | 每页数量 |
| search | q, keyword | string | - | 搜索关键词 |
| sortField | sort_by, order_by | string | - | 排序字段 |
| sortOrder | sort_dir, order | string | desc | 排序方向 |
| start_date | date_from | string | - | 开始日期 |
| end_date | date_to | string | - | 结束日期 |

---

## 响应格式

### HTTP 状态码

| 状态码 | 说明 |
|--------|------|
| 200 | 成功 |
| 201 | 创建成功 |
| 204 | 删除成功（无返回内容） |
| 400 | 请求参数错误 |
| 401 | 未认证或 Token 过期 |
| 403 | 无权限访问 |
| 404 | 资源不存在 |
| 409 | 资源冲突（如编号已存在） |
| 429 | 请求过于频繁 |
| 500 | 服务器内部错误 |

### 错误代码

| code | 说明 |
|------|------|
| BAD_REQUEST | 请求参数错误 |
| UNAUTHORIZED | 未认证 |
| FORBIDDEN | 无权限 |
| NOT_FOUND | 资源不存在 |
| CONFLICT | 资源冲突 |
| RATE_LIMIT_EXCEEDED | 速率限制 |
| INTERNAL_ERROR | 服务器内部错误 |
| VALIDATION_ERROR | 数据验证失败 |
| DUPLICATE_ENTRY | 重复条目 |
| DEPENDENT_RESOURCE_EXISTS | 存在关联资源 |

---

## 附录：权限代码参考

| 权限代码 | 说明 |
|----------|------|
| `*` | 所有权限（仅 super_admin） |
| `users:*` | 用户管理所有权限 |
| `users:read` | 查看用户 |
| `users:create` | 创建用户 |
| `users:update` | 更新用户 |
| `users:delete` | 删除用户 |
| `assets:*` | 资产管理所有权限 |
| `assets:read` | 查看资产 |
| `assets:create` | 创建资产 |
| `assets:update` | 更新资产 |
| `assets:delete` | 删除资产 |
| `assets:transfer` | 调拨资产 |
| `assets:export` | 导出资产 |
| `assets:import` | 导入资产 |
| `maintenance:*` | 维修管理所有权限 |
| `maintenance:read` | 查看维修记录 |
| `maintenance:create` | 创建维修工单 |
| `quality:*` | 质量管理所有权限 |
| `procurement:*` | 采购管理所有权限 |
| `iot:*` | 物联网管理所有权限 |
| `system:*` | 系统管理所有权限 |
| `module:*` | 模块管理所有权限 |

---

## 附录：角色代码参考

| 角色代码 | 说明 | 默认权限 |
|----------|------|----------|
| `super_admin` | 超级管理员 | 所有权限 |
| `system_admin` | 系统管理员 | 系统配置、模块管理 |
| `asset_admin` | 资产管理员 | 资产管理全部权限 |
| `department_admin` | 部门管理员 | 本部门资产管理 |
| `maintenance_admin` | 维修管理员 | 维修管理全部权限 |
| `quality_admin` | 质量管理员 | 质量管理全部权限 |
| `procurement_admin` | 采购管理员 | 采购管理全部权限 |
| `inventory_admin` | 盘点管理员 | 库存管理全部权限 |
| `transfer_admin` | 调拨管理员 | 资产调拨审批 |
| `iot_admin` | IoT管理员 | 物联网管理 |
| `user` | 普通用户 | 查看权限 |
