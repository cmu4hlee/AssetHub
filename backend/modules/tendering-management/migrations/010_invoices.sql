-- ============================================================
-- 招标采购模块 升级脚本 010
-- 发票管理 tender_invoices（统一覆盖招标/合同/资产入账发票）
-- 状态机：draft → pending → verified → claimed → paid → archived
--        + errored（核验失败重提）/ cancelled（红冲/作废）
-- 关联：tender_invoices × tender_contracts × tender_payment_milestones
--       × tender_projects × tender_suppliers × assets
-- ============================================================

-- 1. 发票主表
CREATE TABLE IF NOT EXISTS tender_invoices (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL DEFAULT 1,
  invoice_code VARCHAR(60) UNIQUE NOT NULL COMMENT '系统发票号(INV-yyyyMMdd-XXXX)',
  invoice_kind ENUM('vat_special','vat_general','receipt','e_invoice','other') DEFAULT 'vat_special' COMMENT '发票类型',
  invoice_no VARCHAR(50) NULL COMMENT '实际票面发票号',
  invoice_code_str VARCHAR(50) NULL COMMENT '发票代码(纸质票)',
  issue_date DATE NOT NULL COMMENT '开票日期',
  amount DECIMAL(15,2) NOT NULL COMMENT '含税金额',
  tax_rate DECIMAL(5,2) DEFAULT 13.00 COMMENT '税率%',
  tax_amount DECIMAL(15,2) DEFAULT 0 COMMENT '税额',
  excluding_amount DECIMAL(15,2) DEFAULT 0 COMMENT '不含税金额',
  currency VARCHAR(10) DEFAULT 'CNY',

  -- 业务关联三件套
  contract_id INT NULL COMMENT 'tender_contracts.id',
  milestone_id INT NULL COMMENT 'tender_payment_milestones.id',
  tender_id INT NULL COMMENT 'tender_projects.id',
  supplier_id INT NULL COMMENT 'tender_suppliers.id',
  asset_id INT NULL COMMENT 'assets.id(资产入账发票)',
  payment_request_id INT NULL COMMENT '支付申请单(预留)',

  -- 状态机
  status ENUM('draft','pending','verified','claimed','paid','archived','cancelled','errored') NOT NULL DEFAULT 'draft' COMMENT '发票状态',
  verified_at DATETIME NULL,
  claimed_at DATETIME NULL,
  paid_at DATETIME NULL,
  archived_at DATETIME NULL,
  cancelled_at DATETIME NULL,

  -- 资本化/费用化入账
  accounting_kind ENUM('capitalize','expense') DEFAULT 'capitalize' COMMENT 'capitalize 资本化/expense 费用化',
  remark VARCHAR(500) NULL,

  -- 来源标识
  is_from_asset_acceptance BOOLEAN DEFAULT FALSE,
  is_manual_create BOOLEAN DEFAULT TRUE,

  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,

  INDEX idx_tenant (tenant_id),
  INDEX idx_contract (contract_id),
  INDEX idx_milestone (milestone_id),
  INDEX idx_tender (tender_id),
  INDEX idx_supplier (supplier_id),
  INDEX idx_asset (asset_id),
  INDEX idx_status (status),
  INDEX idx_kind (invoice_kind),
  INDEX idx_issue_date (issue_date),
  INDEX idx_invoice_no (invoice_no),
  INDEX idx_deleted (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='采购与招标-发票主表';

-- 2. 发票附件 + OCR 占位
CREATE TABLE IF NOT EXISTS tender_invoice_files (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL DEFAULT 1,
  invoice_id INT NOT NULL,
  file_type ENUM('invoice_scan','contract_ref','approval_doc','other') DEFAULT 'invoice_scan',
  original_name VARCHAR(500),
  file_name VARCHAR(500),
  file_path VARCHAR(1000),
  mime_type VARCHAR(200),
  file_size BIGINT DEFAULT 0,
  ocr_text TEXT COMMENT 'OCR识别结果JSON(v1.1接入)',
  uploaded_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_tenant (tenant_id),
  INDEX idx_invoice (invoice_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='发票附件与OCR占位';

-- 3. assets 表加 3 列：入账发票反查（尝试以 try/catch 在 ensureTables 跳过）
ALTER TABLE assets ADD COLUMN invoice_id INT NULL COMMENT '关联发票ID';
ALTER TABLE assets ADD COLUMN invoice_no VARCHAR(50) NULL COMMENT '发票号快照';
ALTER TABLE assets ADD COLUMN capitalized_at DATETIME NULL COMMENT '资本化入账时间';
ALTER TABLE assets ADD INDEX idx_asset_invoice (invoice_id);
