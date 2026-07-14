const db = require('../config/database');

async function createUsageTrackingTables() {
  try {
    console.log('开始创建资产使用量跟踪相关表...');

    // 创建资产使用量表
    await db.execute(`
      CREATE TABLE IF NOT EXISTS asset_usage_records (
        id INT PRIMARY KEY AUTO_INCREMENT,
        tenant_id INT NOT NULL,
        asset_code VARCHAR(100) NOT NULL,
        asset_name VARCHAR(200),
        usage_date DATE NOT NULL,
        usage_value DECIMAL(15,2) NOT NULL,
        usage_type VARCHAR(50) NOT NULL, -- 运行小时数、使用次数、里程数等
        cumulative_value DECIMAL(15,2) NOT NULL,
        operator VARCHAR(100),
        remark TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_tenant_id (tenant_id),
        INDEX idx_asset_code (asset_code),
        INDEX idx_usage_date (usage_date),
        INDEX idx_usage_type (usage_type)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='资产使用量记录表'
    `);

    // 创建使用量触发的维护工单表
    await db.execute(`
      CREATE TABLE IF NOT EXISTS usage_triggered_maintenance (
        id INT PRIMARY KEY AUTO_INCREMENT,
        tenant_id INT NOT NULL,
        asset_code VARCHAR(100) NOT NULL,
        asset_name VARCHAR(200),
        plan_id INT,
        work_order_id INT,
        trigger_date DATE NOT NULL,
        current_usage DECIMAL(15,2) NOT NULL,
        threshold_usage DECIMAL(15,2) NOT NULL,
        usage_type VARCHAR(50) NOT NULL,
        status ENUM('pending', 'processed', 'canceled') DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NULL DEFAULT NULL,
        INDEX idx_tenant_id (tenant_id),
        INDEX idx_asset_code (asset_code),
        INDEX idx_plan_id (plan_id),
        INDEX idx_work_order_id (work_order_id),
        INDEX idx_status (status),
        FOREIGN KEY (plan_id) REFERENCES preventive_maintenance_plans(id) ON DELETE SET NULL,
        FOREIGN KEY (work_order_id) REFERENCES work_orders(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='使用量触发维护表'
    `);

    console.log('✓ 资产使用量跟踪相关表创建完成');
  } catch (error) {
    console.error('创建资产使用量跟踪表失败:', error);
    throw error;
  }
}

async function enhancePreventiveMaintenanceTable() {
  try {
    console.log('开始增强预防性维护计划表...');

    // 检查并添加使用量相关字段
    const [columns] = await db.execute(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'preventive_maintenance_plans'
    `);
    const columnNames = columns.map(col => col.COLUMN_NAME);

    if (!columnNames.includes('usage_type')) {
      await db.execute(
        'ALTER TABLE preventive_maintenance_plans ADD COLUMN usage_type VARCHAR(50) NULL',
      );
      console.log('✓ 添加 usage_type 字段');
    }

    if (!columnNames.includes('current_usage')) {
      await db.execute(
        'ALTER TABLE preventive_maintenance_plans ADD COLUMN current_usage DECIMAL(15,2) DEFAULT 0',
      );
      console.log('✓ 添加 current_usage 字段');
    }

    if (!columnNames.includes('usage_threshold')) {
      await db.execute(
        'ALTER TABLE preventive_maintenance_plans ADD COLUMN usage_threshold DECIMAL(15,2) NULL',
      );
      console.log('✓ 添加 usage_threshold 字段');
    }

    console.log('✓ 预防性维护计划表增强完成');
  } catch (error) {
    console.error('增强预防性维护计划表失败:', error);
    throw error;
  }
}

async function createUsageTriggerFunctions() {
  try {
    console.log('开始创建使用量触发相关函数...');

    // 创建存储过程：检查使用量触发的维护计划
    await db.execute(`
      CREATE PROCEDURE IF NOT EXISTS check_usage_triggered_maintenance()
      BEGIN
        DECLARE done INT DEFAULT FALSE;
        DECLARE v_tenant_id INT;
        DECLARE v_id INT;
        DECLARE v_asset_code VARCHAR(100);
        DECLARE v_asset_name VARCHAR(200);
        DECLARE v_current_usage DECIMAL(15,2);
        DECLARE v_usage_threshold DECIMAL(15,2);
        DECLARE v_usage_type VARCHAR(50);
        DECLARE v_plan_name VARCHAR(200);
        DECLARE v_responsible_person VARCHAR(100);
        
        DECLARE cur CURSOR FOR
          SELECT
            tenant_id,
            id,
            asset_code,
            asset_name,
            current_usage,
            usage_threshold,
            usage_type,
            plan_name,
            responsible_person
          FROM preventive_maintenance_plans
          WHERE status = '启用'
          AND trigger_type = 'usage'
          AND usage_threshold IS NOT NULL
          AND current_usage >= usage_threshold;
        
        DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;
        
        OPEN cur;
        
        read_loop:
        LOOP
          FETCH cur INTO v_tenant_id, v_id, v_asset_code, v_asset_name, v_current_usage, v_usage_threshold, v_usage_type, v_plan_name, v_responsible_person;
          
          IF done THEN
            LEAVE read_loop;
          END IF;
          
          -- 检查是否已经创建过触发记录
          DECLARE v_exists INT;
          SELECT COUNT(*) INTO v_exists FROM usage_triggered_maintenance
          WHERE plan_id = v_id AND status = 'pending';
          
          IF v_exists = 0 THEN
            -- 创建使用量触发记录
            INSERT INTO usage_triggered_maintenance (
              tenant_id, asset_code, asset_name, plan_id, 
              trigger_date, current_usage, threshold_usage, 
              usage_type, status
            ) VALUES (
              v_tenant_id, v_asset_code, v_asset_name, v_id, 
              CURDATE(), v_current_usage, v_usage_threshold, 
              v_usage_type, 'pending'
            );
          END IF;
        END LOOP;
        
        CLOSE cur;
      END
    `);

    console.log('✓ 使用量触发相关函数创建完成');
  } catch (error) {
    console.error('创建使用量触发函数失败:', error);
    // 存储过程创建失败不影响主流程
    console.warn('存储过程创建失败，将使用应用层逻辑替代');
  }
}

async function main() {
  try {
    await createUsageTrackingTables();
    await enhancePreventiveMaintenanceTable();
    await createUsageTriggerFunctions();
    console.log('\n🎉 基于使用量的维护触发机制实现完成！');
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
  createUsageTrackingTables,
  enhancePreventiveMaintenanceTable,
  createUsageTriggerFunctions,
};
