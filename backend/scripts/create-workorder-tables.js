const db = require('../config/database');

async function createWorkorderTables() {
  try {
    console.log('开始创建工单管理相关表结构...');

    // 创建工单表
    await db.execute(`
      CREATE TABLE IF NOT EXISTS work_orders (
        id INT PRIMARY KEY AUTO_INCREMENT,
        work_order_no VARCHAR(50) UNIQUE NOT NULL,
        tenant_id INT NOT NULL,
        asset_code VARCHAR(100) NOT NULL,
        asset_name VARCHAR(200),
        maintenance_plan_id INT,
        source_type ENUM('fault', 'preventive', 'inspection', 'other') NOT NULL,
        title VARCHAR(200) NOT NULL,
        description TEXT,
        priority ENUM('low', 'normal', 'high', 'urgent') DEFAULT 'normal',
        status ENUM('pending', 'assigned', 'in_progress', 'pending_acceptance', 'completed', 'closed', 'cancelled') DEFAULT 'pending',
        assigned_to VARCHAR(100),
        assigned_at DATETIME,
        started_at DATETIME,
        completed_at DATETIME,
        accepted_at DATETIME,
        accepted_by VARCHAR(100),
        estimated_hours DECIMAL(10,2),
        actual_hours DECIMAL(10,2),
        fault_cause TEXT,
        solution TEXT,
        acceptance_result ENUM('passed', 'failed', 'partial'),
        satisfaction_score INT,
        created_by VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME,
        INDEX idx_tenant_id (tenant_id),
        INDEX idx_asset_code (asset_code),
        INDEX idx_status (status),
        INDEX idx_priority (priority),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    console.log('✓ 工单表 (work_orders) 创建成功');

    // 创建工单物料消耗表
    await db.execute(`
      CREATE TABLE IF NOT EXISTS work_order_materials (
        id INT PRIMARY KEY AUTO_INCREMENT,
        work_order_id INT NOT NULL,
        material_name VARCHAR(200) NOT NULL,
        specification TEXT,
        quantity DECIMAL(10,2) NOT NULL,
        unit VARCHAR(20) NOT NULL,
        unit_price DECIMAL(10,2),
        total_cost DECIMAL(15,2),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (work_order_id) REFERENCES work_orders(id) ON DELETE CASCADE,
        INDEX idx_work_order_id (work_order_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    console.log('✓ 工单物料消耗表 (work_order_materials) 创建成功');

    // 创建工单操作历史表
    await db.execute(`
      CREATE TABLE IF NOT EXISTS work_order_history (
        id INT PRIMARY KEY AUTO_INCREMENT,
        work_order_id INT NOT NULL,
        action_type VARCHAR(50) NOT NULL,
        action_description TEXT NOT NULL,
        action_by VARCHAR(100) NOT NULL,
        action_at DATETIME NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (work_order_id) REFERENCES work_orders(id) ON DELETE CASCADE,
        INDEX idx_work_order_id (work_order_id),
        INDEX idx_action_at (action_at),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    console.log('✓ 工单操作历史表 (work_order_history) 创建成功');

    console.log('\n🎉 工单管理相关表结构创建完成！');
  } catch (error) {
    console.error('创建工单管理相关表结构失败:', error);
    throw error;
  }
}

if (require.main === module) {
  createWorkorderTables()
    .then(() => {
      console.log('脚本执行完成');
      process.exit(0);
    })
    .catch(error => {
      console.error('脚本执行失败:', error);
      process.exit(1);
    });
}

module.exports = createWorkorderTables;
