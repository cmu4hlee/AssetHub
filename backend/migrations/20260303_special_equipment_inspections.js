const db = require('../config/database');

const TABLE_NAME = 'special_equipment_inspections';

async function tableExists(tableName) {
  const [rows] = await db.execute(
    `SELECT 1
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
     LIMIT 1`,
    [tableName],
  );
  return rows.length > 0;
}

async function getColumns(tableName) {
  const [rows] = await db.execute(
    `SELECT COLUMN_NAME, COLUMN_TYPE
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [tableName],
  );
  return rows;
}

async function ensureColumn(tableName, columnName, definitionSql) {
  const [rows] = await db.execute(
    `SELECT 1
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?
     LIMIT 1`,
    [tableName, columnName],
  );
  if (rows.length > 0) return false;

  await db.execute(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definitionSql}`);
  return true;
}

async function ensureIndex(tableName, indexName, indexSql) {
  const [rows] = await db.execute(
    `SELECT 1
     FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?
     LIMIT 1`,
    [tableName, indexName],
  );
  if (rows.length > 0) return false;

  await db.execute(`CREATE INDEX ${indexName} ON ${tableName} (${indexSql})`);
  return true;
}

async function createTableIfNeeded() {
  if (await tableExists(TABLE_NAME)) return false;

  await db.execute(`
    CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tenant_id INT NOT NULL DEFAULT 1 COMMENT '租户ID',
      inspection_code VARCHAR(50) DEFAULT NULL COMMENT '检验编号',
      equipment_id INT DEFAULT NULL COMMENT '特种设备ID',
      inspection_type VARCHAR(50) NOT NULL DEFAULT 'regular' COMMENT '检验类型',
      inspection_date DATE DEFAULT NULL COMMENT '检验日期',
      inspection_result VARCHAR(50) DEFAULT NULL COMMENT '检验结果',
      inspection_org VARCHAR(200) DEFAULT NULL COMMENT '检验机构',
      inspection_agency VARCHAR(200) DEFAULT NULL COMMENT '检验机构(兼容字段)',
      inspector VARCHAR(100) DEFAULT NULL COMMENT '检验人员',
      inspection_items TEXT COMMENT '检验项目',
      inspection_content TEXT COMMENT '检验内容',
      issues_found TEXT COMMENT '发现问题',
      rectification_measures TEXT COMMENT '整改措施',
      rectification_deadline DATE DEFAULT NULL COMMENT '整改期限',
      certificate_no VARCHAR(100) DEFAULT NULL COMMENT '证书编号',
      certificate_image VARCHAR(500) DEFAULT NULL COMMENT '证书图片',
      next_date DATE DEFAULT NULL COMMENT '下次检验日期(兼容字段)',
      next_inspection_date DATE DEFAULT NULL COMMENT '下次检验日期',
      remarks TEXT COMMENT '备注',
      remark TEXT COMMENT '备注(兼容字段)',
      created_by INT DEFAULT NULL COMMENT '创建人',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
      updated_at DATETIME DEFAULT NULL COMMENT '更新时间',
      INDEX idx_sei_tenant (tenant_id),
      INDEX idx_sei_equipment (equipment_id),
      INDEX idx_sei_inspection_date (inspection_date),
      INDEX idx_sei_next_inspection_date (next_inspection_date),
      INDEX idx_sei_next_date (next_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='特种设备检验记录表'
  `);

  return true;
}

async function normalizeColumnTypes() {
  const columns = await getColumns(TABLE_NAME);
  const map = new Map(columns.map(c => [c.COLUMN_NAME, c.COLUMN_TYPE]));

  const inspectionType = (map.get('inspection_type') || '').toLowerCase();
  if (inspectionType.startsWith('enum(')) {
    await db.execute(
      `ALTER TABLE ${TABLE_NAME}
       MODIFY COLUMN inspection_type VARCHAR(50) NOT NULL DEFAULT 'regular' COMMENT '检验类型'`,
    );
    console.log('✅ inspection_type 已从 ENUM 规范为 VARCHAR(50)');
  }

  const inspectionResult = (map.get('inspection_result') || '').toLowerCase();
  if (inspectionResult.startsWith('enum(')) {
    await db.execute(
      `ALTER TABLE ${TABLE_NAME}
       MODIFY COLUMN inspection_result VARCHAR(50) DEFAULT NULL COMMENT '检验结果'`,
    );
    console.log('✅ inspection_result 已从 ENUM 规范为 VARCHAR(50)');
  }
}

