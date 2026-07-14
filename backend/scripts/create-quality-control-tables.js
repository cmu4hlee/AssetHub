const db = require('../config/database');

/**
 * 创建质量管理模块相关表
 * 包括：计量管理、质控管理
 */
async function createQualityControlTables() {
  try {
    console.log('开始创建质量管理模块表...');

    // 1. 创建计量管理表
    await db.execute(`
      CREATE TABLE IF NOT EXISTS metrology_records (
        id INT PRIMARY KEY AUTO_INCREMENT,
        record_no VARCHAR(100) NOT NULL UNIQUE COMMENT '计量单号',
        asset_id INT NOT NULL COMMENT '资产ID',
        asset.code VARCHAR(100) COMMENT '资产编号',
        asset_name VARCHAR(200) COMMENT '资产名称',
        metrology_type ENUM('首次检定', '周期检定', '校准', '期间核查', '其他') NOT NULL COMMENT '计量类型',
        metrology_date DATE NOT NULL COMMENT '计量日期',
        next_metrology_date DATE COMMENT '下次计量日期',
        metrology_agency VARCHAR(200) COMMENT '计量机构',
        certificate_no VARCHAR(100) COMMENT '证书编号',
        result ENUM('合格', '不合格', '限用', '待检') DEFAULT '待检' COMMENT '计量结果',
        accuracy_level VARCHAR(50) COMMENT '准确度等级',
        measurement_range VARCHAR(100) COMMENT '测量范围',
        cost DECIMAL(10, 2) DEFAULT 0 COMMENT '计量费用',
        operator VARCHAR(50) COMMENT '操作人',
        remark TEXT COMMENT '备注',
        status ENUM('待检', '进行中', '已完成', '已取消') DEFAULT '待检' COMMENT '状态',
        -- 增强字段
        metrology_cycle INT COMMENT '计量周期（月）',
        warning_days INT DEFAULT 30 COMMENT '预警天数（提前多少天提醒）',
        certificate_validity_date DATE COMMENT '证书有效期',
        is_auto_remind TINYINT(1) DEFAULT 1 COMMENT '是否自动提醒',
        created_by VARCHAR(50) COMMENT '创建人',
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP NULL DEFAULT NULL,
        INDEX idx_asset_id (asset_id),
        INDEX idx_record_no (record_no),
        INDEX idx_metrology_date (metrology_date),
        INDEX idx_next_metrology_date (next_metrology_date),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='计量管理表'
    `);
    console.log('✓ 计量管理表创建成功');

    // 2. 创建计量附件表
    await db.execute(`
      CREATE TABLE IF NOT EXISTS metrology_attachments (
        id INT PRIMARY KEY AUTO_INCREMENT,
        metrology_id INT NOT NULL COMMENT '计量记录ID',
        file_name VARCHAR(255) NOT NULL COMMENT '文件名',
        file_path VARCHAR(500) NOT NULL COMMENT '文件路径',
        file_size INT COMMENT '文件大小（字节）',
        file_type VARCHAR(50) COMMENT '文件类型',
              upload_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_metrology_id (metrology_id),
        FOREIGN KEY (metrology_id) REFERENCES metrology_records(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='计量附件表'
    `);
    console.log('✓ 计量附件表创建成功');

    // 3. 创建质控管理表
    await db.execute(`
      CREATE TABLE IF NOT EXISTS quality_control_records (
        id INT PRIMARY KEY AUTO_INCREMENT,
        record_no VARCHAR(100) NOT NULL UNIQUE COMMENT '质控单号',
        asset_id INT NOT NULL COMMENT '资产ID',
        asset.code VARCHAR(100) COMMENT '资产编号',
        asset_name VARCHAR(200) COMMENT '资产名称',
        qc_type ENUM('日常质控', '定期质控', '专项质控', '验收质控', '其他') NOT NULL COMMENT '质控类型',
        qc_date DATE NOT NULL COMMENT '质控日期',
        next_qc_date DATE COMMENT '下次质控日期',
        qc_item VARCHAR(200) COMMENT '质控项目',
        qc_method VARCHAR(200) COMMENT '质控方法',
        qc_standard VARCHAR(200) COMMENT '质控标准',
        result ENUM('合格', '不合格', '待检', '整改中') DEFAULT '待检' COMMENT '质控结果',
        qc_value VARCHAR(100) COMMENT '质控数值',
        standard_value VARCHAR(100) COMMENT '标准值',
        deviation VARCHAR(100) COMMENT '偏差',
        operator VARCHAR(50) COMMENT '操作人',
        reviewer VARCHAR(50) COMMENT '审核人',
        review_date DATE COMMENT '审核日期',
        remark TEXT COMMENT '备注',
        status ENUM('待检', '进行中', '已完成', '已取消', '整改中') DEFAULT '待检' COMMENT '状态',
        -- 增强字段
        qc_cycle INT COMMENT '质控周期（月）',
        warning_days INT DEFAULT 30 COMMENT '预警天数（提前多少天提醒）',
        is_auto_remind TINYINT(1) DEFAULT 1 COMMENT '是否自动提醒',
        created_by VARCHAR(50) COMMENT '创建人',
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP NULL DEFAULT NULL,
        INDEX idx_asset_id (asset_id),
        INDEX idx_record_no (record_no),
        INDEX idx_qc_date (qc_date),
        INDEX idx_next_qc_date (next_qc_date),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='质控管理表'
    `);
    console.log('✓ 质控管理表创建成功');

    // 4. 创建质控附件表
    await db.execute(`
      CREATE TABLE IF NOT EXISTS quality_control_attachments (
        id INT PRIMARY KEY AUTO_INCREMENT,
        qc_id INT NOT NULL COMMENT '质控记录ID',
        file_name VARCHAR(255) NOT NULL COMMENT '文件名',
        file_path VARCHAR(500) NOT NULL COMMENT '文件路径',
        file_size INT COMMENT '文件大小（字节）',
        file_type VARCHAR(50) COMMENT '文件类型',
              upload_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_qc_id (qc_id),
        FOREIGN KEY (qc_id) REFERENCES quality_control_records(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='质控附件表'
    `);
    console.log('✓ 质控附件表创建成功');

    // 5. 创建质量管理预警记录表
    await db.execute(`
      CREATE TABLE IF NOT EXISTS quality_management_alerts (
        id INT PRIMARY KEY AUTO_INCREMENT,
        alert_type ENUM('metrology', 'quality_control') NOT NULL COMMENT '预警类型',
        record_id INT NOT NULL COMMENT '记录ID',
        asset_id INT NOT NULL COMMENT '资产ID',
        asset.code VARCHAR(100) COMMENT '资产编号',
        asset_name VARCHAR(200) COMMENT '资产名称',
        alert_date DATE NOT NULL COMMENT '预警日期',
        due_date DATE NOT NULL COMMENT '到期日期',
        days_remaining INT COMMENT '剩余天数',
        alert_level ENUM('normal', 'warning', 'urgent') DEFAULT 'normal' COMMENT '预警级别',
        is_read TINYINT(1) DEFAULT 0 COMMENT '是否已读',
        is_handled TINYINT(1) DEFAULT 0 COMMENT '是否已处理',
        handled_by VARCHAR(50) COMMENT '处理人',
        handled_at DATETIME COMMENT '处理时间',
        remark TEXT COMMENT '备注',
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP NULL DEFAULT NULL,
        INDEX idx_alert_type (alert_type),
        INDEX idx_record_id (record_id),
        INDEX idx_asset_id (asset_id),
        INDEX idx_alert_date (alert_date),
        INDEX idx_due_date (due_date),
        INDEX idx_is_read (is_read),
        INDEX idx_is_handled (is_handled)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='质量管理预警记录表'
    `);
    console.log('✓ 质量管理预警记录表创建成功');

    // 6. 创建质量管理周期配置表
    await db.execute(`
      CREATE TABLE IF NOT EXISTS quality_management_cycles (
        id INT PRIMARY KEY AUTO_INCREMENT,
        asset_id INT NOT NULL COMMENT '资产ID',
        asset.code VARCHAR(100) COMMENT '资产编号',
        asset_name VARCHAR(200) COMMENT '资产名称',
        metrology_cycle INT COMMENT '计量周期（月）',
        metrology_warning_days INT DEFAULT 30 COMMENT '计量预警天数',
        quality_control_cycle INT COMMENT '质控周期（月）',
        quality_control_warning_days INT DEFAULT 30 COMMENT '质控预警天数',
        is_auto_remind TINYINT(1) DEFAULT 1 COMMENT '是否自动提醒',
        remark TEXT COMMENT '备注',
        created_by VARCHAR(50) COMMENT '创建人',
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP NULL DEFAULT NULL,
        UNIQUE KEY uk_asset_id (asset_id),
        INDEX idx_asset.code (asset.code)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='质量管理周期配置表'
    `);
    console.log('✓ 质量管理周期配置表创建成功');

    console.log('\n✅ 质量管理模块表创建完成！');
    console.log('\n已创建的表：');
    console.log('  - metrology_records (计量管理表)');
    console.log('  - metrology_attachments (计量附件表)');
    console.log('  - quality_control_records (质控管理表)');
    console.log('  - quality_control_attachments (质控附件表)');
    console.log('  - quality_management_alerts (质量管理预警记录表)');
    console.log('  - quality_management_cycles (质量管理周期配置表)');
  } catch (error) {
    console.error('❌ 创建表失败:', error);
    throw error;
  }
}

// 执行脚本
if (require.main === module) {
  createQualityControlTables()
    .then(() => {
      console.log('\n脚本执行完成');
      process.exit(0);
    })
    .catch(error => {
      console.error('脚本执行失败:', error);
      process.exit(1);
    });
}

module.exports = createQualityControlTables;
