-- 添加第二个分类字段到资产表
ALTER TABLE assets ADD COLUMN category_secondary_id INT COMMENT '二级分类ID' AFTER category_id;

-- 添加索引以提高查询性能
CREATE INDEX idx_secondary_category ON assets(category_secondary_id);

-- 可选：如果需要关联到asset_categories表，可以添加外键约束
-- ALTER TABLE assets ADD CONSTRAINT fk_assets_category_secondary FOREIGN KEY (category_secondary_id) REFERENCES asset_categories(id);
