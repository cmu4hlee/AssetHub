# 高风险操作使用指南

**版本：** v1.0
**更新日期：** 2026-05-01
**作者：** Claude AI Assistant

---

## 一、概览

前端已实现完整的高风险操作处理机制，包括：

1. **幂等性键自动管理** - 防止重复提交
2. **高风险操作二次确认** - 用户确认后再执行
3. **统一的错误处理** - 规范化错误提示
4. **状态管理** - React Hook支持

---

## 二、快速开始

### 2.1 基础用法

#### 使用工具函数

```javascript
import { createMaintenanceLog } from '../utils/highRiskOperation';

// 创建维修日志
const result = await createMaintenanceLog({
  asset_code: '000000555',
  maintenance_type: '故障维修',
  maintenance_date: '2026-05-01',
  maintenance_person: '张三',
  maintenance_content: '设备检修',
  maintenance_cost: 500.00,
});

if (result.success) {
  message.success('创建成功');
  console.log('创建的日志ID:', result.data.id);
} else {
  message.error(result.error);
}
```

#### 使用React Hook

```jsx
import { useHighRiskOperation } from '../hooks/useHighRiskOperation';

function MyComponent() {
  const { createLog, loading, error } = useHighRiskOperation({
    onSuccess: (data) => {
      message.success('创建成功');
    },
    onError: (error) => {
      message.error('创建失败: ' + error.message);
    }
  });

  const handleCreate = async () => {
    await createLog({
      asset_code: '000000555',
      maintenance_type: '故障维修',
    });
  };

  return (
    <Button onClick={handleCreate} loading={loading}>
      创建维修日志
    </Button>
  );
}
```

---

## 三、API参考

### 3.1 工具函数

#### executeHighRiskOperation

通用高风险操作执行器。

**参数：**
```typescript
interface ExecuteOptions {
  method: 'POST' | 'PUT' | 'DELETE';
  url: string;
  data?: object;
  params?: object;
  headers?: object;
  confirmTitle?: string;
  confirmContent?: string;
  showConfirm?: boolean;
  onSuccess?: (data: any, result: any) => void;
  onError?: (error: Error, result: any) => void;
  beforeRequest?: () => void;
}
```

**返回值：**
```typescript
interface ExecuteResult {
  success: boolean;
  data?: any;
  message?: string;
  error?: string;
  cancelled?: boolean;
}
```

**示例：**
```javascript
const result = await executeHighRiskOperation({
  method: 'POST',
  url: '/maintenance/logs',
  data: {
    asset_code: '000000555',
    maintenance_type: '故障维修',
  },
  confirmTitle: '创建确认',
  confirmContent: '确定要创建这条记录吗？',
  showConfirm: true,
  onSuccess: (data) => {
    console.log('成功创建:', data);
  },
});
```

---

### 3.2 便捷方法

#### createMaintenanceLog

创建维修日志。

```javascript
import { createMaintenanceLog } from '../utils/highRiskOperation';

const result = await createMaintenanceLog({
  asset_code: '000000555',
  maintenance_type: '故障维修',
  maintenance_date: '2026-05-01',
  maintenance_person: '张三',
  maintenance_content: '设备检修',
  maintenance_cost: 500.00,
  maintenance_duration: 2.5,
  parts_replaced: '配件A',
  status: '已完成',
  remark: '备注信息',
});
```

#### createMaintenancePlan

创建预防性维护计划。

```javascript
import { createMaintenancePlan } from '../utils/highRiskOperation';

const result = await createMaintenancePlan({
  asset_code: '000000555',
  plan_name: '季度维护计划',
  maintenance_type: '预防性维护',
  cycle_type: '按季度',
  cycle_value: 1,
  next_maintenance_date: '2026-07-01',
  maintenance_content: '全面检查和保养',
  responsible_person: '设备主管',
  auto_generate_workorder: true,
});
```

#### createMaintenanceRequest

创建故障维修申请。

```javascript
import { createMaintenanceRequest } from '../utils/highRiskOperation';

const result = await createMaintenanceRequest({
  asset_code: '000000555',
  fault_description: '设备无法启动',
  fault_level: '紧急',
  request_date: '2026-05-01',
  request_department: '设备科',
  contact_phone: '13800138000',
  expected_repair_date: '2026-05-02',
});
```

#### createMaintenanceWorkOrder

创建维修工单。

```javascript
import { createMaintenanceWorkOrder } from '../utils/highRiskOperation';

const result = await createMaintenanceWorkOrder({
  asset_code: '000000555',
  title: '设备年度检修',
  description: '进行全面的设备检修和保养',
  priority: 2,
  planned_start_date: '2026-05-01',
  planned_end_date: '2026-05-03',
  estimated_hours: 16.0,
  assigned_to: '工程师A',
});
```

