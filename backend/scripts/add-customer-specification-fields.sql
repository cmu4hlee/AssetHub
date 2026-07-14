-- ============================================
-- 添加客户名称、规格/型号、编号字段到计量管理表
-- ============================================

USE zcgl;

-- 为计量管理表添加新字段
ALTER TABLE IF EXISTS metrology_records 
ADD COLUMN IF NOT EXISTS customer_name VARCHAR(200) COMMENT '客户名称' AFTER asset_name,
ADD COLUMN IF NOT EXISTS specification VARCHAR(200) COMMENT '规格/型号' AFTER customer_name,
ADD COLUMN IF NOT EXISTS serial_number VARCHAR(100) COMMENT '编号' AFTER specification;

-- 为计量管理表添加索引
CREATE INDEX IF NOT EXISTS idx_customer_name ON metrology_records(customer_name);
CREATE INDEX IF NOT EXISTS idx_specification ON metrology_records(specification);
CREATE INDEX IF NOT EXISTS idx_serial_number ON metrology_records(serial_number);

-- 验证添加结果
SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, COLUMN_COMMENT 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'zcgl' AND TABLE_NAME = 'metrology_records'
AND COLUMN_NAME IN ('customer_name', 'specification', 'serial_number');