async function backfillInspectionCode() {
  await db.execute(
    `UPDATE ${TABLE_NAME}
     SET inspection_code = CONCAT('INS-', id)
     WHERE inspection_code IS NULL OR inspection_code = ''`,
  );
}

async function migrateSpecialEquipmentInspections() {
  console.log(`开始执行迁移: ${TABLE_NAME}`);

  const created = await createTableIfNeeded();
  if (created) {
    console.log(`✅ 已创建表: ${TABLE_NAME}`);
  } else {
    console.log(`ℹ️ 表已存在: ${TABLE_NAME}`);
  }

  const added = [];
  const maybeAdd = async (name, def) => {
    if (await ensureColumn(TABLE_NAME, name, def)) added.push(name);
  };

  await maybeAdd('tenant_id', "INT NOT NULL DEFAULT 1 COMMENT '租户ID'");
  await maybeAdd('inspection_code', "VARCHAR(50) DEFAULT NULL COMMENT '检验编号'");
  await maybeAdd('equipment_id', "INT DEFAULT NULL COMMENT '特种设备ID'");
  await maybeAdd('inspection_type', "VARCHAR(50) NOT NULL DEFAULT 'regular' COMMENT '检验类型'");
  await maybeAdd('inspection_date', "DATE DEFAULT NULL COMMENT '检验日期'");
  await maybeAdd('inspection_result', "VARCHAR(50) DEFAULT NULL COMMENT '检验结果'");
  await maybeAdd('inspection_org', "VARCHAR(200) DEFAULT NULL COMMENT '检验机构'");
  await maybeAdd('inspection_agency', "VARCHAR(200) DEFAULT NULL COMMENT '检验机构(兼容字段)'");
  await maybeAdd('inspector', "VARCHAR(100) DEFAULT NULL COMMENT '检验人员'");
  await maybeAdd('inspection_items', "TEXT COMMENT '检验项目'");
  await maybeAdd('inspection_content', "TEXT COMMENT '检验内容'");
  await maybeAdd('issues_found', "TEXT COMMENT '发现问题'");
  await maybeAdd('rectification_measures', "TEXT COMMENT '整改措施'");
  await maybeAdd('rectification_deadline', "DATE DEFAULT NULL COMMENT '整改期限'");
  await maybeAdd('certificate_no', "VARCHAR(100) DEFAULT NULL COMMENT '证书编号'");
  await maybeAdd('certificate_image', "VARCHAR(500) DEFAULT NULL COMMENT '证书图片'");
  await maybeAdd('next_date', "DATE DEFAULT NULL COMMENT '下次检验日期(兼容字段)'");
  await maybeAdd('next_inspection_date', "DATE DEFAULT NULL COMMENT '下次检验日期'");
  await maybeAdd('remarks', "TEXT COMMENT '备注'");
  await maybeAdd('remark', "TEXT COMMENT '备注(兼容字段)'");
  await maybeAdd('created_by', "INT DEFAULT NULL COMMENT '创建人'");
  await maybeAdd('created_at', "TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间'");
  await maybeAdd('updated_at', "DATETIME DEFAULT NULL COMMENT '更新时间'");

  if (added.length > 0) {
    console.log(`✅ 新增字段: ${added.join(', ')}`);
  } else {
    console.log('ℹ️ 字段完整，无需新增');
  }

  await normalizeColumnTypes();
  await backfillInspectionCode();

  const addedIndexes = [];
  const maybeIndex = async (name, columns) => {
    if (await ensureIndex(TABLE_NAME, name, columns)) addedIndexes.push(name);
  };

  await maybeIndex('idx_sei_tenant', 'tenant_id');
  await maybeIndex('idx_sei_equipment', 'equipment_id');
  await maybeIndex('idx_sei_inspection_date', 'inspection_date');
  await maybeIndex('idx_sei_next_inspection_date', 'next_inspection_date');
  await maybeIndex('idx_sei_next_date', 'next_date');

  if (addedIndexes.length > 0) {
    console.log(`✅ 新增索引: ${addedIndexes.join(', ')}`);
  } else {
    console.log('ℹ️ 索引完整，无需新增');
  }

  console.log(`✅ 迁移完成: ${TABLE_NAME}`);
}

if (require.main === module) {
  migrateSpecialEquipmentInspections()
    .then(async () => {
      await db.end();
      process.exit(0);
    })
    .catch(async error => {
      console.error('❌ 迁移失败:', error.message);
      await db.end();
      process.exit(1);
    });
}

module.exports = migrateSpecialEquipmentInspections;
