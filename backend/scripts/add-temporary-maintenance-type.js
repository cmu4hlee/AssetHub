/**
 * 迁移脚本：maintenance_logs 表 maintenance_type 枚举增加 '临时保养'
 *
 * 用法：
 *   node scripts/add-temporary-maintenance-type.js
 */
require('dotenv').config();
const db = require('../config/database');

async function run() {
  console.log('[临时保养] 开始迁移 maintenance_logs.maintenance_type 枚举...');

  // MySQL ALTER COLUMN 重定义 ENUM，保留已有值并追加 '临时保养'
  const sql = `
    ALTER TABLE maintenance_logs
    MODIFY COLUMN maintenance_type
    ENUM('日常维护','预防性维护','故障维修','定期保养','临时保养','其他')
    NOT NULL COMMENT '维护类型'
  `;

  try {
    await db.execute(sql);
    console.log('[临时保养] maintenance_logs.maintenance_type 枚举已更新，新增 "临时保养"');
  } catch (error) {
    if (error.code === 'ER_DUP_FIELDNAME' || (error.message && error.message.includes('Duplicate'))) {
      console.log('[临时保养] 枚举值已存在，跳过');
    } else {
      throw error;
    }
  }

  // 更新统计视图（如果存在）
  try {
    await db.execute(`
      CREATE OR REPLACE VIEW v_maintenance_statistics AS
      SELECT
        asset_id,
        asset_code,
        asset_name,
        tenant_id,
        COUNT(*) AS total_maintenance_count,
        COALESCE(SUM(maintenance_cost), 0) AS total_maintenance_cost,
        MAX(maintenance_date) AS last_maintenance_date,
        MIN(maintenance_date) AS first_maintenance_date,
        SUM(CASE WHEN maintenance_type = '故障维修' THEN 1 ELSE 0 END) AS fault_repair_count,
        SUM(CASE WHEN maintenance_type = '预防性维护' THEN 1 ELSE 0 END) AS preventive_maintenance_count,
        SUM(CASE WHEN maintenance_type = '日常维护' THEN 1 ELSE 0 END) AS routine_maintenance_count,
        SUM(CASE WHEN maintenance_type = '临时保养' THEN 1 ELSE 0 END) AS temporary_maintenance_count
      FROM maintenance_logs
      GROUP BY asset_id, asset_code, asset_name, tenant_id
    `);
    console.log('[临时保养] 统计视图 v_maintenance_statistics 已更新');
  } catch (viewError) {
    console.warn('[临时保养] 更新统计视图失败（非阻塞）:', viewError.message);
  }

  console.log('[临时保养] 迁移完成');
  process.exit(0);
}

run().catch(err => {
  console.error('[临时保养] 迁移失败:', err);
  process.exit(1);
});
