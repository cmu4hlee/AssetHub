-- 为 asset_ai_analysis_logs 表添加 tenant_id 字段
-- 如果字段已存在，此脚本不会报错

-- 检查并添加 tenant_id 字段
ALTER TABLE asset_ai_analysis_logs
ADD COLUMN IF NOT EXISTS tenant_id INT COMMENT '租户ID';

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_tenant_id ON asset_ai_analysis_logs(tenant_id);

-- 为现有记录设置默认租户ID（根据user_id关联的租户）
-- 注意：这需要根据实际情况调整
UPDATE asset_ai_analysis_logs aal
INNER JOIN users u ON aal.user_id = u.id
SET aal.tenant_id = COALESCE(u.tenant_id, u.tenantId)
WHERE aal.tenant_id IS NULL;
