/**
 * 数据库租户过滤守卫
 *
 * 防御性包装 db.execute / db.query，在开发/测试环境检测缺失 tenant_id 的查询。
 * 不影响正常业务逻辑 — 仅记录警告日志，帮助快速发现遗漏的租户隔离。
 *
 * 注意：此守卫仅在 NODE_ENV !== 'production' 时启用检测；生产环境仅透传。
 */

const logger = require('../config/logger');

// 需要租户隔离的业务表（白名单模式）
// 不含：super_users, tenants, tenant_modules, menu_definitions 等系统级表
const TENANT_SCOPED_TABLES = new Set([
  'assets',
  'asset_images',
  'asset_labels',
  'asset_locations',
  'asset_transfers',
  'maintenance_requests',
  'maintenance_logs',
  'maintenance_plans',
  'work_orders',
  'inventory_records',
  'inventory_plans',
  'inventory_tasks',
  'inventory_reports',
  'inventory_discrepancies',
  'departments',
  'users',
  'user_tenant_roles',
  'roles',
  'permissions',
  'role_permissions',
  'audit_logs',
  'temp_assets',
  'idle_assets',
  'scrapping_records',
  'procurement_requests',
  'procurement_items',
  'quality_control_records',
  'metrology_records',
  'compliance_records',
  'safety_inspection_records',
  'special_equipment_records',
  'risk_records',
  'staff_qualifications',
  'uptime_records',
  'technical_documents',
  'asset_usage_records',
  'acceptance_records',
  'depreciation_records',
  'finance_records',
  'budget_records',
  'material_records',
  'iot_devices',
  'iot_alerts',
  'location_alerts',
  'cloud_sync_records',
  'barcode_records',
  'adverse_events',
  'adverse_reactions',
  // 新增/扩展表
  'maintenance_logs',
  'tendering_documents',
  'inspection_plans',
  'inspection_records',
  'file_attachments',
  'notifications',
  'notification_templates',
  // 子表（通过父表隔离，额外防线）
  'work_order_materials',
  'work_order_history',
  'maintenance_usage_triggered',
  'maintenance_log_attachments',
  'maintenance_plan_history',
  'maintenance_reminders',
  'usage_triggered_maintenance',
]);

// 跳过检查的关键词（SELECT 1, SHOW, DESCRIBE, EXPLAIN, INSERT, CREATE, ALTER, DROP, SET, BEGIN, COMMIT, ROLLBACK）
const SKIP_PATTERNS = [
  /^\s*SELECT\s+1\b/i,
  /^\s*SHOW\s/i,
  /^\s*DESCRIBE\s/i,
  /^\s*EXPLAIN\s/i,
  /^\s*INSERT\s/i,
  /^\s*CREATE\s/i,
  /^\s*ALTER\s/i,
  /^\s*DROP\s/i,
  /^\s*SET\s/i,
  /^\s*BEGIN\b/i,
  /^\s*COMMIT\b/i,
  /^\s*ROLLBACK\b/i,
  /^\s*START\s+TRANSACTION\b/i,
  /^\s*GRANT\s/i,
  /^\s*REVOKE\s/i,
  /^\s*FLUSH\s/i,
  /^\s*KILL\s/i,
  /^\s*USE\s/i,
  /information_schema/i,
  /performance_schema/i,
];

/**
 * 解析 SQL 中引用的表名（简单正则，不处理复杂 CTE）
 */
function extractTableNames(sql) {
  const tables = new Set();
  // FROM / JOIN 后面的表名
  const fromJoinRe = /(?:FROM|JOIN|UPDATE|INTO|TABLE)\s+`?(\w+)`?/gi;
  let match;
  while ((match = fromJoinRe.exec(sql)) !== null) {
    tables.add(match[1].toLowerCase());
  }
  return tables;
}

/**
 * 检查 SQL 中是否已包含 tenant_id 过滤
 */
function hasTenantFilter(sql) {
  return /\btenant_id\b/i.test(sql);
}

/**
 * 是否应跳过检查
 */
function shouldSkip(sql) {
  return SKIP_PATTERNS.some(p => p.test(sql));
}

/**
 * 包装数据库执行函数，加入租户查询守卫
 * @param {Object} db - 数据库模块（含 execute, query, getConnection）
 * @returns {Object} 包装后的 db 对象
 */
function wrapDatabase(db) {
  const isProduction = process.env.NODE_ENV === 'production';

  // 生产环境直接返回原始 db
  if (isProduction) {
    return db;
  }

  const originalExecute = db.execute.bind(db);
  const originalQuery = db.query.bind(db);
  const originalGetConnection = db.getConnection.bind(db);

  let warnCount = 0;
  const MAX_WARNS = 50; // 防止日志刷屏

  function checkTenant(sql, params) {
    if (warnCount >= MAX_WARNS) return;
    if (shouldSkip(sql)) return;

    const tables = extractTableNames(sql);
    const scopedTables = [...tables].filter(t => TENANT_SCOPED_TABLES.has(t));

    if (scopedTables.length > 0 && !hasTenantFilter(sql)) {
      warnCount++;
      const stackLines = new Error().stack.split('\n').slice(2, 5).map(s => s.trim()).join(' → ');
      logger.warn(
        `[TenantGuard] 查询可能缺少 tenant_id 过滤: 表=[${scopedTables.join(',')}] SQL前缀="${sql.substring(0, 120).replace(/\n/g, ' ')}" 调用栈: ${stackLines}`
      );
      if (warnCount === MAX_WARNS) {
        logger.warn(`[TenantGuard] 已抑制后续警告（已达 ${MAX_WARNS} 条上限）`);
      }
    }
  }

  /**
   * 包装后的 execute
   */
  async function guardedExecute(sql, params) {
    checkTenant(sql, params);
    return originalExecute(sql, params);
  }

  /**
   * 包装后的 query
   */
  function guardedQuery(sql, params, callback) {
    checkTenant(sql, params);
    return originalQuery(sql, params, callback);
  }

  db.execute = guardedExecute;
  db.query = guardedQuery;

  // 保留原始方法引用（用于需要绕过检查的场景）
  db._originalExecute = originalExecute;
  db._originalQuery = originalQuery;
  db._originalGetConnection = originalGetConnection;

  logger.info('[TenantGuard] 数据库租户守卫已启用（NODE_ENV != production）');

  return db;
}

module.exports = { wrapDatabase, TENANT_SCOPED_TABLES };
