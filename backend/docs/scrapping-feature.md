# 资产报废功能文档

## 1. 功能概述

资产报废功能实现了完整的资产报废流程管理，包括申请、鉴定、审批、处置四个主要环节，支持文件上传、状态跟踪和统计分析。

## 2. 数据库结构

### 2.1 资产报废记录表 (asset_scrapping_records)

| 字段名 | 数据类型 | 描述 | 约束 |
|--------|----------|------|------|
| id | INT | 主键ID | AUTO_INCREMENT |
| asset_code | VARCHAR(50) | 资产编码 | NOT NULL |
| asset_name | VARCHAR(255) | 资产名称 | NOT NULL |
| asset_model | VARCHAR(255) | 资产型号 | |
| department | VARCHAR(100) | 使用部门 | |
| applicant | VARCHAR(100) | 申请人 | NOT NULL |
| applicant_id | INT | 申请人ID | |
| apply_date | DATETIME | 申请日期 | NOT NULL |
| scrapping_reason | TEXT | 报废原因 | NOT NULL |
| estimated_value | DECIMAL(10,2) | 预估残值 | |
| current_status | VARCHAR(50) | 当前状态 | NOT NULL DEFAULT 'pending' |
| appraiser | VARCHAR(100) | 鉴定人 | |
| appraisal_date | DATETIME | 鉴定日期 | |
| appraisal_result | TEXT | 鉴定结果 | |
| approver | VARCHAR(100) | 审批人 | |
| approval_date | DATETIME | 审批日期 | |
| approval_comment | TEXT | 审批意见 | |
| disposer | VARCHAR(100) | 处置人 | |
| disposal_date | DATETIME | 处置日期 | |
| disposal_method | VARCHAR(100) | 处置方式 | |
| disposal_result | TEXT | 处置结果 | |
| actual_value | DECIMAL(10,2) | 实际残值 | |
| remark | TEXT | 备注 | |
| created_at | TIMESTAMP | 创建时间 | NOT NULL DEFAULT CURRENT_TIMESTAMP |
| updated_at | DATETIME | 更新时间 | NOT NULL |
| tenant_id | INT | 租户ID | NOT NULL |

### 2.2 资产报废审批表 (asset_scrapping_approvals)

| 字段名 | 数据类型 | 描述 | 约束 |
|--------|----------|------|------|
| id | INT | 主键ID | AUTO_INCREMENT |
| scrapping_id | INT | 报废记录ID | NOT NULL, FOREIGN KEY |
| approver | VARCHAR(100) | 审批人 | NOT NULL |
| approver_id | INT | 审批人ID | |
| approval_level | INT | 审批级别 | NOT NULL DEFAULT 1 |
| approval_status | VARCHAR(50) | 审批状态 | NOT NULL DEFAULT 'pending' |
| approval_comment | TEXT | 审批意见 | |
| approval_date | DATETIME | 审批日期 | |
| created_at | TIMESTAMP | 创建时间 | NOT NULL DEFAULT CURRENT_TIMESTAMP |
| updated_at | DATETIME | 更新时间 | NOT NULL |

### 2.3 资产报废鉴定表 (asset_scrapping_appraisals)

| 字段名 | 数据类型 | 描述 | 约束 |
|--------|----------|------|------|
| id | INT | 主键ID | AUTO_INCREMENT |
| scrapping_id | INT | 报废记录ID | NOT NULL, FOREIGN KEY |
| appraiser | VARCHAR(100) | 鉴定人 | NOT NULL |
| appraiser_id | INT | 鉴定人ID | |
| appraisal_date | DATETIME | 鉴定日期 | NOT NULL |
| technical_condition | VARCHAR(100) | 技术状况 | |
| scrapping_necessity | VARCHAR(100) | 报废必要性 | |
| estimated_value | DECIMAL(10,2) | 预估残值 | |
| appraisal_result | TEXT | 鉴定结果 | NOT NULL |
| appraisal_attachments | TEXT | 鉴定附件 | |
| created_at | TIMESTAMP | 创建时间 | NOT NULL DEFAULT CURRENT_TIMESTAMP |
| updated_at | DATETIME | 更新时间 | NOT NULL |

### 2.4 资产报废处置表 (asset_scrapping_disposals)

| 字段名 | 数据类型 | 描述 | 约束 |
|--------|----------|------|------|
| id | INT | 主键ID | AUTO_INCREMENT |
| scrapping_id | INT | 报废记录ID | NOT NULL, FOREIGN KEY |
| disposer | VARCHAR(100) | 处置人 | NOT NULL |
| disposer_id | INT | 处置人ID | |
| disposal_date | DATETIME | 处置日期 | NOT NULL |
| disposal_method | VARCHAR(100) | 处置方式 | NOT NULL |
| disposal_company | VARCHAR(255) | 处置公司 | |
| actual_value | DECIMAL(10,2) | 实际残值 | |
| disposal_result | TEXT | 处置结果 | NOT NULL |
| disposal_attachments | TEXT | 处置附件 | |
| disposal_certificate | VARCHAR(255) | 处置证明 | |
| created_at | TIMESTAMP | 创建时间 | NOT NULL DEFAULT CURRENT_TIMESTAMP |
| updated_at | DATETIME | 更新时间 | NOT NULL |