#### deleteMaintenanceLog

删除维修日志。

```javascript
import { deleteMaintenanceLog } from '../utils/highRiskOperation';

const result = await deleteMaintenanceLog(123, {
  showConfirm: true, // 默认true
  confirmTitle: '确认删除',
  confirmContent: '确定要删除这条维修日志吗？此操作不可恢复！',
});
```

#### deleteMaintenancePlan

删除预防性维护计划。

```javascript
import { deleteMaintenancePlan } from '../utils/highRiskOperation';

const result = await deleteMaintenancePlan(456);
```

#### approveMaintenanceRequest

审批维修申请。

```javascript
import { approveMaintenanceRequest } from '../utils/highRiskOperation';

// 批准
const approved = await approveMaintenanceRequest(789, true, '同意维修');

// 拒绝
const rejected = await approveMaintenanceRequest(790, false, '资料不全，退回补充');
```

---

## 四、React Hook

### 4.1 useHighRiskOperation

主要Hook，提供完整的状态管理和操作方法。

**参数：**
```typescript
interface UseOptions {
  showConfirm?: boolean;  // 默认是否显示确认对话框
  onSuccess?: (data: any, result: any) => void;
  onError?: (error: Error, result: any) => void;
}
```

**返回值：**
```typescript
interface UseReturn {
  // 状态
  loading: boolean;
  error: string | null;
  lastResult: any;
  isLoading: boolean;

  // 通用方法
  execute: (options: ExecuteOptions) => Promise<ExecuteResult>;

  // 维修日志
  createLog: (data: object, options?: object) => Promise<ExecuteResult>;
  deleteLog: (id: number, options?: object) => Promise<ExecuteResult>;

  // 预防性维护
  createPlan: (data: object, options?: object) => Promise<ExecuteResult>;
  deletePlan: (id: number, options?: object) => Promise<ExecuteResult>;

  // 故障维修申请
  createRequest: (data: object, options?: object) => Promise<ExecuteResult>;
  approveRequest: (id: number, approved: boolean, comment: string, options?: object) => Promise<ExecuteResult>;

  // 维修工单
  createWorkOrder: (data: object, options?: object) => Promise<ExecuteResult>;

  // 状态管理
  reset: () => void;
  clearError: () => void;
}
```

**示例：**
```jsx
import { useHighRiskOperation } from '../hooks/useHighRiskOperation';
import { Button, Space } from 'antd';

function MaintenanceLogForm() {
  const {
    createLog,
    createRequest,
    createPlan,
    loading,
    error,
    reset,
  } = useHighRiskOperation({
    showConfirm: false,
    onSuccess: (data) => {
      message.success('操作成功');
    },
    onError: (error) => {
      message.error('操作失败: ' + error.message);
    }
  });

  const handleSubmit = async (formData) => {
    const result = await createLog(formData);

    if (result.success) {
      reset(); // 重置状态
      // 刷新列表等操作
    }
  };

  return (
    <div>
      <Form onFinish={handleSubmit}>
        {/* 表单内容 */}
      </Form>

      {error && <Alert type="error" message={error} />}

      <Button htmlType="submit" loading={loading}>
        提交
      </Button>
    </div>
  );
}
```

### 4.2 useMaintenanceOperations

便捷Hook，简化常见操作。

```jsx
import { useMaintenanceOperations } from '../hooks/useHighRiskOperation';

function MyComponent() {
  const {
    createMaintenanceLog,
    createPreventivePlan,
    createFaultRequest,
    loading,
    error,
  } = useMaintenanceOperations();

  // 使用...
}
```

---

## 五、确认对话框

### 5.1 自动确认

某些操作（如删除）默认显示确认对话框：

```javascript
// 自动显示确认对话框
await deleteMaintenanceLog(123);
```

### 5.2 自定义确认

```javascript
await deleteMaintenanceLog(123, {
  showConfirm: true,
  confirmTitle: '危险操作',
  confirmContent: '这是一个危险操作，确定要继续吗？',
});
```

### 5.3 静默执行（不显示确认）

```javascript
await deleteMaintenanceLog(123, {
  showConfirm: false,
});
```

---

## 六、错误处理

### 6.1 基础错误处理

```javascript
const result = await createMaintenanceLog(data);

if (!result.success) {
  console.error('错误:', result.error);
}
```

### 6.2 回调错误处理

```javascript
const { createLog } = useHighRiskOperation({
  onError: (error, result) => {
    console.error('操作失败:', error.message);
    console.error('详细信息:', result);

    // 自定义错误处理
    if (result.status === 428) {
      message.warning('需要高风险确认');
    }
  }
});
```

