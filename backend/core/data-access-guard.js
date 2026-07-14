/**
 * 数据访问守卫
 * 防止路由层直接跨模块操作数据库表
 * 强制所有数据库访问通过模块服务层进行
 */

const logger = require('../config/logger');

// 模块表映射：模块ID -> 允许访问的表名列表
const MODULE_TABLE_MAP = {
  'acceptance-management': [
    'asset_acceptance_records', 'asset_acceptance_files', 'asset_acceptance_checklist', 'asset_acceptance_templates', 'acceptance_applications', 'acceptance_approvals', 'acceptance_teams', 'acceptance_reminders'
  ],
  'adverse-event': [
    'adverse_reaction_records', 'adverse_reaction_attachments', 'adverse_reaction_workflow', 'root_cause_analyses', 'preventive_measures'
  ],
  'asset-ai-assistant': [], // 纯聚合服务,不在 config.database_tables 声明
  'asset-management': ['assets', 'asset_categories', 'asset_locations', 'asset_images'],
  'asset-risk-management': ['asset_risk_levels', 'risk_control_measures', 'risk_assessment_records'],
  'asset-usage-management': ['asset_usage_records'],
  'compliance-management': ['maintenance_level_templates', 'maintenance_level_plans'],
  'ct-maintenance-assistant-management': [], // 纯聚合服务,不在 config.database_tables 声明
  'department-management': ['departments'],
  'depreciation-management': ['assets'],
  'feishu-binding': ['feishu_binding'],
  'inspection-management': [
    'inspection_templates', 'inspection_template_items', 'inspection_tasks', 'inspection_records', 'inspection_record_items', 'inspection_issues'
  ],
  'inventory-management': ['inventory_records', 'inventory_details', 'inventory_scan_logs'],
  'iot-asset-monitoring-management': ['iot_asset_monitor_ts'],
  'iot-environment-monitoring-management': ['iot_environment_monitor_ts'],
  'iot-geo-location-management': ['iot_geo_location_ts'],
  'iot-management': [
    'iot_devices', 'iot_device_connectors', 'asset_locations', 'asset_location_history', 'iot_zone_location_ts', 'iot_asset_monitor_ts', 'iot_environment_monitor_ts'
  ],
  'iot-zone-location-management': ['iot_zone_location_ts', 'asset_locations'],
  'label-management': ['asset_label_templates', 'asset_label_print_queue'],
  'maintenance-management': [
    'maintenance_logs', 'maintenance_log_attachments', 'maintenance_workorders', 'maintenance_workorder_materials', 'maintenance_requests', 'maintenance_costs'
  ],
  'preventive-maintenance-management': [
    'preventive_maintenance_plans', 'maintenance_plan_history', 'maintenance_templates', 'maintenance_template_items', 'maintenance_reminders'
  ],
  'quality-assurance-management': ['quality_control_records', 'quality_control_attachments', 'quality_management_cycles'],
  'quality-common': ['quality_permissions', 'quality_dictionary_items', 'quality_logs'],
  'quality-control': ['metrology_records', 'metrology_attachments', 'quality_control_records'],
  'safety-inspection-management': ['safety_inspections', 'safety_inspection_issues'],
  'special-equipment-management': ['special_equipment', 'special_equipment_inspections'],
  'staff-qualification': ['staff_qualifications', 'staff_training_records'],
  'technical-documents': [
    'technical_documents', 'technical_document_asset_relations', 'technical_document_shares'
  ],
  'tendering-management': [
    'approval_flows', 'approval_nodes', 'approval_records', 'approval_node_records', 'approval_todos', 'tender_projects', 'tender_documents', 'tender_files',
    'tender_suppliers', 'tender_supplier_qualifications', 'tender_invitations', 'tender_bids', 'tender_evaluations', 'tender_share_tokens', 'tender_share_visits', 'tender_share_bids',
    'tender_contracts', 'tender_contract_files', 'tender_payment_milestones', 'tender_invoices', 'tender_invoice_files', 'tender_payments', 'tender_payment_files', 'tender_acceptances',
    'tender_acceptance_files', 'tender_audit_logs'
  ],
  'uptime-management': ['uptime_statistics', 'asset_operation_logs', 'operation_logs'],
  'user-management': ['users', 'user_roles', 'user_tenant_roles', 'super_users'],
  'system': [
    'tenants', 'modules', 'module_configs', 'tenant_module_configs', 'roles', 'permissions', 'menus', 'system_config',
    'audit_logs', 'audit_logs_enhanced', 'workflow', 'dashboard_configs', 'desktop_preferences', 'page_views', 'backup', 'api_documentation',
    'i18n'
  ],
  'ai-services': [
    'ai', 'ai_assistant', 'maintenance_ai', 'technical_documents_enhanced', 'technical_documents_ai', 'chat_conversations'
  ],
  'integration': ['location_alerts', 'intelligent_alerts', 'materials', 'cloud_sync'],
};

// 共享表：所有模块都可以访问的表
const SHARED_TABLES = [
  'tenants', 'users', 'departments', 'roles', 'permissions',
  'modules', 'module_configs', 'tenant_module_configs',
];

/**
 * 检查模块是否有权限访问指定表
 * @param {string} moduleId - 模块ID
 * @param {string} tableName - 表名
 * @returns {boolean}
 */
