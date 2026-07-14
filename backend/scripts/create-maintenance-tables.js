const db = require('../config/database');

async function createMaintenanceTables() {
  try {
    console.log('开始创建维修维护模块表结构...');

    // 1. 创建维护日志记录表
    await db.execute(`
      CREATE TABLE IF NOT EXISTS maintenance_logs (
        id INT PRIMARY KEY AUTO_INCREMENT,
        asset_id INT NULL COMMENT '资产ID（已废弃，使用asset_code）',
        asset_code VARCHAR(100) NOT NULL COMMENT '资产编号',
        asset_name VARCHAR(200) NOT NULL COMMENT '资产名称',
        maintenance_type ENUM('日常维护', '预防性维护', '故障维修', '定期保养', '其他') NOT NULL COMMENT '维护类型',
        maintenance_date DATE NOT NULL COMMENT '维护日期',
        maintenance_person VARCHAR(50) NOT NULL COMMENT '维护人员',
        maintenance_content TEXT COMMENT '维护内容',
        maintenance_cost DECIMAL(15, 2) DEFAULT 0 COMMENT '维护费用',
        parts_replaced TEXT COMMENT '更换部件',
        next_maintenance_date DATE COMMENT '下次维护日期',
        status ENUM('已完成', '进行中', '已取消') DEFAULT '已完成' COMMENT '维护状态',
        remark TEXT COMMENT '备注',
        created_by VARCHAR(50) COMMENT '创建人',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NULL DEFAULT NULL,
        INDEX idx_asset (asset_id),
        INDEX idx_asset_code (asset_code),
        INDEX idx_maintenance_date (maintenance_date),
        INDEX idx_maintenance_type (maintenance_type),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='维护日志记录表'
    `);
    console.log('✓ 维护日志记录表创建成功');

    // 2. 创建预防性维护计划表
    await db.execute(`
      CREATE TABLE IF NOT EXISTS preventive_maintenance_plans (
        id INT PRIMARY KEY AUTO_INCREMENT,
        asset_id INT NULL COMMENT '资产ID（已废弃，使用asset_code）',
        asset_code VARCHAR(100) NOT NULL COMMENT '资产编号',
        asset_name VARCHAR(200) NOT NULL COMMENT '资产名称',
        plan_name VARCHAR(200) NOT NULL COMMENT '计划名称',
        maintenance_type VARCHAR(50) NOT NULL COMMENT '维护类型',
        cycle_type ENUM('按天', '按周', '按月', '按季度', '按年') NOT NULL COMMENT '周期类型',
        cycle_value INT NOT NULL COMMENT '周期值',
        next_maintenance_date DATE NOT NULL COMMENT '下次维护日期',
        maintenance_content TEXT COMMENT '维护内容',
        responsible_person VARCHAR(50) COMMENT '负责人',
        status ENUM('启用', '停用', '已完成') DEFAULT '启用' COMMENT '计划状态',
        last_maintenance_date DATE COMMENT '上次维护日期',
        remark TEXT COMMENT '备注',
        created_by VARCHAR(50) COMMENT '创建人',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NULL DEFAULT NULL,
        INDEX idx_asset (asset_id),
        INDEX idx_asset_code (asset_code),
        INDEX idx_next_maintenance_date (next_maintenance_date),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='预防性维护计划表'
    `);
    console.log('✓ 预防性维护计划表创建成功');

    // 3. 创建故障维修申请表
    await db.execute(`
      CREATE TABLE IF NOT EXISTS maintenance_requests (
        id INT PRIMARY KEY AUTO_INCREMENT,
        request_no VARCHAR(100) UNIQUE NOT NULL COMMENT '申请单号',
        asset_id INT NULL COMMENT '资产ID（已废弃，使用asset_code）',
        asset_code VARCHAR(100) NOT NULL COMMENT '资产编号',
        asset_name VARCHAR(200) NOT NULL COMMENT '资产名称',
        fault_description TEXT NOT NULL COMMENT '故障描述',
        fault_level ENUM('一般', '紧急', '严重') DEFAULT '一般' COMMENT '故障级别',
        request_date DATE NOT NULL COMMENT '申请日期',
        request_person VARCHAR(50) NOT NULL COMMENT '申请人',
        request_department VARCHAR(100) COMMENT '申请部门',
        contact_phone VARCHAR(20) COMMENT '联系电话',
        expected_repair_date DATE COMMENT '期望维修日期',
        status ENUM('待审批', '已批准', '维修中', '已完成', '已拒绝', '已取消') DEFAULT '待审批' COMMENT '申请状态',
        approver VARCHAR(50) COMMENT '审批人',
        approve_date DATE COMMENT '审批日期',
        approve_comment TEXT COMMENT '审批意见',
        repair_person VARCHAR(50) COMMENT '维修人员',
        repair_start_date DATE COMMENT '维修开始日期',
        repair_end_date DATE COMMENT '维修结束日期',
        repair_cost DECIMAL(15, 2) DEFAULT 0 COMMENT '维修费用',
        repair_content TEXT COMMENT '维修内容',
        parts_replaced TEXT COMMENT '更换部件',
        remark TEXT COMMENT '备注',
        created_by VARCHAR(50) COMMENT '创建人',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NULL DEFAULT NULL,
        INDEX idx_asset (asset_id),
        INDEX idx_asset_code (asset_code),
        INDEX idx_request_no (request_no),
        INDEX idx_request_date (request_date),
        INDEX idx_status (status),
        INDEX idx_fault_level (fault_level)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='故障维修申请表'
    `);
    console.log('✓ 故障维修申请表创建成功');

    console.log('\n✅ 维修维护模块表结构创建完成！');
  } catch (error) {
    console.error('❌ 创建表结构失败:', error);
    throw error;
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  createMaintenanceTables()
    .then(() => {
      console.log('\n脚本执行完成');
      process.exit(0);
    })
    .catch(error => {
      console.error('脚本执行失败:', error);
      process.exit(1);
    });
}

module.exports = createMaintenanceTables;
