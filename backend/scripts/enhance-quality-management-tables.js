const db = require('../config/database');

/**
 * 增强质量管理模块表结构
 * 添加周期管理、预警等功能所需的字段
 */
async function enhanceQualityManagementTables() {
  try {
    console.log('开始增强质量管理模块表结构...\n');

    // 1. 为计量管理表添加周期相关字段
    try {
      await db.execute(`
        ALTER TABLE metrology_records
        ADD COLUMN IF NOT EXISTS metrology_cycle INT COMMENT '计量周期（月）',
        ADD COLUMN IF NOT EXISTS warning_days INT DEFAULT 30 COMMENT '预警天数（提前多少天提醒）',
        ADD COLUMN IF NOT EXISTS certificate_validity_date DATE COMMENT '证书有效期',
        ADD COLUMN IF NOT EXISTS is_auto_remind TINYINT(1) DEFAULT 1 COMMENT '是否自动提醒'
      `);
      console.log('✓ 计量管理表字段增强完成');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('✓ 计量管理表字段已存在，跳过');
      } else {
        throw error;
      }
    }

    // 2. 为质控管理表添加周期相关字段
    try {
      await db.execute(`
        ALTER TABLE quality_control_records
        ADD COLUMN IF NOT EXISTS qc_cycle INT COMMENT '质控周期（月）',
        ADD COLUMN IF NOT EXISTS warning_days INT DEFAULT 30 COMMENT '预警天数（提前多少天提醒）',
        ADD COLUMN IF NOT EXISTS is_auto_remind TINYINT(1) DEFAULT 1 COMMENT '是否自动提醒'
      `);
      console.log('✓ 质控管理表字段增强完成');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('✓ 质控管理表字段已存在，跳过');
      } else {
        throw error;
      }
    }

    // 3. 创建质量管理预警记录表
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
        updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
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

    // 4. 创建质量管理周期配置表（用于资产级别的周期配置）
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
        updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_asset_id (asset_id),
        INDEX idx_asset.code (asset.code)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='质量管理周期配置表'
    `);
    console.log('✓ 质量管理周期配置表创建成功');

    console.log('\n✅ 质量管理模块表结构增强完成！');
    console.log('\n新增功能：');
    console.log('  - 计量周期管理');
    console.log('  - 质控周期管理');
    console.log('  - 预警提醒功能');
    console.log('  - 周期配置管理');
  } catch (error) {
    console.error('❌ 增强表结构失败:', error);
    throw error;
  }
}

// 执行脚本
if (require.main === module) {
  enhanceQualityManagementTables()
    .then(() => {
      console.log('\n脚本执行完成');
      process.exit(0);
    })
    .catch(error => {
      console.error('脚本执行失败:', error);
      process.exit(1);
    });
}

module.exports = enhanceQualityManagementTables;
