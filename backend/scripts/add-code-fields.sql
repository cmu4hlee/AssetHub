-- 为assets表添加code、code2、code3字段
ALTER TABLE assets 
ADD COLUMN code VARCHAR(100) COMMENT '原始编码code' AFTER asset.code,
ADD COLUMN code2 VARCHAR(100) COMMENT '原始编码code2' AFTER code,
ADD COLUMN code3 VARCHAR(100) COMMENT '原始编码code3' AFTER code2;

-- 添加索引以便查询
CREATE INDEX idx_code ON assets.code);
CREATE INDEX idx_code2 ON assets.code2);
CREATE INDEX idx_code3 ON assets.code3);


