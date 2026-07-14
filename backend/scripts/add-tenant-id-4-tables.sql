-- 为用户指定的4个表添加tenant_id字段的SQL脚本
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
-- 4. 资产图片表
-- ==========================================
ALTER TABLE IF EXISTS asset_images 
ADD COLUMN IF NOT EXISTS tenant_id INT NOT NULL COMMENT '租户ID',
ADD INDEX IF NOT EXISTS idx_tenant_id (tenant_id);


-- ==========================================
-- 脚本执行完成
-- ==========================================
