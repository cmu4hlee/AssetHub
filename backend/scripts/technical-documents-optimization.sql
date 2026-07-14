-- 创建技术资料与资产的多对多关联表
CREATE TABLE IF NOT EXISTS technical_document_asset_relations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    document_id INT NOT NULL COMMENT '技术资料ID',
    asset_id INT NOT NULL COMMENT '资产ID',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (document_id) REFERENCES technical_documents(id) ON DELETE CASCADE,
    FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE,
    UNIQUE KEY uk_document_asset (document_id, asset_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='技术资料与资产关联表';

-- 为中间表添加索引
CREATE INDEX IF NOT EXISTS idx_asset_document ON technical_document_asset_relations(asset_id, document_id);

-- 优化技术资料表，删除冗余字段
ALTER TABLE technical_documents DROP COLUMN IF EXISTS asset.code;
ALTER TABLE technical_documents DROP COLUMN IF EXISTS asset_name;

-- 优化字段长度
ALTER TABLE technical_documents MODIFY COLUMN title VARCHAR(255) NOT NULL COMMENT '资料标题';
ALTER TABLE technical_documents MODIFY COLUMN file_name VARCHAR(255) NOT NULL COMMENT '文件名';

-- 添加复合索引
CREATE INDEX IF NOT EXISTS idx_tenant_status_review ON technical_documents(tenant_id, status, review_status);
CREATE INDEX IF NOT EXISTS idx_tenant_asset ON technical_documents(tenant_id, asset_id);
CREATE INDEX IF NOT EXISTS idx_tenant_brand_model ON technical_documents(tenant_id, brand, model);

-- 说明：执行上述SQL语句后，需要执行以下操作来迁移数据
-- 1. 迁移现有asset_ids数据到中间表
-- 2. 迁移单一资产关联到中间表

-- 数据迁移示例（根据实际情况调整）
-- 迁移asset_ids数据到中间表
-- INSERT INTO technical_document_asset_relations (document_id, asset_id)
-- SELECT id, JSON_EXTRACT(asset_ids, CONCAT('$[', idx, ']')) AS asset_id
-- FROM technical_documents td
-- JOIN (SELECT 0 AS idx UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5) AS indices
-- WHERE td.asset_ids IS NOT NULL AND td.asset_ids != ''
-- AND JSON_EXTRACT(td.asset_ids, CONCAT('$[', idx, ']')) IS NOT NULL;

-- 迁移单一资产关联到中间表
-- INSERT IGNORE INTO technical_document_asset_relations (document_id, asset_id)
-- SELECT id, asset_id FROM technical_documents WHERE asset_id IS NOT NULL;

-- 删除asset_ids字段（可选，根据业务需求决定是否保留）
-- ALTER TABLE technical_documents DROP COLUMN IF EXISTS asset_ids;
