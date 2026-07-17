import useCurrentUser from './useCurrentUser';
import { ADMIN_ROLES } from '../utils/roleUtils';

/**
 * 基于用户角色判断权限（前端版）
 * 简化版：检查 user.role 是否有资格。
 * 真正细粒度权限仍由后端 authorize() 守护。
 *
 * @param {string|Array<string>} allowedRoles - 允许的角色列表
 * @returns {boolean}
 */
export const usePermission = allowedRoles => {
  const { user } = useCurrentUser();
  if (!user) return false;
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  return roles.includes(user.role);
};

/**
 * 业务操作权限判断（用于按钮可见性）
 * 设计原则：
 *   - 超级管理员/系统管理员 = 全权限
 *   - 其他业务角色按模块 + 操作类型 判定
 *   - 业务上"看自己科室"的操作允许 asset_admin/department_admin
 *
 * @param {string} module - 资源模块 (e.g. 'maintenance', 'metrology', 'quality')
 * @param {string} action - 操作类型 ('view' | 'add' | 'edit' | 'delete' | 'approve')
 * @returns {boolean}
 */
export const useCan = (module, action = 'view') => {
  const { user } = useCurrentUser();
  if (!user) return false;
  const role = user.role;

  // 系统级管理员 = 任何业务操作都允许
  if (role === 'super_admin' || role === 'system_admin') return true;

  // 各模块对应的允许角色
  const moduleRoles = {
    maintenance: {
      view: ['maintenance_admin', 'maintenance_engineer', 'asset_admin'],
      add: ['maintenance_admin', 'maintenance_engineer', 'asset_admin'],
      edit: ['maintenance_admin', 'maintenance_engineer', 'asset_admin'],
      delete: ['maintenance_admin'],
      approve: ['maintenance_admin'],
    },
    metrology: {
      view: ['metrology_admin', 'quality_admin', 'asset_admin'],
      add: ['metrology_admin', 'quality_admin', 'asset_admin'],
      edit: ['metrology_admin', 'quality_admin', 'asset_admin'],
      delete: ['metrology_admin', 'quality_admin', 'asset_admin'],
    },
    quality: {
      view: ['quality_admin', 'metrology_admin', 'asset_admin'],
      add: ['quality_admin', 'asset_admin'],
      edit: ['quality_admin', 'asset_admin'],
      delete: ['quality_admin', 'asset_admin'],
      approve: ['quality_admin'],
    },
    // ==================== POCT 临床科室日常质控 ====================
    poct: {
      // 所有用户都能查看(临床科室自行录入)
      view: ['asset_admin', 'quality_admin', 'department_admin', 'maintenance_admin', 'maintenance_engineer'],
      // 录入需要任何业务用户(临床操作员)
      add: ['asset_admin', 'quality_admin', 'department_admin', 'maintenance_admin', 'maintenance_engineer'],
      // 修改记录(只能改自己的)
      edit: ['asset_admin', 'quality_admin', 'department_admin', 'maintenance_admin', 'maintenance_engineer'],
      // 删除 = 管理员
      delete: ['asset_admin', 'quality_admin'],
      // 管理 = 排班 / 班次 / 科目 / 提醒规则
      admin: ['asset_admin', 'quality_admin'],
    },
    acceptance: {
      view: ['acceptance_admin', 'asset_admin'],
      add: ['acceptance_admin', 'asset_admin'],
      edit: ['acceptance_admin', 'asset_admin'],
      delete: ['acceptance_admin', 'asset_admin'],
      approve: ['acceptance_admin', 'asset_admin'],
      'reminder:manage': ['acceptance_admin', 'asset_admin'],
      'team:manage': ['acceptance_admin', 'asset_admin'],
      'report:generate': ['acceptance_admin', 'asset_admin'],
    },
    transfer: {
      view: ['transfer_admin', 'asset_admin'],
      add: ['transfer_admin', 'asset_admin'],
      edit: ['transfer_admin', 'asset_admin'],
      delete: ['transfer_admin', 'asset_admin'],
      approve: ['transfer_admin', 'asset_admin'],
      complete: ['transfer_admin', 'asset_admin'],
    },
    inventory: {
      view: ['inventory_admin', 'asset_admin'],
      add: ['inventory_admin', 'asset_admin'],
      edit: ['inventory_admin', 'asset_admin'],
      delete: ['inventory_admin', 'asset_admin'],
      complete: ['inventory_admin', 'asset_admin'],
    },
    asset: {
      view: ['asset_admin', 'department_admin'],
      add: ['asset_admin'],
      edit: ['asset_admin'],
      delete: ['asset_admin'],
    },
    // ==================== 维修子模块 ====================
    request: {
      view: ['maintenance_admin', 'maintenance_engineer', 'asset_admin'],
      add: ['maintenance_admin', 'maintenance_engineer', 'asset_admin'],
      edit: ['maintenance_admin', 'maintenance_engineer', 'asset_admin'],
      delete: ['maintenance_admin', 'asset_admin'],
      approve: ['maintenance_admin', 'asset_admin'],
    },
    workorder: {
      view: ['maintenance_admin', 'maintenance_engineer', 'asset_admin'],
      add: ['maintenance_admin', 'asset_admin'],
      edit: ['maintenance_admin', 'maintenance_engineer', 'asset_admin'],
      delete: ['maintenance_admin', 'asset_admin'],
      approve: ['maintenance_admin'],
    },
    // ==================== 验收子模块 ====================
    application: {
      view: ['acceptance_admin', 'asset_admin'],
      add: ['acceptance_admin', 'asset_admin'],
      edit: ['acceptance_admin', 'asset_admin'],
      delete: ['acceptance_admin', 'asset_admin'],
      approve: ['acceptance_admin', 'asset_admin'],
    },
    // ==================== 资产子模块 ====================
    idle: {
      view: ['asset_admin'],
      add: ['asset_admin'],
      edit: ['asset_admin'],
      delete: ['asset_admin'],
    },
    scrapping: {
      view: ['asset_admin'],
      add: ['asset_admin'],
      edit: ['asset_admin'],
      delete: ['asset_admin'],
      approve: ['asset_admin', 'system_admin'],
    },
    // ==================== 不良事件 ====================
    adverse: {
      view: ['asset_admin', 'quality_admin'],
      add: ['asset_admin', 'quality_admin'],
      edit: ['asset_admin', 'quality_admin'],
      delete: ['quality_admin'],
      approve: ['quality_admin'],
    },
    // ==================== 合规/巡检/风险/资质/运维 ====================
    compliance: {
      view: ['asset_admin', 'system_admin'],
      add: ['asset_admin'],
      edit: ['asset_admin'],
      delete: ['asset_admin'],
      approve: ['asset_admin', 'system_admin'],
    },
    inspection: {
      view: ['asset_admin'],
      add: ['asset_admin'],
      edit: ['asset_admin'],
      delete: ['asset_admin'],
      approve: ['asset_admin'],
    },
    risk: {
      view: ['asset_admin'],
      add: ['asset_admin'],
      edit: ['asset_admin'],
      delete: ['asset_admin'],
      approve: ['asset_admin'],
    },
    staff: {
      view: ['asset_admin'],
      add: ['asset_admin'],
      edit: ['asset_admin'],
      delete: ['asset_admin'],
    },
    uptime: {
      view: ['asset_admin'],
      add: ['asset_admin'],
      edit: ['asset_admin'],
      delete: ['asset_admin'],
    },
    // ==================== 招标采购 ====================
    tender: {
      view: ['asset_admin'],
      add: ['asset_admin'],
      edit: ['asset_admin'],
      delete: ['asset_admin'],
      approve: ['asset_admin', 'system_admin'],
    },
    // ==================== 供应商中心 ====================
    supplier: {
      view: ['asset_admin', 'system_admin'],
      add: ['asset_admin', 'system_admin'],
      edit: ['asset_admin', 'system_admin'],
      delete: ['asset_admin', 'system_admin'],
      approve: ['asset_admin', 'system_admin'],
    },
    // ==================== IoT ====================
    iot: {
      view: ['asset_admin', 'maintenance_admin', 'maintenance_engineer'],
      add: ['asset_admin', 'maintenance_admin'],
      edit: ['asset_admin', 'maintenance_admin'],
      delete: ['asset_admin', 'maintenance_admin'],
    },
    // ==================== 系统管理（仅管理员可访问） ====================
    department: {
      view: ['asset_admin', 'department_admin'],
      add: ['asset_admin'],
      edit: ['asset_admin'],
      delete: ['asset_admin'],
    },
    tenant: {
      view: ['asset_admin'],
      add: [],
      edit: [],
      delete: [],
    },
    user: {
      view: ['asset_admin'],
      add: ['asset_admin'],
      edit: ['asset_admin'],
      delete: ['asset_admin'],
    },
    role: {
      view: ['asset_admin'],
      add: ['asset_admin'],
      edit: ['asset_admin'],
      delete: ['asset_admin'],
    },
    system: {
      view: ['asset_admin'],
      add: ['asset_admin'],
      edit: ['asset_admin'],
      delete: ['asset_admin'],
    },
    // ==================== 备件库 ====================
    spare_parts: {
      view: ['asset_admin', 'maintenance_admin', 'maintenance_engineer', 'department_admin'],
      add: ['asset_admin', 'maintenance_admin', 'maintenance_engineer'],
      edit: ['asset_admin', 'maintenance_admin', 'maintenance_engineer'],
      delete: ['asset_admin', 'maintenance_admin'],
      stock_in: ['asset_admin', 'maintenance_admin', 'maintenance_engineer'],
      stock_out: ['asset_admin', 'maintenance_admin', 'maintenance_engineer'],
    },
    // ==================== 临时保养 ====================
    maintenance_temporary: {
      view: ['asset_admin', 'maintenance_admin', 'maintenance_engineer', 'department_admin'],
      add: ['asset_admin', 'maintenance_admin', 'maintenance_engineer'],
      edit: ['asset_admin', 'maintenance_admin', 'maintenance_engineer'],
      delete: ['asset_admin', 'maintenance_admin'],
    },
    // ==================== 应急设备调配 / 租借计费 ====================
    emergency_allocation: {
      view: ['asset_admin', 'maintenance_admin', 'maintenance_engineer', 'department_admin'],
      add: ['asset_admin', 'maintenance_admin', 'maintenance_engineer'],
      edit: ['asset_admin', 'maintenance_admin', 'maintenance_engineer'],
      delete: ['asset_admin', 'maintenance_admin'],
      approve: ['asset_admin', 'maintenance_admin'],
      borrow: ['asset_admin', 'maintenance_admin'],
      return: ['asset_admin', 'maintenance_admin'],
      settle: ['asset_admin', 'maintenance_admin'],
    },
    // ==================== 临床管理平台聚合视图 ====================
    clinical: {
      view: ['asset_admin', 'department_admin', 'maintenance_admin', 'maintenance_engineer'],
    },
    // ==================== 通用事件提醒 ====================
    event_reminder: {
      view: ['asset_admin', 'maintenance_admin', 'maintenance_engineer', 'department_admin'],
      add: ['asset_admin', 'maintenance_admin', 'maintenance_engineer'],
      edit: ['asset_admin', 'maintenance_admin', 'maintenance_engineer'],
      delete: ['asset_admin', 'maintenance_admin'],
      type: ['asset_admin', 'maintenance_admin'],
    },
    // ==================== 表单定制 ====================
    form_customization: {
      view: ['asset_admin', 'system_admin'],
      'schema:create': ['asset_admin', 'system_admin'],
      'schema:update': ['asset_admin', 'system_admin'],
      'schema:delete': ['asset_admin', 'system_admin'],
    },
    // ==================== 流程定制（通用审批引擎） ====================
    workflow: {
      view: ['asset_admin', 'system_admin', 'department_admin', 'maintenance_admin'],
      'definition:create': ['asset_admin', 'system_admin'],
      'definition:update': ['asset_admin', 'system_admin'],
      'definition:delete': ['asset_admin', 'system_admin'],
      'instance:create': ['asset_admin', 'system_admin', 'department_admin', 'maintenance_admin'],
      'instance:approve': ['asset_admin', 'system_admin', 'department_admin', 'maintenance_admin'],
    },
  };

  const allowed = moduleRoles[module]?.[action] || [];
  return allowed.includes(role);
};

/**
 * 检查是否为管理员
 * @returns {boolean}
 */
export const useIsAdmin = () => {
  const { user } = useCurrentUser();
  if (!user) return false;
  return ADMIN_ROLES.includes(user.role);
};

export default useCan;
