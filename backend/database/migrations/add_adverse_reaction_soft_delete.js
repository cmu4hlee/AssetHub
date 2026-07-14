/**
 * 不良事件模块添加软删除支持
 */

const db = require('../../config/database');

async function addSoftDeleteToAdverseReaction() {
  console.log('[Migration] 为不良事件表添加软删除字段...\n');

  try {
    // 检查并添加软删除字段到不良事件记录表
    const [columns] = await db.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'adverse_reaction_records' 
      AND COLUMN_NAME = 'is_deleted'
    `);

    if (columns.length === 0) {
      await db.execute(`
        ALTER TABLE adverse_reaction_records 
        ADD COLUMN is_deleted TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否已删除(0:否,1:是)',
        ADD COLUMN deleted_at DATETIME DEFAULT NULL COMMENT '删除时间',
        ADD COLUMN deleted_by VARCHAR(64) DEFAULT NULL COMMENT '删除人ID'
      `);
      console.log('✅ adverse_reaction_records: 已添加软删除字段');

      // 创建索引
      await db.execute(`
        CREATE INDEX idx_adverse_reaction_is_deleted ON adverse_reaction_records(is_deleted)
      `);
      console.log('   📇 已创建索引 idx_adverse_reaction_is_deleted');
    } else {
      console.log('ℹ️ adverse_reaction_records: 字段已存在，跳过');
    }

    // 创建活跃数据视图
    await db.execute(`
      CREATE OR REPLACE VIEW adverse_reaction_records_active AS
      SELECT * FROM adverse_reaction_records
      WHERE is_deleted = 0 OR is_deleted IS NULL
    `);
    console.log('✅ 已创建视图: adverse_reaction_records_active');

    console.log('\n[Migration] ✅ 不良事件表软删除字段添加完成');
    process.exit(0);
  } catch (error) {
    console.error('\n💥 迁移失败:', error.message);
    process.exit(1);
  }
}

addSoftDeleteToAdverseReaction();
