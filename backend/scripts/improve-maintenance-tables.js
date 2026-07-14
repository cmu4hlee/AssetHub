const db = require('../config/database');

async function improveMaintenanceTables() {
  try {
    console.log('开始完善维护日志相关表结构...');

    // 检查并创建 preventive_maintenance_plans 表（如果不存在）
    const [tables] = await db.execute("SHOW TABLES LIKE 'preventive_maintenance_plans'");

    if (tables.length === 0) {
      console.log('创建 preventive_maintenance_plans 表...');
      await db.execute(`
        CREATE TABLE IF NOT EXISTS preventive_maintenance_plans (
          id INT PRIMARY KEY AUTO_INCREMENT,
          asset_id INT NOT NULL COMMENT '资产ID',
          asset.code VARCHAR(100) NOT NULL COMMENT '资产编号',
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
          INDEX idx_asset.code (asset.code),
          INDEX idx_next_maintenance_date (next_maintenance_date),
          INDEX idx_status (status),
          FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='预防性维护计划表'
      `);
      console.log('✓ preventive_maintenance_plans 表创建成功');
    } else {
      console.log('✓ preventive_maintenance_plans 表已存在');
    }

    // 完善 maintenance_logs 表，添加可能缺失的字段
    console.log('\n检查并完善 maintenance_logs 表...');

    // 检查现有字段
    const [logColumns] = await db.execute('DESCRIBE maintenance_logs');
    const existingColumns = logColumns.map(col => col.Field);

    // 需要添加的字段列表
    const fieldsToAdd = [];

    if (!existingColumns.includes('maintenance_duration')) {
      fieldsToAdd.push(
        "ADD COLUMN maintenance_duration INT COMMENT '维护耗时（分钟）' AFTER maintenance_cost",
      );
    }

    if (!existingColumns.includes('maintenance_location')) {
      fieldsToAdd.push(
        "ADD COLUMN maintenance_location VARCHAR(200) COMMENT '维护地点' AFTER maintenance_person",
      );
    }

    if (!existingColumns.includes('quality_check')) {
      fieldsToAdd.push(
        "ADD COLUMN quality_check ENUM('合格', '不合格', '待检查') DEFAULT '待检查' COMMENT '质量检查结果' AFTER status",
      );
    }

    if (!existingColumns.includes('quality_check_person')) {
      fieldsToAdd.push(
        "ADD COLUMN quality_check_person VARCHAR(50) COMMENT '质量检查人' AFTER quality_check",
      );
    }

    if (!existingColumns.includes('quality_check_date')) {
      fieldsToAdd.push(
        "ADD COLUMN quality_check_date DATE COMMENT '质量检查日期' AFTER quality_check_person",
      );
    }

    if (!existingColumns.includes('warranty_info')) {
      fieldsToAdd.push("ADD COLUMN warranty_info TEXT COMMENT '保修信息' AFTER parts_replaced");
    }

    if (!existingColumns.includes('supplier_name')) {
      fieldsToAdd.push(
        "ADD COLUMN supplier_name VARCHAR(200) COMMENT '供应商名称' AFTER maintenance_cost",
      );
    }

    if (!existingColumns.includes('maintenance_method')) {
      fieldsToAdd.push(
        "ADD COLUMN maintenance_method VARCHAR(100) COMMENT '维护方式（现场/送修/远程）' AFTER maintenance_type",
      );
    }

    if (fieldsToAdd.length > 0) {
      await db.execute(`ALTER TABLE maintenance_logs ${fieldsToAdd.join(', ')}`);
      console.log(`✓ 已添加 ${fieldsToAdd.length} 个字段到 maintenance_logs 表`);
      fieldsToAdd.forEach(field => {
        const fieldName = field.match(/ADD COLUMN (\w+)/)?.[1];
        if (fieldName) console.log(`  - ${fieldName}`);
      });
    } else {
      console.log('✓ maintenance_logs 表字段已完整');
    }

    // 创建维护日志附件表
    console.log('\n检查并创建 maintenance_log_attachments 表...');
    const [attachmentTables] = await db.execute("SHOW TABLES LIKE 'maintenance_log_attachments'");

    if (attachmentTables.length === 0) {
      await db.execute(`
        CREATE TABLE IF NOT EXISTS maintenance_log_attachments (
          id INT PRIMARY KEY AUTO_INCREMENT,
          maintenance_log_id INT NOT NULL COMMENT '维护日志ID',
          file_name VARCHAR(255) NOT NULL COMMENT '文件名',
          file_path VARCHAR(500) NOT NULL COMMENT '文件路径',
          file_type VARCHAR(50) COMMENT '文件类型',
          file_size INT COMMENT '文件大小（字节）',
          upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '上传日期',
          uploaded_by VARCHAR(50) COMMENT '上传人',
          description TEXT COMMENT '文件描述',
          INDEX idx_maintenance_log (maintenance_log_id),
          FOREIGN KEY (maintenance_log_id) REFERENCES maintenance_logs(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='维护日志附件表'
      `);
      console.log('✓ maintenance_log_attachments 表创建成功');
    } else {
      console.log('✓ maintenance_log_attachments 表已存在');
    }

    // 创建维护历史统计视图（可选，用于快速查询）
    console.log('\n检查并创建维护统计视图...');
    try {
      await db.execute('DROP VIEW IF EXISTS v_maintenance_statistics');
      await db.execute(`
        CREATE VIEW v_maintenance_statistics AS
        SELECT 
          ml.asset_id,
          ml.asset.code,
          ml.asset_name,
          COUNT(*) as total_maintenance_count,
          SUM(ml.maintenance_cost) as total_maintenance_cost,
          MAX(ml.maintenance_date) as last_maintenance_date,
          MIN(ml.maintenance_date) as first_maintenance_date,
          COUNT(CASE WHEN ml.maintenance_type = '故障维修' THEN 1 END) as fault_repair_count,
          COUNT(CASE WHEN ml.maintenance_type = '预防性维护' THEN 1 END) as preventive_maintenance_count,
          COUNT(CASE WHEN ml.maintenance_type = '日常维护' THEN 1 END) as routine_maintenance_count
        FROM maintenance_logs ml
        GROUP BY ml.asset_id, ml.asset.code, ml.asset_name
      `);
      console.log('✓ 维护统计视图创建成功');
    } catch (viewError) {
      console.log('⚠ 创建视图失败（可能已存在）:', viewError.message);
    }

    // 添加索引优化查询性能
    console.log('\n检查并添加索引...');
    try {
      const [indexes] = await db.execute(
        "SHOW INDEXES FROM maintenance_logs WHERE Key_name = 'idx_maintenance_person'",
      );
      if (indexes.length === 0) {
        await db.execute(
          'CREATE INDEX idx_maintenance_person ON maintenance_logs(maintenance_person)',
        );
        console.log('✓ 已添加 maintenance_person 索引');
      }
    } catch (idxError) {
      console.log('⚠ 索引可能已存在');
    }

    try {
      const [indexes2] = await db.execute(
        "SHOW INDEXES FROM maintenance_logs WHERE Key_name = 'idx_created_at'",
      );
      if (indexes2.length === 0) {
        await db.execute('CREATE INDEX idx_created_at ON maintenance_logs(created_at)');
        console.log('✓ 已添加 created_at 索引');
      }
    } catch (idxError) {
      console.log('⚠ 索引可能已存在');
    }

    console.log('\n✅ 维护日志表结构完善完成！');
    console.log('\n📋 表结构说明：');
    console.log('1. maintenance_logs - 维护日志主表（已完善）');
    console.log('2. preventive_maintenance_plans - 预防性维护计划表');
    console.log('3. maintenance_requests - 故障维修申请表');
    console.log('4. maintenance_log_attachments - 维护日志附件表（新增）');
    console.log('5. v_maintenance_statistics - 维护统计视图（新增）');
  } catch (error) {
    console.error('❌ 完善表结构失败:', error);
    throw error;
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  improveMaintenanceTables()
    .then(() => {
      console.log('\n脚本执行完成');
      process.exit(0);
    })
    .catch(error => {
      console.error('脚本执行失败:', error);
      process.exit(1);
    });
}

module.exports = improveMaintenanceTables;
