const path = require('path');
const fs = require('fs');

const envPath = path.join(__dirname, '../.env');
const parentEnvPath = path.join(__dirname, '../../.env');

if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
} else if (fs.existsSync(parentEnvPath)) {
  require('dotenv').config({ path: parentEnvPath });
} else {
  require('dotenv').config();
}

const db = require('../config/database');

async function ensureMaintenanceTemplateColumns() {
  const [columns] = await db.execute(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'maintenance_templates'`,
  );
  const existing = new Set(columns.map(c => c.COLUMN_NAME));

  const additions = [];
  const addColumn = (name, ddl) => {
    if (!existing.has(name)) additions.push(`ADD COLUMN ${name} ${ddl}`);
  };

  // 模板分类(供前端按类别筛选)
  addColumn('category', "VARCHAR(50) DEFAULT NULL COMMENT '模板分类：医疗/IT/车辆/生产等' AFTER asset_type");
  // 版本号,默认 1
  addColumn('version', "INT NOT NULL DEFAULT 1 COMMENT '版本号' AFTER template_name");
  // 子分类/二级类别
  addColumn('sub_category', "VARCHAR(100) DEFAULT NULL COMMENT '子分类,如CT/MRI/超声' AFTER category");

  for (const stmt of additions) {
    await db.execute(`ALTER TABLE maintenance_templates ${stmt}`);
  }

  if (additions.length > 0) {
    console.log(`✓ 维护计划模板新增字段: ${additions.join('; ')}`);
  } else {
    console.log('✓ maintenance_templates 字段已具备');
  }
}

async function ensurePreventiveMaintenancePlanFK() {
  // 给 preventive_maintenance_plans.template_id 增加外键(若不存在)以及索引
  const [fks] = await db.execute(
    `SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS
     WHERE CONSTRAINT_SCHEMA = DATABASE()
       AND TABLE_NAME = 'preventive_maintenance_plans'
       AND REFERENCED_TABLE_NAME = 'maintenance_templates'`,
  );
  if (fks.length === 0) {
    // 检查 template_id 列是否存在
    const [cols] = await db.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'preventive_maintenance_plans'
         AND COLUMN_NAME = 'template_id'`,
    );
    if (cols.length > 0) {
      try {
        await db.execute(
          `ALTER TABLE preventive_maintenance_plans
           ADD CONSTRAINT fk_plan_template
           FOREIGN KEY (template_id) REFERENCES maintenance_templates(id)
           ON DELETE RESTRICT`,
        );
        console.log('✓ preventive_maintenance_plans.template_id 添加外键 fk_plan_template');
      } catch (err) {
        // 若历史数据存在悬挂引用,先置 NULL 再加外键
        console.warn('无法直接添加外键,清理悬挂引用后重试:', err.message);
        await db.execute(`UPDATE preventive_maintenance_plans SET template_id = NULL WHERE template_id IS NOT NULL
          AND template_id NOT IN (SELECT id FROM maintenance_templates)`);
        await db.execute(
          `ALTER TABLE preventive_maintenance_plans
           ADD CONSTRAINT fk_plan_template
           FOREIGN KEY (template_id) REFERENCES maintenance_templates(id)
           ON DELETE RESTRICT`,
        );
      }
    }
  }

  const [idx] = await db.execute(
    `SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'preventive_maintenance_plans'
       AND INDEX_NAME = 'idx_template_id'`,
  );
  if (idx.length === 0) {
    try {
      await db.execute(`CREATE INDEX idx_template_id ON preventive_maintenance_plans(template_id)`);
      console.log('✓ 添加索引 idx_template_id');
    } catch (e) {
      console.warn('索引添加失败:', e.message);
    }
  }
}

async function run() {
  try {
    await ensureMaintenanceTemplateColumns();
    await ensurePreventiveMaintenancePlanFK();
    console.log('\n✅ 维护模板表结构增强完成');
  } catch (error) {
    console.error('❌ 增强失败:', error);
    process.exitCode = 1;
  } finally {
    await db.end();
  }
}

if (require.main === module) {
  run();
}

module.exports = {
  ensureMaintenanceTemplateColumns,
  ensurePreventiveMaintenancePlanFK,
};
