const db = require('../config/database');

const SEED_REMARK = '系统注册自动初始化测试数据';
const DEMO_DEPARTMENT_NAME = '测试部门';
const DEMO_CATEGORY_NAME = '测试分类';
const DEMO_ASSET_NAME = '测试资产';
const DEMO_LOCATION = '测试位置';

const CORE_MODULE_IDS = [
  'user-management',
  'asset-management',
  'department-management',
  'permission-management',
  'asset-ai-assistant',
  'iot-management',
  'module-management',
  'quality-common',
  'maintenance-management',
  'preventive-maintenance-management',
  'inventory-management',
  'quality-control',
  'quality-assurance-management',
];

async function enableAllModulesForTenant(tenantId) {
  const [allModules] = await db.execute(
    'SELECT id, version, default_config FROM system_modules WHERE status = ?',
    ['active'],
  );

  if (allModules.length === 0) {
    return enableCoreModulesForTenant(tenantId);
  }

  for (const module of allModules) {
    const moduleConfig =
      module.default_config && String(module.default_config).trim()
        ? module.default_config
        : '{}';

    await db.execute(
      `INSERT INTO tenant_module_configs (tenant_id, module_id, enabled, config, version, enabled_at, updated_at)
       VALUES (?, ?, 1, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON DUPLICATE KEY UPDATE
         enabled = 1,
         config = COALESCE(config, VALUES(config)),
         version = VALUES(version),
         enabled_at = COALESCE(enabled_at, CURRENT_TIMESTAMP),
         disabled_at = NULL,
         updated_at = CURRENT_TIMESTAMP`,
      [tenantId, module.id, moduleConfig, module.version],
    );
  }
  console.log(`已为租户 ${tenantId} 启用全部 ${allModules.length} 个模块`);
}

async function enableCoreModulesForTenant(tenantId) {
  for (const moduleId of CORE_MODULE_IDS) {
    const [sysModules] = await db.execute(
      'SELECT id, version, default_config FROM system_modules WHERE id = ?',
      [moduleId],
    );
    if (sysModules.length === 0) continue;
    const module = sysModules[0];
    const moduleConfig =
      module.default_config && String(module.default_config).trim()
        ? module.default_config
        : '{}';

    await db.execute(
      `INSERT INTO tenant_module_configs (tenant_id, module_id, enabled, config, version, enabled_at, updated_at)
       VALUES (?, ?, 1, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON DUPLICATE KEY UPDATE
         enabled = 1,
         config = COALESCE(config, VALUES(config)),
         version = VALUES(version),
         enabled_at = COALESCE(enabled_at, CURRENT_TIMESTAMP),
         disabled_at = NULL,
         updated_at = CURRENT_TIMESTAMP`,
      [tenantId, module.id, moduleConfig, module.version],
    );
  }
  console.log(`已为租户 ${tenantId} 启用核心模块`);
}

function formatDate(date = new Date()) {
  return new Date(date).toISOString().split('T')[0];
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return formatDate(next);
}

function buildAssetCode(tenantId) {
  return `TEST-ASSET-T${tenantId}`;
}

function buildCategoryCode(tenantId) {
  return `TEST_CATEGORY_${tenantId}`;
}

function buildInventoryNo(tenantId) {
  return `TEST-INV-T${tenantId}`;
}

function generateRequestNo() {
  return `WXINIT${Date.now()}${Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, '0')}`;
}

function generateMetrologyNo() {
  return `MTINIT${Date.now()}${Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, '0')}`;
}

function generateQCNo() {
  return `QCINIT${Date.now()}${Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, '0')}`;
}