### 2.5 资产报废文件表 (asset_scrapping_files)

| 字段名 | 数据类型 | 描述 | 约束 |
|--------|----------|------|------|
| id | INT | 主键ID | AUTO_INCREMENT |
| scrapping_id | INT | 报废记录ID | NOT NULL, FOREIGN KEY |
| file_type | VARCHAR(50) | 文件类型 | NOT NULL |
| file_name | VARCHAR(255) | 文件名 | NOT NULL |
| file_path | VARCHAR(500) | 文件路径 | NOT NULL |
| file_size | BIGINT | 文件大小 | |
| mime_type | VARCHAR(100) | 文件类型 | |
| uploaded_by | VARCHAR(100) | 上传人 | NOT NULL |
| uploaded_at | TIMESTAMP | 上传时间 | NOT NULL DEFAULT CURRENT_TIMESTAMP |

### 2.6 资产报废统计视图 (asset_scrapping_statistics)

用于统计不同状态的报废记录数量和价值。

## 3. API 端点

### 3.1 创建报废申请

- **URL**: `/api/scrapping`
- **方法**: POST
- **权限**: 需要认证
- **请求体**:
  ```json
  {
    "asset_code": "ASSET-001",
    "asset_name": "测试设备",
    "asset_model": "Model-A",
    "department": "技术部",
    "applicant": "张三",
    "applicant_id": 1,
    "scrapping_reason": "设备老化，无法正常使用",
    "estimated_value": 500,
    "remark": "备注信息"
  }
  ```
- **响应**:
  ```json
  {
    "success": true,
    "message": "报废申请创建成功",
    "data": { "id": 1 }
  }
  ```

### 3.2 获取报废记录列表

- **URL**: `/api/scrapping`
- **方法**: GET
- **权限**: 需要认证
- **查询参数**:
  - `page`: 页码，默认 1
  - `pageSize`: 每页数量，默认 10
  - `status`: 状态过滤
  - `asset_code`: 资产编码搜索
  - `start_date`: 开始日期
  - `end_date`: 结束日期
- **响应**:
  ```json
  {
    "success": true,
    "data": {
      "records": [...],
      "pagination": {
        "page": 1,
        "pageSize": 10,
        "total": 100,
        "totalPages": 10
      }
    }
  }
  ```

### 3.3 获取报废记录详情

- **URL**: `/api/scrapping/:id`
- **方法**: GET
- **权限**: 需要认证
- **响应**:
  ```json
  {
    "success": true,
    "data": {
      "id": 1,
      "asset_code": "ASSET-001",
      "asset_name": "测试设备",
      "current_status": "pending",
      "approvals": [...],
      "appraisals": [...],
      "disposals": [...],
      "files": [...]
    }
  }
  ```

### 3.4 更新报废记录

- **URL**: `/api/scrapping/:id`
- **方法**: PUT
- **权限**: 需要认证
- **请求体**:
  ```json
  {
    "asset_code": "ASSET-001",
    "asset_name": "测试设备",
    "scrapping_reason": "更新后的报废原因"
  }
  ```
- **响应**:
  ```json
  {
    "success": true,
    "message": "报废记录更新成功"
  }
  ```

### 3.5 提交鉴定结果

- **URL**: `/api/scrapping/:id/appraise`
- **方法**: POST
- **权限**: 需要认证
- **请求体**:
  ```json
  {
    "appraiser": "李四",
    "appraiser_id": 2,
    "technical_condition": "严重老化",
    "scrapping_necessity": "必要",
    "estimated_value": 300,
    "appraisal_result": "建议报废"
  }
  ```
- **响应**:
  ```json
  {
    "success": true,
    "message": "鉴定结果提交成功"
  }
  ```

### 3.6 提交审批结果

- **URL**: `/api/scrapping/:id/approve`
- **方法**: POST
- **权限**: 需要认证
- **请求体**:
  ```json
  {
    "approver": "王五",
    "approver_id": 3,
    "approval_status": "approved",
    "approval_comment": "同意报废",
    "approval_level": 1
  }
  ```
- **响应**:
  ```json
  {
    "success": true,
    "message": "审批结果提交成功"
  }
  ```

### 3.7 提交处置结果

- **URL**: `/api/scrapping/:id/dispose`
- **方法**: POST
- **权限**: 需要认证
- **请求体**:
  ```json
  {
    "disposer": "赵六",
    "disposer_id": 4,
    "disposal_method": "拍卖",
    "disposal_company": "某某拍卖公司",
    "actual_value": 200,
    "disposal_result": "已成功拍卖",
    "disposal_certificate": "cert-001"
  }
  ```
- **响应**:
  ```json
  {
    "success": true,
    "message": "处置结果提交成功"
  }
  ```

### 3.8 完成处置

