-- ============================================================
-- 安全检测模块增强迁移
-- 整改跟踪 / 复核 / 状态机 / 统计
-- ============================================================

ALTER TABLE safety_inspections
  ADD COLUMN inspection_record_id INT DEFAULT NULL COMMENT '关联巡检记录单ID' AFTER asset_id,
  ADD COLUMN status ENUM('draft', 'submitted', 'reviewed', 'archived', 'completed') NOT NULL DEFAULT 'completed' COMMENT '状态' AFTER inspection_result,
  ADD COLUMN reviewer_id INT DEFAULT NULL COMMENT '复核人ID' AFTER status,
  ADD COLUMN reviewer_name VARCHAR(100) DEFAULT NULL AFTER reviewer_id,
  ADD COLUMN reviewed_at TIMESTAMP NULL DEFAULT NULL AFTER reviewer_name,
  ADD COLUMN reviewed_remark VARCHAR(500) DEFAULT NULL AFTER reviewed_at,
  ADD COLUMN summary TEXT DEFAULT NULL AFTER inspection_result,
  ADD COLUMN attachments JSON DEFAULT NULL COMMENT '附件',
  ADD COLUMN signature_inspector VARCHAR(500) DEFAULT NULL,
  ADD COLUMN signature_reviewer VARCHAR(500) DEFAULT NULL,
  ADD COLUMN rectification_status ENUM('none', 'open', 'in_progress', 'resolved', 'verified') NOT NULL DEFAULT 'none' AFTER reviewed_remark,
  ADD COLUMN rectification_deadline DATE DEFAULT NULL AFTER rectification_status,
  ADD COLUMN rectification_result TEXT DEFAULT NULL AFTER rectification_deadline,
  ADD COLUMN rectification_assignee_id INT DEFAULT NULL AFTER rectification_result,
  ADD COLUMN rectification_assignee_name VARCHAR(100) DEFAULT NULL AFTER rectification_assignee_id,
  ADD INDEX idx_status (status),
  ADD INDEX idx_rectification (rectification_status),
  ADD INDEX idx_next_date (next_inspection_date);

-- 安全检测问题表
CREATE TABLE IF NOT EXISTS safety_inspection_issues (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL,
  issue_code VARCHAR(50) NOT NULL,
  inspection_id INT NOT NULL,
  asset_id INT,
  asset_name VARCHAR(200),
  problem_title VARCHAR(200) NOT NULL,
  problem_desc TEXT NOT NULL,
  risk_level ENUM('high', 'medium', 'low') NOT NULL DEFAULT 'medium',
  rectification_measures TEXT,
  rectification_assignee_id INT,
  rectification_assignee_name VARCHAR(100),
  rectification_deadline DATE,
  status ENUM('open', 'in_progress', 'resolved', 'verified', 'deferred') NOT NULL DEFAULT 'open',
  rectification_result TEXT,
  rectification_date DATE,
  verifier_id INT,
  verifier_name VARCHAR(100),
  verified_at TIMESTAMP NULL,
  verify_remark TEXT,
  work_order_id INT,
  work_order_code VARCHAR(50),
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_tenant_issuecode (tenant_id, issue_code),
  INDEX idx_inspection (inspection_id),
  INDEX idx_tenant_status (tenant_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='安全检测问题表';

SELECT '安全检测增强迁移完成' AS result;
