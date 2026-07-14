# AssetHub 维修维护 MCP 工具使用指南

**版本：** v1.0
**更新日期：** 2026-05-01
**适用版本：** AssetHub Enterprise

---

## 一、概览

AssetHub 提供了48个维修维护相关的MCP工具，涵盖以下功能：

| 功能模块 | 工具数量 | 说明 |
|---------|---------|------|
| 维修日志 | 4个 | 列表、创建、模板、效率统计 |
| 预防性维护 | 9个 | 计划管理全生命周期 |
| 维修工单 | 9个 | 工单管理全生命周期 |
| 故障维修申请 | 7个 | 申请管理全生命周期 |
| 维护提醒 | 5个 | 提醒管理 |
| 资产使用量 | 4个 | 使用量追踪和触发 |
| 工作流 | 10个 | 审批和状态管理 |

---

## 二、快速开始

### 2.1 配置要求

确保MCP服务器已正确配置：

```json
{
  "command": "/Users/cjlee/PJ/AssetHub/tools/mcp-assethub/mcp-assethub",
  "env": {
    "ASSETHUB_API_URL": "http://localhost:5183/api",
    "ASSETHUB_USERNAME": "zhangsan",
    "ASSETHUB_PASSWORD": "Abcd1234",
    "ASSETHUB_TOOL_PREFIX": "assethub"
  }
}
```

### 2.2 认证信息

**默认用户：** zhangsan
**角色：** 系统管理员
**租户：** 中国医科大学附属第四医院

---

## 三、核心功能示例

### 3.1 维修日志管理

#### 3.1.1 获取维修日志列表

```json
{
  "name": "list_maintenance_logs",
  "arguments": {
    "page": 1,
    "limit": 10,
    "asset_code": "000000555",
    "start_date": "2026-01-01",
    "end_date": "2026-05-01"
  }
}
```

