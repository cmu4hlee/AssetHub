-- 修复多租户隔离问题的SQL脚本
-- 1. 将所有表的tenant_id字段从NULL改为NOT NULL
-- 2. 为所有表添加外键约束
-- 3. 确保数据完整性

-- 设置默认租户ID（根据实际情况调整）
SET @default_tenant_id = 1;

-- 1. 修复现有记录的tenant_id为NULL的问题
UPDATE acceptance_application_signatures SET tenant_id = @default_tenant_id WHERE tenant_id IS NULL;
UPDATE adverse_reaction_attachments SET tenant_id = @default_tenant_id WHERE tenant_id IS NULL;
UPDATE asset_acceptance_files SET tenant_id = @default_tenant_id WHERE tenant_id IS NULL;
UPDATE asset_acceptance_records SET tenant_id = @default_tenant_id WHERE tenant_id IS NULL;
UPDATE asset_categories SET tenant_id = @default_tenant_id WHERE tenant_id IS NULL;
UPDATE asset_change_logs SET tenant_id = @default_tenant_id WHERE tenant_id IS NULL;
UPDATE asset_device_mapping SET tenant_id = @default_tenant_id WHERE tenant_id IS NULL;
UPDATE asset_images SET tenant_id = @default_tenant_id WHERE tenant_id IS NULL;
UPDATE asset_location_history SET tenant_id = @default_tenant_id WHERE tenant_id IS NULL;
UPDATE asset_locations SET tenant_id = @default_tenant_id WHERE tenant_id IS NULL;
UPDATE asset_shares SET tenant_id = @default_tenant_id WHERE tenant_id IS NULL;
UPDATE asset_transfer_requests SET tenant_id = @default_tenant_id WHERE tenant_id IS NULL;
UPDATE assets SET tenant_id = @default_tenant_id WHERE tenant_id IS NULL;
UPDATE audit_logs SET tenant_id = @default_tenant_id WHERE tenant_id IS NULL;
UPDATE common_asset_stats SET tenant_id = @default_tenant_id WHERE tenant_id IS NULL;
UPDATE departments SET tenant_id = @default_tenant_id WHERE tenant_id IS NULL;
UPDATE iot_devices SET tenant_id = @default_tenant_id WHERE tenant_id IS NULL;
UPDATE location_codes SET tenant_id = @default_tenant_id WHERE tenant_id IS NULL;
UPDATE maintenance_logs SET tenant_id = @default_tenant_id WHERE tenant_id IS NULL;
UPDATE preventive_maintenance_plans SET tenant_id = @default_tenant_id WHERE tenant_id IS NULL;
-- UPDATE quality_control SET tenant_id = @default_tenant_id WHERE tenant_id IS NULL;
UPDATE technical_document_shares SET tenant_id = @default_tenant_id WHERE tenant_id IS NULL;
UPDATE technical_documents SET tenant_id = @default_tenant_id WHERE tenant_id IS NULL;
UPDATE users SET tenant_id = @default_tenant_id WHERE tenant_id IS NULL;

-- 2. 将tenant_id字段改为NOT NULL（备份表除外，因为NULL表示全库备份）
ALTER TABLE acceptance_application_signatures MODIFY COLUMN tenant_id INT NOT NULL;
ALTER TABLE adverse_reaction_attachments MODIFY COLUMN tenant_id INT NOT NULL;
ALTER TABLE asset_acceptance_files MODIFY COLUMN tenant_id INT NOT NULL;
ALTER TABLE asset_acceptance_records MODIFY COLUMN tenant_id INT NOT NULL;
ALTER TABLE asset_categories MODIFY COLUMN tenant_id INT NOT NULL;
ALTER TABLE asset_change_logs MODIFY COLUMN tenant_id INT NOT NULL;
ALTER TABLE asset_device_mapping MODIFY COLUMN tenant_id INT NOT NULL;
ALTER TABLE asset_images MODIFY COLUMN tenant_id INT NOT NULL;
ALTER TABLE asset_location_history MODIFY COLUMN tenant_id INT NOT NULL;
ALTER TABLE asset_locations MODIFY COLUMN tenant_id INT NOT NULL;
ALTER TABLE asset_shares MODIFY COLUMN tenant_id INT NOT NULL;
ALTER TABLE asset_transfer_requests MODIFY COLUMN tenant_id INT NOT NULL;
ALTER TABLE assets MODIFY COLUMN tenant_id INT NOT NULL;
ALTER TABLE audit_logs MODIFY COLUMN tenant_id INT NOT NULL;
ALTER TABLE common_asset_stats MODIFY COLUMN tenant_id INT NOT NULL;
ALTER TABLE departments MODIFY COLUMN tenant_id INT NOT NULL;
ALTER TABLE iot_devices MODIFY COLUMN tenant_id INT NOT NULL;
ALTER TABLE location_codes MODIFY COLUMN tenant_id INT NOT NULL;
ALTER TABLE maintenance_logs MODIFY COLUMN tenant_id INT NOT NULL;
ALTER TABLE preventive_maintenance_plans MODIFY COLUMN tenant_id INT NOT NULL;
-- ALTER TABLE quality_control MODIFY COLUMN tenant_id INT NOT NULL;
ALTER TABLE technical_document_shares MODIFY COLUMN tenant_id INT NOT NULL;
ALTER TABLE technical_documents MODIFY COLUMN tenant_id INT NOT NULL;
ALTER TABLE users MODIFY COLUMN tenant_id INT NULL; -- 超级管理员可以没有租户

