-- 添加用户语言偏好字段
-- 创建时间: 2026-03-06

-- 检查字段是否存在，不存在则添加
SET @dbname = DATABASE();
SET @tablename = 'users';
SET @columnname = 'preferred_language';
SET @columntype = 'VARCHAR(10)';
SET @columndefault = 'NULL';

SET @sql = CONCAT(
    'ALTER TABLE ', @tablename,
    ' ADD COLUMN IF NOT EXISTS ', @columnname, ' ', @columntype,
    ' DEFAULT NULL COMMENT ''用户语言偏好(zh/en)'''
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 更新注释
ALTER TABLE users 
MODIFY COLUMN preferred_language VARCHAR(10) DEFAULT NULL COMMENT '用户语言偏好(zh/en)';

-- 创建索引
CREATE INDEX idx_users_preferred_language ON users(preferred_language);

SELECT '用户语言偏好字段添加成功' AS message;