function canAccessTable(moduleId, tableName) {
  if (!moduleId || !tableName) return false;

  const normalizedModuleId = String(moduleId).toLowerCase().trim();
  const normalizedTable = tableName.toLowerCase().trim();

  // 共享表允许所有模块访问
  if (SHARED_TABLES.includes(normalizedTable)) return true;

  // 检查模块自己的表
  const allowedTables = MODULE_TABLE_MAP[normalizedModuleId];
  if (allowedTables && allowedTables.includes(normalizedTable)) return true;

  return false;
}

/**
 * 从SQL语句中提取表名
 * @param {string} sql - SQL语句
 * @returns {Array<string>} 表名列表
 */
function extractTablesFromSQL(sql) {
  if (!sql) return [];

  const tables = [];
  const normalizedSQL = sql.toLowerCase();

  // 匹配 FROM 子句
  const fromMatches = normalizedSQL.match(/from\s+([a-z_][a-z0-9_]*)/gi);
  if (fromMatches) {
    fromMatches.forEach(match => {
      const table = match.replace(/from\s+/i, '').trim();
      if (table) tables.push(table);
    });
  }

  // 匹配 JOIN 子句
  const joinMatches = normalizedSQL.match(/join\s+([a-z_][a-z0-9_]*)/gi);
  if (joinMatches) {
    joinMatches.forEach(match => {
      const table = match.replace(/join\s+/i, '').trim();
      if (table) tables.push(table);
    });
  }

  // 匹配 INSERT INTO
  const insertMatches = normalizedSQL.match(/insert\s+into\s+([a-z_][a-z0-9_]*)/gi);
  if (insertMatches) {
    insertMatches.forEach(match => {
      const table = match.replace(/insert\s+into\s+/i, '').trim();
      if (table) tables.push(table);
    });
  }

  // 匹配 UPDATE
  const updateMatches = normalizedSQL.match(/update\s+([a-z_][a-z0-9_]*)/gi);
  if (updateMatches) {
    updateMatches.forEach(match => {
      const table = match.replace(/update\s+/i, '').trim();
      if (table) tables.push(table);
    });
  }

  // 匹配 DELETE FROM
  const deleteMatches = normalizedSQL.match(/delete\s+from\s+([a-z_][a-z0-9_]*)/gi);
  if (deleteMatches) {
    deleteMatches.forEach(match => {
      const table = match.replace(/delete\s+from\s+/i, '').trim();
      if (table) tables.push(table);
    });
  }

  return [...new Set(tables)];
}

/**
 * 数据访问守卫中间件
 * 拦截数据库查询，检查跨模块表访问
 * @param {string} moduleId - 当前模块ID
 * @param {Object} options - 配置选项
 * @param {boolean} options.strict - 是否严格模式（默认true，禁止跨模块访问）
 * @param {Array<string>} options.allowedTables - 额外允许的表名
 */
function dataAccessGuard(moduleId, options = {}) {
  const {
    strict = true,
    allowedTables = [],
  } = options;

  return (req, res, next) => {
    if (!moduleId) return next();

    req._moduleId = moduleId;
    req._dataAccessGuard = {
      strict,
      allowedTables: new Set([...allowedTables, ...(MODULE_TABLE_MAP[moduleId] || [])]),
    };

    next();
  };
}

/**
 * 验证SQL查询的模块权限
 * @param {string} moduleId - 模块ID
 * @param {string} sql - SQL语句
 * @returns {Object} { allowed: boolean, violations: Array<string> }
 */
function validateSQLAccess(moduleId, sql) {
  if (!moduleId || !sql) return { allowed: true, violations: [] };

  const tables = extractTablesFromSQL(sql);
  const violations = [];

  for (const table of tables) {
    if (!canAccessTable(moduleId, table)) {
      violations.push(table);
    }
  }

  return {
    allowed: violations.length === 0,
    violations,
  };
}

/**
 * 为数据库连接包装跨模块访问检查
 * @param {Object} db - 数据库连接
 * @param {string} moduleId - 模块ID
 * @returns {Object} 包装后的数据库连接
 */
function wrapDatabaseConnection(db, moduleId) {
  if (!db || !moduleId) return db;

  const wrapped = Object.create(db);

  // 包装 execute 方法
  if (db.execute) {
    wrapped.execute = async function(sql, params) {
      const validation = validateSQLAccess(moduleId, sql);
      if (!validation.allowed) {
        logger.error(`[DataAccessGuard] 模块 ${moduleId} 尝试跨模块访问表: ${validation.violations.join(', ')}`);
        throw new Error(`CROSS_MODULE_ACCESS_DENIED: 模块 ${moduleId} 无权访问表 ${validation.violations.join(', ')}`);
      }
      return db.execute(sql, params);
    };
  }

  // 包装 query 方法
  if (db.query) {
    wrapped.query = async function(sql, params) {
      const validation = validateSQLAccess(moduleId, sql);
      if (!validation.allowed) {
        logger.error(`[DataAccessGuard] 模块 ${moduleId} 尝试跨模块访问表: ${validation.violations.join(', ')}`);
        throw new Error(`CROSS_MODULE_ACCESS_DENIED: 模块 ${moduleId} 无权访问表 ${validation.violations.join(', ')}`);
      }
      return db.query(sql, params);
    };
  }

  return wrapped;
}

module.exports = {
  MODULE_TABLE_MAP,
  SHARED_TABLES,
  canAccessTable,
  extractTablesFromSQL,
  dataAccessGuard,
  validateSQLAccess,
  wrapDatabaseConnection,
};
