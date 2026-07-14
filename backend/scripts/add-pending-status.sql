-- 添加 pending 状态到用户表的 status 字段
ALTER TABLE users MODIFY COLUMN status ENUM('active', 'inactive', 'pending') DEFAULT 'active';