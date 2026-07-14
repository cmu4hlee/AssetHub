# AssetHub 资产管理系统 API 完整文档

## 文档说明

本文档整理了 AssetHub 资产管理系统所有后台 API 接口，包含完整的接口地址、HTTP 方法、功能说明、请求参数和响应格式。

**基础配置：**
- 数据库地址：127.0.0.1
- 数据库端口：3306
- 数据库用户：root

---

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

#### GET /api/users/profile
**功能说明：** 获取当前登录用户信息

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

#### GET /api/departments/tree
**功能说明：** 获取部门树形结构

#### POST /api/departments
**功能说明：** 创建部门

#### PUT /api/departments/:id
**功能说明：** 更新部门信息

#### DELETE /api/departments/:id
**功能说明：** 删除部门

---

## 二、权限管理

### 2.1 角色管理

#### GET /api/roles-permissions/roles
**功能说明：** 获取角色列表

#### POST /api/roles-permissions/roles
**功能说明：** 创建角色

#### PUT /api/roles-permissions/roles/:role
**功能说明：** 更新角色

#### DELETE /api/roles-permissions/roles/:role
**功能说明：** 删除角色

### 2.2 权限配置

#### GET /api/roles-permissions/permissions/list
**功能说明：** 获取所有权限列表

#### GET /api/roles-permissions/permissions/definitions
**功能说明：** 获取权限定义列表

#### POST /api/roles-permissions/roles/:role/permissions
**功能说明：** 分配角色权限

#### PUT /api/roles-permissions/roles/:role/permissions
**功能说明：** 更新角色权限

#### PUT /api/roles-permissions/roles/permissions/batch
**功能说明：** 批量更新角色权限

---

## 三、租户管理

### 3.1 企业管理

#### GET /api/tenants
**功能说明：** 获取租户列表（仅系统管理员）

#### GET /api/tenants/:id
**功能说明：** 获取单个租户详情

#### POST /api/tenants
**功能说明：** 创建租户（仅超级管理员）

#### PUT /api/tenants/:id
**功能说明：** 更新租户信息

#### DELETE /api/tenants/:id
**功能说明：** 删除/停用租户

#### POST /api/tenants/verify
**功能说明：** 验证企业编码（登录第一步）

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
      "status": "在用",
      "purchase_price": 8000.00,
      "current_value": 6000.00,
      "department": "研发部",
      "location": "A栋101",
      "responsible_person": "张三"
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
**功能说明：** 获取单个资产详情（使用 asset_code）

#### POST /api/assets/search/advanced
**功能说明：** 高级资产搜索

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

---

### 4.3 资产分类

#### GET /api/assets/categories
**功能说明：** 获取资产分类列表

#### POST /api/assets/categories
**功能说明：** 创建资产分类

#### PUT /api/assets/categories/:id
**功能说明：** 更新资产分类

#### DELETE /api/assets/categories/:id
**功能说明：** 删除资产分类

---

### 4.4 资产导入导出

#### POST /api/assets/import
**功能说明：** 批量导入资产

**请求格式：** multipart/form-data

#### GET /api/assets/export
**功能说明：** 导出资产数据

#### GET /api/assets/export/template
**功能说明：** 下载导入模板

---

### 4.5 资产统计

#### GET /api/assets/statistics/overview
**功能说明：** 获取资产概览统计

#### GET /api/assets/statistics/by-department
**功能说明：** 按部门统计资产

#### GET /api/assets/statistics/depreciation
**功能说明：** 资产折旧统计

#### GET /api/assets/statistics/expiring-warranties
**功能说明：** 即将到期保修统计

---

### 4.6 资产调拨

#### GET /api/assets/transfers
**功能说明：** 获取资产调拨记录列表

#### GET /api/assets/transfers/:id
**功能说明：** 获取调拨记录详情

#### POST /api/assets/transfers
**功能说明：** 创建资产调拨申请

#### PUT /api/assets/transfers/:id/approve
**功能说明：** 审批调拨申请

