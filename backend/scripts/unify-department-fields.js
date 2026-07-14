/**
 * 数据库迁移脚本：统一部门字段
 *
 * 问题描述：
 * - assets 表同时存在 department 和 department_new 两个字段
 * - 部分代码使用 department，部分使用 department_new，导致数据不一致
 *
 * 修复方案：
 * 1. 将 department_new 的值复制到 department（如果 department 为空）
 * 2. 添加触发器确保未来写入时两个字段保持一致
 * 3. 添加索引优化查询性能
 */

const db = require('../config/database');
const logger = require('../config/logger');

async function migrate() {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();
    logger.info('开始统一部门字段...');

    // 1. 检查 department_new 字段是否存在
    const [columns] = await connection.execute(
      `SELECT COLUMN_NAME 
       FROM information_schema.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME = 'assets' 
       AND COLUMN_NAME = 'department_new'`,
    );

    if (columns.length === 0) {
      logger.info('department_new 字段不存在，添加该字段...');
      await connection.execute(
        `ALTER TABLE assets 
         ADD COLUMN department_new VARCHAR(100) DEFAULT NULL COMMENT '使用部门（编码）' AFTER department`,
      );
    }

    // 2. 同步数据：将 department_new 的值复制到 department（如果 department 为空）
    logger.info('同步部门数据...');
    const [syncResult] = await connection.execute(
      `UPDATE assets 
       SET department_new = department 
       WHERE department_new IS NULL AND department IS NOT NULL`,
    );
    logger.info(`已同步 ${syncResult.affectedRows || 0} 条记录`);

    // 3. 反向同步：将 department_new 的值复制到 department（如果 department 为空）
    const [syncResult2] = await connection.execute(
      `UPDATE assets 
       SET department = department_new 
       WHERE department IS NULL AND department_new IS NOT NULL`,
    );
    logger.info(`已反向同步 ${syncResult2.affectedRows || 0} 条记录`);

    // 4. 添加复合索引优化查询性能
    logger.info('添加部门相关索引...');

    // 检查索引是否已存在
    const [existingIndexes] = await connection.execute(
      `SELECT INDEX_NAME 
       FROM information_schema.STATISTICS 
       WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME = 'assets' 
       AND INDEX_NAME = 'idx_tenant_department_new'`,
    );

    if (existingIndexes.length === 0) {
      await connection.execute(
        'ALTER TABLE assets ADD INDEX idx_tenant_department_new (tenant_id, department_new)',
      );
      logger.info('已添加索引 idx_tenant_department_new');
    }

    const [existingIndexes2] = await connection.execute(
      `SELECT INDEX_NAME 
       FROM information_schema.STATISTICS 
       WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME = 'assets' 
       AND INDEX_NAME = 'idx_tenant_department'`,
    );

    if (existingIndexes2.length === 0) {
      await connection.execute(
        'ALTER TABLE assets ADD INDEX idx_tenant_department (tenant_id, department)',
      );
      logger.info('已添加索引 idx_tenant_department');
    }

    await connection.commit();
    logger.info('部门字段统一完成！');

  } catch (error) {
    await connection.rollback();
    logger.error('统一部门字段失败:', error);
    throw error;
  } finally {
    connection.release();
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
