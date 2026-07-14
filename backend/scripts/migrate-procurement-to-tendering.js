/**
 * 一次性数据迁移：procurement_requests → tender_projects（统一闭环）
 *
 * 用法：
 *   node backend/scripts/migrate-procurement-to-tendering.js
 *   node backend/scripts/migrate-procurement-to-tendering.js --rollback  # 回滚（删除迁移产生的行）
 *
 * 幂等：
 *   通过 tender_projects.procurement_request_id 反查，避免重复迁移。
 *   procurement_requests.migrated_to_tender_id 用于追溯。
 *
 * 映射规则：
 *   tender_category = 'simple'（默认）
 *   status =
 *     draft/pending/pending_approval → applying
 *     approved                        → awarded
 *     executing                       → contract_signing
 *     completed                       → completed
 *     rejected                        → cancelled（不写入 tender_projects，直接打日志）
 *
 *   procurement_files (file_type IN ('tender','quotation','specification')) 复制到 tender_files
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const db = require('../config/database');
const logger = require('../config/logger');

const STATUS_MAP = {
  draft: 'applying',
  pending: 'applying',
  pending_approval: 'applying',
  approved: 'awarded',
  executing: 'contract_signing',
  completed: 'completed',
};

async function ensure009Applied() {
  // 强制执行 009，避开 ensureTables 缓存
  const fs = require('fs');
  const sql = fs.readFileSync(
    path.join(__dirname, '../modules/tendering-management/migrations/009_unify_procurement_tendering.sql'),
    'utf8',
  );
  const stmts = sql
    .split('\n').filter(l => !l.trim().startsWith('--')).join('\n')
    .split(';').map(s => s.trim()).filter(Boolean);
  for (const stmt of stmts) {
    try { await db.execute(stmt); }
    catch (e) { logger.warn('[009] 跳过:', e.message); }
  }
}

async function run() {
  await ensure009Applied();

  // 0) 备份 old 表
  const [exists] = await db.execute(
    `SELECT TABLE_NAME FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'procurement_requests_backup'` );
  if (exists.length === 0) {
    logger.info('备份 procurement_requests → procurement_requests_backup ...');
    await db.execute('CREATE TABLE procurement_requests_backup AS SELECT * FROM procurement_requests');
    logger.info('备份完成');
  } else {
    logger.info('已存在 procurement_requests_backup，跳过备份');
  }

  // 0.1) 补 migrated_to_tender_id 反向字段
  const [legacyCol] = await db.execute(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'procurement_requests' AND COLUMN_NAME = 'migrated_to_tender_id'` );
  if (legacyCol.length === 0) {
    try {
      await db.execute('ALTER TABLE procurement_requests ADD COLUMN migrated_to_tender_id INT NULL AFTER id');
      logger.info('procurement_requests 新增 migrated_to_tender_id 字段');
    } catch (e) {
      logger.warn('procurement_requests.migrated_to_tender_id 字段添加失败(可忽略):', e.message);
    }
  }

  // 1) 拉取历史数据（排除已回写或已迁移）
  const [rows] = await db.execute(
    `SELECT pr.*
     FROM procurement_requests pr
     LEFT JOIN tender_projects tp ON tp.procurement_request_id = pr.id
     WHERE pr.migrated_to_tender_id IS NULL AND tp.id IS NULL` );

  if (rows.length === 0) {
    logger.info('没有需要迁移的 procurement_requests 记录');
    return { migrated: 0, skipped: 0 };
  }

  let migrated = 0, skipped = 0;
  for (const row of rows) {
    const statusNorm = String(row.status || '').toLowerCase().trim();
    const mappedStatus = STATUS_MAP[statusNorm];
    if (!mappedStatus) {
      logger.warn(`跳过 procurement_requests.id=${row.id}：未识别状态 ${row.status}`);
      skipped += 1;
      continue;
    }

    // 计算时间
    const baseDate = row.request_date ? new Date(row.request_date) : new Date(row.created_at || Date.now());
    const publishDate = new Date(baseDate); publishDate.setDate(publishDate.getDate() + 30);
    const deadline = new Date(baseDate); deadline.setDate(deadline.getDate() + 45);
    const openBidDate = new Date(baseDate); openBidDate.setDate(openBidDate.getDate() + 46);

    const tenderCode = `MIG-${row.request_code || `LEGACY-${row.id}`}`;

    try {
      await db.execute('START TRANSACTION');
      const [insert] = await db.execute(
        `INSERT INTO tender_projects (
          tenant_id, tender_code, title, tender_type, tender_category,
          description, asset_code, asset_name, department, budget_amount, currency, tender_method,
          publish_date, deadline, open_bid_date, contact_person, contact_phone, status, remark,
          procurement_request_id,
          requestor_id, requestor_name, request_department, request_budget,
          expected_delivery_date, asset_specification,
          created_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          row.tenant_id || 1,
          tenderCode,
          row.title || row.asset_name || '历史采购申请',
          'asset_purchase',
          'simple',
          row.description || row.justification || row.remark || null,
          row.asset_code || null,
          row.asset_name || null,
          row.department || null,
          Number(row.budget_amount || row.budget || row.estimated_budget || 0),
          row.currency || 'CNY',
          'public',
          publishDate,
          deadline,
          openBidDate,
          row.contact_person || row.requester_name || null,
          row.contact_phone || null,
          mappedStatus,
          row.remark || null,
          row.id,
          row.requester_id || null,
          row.requester_name || row.applicant || null,
          row.department || null,
          Number(row.budget_amount || row.budget || row.estimated_budget || 0),
          row.expected_date || null,
          row.specification || row.reason || null,
          row.requester_id || row.created_by || null,
          row.created_at || new Date(),
        ],
      );

      // 回写追溯字段
      await db.execute(
        'UPDATE procurement_requests SET migrated_to_tender_id = ? WHERE id = ?',
        [insert.insertId, row.id],
      );

      // 迁移 procurement_files → tender_files
      const [files] = await db.execute(
        'SELECT * FROM procurement_files WHERE request_id = ? AND file_type IN ("tender","quotation","specification")',
        [row.id],
      );
      for (const f of files) {
        await db.execute(
          `INSERT INTO tender_files (
            tenant_id, tender_id, file_type, original_name, file_name, file_path, mime_type, file_size, uploaded_by, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            f.tenant_id || row.tenant_id || 1,
            insert.insertId,
            f.file_type || 'attachment',
            f.file_name || f.original_name,
            f.file_name,
            f.file_path,
            null,
            f.file_size || 0,
            f.uploaded_by,
            f.upload_time || f.created_at || new Date(),
          ],
        );
      }

      await db.execute('COMMIT');
      migrated += 1;
      logger.info(`迁移 procurement_requests.id=${row.id} → tender_projects.id=${insert.insertId}`);
    } catch (err) {
      await db.execute('ROLLBACK');
      logger.error(`迁移 procurement_requests.id=${row.id} 失败:`, err.message);
      skipped += 1;
    }
  }

  // 2) 校验
  const [count] = await db.execute(
    `SELECT COUNT(*) AS total FROM tender_projects WHERE procurement_request_id IS NOT NULL` );
  const [legacyCount] = await db.execute(
    `SELECT COUNT(*) AS total FROM procurement_requests WHERE migrated_to_tender_id IS NOT NULL` );
  logger.info(`已迁移 tender_projects = ${count[0].total}, 已回写 procurement_requests = ${legacyCount[0].total}`);

  return { migrated, skipped };
}

async function rollback() {
  logger.warn('回滚迁移：删除 procurement_request_id IS NOT NULL 的 tender_projects 行与对应 tender_files');
  const [rows] = await db.execute(
    `SELECT id FROM tender_projects WHERE procurement_request_id IS NOT NULL` );
  for (const t of rows) {
    await db.execute('DELETE FROM tender_files WHERE tender_id = ?', [t.id]);
  }
  const [{ affectedRows }] = await db.execute(
    `DELETE FROM tender_projects WHERE procurement_request_id IS NOT NULL` );
  await db.execute(
    `UPDATE procurement_requests SET migrated_to_tender_id = NULL WHERE migrated_to_tender_id IS NOT NULL` );
  logger.warn(`已回滚 tender_projects ${affectedRows} 行`);
}

(async () => {
  try {
    if (process.argv.includes('--rollback')) {
      await rollback();
    } else {
      const result = await run();
      logger.info(`迁移完成：migrated=${result.migrated}, skipped=${result.skipped}`);
    }
    process.exit(0);
  } catch (err) {
    logger.error('迁移脚本异常:', err);
    process.exit(1);
  }
})();
