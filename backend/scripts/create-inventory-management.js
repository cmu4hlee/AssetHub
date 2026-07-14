const db = require('../config/database');

async function createInventoryManagement() {
  try {
    console.log('开始创建物料库存管理系统...');

    // 创建物料表
    await createMaterialsTable();

    // 创建库存表
    await createInventoryTable();

    // 创建库存变动记录表
    await createInventoryTransactionsTable();

    // 创建维护物料需求表
    await createMaintenanceMaterialRequirementsTable();

    console.log('✅ 物料库存管理系统创建完成！');
  } catch (error) {
    console.error('❌ 创建物料库存管理系统失败:', error.message);
    console.error('错误堆栈:', error.stack);
  } finally {
    // 关闭数据库连接
    if (db && typeof db.end === 'function') {
      await db.end();
      console.log('✅ 数据库连接已关闭');
    }
  }
}

// 创建物料表
async function createMaterialsTable() {
  try {
    console.log('\n📋 创建物料表...');

    await db.execute(`
      CREATE TABLE IF NOT EXISTS materials (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        material_code VARCHAR(50) NOT NULL,
        material_name VARCHAR(100) NOT NULL,
        specification VARCHAR(255),
        unit VARCHAR(20) NOT NULL,
        category VARCHAR(50),
        subcategory VARCHAR(50),
        supplier VARCHAR(100),
        manufacturer VARCHAR(100),
        min_stock INT DEFAULT 0,
        max_stock INT DEFAULT 1000,
        unit_price DECIMAL(10,2) DEFAULT 0.00,
        currency VARCHAR(10) DEFAULT 'CNY',
        lead_time_days INT DEFAULT 7,
        description TEXT,
        status ENUM('正常', '停用', '缺货') DEFAULT '正常',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME,
        INDEX idx_material_code (material_code),
        INDEX idx_material_name (material_name),
        INDEX idx_category (category),
        INDEX idx_tenant (tenant_id),
        UNIQUE KEY uk_material_code_tenant (tenant_id, material_code)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    console.log('✅ 物料表创建成功');
  } catch (error) {
    console.error('❌ 创建物料表失败:', error.message);
    throw error;
  }
}

// 创建库存表
async function createInventoryTable() {
  try {
    console.log('\n📋 创建库存表...');

    await db.execute(`
      CREATE TABLE IF NOT EXISTS inventory (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        material_id INT NOT NULL,
        current_stock DECIMAL(15,2) DEFAULT 0.00,
        available_stock DECIMAL(15,2) DEFAULT 0.00,
        reserved_stock DECIMAL(15,2) DEFAULT 0.00,
        last_stock_date DATE,
        last_restock_quantity DECIMAL(15,2) DEFAULT 0.00,
        average_cost DECIMAL(10,2) DEFAULT 0.00,
        total_value DECIMAL(15,2) DEFAULT 0.00,
        location VARCHAR(100),
        storage_condition VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME,
        INDEX idx_material_id (material_id),
        INDEX idx_tenant (tenant_id),
        FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    console.log('✅ 库存表创建成功');
  } catch (error) {
    console.error('❌ 创建库存表失败:', error.message);
    throw error;
  }
}

// 创建库存变动记录表
async function createInventoryTransactionsTable() {
  try {
    console.log('\n📋 创建库存变动记录表...');

    await db.execute(`
      CREATE TABLE IF NOT EXISTS inventory_transactions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        transaction_date DATETIME,
        transaction_type ENUM('入库', '出库', '调拨', '盘点', '报废') NOT NULL,
        material_id INT NOT NULL,
        quantity DECIMAL(15,2) NOT NULL,
        unit_price DECIMAL(10,2) DEFAULT 0.00,
        total_amount DECIMAL(15,2) DEFAULT 0.00,
        source_location VARCHAR(100),
        target_location VARCHAR(100),
        reference_type VARCHAR(50),
        reference_id INT,
        description TEXT,
        operator VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_transaction_date (transaction_date),
        INDEX idx_transaction_type (transaction_type),
        INDEX idx_material_id (material_id),
        INDEX idx_reference (reference_type, reference_id),
        INDEX idx_tenant (tenant_id),
        FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    console.log('✅ 库存变动记录表创建成功');
  } catch (error) {
    console.error('❌ 创建库存变动记录表失败:', error.message);
    throw error;
  }
}

// 创建维护物料需求表
async function createMaintenanceMaterialRequirementsTable() {
  try {
    console.log('\n📋 创建维护物料需求表...');

    await db.execute(`
      CREATE TABLE IF NOT EXISTS maintenance_material_requirements (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        maintenance_id INT NOT NULL,
        maintenance_type ENUM('maintenance_log', 'work_order', 'preventive_plan') NOT NULL,
        material_id INT NOT NULL,
        required_quantity DECIMAL(15,2) NOT NULL,
        issued_quantity DECIMAL(15,2) DEFAULT 0.00,
        unit_price DECIMAL(10,2) DEFAULT 0.00,
        total_cost DECIMAL(15,2) DEFAULT 0.00,
        status ENUM('待发料', '部分发料', '已发料', '取消') DEFAULT '待发料',
        issued_by VARCHAR(100),
        issued_date DATETIME,
        remark TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME,
        INDEX idx_maintenance (maintenance_type, maintenance_id),
        INDEX idx_material_id (material_id),
        INDEX idx_status (status),
        INDEX idx_tenant (tenant_id),
        FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    console.log('✅ 维护物料需求表创建成功');
  } catch (error) {
    console.error('❌ 创建维护物料需求表失败:', error.message);
    throw error;
  }
}

// 执行创建操作
createInventoryManagement();
