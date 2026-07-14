const db = require('../config/database');

async function createInventoryDiscrepanciesTable() {
  const connection = await db.getConnection();
  try {
    console.log('🔍 开始创建盘点差异处理表...');

    // 创建盘点差异处理表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS inventory_discrepancies (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT,
        inventory_id INT NOT NULL,
        detail_id INT NOT NULL,
        asset_code VARCHAR(255) NOT NULL,
        discrepancy_type VARCHAR(50) NOT NULL,
        description TEXT NOT NULL,
        expected_location VARCHAR(200) DEFAULT NULL,
        actual_location VARCHAR(200) DEFAULT NULL,
        expected_status VARCHAR(50) DEFAULT NULL,
        actual_status VARCHAR(50) DEFAULT NULL,
        handling_status ENUM('待处理', '处理中', '已处理', '已忽略') DEFAULT '待处理',
        handling_method VARCHAR(100) DEFAULT NULL,
        handler VARCHAR(50) DEFAULT NULL,
        handler_name VARCHAR(100) DEFAULT NULL,
        handling_date DATETIME DEFAULT NULL,
        handling_notes TEXT DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT NULL,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
        FOREIGN KEY (inventory_id) REFERENCES inventory_records(id) ON DELETE CASCADE,
        FOREIGN KEY (detail_id) REFERENCES inventory_details(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 创建索引
    const createIndex = async (connection, table, indexName, columns) => {
      try {
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
    };

    await createIndex(connection, 'inventory_discrepancies', 'idx_inventory_discrepancies_tenant_id', 'tenant_id');
    await createIndex(connection, 'inventory_discrepancies', 'idx_inventory_discrepancies_inventory_id', 'inventory_id');
    await createIndex(connection, 'inventory_discrepancies', 'idx_inventory_discrepancies_detail_id', 'detail_id');
    await createIndex(connection, 'inventory_discrepancies', 'idx_inventory_discrepancies_asset_code', 'asset_code');
    await createIndex(connection, 'inventory_discrepancies', 'idx_inventory_discrepancies_handling_status', 'handling_status');

    console.log('✅ 盘点差异处理表创建完成!');
  } catch (error) {
    console.error('❌ 创建盘点差异处理表失败:', error);
  } finally {
    connection.release();
  }
}

// 执行创建
createInventoryDiscrepanciesTable();