#### PUT /api/assets/transfers/:id/complete
**功能说明：** 完成调拨执行

---

## 五、盘点管理

### 5.1 盘点记录

#### GET /api/inventory
**功能说明：** 获取盘点记录列表

#### GET /api/inventory/:id
**功能说明：** 获取盘点记录详情

#### POST /api/inventory
**功能说明：** 创建盘点记录

#### PUT /api/inventory/:id
**功能说明：** 更新盘点记录

#### DELETE /api/inventory/:id
**功能说明：** 删除盘点记录

#### PUT /api/inventory/:id/status
**功能说明：** 更新盘点状态

#### POST /api/inventory/:id/complete
**功能说明：** 完成盘点

---

### 5.2 盘点明细

#### POST /api/inventory/:id/details
**功能说明：** 添加盘点明细

#### POST /api/inventory/:id/details/batch
**功能说明：** 批量添加盘点明细

#### PUT /api/inventory/:id/details/:detailId
**功能说明：** 更新盘点明细

#### DELETE /api/inventory/:id/details/:detailId
**功能说明：** 删除盘点明细

#### GET /api/inventory/:id/statistics
**功能说明：** 获取盘点统计信息

---

### 5.3 自助盘点

#### GET /api/inventory/self/windows
**功能说明：** 获取当前可用的自助盘点窗口

#### GET /api/inventory/self/assets
**功能说明：** 获取我的盘点资产

#### POST /api/inventory/self/confirm
**功能说明：** 提交自助盘点确认

---

### 5.4 扫码盘点

#### POST /api/inventory/:id/scan
**功能说明：** 移动端扫码盘点

#### GET /api/inventory/:id/scan-logs
**功能说明：** 获取扫描历史

---

## 六、维护管理

### 6.1 维护计划

#### GET /api/maintenance/plans
**功能说明：** 获取维护计划列表

#### GET /api/maintenance/plans/:id
**功能说明：** 获取维护计划详情

#### POST /api/maintenance/plans
**功能说明：** 创建维护计划

#### PUT /api/maintenance/plans/:id
**功能说明：** 更新维护计划

#### DELETE /api/maintenance/plans/:id
**功能说明：** 删除维护计划

---

### 6.2 维护工单

#### GET /api/maintenance/workorders
**功能说明：** 获取维护工单列表

#### GET /api/maintenance/workorders/:id
**功能说明：** 获取工单详情

#### POST /api/maintenance/workorders
**功能说明：** 创建维护工单

#### PUT /api/maintenance/workorders/:id
**功能说明：** 更新工单

#### PUT /api/maintenance/workorders/:id/status
**功能说明：** 更新工单状态

---

### 6.3 维护日志

#### GET /api/maintenance/logs
**功能说明：** 获取维护日志列表

#### GET /api/maintenance/logs/:id
**功能说明：** 获取维护日志详情

#### POST /api/maintenance/logs
**功能说明：** 创建维护日志

#### PUT /api/maintenance/logs/:id
**功能说明：** 更新维护日志

#### DELETE /api/maintenance/logs/:id
**功能说明：** 删除维护日志

#### POST /api/maintenance/logs/:id/attachments
**功能说明：** 上传维护日志附件

#### GET /api/maintenance/statistics
**功能说明：** 获取维护统计信息

---

### 6.4 维护请求

#### GET /api/maintenance/requests
**功能说明：** 获取维护请求列表

#### POST /api/maintenance/requests
**功能说明：** 创建维护请求

#### PUT /api/maintenance/requests/:id
**功能说明：** 更新维护请求

#### PUT /api/maintenance/requests/:id/process
**功能说明：** 处理维护请求

---

### 6.5 维护成本

#### GET /api/maintenance/costs
**功能说明：** 获取维护成本统计

#### GET /api/maintenance/costs/by-asset
**功能说明：** 按资产统计维护成本

#### GET /api/maintenance/costs/by-department
**功能说明：** 按部门统计维护成本

