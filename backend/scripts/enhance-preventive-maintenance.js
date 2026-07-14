const db = require('../config/database');

async function enhancePreventiveMaintenance() {
  try {
    console.log('开始完善预防性维护计划表结构...');

    // 1. 创建维护计划模板表
    await db.execute(`
      CREATE TABLE IF NOT EXISTS maintenance_templates (
        id INT PRIMARY KEY AUTO_INCREMENT,
        template_name VARCHAR(200) NOT NULL COMMENT '模板名称',
        asset_type VARCHAR(50) COMMENT '资产类型',
        brand VARCHAR(100) COMMENT '品牌',
        model VARCHAR(100) COMMENT '型号',
        maintenance_items TEXT COMMENT '维护项目清单（JSON格式）',
        cycle_type ENUM('按天', '按周', '按月', '按季度', '按年') COMMENT '周期类型',
        cycle_value INT COMMENT '周期值',
        estimated_hours DECIMAL(10,2) COMMENT '预计工时（小时）',
        required_materials TEXT COMMENT '所需物料清单（JSON格式）',
        maintenance_content TEXT COMMENT '维护内容说明',
        status ENUM('启用', '停用') DEFAULT '启用' COMMENT '模板状态',
        created_by VARCHAR(50) COMMENT '创建人',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NULL DEFAULT NULL,
        INDEX idx_asset_type (asset_type),
        INDEX idx_brand (brand),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='维护计划模板表'
    `);
    console.log('✓ 维护计划模板表创建成功');

    // 2. 增强预防性维护计划表
    const [columns] = await db.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'preventive_maintenance_plans'
    `);
    const columnNames = columns.map(col => col.COLUMN_NAME);

    // 添加模板ID字段
    if (!columnNames.includes('template_id')) {
      await db.execute(`
        ALTER TABLE preventive_maintenance_plans 
        ADD COLUMN template_id INT COMMENT '模板ID' AFTER id
      `);
      console.log('✓ 添加 template_id 字段');
    }

    // 添加触发类型字段
    if (!columnNames.includes('trigger_type')) {
      await db.execute(`
        ALTER TABLE preventive_maintenance_plans 
        ADD COLUMN trigger_type ENUM('time', 'usage', 'condition') DEFAULT 'time' 
        COMMENT '触发类型：time-时间, usage-使用量, condition-条件' 
        AFTER cycle_type
      `);
      console.log('✓ 添加 trigger_type 字段');
    }

    // 添加维护项目清单字段
    if (!columnNames.includes('maintenance_items')) {
      await db.execute(`
        ALTER TABLE preventive_maintenance_plans 
        ADD COLUMN maintenance_items TEXT COMMENT '维护项目清单（JSON格式）' 
        AFTER maintenance_content
      `);
      console.log('✓ 添加 maintenance_items 字段');
    }

    // 添加所需物料清单字段
    if (!columnNames.includes('required_materials')) {
      await db.execute(`
        ALTER TABLE preventive_maintenance_plans 
        ADD COLUMN required_materials TEXT COMMENT '所需物料清单（JSON格式）' 
        AFTER maintenance_items
      `);
      console.log('✓ 添加 required_materials 字段');
    }

    // 添加预计工时字段
    if (!columnNames.includes('estimated_hours')) {
      await db.execute(`
        ALTER TABLE preventive_maintenance_plans 
        ADD COLUMN estimated_hours DECIMAL(10,2) COMMENT '预计工时（小时）' 
        AFTER required_materials
      `);
      console.log('✓ 添加 estimated_hours 字段');
    }

    // 添加自动生成工单字段
    if (!columnNames.includes('auto_generate_workorder')) {
      await db.execute(`
        ALTER TABLE preventive_maintenance_plans 
        ADD COLUMN auto_generate_workorder BOOLEAN DEFAULT TRUE 
        COMMENT '是否自动生成工单' 
        AFTER estimated_hours
      `);
      console.log('✓ 添加 auto_generate_workorder 字段');
    }

    // 添加使用量相关字段
    if (!columnNames.includes('current_usage')) {
      await db.execute(`
        ALTER TABLE preventive_maintenance_plans 
        ADD COLUMN current_usage DECIMAL(15,2) DEFAULT 0 
        COMMENT '当前使用量（运行小时数或使用次数）' 
        AFTER trigger_type
      `);
      console.log('✓ 添加 current_usage 字段');
    }

    if (!columnNames.includes('usage_threshold')) {
      await db.execute(`
        ALTER TABLE preventive_maintenance_plans 
        ADD COLUMN usage_threshold DECIMAL(15,2) COMMENT '使用量阈值' 
        AFTER current_usage
      `);
      console.log('✓ 添加 usage_threshold 字段');
    }

    // 添加维护历史记录表
    await db.execute(`
      CREATE TABLE IF NOT EXISTS maintenance_plan_history (
        id INT PRIMARY KEY AUTO_INCREMENT,
        plan_id INT NOT NULL COMMENT '维护计划ID',
        maintenance_date DATE NOT NULL COMMENT '维护日期',
        maintenance_person VARCHAR(50) COMMENT '维护人',
        actual_hours DECIMAL(10,2) COMMENT '实际工时',
        maintenance_result ENUM('正常', '异常', '需维修') DEFAULT '正常' COMMENT '维护结果',
        maintenance_notes TEXT COMMENT '维护备注',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_plan_id (plan_id),
        INDEX idx_maintenance_date (maintenance_date),
        FOREIGN KEY (plan_id) REFERENCES preventive_maintenance_plans(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='维护计划历史记录表'
    `);
    console.log('✓ 维护计划历史记录表创建成功');

    console.log('\n✅ 预防性维护计划表结构完善完成！');
  } catch (error) {
    console.error('❌ 完善表结构失败:', error);
    throw error;
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  enhancePreventiveMaintenance()
    .then(() => {
      console.log('脚本执行完成');
      process.exit(0);
    })
    .catch(error => {
      console.error('脚本执行失败:', error);
      process.exit(1);
    });
}

module.exports = enhancePreventiveMaintenance;