### 6.3 取消操作

```javascript
const result = await createMaintenanceLog(data);

if (result.cancelled) {
  console.log('用户取消了操作');
}
```

---

## 七、最佳实践

### 7.1 表单提交

```jsx
import { useHighRiskOperation } from '../hooks/useHighRiskOperation';
import { Form, Input, Button, message } from 'antd';

function MaintenanceLogForm() {
  const [form] = Form.useForm();
  const { createLog, loading } = useHighRiskOperation({
    onSuccess: (data) => {
      message.success('创建成功');
      form.resetFields();
    },
    onError: (error) => {
      message.error('创建失败: ' + error.message);
    }
  });

  const handleSubmit = async (values) => {
    await createLog(values);
  };

  return (
    <Form form={form} onFinish={handleSubmit}>
      <Form.Item name="asset_code" label="资产编号">
        <Input />
      </Form.Item>
      {/* 其他表单项 */}
      <Form.Item>
        <Button type="primary" htmlType="submit" loading={loading}>
          提交
        </Button>
      </Form.Item>
    </Form>
  );
}
```

### 7.2 批量操作

```javascript
const { execute } = useHighRiskOperation();

const handleBatchDelete = async (ids) => {
  const results = [];

  for (const id of ids) {
    const result = await execute({
      method: 'DELETE',
      url: `/maintenance/logs/${id}`,
      showConfirm: true,
    });

    results.push(result);
  }

  const successCount = results.filter(r => r.success).length;
  message.success(`成功删除 ${successCount} 条记录`);
};
```

### 7.3 链式操作

```javascript
const { createRequest, approveRequest } = useHighRiskOperation();

const handleCompleteFlow = async (requestData) => {
  // 1. 创建申请
  const createResult = await createRequest(requestData);
  if (!createResult.success) return;

  // 2. 审批申请
  const approveResult = await approveRequest(
    createResult.data.id,
    true,
    '自动批准'
  );
  if (!approveResult.success) return;

  // 3. 流程完成
  message.success('申请和审批流程完成');
};
```

---

## 八、注意事项

### 8.1 幂等性

- 每次操作都会自动生成唯一的幂等性键
- 相同的幂等性键不会重复执行操作
- 幂等性键格式：`web-{timestamp}-{random}`

### 8.2 高风险确认

- 创建、更新、删除操作默认需要高风险确认
- 确认对话框显示后，用户必须确认才能继续
- 确认令牌有效期为5分钟

### 8.3 错误恢复

- 网络错误会自动重试（最多3次）
- 幂等性键确保重试不会重复创建
- 建议实现乐观更新以提升用户体验

### 8.4 性能考虑

- 避免在循环中频繁调用高风险操作
- 使用批量操作API（如果有）
- 考虑使用防抖和节流

---

## 九、完整示例

### 9.1 维修日志管理页面

```jsx
import React, { useState } from 'react';
import { Table, Button, Modal, message } from 'antd';
import { useHighRiskOperation } from '../hooks/useHighRiskOperation';

function MaintenanceLogList() {
  const [logs, setLogs] = useState([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const { deleteLog, loading } = useHighRiskOperation({
    onSuccess: () => {
      message.success('删除成功');
      // 刷新列表
    },
  });

  const handleDelete = async (id) => {
    const result = await deleteLog(id, {
      showConfirm: true,
      confirmTitle: '确认删除',
      confirmContent: '确定要删除这条记录吗？',
    });

    if (result.success) {
      setLogs(logs.filter(log => log.id !== id));
    }
  };

  const handleBatchDelete = async () => {
    for (const id of selectedRowKeys) {
      await deleteLog(id, { showConfirm: false });
    }
    setSelectedRowKeys([]);
  };

  const columns = [
    { title: '资产编号', dataIndex: 'asset_code' },
    { title: '维修类型', dataIndex: 'maintenance_type' },
    { title: '维修日期', dataIndex: 'maintenance_date' },
    { title: '维修人员', dataIndex: 'maintenance_person' },
    {
      title: '操作',
      render: (_, record) => (
        <Button
          type="link"
          danger
          onClick={() => handleDelete(record.id)}
          loading={loading}
        >
          删除
        </Button>
      ),
    },
  ];

  return (
    <div>
      {selectedRowKeys.length > 0 && (
        <Button
          type="primary"
          danger
          onClick={handleBatchDelete}
          loading={loading}
        >
          批量删除 ({selectedRowKeys.length})
        </Button>
      )}

      <Table
        dataSource={logs}
        columns={columns}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
      />
    </div>
  );
}

export default MaintenanceLogList;
```

---

## 十、联系支持

如有问题，请联系开发团队。

**文档版本：** v1.0
**最后更新：** 2026-05-01
