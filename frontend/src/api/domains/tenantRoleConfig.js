/**
 * 租户角色权限配置 API（需求④前端专属）
 *
 * 所有请求复用 client.js 的 `api` 实例，该实例已在请求拦截器中自动注入
 * `X-Tenant-ID`（取自当前选中的企业），因此这里的调用天然按「当前租户」生效，
 * 后端 tenant-role-config 路由再以 req.user.tenant_id 做二次校验，确保租户隔离。
 *
 * 仅 system_admin / super_admin 可调（后端 requireSystemAdmin 守护）。
 */
import { api } from '../client';

export const tenantRoleConfigAPI = {
  // 列出标准角色（role_code / role_name / description）
  getRoles: () => api.get('/tenant-role-config/roles'),

  // 查某角色在本租户的菜单可见性 -> data: [{ menu_key, is_visible }]
  getRoleMenus: role => api.get(`/tenant-role-config/roles/${role}/menus`),

  // 批量设置某角色在本租户的菜单可见性 -> body: { menus: [{ menu_key, is_visible }] }
  updateRoleMenus: (role, menus) =>
    api.put(`/tenant-role-config/roles/${role}/menus`, { menus }),

  // 查某角色在本租户的数据范围 -> data: { data_scope, custom_department_codes }
  getRoleDataScope: role => api.get(`/tenant-role-config/roles/${role}/data-scope`),

  // 设置数据范围 -> body: { data_scope, custom_department_codes? }
  updateRoleDataScope: (role, data_scope, custom_department_codes) =>
    api.put(`/tenant-role-config/roles/${role}/data-scope`, {
      data_scope,
      custom_department_codes,
    }),

  // 查某角色在本租户的操作权限 -> data: [permission_key, ...]
  getRolePermissions: role => api.get(`/tenant-role-config/roles/${role}/permissions`),

  // 整体替换操作权限 -> body: { permissions: [...] }
  updateRolePermissions: (role, permissions) =>
    api.put(`/tenant-role-config/roles/${role}/permissions`, { permissions }),
};
