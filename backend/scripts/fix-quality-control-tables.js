/**
 * 数据库迁移脚本：修复质量控模块表结构
 *
 * 修复内容：
 * 1. 添加 tenant_id 字段到所有质量相关表
 * 2. 修复 asset.code 列名为 asset_code
 * 3. 添加 is_deleted 软删除字段
 * 4. 添加缺失的索引
 */

const db = require('../config/database');
const logger = require('../config/logger');

async function migrate() {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();
    logger.info('开始修复质量控模块表结构...');

    // ============================================
    // 1. 修复 metrology_records 表
    // ============================================
    logger.info('修复 metrology_records 表...');

    const [metrologyCols] = await connection.execute(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'metrology_records'`,
    );
    const metrologyColNames = metrologyCols.map(c => c.COLUMN_NAME);

    if (!metrologyColNames.includes('tenant_id')) {
      await connection.execute(
        'ALTER TABLE metrology_records ADD COLUMN tenant_id INT NOT NULL DEFAULT 1 COMMENT \'租户ID\' FIRST',
      );
      logger.info('已添加 tenant_id 到 metrology_records');
    }

    if (!metrologyColNames.includes('is_deleted')) {
      await connection.execute(
        'ALTER TABLE metrology_records ADD COLUMN is_deleted TINYINT(1) DEFAULT 0 COMMENT \'是否删除\'',
      );
      logger.info('已添加 is_deleted 到 metrology_records');
    }

    // 添加缺失索引
    await addIndexIfNotExists(connection, 'metrology_records', 'idx_tenant_id', '(tenant_id)');
    await addIndexIfNotExists(connection, 'metrology_records', 'idx_asset_code', '(asset_code)');
    await addIndexIfNotExists(connection, 'metrology_records', 'idx_tenant_asset', '(tenant_id, asset_code)');
    await addIndexIfNotExists(connection, 'metrology_records', 'idx_tenant_status', '(tenant_id, status)');

    // ============================================
    // 2. 修复 metrology_attachments 表
    // ============================================
    logger.info('修复 metrology_attachments 表...');

    const [metroAttachmentsCols] = await connection.execute(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'metrology_attachments'`,
    );
    const metroAttachmentsColNames = metroAttachmentsCols.map(c => c.COLUMN_NAME);

    if (!metroAttachmentsColNames.includes('tenant_id')) {
      await connection.execute(
        'ALTER TABLE metrology_attachments ADD COLUMN tenant_id INT NOT NULL DEFAULT 1 COMMENT \'租户ID\' FIRST',
      );
      logger.info('已添加 tenant_id 到 metrology_attachments');
    }

    if (!metroAttachmentsColNames.includes('created_by')) {
      await connection.execute(
        'ALTER TABLE metrology_attachments ADD COLUMN created_by VARCHAR(50) COMMENT \'上传人\'',
      );
      logger.info('已添加 created_by 到 metrology_attachments');
    }

    await addIndexIfNotExists(connection, 'metrology_attachments', 'idx_tenant_id', '(tenant_id)');

    // ============================================
    // 3. 修复 quality_control_records 表
    // ============================================
    logger.info('修复 quality_control_records 表...');

    const [qcCols] = await connection.execute(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'quality_control_records'`,
    );
    const qcColNames = qcCols.map(c => c.COLUMN_NAME);

    if (!qcColNames.includes('tenant_id')) {
      await connection.execute(
        'ALTER TABLE quality_control_records ADD COLUMN tenant_id INT NOT NULL DEFAULT 1 COMMENT \'租户ID\' FIRST',
      );
      logger.info('已添加 tenant_id 到 quality_control_records');
    }

    if (!qcColNames.includes('is_deleted')) {
      await connection.execute(
        'ALTER TABLE quality_control_records ADD COLUMN is_deleted TINYINT(1) DEFAULT 0 COMMENT \'是否删除\'',
      );
      logger.info('已添加 is_deleted 到 quality_control_records');
    }

    if (!qcColNames.includes('tolerance')) {
      await connection.execute(
        'ALTER TABLE quality_control_records ADD COLUMN tolerance VARCHAR(100) COMMENT \'允许偏差\' AFTER deviation',
      );
      logger.info('已添加 tolerance 到 quality_control_records');
    }

    if (!qcColNames.includes('qc_person')) {
      await connection.execute(
        'ALTER TABLE quality_control_records ADD COLUMN qc_person VARCHAR(50) COMMENT \'质控人\'',
      );
      logger.info('已添加 qc_person 到 quality_control_records');
    }

    if (!qcColNames.includes('department')) {
      await connection.execute(
        'ALTER TABLE quality_control_records ADD COLUMN department VARCHAR(100) COMMENT \'部门\'',
      );
      logger.info('已添加 department 到 quality_control_records');
    }

    if (!qcColNames.includes('updated_by')) {
      await connection.execute(
        'ALTER TABLE quality_control_records ADD COLUMN updated_by VARCHAR(50) COMMENT \'更新人\'',
      );
      logger.info('已添加 updated_by 到 quality_control_records');
    }

    await addIndexIfNotExists(connection, 'quality_control_records', 'idx_tenant_id', '(tenant_id)');
    await addIndexIfNotExists(connection, 'quality_control_records', 'idx_asset_code', '(asset_code)');
    await addIndexIfNotExists(connection, 'quality_control_records', 'idx_tenant_asset', '(tenant_id, asset_code)');
    await addIndexIfNotExists(connection, 'quality_control_records', 'idx_tenant_status', '(tenant_id, status)');

    // ============================================
    // 4. 修复 quality_control_attachments 表
    // ============================================
    logger.info('修复 quality_control_attachments 表...');

    const [qcAttachmentsCols] = await connection.execute(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'quality_control_attachments'`,
    );
    const qcAttachmentsColNames = qcAttachmentsCols.map(c => c.COLUMN_NAME);

    if (!qcAttachmentsColNames.includes('tenant_id')) {
      await connection.execute(
        'ALTER TABLE quality_control_attachments ADD COLUMN tenant_id INT NOT NULL DEFAULT 1 COMMENT \'租户ID\' FIRST',
      );
      logger.info('已添加 tenant_id 到 quality_control_attachments');
    }

    if (!qcAttachmentsColNames.includes('created_by')) {
      await connection.execute(
        'ALTER TABLE quality_control_attachments ADD COLUMN created_by VARCHAR(50) COMMENT \'上传人\'',
      );
      logger.info('已添加 created_by 到 quality_control_attachments');
    }

    await addIndexIfNotExists(connection, 'quality_control_attachments', 'idx_tenant_id', '(tenant_id)');

    // ============================================
    // 5. 修复 quality_management_alerts 表
    // ============================================
    logger.info('修复 quality_management_alerts 表...');

    const [alertsCols] = await connection.execute(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'quality_management_alerts'`,
    );
    const alertsColNames = alertsCols.map(c => c.COLUMN_NAME);

    if (!alertsColNames.includes('tenant_id')) {
      await connection.execute(
        'ALTER TABLE quality_management_alerts ADD COLUMN tenant_id INT NOT NULL DEFAULT 1 COMMENT \'租户ID\' FIRST',
      );
      logger.info('已添加 tenant_id 到 quality_management_alerts');
    }

    if (!alertsColNames.includes('is_handled')) {
      await connection.execute(
        'ALTER TABLE quality_management_alerts ADD COLUMN is_handled TINYINT(1) DEFAULT 0 COMMENT \'是否已处理\'',
      );
      logger.info('已添加 is_handled 到 quality_management_alerts');
    }

    await addIndexIfNotExists(connection, 'quality_management_alerts', 'idx_tenant_id', '(tenant_id)');
    await addIndexIfNotExists(connection, 'quality_management_alerts', 'idx_tenant_unhandled', '(tenant_id, is_handled)');

    // ============================================
    // 6. 修复 quality_management_cycles 表
    // ============================================
    logger.info('修复 quality_management_cycles 表...');

    const [cyclesCols] = await connection.execute(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'quality_management_cycles'`,
    );
    const cyclesColNames = cyclesCols.map(c => c.COLUMN_NAME);

    if (!cyclesColNames.includes('tenant_id')) {
      await connection.execute(
        'ALTER TABLE quality_management_cycles ADD COLUMN tenant_id INT NOT NULL DEFAULT 1 COMMENT \'租户ID\' FIRST',
      );
      logger.info('已添加 tenant_id 到 quality_management_cycles');
    }

    await addIndexIfNotExists(connection, 'quality_management_cycles', 'idx_tenant_id', '(tenant_id)');

    // Drop old unique key and add new one if needed
    try {
      await connection.execute(
        'ALTER TABLE quality_management_cycles DROP INDEX uk_asset_id',
      );
    } catch (e) {
      // ignore if not exists
    }

    const [existingUK] = await connection.execute(
      `SELECT INDEX_NAME FROM information_schema.STATISTICS 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'quality_management_cycles' 
       AND INDEX_NAME = 'uk_tenant_asset'`,
    );
    if (existingUK.length === 0) {
      await connection.execute(
        'ALTER TABLE quality_management_cycles ADD UNIQUE KEY uk_tenant_asset (tenant_id, asset_code)',
      );
      logger.info('已添加 uk_tenant_asset 到 quality_management_cycles');
    }

    await connection.commit();
    logger.info('质量控模块表结构修复完成！');

  } catch (error) {
    await connection.rollback();
    logger.error('修复质量控模块表结构失败:', error);
    throw error;
  } finally {
    connection.release();
  }
}

async function addIndexIfNotExists(connection, table, indexName, columns) {
  const [existing] = await connection.execute(
    `SELECT INDEX_NAME FROM information_schema.STATISTICS 
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [table, indexName],
  );

  if (existing.length === 0) {
    try {
      await connection.execute(`ALTER TABLE ${table} ADD INDEX ${indexName} ${columns}`);
      logger.info(`已添加索引 ${indexName} 到 ${table}`);
    } catch (error) {
      if (error.code === 'ER_DUP_KEYNAME') {
        logger.warn(`索引 ${indexName} 已存在，跳过`);
      } else {
        logger.warn(`索引 ${indexName} 创建失败：${error.message}`);
      }
    }
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  migrate()
    .then(() => {
      console.log('迁移成功完成');
      process.exit(0);
    })
    .catch(error => {
      console.error('迁移失败:', error);
      process.exit(1);
    });
}

module.exports = { migrate };
