-- ============================================================
-- 招标采购模块 升级脚本 007
-- 新增合同管理表 tender_contracts，补全招标→定标→合同签订闭环
-- 状态机：draft → pending_review → approved/rejected → signed → executing → archived/terminated
-- 注意：ensureTables 按 ; 拆分执行，列/索引已存在时 ALTER TABLE 会报错但被忽略
-- ============================================================

-- 合同主表
CREATE TABLE IF NOT EXISTS tender_contracts (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL DEFAULT 1 COMMENT '租户ID',
  contract_code VARCHAR(100) UNIQUE NOT NULL COMMENT '合同编号',
  contract_name VARCHAR(255) NOT NULL COMMENT '合同名称',
  tender_id INT NOT NULL COMMENT '关联招标项目ID',
  bid_id INT DEFAULT NULL COMMENT '关联中标投标记录ID',
  supplier_id INT NOT NULL COMMENT '供应商ID',

  -- 基础信息
  contract_amount DECIMAL(15,2) DEFAULT 0 COMMENT '合同金额',
  currency VARCHAR(10) DEFAULT 'CNY' COMMENT '币种',
  contract_type VARCHAR(50) DEFAULT 'purchase' COMMENT '合同类型：purchase/lease/service',
  sign_date DATE DEFAULT NULL COMMENT '签订日期',
  start_date DATE DEFAULT NULL COMMENT '履行开始日期',
  end_date DATE DEFAULT NULL COMMENT '履行结束日期',
  department VARCHAR(100) DEFAULT NULL COMMENT '需求部门',
  contact_person VARCHAR(50) DEFAULT NULL COMMENT '联系人',
  contact_phone VARCHAR(50) DEFAULT NULL COMMENT '联系电话',
  payment_terms TEXT COMMENT '付款条款',
  description TEXT COMMENT '合同主要内容',
  remark TEXT COMMENT '备注',

  -- 流程状态
  status ENUM('draft','pending_review','approved','rejected','signed','executing','archived','terminated') DEFAULT 'draft' COMMENT '合同状态',

  -- 审批信息
  reviewer_id INT DEFAULT NULL COMMENT '审批人ID',
  review_comment VARCHAR(500) DEFAULT NULL COMMENT '审批意见',
  reviewed_at DATETIME DEFAULT NULL COMMENT '审批时间',

  -- 签订信息
  signer_id INT DEFAULT NULL COMMENT '签订人ID',
  signed_at DATETIME DEFAULT NULL COMMENT '签订时间',

  -- 归档信息
  archived_by INT DEFAULT NULL COMMENT '归档人ID',
  archived_at DATETIME DEFAULT NULL COMMENT '归档时间',

  created_by INT DEFAULT NULL COMMENT '创建人ID',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL DEFAULT NULL COMMENT '软删除时间',

  UNIQUE KEY uk_tender_contract (tender_id, supplier_id),
  INDEX idx_tenant (tenant_id),
  INDEX idx_tender (tender_id),
  INDEX idx_supplier (supplier_id),
  INDEX idx_status (status),
  INDEX idx_contract_code (contract_code),
  INDEX idx_deleted_at (deleted_at),
  FOREIGN KEY (tender_id) REFERENCES tender_projects(id) ON DELETE CASCADE,
  FOREIGN KEY (supplier_id) REFERENCES tender_suppliers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='招标合同表';

-- 合同附件表（合同扫描件、补充协议等）
CREATE TABLE IF NOT EXISTS tender_contract_files (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL DEFAULT 1 COMMENT '租户ID',
  contract_id INT NOT NULL COMMENT '合同ID',
  file_type VARCHAR(50) DEFAULT 'contract' COMMENT '文件类型：contract/supplement/other',
  original_name VARCHAR(500) DEFAULT NULL COMMENT '原始文件名',
  file_name VARCHAR(500) DEFAULT NULL COMMENT '存储文件名',
  file_path VARCHAR(1000) DEFAULT NULL COMMENT '文件路径',
  mime_type VARCHAR(200) DEFAULT NULL,
  file_size BIGINT DEFAULT 0,
  uploaded_by INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_tenant (tenant_id),
  INDEX idx_contract (contract_id),
  FOREIGN KEY (contract_id) REFERENCES tender_contracts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='合同附件表';
