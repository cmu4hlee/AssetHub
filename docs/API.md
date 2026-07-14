# AssetHub API 接口文档

> 资产管理系统 API 参考文档
> 
> **Base URL**: `http://localhost:5183/api`
> 
> **文档版本**: 1.0.0
> 
> **最后更新**: 2026-02-08

---

## 目录

- [认证](#认证)
- [用户管理](#用户管理)
- [资产管理](#资产管理)
- [维修管理](#维修管理)
- [资产调配](#资产调配)
- [闲置资产](#闲置资产)
- [AI助手](#ai助手)
- [错误码参考](#错误码参考)

---

## 认证

### 获取访问令牌

所有受保护的API接口都需要在请求头中携带JWT令牌。

```bash
POST /users/login
Content-Type: application/json

{
  "username": "su",
  "password": "123"
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 1,
      "username": "su",
      "role": "super_admin"
    }
  }
}
```

**请求示例 (cURL)**:
```bash
curl -X POST "http://localhost:5183/api/users/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"su","password":"123"}'
```

---

### 使用令牌

在后续请求中，通过 `Authorization` 请求头携带令牌：

```
Authorization: Bearer <your_token>
```

**示例**:
```bash
curl -X GET "http://localhost:5183/api/assets/TEST001" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

## 用户管理

### 用户登录

```bash
POST /users/login
```

**请求参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| username | string | 是 | 用户名 |
| password | string | 是 | 密码 |
| tenant_code | string | 否 | 企业代码（普通用户必填） |

**响应示例**:
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 1,
      "username": "su",
      "real_name": "超级管理员",
      "role": "super_admin",
      "status": "active"
    },
    "enterprises": [
      {
        "id": 1,
        "tenant_code": "default",
        "tenant_name": "第四医院2",
        "role": "super_admin"
      }
    ],
    "tokenExpiry": 2592000
  }
}
```

---

### 获取用户列表

```bash
GET /users/list
```

**请求头**:
| 参数 | 说明 |
|------|------|
| Authorization | Bearer Token |

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "username": "su",
      "real_name": "超级管理员",
      "email": null,
      "phone": null,
      "role": "super_admin",
      "status": "active",
      "last_login_at": "2026-02-08T06:54:56.000Z"
    }
  ]
}
```

---

## 资产管理

### 获取资产列表

```bash
GET /assets
```

**查询参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| page | number | 否 | 页码，默认1 |
| limit | number | 否 | 每页数量，默认20 |
| keyword | string | 否 | 搜索关键词 |
| status | string | 否 | 资产状态 |
| department_code | string | 否 | 部门代码 |
| category_id | number | 否 | 资产类别ID |

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "id": 26523,
      "tenant_id": 2,
      "asset_code": "TEST001",
      "asset_name": "测试资产",
      "category_name": "医疗设备",
      "category_secondary_name": "医疗影像设备",
      "brand": null,
      "model": null,
      "department": "测试部门",
      "department_new": "DEP90",
      "department_new_name": "手术室",
      "status": "维修",
      "purchase_date": "2023-12-31",
      "purchase_price": "1000.00"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150
  }
}
```

**请求示例 (cURL)**:
```bash
TOKEN="your_token_here"
curl -X GET "http://localhost:5183/api/assets?page=1&limit=10" \
  -H "Authorization: Bearer $TOKEN"
```

---

### 获取单个资产详情

```bash
GET /assets/:id
GET /assets/:asset_code
```

**路径参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string/number | 是 | 资产内部ID或asset_code |

**响应示例**:
```json
{
  "success": true,
  "data": {
    "id": 26523,
    "tenant_id": 2,
    "asset_code": "TEST001",
    "asset_name": "测试资产",
    "category_id": 1,
    "category_secondary_id": 5,
    "brand": null,
    "model": null,
    "specification": null,
    "purchase_date": "2023-12-31T16:00:00.000Z",
    "purchase_price": "1000.00",
    "current_value": null,
    "location": null,
    "department": "测试部门",
    "department_new": "DEP90",
    "department_new_name": "手术室",
    "use_department": null,
    "unit": null,
    "responsible_person": null,
    "status": "维修",
    "supplier": null,
    "warranty_period": null,
    "warranty_end_date": null,
    "remark": null,
    "created_at": "2026-01-27T07:03:51.000Z",
    "updated_at": "2026-01-28T03:31:30.000Z",
    "created_by": "系统管理员",
    "updated_by": "系统管理员",
    "asset_department_code": "DEP90",
    "category_name": "医疗设备",
    "category_secondary_name": "医疗影像设备"
  }
}
```

**请求示例 (cURL)**:
```bash
TOKEN="your_token_here"
# 使用ID
curl -X GET "http://localhost:5183/api/assets/26523" \
  -H "Authorization: Bearer $TOKEN"

# 使用asset_code
curl -X GET "http://localhost:5183/api/assets/TEST001" \
  -H "Authorization: Bearer $TOKEN"
```

---

### 创建资产

```bash
POST /assets
```

**请求头**:
| 参数 | 说明 |
|------|------|
| X-Tenant-ID | 租户ID（超级管理员必填） |

**请求体**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| asset_code | string | 否 | 资产编号（可自动生成） |
| asset_name | string | 是 | 资产名称 |
| category_id | number | 是 | 资产类别ID |
| brand | string | 否 | 品牌 |
| model | string | 否 | 型号 |
| specification | string | 否 | 规格 |
| purchase_date | string | 否 | 购买日期 |
| purchase_price | number | 否 | 购买价格 |
| department_new | string | 否 | 部门代码 |
| location | string | 否 | 存放位置 |
| responsible_person | string | 否 | 责任人 |
| status | string | 否 | 状态 |
| remark | string | 否 | 备注 |

**请求示例**:
```json
{
  "asset_name": "新资产",
  "category_id": 1,
  "brand": "品牌A",
  "model": "型号X",
  "purchase_price": 5000.00,
  "department_new": "DEP01"
}
```

**响应示例**:
```json
{
  "success": true,
  "message": "资产创建成功",
  "data": {
    "id": 26525,
    "asset_code": "AST20260208001",
    "asset_name": "新资产",
    "created_at": "2026-02-08T10:00:00.000Z"
  }
}
```

---

### 更新资产

```bash
PUT /assets/:id
```

**路径参数**:
| 参数 | 必填 | 说明 |
|------|------|------|
| id | 是 | 资产内部ID |

**请求体** (部分字段更新):
```json
{
  "asset_name": "更新后的资产名称",
  "status": "在用",
  "responsible_person": "张三"
}
```

**响应示例**:
```json
{
  "success": true,
  "message": "资产更新成功"
}
```

---

### 删除资产

```bash
DELETE /assets/:id
```

**响应示例**:
```json
{
  "success": true,
  "message": "资产删除成功"
}
```

---

### 获取资产修改日志

```bash
GET /assets/:id/change-logs
```

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "id": 100,
      "change_type": "update",
      "field_name": "status",
      "old_value": "维修",
      "new_value": "在用",
      "changed_by": "系统管理员",
      "changed_at": "2026-02-08T10:30:00.000Z",
      "remark": "维修完成"
    }
  ]
}
```

---

### 资产调配申请

```bash
POST /assets/:id/transfer-apply
```

**请求体**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| target_department | string | 是 | 调入部门 |
| reason | string | 是 | 调配原因 |
| transfer_date | string | 是 | 调配日期 |

**请求示例**:
```json
{
  "target_department": "DEP02",
  "reason": "部门调整",
  "transfer_date": "2026-02-15"
}
```

**响应示例**:
```json
{
  "success": true,
  "message": "调配申请已提交",
  "data": {
    "id": 50,
    "asset_code": "TEST001",
    "status": "pending",
    "created_at": "2026-02-08T10:00:00.000Z"
  }
}
```

---

### 获取资产统计

```bash
GET /assets/statistics/overview
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "total_assets": 1000,
    "total_value": 5000000.00,
    "by_status": {
      "在用": 800,
      "维修": 50,
      "闲置": 100,
      "报废": 50
    },
    "by_category": [
      {
        "category_name": "医疗设备",
        "count": 300,
        "value": 2000000.00
      }
    ]
  }
}
```

---

### 获取部门资产统计

```bash
GET /assets/statistics/by-department
```

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "department_code": "DEP01",
      "department_name": "科室A",
      "total_assets": 150,
      "total_value": 500000.00
    },
    {
      "department_code": "DEP02",
      "department_name": "科室B",
      "total_assets": 200,
      "total_value": 800000.00
    }
  ]
}
```

