-- 为 inventory_scan_logs 表添加 tenant_id 字段的SQL脚本
-- 执行此脚本可以为盘点扫描日志表添加 tenant_id 字段和索引，支持租户隔离

-- ==========================================
-- 盘点扫描日志表添加 tenant_id 字段
-- ==========================================
ALTER TABLE IF EXISTS inventory_scan_logs
ADD COLUMN IF NOT EXISTS tenant_id INT NOT NULL DEFAULT 1 COMMENT '租户ID' AFTER id,
ADD INDEX IF NOT EXISTS idx_inventory_scan_logs_tenant_id (tenant_id);

-- 为现有记录填充 tenant_id（通过关联 inventory_records 表获取）
UPDATE inventory_scan_logs isl
INNER JOIN inventory_records ir ON isl.inventory_id = ir.id
SET isl.tenant_id = ir.tenant_id
WHERE isl.tenant_id = 1 OR isl.tenant_id IS NULL;

-- ==========================================
-- 脚本执行完成
-- ==========================================
