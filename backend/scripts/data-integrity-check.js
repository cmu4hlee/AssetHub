#!/usr/bin/env node

/**
 * AssetHub 部门用户主数据完整性检查
 *
 * 检查项目：
 * 1. departments 表完整性
 * 2. users 表与 tenants 关联
 * 3. 用户角色分配正确性
 * 4. 部门与资产管理员关联
 * 5. 孤儿记录检测
 */

const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const DB_CONFIG = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'zcgl',
};

async function runQuery(conn, sql, params = []) {
  try {
    const [rows] = await conn.query(sql, params);
    return rows;
  } catch (error) {
    console.error(`SQL Error: ${error.message}`);
    console.error(`SQL: ${sql}`);
    return [];
  }
}

async function checkDepartmentsIntegrity(conn) {
  console.log('\n========== 1. departments 表完整性检查 ==========\n');

  const results = {
    total_count: 0,
    null_tenant_id: 0,
    null_department_code: 0,
    null_department_name: 0,
    duplicate_code: 0,
    duplicate_name: 0,
    issues: [],
  };

  // 基本统计
  const countSql = 'SELECT COUNT(*) as cnt FROM departments';
  const countResult = await runQuery(conn, countSql);
  results.total_count = countResult[0]?.cnt || 0;

  // 检查 null tenant_id
  const nullTenantSql = 'SELECT COUNT(*) as cnt FROM departments WHERE tenant_id IS NULL';
  const nullTenantResult = await runQuery(conn, nullTenantSql);
  results.null_tenant_id = nullTenantResult[0]?.cnt || 0;
  if (results.null_tenant_id > 0) {
    results.issues.push(`[严重] ${results.null_tenant_id} 条记录的 tenant_id 为 NULL`);
  }

  // 检查 null department_code
  const nullCodeSql = 'SELECT COUNT(*) as cnt FROM departments WHERE department_code IS NULL OR department_code = ""';
  const nullCodeResult = await runQuery(conn, nullCodeSql);
  results.null_department_code = nullCodeResult[0]?.cnt || 0;
  if (results.null_department_code > 0) {
    results.issues.push(`[严重] ${results.null_department_code} 条记录的 department_code 为 NULL`);
  }

  // 检查 null department_name
  const nullNameSql = 'SELECT COUNT(*) as cnt FROM departments WHERE department_name IS NULL OR department_name = ""';
  const nullNameResult = await runQuery(conn, nullNameSql);
  results.null_department_name = nullNameResult[0]?.cnt || 0;
  if (results.null_department_name > 0) {
    results.issues.push(`[严重] ${results.null_department_name} 条记录的 department_name 为 NULL`);
  }

  // 检查重复的 department_code（同租户内）
  const dupCodeSql = `
    SELECT tenant_id, department_code, COUNT(*) as cnt
    FROM departments
    WHERE department_code IS NOT NULL AND department_code != ''
    GROUP BY tenant_id, department_code
    HAVING COUNT(*) > 1
  `;
  const dupCodeResult = await runQuery(conn, dupCodeSql);
  results.duplicate_code = dupCodeResult.length;
  if (results.duplicate_code > 0) {
    results.issues.push(`[严重] ${results.duplicate_code} 组记录存在重复的 department_code`);
    results.duplicate_code_samples = dupCodeResult.slice(0, 5);
  }

  // 检查重复的 department_name（同租户内）
  const dupNameSql = `
    SELECT tenant_id, department_name, COUNT(*) as cnt
    FROM departments
    WHERE department_name IS NOT NULL AND department_name != ''
    GROUP BY tenant_id, department_name
    HAVING COUNT(*) > 1
  `;
  const dupNameResult = await runQuery(conn, dupNameSql);
  results.duplicate_name = dupNameResult.length;
  if (results.duplicate_name > 0) {
    results.issues.push(`[警告] ${results.duplicate_name} 组记录存在重复的 department_name`);
    results.duplicate_name_samples = dupNameResult.slice(0, 5);
  }

  // 显示每个租户的部门数量
  const deptByTenantSql = `
    SELECT tenant_id, COUNT(*) as dept_count
    FROM departments
    GROUP BY tenant_id
    ORDER BY tenant_id
  `;
  results.dept_by_tenant = await runQuery(conn, deptByTenantSql);

  console.log(`总部门数: ${results.total_count}`);
  console.log(`null tenant_id: ${results.null_tenant_id}`);
  console.log(`null department_code: ${results.null_department_code}`);
  console.log(`null department_name: ${results.null_department_name}`);
  console.log(`重复 department_code: ${results.duplicate_code}`);
  console.log(`重复 department_name: ${results.duplicate_name}`);
  console.log('各租户部门数量:', JSON.stringify(results.dept_by_tenant));

  return results;
}