async function ensureDepartment(connection, tenantId) {
  const [existing] = await connection.execute(
    `SELECT id, department_code, department_name
     FROM departments
     WHERE tenant_id = ? AND department_name = ?
     LIMIT 1`,
    [tenantId, DEMO_DEPARTMENT_NAME],
  );

  if (existing.length > 0) {
    return existing[0];
  }

  const [maxCodeResult] = await connection.execute(
    "SELECT MAX(department_code) AS maxCode FROM departments WHERE tenant_id = ? AND department_code LIKE 'DEP%'",
    [tenantId],
  );

  let nextCode = 'DEP001';
  if (maxCodeResult[0]?.maxCode) {
    const num = Number.parseInt(String(maxCodeResult[0].maxCode).replace('DEP', ''), 10) + 1;
    nextCode = `DEP${String(num).padStart(3, '0')}`;
  }

  const [result] = await connection.execute(
    `INSERT INTO departments (tenant_id, department_code, department_name, parent_code, level)
     VALUES (?, ?, ?, ?, ?)`,
    [tenantId, nextCode, DEMO_DEPARTMENT_NAME, null, 2],
  );

  return {
    id: result.insertId,
    department_code: nextCode,
    department_name: DEMO_DEPARTMENT_NAME,
  };
}

async function ensureCategory(connection, tenantId) {
  const categoryCode = buildCategoryCode(tenantId);
  const [existing] = await connection.execute(
    `SELECT id, name, code
     FROM asset_categories
     WHERE tenant_id = ? AND (code = ? OR name = ?)
     LIMIT 1`,
    [tenantId, categoryCode, DEMO_CATEGORY_NAME],
  );

  if (existing.length > 0) {
    return existing[0];
  }

  const [result] = await connection.execute(
    `INSERT INTO asset_categories (
      tenant_id, name, parent_id, code, level, description, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, NOW())`,
    [tenantId, DEMO_CATEGORY_NAME, null, categoryCode, 1, SEED_REMARK],
  );

  return {
    id: result.insertId,
    name: DEMO_CATEGORY_NAME,
    code: categoryCode,
  };
}

async function ensureUserDepartment(connection, userId, departmentCode) {
  if (!userId || !departmentCode) {
    return;
  }

  await connection.execute(
    `UPDATE users
     SET department_code = CASE
       WHEN department_code IS NULL OR department_code = '' THEN ?
       ELSE department_code
     END
     WHERE id = ?`,
    [departmentCode, userId],
  );
}

async function ensureAsset(connection, { tenantId, categoryId, departmentCode, operatorName, username }) {
  const assetCode = buildAssetCode(tenantId);
  const [existing] = await connection.execute(
    `SELECT id, asset_code, asset_name
     FROM assets
     WHERE tenant_id = ? AND asset_code = ?
     LIMIT 1`,
    [tenantId, assetCode],
  );

  if (existing.length > 0) {
    return existing[0];
  }

  const [result] = await connection.execute(
    `INSERT INTO assets (
      tenant_id, asset_code, asset_name, category_id,
      brand, model, specification, serial_number,
      purchase_date, purchase_price, current_value,
      depreciation_method, depreciation_years,
      location, department, department_new, responsible_person,
      status, supplier, warranty_period, warranty_end_date,
      remark, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      tenantId,
      assetCode,
      DEMO_ASSET_NAME,
      categoryId,
      '测试品牌',
      '测试型号',
      '系统注册自动创建的测试资产',
      `TEST-SN-${tenantId}`,
      formatDate(),
      1000,
      1000,
      '平均年限法',
      5,
      DEMO_LOCATION,
      DEMO_DEPARTMENT_NAME,
      departmentCode,
      operatorName,
      '在用',
      '测试供应商',
      12,
      addDays(new Date(), 365),
      SEED_REMARK,
      username || operatorName,
    ],
  );

  return {
    id: result.insertId,
    asset_code: assetCode,
    asset_name: DEMO_ASSET_NAME,
  };
}

async function ensureMaintenanceRequest(connection, { tenantId, asset, operatorName, phone }) {
  const faultDescription = '系统注册自动创建的测试报修记录';
  const [existing] = await connection.execute(
    `SELECT id
     FROM maintenance_requests
     WHERE tenant_id = ? AND asset_code = ? AND fault_description = ? AND remark = ?
     LIMIT 1`,
    [tenantId, asset.asset_code, faultDescription, SEED_REMARK],
  );

  if (existing.length > 0) {
    return existing[0];
  }

  const [result] = await connection.execute(
    `INSERT INTO maintenance_requests (
      tenant_id, request_no, asset_code, asset_name, fault_description,
      fault_level, request_date, request_person, request_department,
      contact_phone, expected_repair_date, status, remark, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      tenantId,
      generateRequestNo(),
      asset.asset_code,
      asset.asset_name,
      faultDescription,
      '一般',
      formatDate(),
      operatorName,
      DEMO_DEPARTMENT_NAME,
      phone || null,
      addDays(new Date(), 7),
      '待审批',
      SEED_REMARK,
      operatorName,
    ],
  );

  return { id: result.insertId };
}