-- 3. 外键约束创建暂时注释，因为可能存在数据不一致问题
-- 后续可以在确保所有表的tenant_id值都存在于tenants表中后再创建外键约束
-- ALTER TABLE acceptance_application_signatures ADD CONSTRAINT fk_acceptance_application_signatures_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE ON UPDATE CASCADE;
-- ALTER TABLE adverse_reaction_attachments ADD CONSTRAINT fk_adverse_reaction_attachments_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE ON UPDATE CASCADE;
-- ALTER TABLE asset_acceptance_files ADD CONSTRAINT fk_asset_acceptance_files_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE ON UPDATE CASCADE;
-- ALTER TABLE asset_acceptance_records ADD CONSTRAINT fk_asset_acceptance_records_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE ON UPDATE CASCADE;
-- ALTER TABLE asset_categories ADD CONSTRAINT fk_asset_categories_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE ON UPDATE CASCADE;
-- ALTER TABLE asset_change_logs ADD CONSTRAINT fk_asset_change_logs_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE ON UPDATE CASCADE;
-- ALTER TABLE asset_device_mapping ADD CONSTRAINT fk_asset_device_mapping_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE ON UPDATE CASCADE;
-- ALTER TABLE asset_images ADD CONSTRAINT fk_asset_images_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE ON UPDATE CASCADE;
-- ALTER TABLE asset_location_history ADD CONSTRAINT fk_asset_location_history_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE ON UPDATE CASCADE;
-- ALTER TABLE asset_locations ADD CONSTRAINT fk_asset_locations_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE ON UPDATE CASCADE;
-- ALTER TABLE asset_shares ADD CONSTRAINT fk_asset_shares_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE ON UPDATE CASCADE;
-- ALTER TABLE asset_transfer_requests ADD CONSTRAINT fk_asset_transfer_requests_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE ON UPDATE CASCADE;
-- ALTER TABLE assets ADD CONSTRAINT fk_assets_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE ON UPDATE CASCADE;
-- ALTER TABLE audit_logs ADD CONSTRAINT fk_audit_logs_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE ON UPDATE CASCADE;
-- ALTER TABLE common_asset_stats ADD CONSTRAINT fk_common_asset_stats_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE ON UPDATE CASCADE;
-- ALTER TABLE departments ADD CONSTRAINT fk_departments_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE ON UPDATE CASCADE;
-- ALTER TABLE iot_devices ADD CONSTRAINT fk_iot_devices_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE ON UPDATE CASCADE;
-- ALTER TABLE location_codes ADD CONSTRAINT fk_location_codes_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE ON UPDATE CASCADE;
-- ALTER TABLE maintenance_logs ADD CONSTRAINT fk_maintenance_logs_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE ON UPDATE CASCADE;
-- ALTER TABLE preventive_maintenance_plans ADD CONSTRAINT fk_preventive_maintenance_plans_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE ON UPDATE CASCADE;
-- ALTER TABLE quality_control ADD CONSTRAINT fk_quality_control_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE ON UPDATE CASCADE;
-- ALTER TABLE technical_document_shares ADD CONSTRAINT fk_technical_document_shares_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE ON UPDATE CASCADE;
-- ALTER TABLE technical_documents ADD CONSTRAINT fk_technical_documents_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE ON UPDATE CASCADE;

