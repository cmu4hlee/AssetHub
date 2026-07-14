const db = require('../../../config/database');
const { addTenantFilter, getTenantId } = require('../../../middleware/tenant-filter');

// 日志
const logger = {
  error: (message, error) => console.error(`[acceptance-management] ${message}:`, error),
  info: message => console.log(`[acceptance-management] ${message}`),
  warn: (message, data) => console.warn(`[acceptance-management] ${message}`, data || ''),
};

// 解析租户过滤条件，错误时返回 null（已发送响应）
const resolveTenantFilter = (req, res) => {
  try {
    return addTenantFilter(req);
  } catch (error) {
    if (error.message === 'MISSING_TENANT_ID') {
      res.status(400).json({ success: false, message: '当前用户未分配企业空间' });
      return null;
    }
    if (error.message === 'INVALID_TENANT_ID') {
      res.status(400).json({ success: false, message: '无效的企业空间ID' });
      return null;
    }
    throw error;
  }
};

// 验证用户是否有权限访问指定科室数据
const checkDepartmentPermission = async (req, department, functionalDepartment) => {
  if (req.user.role === 'system_admin' || req.user.role === 'super_admin') {
    return { allowed: true };
  }

  if (!req.user.managed_departments || !Array.isArray(req.user.managed_departments) || req.user.managed_departments.length === 0) {
    return { allowed: false, message: '权限不足，用户未分配管理科室' };
  }

  const tenantId = getTenantId(req);
  if (!tenantId) {
    return { allowed: false, message: '当前用户未分配企业空间' };
  }

  const placeholders = req.user.managed_departments.map(() => '?').join(',');
  const [deptRows] = await db.execute(
    `SELECT department_name FROM departments WHERE tenant_id = ? AND department_code IN (${placeholders})`,
    [tenantId, ...req.user.managed_departments],
  );

  const managedDeptNames = deptRows.map(row => row.department_name);

  if (
    (department && managedDeptNames.includes(department)) ||
    (functionalDepartment && managedDeptNames.includes(functionalDepartment))
  ) {
    return { allowed: true };
  }

  return { allowed: false, message: '权限不足，只能操作自己管理科室的数据' };
};

// 生成申请编号
const generateApplicationCode = (tenantId) => {
  const now = new Date();
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const random = Math.floor(Math.random() * 9000) + 1000;
  return `ACC-${dateStr}-${tenantId}-${random}`;
};

// 验收申请状态机
const APPLICATION_STATUS_TRANSITIONS = {
  '草稿': ['待审批'],
  '待审批': ['审批中', '已批准', '已拒绝', '已撤回'],
  '审批中': ['已批准', '已拒绝', '已撤回'],
  '已批准': ['已完成', '已撤回'],
  '已拒绝': ['待审批'],
  '已撤回': ['待审批'],
  '已完成': [],
};

const canTransitionApplicationStatus = (fromStatus, toStatus) => {
  const allowed = APPLICATION_STATUS_TRANSITIONS[fromStatus] || [];
  return allowed.includes(toStatus);
};

// 验证模板输入
const validateTemplateInput = (data) => {
  const errors = [];
  if (!data.category || typeof data.category !== 'string' || data.category.length > 50) {
    errors.push('分类格式不正确（必填，最长50字符）');
  }
  if (!data.item_name || typeof data.item_name !== 'string' || data.item_name.length > 100) {
    errors.push('检查项名称格式不正确（必填，最长100字符）');
  }
  if (data.item_description && typeof data.item_description === 'string' && data.item_description.length > 500) {
    errors.push('检查项描述格式不正确（最长500字符）');
  }
  return { valid: errors.length === 0, errors };
};

// 验证验收申请输入
const validateApplicationInput = (data) => {
  const errors = [];
  if (!data.title || typeof data.title !== 'string' || data.title.length > 200) {
    errors.push('申请标题格式不正确（必填，最长200字符）');
  }
  if (data.asset_code && (typeof data.asset_code !== 'string' || data.asset_code.length > 50)) {
    errors.push('资产编号格式不正确（最长50字符）');
  }
  if (data.priority && !['低', '中', '高'].includes(data.priority)) {
    errors.push('优先级必须是[低, 中, 高]之一');
  }
  if (data.description && typeof data.description === 'string' && data.description.length > 2000) {
    errors.push('申请说明格式不正确（最长2000字符）');
  }
  return { valid: errors.length === 0, errors };
};

module.exports = {
  logger,
  resolveTenantFilter,
  checkDepartmentPermission,
  generateApplicationCode,
  canTransitionApplicationStatus,
  validateTemplateInput,
  validateApplicationInput,
  APPLICATION_STATUS_TRANSITIONS,
};
