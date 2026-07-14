-- ============================================================
-- 招标采购模块 初始化表结构
-- 涵盖：资产购置招标 / 资产配件或维修服务招标 / 供应商扫码上传资质
-- ============================================================

-- 招标项目表
CREATE TABLE IF NOT EXISTS tender_projects (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL DEFAULT 1 COMMENT '租户ID',
  tender_code VARCHAR(100) UNIQUE NOT NULL COMMENT '招标编号',
  title VARCHAR(255) NOT NULL COMMENT '招标项目名称',
  tender_type ENUM('asset_purchase','parts','maintenance_service') NOT NULL COMMENT '招标类型：资产购置/配件/维修服务',
  description TEXT COMMENT '项目概况与需求说明',
  procurement_request_id INT DEFAULT NULL COMMENT '关联采购申请ID',
  asset_code VARCHAR(100) DEFAULT NULL COMMENT '关联资产编号(配件/维修时使用)',
  asset_name VARCHAR(200) DEFAULT NULL COMMENT '关联资产名称',
  department VARCHAR(100) DEFAULT NULL COMMENT '需求部门',
  budget_amount DECIMAL(15,2) DEFAULT 0 COMMENT '预算/控制金额',
  currency VARCHAR(10) DEFAULT 'CNY' COMMENT '币种',
  tender_method ENUM('public','invite','competitive') DEFAULT 'public' COMMENT '招标方式：公开/邀请/竞争性',
  publish_date DATE DEFAULT NULL COMMENT '发布日期',
  deadline DATETIME DEFAULT NULL COMMENT '投标截止时间',
  open_bid_date DATETIME DEFAULT NULL COMMENT '开标时间',
  contact_person VARCHAR(50) DEFAULT NULL COMMENT '联系人',
  contact_phone VARCHAR(50) DEFAULT NULL COMMENT '联系电话',
  status ENUM('draft','published','bidding','evaluating','awarded','completed','cancelled') DEFAULT 'draft' COMMENT '状态',
  remark TEXT COMMENT '备注',
  created_by INT DEFAULT NULL COMMENT '创建人ID',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_tenant (tenant_id),
  INDEX idx_tender_type (tender_type),
  INDEX idx_status (status),
  INDEX idx_tenant_status (tenant_id, status),
  INDEX idx_deadline (deadline)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='招标项目表';

-- 招标文件表（招标文件分章节制作）
CREATE TABLE IF NOT EXISTS tender_documents (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL DEFAULT 1 COMMENT '租户ID',
  tender_id INT NOT NULL COMMENT '招标项目ID',
  section_code VARCHAR(50) NOT NULL COMMENT '章节编码',
  section_title VARCHAR(200) NOT NULL COMMENT '章节标题',
  section_content LONGTEXT COMMENT '章节内容(富文本/HTML)',
  section_order INT DEFAULT 0 COMMENT '排序',
  required TINYINT(1) DEFAULT 0 COMMENT '是否必填章节',
  updated_by INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_tender_section (tender_id, section_code),
  INDEX idx_tenant (tenant_id),
  INDEX idx_tender (tender_id),
  FOREIGN KEY (tender_id) REFERENCES tender_projects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='招标文件章节表';

-- 招标附件表（招标方上传的招标文件/图纸等）
CREATE TABLE IF NOT EXISTS tender_files (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL DEFAULT 1 COMMENT '租户ID',
  tender_id INT NOT NULL COMMENT '招标项目ID',
  file_type VARCHAR(50) DEFAULT 'attachment' COMMENT '文件类型',
  original_name VARCHAR(500) DEFAULT NULL COMMENT '原始文件名',
  file_name VARCHAR(500) DEFAULT NULL COMMENT '存储文件名',
  file_path VARCHAR(1000) DEFAULT NULL COMMENT '文件路径',
  mime_type VARCHAR(200) DEFAULT NULL,
  file_size BIGINT DEFAULT 0,
  uploaded_by INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_tenant (tenant_id),
  INDEX idx_tender (tender_id),
  FOREIGN KEY (tender_id) REFERENCES tender_projects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='招标附件表';

-- 供应商表（招标方登记的供应商库）
CREATE TABLE IF NOT EXISTS tender_suppliers (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL DEFAULT 1 COMMENT '租户ID',
  supplier_name VARCHAR(200) NOT NULL COMMENT '供应商名称',
  unified_code VARCHAR(50) DEFAULT NULL COMMENT '统一社会信用代码',
  contact_person VARCHAR(50) DEFAULT NULL COMMENT '联系人',
  contact_phone VARCHAR(50) DEFAULT NULL COMMENT '联系电话',
  contact_email VARCHAR(100) DEFAULT NULL COMMENT '联系邮箱',
  address VARCHAR(500) DEFAULT NULL COMMENT '地址',
  bank_account VARCHAR(100) DEFAULT NULL COMMENT '开户行及账号',
  status ENUM('pending','qualified','rejected','blacklisted') DEFAULT 'pending' COMMENT '资质状态',
  register_token VARCHAR(100) DEFAULT NULL COMMENT '扫码上传资质用的token',
  token_expires_at DATETIME DEFAULT NULL COMMENT 'token过期时间',
  remark TEXT COMMENT '备注',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_tenant_supplier (tenant_id, supplier_name),
  INDEX idx_tenant (tenant_id),
  INDEX idx_status (status),
  INDEX idx_register_token (register_token)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='供应商表';

-- 供应商资质文件表（供应商扫码上传的资质材料）
CREATE TABLE IF NOT EXISTS tender_supplier_qualifications (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL DEFAULT 1 COMMENT '租户ID',
  supplier_id INT NOT NULL COMMENT '供应商ID',
  qualification_type VARCHAR(50) NOT NULL COMMENT '资质类型：business_license/tax_cert/qualification/other',
  qualification_name VARCHAR(200) DEFAULT NULL COMMENT '资质名称',
  original_name VARCHAR(500) DEFAULT NULL COMMENT '原始文件名',
  file_name VARCHAR(500) DEFAULT NULL COMMENT '存储文件名',
  file_path VARCHAR(1000) DEFAULT NULL COMMENT '文件路径',
  mime_type VARCHAR(200) DEFAULT NULL,
  file_size BIGINT DEFAULT 0,
  valid_until DATE DEFAULT NULL COMMENT '资质有效期',
  upload_source VARCHAR(20) DEFAULT 'qr_scan' COMMENT '上传来源：qr_scan/manual',
  reviewed TINYINT(1) DEFAULT 0 COMMENT '是否已审核',
  review_status ENUM('pending','approved','rejected') DEFAULT 'pending',
  review_comment VARCHAR(500) DEFAULT NULL,
  reviewed_by INT DEFAULT NULL,
  reviewed_at DATETIME DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_tenant (tenant_id),
  INDEX idx_supplier (supplier_id),
  INDEX idx_qualification_type (qualification_type),
  FOREIGN KEY (supplier_id) REFERENCES tender_suppliers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='供应商资质文件表';

-- 招标邀请表（记录邀请的供应商与二维码状态）
CREATE TABLE IF NOT EXISTS tender_invitations (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL DEFAULT 1 COMMENT '租户ID',
  tender_id INT NOT NULL COMMENT '招标项目ID',
  supplier_id INT NOT NULL COMMENT '供应商ID',
  invite_token VARCHAR(100) DEFAULT NULL COMMENT '邀请token(二维码)',
  invited_at DATETIME DEFAULT NULL COMMENT '邀请时间',
  expires_at DATETIME DEFAULT NULL COMMENT '邀请有效期',
  status ENUM('pending','viewed','submitted','expired') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_tender_supplier (tender_id, supplier_id),
  INDEX idx_tenant (tenant_id),
  INDEX idx_tender (tender_id),
  INDEX idx_supplier (supplier_id),
  INDEX idx_invite_token (invite_token)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='招标邀请表';

-- 投标记录表
CREATE TABLE IF NOT EXISTS tender_bids (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL DEFAULT 1 COMMENT '租户ID',
  tender_id INT NOT NULL COMMENT '招标项目ID',
  supplier_id INT NOT NULL COMMENT '供应商ID',
  bid_amount DECIMAL(15,2) DEFAULT NULL COMMENT '投标报价',
  bid_currency VARCHAR(10) DEFAULT 'CNY',
  bid_desc TEXT COMMENT '投标说明',
  bid_files TEXT COMMENT '投标附件路径(JSON数组)',
  submitted_at DATETIME DEFAULT NULL COMMENT '提交时间',
  status ENUM('draft','submitted','withdrawn','won','lost') DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_tender_supplier (tender_id, supplier_id),
  INDEX idx_tenant (tenant_id),
  INDEX idx_tender (tender_id),
  INDEX idx_supplier (supplier_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='投标记录表';

-- 兼容老库：若 status 字段枚举中没有 'won'/'lost'，升级
-- MySQL 不支持直接修改 ENUM 值通过 CREATE TABLE IF NOT EXISTS，跳过。
-- 通过 INSERT 触发器在旧库中可能不存在新枚举值，需手动 ALTER：
-- ALTER TABLE tender_bids MODIFY status ENUM('draft','submitted','withdrawn','won','lost') DEFAULT 'draft';

-- 评标记录表
CREATE TABLE IF NOT EXISTS tender_evaluations (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL DEFAULT 1 COMMENT '租户ID',
  tender_id INT NOT NULL COMMENT '招标项目ID',
  supplier_id INT NOT NULL COMMENT '供应商ID',
  bid_id INT DEFAULT NULL COMMENT '关联的投标记录ID',
  score DECIMAL(5,2) DEFAULT NULL COMMENT '评分',
  price_score DECIMAL(5,2) DEFAULT NULL COMMENT '价格分',
  tech_score DECIMAL(5,2) DEFAULT NULL COMMENT '技术分',
  evaluation_comment TEXT COMMENT '评标意见',
  recommended TINYINT(1) DEFAULT 0 COMMENT '是否推荐中标',
  evaluator_id INT DEFAULT NULL COMMENT '评标人ID',
  evaluated_at DATETIME DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_tenant (tenant_id),
  INDEX idx_tender (tender_id),
  INDEX idx_supplier (supplier_id),
  INDEX idx_bid (bid_id),
  INDEX idx_evaluator (evaluator_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='评标记录表';
