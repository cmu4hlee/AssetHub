const db = require('../config/database');

async function createCostTrackingTables() {
  try {
    console.log('开始创建维护成本跟踪相关表...');

    // 创建成本记录表
    await db.execute(`
      CREATE TABLE IF NOT EXISTS maintenance_costs (
        id INT PRIMARY KEY AUTO_INCREMENT,
        tenant_id INT NOT NULL,
        maintenance_log_id INT,
        work_order_id INT,
        asset_code VARCHAR(100) NOT NULL,
        asset_name VARCHAR(200),
        cost_date DATE NOT NULL,
        cost_type ENUM('labor', 'material', 'external', 'other') NOT NULL,
        amount DECIMAL(15,2) NOT NULL,
        description TEXT,
        department VARCHAR(100),
        location VARCHAR(200),
        created_by VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NULL DEFAULT NULL,
        INDEX idx_tenant_id (tenant_id),
        INDEX idx_asset_code (asset_code),
        INDEX idx_maintenance_log_id (maintenance_log_id),
        INDEX idx_work_order_id (work_order_id),
        INDEX idx_cost_date (cost_date),
        INDEX idx_cost_type (cost_type),
        FOREIGN KEY (maintenance_log_id) REFERENCES maintenance_logs(id) ON DELETE SET NULL,
        FOREIGN KEY (work_order_id) REFERENCES work_orders(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='维护成本记录表'
    `);

    // 创建维护成本汇总表（用于快速查询统计数据）
    await db.execute(`
      CREATE TABLE IF NOT EXISTS maintenance_cost_summary (
        id INT PRIMARY KEY AUTO_INCREMENT,
        tenant_id INT NOT NULL,
        asset_code VARCHAR(100) NOT NULL,
        asset_name VARCHAR(200),
        year INT NOT NULL,
        month INT NOT NULL,
        labor_cost DECIMAL(15,2) DEFAULT 0,
        material_cost DECIMAL(15,2) DEFAULT 0,
        external_cost DECIMAL(15,2) DEFAULT 0,
        other_cost DECIMAL(15,2) DEFAULT 0,
        total_cost DECIMAL(15,2) DEFAULT 0,
        maintenance_count INT DEFAULT 0,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_asset_year_month (tenant_id, asset_code, year, month),
        INDEX idx_tenant_id (tenant_id),
        INDEX idx_asset_code (asset_code),
        INDEX idx_year_month (year, month)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='维护成本汇总表'
    `);

    // 创建部门维护成本表
    await db.execute(`
      CREATE TABLE IF NOT EXISTS department_maintenance_costs (
        id INT PRIMARY KEY AUTO_INCREMENT,
        tenant_id INT NOT NULL,
        department VARCHAR(100) NOT NULL,
        year INT NOT NULL,
        month INT NOT NULL,
        labor_cost DECIMAL(15,2) DEFAULT 0,
        material_cost DECIMAL(15,2) DEFAULT 0,
        external_cost DECIMAL(15,2) DEFAULT 0,
        other_cost DECIMAL(15,2) DEFAULT 0,
        total_cost DECIMAL(15,2) DEFAULT 0,
        maintenance_count INT DEFAULT 0,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_department_year_month (tenant_id, department, year, month),
        INDEX idx_tenant_id (tenant_id),
        INDEX idx_department (department),
        INDEX idx_year_month (year, month)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='部门维护成本表'
    `);

    console.log('✓ 维护成本跟踪相关表创建完成');
  } catch (error) {
    console.error('创建维护成本跟踪表失败:', error);
    throw error;
  }
}

