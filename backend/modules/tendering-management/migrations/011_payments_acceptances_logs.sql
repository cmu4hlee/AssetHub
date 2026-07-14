-- ============================================================
-- 招标采购模块 升级脚本 011
-- 新增：付款管理 tender_payments / 验收 tender_acceptances /
--       状态机变更日志 tender_audit_logs
-- 所有 ALTER 均为幂等；若列/表已存在，运行时跳过。
-- ============================================================

-- ============================================================
-- 1) 付款管理 (tender_payments)
-- 5 态：draft → submitted → paying → paid / failed
-- 与 tender_payment_milestones / tender_invoices 双向可选关联
-- ============================================================
CREATE TABLE IF NOT EXISTS tender_payments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL DEFAULT 1,
  payment_code VARCHAR(60) UNIQUE NOT NULL COMMENT '系统付款单号(PAY-yyyyMMdd-XXXX)',
  contract_id INT NULL COMMENT 'tender_contracts.id',
  milestone_id INT NULL COMMENT 'tender_payment_milestones.id',
  invoice_id INT NULL COMMENT 'tender_invoices.id',
  tender_id INT NULL COMMENT 'tender_projects.id',
  supplier_id INT NULL,
  applicant_id INT NULL COMMENT '申请人ID',
  payee_name VARCHAR(200) COMMENT '收款方(默认来自供应商)',
  amount DECIMAL(15,2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'CNY',
  pay_method ENUM('bank_transfer','check','cash','other') DEFAULT 'bank_transfer',
  bank_name VARCHAR(200) NULL,
  bank_account VARCHAR(100) NULL,
  pay_date DATE NULL COMMENT '预期付款日',
  paid_at DATETIME NULL COMMENT '实际付款完成时间',
  status ENUM('draft','submitted','paying','paid','failed','cancelled') NOT NULL DEFAULT 'draft',
  failure_reason VARCHAR(500) NULL,
  remark VARCHAR(500) NULL,
  created_by INT NULL, approved_by INT NULL,
  approved_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  INDEX idx_tenant (tenant_id),
  INDEX idx_contract (contract_id),
  INDEX idx_milestone (milestone_id),
  INDEX idx_invoice (invoice_id),
  INDEX idx_tender (tender_id),
  INDEX idx_status (status),
  INDEX idx_pay_date (pay_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='采购与招标-付款单';

-- 付款附件
CREATE TABLE IF NOT EXISTS tender_payment_files (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL DEFAULT 1,
  payment_id INT NOT NULL,
  file_type ENUM('bank_voucher','contract_ref','approval_doc','other') DEFAULT 'bank_voucher',
  original_name VARCHAR(500), file_name VARCHAR(500), file_path VARCHAR(1000),
  mime_type VARCHAR(200), file_size BIGINT DEFAULT 0,
  uploaded_by INT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_tenant (tenant_id),
  INDEX idx_payment (payment_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='付款单附件';

-- ============================================================
-- 2) 验收管理 (tender_acceptances)
-- 4 态：pending → accepted / rejected → closed（闭环）
-- 与 tender_contracts / tender_payments / tender_invoices 关联
-- 同时作为资产入库与发票 closed 的入口
-- ============================================================
CREATE TABLE IF NOT EXISTS tender_acceptances (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL DEFAULT 1,
  acceptance_code VARCHAR(60) UNIQUE NOT NULL COMMENT '系统验收单号(YZS-yyyyMMdd-XXXX)',
  contract_id INT NULL COMMENT 'tender_contracts.id',
  tender_id INT NULL COMMENT 'tender_projects.id',
  asset_id INT NULL COMMENT 'assets.id(已关联验收的资产)',
  invoice_id INT NULL COMMENT 'tender_invoices.id',
  scheduled_date DATE NULL COMMENT '计划验收日期',
  accepted_at DATETIME NULL COMMENT '实际通过时间',
  status ENUM('pending','accepted','rejected','closed') NOT NULL DEFAULT 'pending',
  accepted_quantity INT DEFAULT 0,
  rejected_quantity INT DEFAULT 0,
  inspector_id INT NULL COMMENT '验收人ID',
  inspection_note TEXT NULL COMMENT '验收意见/结果',
  remark VARCHAR(500) NULL,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  INDEX idx_tenant (tenant_id),
  INDEX idx_contract (contract_id),
  INDEX idx_tender (tender_id),
  INDEX idx_asset (asset_id),
  INDEX idx_invoice (invoice_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='采购与招标-验收单';

-- 验收附件
CREATE TABLE IF NOT EXISTS tender_acceptance_files (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL DEFAULT 1,
  acceptance_id INT NOT NULL,
  file_type ENUM('acceptance_report','site_photo','inspection_note','other') DEFAULT 'acceptance_report',
  original_name VARCHAR(500), file_name VARCHAR(500), file_path VARCHAR(1000),
  mime_type VARCHAR(200), file_size BIGINT DEFAULT 0,
  uploaded_by INT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_tenant (tenant_id),
  INDEX idx_acceptance (acceptance_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='验收附件';

-- ============================================================
-- 3) 状态机变更日志 (tender_audit_logs)
-- 统一记录各 tender_* 表的状态变更，可追溯到 operator
-- ============================================================
CREATE TABLE IF NOT EXISTS tender_audit_logs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL DEFAULT 1,
  entity_type ENUM('tender_projects','tender_contracts','tender_invoices','tender_payment_milestones','tender_payments','tender_acceptances','tender_suppliers','tender_bids') NOT NULL,
  entity_id INT NOT NULL,
  action VARCHAR(50) NOT NULL COMMENT '创建/状态流转/编辑/删除 等动作标识',
  from_status VARCHAR(50) NULL,
  to_status VARCHAR(50) NULL,
  payload JSON NULL COMMENT '本次变更的业务字段差异',
  operator_id INT NULL,
  operator_name VARCHAR(100) NULL,
  occurred_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_tenant (tenant_id),
  INDEX idx_entity (entity_type, entity_id),
  INDEX idx_occurred_at (occurred_at),
  INDEX idx_operator (operator_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='采购与招标-审计日志';
