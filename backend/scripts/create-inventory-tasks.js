const db = require('../config/database');

async function createInventoryTasksTable() {
  const connection = await db.getConnection();
  try {
    console.log('🔍 开始创建盘点任务分配表...');

    // 创建盘点任务表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS inventory_tasks (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT,
        inventory_id INT NOT NULL,
        task_name VARCHAR(200) NOT NULL,
        assignee VARCHAR(50) NOT NULL,
        assignee_name VARCHAR(100) NOT NULL,
        department_code VARCHAR(50) DEFAULT NULL,
        location VARCHAR(200) DEFAULT NULL,
        estimated_count INT DEFAULT 0,
        actual_count INT DEFAULT 0,
        status ENUM('待分配', '已分配', '进行中', '已完成', '已取消') DEFAULT '待分配',
        start_time DATETIME DEFAULT NULL,
        end_time DATETIME DEFAULT NULL,
        created_by VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT NULL,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
        FOREIGN KEY (inventory_id) REFERENCES inventory_records(id) ON DELETE CASCADE
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

    await createIndex(connection, 'inventory_tasks', 'idx_inventory_tasks_tenant_id', 'tenant_id');
    await createIndex(connection, 'inventory_tasks', 'idx_inventory_tasks_inventory_id', 'inventory_id');
    await createIndex(connection, 'inventory_tasks', 'idx_inventory_tasks_assignee', 'assignee');
    await createIndex(connection, 'inventory_tasks', 'idx_inventory_tasks_status', 'status');
    await createIndex(connection, 'inventory_tasks', 'idx_inventory_tasks_department', 'department_code');

    console.log('✅ 盘点任务分配表创建完成!');
  } catch (error) {
    console.error('❌ 创建盘点任务分配表失败:', error);
  } finally {
    connection.release();
  }
}

// 执行创建
createInventoryTasksTable();