**返回示例：**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "asset_code": "000000555",
      "maintenance_type": "故障维修",
      "maintenance_date": "2026-04-15",
      "maintenance_person": "张三",
      "maintenance_content": "设备检修",
      "maintenance_cost": 500.00
    }
  ]
}
```

#### 3.1.2 创建维修日志

```json
{
  "name": "create_maintenance_log",
  "arguments": {
    "asset_code": "000000555",
    "maintenance_type": "故障维修",
    "maintenance_date": "2026-05-01",
    "maintenance_person": "测试工程师",
    "maintenance_content": "常规检查",
    "maintenance_cost": 300.00,
    "maintenance_duration": 2.5,
    "parts_replaced": "配件A",
    "status": "已完成",
    "remark": "MCP工具测试"
  }
}
```

**注意：** 创建操作需要幂等性键，系统会自动处理。

---

### 3.2 预防性维护计划

#### 3.2.1 获取维护计划列表

```json
{
  "name": "list_maintenance_plans",
  "arguments": {
    "page": 1,
    "limit": 20,
    "status": "active"
  }
}
```

#### 3.2.2 创建维护计划

```json
{
  "name": "create_maintenance_plan",
  "arguments": {
    "asset_code": "000000555",
    "plan_name": "季度维护计划",
    "maintenance_type": "预防性维护",
    "cycle_type": "按季度",
    "cycle_value": 1,
    "next_maintenance_date": "2026-07-01",
    "maintenance_content": "设备全面检查",
    "responsible_person": "设备主管",
    "auto_generate_workorder": true
  }
}
```

#### 3.2.3 完成维护计划

```json
{
  "name": "complete_maintenance_plan",
  "arguments": {
    "id": 1,
    "maintenance_date": "2026-05-01",
    "maintenance_person": "工程师A",
    "maintenance_content": "已完成全部检查",
    "maintenance_cost": 500.00,
    "parts_replaced": "滤芯、润滑油",
    "actual_hours": 3.5,
    "maintenance_result": "合格"
  }
}
```

**功能：** 完成计划后会自动创建维修日志。

---

### 3.3 故障维修申请

#### 3.3.1 创建维修申请

```json
{
  "name": "create_maintenance_request",
  "arguments": {
    "asset_code": "000000555",
    "fault_description": "设备无法启动，显示屏黑屏",
    "fault_level": "紧急",
    "request_date": "2026-05-01",
    "request_department": "设备科",
    "contact_phone": "13800138000",
    "expected_repair_date": "2026-05-02",
    "remark": "影响生产"
  }
}
```

#### 3.3.2 审批维修申请

```json
{
  "name": "approve_maintenance_request",
  "arguments": {
    "id": 1,
    "approved": true,
    "comment": "同意维修"
  }
}
```

#### 3.3.3 完成维修申请

```json
{
  "name": "complete_maintenance_request",
  "arguments": {
    "id": 1,
    "repair_end_date": "2026-05-01",
    "repair_cost": 800.00,
    "repair_content": "更换电源模块",
    "parts_replaced": "电源模块A",
    "remark": "故障已排除"
  }
}
```

**功能：** 完成申请后会自动沉淀维修日志。

---

### 3.4 维修工单管理

#### 3.4.1 创建维修工单

```json
{
  "name": "create_maintenance_workorder",
  "arguments": {
    "asset_code": "000000555",
    "title": "设备年度检修",
    "description": "进行全面的设备检修和保养",
    "priority": 2,
    "planned_start_date": "2026-05-01",
    "planned_end_date": "2026-05-03",
    "estimated_hours": 16.0,
    "assigned_to": "工程师A"
  }
}
```

#### 3.4.2 分配工单

```json
{
  "name": "assign_workorder",
  "arguments": {
    "id": 1,
    "assigned_to": "工程师B"
  }
}
```

#### 3.4.3 完成工单

```json
{
  "name": "complete_workorder",
  "arguments": {
    "id": 1,
    "work_content": "已完成全部检修工作",
    "actual_hours": 15.5,
    "labor_cost": 1000.00,
    "outsourcing_cost": 0,
    "other_cost": 200.00
  }
}
```

---

### 3.5 维护提醒

#### 3.5.1 检查维护提醒

```json
{
  "name": "check_reminders",
  "arguments": {}
}
```

**返回：** 近期即将到期的维护计划提醒列表。

#### 3.5.2 配置提醒规则

```json
{
  "name": "config_reminder",
  "arguments": {
    "plan_id": 1,
    "reminder_days": 7,
    "reminder_types": ["email", "sms"],
    "recipient": "设备主管"
  }
}
```

---

### 3.6 资产使用量追踪

#### 3.6.1 记录使用量

```json
{
  "name": "create_usage_record",
  "arguments": {
    "asset_code": "000000555",
    "usage_date": "2026-05-01",
    "usage_value": 150.5,
    "usage_type": "运行时长",
    "cumulative_value": 5000.0,
    "operator": "操作员A"
  }
}
```

#### 3.6.2 查询使用量触发的维护

```json
{
  "name": "list_usage_triggered",
  "arguments": {
    "page": 1,
    "limit": 10,
    "status": "pending"
  }
}
```

---

## 四、常用场景

### 4.1 场景一：设备故障报修

**步骤：**
1. 创建维修申请 → `create_maintenance_request`
2. 审批申请 → `approve_maintenance_request`
3. 开始维修 → `start_maintenance_request`
4. 完成维修 → `complete_maintenance_request`（自动创建日志）

**工具调用顺序：**
```
create_maintenance_request
  ↓
approve_maintenance_request
  ↓
start_maintenance_request
  ↓
complete_maintenance_request
```

### 4.2 场景二：定期维护计划执行

**步骤：**
1. 检查提醒 → `check_reminders`
2. 创建工单 → `create_maintenance_workorder`
3. 分配工单 → `assign_workorder`
4. 开始工单 → `start_workorder`
5. 完成工单 → `complete_workorder`
6. 完成计划 → `complete_maintenance_plan`（自动更新计划）

**工具调用顺序：**
```
check_reminders
  ↓
create_maintenance_workorder
  ↓
assign_workorder
  ↓
start_workorder
  ↓
complete_workorder
  ↓
complete_maintenance_plan
```

### 4.3 场景三：使用量触发的维护

**步骤：**
1. 记录使用量 → `create_usage_record`
2. 查询触发记录 → `list_usage_triggered`
3. 处理触发 → `process_usage_triggered`

**工具调用顺序：**
```
create_usage_record
  ↓
list_usage_triggered
  ↓
