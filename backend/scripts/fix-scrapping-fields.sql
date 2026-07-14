-- 添加缺失的字段到asset_scrapping_records表
ALTER TABLE asset_scrapping_records ADD COLUMN appraiser_id INT COMMENT '鉴定人ID' AFTER appraiser;
ALTER TABLE asset_scrapping_records ADD COLUMN approver_id INT COMMENT '审批人ID' AFTER approver;
ALTER TABLE asset_scrapping_records ADD COLUMN disposer_id INT COMMENT '处置人ID' AFTER disposer;