- **URL**: `/api/scrapping/:id/complete`
- **方法**: POST
- **权限**: 需要认证
- **响应**:
  ```json
  {
    "success": true,
    "message": "处置完成成功"
  }
  ```

### 3.9 上传报废相关文件

- **URL**: `/api/scrapping/:id/files`
- **方法**: POST
- **权限**: 需要认证
- **请求体**: `multipart/form-data`
  - `file`: 文件
  - `file_type`: 文件类型 (application, appraisal, approval, disposal)
- **响应**:
  ```json
  {
    "success": true,
    "message": "文件上传成功",
    "data": {
      "id": 1,
      "file_name": "测试文件.pdf",
      "file_path": "/uploads/scrapping-files/123456.pdf",
      "file_size": 102400,
      "mime_type": "application/pdf"
    }
  }
  ```

### 3.10 获取报废统计数据

- **URL**: `/api/scrapping/statistics/summary`
- **方法**: GET
- **权限**: 需要认证
- **响应**:
  ```json
  {
    "success": true,
    "data": {
      "statusStats": [
        {
          "current_status": "pending",
          "count": 5,
          "total_estimated_value": 2500,
          "total_actual_value": 0
        }
      ],
      "totalStats": {
        "total_count": 10,
        "total_estimated_value": 5000,
        "total_actual_value": 2000
      }
    }
  }
  ```

### 3.11 删除报废记录

- **URL**: `/api/scrapping/:id`
- **方法**: DELETE
- **权限**: 需要认证
- **响应**:
  ```json
  {
    "success": true,
    "message": "报废记录删除成功"
  }
  ```

## 4. 状态流转

资产报废记录的状态流转如下：

1. **pending**: 待处理（初始状态）
2. **appraising**: 鉴定中
3. **approved**: 已批准
4. **rejected**: 已拒绝
5. **disposing**: 处置中
6. **completed**: 已完成

## 5. 权限控制

- **申请权限**: 所有登录用户
- **鉴定权限**: 资产管理员、系统管理员
- **审批权限**: 部门主管、系统管理员
- **处置权限**: 资产管理员、系统管理员
- **查看权限**: 所有登录用户（只能查看自己部门的记录）

## 6. 文件管理

支持上传以下类型的文件：

- **application**: 申请相关文件
- **appraisal**: 鉴定相关文件
- **approval**: 审批相关文件
- **disposal**: 处置相关文件

文件存储在 `backend/uploads/scrapping-files` 目录中，使用时间戳和随机字符串生成唯一文件名。

## 7. 审计日志

所有关键操作都会记录审计日志，包括：

- 创建报废申请
- 更新报废记录
- 提交鉴定结果
- 提交审批结果
- 提交处置结果
- 完成处置
- 上传文件
- 删除报废记录

## 8. 集成说明

### 8.1 前端集成

前端需要实现以下功能：

1. **报废申请表单**：收集资产信息、报废原因等
2. **报废记录列表**：支持状态过滤和搜索
3. **报废详情页面**：显示完整的报废流程信息
4. **鉴定表单**：提交技术鉴定结果
5. **审批表单**：处理审批流程
6. **处置表单**：记录处置结果
7. **文件上传组件**：支持上传相关文档
8. **统计报表**：展示报废统计数据

### 8.2 API 调用示例

```javascript
// 创建报废申请
const createScrapping = async (data) => {
  const response = await fetch('/api/scrapping', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(data)
  });
  return response.json();
};

// 提交审批结果
const approveScrapping = async (id, data) => {
  const response = await fetch(`/api/scrapping/${id}/approve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(data)
  });
  return response.json();
};
```

## 9. 注意事项

1. **数据一致性**：使用事务确保相关表的操作一致性
2. **文件安全**：上传的文件会进行安全检查，防止恶意文件
3. **权限控制**：严格的权限检查，确保只有授权用户才能执行相应操作
4. **状态管理**：严格的状态流转控制，防止非法状态变更
5. **性能优化**：添加了适当的索引，提高查询性能
6. **租户隔离**：支持多租户架构，确保数据隔离

## 10. 测试建议

1. **功能测试**：测试完整的报废流程，包括申请、鉴定、审批、处置
2. **边界测试**：测试各种边界情况，如空值、无效数据等
3. **权限测试**：测试不同角色的权限控制
4. **性能测试**：测试大量数据下的性能表现
5. **文件测试**：测试文件上传和管理功能

## 11. 故障排除

### 11.1 常见错误

1. **401 Unauthorized**：未提供认证令牌或令牌无效
2. **403 Forbidden**：没有权限执行该操作
3. **404 Not Found**：报废记录不存在
4. **400 Bad Request**：请求参数错误
5. **500 Internal Server Error**：服务器内部错误

### 11.2 排查步骤

1. 检查请求参数是否正确
2. 检查认证令牌是否有效
3. 检查用户权限是否足够
4. 检查数据库连接是否正常
5. 查看服务器日志获取详细错误信息

## 12. 总结

资产报废功能实现了完整的资产报废生命周期管理，从申请到处置的全流程跟踪，支持文件管理、权限控制和统计分析，为企业资产管理制度提供了重要的技术支持。