process_usage_triggered
```

---

## 五、工具完整列表

### 5.1 维修日志 (4个)

| 工具名称 | 功能 | 必需参数 |
|---------|------|---------|
| `list_maintenance_logs` | 获取维修日志列表 | - |
| `create_maintenance_log` | 创建维修日志 | asset_code, maintenance_type, maintenance_date, maintenance_person, maintenance_content |
| `get_maintenance_templates` | 获取维修模板 | - |
| `get_maintenance_efficiency` | 获取维修效率统计 | - |

### 5.2 预防性维护 (9个)

| 工具名称 | 功能 | 必需参数 |
|---------|------|---------|
| `list_maintenance_plans` | 获取计划列表 | - |
| `get_maintenance_plan` | 获取计划详情 | id |
| `create_maintenance_plan` | 创建计划 | asset_code, plan_name, maintenance_type, cycle_type, cycle_value |
| `update_maintenance_plan` | 更新计划 | id |
| `complete_maintenance_plan` | 完成计划 | id |
| `delete_maintenance_plan` | 删除计划 | id |
| `get_maintenance_plan_history` | 获取历史 | id |
| `list_reminders` | 获取提醒 | - |
| `send_reminder` | 发送提醒 | plan_id, reminder_type |
| `config_reminder` | 配置提醒 | plan_id, reminder_days, reminder_types |
| `check_reminders` | 检查提醒 | - |

### 5.3 维修工单 (9个)

| 工具名称 | 功能 | 必需参数 |
|---------|------|---------|
| `list_maintenance_workorders` | 获取工单列表 | - |
| `get_maintenance_workorder` | 获取工单详情 | id |
| `create_maintenance_workorder` | 创建工单 | asset_code, title |
| `assign_workorder` | 分配工单 | id, assigned_to |
| `start_workorder` | 开始工单 | id |
| `complete_workorder` | 完成工单 | id |
| `close_workorder` | 关闭工单 | id |
| `cancel_workorder` | 取消工单 | id |
| `add_workorder_materials` | 添加材料 | id, materials |

### 5.4 故障维修申请 (7个)

| 工具名称 | 功能 | 必需参数 |
|---------|------|---------|
| `list_maintenance_requests` | 获取申请列表 | - |
| `get_maintenance_request` | 获取申请详情 | id |
| `create_maintenance_request` | 创建申请 | asset_code, fault_description |
| `approve_maintenance_request` | 审批申请 | id |
| `start_maintenance_request` | 开始维修 | id, repair_person |
| `complete_maintenance_request` | 完成维修 | id |
| `update_workorder_status` | 更新状态 | id, status |

### 5.5 资产使用量 (4个)

| 工具名称 | 功能 | 必需参数 |
|---------|------|---------|
| `list_usage_records` | 获取使用记录 | - |
| `create_usage_record` | 记录使用量 | asset_code, usage_date, usage_value, usage_type, cumulative_value |
| `list_usage_triggered` | 获取触发记录 | - |
| `process_usage_triggered` | 处理触发 | id |

---

## 六、最佳实践

### 6.1 幂等性处理

所有创建、更新、删除操作都支持幂等性：

1. **自动生成幂等性键**
   - 系统会自动为每个请求生成唯一键
   - 防止重复提交

2. **高风险操作确认**
   - 创建/修改/删除操作需要二次确认
   - 建议在前端实现确认对话框

### 6.2 错误处理

```javascript
try {
  const result = await callMCP('create_maintenance_request', data);

  if (result.success) {
    // 处理成功
    console.log('申请已创建:', result.data);
  } else {
    // 处理失败
    console.error('创建失败:', result.message);
  }
} catch (error) {
  // 处理异常
  console.error('请求异常:', error);
}
```

### 6.3 批量操作

对于批量操作，建议：
1. 单个操作使用单独的工具调用
2. 添加适当的延迟（如500ms）
3. 记录每个操作的结果

### 6.4 日志追踪

所有维修操作都会自动：
1. 创建审计日志
2. 记录操作人员
3. 记录操作时间
4. 记录操作结果

---

## 七、常见问题

### Q1: 创建操作返回428错误

**原因：** 高风险操作需要确认
**解决：** 需要实现幂等性键和确认令牌的二次请求流程

### Q2: 获取不到维修计划

**检查：**
1. 确认资产编号是否正确
2. 确认租户权限
3. 检查计划状态筛选条件

### Q3: 完成计划后没有自动创建日志

**检查：**
1. 确认计划ID正确
2. 确认完成参数完整
3. 检查系统日志

### Q4: 使用量触发不生效

**检查：**
1. 确认维护计划配置了使用量阈值
2. 确认触发类型设置为"使用量"或"两者"
3. 检查使用量记录的时间顺序

---

## 八、联系支持

如有问题，请联系：
- **技术支持：** asset-support@example.com
- **文档版本：** v1.0
- **最后更新：** 2026-05-01

---

**版权声明：** 本文档归AssetHub所有，保留所有权利。