async function checkUsersTenantsAssociation(conn) {
  console.log('\n========== 2. users 表与 tenants 关联检查 ==========\n');

  const results = {
    total_count: 0,
    null_tenant_id: 0,
    invalid_tenant_id: 0,
    no_role: 0,
    issues: [],
  };

  // 基本统计
  const countSql = 'SELECT COUNT(*) as cnt FROM users';
  const countResult = await runQuery(conn, countSql);
  results.total_count = countResult[0]?.cnt || 0;

  // 检查 null tenant_id
  const nullTenantSql = 'SELECT COUNT(*) as cnt FROM users WHERE tenant_id IS NULL';
  const nullTenantResult = await runQuery(conn, nullTenantSql);
  results.null_tenant_id = nullTenantResult[0]?.cnt || 0;
  if (results.null_tenant_id > 0) {
    results.issues.push(`[严重] ${results.null_tenant_id} 条用户记录的 tenant_id 为 NULL`);
  }

  // 检查无效的 tenant_id（不在 tenants 表中）
  const invalidTenantSql = `
    SELECT u.id, u.username, u.tenant_id
    FROM users u
    LEFT JOIN tenants t ON u.tenant_id = t.id
    WHERE u.tenant_id IS NOT NULL AND t.id IS NULL
  `;
  const invalidTenantResult = await runQuery(conn, invalidTenantSql);
  results.invalid_tenant_id = invalidTenantResult.length;
  if (results.invalid_tenant_id > 0) {
    results.issues.push(`[严重] ${results.invalid_tenant_id} 条用户记录的 tenant_id 在 tenants 表中不存在`);
    results.invalid_tenant_samples = invalidTenantResult.slice(0, 10);
  }

  // 检查没有角色的用户
  const noRoleSql = 'SELECT COUNT(*) as cnt FROM users WHERE role IS NULL OR role = ""';
  const noRoleResult = await runQuery(conn, noRoleSql);
  results.no_role = noRoleResult[0]?.cnt || 0;
  if (results.no_role > 0) {
    results.issues.push(`[警告] ${results.no_role} 条用户记录没有分配角色`);
  }

  // 显示每个租户的用户数量
  const usersByTenantSql = `
    SELECT tenant_id, role, COUNT(*) as user_count
    FROM users
    WHERE tenant_id IS NOT NULL
    GROUP BY tenant_id, role
    ORDER BY tenant_id, role
  `;
  results.users_by_tenant_role = await runQuery(conn, usersByTenantSql);

  console.log(`总用户数: ${results.total_count}`);
  console.log(`null tenant_id: ${results.null_tenant_id}`);
  console.log(`无效 tenant_id: ${results.invalid_tenant_id}`);
  console.log(`无角色用户: ${results.no_role}`);

  return results;
}