async function ensureMaintenanceLog(connection, { tenantId, asset, operatorName }) {
  const maintenanceContent = '系统注册自动创建的测试维修日志';
  const [existing] = await connection.execute(
    `SELECT id
     FROM maintenance_logs
     WHERE tenant_id = ? AND asset_code = ? AND maintenance_content = ? AND remark = ?
     LIMIT 1`,
    [tenantId, asset.asset_code, maintenanceContent, SEED_REMARK],
  );

  if (existing.length > 0) {
    return existing[0];
  }

  const [result] = await connection.execute(
    `INSERT INTO maintenance_logs (
      tenant_id, asset_code, asset_name, maintenance_type, maintenance_method,
      maintenance_date, maintenance_person, maintenance_location,
      maintenance_content, maintenance_cost, maintenance_duration,
      supplier_name, parts_replaced,
      next_maintenance_date, status,
      quality_check, quality_check_person, quality_check_date,
      remark, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      tenantId,
      asset.asset_code,
      asset.asset_name,
      '日常维护',
      '自动初始化',
      formatDate(),
      operatorName,
      DEMO_LOCATION,
      maintenanceContent,
      0,
      1,
      '测试供应商',
      '测试零件',
      addDays(new Date(), 30),
      '已完成',
      '待检查',
      operatorName,
      formatDate(),
      SEED_REMARK,
      operatorName,
    ],
  );

  return { id: result.insertId };
}

async function ensureMetrologyRecord(connection, { tenantId, asset, operatorName }) {
  const [existing] = await connection.execute(
    `SELECT id
     FROM metrology_records
     WHERE tenant_id = ? AND asset_code = ? AND metrology_type = ? AND remark = ?
     LIMIT 1`,
    [tenantId, asset.asset_code, '周期检定', SEED_REMARK],
  );

  if (existing.length > 0) {
    return existing[0];
  }

  const [result] = await connection.execute(
    `INSERT INTO metrology_records (
      tenant_id, record_no, asset_code, asset_name, customer_name, specification, serial_number,
      technical_document, conformance_standard, metrology_type, metrology_date,
      next_metrology_date, metrology_agency, certificate_no, result, accuracy_level,
      measurement_range, cost, operator, remark, status, metrology_cycle, warning_days, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      tenantId,
      generateMetrologyNo(),
      asset.asset_code,
      asset.asset_name,
      DEMO_DEPARTMENT_NAME,
      '测试规格',
      `TEST-SN-${tenantId}`,
      '测试技术文档',
      '测试检定标准',
      '周期检定',
      formatDate(),
      addDays(new Date(), 365),
      '测试计量机构',
      `TEST-METROLOGY-${tenantId}`,
      '合格',
      'A',
      '0-100',
      0,
      operatorName,
      SEED_REMARK,
      '已完成',
      12,
      30,
      operatorName,
    ],
  );

  return { id: result.insertId };
}

