# 用户权限系统增强方案

## 概述

本文档描述了资产管理系统用户权限系统的增强改进，包括数据范围控制、权限继承、时间访问控制、审计日志等功能。

## 新增功能

### 1. 数据范围控制 (Data Scope Control)

**功能描述**: 控制用户可以访问的数据范围
- `all` - 全部数据
- `department` - 部门数据
- `own` - 本人数据
- `custom` - 自定义数据范围

**使用示例**:
```javascript
const { requireDataScope, dataScopes } = require('./middleware/enhanced-permissions');

// 需要全部数据权限
router.get('/assets', authenticate, requireDataScope(dataScopes.ALL, '资产'), async (req, res) => {
  // 可以访问所有数据
});
```

### 2. 操作权限控制 (Action Permissions)

**功能描述**: 细粒度的CRUD操作权限控制
- `create` - 创建
- `read` - 读取
- `update` - 更新
- `delete` - 删除
- `approve` - 审批
- `export` - 导出
- `import` - 导入

**使用示例**:
```javascript
const { requireAction, actions } = require('./middleware/enhanced-permissions');

// 需要删除权限
router.delete('/assets/:id', authenticate, requireAction(actions.DELETE, 'asset'), async (req, res) => {
  // 可以删除资产
});
```

### 3. 角色层级与权限继承 (Role Hierarchy)

**功能描述**: 子角色可以继承父角色的权限
- 超级管理员 -> 系统管理员 -> 资产管理员 -> 科室管理员 -> 普通用户

### 4. 时间访问控制 (Time-Based Access)

**功能描述**: 限制用户访问系统的时间
- 按小时限制 (如: 9-18点)
- 按星期限制 (如: 1-5工作日)

### 5. 用户权限覆盖 (User Permission Override)

**功能描述**: 可以为个别用户添加额外权限或拒绝特定权限
- 添加额外权限
- 拒绝权限
- 自定义菜单权限

### 6. 权限审计日志 (Permission Audit)

**功能描述**: 记录所有权限变更操作
- 权限授予
- 权限拒绝
- 权限移除
- 数据范围变更

## 新增数据库表

### 1. role_data_scopes
角色数据范围配置表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT | 主键 |
| role | VARCHAR(50) | 角色代码 |
| tenant_id | INT | 租户ID |
| data_scope | VARCHAR(20) | 数据范围 |
| custom_department_codes | TEXT | 自定义科室代码 |

### 2. user_data_scopes
用户数据范围配置表

### 3. user_permissions
用户权限表 (用于覆盖角色权限)

### 4. user_permission_denies
用户权限拒绝表

### 5. user_menu_permissions
用户菜单权限表

### 6. role_hierarchy
角色层级表

### 7. time_access_controls
时间访问控制表

### 8. permission_audit_logs
权限变更审计日志表

### 9. resource_permissions
资源权限定义表

### 10. data_filter_rules
数据过滤规则表

## API 接口

### 增强权限管理

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | /api/enhanced-permissions/data-scopes/definitions | 获取数据范围定义 | 认证用户 |
| GET | /api/enhanced-permissions/roles/:role/data-scope | 获取角色数据范围 | 认证用户 |
| PUT | /api/enhanced-permissions/roles/:role/data-scope | 设置角色数据范围 | 系统管理员 |
| GET | /api/enhanced-permissions/users/:userId/data-scope | 获取用户数据范围 | 认证用户 |
| PUT | /api/enhanced-permissions/users/:userId/data-scope | 设置用户数据范围 | 系统管理员 |
| GET | /api/enhanced-permissions/users/:userId/permissions | 获取用户所有权限 | 认证用户 |
| POST | /api/enhanced-permissions/users/:userId/permissions | 添加用户权限 | 系统管理员 |
| DELETE | /api/enhanced-permissions/users/:userId/permissions/:permission | 移除用户权限 | 系统管理员 |
| POST | /api/enhanced-permissions/users/:userId/permissions/deny | 拒绝用户权限 | 系统管理员 |
| DELETE | /api/enhanced-permissions/users/:userId/permissions/deny/:permission | 移除权限拒绝 | 系统管理员 |
| GET | /api/enhanced-permissions/users/:userId/menu-permissions | 获取用户菜单权限 | 认证用户 |
| POST | /api/enhanced-permissions/users/:userId/menu-permissions | 设置用户菜单权限 | 系统管理员 |
| DELETE | /api/enhanced-permissions/users/:userId/menu-permissions/:menuKey | 移除用户菜单权限 | 系统管理员 |
| GET | /api/enhanced-permissions/audit-logs | 获取权限审计日志 | 系统管理员 |
| GET | /api/enhanced-permissions/resource-permissions | 获取资源权限定义 | 认证用户 |

## 前端组件

### EnhancedPermissionManagement.jsx

用户增强权限管理页面，包括:
- 用户列表
- 权限管理 (查看/添加/移除/拒绝)
- 数据范围设置
- 审计日志查看

## 使用说明

### 1. 运行数据库迁移

```bash
cd /Users/cjlee/Desktop/Asset/backend
node migrations/20260207_enhanced_permissions.js
```

### 2. 重启后端服务

```bash
pkill -f "node server.js"
node server.js
```

### 3. 添加菜单入口

在系统管理菜单中添加增强权限管理入口。

### 4. 权限配置示例

```javascript
// 在路由中使用
const { authenticate, requireSystemAdmin } = require('./middleware/auth');
const { requireDataScope, requireAction, dataScopes, actions } = require('./middleware/enhanced-permissions');

// 需要全部数据权限的路由
router.get('/reports', authenticate, requireDataScope(dataScopes.ALL, '报表'), async (req, res) => {
  // 处理请求
});

// 需要审批权限的路由
router.post('/assets/:id/approve', authenticate, requireAction(actions.APPROVE, 'asset'), async (req, res) => {
  // 处理请求
});
```

## 测试用例

### 测试数据范围控制

```javascript
const test = async () => {
  // 创建测试用户
  const user = await createUser({ username: 'test_user', role: 'user' });
  
  // 设置数据范围为部门
  await enhancedPermissionsAPI.setUserDataScope(user.id, {
    data_scope: 'department',
    custom_department_codes: ['DEPT001', 'DEPT002']
  });
  
  // 验证数据范围
  const dataScope = await enhancedPermissionsAPI.getUserDataScope(user.id);
  console.log(dataScope.data_scope); // department
};
```

### 测试权限继承

```javascript
const test = async () => {
  // 获取用户的继承权限
  const permissions = await getUserAllPermissions(userId, tenantId, 'department_admin');
  console.log(permissions);
  // 应该包含 department_admin 和 asset_admin 的所有权限
};
```

## 安全考虑

1. **权限验证**: 所有权限操作都需要系统管理员角色
2. **审计日志**: 所有权限变更都会被记录
3. **租户隔离**: 权限配置按租户隔离
4. **默认拒绝**: 默认情况下拒绝所有未明确授权的操作

## 性能优化

1. **权限缓存**: 用户权限在认证时加载并缓存
2. **数据库查询优化**: 使用索引加速权限查询
3. **批量操作**: 支持批量更新权限配置

## 后续改进

1. **权限模板**: 预定义的权限模板
2. **权限组**: 将多个权限组合成权限组
3. **API密钥权限**: 为API密钥设置权限
4. **临时权限**: 设置临时生效的权限
5. **多因素权限**: 需要多因素认证才能访问的权限
