-- ============================================================
-- 招标采购模块 升级脚本 005
-- 为根表添加软删除字段，避免物理删除造成审计数据丢失与孤儿数据
-- 注意：ensureTables 按 ; 拆分执行，每条语句独立执行
--       列/索引已存在时 ALTER TABLE 会报错但被 ensureTables 忽略
-- ============================================================

-- 1. tender_projects 新增 deleted_at 字段（软删除标记）
ALTER TABLE tender_projects ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL COMMENT '软删除时间，NULL表示未删除';
ALTER TABLE tender_projects ADD INDEX idx_deleted_at (deleted_at);

-- 2. tender_suppliers 新增 deleted_at 字段（软删除标记）
ALTER TABLE tender_suppliers ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL COMMENT '软删除时间，NULL表示未删除';
ALTER TABLE tender_suppliers ADD INDEX idx_deleted_at (deleted_at);
