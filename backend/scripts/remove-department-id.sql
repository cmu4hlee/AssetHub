-- 删除数据库表中的department_id字段

-- 修改common_asset_stats表
ALTER TABLE common_asset_stats
DROP FOREIGN KEY common_asset_stats_ibfk_1,
DROP INDEX uk_dept_asset,
DROP COLUMN department_id;

-- 修改user_managed_departments表
ALTER TABLE user_managed_departments
DROP FOREIGN KEY user_managed_departments_ibfk_3,
DROP INDEX unique_user_department,
DROP COLUMN department_id;

-- 验证修改结果
SHOW COLUMNS FROM common_asset_stats;
SHOW COLUMNS FROM user_managed_departments;