---

### 6.6 维修效率分析

#### GET /api/maintenance/efficiency/overview
**功能说明：** 获取维修效率概览

#### GET /api/maintenance/efficiency/response-time
**功能说明：** 获取维修响应时间统计

#### GET /api/maintenance/efficiency/technician
**功能说明：** 获取技术人员统计

#### GET /api/maintenance/efficiency/asset-frequency
**功能说明：** 获取资产维修频率统计

#### GET /api/maintenance/analysis/asset-history
**功能说明：** 获取资产维修历史分析

#### GET /api/maintenance/analysis/effectiveness-stats
**功能说明：** 获取维修效能统计

#### GET /api/maintenance/analysis/cost-trend
**功能说明：** 获取维修费用趋势

#### GET /api/maintenance/analysis/technician-performance
**功能说明：** 获取维修人员绩效

#### GET /api/maintenance/analysis/type-distribution
**功能说明：** 获取维修类型分布

#### GET /api/maintenance/analysis/frequency
**功能说明：** 获取维修频率分析

---

### 6.7 维修模板

#### GET /api/maintenance/templates
**功能说明：** 获取维修模板列表

#### POST /api/maintenance/templates
**功能说明：** 创建维修模板

#### PUT /api/maintenance/templates/:id
**功能说明：** 更新维修模板

#### DELETE /api/maintenance/templates/:id
**功能说明：** 删除维修模板

#### GET /api/maintenance/templates/recommend
**功能说明：** 获取推荐模板

#### GET /api/maintenance/templates/recommend-by-asset
**功能说明：** 根据资产推荐模板

---

### 6.8 资产使用量

#### POST /api/maintenance/usage/update
**功能说明：** 更新资产使用量

#### GET /api/maintenance/usage/history
**功能说明：** 获取使用量历史

#### GET /api/maintenance/usage/statistics
**功能说明：** 获取使用量统计

#### GET /api/maintenance/usage/check-thresholds
**功能说明：** 检查是否达到维护阈值

---

## 七、质量控制

### 7.1 计量管理

#### GET /api/quality-control/metrology
**功能说明：** 获取计量记录列表

#### GET /api/quality-control/metrology/:id
**功能说明：** 获取计量记录详情

#### POST /api/quality-control/metrology
**功能说明：** 创建计量记录

#### PUT /api/quality-control/metrology/:id
**功能说明：** 更新计量记录

#### DELETE /api/quality-control/metrology/:id
**功能说明：** 删除计量记录

#### GET /api/quality-control/metrology/statistics
**功能说明：** 获取计量统计

#### GET /api/quality-control/metrology/expiring
**功能说明：** 获取即将到期计量记录

---

### 7.2 质量控制

#### GET /api/quality-control
**功能说明：** 获取质量控制记录列表

#### GET /api/quality-control/:id
**功能说明：** 获取质量控制记录详情

#### POST /api/quality-control
**功能说明：** 创建质量控制记录

#### PUT /api/quality-control/:id
**功能说明：** 更新质量控制记录

#### DELETE /api/quality-control/:id
**功能说明：** 删除质量控制记录

#### GET /api/quality-control/statistics
**功能说明：** 获取质量控制统计

---

## 八、调配管理

### 8.1 调配记录

#### GET /api/transfer
**功能说明：** 获取调配记录列表

#### GET /api/transfer/:id
**功能说明：** 获取调配记录详情

#### POST /api/transfer
**功能说明：** 创建调配记录

#### PUT /api/transfer/:id/approve
**功能说明：** 审批调配申请

#### PUT /api/transfer/:id/complete
**功能说明：** 完成调配执行

#### DELETE /api/transfer/:id
**功能说明：** 删除调配记录

#### GET /api/transfer/statistics
**功能说明：** 获取调配统计汇总

---

## 九、报废管理

### 9.1 报废记录

#### GET /api/scrapping
**功能说明：** 获取报废记录列表

#### GET /api/scrapping/:id
**功能说明：** 获取报废记录详情