async function checkUserRoles(conn) {
  console.log('\n========== 3. 用户角色分配检查 ==========\n');

  const results = {
    role_distribution: {},
    no_department: 0,
    invalid_role: 0,
    issues: [],
  };

  // 角色分布
  const roleDistSql = `
    SELECT role, COUNT(*) as cnt
    FROM users
    WHERE role IS NOT NULL AND role != ''
    GROUP BY role
    ORDER BY cnt DESC
  `;
  results.role_distribution = await runQuery(conn, roleDistSql);

  // 检查无效的角色
  const validRoles = ['super_admin', 'system_admin', 'tenant_admin', 'department_admin', 'user'];
  const invalidRoleSql = `
    SELECT id, username, role
    FROM users
    WHERE role IS NOT NULL AND role != '' AND role NOT IN (${validRoles.map(r => `'${r}'`).join(',')})
  `;
  const invalidRoleResult = await runQuery(conn, invalidRoleSql);
  results.invalid_role = invalidRoleResult.length;
  if (results.invalid_role > 0) {
    results.issues.push(`[警告] ${results.invalid_role} 条用户记录的角色值不在标准范围内`);
    results.invalid_role_samples = invalidRoleResult.slice(0, 10);
  }

  // 检查没有所属部门的用户（非超级管理员）
  const noDeptSql = `
    SELECT id, username, role, tenant_id
    FROM users
    WHERE (department IS NULL OR department = '')
      AND role != 'super_admin'
      AND role IS NOT NULL
      AND role != ''
  `;
  const noDeptResult = await runQuery(conn, noDeptSql);
  results.no_department = noDeptResult.length;
  if (results.no_department > 0) {
    results.issues.push(`[信息] ${results.no_department} 条非超管用户记录没有所属部门`);
    results.no_department_samples = noDeptResult.slice(0, 10);
  }

  // 显示 tenant_admin 但无 department 的情况
  const adminNoDeptSql = `
    SELECT id, username, role, tenant_id
    FROM users
    WHERE role = 'tenant_admin'
      AND (department IS NULL OR department = '')
  `;
  results.admin_without_department = await runQuery(conn, adminNoDeptSql);
  if (results.admin_without_department.length > 0) {
    results.issues.push(`[警告] ${results.admin_without_department.length} 个租户管理员没有所属部门`);
  }

  console.log('角色分布:', JSON.stringify(results.role_distribution));
  console.log(`无效角色用户: ${results.invalid_role}`);
  console.log(`无部门用户: ${results.no_department}`);

  return results;
}

async function checkDepartmentAssetManagerRelation(conn) {
  console.log('\n========== 4. 部门与资产管理员关联检查 ==========\n');

  const results = {
    total_departments: 0,
    total_assets: 0,
    orphan_department_assets: 0,
    department_admins: 0,
    department_admin_issues: [],
    issues: [],
  };

  // 基本统计
  const deptCountSql = 'SELECT COUNT(*) as cnt FROM departments';
  const deptCountResult = await runQuery(conn, deptCountSql);
  results.total_departments = deptCountResult[0]?.cnt || 0;

  // 资产关联的部门分布
  const assetsByDeptSql = `
    SELECT department, COUNT(*) as asset_count
    FROM assets
    WHERE department IS NOT NULL AND department != '' AND is_deleted = 0
    GROUP BY department
    ORDER BY asset_count DESC
    LIMIT 20
  `;
  results.assets_by_department = await runQuery(conn, assetsByDeptSql);

  // 检查租户隔离的部门资产
  const orphanDeptSql = `
    SELECT a.tenant_id, a.department, COUNT(*) as cnt
    FROM assets a
    LEFT JOIN departments d ON a.tenant_id = d.tenant_id
      AND (a.department = d.department_name OR a.department_new = d.department_code)
    WHERE a.department IS NOT NULL AND a.department != ''
      AND a.is_deleted = 0 AND d.id IS NULL
    GROUP BY a.tenant_id, a.department
    ORDER BY cnt DESC
  `;
  const orphanResult = await runQuery(conn, orphanDeptSql);
  results.orphan_department_assets = orphanResult.reduce((sum, r) => sum + Number(r.cnt), 0);
  if (results.orphan_department_assets > 0) {
    results.issues.push(`[严重] ${results.orphan_department_assets} 条资产记录关联的部门在 departments 表中不存在`);
    results.orphan_samples = orphanResult.slice(0, 10);
  }

  // 检查 department_admin 角色的用户
  const deptAdminSql = `
    SELECT u.id, u.username, u.tenant_id, u.department, u.department_code
    FROM users u
    WHERE u.role = 'department_admin'
  `;
  results.department_admins = await runQuery(conn, deptAdminSql);

  // 检查 department_admin 是否关联了有效部门
  for (const admin of results.department_admins) {
    if (!admin.department && !admin.department_code) {
      results.department_admin_issues.push({
        id: admin.id,
        username: admin.username,
        tenant_id: admin.tenant_id,
        issue: '部门管理员没有关联部门',
      });
    }
  }
  if (results.department_admin_issues.length > 0) {
    results.issues.push(`[警告] ${results.department_admin_issues.length} 个部门管理员没有关联有效部门`);
  }

  console.log(`总部门数: ${results.total_departments}`);
  console.log(`部门管理员数: ${results.department_admins.length}`);
  console.log(`孤儿部门资产记录: ${results.orphan_department_assets}`);

  return results;
}

