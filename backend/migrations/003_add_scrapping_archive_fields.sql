-- =====================================================
-- 资产报废归档功能 - 新增归档字段
-- 创建时间: 2026-07-11
-- 说明: 完善资产报废 申请-审批-归档 流程
-- =====================================================

-- 向 asset_scrapping_records 表添加归档相关字段
ALTER TABLE `asset_scrapping_records`
  ADD COLUMN `archive_no` VARCHAR(50) DEFAULT NULL COMMENT '归档编号' AFTER `current_status`,
  ADD COLUMN `archived_by` VARCHAR(100) DEFAULT NULL COMMENT '归档人' AFTER `archive_no`,
  ADD COLUMN `archived_by_id` INT DEFAULT NULL COMMENT '归档人ID' AFTER `archived_by`,
  ADD COLUMN `archived_at` DATETIME DEFAULT NULL COMMENT '归档时间' AFTER `archived_by_id`,
  ADD COLUMN `archive_location` VARCHAR(255) DEFAULT NULL COMMENT '归档位置' AFTER `archived_at`,
  ADD COLUMN `archive_remark` TEXT COMMENT '归档备注' AFTER `archive_location`;

-- 添加归档编号索引
ALTER TABLE `asset_scrapping_records`
  ADD INDEX `idx_archive_no` (`archive_no`);

-- 说明: current_status 字段为 VARCHAR(50)，无需修改类型
-- 新增状态值: archived (已归档)
-- 完整状态流: pending(待处理) -> appraising(鉴定中) -> approved(已批准) -> disposing(处置中) -> completed(已完成) -> archived(已归档)
-- 简化状态流: pending(待处理) -> approved(已批准) / rejected(已拒绝) -> completed(已完成) -> archived(已归档)
