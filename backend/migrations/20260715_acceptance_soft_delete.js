/**
 * 验收管理模块 - 软删除一致性补全
 *
 * 给以下 6 张子表补 is_deleted / deleted_at / deleted_by 字段 + 索引：
 *   1. acceptance_approvals       (审批轨迹)
 *   2. acceptance_teams           (验收小组)
 *   3. acceptance_reminders       (提醒)
 *   4. asset_acceptance_checklist (验收清单)
 *   5. asset_acceptance_files     (验收文件)
 *   6. asset_acceptance_templates (验收模板)
 *
 * 背景：
 *   验收申请 (acceptance_applications) 和验收记录 (asset_acceptance_records) 已有 is_deleted 字段，
 *   但子表没有。删除主表时子表会失联，导致"幽灵数据"。
 *
 * 执行方式：
 *   cd backend && node migrations/20260715_acceptance_soft_delete.js
 *
 * 兼容性：所有 ALTER 均为 IF NOT EXISTS / 添加列幂等，可重复执行。
 */

const db = require('../config/database');
const logger = require('../config/logger');

const SUBTABLES = [
  // [表名, 是否需要 tenant_id 索引（已经有了？）, 说明]
  { name: 'acceptance_approvals', note: '审批轨迹' },
  { name: 'acceptance_teams', note: '验收小组' },
  { name: 'acceptance_reminders', note: '验收提醒' },
  { name: 'asset_acceptance_checklist', note: '验收清单' },
  { name: 'asset_acceptance_files', note: '验收文件' },
  { name: 'asset_acceptance_templates', note: '验收模板' },
];

async function ensureColumn(conn, table, column, definition) {
  // MySQL 8 不支持 IF NOT EXISTS on ADD COLUMN，所以用 information_schema 探测
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS cnt
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column],
  );
  if (rows[0].cnt > 0) {
    return false; // 已存在
  }
  await conn.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
  return true;
}

async function ensureIndex(conn, table, indexName, columns) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS cnt
     FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [table, indexName],
  );
  if (rows[0].cnt > 0) {
    return false;
  }
  await conn.query(`ALTER TABLE \`${table}\` ADD INDEX \`${indexName}\` (${columns})`);
  return true;
}

async function main() {
  const conn = await db.getConnection();
  try {
    logger.info('[acceptance-soft-delete-migration] 开始执行...');

    let totalColumns = 0;
    let totalIndexes = 0;

    for (const { name, note } of SUBTABLES) {
      logger.info(`处理表 ${name} (${note})`);

      // 1) is_deleted TINYINT(1) DEFAULT 0
      const c1 = await ensureColumn(conn, name, 'is_deleted', "TINYINT(1) NOT NULL DEFAULT 0 COMMENT '软删除标记：0-正常，1-已删除'");
      if (c1) totalColumns++;
      logger.info(`  - is_deleted: ${c1 ? '已添加' : '已存在'}`);

      // 2) deleted_at DATETIME NULL
      const c2 = await ensureColumn(conn, name, 'deleted_at', "DATETIME NULL DEFAULT NULL COMMENT '软删除时间'");
      if (c2) totalColumns++;
      logger.info(`  - deleted_at: ${c2 ? '已添加' : '已存在'}`);

      // 3) deleted_by VARCHAR(50) NULL
      const c3 = await ensureColumn(conn, name, 'deleted_by', "VARCHAR(50) NULL DEFAULT NULL COMMENT '软删除操作人'");
      if (c3) totalColumns++;
      logger.info(`  - deleted_by: ${c3 ? '已添加' : '已存在'}`);

      // 4) 复合索引：tenant_id + is_deleted（如果还没）
      const i1 = await ensureIndex(conn, name, `idx_${name}_tenant_deleted`, '`tenant_id`,`is_deleted`');
      if (i1) totalIndexes++;
      logger.info(`  - idx_${name}_tenant_deleted: ${i1 ? '已添加' : '已存在'}`);

      logger.info('');
    }

    logger.info(`[acceptance-soft-delete-migration] 完成。新增列 ${totalColumns} 个，新增索引 ${totalIndexes} 个。`);
  } catch (error) {
    logger.error('[acceptance-soft-delete-migration] 执行失败:', error);
    throw error;
  } finally {
    conn.release();
  }
}

if (require.main === module) {
  main()
    .then(() => {
      console.log('\n✅ 迁移完成');
      process.exit(0);
    })
    .catch((e) => {
      console.error('\n❌ 迁移失败:', e);
      process.exit(1);
    });
}

module.exports = { main, SUBTABLES };
