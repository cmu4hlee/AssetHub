-- 供应商类别字段（多选，逗号分隔：repair,parts,asset,consumable）
-- repair=维修维护服务, parts=配件供应, asset=资产供应, consumable=耗材供应
ALTER TABLE tender_suppliers ADD COLUMN categories VARCHAR(255) DEFAULT NULL COMMENT '供应商类别（逗号分隔）' AFTER bank_account;
ALTER TABLE tender_suppliers ADD INDEX idx_categories (categories);
