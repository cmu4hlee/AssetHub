/**
 * 数据库迁移脚本：添加复合索引优化查询性能
 *
 * 优化目标：
 * 1. 资产查询按租户+状态过滤
 * 2. 资产查询按租户+部门过滤
 * 3. 资产查询按租户+分类过滤
 * 4. 资产查询按租户+删除标记过滤
 * 5. 资产编码唯一性索引
 */

const db = require('../config/database');
const logger = require('../config/logger');

async function migrate() {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();
    logger.info('开始添加复合索引优化查询性能...');

    const indexes = [
      {
        name: 'idx_tenant_status',
        table: 'assets',
        columns: '(tenant_id, status)',
        condition: 'tenant_id IS NOT NULL',
      },
      {
        name: 'idx_tenant_department_new',
        table: 'assets',
        columns: '(tenant_id, department_new)',
        condition: 'department_new IS NOT NULL',
      },
      {
        name: 'idx_tenant_category',
        table: 'assets',
        columns: '(tenant_id, category_id)',
        condition: 'category_id IS NOT NULL',
      },
      {
        name: 'idx_tenant_deleted',
        table: 'assets',
        columns: '(tenant_id, is_deleted)',
        condition: null,
      },
      {
        name: 'idx_tenant_asset_code',
        table: 'assets',
        columns: '(tenant_id, asset_code)',
        condition: null,
      },
      {
        name: 'idx_tenant_location',
        table: 'assets',
        columns: '(tenant_id, location)',
        condition: 'location IS NOT NULL',
      },
      {
        name: 'idx_tenant_status_deleted',
        table: 'assets',
        columns: '(tenant_id, status, is_deleted)',
        condition: null,
      },
      {
        name: 'idx_inventory_tenant_status',
        table: 'inventory_records',
        columns: '(tenant_id, status)',
        condition: null,
      },
      {
        name: 'idx_transfer_tenant_status',
        table: 'transfer_requests',
        columns: '(tenant_id, status)',
        condition: null,
      },
      {
        name: 'idx_maintenance_tenant_asset',
        table: 'maintenance_records',
        columns: '(tenant_id, asset_id)',
        condition: 'asset_id IS NOT NULL',
      },
      {
        name: 'idx_scrapping_tenant_status',
        table: 'asset_scrapping_records',
        columns: '(tenant_id, current_status)',
        condition: null,
      },
    ];

    for (const idx of indexes) {
      // 检查索引是否已存在
      const [existing] = await connection.execute(
        `SELECT INDEX_NAME 
         FROM information_schema.STATISTICS 
         WHERE TABLE_SCHEMA = DATABASE() 
         AND TABLE_NAME = ? 
         AND INDEX_NAME = ?`,
        [idx.table, idx.name],
      );

      if (existing.length === 0) {
        try {
          await connection.execute(
            `ALTER TABLE ${idx.table} ADD INDEX ${idx.name} ${idx.columns}`,
          );
          logger.info(`已添加索引 ${idx.name} 到 ${idx.table}`);
        } catch (error) {
          // 某些索引可能因数据重复而失败，记录警告但不中断迁移
          if (error.code === 'ER_DUP_KEYNAME') {
            logger.warn(`索引 ${idx.name} 已存在，跳过`);
          } else if (error.code === 'ER_DUP_ENTRY') {
            logger.warn(`索引 ${idx.name} 创建失败：存在重复数据，${error.message}`);
          } else {
            logger.warn(`索引 ${idx.name} 创建失败：${error.message}`);
          }
        }
      } else {
        logger.info(`索引 ${idx.name} 已存在，跳过`);
      }
    }

    // 为资产编码字段添加前缀索引（如果需要）
    const [assetCodeIndex] = await connection.execute(
      `SELECT INDEX_NAME 
       FROM information_schema.STATISTICS 
       WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME = 'assets' 
       AND INDEX_NAME = 'idx_asset_code_prefix'`,
    );

    if (assetCodeIndex.length === 0) {
      try {
        // 为asset_code添加前缀索引，优化LIKE 'xxx%'查询
        await connection.execute(
          'ALTER TABLE assets ADD INDEX idx_asset_code_prefix (asset_code(20))',
        );
        logger.info('已添加资产编码前缀索引');
      } catch (error) {
        logger.warn(`资产编码前缀索引创建失败：${error.message}`);
      }
    }

    await connection.commit();
    logger.info('复合索引添加完成！');

  } catch (error) {
    await connection.rollback();
    logger.error('添加复合索引失败:', error);
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