---

### 资产导入模板下载

```bash
GET /assets/import-template
```

**响应**: Excel文件下载

---

### 资产导入

```bash
POST /assets/import
Content-Type: multipart/form-data
```

**表单参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| file | File | 是 | Excel文件 |
| import_mode | string | 否 | 导入模式（update/ignore） |

**响应示例**:
```json
{
  "success": true,
  "message": "资产导入成功",
  "data": {
    "total_rows": 100,
    "success_count": 98,
    "fail_count": 2,
    "fail_details": [
      {
        "row": 15,
        "error": "资产编号重复"
      }
    ]
  }
}
```

---

### 资产导出

```bash
GET /assets/export
```

**查询参数**:
| 参数 | 说明 |
|------|------|
| keyword | 搜索关键词 |
| status | 状态筛选 |
| department_code | 部门筛选 |
| export_format | 导出格式（excel/csv） |

**响应**: Excel/CSV文件下载

---

## 维修管理

### 获取维修日志列表

```bash
GET /maintenance/logs
```

**查询参数**:
| 参数 | 类型 | 说明 |
|------|------|------|
| page | number | 页码 |
| limit | number | 每页数量 |
| asset_code | string | 资产编号 |
| status | string | 状态 |
| start_date | string | 开始日期 |
| end_date | string | 结束日期 |

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "id": 100,
      "request_no": "WX20260208001",
      "asset_code": "TEST001",
      "asset_name": "测试资产",
      "maintenance_type": "故障维修",
      "maintenance_date": "2026-02-08",
      "maintenance_person": "李四",
      "maintenance_content": "更换零件",
      "maintenance_cost": 500.00,
      "status": "已完成"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 50
  }
}
```

---

### 创建维修日志

```bash
POST /maintenance/logs
```

**请求体**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| asset_code | string | 是 | 资产编号 |
| maintenance_type | string | 是 | 维修类型 |
| maintenance_date | string | 是 | 维修日期 |
| maintenance_person | string | 是 | 维修人员 |
| maintenance_content | string | 是 | 维修内容 |
| maintenance_cost | number | 否 | 维修成本 |
| maintenance_duration | number | 否 | 维修时长(小时) |
| parts_replaced | string | 否 | 更换部件 |
| status | string | 否 | 状态 |
| remark | string | 否 | 备注 |

**请求示例**:
```json
{
  "asset_code": "TEST001",
  "maintenance_type": "故障维修",
  "maintenance_date": "2026-02-08",
  "maintenance_person": "李四",
  "maintenance_content": "更换损坏的零件",
  "maintenance_cost": 300.00,
  "parts_replaced": "电机轴承",
  "status": "已完成"
}
```

---

### 获取维修模板列表

```bash
GET /maintenance/templates
```

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "定期保养",
      "maintenance_type": "定期保养",
      "check_items": ["外观检查", "功能测试", "清洁保养"],
      "standard_duration": 2,
      "estimated_cost": 100.00
    }
  ]
}
```