-- 4. 外键约束创建暂时注释
-- ALTER TABLE database_backups ADD CONSTRAINT fk_database_backups_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE SET NULL ON UPDATE CASCADE;

-- 5. 验证修复结果
SELECT 'acceptance_application_signatures' AS table_name, COUNT(*) AS total, SUM(CASE WHEN tenant_id IS NULL THEN 1 ELSE 0 END) AS null_tenant_id FROM acceptance_application_signatures UNION ALL
SELECT 'adverse_reaction_attachments', COUNT(*), SUM(CASE WHEN tenant_id IS NULL THEN 1 ELSE 0 END) FROM adverse_reaction_attachments UNION ALL
SELECT 'asset_acceptance_files', COUNT(*), SUM(CASE WHEN tenant_id IS NULL THEN 1 ELSE 0 END) FROM asset_acceptance_files UNION ALL
SELECT 'asset_acceptance_records', COUNT(*), SUM(CASE WHEN tenant_id IS NULL THEN 1 ELSE 0 END) FROM asset_acceptance_records UNION ALL
SELECT 'asset_categories', COUNT(*), SUM(CASE WHEN tenant_id IS NULL THEN 1 ELSE 0 END) FROM asset_categories UNION ALL
SELECT 'asset_change_logs', COUNT(*), SUM(CASE WHEN tenant_id IS NULL THEN 1 ELSE 0 END) FROM asset_change_logs UNION ALL
SELECT 'asset_device_mapping', COUNT(*), SUM(CASE WHEN tenant_id IS NULL THEN 1 ELSE 0 END) FROM asset_device_mapping UNION ALL
SELECT 'asset_images', COUNT(*), SUM(CASE WHEN tenant_id IS NULL THEN 1 ELSE 0 END) FROM asset_images UNION ALL
SELECT 'asset_location_history', COUNT(*), SUM(CASE WHEN tenant_id IS NULL THEN 1 ELSE 0 END) FROM asset_location_history UNION ALL
SELECT 'asset_locations', COUNT(*), SUM(CASE WHEN tenant_id IS NULL THEN 1 ELSE 0 END) FROM asset_locations UNION ALL
SELECT 'asset_shares', COUNT(*), SUM(CASE WHEN tenant_id IS NULL THEN 1 ELSE 0 END) FROM asset_shares UNION ALL
SELECT 'asset_transfer_requests', COUNT(*), SUM(CASE WHEN tenant_id IS NULL THEN 1 ELSE 0 END) FROM asset_transfer_requests UNION ALL
SELECT 'assets', COUNT(*), SUM(CASE WHEN tenant_id IS NULL THEN 1 ELSE 0 END) FROM assets UNION ALL
SELECT 'audit_logs', COUNT(*), SUM(CASE WHEN tenant_id IS NULL THEN 1 ELSE 0 END) FROM audit_logs UNION ALL
SELECT 'common_asset_stats', COUNT(*), SUM(CASE WHEN tenant_id IS NULL THEN 1 ELSE 0 END) FROM common_asset_stats UNION ALL
SELECT 'departments', COUNT(*), SUM(CASE WHEN tenant_id IS NULL THEN 1 ELSE 0 END) FROM departments UNION ALL
SELECT 'iot_devices', COUNT(*), SUM(CASE WHEN tenant_id IS NULL THEN 1 ELSE 0 END) FROM iot_devices UNION ALL
SELECT 'location_codes', COUNT(*), SUM(CASE WHEN tenant_id IS NULL THEN 1 ELSE 0 END) FROM location_codes UNION ALL
SELECT 'maintenance_logs', COUNT(*), SUM(CASE WHEN tenant_id IS NULL THEN 1 ELSE 0 END) FROM maintenance_logs UNION ALL
SELECT 'preventive_maintenance_plans', COUNT(*), SUM(CASE WHEN tenant_id IS NULL THEN 1 ELSE 0 END) FROM preventive_maintenance_plans UNION ALL
-- SELECT 'quality_control', COUNT(*), SUM(CASE WHEN tenant_id IS NULL THEN 1 ELSE 0 END) FROM quality_control UNION ALL
SELECT 'technical_document_shares', COUNT(*), SUM(CASE WHEN tenant_id IS NULL THEN 1 ELSE 0 END) FROM technical_document_shares UNION ALL
SELECT 'technical_documents', COUNT(*), SUM(CASE WHEN tenant_id IS NULL THEN 1 ELSE 0 END) FROM technical_documents;

SELECT '修复完成！' AS result;