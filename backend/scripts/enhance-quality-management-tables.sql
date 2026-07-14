-- ============================================
-- 质量管理模块表结构增强 SQL 脚本
-- ============================================
-- 说明：此脚本用于增强质量管理模块的数据库表结构
-- 添加周期管理、预警等功能所需的字段和表
-- ============================================

-- 1. 为计量管理表添加周期相关字段
ALTER TABLE metrology_records
ADD COLUMN IF NOT EXISTS metrology_cycle INT COMMENT '计量周期（月）',
ADD COLUMN IF NOT EXISTS warning_days INT DEFAULT 30 COMMENT '预警天数（提前多少天提醒）',
ADD COLUMN IF NOT EXISTS certificate_validity_date DATE COMMENT '证书有效期',
ADD COLUMN IF NOT EXISTS is_auto_remind TINYINT(1) DEFAULT 1 COMMENT '是否自动提醒';

-- 2. 为质控管理表添加周期相关字段
ALTER TABLE quality_control_records
ADD COLUMN IF NOT EXISTS qc_cycle INT COMMENT '质控周期（月）',
ADD COLUMN IF NOT EXISTS warning_days INT DEFAULT 30 COMMENT '预警天数（提前多少天提醒）',
ADD COLUMN IF NOT EXISTS is_auto_remind TINYINT(1) DEFAULT 1 COMMENT '是否自动提醒';

-- 3. 创建质量管理预警记录表
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
  updated_at DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_alert_type (alert_type),
  INDEX idx_record_id (record_id),
  INDEX idx_asset_id (asset_id),
  INDEX idx_alert_date (alert_date),
  INDEX idx_due_date (due_date),
  INDEX idx_is_read (is_read),
  INDEX idx_is_handled (is_handled)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='质量管理预警记录表';

-- 4. 创建质量管理周期配置表（用于资产级别的周期配置）
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
  updated_at DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_asset_id (asset_id),
  INDEX idx_asset.code (asset.code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='质量管理周期配置表';

-- ============================================
-- 验证脚本
-- ============================================

-- 检查字段是否添加成功
SELECT 
  COLUMN_NAME, 
  COLUMN_TYPE, 
  COLUMN_COMMENT 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'metrology_records' 
  AND COLUMN_NAME IN ('metrology_cycle', 'warning_days', 'certificate_validity_date', 'is_auto_remind');

SELECT 
  COLUMN_NAME, 
  COLUMN_TYPE, 
  COLUMN_COMMENT 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'quality_control_records' 
  AND COLUMN_NAME IN ('qc_cycle', 'warning_days', 'is_auto_remind');

-- 检查新表是否创建成功
SELECT TABLE_NAME, TABLE_COMMENT 
FROM INFORMATION_SCHEMA.TABLES 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME IN ('quality_management_alerts', 'quality_management_cycles');