async function enhanceMaintenanceLogsTable() {
  try {
    console.log('开始增强维护日志表...');

    // 检查并添加成本相关字段
    const [columns] = await db.execute(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'maintenance_logs'
    `);
    const columnNames = columns.map(col => col.COLUMN_NAME);

    if (!columnNames.includes('labor_cost')) {
      await db.execute(
        'ALTER TABLE maintenance_logs ADD COLUMN labor_cost DECIMAL(15,2) DEFAULT 0',
      );
      console.log('✓ 添加 labor_cost 字段');
    }

    if (!columnNames.includes('material_cost')) {
      await db.execute(
        'ALTER TABLE maintenance_logs ADD COLUMN material_cost DECIMAL(15,2) DEFAULT 0',
      );
      console.log('✓ 添加 material_cost 字段');
    }

    if (!columnNames.includes('external_cost')) {
      await db.execute(
        'ALTER TABLE maintenance_logs ADD COLUMN external_cost DECIMAL(15,2) DEFAULT 0',
      );
      console.log('✓ 添加 external_cost 字段');
    }

    if (!columnNames.includes('total_cost')) {
      await db.execute(
        'ALTER TABLE maintenance_logs ADD COLUMN total_cost DECIMAL(15,2) DEFAULT 0',
      );
      console.log('✓ 添加 total_cost 字段');
    }

    console.log('✓ 维护日志表增强完成');
  } catch (error) {
    console.error('增强维护日志表失败:', error);
    throw error;
  }
}

async function createCostAnalysisFunctions() {
  try {
    console.log('开始创建成本分析相关函数...');

    // 创建存储过程：更新成本汇总
    await db.execute(`
      CREATE PROCEDURE IF NOT EXISTS update_maintenance_cost_summary()
      BEGIN
        DECLARE done INT DEFAULT FALSE;
        DECLARE v_tenant_id INT;
        DECLARE v_asset_code VARCHAR(100);
        DECLARE v_asset_name VARCHAR(200);
        DECLARE v_year INT;
        DECLARE v_month INT;
        DECLARE v_labor_cost DECIMAL(15,2);
        DECLARE v_material_cost DECIMAL(15,2);
        DECLARE v_external_cost DECIMAL(15,2);
        DECLARE v_other_cost DECIMAL(15,2);
        DECLARE v_total_cost DECIMAL(15,2);
        DECLARE v_maintenance_count INT;
        
        DECLARE cur CURSOR FOR
          SELECT
            tenant_id,
            asset_code,
            asset_name,
            YEAR(cost_date) AS year,
            MONTH(cost_date) AS month,
            SUM(CASE WHEN cost_type = 'labor' THEN amount ELSE 0 END) AS labor_cost,
            SUM(CASE WHEN cost_type = 'material' THEN amount ELSE 0 END) AS material_cost,
            SUM(CASE WHEN cost_type = 'external' THEN amount ELSE 0 END) AS external_cost,
            SUM(CASE WHEN cost_type = 'other' THEN amount ELSE 0 END) AS other_cost,
            SUM(amount) AS total_cost,
            COUNT(*) AS maintenance_count
          FROM maintenance_costs
          GROUP BY tenant_id, asset_code, asset_name, YEAR(cost_date), MONTH(cost_date);
        
        DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;
        
        OPEN cur;
        
        read_loop:
        LOOP
          FETCH cur INTO v_tenant_id, v_asset_code, v_asset_name, v_year, v_month, v_labor_cost, v_material_cost, v_external_cost, v_other_cost, v_total_cost, v_maintenance_count;
          
          IF done THEN
            LEAVE read_loop;
          END IF;
          
          INSERT INTO maintenance_cost_summary (
            tenant_id, asset_code, asset_name, year, month, labor_cost, material_cost, external_cost, other_cost, total_cost, maintenance_count
          ) VALUES (
            v_tenant_id, v_asset_code, v_asset_name, v_year, v_month, v_labor_cost, v_material_cost, v_external_cost, v_other_cost, v_total_cost, v_maintenance_count
          ) ON DUPLICATE KEY UPDATE
            labor_cost = v_labor_cost,
            material_cost = v_material_cost,
            external_cost = v_external_cost,
            other_cost = v_other_cost,
            total_cost = v_total_cost,
            maintenance_count = v_maintenance_count;
        END LOOP;
        
        CLOSE cur;
      END
    `);

    console.log('✓ 成本分析相关函数创建完成');
  } catch (error) {
    console.error('创建成本分析函数失败:', error);
    // 存储过程创建失败不影响主流程
    console.warn('存储过程创建失败，将使用应用层逻辑替代');
  }
}

async function main() {
  try {
    await createCostTrackingTables();
    await enhanceMaintenanceLogsTable();
    await createCostAnalysisFunctions();
    console.log('\n🎉 维护成本跟踪功能增强完成！');
  } catch (error) {
    console.error('执行失败:', error);
    process.exit(1);
  } finally {
    await db.end();
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  createCostTrackingTables,
  enhanceMaintenanceLogsTable,
  createCostAnalysisFunctions,
};
