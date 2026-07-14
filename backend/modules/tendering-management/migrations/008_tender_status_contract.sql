-- ============================================================
-- 招标采购模块 升级脚本 008
-- 扩展 tender_projects.status 枚举：在 awarded 与 completed 之间插入 contract_signing（合同签订中）状态
-- 形成完整闭环：定标(awarded) → 合同签订(contract_signing) → 完成(completed)
-- 注意：ensureTables 按 ; 拆分执行，MODIFY COLUMN 已是幂等的 ALTER 操作
-- ============================================================

ALTER TABLE tender_projects
  MODIFY status ENUM(
    'draft','published','bidding','evaluating','awarded','contract_signing','completed','cancelled'
  ) DEFAULT 'draft';
