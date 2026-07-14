const db = require('../config/database');

async function createInventoryPlansTable() {
  const connection = await db.getConnection();
  try {
    console.log('🔍 开始创建盘点计划表...');

    // 创建盘点计划表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS inventory_plans (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT,
        plan_no VARCHAR(50) NOT NULL,
        plan_name VARCHAR(200) NOT NULL,
        plan_type ENUM('全面盘点', '抽查盘点', '专项盘点') NOT NULL,
        scope VARCHAR(500) DEFAULT NULL,
        scheduled_start DATETIME NOT NULL,
        scheduled_end DATETIME NOT NULL,
        actual_start DATETIME DEFAULT NULL,
        actual_end DATETIME DEFAULT NULL,
        status ENUM('待执行', '执行中', '已完成', '已取消') DEFAULT '待执行',
        created_by VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT NULL,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 创建盘点计划详情表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS inventory_plan_details (
        id INT AUTO_INCREMENT PRIMARY KEY,
        plan_id INT NOT NULL,
        department_code VARCHAR(50) DEFAULT NULL,
        asset_category VARCHAR(100) DEFAULT NULL,
        location VARCHAR(200) DEFAULT NULL,
        estimated_count INT DEFAULT 0,
        FOREIGN KEY (plan_id) REFERENCES inventory_plans(id) ON DELETE CASCADE
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

    await createIndex(connection, 'inventory_plans', 'idx_inventory_plans_tenant_id', 'tenant_id');
    await createIndex(connection, 'inventory_plans', 'idx_inventory_plans_plan_no', 'plan_no');
    await createIndex(connection, 'inventory_plans', 'idx_inventory_plans_status', 'status');
    await createIndex(connection, 'inventory_plans', 'idx_inventory_plans_scheduled_start', 'scheduled_start');
    await createIndex(connection, 'inventory_plan_details', 'idx_inventory_plan_details_plan_id', 'plan_id');

    console.log('✅ 盘点计划表创建完成!');
  } catch (error) {
    console.error('❌ 创建盘点计划表失败:', error);
  } finally {
    connection.release();
  }
}

// 执行创建
createInventoryPlansTable();
