-- ============================================================
-- 招标项目分享 Token（公开扫码，无需登录）
-- 注意：ensureTables 按 ; 拆分执行，列/索引已存在时 ALTER TABLE 会报错但被忽略
-- ============================================================

-- 0. tender_suppliers 兼容字段：增加 source（public_apply=扫码自动建档）
ALTER TABLE tender_suppliers ADD COLUMN source VARCHAR(20) DEFAULT 'manual' COMMENT '供应商来源：manual/invite/public_apply' AFTER status;
ALTER TABLE tender_suppliers ADD INDEX idx_source (source);

-- 1. tender_share_tokens：项目分享 token 表
CREATE TABLE IF NOT EXISTS tender_share_tokens (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL DEFAULT 1,
  tender_id INT NOT NULL,
  token CHAR(48) NOT NULL COMMENT '48 位随机字符串',
  permissions JSON DEFAULT NULL COMMENT 'JSON 数组：view / download / qualify / bid',
  expires_at DATETIME DEFAULT NULL,
  revoked TINYINT(1) DEFAULT 0,
  created_by INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_token (token),
  INDEX idx_tenant (tenant_id),
  INDEX idx_tender (tender_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='招标项目分享 token';

-- 2. tender_share_visits：访问日志
CREATE TABLE IF NOT EXISTS tender_share_visits (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL DEFAULT 1,
  token_id INT DEFAULT NULL,
  tender_id INT DEFAULT NULL,
  ip VARCHAR(64) DEFAULT NULL,
  user_agent VARCHAR(500) DEFAULT NULL,
  action VARCHAR(50) DEFAULT NULL,
  status_code INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_tenant (tenant_id),
  INDEX idx_token (token_id),
  INDEX idx_tender (tender_id),
  INDEX idx_ip (ip),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='招标分享 token 访问日志';

-- 3. tender_share_bids：公开扫码提交的投标（含供应商信息）
CREATE TABLE IF NOT EXISTS tender_share_bids (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL DEFAULT 1,
  token_id INT NOT NULL,
  tender_id INT NOT NULL,
  bid_id INT DEFAULT NULL COMMENT '对应 tender_bids.id',
  supplier_name VARCHAR(200) NOT NULL,
  contact_person VARCHAR(100) DEFAULT NULL,
  contact_phone VARCHAR(50) DEFAULT NULL,
  contact_email VARCHAR(200) DEFAULT NULL,
  unified_code VARCHAR(50) DEFAULT NULL,
  ip VARCHAR(64) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_tenant (tenant_id),
  INDEX idx_token (token_id),
  INDEX idx_tender (tender_id),
  INDEX idx_bid (bid_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='公开扫码投标记录';
