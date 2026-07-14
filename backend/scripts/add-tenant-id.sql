-- 为需要的表添加tenant_id字段的SQL脚本
-- 执行此脚本可以为指定的表添加tenant_id字段和索引

-- ==========================================
-- 1. 验收申请签字表
-- ==========================================
ALTER TABLE IF EXISTS acceptance_application_signatures 
ADD COLUMN IF NOT EXISTS tenant_id INT NOT NULL COMMENT '租户ID',
ADD INDEX IF NOT EXISTS idx_tenant_id (tenant_id);

-- ==========================================
-- 2. 不良事件附件表
-- ==========================================
ALTER TABLE IF EXISTS adverse_reaction_attachments 
ADD COLUMN IF NOT EXISTS tenant_id INT NOT NULL COMMENT '租户ID',
ADD INDEX IF NOT EXISTS idx_tenant_id (tenant_id);

-- ==========================================
-- 3. 资产验收文件表
-- ==========================================
ALTER TABLE IF EXISTS asset_acceptance_files 
ADD COLUMN IF NOT EXISTS tenant_id INT NOT NULL COMMENT '租户ID',
ADD INDEX IF NOT EXISTS idx_tenant_id (tenant_id);

-- ==========================================
-- 4. 资产验收记录表
-- ==========================================
ALTER TABLE IF EXISTS asset_acceptance_records 
ADD COLUMN IF NOT EXISTS tenant_id INT NOT NULL COMMENT '租户ID',
ADD INDEX IF NOT EXISTS idx_tenant_id (tenant_id);

-- ==========================================
-- 5. 资产分类表
-- ==========================================
ALTER TABLE IF EXISTS asset_categories 
ADD COLUMN IF NOT EXISTS tenant_id INT NOT NULL COMMENT '租户ID',
ADD INDEX IF NOT EXISTS idx_tenant_id (tenant_id);

-- ==========================================
-- 6. 资产变更日志表
-- ==========================================
ALTER TABLE IF EXISTS asset_change_logs 
ADD COLUMN IF NOT EXISTS tenant_id INT NOT NULL COMMENT '租户ID',
ADD INDEX IF NOT EXISTS idx_tenant_id (tenant_id);

-- ==========================================
-- 7. 资产设备映射表
-- ==========================================
ALTER TABLE IF EXISTS asset_device_mapping 
ADD COLUMN IF NOT EXISTS tenant_id INT NOT NULL COMMENT '租户ID',
ADD INDEX IF NOT EXISTS idx_tenant_id (tenant_id);

-- ==========================================
-- 8. 资产图片表
-- ==========================================
ALTER TABLE IF EXISTS asset_images 
ADD COLUMN IF NOT EXISTS tenant_id INT NOT NULL COMMENT '租户ID',
ADD INDEX IF NOT EXISTS idx_tenant_id (tenant_id);

-- ==========================================
-- 9. 资产位置历史表
-- ==========================================
ALTER TABLE IF EXISTS asset_location_history 
ADD COLUMN IF NOT EXISTS tenant_id INT NOT NULL COMMENT '租户ID',
ADD INDEX IF NOT EXISTS idx_tenant_id (tenant_id);

-- ==========================================
-- 10. 资产位置表
-- ==========================================
ALTER TABLE IF EXISTS asset_locations 
ADD COLUMN IF NOT EXISTS tenant_id INT NOT NULL COMMENT '租户ID',
ADD INDEX IF NOT EXISTS idx_tenant_id (tenant_id);

-- ==========================================
-- 11. 资产分享表
-- ==========================================
ALTER TABLE IF EXISTS asset_shares 
ADD COLUMN IF NOT EXISTS tenant_id INT NOT NULL COMMENT '租户ID',
ADD INDEX IF NOT EXISTS idx_tenant_id (tenant_id);

-- ==========================================
-- 12. 资产转移申请表
-- ==========================================
ALTER TABLE IF EXISTS asset_transfer_requests 
ADD COLUMN IF NOT EXISTS tenant_id INT NOT NULL COMMENT '租户ID',
ADD INDEX IF NOT EXISTS idx_tenant_id (tenant_id);

-- ==========================================
-- 13. 资产表
-- ==========================================
ALTER TABLE IF EXISTS assets 
ADD COLUMN IF NOT EXISTS tenant_id INT NOT NULL COMMENT '租户ID',
ADD INDEX IF NOT EXISTS idx_tenant_id (tenant_id);

