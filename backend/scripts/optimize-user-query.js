/**
 * 用户列表查询优化 - 修复 N+1 问题
 * 
 * 原始代码问题：
 * - 为每个用户单独查询管理科室：N 次查询
 * - 为每个用户的每个租户查询管理科室：N × M 次查询
 * - 如果有 20 个用户，每个用户有 2 个租户，就会产生 1 + 20 + 40 = 61 次查询
 * 
 * 优化方案：
 * - 使用单个查询获取所有用户的管理科室：1 次查询
 * - 将结果在内存中组装
 * 
 * 使用方法：
 * 将优化后的查询逻辑替换到 routes/users.js 的第 1642-1677 行
 */

const optimizeUserQuery = async (db, rows, isSuperAdmin) => {
  if (!rows || rows.length === 0) {
    return rows.map(user => ({
      ...user,
      managed_departments: [],
    }));
  }

  const userIds = rows.map(user => user.id);

  if (isSuperAdmin) {
    // 超级管理员：使用单个查询获取所有用户的所有租户管理科室
    const [allManagedDepartments] = await db.execute(
      `SELECT 
        umd.user_id,
        umd.tenant_id,
        GROUP_CONCAT(umd.department_code) as department_codes
       FROM user_managed_departments umd
       WHERE umd.user_id IN (?)
       GROUP BY umd.user_id, umd.tenant_id`,
      [userIds]
    );

    // 按用户分组管理科室
    const departmentsByUser = {};
    allManagedDepartments.forEach(item => {
      if (!departmentsByUser[item.user_id]) {
        departmentsByUser[item.user_id] = [];
      }
      if (item.department_codes) {
        departmentsByUser[item.user_id].push(...item.department_codes.split(','));
      }
    });

    // 组装结果
    return rows.map(user => ({
      ...user,
      managed_departments: departmentsByUser[user.id] || [],
    }));
  } else {
    // 普通管理员：只需要查询当前租户的管理科室
    const [allManagedDepartments] = await db.execute(
      `SELECT 
        umd.user_id,
        GROUP_CONCAT(umd.department_code) as department_codes
       FROM user_managed_departments umd
       WHERE umd.user_id IN (?)
       GROUP BY umd.user_id`,
      [userIds]
    );

    // 按用户分组管理科室
    const departmentsByUser = {};
    allManagedDepartments.forEach(item => {
      departmentsByUser[item.user_id] = item.department_codes 
        ? item.department_codes.split(',') 
        : [];
    });

    // 组装结果
    return rows.map(user => ({
      ...user,
      managed_departments: departmentsByUser[user.id] || [],
    }));
  }
};

/**
 * 替代方案：使用 LEFT JOIN 在主查询中直接获取管理科室
 * 适用于数据量较小的情况
 */
const getUserListWithDepartmentsSQL = `
SELECT
  u.id,
  u.username,
  u.real_name,
  u.department_code,
  NULLIF(GROUP_CONCAT(DISTINCT utr.role ORDER BY utr.role SEPARATOR ', '), '') as role,
  u.email,
  u.phone,
  u.status,
  u.created_at,
  u.updated_at,
  GROUP_CONCAT(DISTINCT umd.department_code) as managed_departments
FROM users u
LEFT JOIN user_tenant_roles utr ON u.id = utr.user_id
LEFT JOIN user_managed_departments umd ON u.id = umd.user_id AND umd.tenant_id = utr.tenant_id
{WHERE_CLAUSE}
GROUP BY
  u.id,
  u.username,
  u.real_name,
  u.department_code,
  u.email,
  u.phone,
  u.status,
  u.created_at,
  u.updated_at
ORDER BY u.created_at DESC
LIMIT ? OFFSET ?
`;

module.exports = {
  optimizeUserQuery,
  getUserListWithDepartmentsSQL,
};
