-- 为技术文档关联表添加tenant_id字段的SQL脚本
-- 这些关联表之前缺少tenant_id字段，无法在数据库层面保证租户隔离
-- 使用存储过程安全地添加列（如果不存在）

DELIMITER //

-- 1. 文档-资产关联表
DROP PROCEDURE IF EXISTS add_tenant_id_to_asset_relations//
CREATE PROCEDURE add_tenant_id_to_asset_relations()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'technical_document_asset_relations' AND COLUMN_NAME = 'tenant_id') THEN
    ALTER TABLE technical_document_asset_relations ADD COLUMN tenant_id INT NOT NULL DEFAULT 0 COMMENT '租户ID';
    ALTER TABLE technical_document_asset_relations ADD INDEX idx_tenant_id (tenant_id);
  END IF;
END//
CALL add_tenant_id_to_asset_relations()//
DROP PROCEDURE IF EXISTS add_tenant_id_to_asset_relations//

-- 2. 文档-标签关联表
DROP PROCEDURE IF EXISTS add_tenant_id_to_tag_relations//
CREATE PROCEDURE add_tenant_id_to_tag_relations()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'technical_document_tag_relations' AND COLUMN_NAME = 'tenant_id') THEN
    ALTER TABLE technical_document_tag_relations ADD COLUMN tenant_id INT NOT NULL DEFAULT 0 COMMENT '租户ID';
    ALTER TABLE technical_document_tag_relations ADD INDEX idx_tenant_id (tenant_id);
  END IF;
END//
CALL add_tenant_id_to_tag_relations()//
DROP PROCEDURE IF EXISTS add_tenant_id_to_tag_relations//

-- 3. 文档收藏表
DROP PROCEDURE IF EXISTS add_tenant_id_to_favorites//
CREATE PROCEDURE add_tenant_id_to_favorites()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'technical_document_favorites' AND COLUMN_NAME = 'tenant_id') THEN
    ALTER TABLE technical_document_favorites ADD COLUMN tenant_id INT NOT NULL DEFAULT 0 COMMENT '租户ID';
    ALTER TABLE technical_document_favorites ADD INDEX idx_tenant_id (tenant_id);
  END IF;
END//
CALL add_tenant_id_to_favorites()//
DROP PROCEDURE IF EXISTS add_tenant_id_to_favorites//

-- 4. 文档评论表
DROP PROCEDURE IF EXISTS add_tenant_id_to_comments//
CREATE PROCEDURE add_tenant_id_to_comments()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'technical_document_comments' AND COLUMN_NAME = 'tenant_id') THEN
    ALTER TABLE technical_document_comments ADD COLUMN tenant_id INT NOT NULL DEFAULT 0 COMMENT '租户ID';
    ALTER TABLE technical_document_comments ADD INDEX idx_tenant_id (tenant_id);
  END IF;
END//
CALL add_tenant_id_to_comments()//
DROP PROCEDURE IF EXISTS add_tenant_id_to_comments//

-- 5. 文档下载记录表
DROP PROCEDURE IF EXISTS add_tenant_id_to_downloads//
CREATE PROCEDURE add_tenant_id_to_downloads()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'technical_document_downloads' AND COLUMN_NAME = 'tenant_id') THEN
    ALTER TABLE technical_document_downloads ADD COLUMN tenant_id INT NOT NULL DEFAULT 0 COMMENT '租户ID';
    ALTER TABLE technical_document_downloads ADD INDEX idx_tenant_id (tenant_id);
  END IF;
END//
CALL add_tenant_id_to_downloads()//
DROP PROCEDURE IF EXISTS add_tenant_id_to_downloads//

-- 6. 文档访问历史表
DROP PROCEDURE IF EXISTS add_tenant_id_to_history//
CREATE PROCEDURE add_tenant_id_to_history()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'technical_document_history' AND COLUMN_NAME = 'tenant_id') THEN
    ALTER TABLE technical_document_history ADD COLUMN tenant_id INT NOT NULL DEFAULT 0 COMMENT '租户ID';
    ALTER TABLE technical_document_history ADD INDEX idx_tenant_id (tenant_id);
  END IF;
END//
CALL add_tenant_id_to_history()//
DROP PROCEDURE IF EXISTS add_tenant_id_to_history//

DELIMITER ;

-- 回填tenant_id：根据document_id关联technical_documents表获取tenant_id
UPDATE technical_document_asset_relations r
INNER JOIN technical_documents d ON r.document_id = d.id
SET r.tenant_id = COALESCE(d.tenant_id, 0)
WHERE r.tenant_id = 0;

UPDATE technical_document_tag_relations r
INNER JOIN technical_documents d ON r.document_id = d.id
SET r.tenant_id = COALESCE(d.tenant_id, 0)
WHERE r.tenant_id = 0;

UPDATE technical_document_favorites f
INNER JOIN technical_documents d ON f.document_id = d.id
SET f.tenant_id = COALESCE(d.tenant_id, 0)
WHERE f.tenant_id = 0;

UPDATE technical_document_comments c
INNER JOIN technical_documents d ON c.document_id = d.id
SET c.tenant_id = COALESCE(d.tenant_id, 0)
WHERE c.tenant_id = 0;

UPDATE technical_document_downloads dl
INNER JOIN technical_documents d ON dl.document_id = d.id
SET dl.tenant_id = COALESCE(d.tenant_id, 0)
WHERE dl.tenant_id = 0;

UPDATE technical_document_history h
INNER JOIN technical_documents d ON h.document_id = d.id
SET h.tenant_id = COALESCE(d.tenant_id, 0)
WHERE h.tenant_id = 0;