async function checkOrphanRecords(conn) {
  console.log('\n========== 5. 孤儿记录检测 ==========\n');

  const results = {
    orphan_users_no_tenant: 0,
    orphan_users_invalid_tenant: 0,
    orphan_assets_no_department: 0,
    orphan_inventory_no_tenant: 0,
    orphan_assets_no_category: 0,
    orphan_dept_no_tenant: 0,
    issues: [],
  };

  // 用户没有 tenant_id
  const orphanUserSql = 'SELECT COUNT(*) as cnt FROM users WHERE tenant_id IS NULL';
  const orphanUserResult = await runQuery(conn, orphanUserSql);
  results.orphan_users_no_tenant = orphanUserResult[0]?.cnt || 0;
  if (results.orphan_users_no_tenant > 0) {
    results.issues.push(`[严重] ${results.orphan_users_no_tenant} 条用户记录没有 tenant_id`);
  }

  // 资产没有 department
  const orphanAssetDeptSql = `
    SELECT COUNT(*) as cnt FROM assets
    WHERE (department IS NULL OR department = '') AND is_deleted = 0
  `;
  const orphanAssetDeptResult = await runQuery(conn, orphanAssetDeptSql);
  results.orphan_assets_no_department = orphanAssetDeptResult[0]?.cnt || 0;
  if (results.orphan_assets_no_department > 0) {
    results.issues.push(`[警告] ${results.orphan_assets_no_department} 条资产记录没有所属部门`);
  }

  // 资产没有 category
  const orphanAssetCatSql = `
    SELECT COUNT(*) as cnt FROM assets
    WHERE (category_id IS NULL OR category_id = 0 OR category_id = '') AND is_deleted = 0
  `;
  const orphanAssetCatResult = await runQuery(conn, orphanAssetCatSql);
  results.orphan_assets_no_category = orphanAssetCatResult[0]?.cnt || 0;
  if (results.orphan_assets_no_category > 0) {
    results.issues.push(`[警告] ${results.orphan_assets_no_category} 条资产记录没有分类`);
  }

  // 部门没有 tenant_id
  const orphanDeptSql = 'SELECT COUNT(*) as cnt FROM departments WHERE tenant_id IS NULL';
  const orphanDeptResult = await runQuery(conn, orphanDeptSql);
  results.orphan_dept_no_tenant = orphanDeptResult[0]?.cnt || 0;
  if (results.orphan_dept_no_tenant > 0) {
    results.issues.push(`[严重] ${results.orphan_dept_no_tenant} 条部门记录没有 tenant_id`);
  }

  // 盘点记录没有 tenant_id
  const orphanInventorySql = 'SELECT COUNT(*) as cnt FROM inventory_records WHERE tenant_id IS NULL';
  const orphanInventoryResult = await runQuery(conn, orphanInventorySql);
  results.orphan_inventory_no_tenant = orphanInventoryResult[0]?.cnt || 0;
  if (results.orphan_inventory_no_tenant > 0) {
    results.issues.push(`[警告] ${results.orphan_inventory_no_tenant} 条盘点记录没有 tenant_id`);
  }

  // 资产分类没有 tenant_id
  const orphanCategorySql = 'SELECT COUNT(*) as cnt FROM asset_categories WHERE tenant_id IS NULL';
  const orphanCategoryResult = await runQuery(conn, orphanCategorySql);
  results.orphan_category_no_tenant = orphanCategoryResult[0]?.cnt || 0;
  if (results.orphan_category_no_tenant > 0) {
    results.issues.push(`[警告] ${results.orphan_category_no_tenant} 条资产分类记录没有 tenant_id`);
  }

  console.log(`无 tenant_id 用户: ${results.orphan_users_no_tenant}`);
  console.log(`无部门资产: ${results.orphan_assets_no_department}`);
  console.log(`无分类资产: ${results.orphan_assets_no_category}`);
  console.log(`无 tenant_id 部门: ${results.orphan_dept_no_tenant}`);
  console.log(`无 tenant_id 盘点: ${results.orphan_inventory_no_tenant}`);
  console.log(`无 tenant_id 分类: ${results.orphan_category_no_tenant}`);

  return results;
}