-- ==========================================
-- 14. 审计日志表
-- ==========================================
ALTER TABLE IF EXISTS audit_logs 
ADD COLUMN IF NOT EXISTS tenant_id INT NOT NULL COMMENT '租户ID',
ADD INDEX IF NOT EXISTS idx_tenant_id (tenant_id);

-- ==========================================
-- 15. 通用资产统计表
-- ==========================================
ALTER TABLE IF EXISTS common_asset_stats 
ADD COLUMN IF NOT EXISTS tenant_id INT NOT NULL COMMENT '租户ID',
ADD INDEX IF NOT EXISTS idx_tenant_id (tenant_id);


-- ==========================================
-- 为已有数据设置默认租户ID（可选）
-- ==========================================
-- 注意：仅在需要时取消注释并执行以下语句
-- UPDATE acceptance_application_signatures SET tenant_id = 1 WHERE tenant_id IS NULL;
-- UPDATE adverse_reaction_attachments SET tenant_id = 1 WHERE tenant_id IS NULL;
-- UPDATE asset_acceptance_files SET tenant_id = 1 WHERE tenant_id IS NULL;
-- UPDATE asset_acceptance_records SET tenant_id = 1 WHERE tenant_id IS NULL;
-- UPDATE asset_categories SET tenant_id = 1 WHERE tenant_id IS NULL;
-- UPDATE asset_change_logs SET tenant_id = 1 WHERE tenant_id IS NULL;
-- UPDATE asset_device_mapping SET tenant_id = 1 WHERE tenant_id IS NULL;
-- UPDATE asset_images SET tenant_id = 1 WHERE tenant_id IS NULL;
-- UPDATE asset_location_history SET tenant_id = 1 WHERE tenant_id IS NULL;
-- UPDATE asset_locations SET tenant_id = 1 WHERE tenant_id IS NULL;
-- UPDATE asset_shares SET tenant_id = 1 WHERE tenant_id IS NULL;
-- UPDATE asset_transfer_requests SET tenant_id = 1 WHERE tenant_id IS NULL;
-- UPDATE assets SET tenant_id = 1 WHERE tenant_id IS NULL;
-- UPDATE audit_logs SET tenant_id = 1 WHERE tenant_id IS NULL;
-- UPDATE common_asset_stats SET tenant_id = 1 WHERE tenant_id IS NULL;


-- ==========================================
-- 为tenant_id字段添加外键约束（可选）
-- ==========================================
-- 注意：仅在tenants表存在时执行以下语句
-- ALTER TABLE acceptance_application_signatures 
-- ADD CONSTRAINT fk_acceptance_application_signatures_tenant 
-- FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
-- 
-- ALTER TABLE adverse_reaction_attachments 
-- ADD CONSTRAINT fk_adverse_reaction_attachments_tenant 
-- FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
-- 
-- ALTER TABLE asset_acceptance_files 
-- ADD CONSTRAINT fk_asset_acceptance_files_tenant 
-- FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
-- 
-- ALTER TABLE asset_acceptance_records 
-- ADD CONSTRAINT fk_asset_acceptance_records_tenant 
-- FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
-- 
-- ALTER TABLE asset_categories 
-- ADD CONSTRAINT fk_asset_categories_tenant 
-- FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
-- 
-- ALTER TABLE asset_change_logs 
-- ADD CONSTRAINT fk_asset_change_logs_tenant 
-- FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
-- 
-- ALTER TABLE asset_device_mapping 
-- ADD CONSTRAINT fk_asset_device_mapping_tenant 
-- FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
-- 
-- ALTER TABLE asset_images 
-- ADD CONSTRAINT fk_asset_images_tenant 
-- FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
-- 
-- ALTER TABLE asset_location_history 
-- ADD CONSTRAINT fk_asset_location_history_tenant 
-- FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
-- 
-- ALTER TABLE asset_locations 
-- ADD CONSTRAINT fk_asset_locations_tenant 
-- FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
-- 
-- ALTER TABLE asset_shares 
-- ADD CONSTRAINT fk_asset_shares_tenant 
-- FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
-- 
-- ALTER TABLE asset_transfer_requests 
-- ADD CONSTRAINT fk_asset_transfer_requests_tenant 
-- FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
-- 
-- ALTER TABLE assets 
-- ADD CONSTRAINT fk_assets_tenant 
-- FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
-- 
-- ALTER TABLE audit_logs 
-- ADD CONSTRAINT fk_audit_logs_tenant 
-- FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
-- 
-- ALTER TABLE common_asset_stats 
-- ADD CONSTRAINT fk_common_asset_stats_tenant 
-- FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;


-- ==========================================
-- 脚本执行完成
-- ==========================================
