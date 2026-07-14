-- ============================================================
-- 招标采购模块 升级脚本 002
-- 用于在已部署环境中补齐新增字段/枚举
-- 注意：ensureTables 按 ; 拆分执行，列/索引已存在时 ALTER TABLE 会报错但被忽略
-- ============================================================

-- 1. tender_bids.status 扩展为包含 'won' / 'lost'
ALTER TABLE tender_bids
  MODIFY status ENUM('draft','submitted','withdrawn','won','lost') DEFAULT 'draft';

-- 2. tender_evaluations 新增 bid_id 字段（多评标人模型）
ALTER TABLE tender_evaluations ADD COLUMN bid_id INT DEFAULT NULL COMMENT '关联的投标记录ID' AFTER supplier_id;
ALTER TABLE tender_evaluations ADD INDEX idx_bid (bid_id);

-- 3. tender_evaluations 新增 updated_at 字段
ALTER TABLE tender_evaluations ADD COLUMN updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP;

-- 4. 移除旧唯一约束 uk_tender_supplier_eval（如存在）
ALTER TABLE tender_evaluations DROP INDEX uk_tender_supplier_eval;

-- 5. 新增 evaluator_id 索引
ALTER TABLE tender_evaluations ADD INDEX idx_evaluator (evaluator_id);

-- 6. tender_bids 新增 status 索引
ALTER TABLE tender_bids ADD INDEX idx_status (status);
