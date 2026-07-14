-- 为计量管理表添加计量校准模板所需字段

-- 1. 添加校准环境字段
ALTER TABLE IF EXISTS metrology_records 
ADD COLUMN calibration_environment VARCHAR(255) COMMENT '校准环境' AFTER measurement_range;

-- 2. 添加标准器具字段
ALTER TABLE IF EXISTS metrology_records 
ADD COLUMN standard_instrument VARCHAR(255) COMMENT '标准器具' AFTER calibration_environment;

-- 3. 添加标准证书编号字段
ALTER TABLE IF EXISTS metrology_records 
ADD COLUMN standard_certificate_no VARCHAR(100) COMMENT '标准证书编号' AFTER standard_instrument;

-- 4. 添加标准有效期字段
ALTER TABLE IF EXISTS metrology_records 
ADD COLUMN standard_validity DATE COMMENT '标准有效期' AFTER standard_certificate_no;

-- 5. 添加扩展不确定度字段
ALTER TABLE IF EXISTS metrology_records 
ADD COLUMN uncertainty VARCHAR(50) COMMENT '扩展不确定度' AFTER standard_validity;

-- 6. 添加校准项目字段
ALTER TABLE IF EXISTS metrology_records 
ADD COLUMN calibration_items TEXT COMMENT '校准项目' AFTER certificate_validity_date;

-- 7. 添加校准数据字段
ALTER TABLE IF EXISTS metrology_records 
ADD COLUMN calibration_data TEXT COMMENT '校准数据' AFTER calibration_items;

-- 8. 添加校准结论字段
ALTER TABLE IF EXISTS metrology_records 
ADD COLUMN calibration_conclusion TEXT COMMENT '校准结论' AFTER calibration_data;

-- 9. 添加批准人字段
ALTER TABLE IF EXISTS metrology_records 
ADD COLUMN approver VARCHAR(50) COMMENT '批准人' AFTER operator;

-- 10. 修复现有表中的语法错误（asset.code 改为 asset_code）
ALTER TABLE IF EXISTS metrology_records 
CHANGE COLUMN `asset.code` asset_code VARCHAR(100) COMMENT '资产编号';

ALTER TABLE IF EXISTS quality_control_records 
CHANGE COLUMN `asset.code` asset_code VARCHAR(100) COMMENT '资产编号';

ALTER TABLE IF EXISTS quality_management_alerts 
CHANGE COLUMN `asset.code` asset_code VARCHAR(100) COMMENT '资产编号';

ALTER TABLE IF EXISTS quality_management_cycles 
CHANGE COLUMN `asset.code` asset_code VARCHAR(100) COMMENT '资产编号';

-- 11. 修复索引名称（因为字段名已改变）
ALTER TABLE IF EXISTS quality_management_cycles 
DROP INDEX IF EXISTS idx_asset.code;

ALTER TABLE IF EXISTS quality_management_cycles 
ADD INDEX idx_asset_code (asset_code);

-- 12. 为 updated_at 字段添加自动更新机制
ALTER TABLE IF EXISTS metrology_records 
MODIFY COLUMN updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP;

ALTER TABLE IF EXISTS metrology_attachments 
MODIFY COLUMN updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP;

ALTER TABLE IF EXISTS quality_control_records 
MODIFY COLUMN updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP;

ALTER TABLE IF EXISTS quality_control_attachments 
MODIFY COLUMN updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

ALTER TABLE IF EXISTS quality_management_alerts 
MODIFY COLUMN updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP;

ALTER TABLE IF EXISTS quality_management_cycles 
MODIFY COLUMN updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP;

-- 13. 为计量管理表添加 tenant_id 字段（如果不存在）
ALTER TABLE IF EXISTS metrology_records 
ADD COLUMN IF NOT EXISTS tenant_id INT NOT NULL DEFAULT 1 COMMENT '租户ID' AFTER updated_at;

-- 14. 为计量附件表添加 tenant_id 字段（如果不存在）
ALTER TABLE IF EXISTS metrology_attachments 
ADD COLUMN IF NOT EXISTS tenant_id INT NOT NULL DEFAULT 1 COMMENT '租户ID' AFTER upload_time;

-- 15. 为质控管理表添加 tenant_id 字段（如果不存在）
ALTER TABLE IF EXISTS quality_control_records 
ADD COLUMN IF NOT EXISTS tenant_id INT NOT NULL DEFAULT 1 COMMENT '租户ID' AFTER updated_at;

-- 16. 为质控附件表添加 tenant_id 字段（如果不存在）
ALTER TABLE IF EXISTS quality_control_attachments 
ADD COLUMN IF NOT EXISTS tenant_id INT NOT NULL DEFAULT 1 COMMENT '租户ID' AFTER upload_time;

-- 17. 为质量管理预警记录表添加 tenant_id 字段（如果不存在）
ALTER TABLE IF EXISTS quality_management_alerts 
ADD COLUMN IF NOT EXISTS tenant_id INT NOT NULL DEFAULT 1 COMMENT '租户ID' AFTER updated_at;

-- 18. 为质量管理周期配置表添加 tenant_id 字段（如果不存在）
ALTER TABLE IF EXISTS quality_management_cycles 
ADD COLUMN IF NOT EXISTS tenant_id INT NOT NULL DEFAULT 1 COMMENT '租户ID' AFTER updated_at;

-- 19. 为 tenant_id 字段添加索引
CREATE INDEX IF NOT EXISTS idx_metrology_records_tenant_id ON metrology_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_metrology_attachments_tenant_id ON metrology_attachments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_quality_control_records_tenant_id ON quality_control_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_quality_control_attachments_tenant_id ON quality_control_attachments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_quality_management_alerts_tenant_id ON quality_management_alerts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_quality_management_cycles_tenant_id ON quality_management_cycles(tenant_id);

-- 20. 为所有表添加外键约束（如果租户表存在）
ALTER TABLE IF EXISTS metrology_records 
ADD CONSTRAINT IF NOT EXISTS fk_metrology_records_tenant 
FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE IF EXISTS metrology_attachments 
ADD CONSTRAINT IF NOT EXISTS fk_metrology_attachments_tenant 
FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE IF EXISTS quality_control_records 
ADD CONSTRAINT IF NOT EXISTS fk_quality_control_records_tenant 
FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE IF EXISTS quality_control_attachments 
ADD CONSTRAINT IF NOT EXISTS fk_quality_control_attachments_tenant 
FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE IF EXISTS quality_management_alerts 
ADD CONSTRAINT IF NOT EXISTS fk_quality_management_alerts_tenant 
FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE IF EXISTS quality_management_cycles 
ADD CONSTRAINT IF NOT EXISTS fk_quality_management_cycles_tenant 
FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE ON UPDATE CASCADE;

-- 执行完成
SELECT '已成功添加计量校准模板所需字段' AS result;
