-- ============================================================
-- 招标采购模块 升级脚本 004
-- 补充并发安全所需的 DB 唯一约束
-- 注意：ensureTables 按 ; 拆分执行，索引已存在时 ALTER TABLE 会报错但被忽略
-- ============================================================

-- 1. tender_evaluations 唯一约束：(tenant_id, tender_id, supplier_id, evaluator_id)
ALTER TABLE tender_evaluations ADD UNIQUE KEY uk_tender_supplier_evaluator (tenant_id, tender_id, supplier_id, evaluator_id);

-- 2. 修复历史重复数据：若已存在重复行，先保留最早一条，其余删除
DELETE e1 FROM tender_evaluations e1
INNER JOIN tender_evaluations e2
  ON e1.tenant_id = e2.tenant_id
  AND e1.tender_id = e2.tender_id
  AND e1.supplier_id = e2.supplier_id
  AND e1.evaluator_id <=> e2.evaluator_id
  AND e1.id > e2.id;
