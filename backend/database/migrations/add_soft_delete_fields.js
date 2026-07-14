/**
 * 软删除机制数据库迁移
 * 为关键业务表添加 is_deleted 和 deleted_at 字段
 */

const db = require('../../config/database');

const tables = [
  { name: 'assets', comment: '资产表' },
  { name: 'asset_scrapping_records', comment: '报废记录表' },
  { name: 'metrology_records', comment: '计量记录表' },
  { name: 'inventory_records', comment: '盘点记录表' },
  { name: 'inventory_details', comment: '盘点明细表' },
  { name: 'asset_acceptance_records', comment: '验收记录表' },
  { name: 'maintenance_records', comment: '维保记录表' },
  { name: 'quality_control_records', comment: '质控记录表' },
];

async function addSoftDeleteFields() {
  console.log('[Migration] 开始添加软删除字段...\n');

  for (const table of tables) {
    try {
      // 检查字段是否已存在
      const [columns] = await db.execute(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = ? 
        AND COLUMN_NAME = 'is_deleted'
      `, [table.name]);

      if (columns.length === 0) {
        // 添加软删除字段
        await db.execute(`
          ALTER TABLE ${table.name} 
          ADD COLUMN is_deleted TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否已删除(0:否,1:是)',
          ADD COLUMN deleted_at DATETIME DEFAULT NULL COMMENT '删除时间',
          ADD COLUMN deleted_by VARCHAR(64) DEFAULT NULL COMMENT '删除人ID'
        `);
        console.log(`✅ ${table.name} (${table.comment}): 已添加软删除字段`);

        // 创建索引
        await db.execute(`
          CREATE INDEX idx_${table.name}_is_deleted ON ${table.name}(is_deleted)
        `);
        console.log(`   📇 已创建索引 idx_${table.name}_is_deleted`);
      } else {
        console.log(`ℹ️ ${table.name} (${table.comment}): 字段已存在，跳过`);
      }
    } catch (error) {
      console.error(`❌ ${table.name}: 添加失败 - ${error.message}`);
    }
  }

  console.log('\n[Migration] ✅ 软删除字段添加完成');
}

// 创建软删除视图（可选，用于简化查询）
async function createActiveViews() {
  console.log('\n[Migration] 创建活跃数据视图...\n');

  for (const table of tables) {
    const viewName = `${table.name}_active`;
    try {
      // 删除旧视图
      await db.execute(`DROP VIEW IF EXISTS ${viewName}`);

      // 创建新视图
      await db.execute(`
        CREATE VIEW ${viewName} AS
        SELECT * FROM ${table.name}
        WHERE is_deleted = 0 OR is_deleted IS NULL
      `);
      console.log(`✅ 已创建视图: ${viewName}`);
    } catch (error) {
      console.error(`❌ 视图 ${viewName} 创建失败: ${error.message}`);
    }
  }
}

// 修改现有查询为软删除（通过触发器或应用层实现）
async function runMigration() {
  try {
    await addSoftDeleteFields();
    await createActiveViews();

    console.log('\n🎉 软删除迁移全部完成！');
    console.log('\n下一步：');
    console.log('1. 修改应用层删除逻辑');
    console.log('2. 修改查询逻辑添加 is_deleted = 0 条件');

    process.exit(0);
  } catch (error) {
    console.error('\n💥 迁移失败:', error.message);
    process.exit(1);
  }
}

runMigration();