---

### 维修效率统计

```bash
GET /maintenance/efficiency/overview
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "total_requests": 500,
    "completed_requests": 450,
    "avg_response_time": 4.5,
    "avg_completion_time": 24.5,
    "by_type": {
      "故障维修": 300,
      "定期保养": 150,
      "预防性维护": 50
    }
  }
}
```

---

## 资产调配

### 获取调配列表

```bash
GET /transfers
```

**查询参数**:
| 参数 | 说明 |
|------|------|
| page | 页码 |
| limit | 每页数量 |
| status | 状态（pending/approved/rejected） |
| asset_code | 资产编号 |

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "id": 50,
      "asset_code": "TEST001",
      "asset_name": "测试资产",
      "current_department": "DEP01",
      "target_department": "DEP02",
      "reason": "部门调整",
      "status": "pending",
      "status_cn": "待审批",
      "transfer_date": "2026-02-15",
      "applicant": "张三",
      "created_at": "2026-02-08T10:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 10
  }
}
```

---

### 创建调配申请

```bash
POST /transfers
```

**请求体**:
```json
{
  "asset_code": "TEST001",
  "target_department": "DEP02",
  "reason": "部门调整",
  "transfer_date": "2026-02-15"
}
```

---

### 审批调配

```bash
PUT /transfers/:id/approve
```

**请求体**:
```json
{
  "action": "approve",
  "comment": "同意"
}
```

或拒绝:
```json
{
  "action": "reject",
  "comment": "不同意调配原因"
}
```

**响应示例**:
```json
{
  "success": true,
  "message": "调配审批成功"
}
```

---

### 完成调配

```bash
PUT /transfers/:id/complete
```

**响应示例**:
```json
{
  "success": true,
  "message": "调配已完成"
}
```

---

## 闲置资产

### 获取闲置资产列表

```bash
GET /idle
```

**查询参数**:
| 参数 | 说明 |
|------|------|
| page | 页码 |
| limit | 每页数量 |
| keyword | 搜索关键词 |
| category_id | 类别ID |

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "id": 30,
      "asset_code": "TEST002",
      "asset_name": "闲置设备",
      "category_name": "医疗设备",
      "publish_date": "2026-02-01",
      "publish_person": "王五",
      "status": "待调配",
      "remark": "可用状态"
    }
  ]
}
```