async function ensureQualityControlRecord(connection, { tenantId, asset, operatorName }) {
  const qcItem = '自动测试项目';
  const [existing] = await connection.execute(
    `SELECT id
     FROM quality_control_records
     WHERE tenant_id = ? AND asset_code = ? AND qc_type = ? AND qc_item = ? AND remark = ?
     LIMIT 1`,
    [tenantId, asset.asset_code, '日常质控', qcItem, SEED_REMARK],
  );

  if (existing.length > 0) {
    return existing[0];
  }

  const [result] = await connection.execute(
    `INSERT INTO quality_control_records (
      tenant_id, record_no, asset_code, asset_name, qc_type, qc_date,
      qc_item, qc_standard, result,
      qc_method, qc_person, department, remark, status,
      created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      tenantId,
      generateQCNo(),
      asset.asset_code,
      asset.asset_name,
      '日常质控',
      formatDate(),
      qcItem,
      '正常标准',
      '合格',
      '自动初始化',
      operatorName,
      DEMO_DEPARTMENT_NAME,
      SEED_REMARK,
      '已完成',
      operatorName,
    ],
  );

  return { id: result.insertId };
}

async function ensureInventoryRecord(connection, { tenantId, operatorName }) {
  const inventoryNo = buildInventoryNo(tenantId);
  const [existing] = await connection.execute(
    `SELECT id, inventory_no
     FROM inventory_records
     WHERE tenant_id = ? AND inventory_no = ?
     LIMIT 1`,
    [tenantId, inventoryNo],
  );

  if (existing.length > 0) {
    return existing[0];
  }

  const [result] = await connection.execute(
    `INSERT INTO inventory_records (
      tenant_id, inventory_no, inventory_date, inventory_type, inventory_person, remark
    ) VALUES (?, ?, ?, ?, ?, ?)`,
    [tenantId, inventoryNo, formatDate(), '专项盘点', operatorName, SEED_REMARK],
  );

  return {
    id: result.insertId,
    inventory_no: inventoryNo,
  };
}

async function ensureInventoryDetail(connection, { inventoryId, assetCode }) {
  const [existing] = await connection.execute(
    `SELECT id
     FROM inventory_details
     WHERE inventory_id = ? AND asset_code = ?
     LIMIT 1`,
    [inventoryId, assetCode],
  );

  if (existing.length > 0) {
    return existing[0];
  }

  const [result] = await connection.execute(
    `INSERT INTO inventory_details (
      inventory_id, asset_code, expected_location, actual_location,
      expected_status, actual_status, discrepancy_type, discrepancy_desc
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [inventoryId, assetCode, DEMO_LOCATION, DEMO_LOCATION, '在用', '在用', '正常', SEED_REMARK],
  );

  return { id: result.insertId };
}

async function initializeRegistrationDemoData({ tenantId, userId, username, realName, phone }) {
  const operatorName = realName || username || '系统管理员';

  return db.transaction(async connection => {
    await enableCoreModulesForTenant(tenantId);

    const department = await ensureDepartment(connection, tenantId);
    await ensureUserDepartment(connection, userId, department.department_code);

    const category = await ensureCategory(connection, tenantId);
    const asset = await ensureAsset(connection, {
      tenantId,
      categoryId: category.id,
      departmentCode: department.department_code,
      operatorName,
      username,
    });

    const maintenanceRequest = await ensureMaintenanceRequest(connection, {
      tenantId,
      asset,
      operatorName,
      phone,
    });
    const maintenanceLog = await ensureMaintenanceLog(connection, {
      tenantId,
      asset,
      operatorName,
    });
    const metrologyRecord = await ensureMetrologyRecord(connection, {
      tenantId,
      asset,
      operatorName,
    });
    const qualityControlRecord = await ensureQualityControlRecord(connection, {
      tenantId,
      asset,
      operatorName,
    });
    const inventoryRecord = await ensureInventoryRecord(connection, {
      tenantId,
      operatorName,
    });
    const inventoryDetail = await ensureInventoryDetail(connection, {
      inventoryId: inventoryRecord.id,
      assetCode: asset.asset_code,
    });

    return {
      tenant_id: tenantId,
      user_id: userId,
      department,
      category,
      asset,
      maintenance_request: maintenanceRequest,
      maintenance_log: maintenanceLog,
      metrology_record: metrologyRecord,
      quality_control_record: qualityControlRecord,
      inventory_record: inventoryRecord,
      inventory_detail: inventoryDetail,
    };
  });
}

module.exports = {
  initializeRegistrationDemoData,
  enableAllModulesForTenant,
  enableCoreModulesForTenant,
  SEED_REMARK,
};