#### POST /api/scrapping
**功能说明：** 创建报废申请

#### PUT /api/scrapping/:id
**功能说明：** 更新报废记录

#### DELETE /api/scrapping/:id
**功能说明：** 删除报废记录

---

### 9.2 报废流程

#### POST /api/scrapping/:id/appraise
**功能说明：** 提交鉴定结果

#### POST /api/scrapping/:id/approve
**功能说明：** 提交审批结果

#### POST /api/scrapping/:id/dispose
**功能说明：** 提交处置结果

#### POST /api/scrapping/:id/complete
**功能说明：** 完成处置

---

### 9.3 报废文件

#### POST /api/scrapping/:id/files
**功能说明：** 上传报废相关文件

---

### 9.4 报废统计

#### GET /api/scrapping/statistics/summary
**功能说明：** 获取报废统计汇总

---

## 十、技术文档

### 10.1 文档管理

#### GET /api/technical-documents
**功能说明：** 获取技术文档列表

#### GET /api/technical-documents/:id
**功能说明：** 获取文档详情

#### POST /api/technical-documents
**功能说明：** 上传技术文档

#### PUT /api/technical-documents/:id
**功能说明：** 更新文档信息

#### DELETE /api/technical-documents/:id
**功能说明：** 删除文档

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

---

### 10.5 分享链接

#### POST /api/technical-documents/:id/share
**功能说明：** 创建外部分享链接

#### GET /api/technical-documents/:id/shares
**功能说明：** 获取分享链接列表

#### DELETE /api/technical-documents/shares/:shareId
**功能说明：** 删除分享链接

---

### 10.6 外部上传

#### GET /api/technical-documents/upload/:token
**功能说明：** 验证分享令牌

#### POST /api/technical-documents/upload/:token
**功能说明：** 通过分享链接上传文件

---

## 十一、仪表盘

### 11.1 仪表盘数据

#### GET /api/dashboard
**功能说明：** 获取仪表盘统计数据

#### GET /api/dashboard/realtime
**功能说明：** 获取实时统计数据

---

## 十二、采购管理

### 12.1 采购申请

#### GET /api/procurement
**功能说明：** 获取采购申请列表

#### GET /api/procurement/:id
**功能说明：** 获取采购申请详情

#### POST /api/procurement
**功能说明：** 创建采购申请

#### PUT /api/procurement/:id
**功能说明：** 更新采购申请

#### DELETE /api/procurement/:id
**功能说明：** 删除采购申请

---

### 12.2 采购审批

#### POST /api/procurement/:id/approve
**功能说明：** 审批采购申请

#### POST /api/procurement/:id/budget-check
**功能说明：** 预算检查

---

### 12.3 采购文件

#### POST /api/procurement/:id/files
**功能说明：** 上传采购相关文件

---

### 12.4 采购统计

#### GET /api/procurement/statistics
**功能说明：** 获取采购统计

---

## 十三、物料管理

### 13.1 物料基础

#### GET /api/materials
**功能说明：** 获取物料列表

#### POST /api/materials
**功能说明：** 创建物料

#### PUT /api/materials/:id
**功能说明：** 更新物料

#### DELETE /api/materials/:id
**功能说明：** 删除物料

---

### 13.2 库存管理

#### GET /api/materials/inventory
**功能说明：** 获取库存列表

#### GET /api/materials/inventory/:id
**功能说明：** 获取库存详情

#### PUT /api/materials/inventory/:id
**功能说明：** 更新库存

---

### 13.3 入库管理

#### POST /api/materials/inventory/inbound
**功能说明：** 物料入库

#### GET /api/materials/inventory/inbound-records
**功能说明：** 获取入库记录列表

---

### 13.4 出库管理

#### POST /api/materials/inventory/outbound
**功能说明：** 物料出库

#### GET /api/materials/inventory/outbound-records
**功能说明：** 获取出库记录列表

---

### 13.5 库存预警

