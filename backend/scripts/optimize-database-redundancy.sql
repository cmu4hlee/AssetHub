-- ============================================================
-- 数据库冗余优化脚本
-- 执行前请务必备份数据库！
-- ============================================================

-- ============================================================
-- 1. 删除冗余索引
-- ============================================================

-- assets 表 - 被复合索引覆盖的单列索引
ALTER TABLE assets DROP INDEX IF EXISTS idx_status; 
-- 说明: 被 idx_assets_tenant_status_created 覆盖

ALTER TABLE assets DROP INDEX IF EXISTS idx_category;
-- 说明: 被 idx_assets_tenant_category_location 覆盖

-- 注意: 以下索引保留，因为查询模式可能需要
-- ALTER TABLE assets DROP INDEX IF EXISTS idx_type; 
-- ALTER TABLE assets DROP INDEX IF EXISTS idx_department;

-- ============================================================
-- 2. 删除外键自动创建的重复索引
-- ============================================================

-- inventory_details 表 - 外键已自动创建索引
-- ALTER TABLE inventory_details DROP INDEX IF EXISTS idx_inventory;
-- ALTER TABLE inventory_details DROP INDEX IF EXISTS idx_asset;

-- transfer_records 表
-- ALTER TABLE transfer_records DROP INDEX IF EXISTS idx_asset;

-- idle_assets 表
-- ALTER TABLE idle_assets DROP INDEX IF EXISTS idx_asset;

-- ============================================================
-- 3. 统一时间字段类型
-- ============================================================

-- uptime_statistics 表
ALTER TABLE uptime_statistics 
  MODIFY COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  MODIFY COLUMN updated_at TIMESTAMP NULL DEFAULT NULL;

-- 检查其他表的类型一致性
-- SELECT 
--   TABLE_NAME,
--   COLUMN_NAME,
--   DATA_TYPE,
--   COLUMN_DEFAULT
-- FROM INFORMATION_SCHEMA.COLUMNS
-- WHERE COLUMN_NAME IN ('created_at', 'updated_at')
-- AND TABLE_SCHEMA = 'zcgl'
-- ORDER BY TABLE_NAME, COLUMN_NAME;

-- ============================================================
-- 4. 添加缺失的外键约束（谨慎执行）
-- ============================================================

-- 先检查数据一致性
-- SELECT COUNT(*) FROM maintenance_logs ml 
-- LEFT JOIN assets a ON ml.asset_id = a.id 
-- WHERE a.id IS NULL AND ml.asset_id IS NOT NULL;

-- 如果有孤立数据，先清理或修复
-- DELETE FROM maintenance_logs 
-- WHERE asset_id NOT IN (SELECT id FROM assets);

-- 然后添加外键
-- ALTER TABLE maintenance_logs
--   ADD CONSTRAINT fk_maintenance_logs_asset 
--   FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE;

-- maintenance_requests 表
-- ALTER TABLE maintenance_requests
--   ADD CONSTRAINT fk_maintenance_requests_asset 
--   FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE SET NULL;

-- maintenance_plans 表
-- ALTER TABLE maintenance_plans
--   ADD CONSTRAINT fk_maintenance_plans_asset 
--   FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE SET NULL;

-- ============================================================
-- 5. 创建租户隔离索引（如果不存在）
-- ============================================================

-- assets 表
CREATE INDEX IF NOT EXISTS idx_assets_tenant 
ON assets(tenant_id, id);

-- maintenance_logs 表
CREATE INDEX IF NOT EXISTS idx_maintenance_logs_tenant 
ON maintenance_logs(tenant_id, created_at);

-- maintenance_workorders 表
CREATE INDEX IF NOT EXISTS idx_maintenance_workorders_tenant 
ON maintenance_workorders(tenant_id, created_at);

-- ============================================================
-- 6. 优化大表索引（可选）
-- ============================================================

-- audit_logs 表 - 如果数据量很大，考虑分区
-- 已经存在分区表 audit_logs_partitioned，需要数据迁移

-- ============================================================
-- 7. 清理无用索引（需要确认业务查询后再执行）
-- ============================================================

-- 检查索引使用情况
-- SELECT 
--   OBJECT_SCHEMA,
--   OBJECT_NAME,
--   INDEX_NAME,
--   COUNT_STAR,
--   SUM_TIMER_WAIT
-- FROM performance_schema.table_io_waits_summary_by_index_usage
-- WHERE OBJECT_SCHEMA = 'zcgl'
-- AND INDEX_NAME IS NOT NULL
-- ORDER BY COUNT_STAR ASC;

-- 删除从未使用的索引（谨慎！）
-- ALTER TABLE xxx DROP INDEX IF EXISTS xxx;

-- ============================================================
-- 8. 分析表更新统计信息
-- ============================================================

ANALYZE TABLE assets;
ANALYZE TABLE maintenance_logs;
ANALYZE TABLE maintenance_workorders;
ANALYZE TABLE maintenance_requests;
ANALYZE TABLE maintenance_plans;
ANALYZE TABLE inventory_records;
ANALYZE TABLE inventory_details;
ANALYZE TABLE transfer_records;
ANALYZE TABLE idle_assets;
ANALYZE TABLE uptime_statistics;

-- ============================================================
-- 优化完成
-- ============================================================

SELECT '数据库冗余优化完成' AS result;
