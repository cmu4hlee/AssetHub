const db = require('../config/database');

async function optimizeInventoryDatabase() {
  const connection = await db.getConnection();
  try {
    console.log('🔍 开始优化盘点功能数据库索引...');

    // 为inventory_records表添加索引
    await addIndexIfNotExists(connection, 'inventory_records', 'idx_inventory_records_tenant_id', 'tenant_id');
    await addIndexIfNotExists(connection, 'inventory_records', 'idx_inventory_records_status', 'status');
    await addIndexIfNotExists(connection, 'inventory_records', 'idx_inventory_records_inventory_no', 'inventory_no');
    await addIndexIfNotExists(connection, 'inventory_records', 'idx_inventory_records_created_at', 'created_at');
    await addIndexIfNotExists(connection, 'inventory_records', 'idx_inventory_records_self_check', 'self_check_enabled, self_check_start, self_check_end');

    // 为inventory_details表添加索引
    await addIndexIfNotExists(connection, 'inventory_details', 'idx_inventory_details_inventory_id', 'inventory_id');
    await addIndexIfNotExists(connection, 'inventory_details', 'idx_inventory_details_asset_code', 'asset_code');
    await addIndexIfNotExists(connection, 'inventory_details', 'idx_inventory_details_discrepancy_type', 'discrepancy_type');
    await addIndexIfNotExists(connection, 'inventory_details', 'idx_inventory_details_checked_at', 'checked_at');

    // 为inventory_scan_logs表添加索引
    await addIndexIfNotExists(connection, 'inventory_scan_logs', 'idx_inventory_scan_logs_inventory_id', 'inventory_id');
    await addIndexIfNotExists(connection, 'inventory_scan_logs', 'idx_inventory_scan_logs_asset_code', 'asset_code');
    await addIndexIfNotExists(connection, 'inventory_scan_logs', 'idx_inventory_scan_logs_scan_time', 'scan_time');
    await addIndexIfNotExists(connection, 'inventory_scan_logs', 'idx_inventory_scan_logs_scan_by', 'scan_by');

    console.log('✅ 盘点功能数据库索引优化完成!');
  } catch (error) {
    console.error('❌ 优化数据库索引失败:', error);
  } finally {
    connection.release();
  }
}

async function addIndexIfNotExists(connection, table, indexName, columns) {
  try {
    // 检查索引是否存在
    const [result] = await connection.execute(
      `SHOW INDEX FROM ${table} WHERE Key_name = ?`,
      [indexName],
    );

    if (result.length === 0) {
      await connection.execute(
        `CREATE INDEX ${indexName} ON ${table} (${columns})`,
      );
      console.log(`✅ 为 ${table} 表添加索引 ${indexName}`);
    } else {
      console.log(`ℹ️  索引 ${indexName} 已存在，跳过`);
    }
  } catch (error) {
    console.error(`❌ 添加索引 ${indexName} 失败:`, error.message);
  }
}

// 执行优化
optimizeInventoryDatabase();