#### GET /api/materials/inventory/warnings
**功能说明：** 获取库存预警列表

---

### 13.6 库存事务

#### GET /api/materials/transactions
**功能说明：** 获取库存事务记录

---

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
    {"mode": "sqlbot", "name": "SQL 查询助手", "description": "通过自然语言生成 SQL 查询"},
    {"mode": "documents", "name": "文档分析助手", "description": "分析技术文档内容"},
    {"mode": "maintenance", "name": "维修助手", "description": "智能维修故障诊断"},
    {"mode": "search", "name": "智能搜索", "description": "语义化资产搜索"}
  ]
}
```

---

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

#### POST /api/ai-assistant/conversation
**功能说明：** 创建对话会话

#### GET /api/ai-assistant/conversation/:id
**功能说明：** 获取对话历史

---

### 14.3 资产 AI 分析

#### POST /api/asset-ai-analysis/analyze
**功能说明：** AI 资产分析

#### POST /api/asset-ai-analysis/predict
**功能说明：** AI 预测分析

---

### 14.4 技术文档 AI

#### POST /api/technical-documents/ai/analyze
**功能说明：** AI 分析技术文档

#### POST /api/technical-documents/ai/search
**功能说明：** AI 智能搜索文档

#### POST /api/technical-documents/ai/summary
**功能说明：** AI 生成文档摘要

---

## 十五、特种设备管理

### 15.1 合规模块特种设备

#### GET /api/compliance/special-equipment
**功能说明：** 获取特种设备列表

#### POST /api/compliance/special-equipment
**功能说明：** 添加特种设备

#### PUT /api/compliance/special-equipment/:id
**功能说明：** 更新特种设备信息

#### DELETE /api/compliance/special-equipment/:id
**功能说明：** 删除特种设备

---

### 15.2 独立特种设备模块

#### GET /api/special-equipment
**功能说明：** 获取特种设备列表（独立模块）

#### GET /api/special-equipment/:id
**功能说明：** 获取特种设备详情

#### POST /api/special-equipment
**功能说明：** 创建特种设备

#### PUT /api/special-equipment/:id
**功能说明：** 更新特种设备

#### DELETE /api/special-equipment/:id
**功能说明：** 删除特种设备

---

### 15.3 特种设备检验

#### GET /api/compliance/special-equipment/inspections
**功能说明：** 获取特种设备检验记录

#### POST /api/compliance/special-equipment/inspections
**功能说明：** 添加检验记录

#### GET /api/compliance/special-equipment/expiring-inspections
**功能说明：** 获取即将到期的检验

---

### 15.4 特种设备统计

#### GET /api/compliance/special-equipment/statistics/overview
**功能说明：** 获取特种设备统计概览

---

## 十六、安全检测管理

### 16.1 合规模块安全检测

#### GET /api/compliance/safety-inspections
**功能说明：** 获取安全检测记录列表

#### POST /api/compliance/safety-inspections
**功能说明：** 添加安全检测记录

#### PUT /api/compliance/safety-inspections/:id
**功能说明：** 更新安全检测记录

#### PUT /api/compliance/safety-inspections/:id/rectification
**功能说明：** 更新整改信息

#### DELETE /api/compliance/safety-inspections/:id
**功能说明：** 删除安全检测记录

---

### 16.2 独立安全检测模块

#### GET /api/safety-inspection
**功能说明：** 获取安全检测记录列表（独立模块）

#### GET /api/safety-inspection/expiring
**功能说明：** 获取即将到期的安全检测

#### GET /api/safety-inspection/:id
**功能说明：** 获取安全检测详情

#### POST /api/safety-inspection
**功能说明：** 创建安全检测记录

#### PUT /api/safety-inspection/:id
**功能说明：** 更新安全检测记录

#### DELETE /api/safety-inspection/:id
**功能说明：** 删除安全检测记录

---

### 16.3 安全检测预警

#### GET /api/compliance/safety-inspections/expiring
**功能说明：** 获取即将到期的安全检测

---

### 16.4 安全检测统计

#### GET /api/compliance/safety-inspections/statistics/overview
**功能说明：** 获取安全检测统计

---

## 十七、人员资质管理

### 17.1 合规模块人员资质

#### GET /api/compliance/staff-qualifications
**功能说明：** 获取人员资质列表

#### POST /api/compliance/staff-qualifications
**功能说明：** 添加人员资质

#### PUT /api/compliance/staff-qualifications/:id
**功能说明：** 更新人员资质

#### DELETE /api/compliance/staff-qualifications/:id
**功能说明：** 删除人员资质

#### GET /api/compliance/staff-qualifications/expiring
**功能说明：** 获取即将到期的人员资质

---

### 17.2 独立人员资质模块

#### GET /api/staff/qualifications
**功能说明：** 获取人员资质列表（独立模块）

#### GET /api/staff/qualifications/expiring
**功能说明：** 获取即将到期的人员资质

---

### 17.3 培训记录

#### GET /api/compliance/staff/training-records
**功能说明：** 获取培训记录列表

#### POST /api/compliance/staff/training-records
**功能说明：** 添加培训记录

---

### 17.4 资质统计

#### GET /api/compliance/staff/statistics
**功能说明：** 获取人员资质统计

---

## 十八、开机率统计

### 18.1 合规模块开机率

#### GET /api/compliance/uptime-statistics
**功能说明：** 获取开机率统计

#### POST /api/compliance/uptime-statistics/operation-logs
**功能说明：** 记录设备运行数据

#### GET /api/compliance/uptime-statistics/operation-logs
**功能说明：** 获取设备运行记录

#### POST /api/compliance/uptime-statistics/calculate
**功能说明：** 计算并更新开机率统计

#### POST /api/compliance/uptime-statistics/batch-operation-logs
**功能说明：** 批量录入运行数据

---

### 18.2 独立开机率模块

#### GET /api/uptime
**功能说明：** 获取开机率统计（独立模块）

#### GET /api/uptime/status
**功能说明：** 获取开机率状态

#### GET /api/uptime/config
**功能说明：** 获取开机率配置

---

## 十九、分级保养管理

### 19.1 保养模板

#### GET /api/compliance/maintenance-level/templates
**功能说明：** 获取分级保养模板列表

#### POST /api/compliance/maintenance-level/templates
**功能说明：** 创建分级保养模板

#### PUT /api/compliance/maintenance-level/templates/:id
**功能说明：** 更新保养模板

---

### 19.2 保养计划

#### GET /api/compliance/maintenance-level/plans
**功能说明：** 获取分级保养计划列表

#### POST /api/compliance/maintenance-level/plans/generate
**功能说明：** 生成分级保养计划

---

## 二十、资产折旧管理

### 20.1 折旧计算

#### GET /api/depreciation
**功能说明：** 获取资产折旧列表

#### GET /api/depreciation/depreciation/:id
**功能说明：** 获取资产折旧详情

---

### 20.2 折旧汇总

#### GET /api/depreciation/summary/by-department
**功能说明：** 按部门汇总折旧

#### GET /api/depreciation/summary/by-type
**功能说明：** 按资产类型汇总折旧

#### GET /api/depreciation/summary/by-month
**功能说明：** 按月统计折旧

---

### 20.3 折旧计算

#### POST /api/depreciation/calculate
**功能说明：** 执行折旧计算

#### GET /api/depreciation/export
**功能说明：** 导出折旧数据

#### GET /api/depreciation/methods
**功能说明：** 获取支持的折旧方法

---

## 二十一、闲置资产管理

### 21.1 闲置资产

#### GET /api/idle
**功能说明：** 获取闲置资产列表

#### POST /api/idle
**功能说明：** 标记资产为闲置

#### PUT /api/idle/:id
**功能说明：** 更新闲置资产信息

---

### 21.2 闲置资产再利用

#### POST /api/idle/:id/reuse
**功能说明：** 重新利用闲置资产

---

### 21.3 闲置统计

#### GET /api/idle/statistics
**功能说明：** 获取闲置资产统计

---

## 二十二、物联网设备管理

### 22.1 IoT 设备

#### GET /api/iot-devices
**功能说明：** 获取 IoT 设备列表

#### GET /api/iot-devices/:id
**功能说明：** 获取 IoT 设备详情

#### POST /api/iot-devices
**功能说明：** 注册 IoT 设备

#### PUT /api/iot-devices/:id
**功能说明：** 更新 IoT 设备

#### DELETE /api/iot-devices/:id
**功能说明：** 删除 IoT 设备

---

### 22.2 设备数据

#### GET /api/iot-devices/:id/data
**功能说明：** 获取 IoT 设备采集数据

#### POST /api/iot-devices/:id/commands
**功能说明：** 发送设备命令

---

## 二十三、条码管理

### 23.1 条码生成

#### GET /api/barcode-scan/generate/:asset_code
**功能说明：** 生成资产条码

---

### 23.2 条码验证

#### POST /api/barcode-scan/verify
**功能说明：** 验证条码

---

### 23.3 扫码盘点

#### POST /api/barcode-scan/inventory
**功能说明：** 通过扫描条码完成资产盘点

---

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

---

### 24.2 状态管理

#### GET /api/workflow/states
**功能说明：** 获取工作流状态定义

#### GET /api/workflow/transitions
**功能说明：** 获取状态迁移规则

---

### 24.3 状态迁移

#### POST /api/workflow/transition/:assetId
**功能说明：** 对指定资产执行状态迁移

---

## 二十五、审计日志

### 25.1 审计日志查询

#### GET /api/audit-logs
**功能说明：** 获取审计日志列表

#### GET /api/audit-logs/:id
**功能说明：** 获取审计日志详情

---

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

#### DELETE /api/integration-channels/channels/:channel
**功能说明：** 删除集成渠道

---

### 26.2 渠道测试

#### POST /api/integration-channels/channels/:channel/test
**功能说明：** 测试渠道连接

#### POST /api/integration-channels/channels/:channel/send-test
**功能说明：** 发送测试消息

---

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

---

### 27.2 同步源管理

#### GET /api/cloud-sync/sources
**功能说明：** 获取同步源列表

#### POST /api/cloud-sync/sources
**功能说明：** 创建同步源

#### PUT /api/cloud-sync/sources/:id
**功能说明：** 更新同步源

#### DELETE /api/cloud-sync/sources/:id
**功能说明：** 删除同步源

---

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

---

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

---

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

#### POST /api/backup
**功能说明：** 创建备份

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

#### PUT /api/location-codes/:id
**功能说明：** 更新位置编码

#### DELETE /api/location-codes/:id
**功能说明：** 删除位置编码

---

## 三十一、资产标签

### 31.1 标签模板管理

#### GET /api/asset-labels/templates
**功能说明：** 获取标签模板列表

#### GET /api/asset-labels/templates/:id
**功能说明：** 获取标签模板详情

#### POST /api/asset-labels/templates
**功能说明：** 创建标签模板

#### PUT /api/asset-labels/templates/:id
**功能说明：** 更新标签模板

#### DELETE /api/asset-labels/templates/:id
**功能说明：** 删除标签模板

---

### 31.2 标签生成

#### GET /api/asset-labels/generate-zpl/:templateId/:assetCode
**功能说明：** 生成单个资产的 ZPL 标签

#### POST /api/asset-labels/generate-zpl-batch
**功能说明：** 批量生成 ZPL 标签

---

### 31.3 标签打印

#### POST /api/asset-labels/print
**功能说明：** 批量打印资产标签

#### POST /api/asset-labels/printer/test-connection
**功能说明：** 测试打印机连接

#### GET /api/asset-labels/print-queue
**功能说明：** 获取打印队列

#### PUT /api/asset-labels/print-queue/:id/status
**功能说明：** 更新打印任务状态

---

## 三十二、页面浏览统计

### 32.1 浏览统计

#### GET /api/page-views/:pageKey
**功能说明：** 获取页面浏览量

#### POST /api/page-views/:pageKey
**功能说明：** 记录页面浏览

---

## 三十三、智能告警

### 33.1 告警列表

#### GET /api/intelligent-alerts
**功能说明：** 获取智能告警列表

#### GET /api/intelligent-alerts/overview
**功能说明：** 获取告警概览

---

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

---

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

---

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

## 三十六、增强技术文档

### 36.1 文档分类

#### GET /api/technical-documents-enhanced/categories
**功能说明：** 获取文档分类列表

#### POST /api/technical-documents-enhanced/categories
**功能说明：** 创建文档分类

#### PUT /api/technical-documents-enhanced/categories/:id
**功能说明：** 更新文档分类

#### DELETE /api/technical-documents-enhanced/categories/:id
**功能说明：** 删除文档分类

---

### 36.2 文档标签

#### GET /api/technical-documents-enhanced/tags
**功能说明：** 获取文档标签列表

#### POST /api/technical-documents-enhanced/tags
**功能说明：** 创建文档标签

#### DELETE /api/technical-documents-enhanced/tags/:id
**功能说明：** 删除文档标签

---

### 36.3 文档版本

#### GET /api/technical-documents-enhanced/documents/:id/versions
**功能说明：** 获取文档版本历史

#### POST /api/technical-documents-enhanced/documents/:id/versions
**功能说明：** 创建文档新版本

---

### 36.4 文档收藏

#### POST /api/technical-documents-enhanced/documents/:id/favorite
**功能说明：** 收藏文档

#### DELETE /api/technical-documents-enhanced/documents/:id/favorite
**功能说明：** 取消收藏

#### GET /api/technical-documents-enhanced/my/favorites
**功能说明：** 获取我的收藏

---

### 36.5 文档统计

#### GET /api/technical-documents-enhanced/statistics
**功能说明：** 获取文档统计

---

## 三十七、健康检查

### 37.1 系统健康

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

## 通用说明

### 认证方式

所有需要认证的接口都需要在请求头中携带 Token：

```
Authorization: Bearer <token>
```

对于多租户系统，还需要携带租户ID：

```
X-Tenant-Id: <tenant_id>
```

### 通用响应格式

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

### HTTP 状态码

| 状态码 | 说明 |
|--------|------|
| 200 | 成功 |
| 201 | 创建成功 |
| 400 | 请求参数错误 |
| 401 | 未认证 |
| 403 | 无权限 |
| 404 | 资源不存在 |
| 500 | 服务器错误 |

### 分页参数

所有列表接口支持分页：

| 参数名 | 类型 | 说明 |
|--------|------|------|
| page | int | 页码，默认1 |
| pageSize | int | 每页数量，默认20 |

### 日期格式

- 请求参数：YYYY-MM-DD 或 YYYY-MM-DD HH:mm:ss
- 响应格式：YYYY-MM-DD HH:mm:ss

---

## 常用状态值

### 资产状态

| 状态值 | 说明 |
|--------|------|
| 在用 | 正常使用中 |
| 闲置 | 暂时未使用 |
| 维修 | 正在维修中 |
| 报废 | 已报废 |
| 调配中 | 正在进行部门调配 |

### 维护状态

| 状态值 | 说明 |
|--------|------|
| pending | 待处理 |
| in_progress | 进行中 |
| completed | 已完成 |
| cancelled | 已取消 |

### 调配状态

| 状态值 | 说明 |
|--------|------|
| pending | 待审批 |
| approved | 已批准 |
| rejected | 已拒绝/已取消 |
| completed | 已完成 |

### 报废状态

| 状态值 | 说明 |
|--------|------|
| pending | 待处理 |
| appraising | 鉴定中 |
| approved | 已批准 |
| rejected | 已拒绝 |
| disposing | 处置中 |
| completed | 已完成 |

---

## 错误代码参考

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
