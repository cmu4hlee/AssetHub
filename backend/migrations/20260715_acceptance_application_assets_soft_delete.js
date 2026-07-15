/**
 * 验收申请-资产关联表 - 软删除字段补全
 *
 * 给 acceptance_application_assets 加 is_deleted / deleted_at / deleted_by 字段。
 * 配合 P1-3 多资产批量验收接口一起提交。
 *
 * 执行方式：cd backend && node migrations/20260715_acceptance_application_assets_soft_delete.js
 * 兼容性：ALTER 通过 information_schema 探测，幂等可重复执行。
 */

const db = require('../config/database');
const logger = require('../config/logger');

const TABLE = 'acceptance_application_assets';

async function ensureColumn(conn, table, column, definition) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column],
  );
  if (rows[0].cnt > 0) return false;
  await conn.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
  return true;
}

async function ensureIndex(conn, table, indexName, columns) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS cnt FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [table, indexName],
  );
  if (rows[0].cnt > 0) return false;
  await conn.query(`ALTER TABLE \`${table}\` ADD INDEX \`${indexName}\` (${columns})`);
  return true;
}

async function main() {
  const conn = await db.getConnection();
  try {
    logger.info('[acceptance-application-assets-soft-delete] 开始执行...');

    const c1 = await ensureColumn(conn, TABLE, 'is_deleted', "TINYINT(1) NOT NULL DEFAULT 0 COMMENT '软删除标记'");
    logger.info(`  - is_deleted: ${c1 ? '已添加' : '已存在'}`);
    const c2 = await ensureColumn(conn, TABLE, 'deleted_at', "DATETIME NULL DEFAULT NULL COMMENT '软删除时间'");
    logger.info(`  - deleted_at: ${c2 ? '已添加' : '已存在'}`);
    const c3 = await ensureColumn(conn, TABLE, 'deleted_by', "VARCHAR(50) NULL DEFAULT NULL COMMENT '软删除操作人'");
    logger.info(`  - deleted_by: ${c3 ? '已添加' : '已存在'}`);

    const i1 = await ensureIndex(conn, TABLE, `idx_${TABLE}_tenant_deleted`, '`tenant_id`,`is_deleted`');
    logger.info(`  - idx_${TABLE}_tenant_deleted: ${i1 ? '已添加' : '已存在'}`);

    logger.info('[acceptance-application-assets-soft-delete] 完成');
  } catch (error) {
    logger.error('[acceptance-application-assets-soft-delete] 执行失败:', error);
    throw error;
  } finally {
    conn.release();
  }
}

if (require.main === module) {
  main()
    .then(() => { console.log('\n✅ 迁移完成'); process.exit(0); })
    .catch((e) => { console.error('\n❌ 迁移失败:', e); process.exit(1); });
}

module.exports = { main };
