/**
 * 数据库迁移脚本：修复外键类型不匹配问题
 *
 * 问题描述：
 * - inventory_details.asset_id 外键指向 assets(id)（整数），但实际存储 asset_code（字符串）
 * - transfer_records.asset_id 外键指向 assets(id)（整数），但实际存储 asset_code（字符串）
 * - idle_assets.asset_id 外键指向 assets(id)（整数），但实际存储 asset_code（字符串）
 *
 * 修复方案：
 * 1. 删除旧的外键约束
 * 2. 将 asset_id 字段重命名为 asset_code
 * 3. 创建新的外键约束指向 assets(asset_code)
 * 4. 添加索引优化查询性能
 */

const db = require('../config/database');
const logger = require('../config/logger');

async function migrate() {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();
    logger.info('开始修复外键类型不匹配问题...');

    // 1. 修复 inventory_details 表
    logger.info('修复 inventory_details 表...');

    // 检查并删除旧的外键约束
    const [inventoryFKs] = await connection.execute(
      `SELECT CONSTRAINT_NAME 
       FROM information_schema.KEY_COLUMN_USAGE 
       WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME = 'inventory_details' 
       AND REFERENCED_TABLE_NAME = 'assets' 
       AND COLUMN_NAME = 'asset_id'`,
    );

    if (inventoryFKs.length > 0) {
      const constraintName = inventoryFKs[0].CONSTRAINT_NAME;
      await connection.execute(
        `ALTER TABLE inventory_details DROP FOREIGN KEY ${constraintName}`,
      );
      logger.info(`已删除 inventory_details 的外键约束: ${constraintName}`);
    }

    // 检查 asset_id 字段是否存在
    const [inventoryColumns] = await connection.execute(
      `SELECT COLUMN_NAME, DATA_TYPE 
       FROM information_schema.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME = 'inventory_details' 
       AND COLUMN_NAME = 'asset_id'`,
    );

    if (inventoryColumns.length > 0) {
      // 添加新的 asset_code 字段
      await connection.execute(
        `ALTER TABLE inventory_details 
         ADD COLUMN asset_code_new VARCHAR(100) DEFAULT NULL COMMENT '资产编号' AFTER asset_id`,
      );

      // 复制数据从 asset_id 到 asset_code_new
      await connection.execute(
        `UPDATE inventory_details 
         SET asset_code_new = asset_id 
         WHERE asset_id IS NOT NULL`,
      );

      // 删除旧的 asset_id 字段
      await connection.execute(
        'ALTER TABLE inventory_details DROP COLUMN asset_id',
      );

      // 重命名新字段为 asset_code
      await connection.execute(
        'ALTER TABLE inventory_details CHANGE COLUMN asset_code_new asset_code VARCHAR(100) DEFAULT NULL COMMENT \'资产编号\'',
      );

      logger.info('inventory_details 表修复完成');
    }

    // 添加索引
    await connection.execute(
      'ALTER TABLE inventory_details ADD INDEX idx_asset_code (asset_code)',
    );
    await connection.execute(
      'ALTER TABLE inventory_details ADD INDEX idx_inventory_asset (inventory_id, asset_code)',
    );

    // 创建新的外键约束
    await connection.execute(
      `ALTER TABLE inventory_details 
       ADD CONSTRAINT fk_inventory_asset_code 
       FOREIGN KEY (asset_code) REFERENCES assets(asset_code) ON DELETE CASCADE`,
    );
    logger.info('inventory_details 外键约束创建成功');

    // 2. 修复 transfer_records 表
    logger.info('修复 transfer_records 表...');

    const [transferFKs] = await connection.execute(
      `SELECT CONSTRAINT_NAME 
       FROM information_schema.KEY_COLUMN_USAGE 
       WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME = 'transfer_records' 
       AND REFERENCED_TABLE_NAME = 'assets' 
       AND COLUMN_NAME = 'asset_id'`,
    );

    if (transferFKs.length > 0) {
      const constraintName = transferFKs[0].CONSTRAINT_NAME;
      await connection.execute(
        `ALTER TABLE transfer_records DROP FOREIGN KEY ${constraintName}`,
      );
      logger.info(`已删除 transfer_records 的外键约束: ${constraintName}`);
    }

    const [transferColumns] = await connection.execute(
      `SELECT COLUMN_NAME, DATA_TYPE 
       FROM information_schema.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME = 'transfer_records' 
       AND COLUMN_NAME = 'asset_id'`,
    );

    if (transferColumns.length > 0) {
      await connection.execute(
        `ALTER TABLE transfer_records 
         ADD COLUMN asset_code_new VARCHAR(100) DEFAULT NULL COMMENT '资产编号' AFTER asset_id`,
      );

      await connection.execute(
        `UPDATE transfer_records 
         SET asset_code_new = asset_id 
         WHERE asset_id IS NOT NULL`,
      );

      await connection.execute(
        'ALTER TABLE transfer_records DROP COLUMN asset_id',
      );

      await connection.execute(
        'ALTER TABLE transfer_records CHANGE COLUMN asset_code_new asset_code VARCHAR(100) DEFAULT NULL COMMENT \'资产编号\'',
      );

      logger.info('transfer_records 表修复完成');
    }

    await connection.execute(
      'ALTER TABLE transfer_records ADD INDEX idx_asset_code (asset_code)',
    );

    await connection.execute(
      `ALTER TABLE transfer_records 
       ADD CONSTRAINT fk_transfer_asset_code 
       FOREIGN KEY (asset_code) REFERENCES assets(asset_code) ON DELETE CASCADE`,
    );
    logger.info('transfer_records 外键约束创建成功');

    // 3. 修复 idle_assets 表
    logger.info('修复 idle_assets 表...');

    const [idleFKs] = await connection.execute(
      `SELECT CONSTRAINT_NAME 
       FROM information_schema.KEY_COLUMN_USAGE 
       WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME = 'idle_assets' 
       AND REFERENCED_TABLE_NAME = 'assets' 
       AND COLUMN_NAME = 'asset_id'`,
    );

    if (idleFKs.length > 0) {
      const constraintName = idleFKs[0].CONSTRAINT_NAME;
      await connection.execute(
        `ALTER TABLE idle_assets DROP FOREIGN KEY ${constraintName}`,
      );
      logger.info(`已删除 idle_assets 的外键约束: ${constraintName}`);
    }

    const [idleColumns] = await connection.execute(
      `SELECT COLUMN_NAME, DATA_TYPE 
       FROM information_schema.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME = 'idle_assets' 
       AND COLUMN_NAME = 'asset_id'`,
    );

    if (idleColumns.length > 0) {
      await connection.execute(
        `ALTER TABLE idle_assets 
         ADD COLUMN asset_code_new VARCHAR(100) DEFAULT NULL COMMENT '资产编号' AFTER asset_id`,
      );

      await connection.execute(
        `UPDATE idle_assets 
         SET asset_code_new = asset_id 
         WHERE asset_id IS NOT NULL`,
      );

      await connection.execute(
        'ALTER TABLE idle_assets DROP COLUMN asset_id',
      );

      await connection.execute(
        'ALTER TABLE idle_assets CHANGE COLUMN asset_code_new asset_code VARCHAR(100) DEFAULT NULL COMMENT \'资产编号\'',
      );

      logger.info('idle_assets 表修复完成');
    }

    await connection.execute(
      'ALTER TABLE idle_assets ADD INDEX idx_asset_code (asset_code)',
    );

    await connection.execute(
      `ALTER TABLE idle_assets 
       ADD CONSTRAINT fk_idle_asset_code 
       FOREIGN KEY (asset_code) REFERENCES assets(asset_code) ON DELETE CASCADE`,
    );
    logger.info('idle_assets 外键约束创建成功');

    await connection.commit();
    logger.info('外键类型不匹配问题修复完成！');

  } catch (error) {
    await connection.rollback();
    logger.error('修复外键类型不匹配问题失败:', error);
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