---

### 发布闲置资产

```bash
POST /idle
```

**请求体**:
```json
{
  "asset_code": "TEST002",
  "publish_person": "王五",
  "publish_date": "2026-02-01",
  "remark": "可用状态，设备良好"
}
```

---

### 调配闲置资产

```bash
PUT /idle/:id/allocate
```

**请求体**:
```json
{
  "target_department": "DEP03",
  "allocate_date": "2026-02-10",
  "comment": "调拨使用"
}
```

---

### 取消发布

```bash
PUT /idle/:id/cancel
```

---

## AI助手

### 初始化对话

```bash
POST /ai/maintenance/init
```

**响应示例**:
```json
{
  "success": true,
  "conversationId": "uuid-xxx-xxx",
  "message": "您好！我是资产助手...",
  "pendingRequests": {
    "repairs": [],
    "transfers": []
  }
}
```

---

### 发送消息

```bash
POST /ai/maintenance/message
```

**请求体**:
```json
{
  "conversationId": "uuid-xxx-xxx",
  "message": "我要报修 TEST001",
  "context": {},
  "history": []
}
```

**响应示例**:
```json
{
  "success": true,
  "response": "好的，我来帮您登记报修。请提供故障描述。",
  "intent": "repair_request",
  "maintenanceForm": {
    "asset_code": "TEST001"
  },
  "context": {
    "currentIntent": "repair_request"
  },
  "promptMessage": "请提供以下信息：故障描述"
}
```

---

### 获取待办

```bash
GET /ai/maintenance/pending
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "repairs": [
      {
        "id": 100,
        "request_no": "BX20260208001",
        "asset_code": "TEST001",
        "fault_description": "无法启动",
        "status": "pending",
        "request_date": "2026-02-08"
      }
    ],
    "transfers": [
      {
        "id": 50,
        "asset_code": "TEST002",
        "target_department": "DEP02",
        "status": "pending"
      }
    ]
  }
}
```

---

### 维修分析

```bash
GET /ai/maintenance/analysis
```

**查询参数**:
| 参数 | 说明 |
|------|------|
| type | 分析类型 |
| start_date | 开始日期 |
| end_date | 结束日期 |
| department | 部门 |

**响应示例**:
```json
{
  "success": true,
  "data": {
    "overview": {
      "total_requests": 100,
      "completed_requests": 90,
      "total_cost": 50000.00
    },
    "by_type": [
      {
        "maintenance_type": "故障维修",
        "count": 60,
        "cost": 35000.00
      }
    ]
  }
}
```

---

## 错误码参考

| 错误码 | 消息 | 说明 |
|--------|------|------|
| 1001 | 需要认证令牌 | 未提供或无效的Token |
| 1002 | 无效的令牌 | Token已过期或格式错误 |
| 1003 | 权限不足 | 用户无权限访问该资源 |
| 2001 | 参数错误 | 请求参数不完整或格式错误 |
| 2002 | 资源不存在 | 指定的资源ID不存在 |
| 2003 | 资源冲突 | 资源重复或状态不允许操作 |
| 3001 | 服务器错误 | 内部服务器错误 |
| 3002 | 服务不可用 | 服务暂时无法访问 |

---