async function main() {
  let conn;
  try {
    console.log('AssetHub 部门用户主数据完整性检查开始...');
    console.log(`数据库: ${DB_CONFIG.host}:${DB_CONFIG.port}/${DB_CONFIG.database}`);

    conn = await mysql.createConnection(DB_CONFIG);
    console.log('数据库连接成功\n');

    const report = {
      generated_at: new Date().toISOString(),
      departments: await checkDepartmentsIntegrity(conn),
      users_tenants: await checkUsersTenantsAssociation(conn),
      user_roles: await checkUserRoles(conn),
      department_asset_relation: await checkDepartmentAssetManagerRelation(conn),
      orphan_records: await checkOrphanRecords(conn),
    };

    // 汇总
    console.log('\n========== 汇总报告 ==========\n');
    const allIssues = [
      ...report.departments.issues,
      ...report.users_tenants.issues,
      ...report.user_roles.issues,
      ...report.department_asset_relation.issues,
      ...report.orphan_records.issues,
    ];

    if (allIssues.length === 0) {
      console.log('✓ 所有检查项均通过，未发现数据问题');
    } else {
      const critical = allIssues.filter(i => i.startsWith('[严重]'));
      const warnings = allIssues.filter(i => i.startsWith('[警告]'));
      const info = allIssues.filter(i => i.startsWith('[信息]'));

      if (critical.length > 0) {
        console.log('【严重问题】');
        critical.forEach(i => console.log(`  ${i}`));
      }
      if (warnings.length > 0) {
        console.log('【警告】');
        warnings.forEach(i => console.log(`  ${i}`));
      }
      if (info.length > 0) {
        console.log('【提示】');
        info.forEach(i => console.log(`  ${i}`));
      }

      console.log(`\n总计: ${critical.length} 个严重问题, ${warnings.length} 个警告, ${info.length} 个提示`);
    }

    // 保存详细报告
    const fs = require('fs');
    const reportPath = path.resolve(__dirname, '../analysis/data-integrity-report.json');
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n详细报告已保存: ${reportPath}`);

  } catch (error) {
    console.error('检查失败:', error.message);
    process.exitCode = 1;
  } finally {
    if (conn) {
      await conn.end();
    }
  }
}

main();
