/**
 * 工单签名+评价字段迁移
 *
 * 给 work_orders 加 8 个可空列：
 *   engineer_signature / engineer_signed_at       — 工程师完成手写签名（必填，MEDIUMTEXT 存 base64）
 *   applicant_rating / applicant_comment          — 申请人 5 星评分 + 评价内容
 *   applicant_signature / applicant_signed_at     — 申请人手写签名（可选）
 *   applicant_signed_by                            — 实际评价人姓名
 *   evaluated_at                                   — 评价完成时间
 *
 * 用 INFORMATION_SCHEMA 检测列是否已存在，可重入。
 *
 * 使用：node backend/scripts/add-workorder-signature-fields.js
 */
const db = require('../config/database');

const NEW_COLUMNS = [
  {
    name: 'engineer_signature',
    ddl: 'MEDIUMTEXT NULL COMMENT \'工程师完成手写签名（base64 PNG）\'',
  },
  {
    name: 'engineer_signed_at',
    ddl: 'DATETIME NULL COMMENT \'工程师签名时间\'',
  },
  {
    name: 'applicant_rating',
    ddl: 'TINYINT NULL COMMENT \'申请人评分 1-5\'',
  },
  {
    name: 'applicant_comment',
    ddl: 'TEXT NULL COMMENT \'申请人评价内容\'',
  },
  {
    name: 'applicant_signature',
    ddl: 'MEDIUMTEXT NULL COMMENT \'申请人手写签名（base64 PNG，可选）\'',
  },
  {
    name: 'applicant_signed_at',
    ddl: 'DATETIME NULL COMMENT \'申请人签名时间\'',
  },
  {
    name: 'applicant_signed_by',
    ddl: 'VARCHAR(100) NULL COMMENT \'实际评价人姓名\'',
  },
  {
    name: 'evaluated_at',
    ddl: 'DATETIME NULL COMMENT \'评价完成时间\'',
  },
];

async function columnExists(tableName, columnName) {
  const [rows] = await db.execute(
    `SELECT COUNT(*) AS cnt
       FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?`,
    [tableName, columnName],
  );
  return rows[0].cnt > 0;
}

async function run() {
  try {
    // 先确认 work_orders 表存在
    const [tables] = await db.execute(
      `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'work_orders'`,
    );
    if (tables.length === 0) {
      console.error('❌ work_orders 表不存在，请先初始化数据库');
      process.exit(1);
    }

    let added = 0;
    let skipped = 0;
    for (const col of NEW_COLUMNS) {
      // eslint-disable-next-line no-await-in-loop
      const exists = await columnExists('work_orders', col.name);
      if (exists) {
        console.log(`  · 跳过（已存在）: ${col.name}`);
        skipped += 1;
        continue;
      }
      // eslint-disable-next-line no-await-in-loop
      await db.execute(`ALTER TABLE work_orders ADD COLUMN ${col.name} ${col.ddl}`);
      console.log(`  ✓ 已添加: ${col.name}`);
      added += 1;
    }

    console.log(`\n🎉 迁移完成：新增 ${added} 列，跳过 ${skipped} 列`);
    process.exit(0);
  } catch (error) {
    console.error('迁移失败:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  run();
}

module.exports = { run, NEW_COLUMNS };