## 通用响应格式

### 成功响应

```json
{
  "success": true,
  "message": "操作成功",
  "data": { ... }
}
```

### 分页响应

```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "total_pages": 5
  }
}
```

### 错误响应

```json
{
  "success": false,
  "message": "错误描述",
  "error": "ERROR_CODE",
  "code": 1001
}
```

---

## JavaScript SDK 示例

### 安装

```bash
npm install axios
```

### API 客户端封装

```javascript
import axios from 'axios';

const API_BASE = 'http://localhost:5183/api';

class AssetHubClient {
  constructor() {
    this.token = null;
    this.client = axios.create({
      baseURL: API_BASE,
      timeout: 30000,
    });
  }

  setToken(token) {
    this.token = token;
  }

  getHeaders() {
    const headers = {
      'Content-Type': 'application/json',
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  }

  async login(username, password) {
    const response = await this.client.post('/users/login', {
      username,
      password,
    });
    if (response.data.success) {
      this.setToken(response.data.data.token);
    }
    return response.data;
  }

  async getAssets(params = {}) {
    return this.client.get('/assets', {
      params,
      headers: this.getHeaders(),
    });
  }

  async getAssetDetail(idOrCode) {
    return this.client.get(`/assets/${idOrCode}`, {
      headers: this.getHeaders(),
    });
  }

  async createAsset(data) {
    return this.client.post('/assets', data, {
      headers: this.getHeaders(),
    });
  }

  async updateAsset(id, data) {
    return this.client.put(`/assets/${id}`, data, {
      headers: this.getHeaders(),
    });
  }

  async deleteAsset(id) {
    return this.client.delete(`/assets/${id}`, {
      headers: this.getHeaders(),
    });
  }

  async getMaintenanceLogs(params = {}) {
    return this.client.get('/maintenance/logs', {
      params,
      headers: this.getHeaders(),
    });
  }

  async getTransfers(params = {}) {
    return this.client.get('/transfers', {
      params,
      headers: this.getHeaders(),
    });
  }

  async approveTransfer(id, action, comment) {
    return this.client.put(`/transfers/${id}/approve`, { action, comment }, {
      headers: this.getHeaders(),
    });
  }

  async initAIConversation() {
    return this.client.post('/ai/maintenance/init', {}, {
      headers: this.getHeaders(),
    });
  }

  async sendAIMessage(conversationId, message, context = {}, history = []) {
    return this.client.post('/ai/maintenance/message', {
      conversationId,
      message,
      context,
      history,
    }, {
      headers: this.getHeaders(),
    });
  }
}

export default new AssetHubClient();
```

### 使用示例

```javascript
import api from './api';

async function main() {
  // 1. 登录
  const loginResult = await api.login('su', '123');
  console.log('登录成功:', loginResult);

  // 2. 获取资产列表
  const assets = await api.getAssets({ page: 1, limit: 10 });
  console.log('资产列表:', assets.data);

  // 3. 获取单个资产详情
  const asset = await api.getAssetDetail('TEST001');
  console.log('资产详情:', asset.data);

  // 4. 创建资产
  const newAsset = await api.createAsset({
    asset_name: '新设备',
    category_id: 1,
    purchase_price: 10000,
  });
  console.log('创建成功:', newAsset.data);

  // 5. 获取维修日志
  const logs = await api.getMaintenanceLogs({ asset_code: 'TEST001' });
  console.log('维修日志:', logs.data);

  // 6. AI对话
  const conversation = await api.initAIConversation();
  const aiResponse = await api.sendAIMessage(
    conversation.data.conversationId,
    '查资产 TEST001'
  );
  console.log('AI回复:', aiResponse.data);
}

main().catch(console.error);
```

---

## 附录

### 资产状态

| 状态 | 说明 |
|------|------|
| 在用 | 正常使用中 |
| 维修 | 维修中 |
| 闲置 | 闲置可用 |
| 报废 | 已报废 |
| 调配中 | 调配流程中 |

### 维修类型

| 类型 | 说明 |
|------|------|
| 故障维修 | 故障后的维修 |
| 定期保养 | 预防性维护 |
| 预防性维护 | 计划性维护 |
| 应急维修 | 紧急维修 |

---

**文档生成时间**: 2026-02-08
**AssetHub 版本**: 1.0.0
