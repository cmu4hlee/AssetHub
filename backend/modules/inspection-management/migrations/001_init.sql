-- ============================================================
-- 巡检管理模块数据库初始化
-- 规范巡检记录单，保障巡检工作精细完善
-- ============================================================

-- -----------------------------------------------------
-- 1. 巡检模板表
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS inspection_templates (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL COMMENT '租户ID',
  template_code VARCHAR(50) NOT NULL COMMENT '模板编号',
  template_name VARCHAR(200) NOT NULL COMMENT '模板名称',
  inspection_type VARCHAR(50) NOT NULL DEFAULT 'daily' COMMENT '巡检类型：daily-日常巡检, weekly-周巡检, monthly-月巡检, quarterly-季巡检, special-专项巡检',
  applicable_scope VARCHAR(200) COMMENT '适用范围（资产类别/部门）',
  cycle_days INT DEFAULT 30 COMMENT '巡检周期(天)',
  description TEXT COMMENT '模板说明',
  status ENUM('active', 'inactive') DEFAULT 'active' COMMENT '状态',
  created_by INT COMMENT '创建人',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_tenant_code (tenant_id, template_code),
  INDEX idx_tenant_type (tenant_id, inspection_type),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='巡检模板表';

-- -----------------------------------------------------
-- 2. 巡检模板检查项表（规范巡检内容）
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS inspection_template_items (
  id INT PRIMARY KEY AUTO_INCREMENT,
  template_id INT NOT NULL COMMENT '模板ID',
  tenant_id INT NOT NULL COMMENT '租户ID',
  item_code VARCHAR(50) NOT NULL COMMENT '检查项编号',
  item_name VARCHAR(200) NOT NULL COMMENT '检查项名称',
  item_category VARCHAR(100) COMMENT '检查类别：appearance-外观, function-功能, safety-安全, environment-环境, performance-性能',
  check_method VARCHAR(200) COMMENT '检查方法',
  check_standard VARCHAR(500) COMMENT '检查标准/判定依据',
  expected_value VARCHAR(200) COMMENT '期望值/参考范围',
  unit VARCHAR(50) COMMENT '计量单位',
  is_required BOOLEAN DEFAULT TRUE COMMENT '是否必检',
  sort_order INT DEFAULT 0 COMMENT '排序',
  remark VARCHAR(500) COMMENT '备注',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_template (template_id),
  INDEX idx_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='巡检模板检查项表';

-- -----------------------------------------------------
-- 3. 巡检任务表
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS inspection_tasks (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL COMMENT '租户ID',
  task_code VARCHAR(50) NOT NULL COMMENT '任务编号',
  task_name VARCHAR(200) NOT NULL COMMENT '任务名称',
  template_id INT COMMENT '关联模板ID',
  asset_id INT COMMENT '关联资产ID（可空，表示区域巡检）',
  inspection_area VARCHAR(200) COMMENT '巡检区域',
  inspection_type VARCHAR(50) NOT NULL DEFAULT 'daily' COMMENT '巡检类型',
  assignee_id INT COMMENT '指派巡检人ID',
  assignee_name VARCHAR(100) COMMENT '巡检人姓名',
  plan_date DATE NOT NULL COMMENT '计划巡检日期',
  deadline DATE COMMENT '截止日期',
  cycle_days INT COMMENT '周期天数（用于自动生成）',
  status ENUM('pending', 'in_progress', 'completed', 'overdue', 'cancelled') DEFAULT 'pending' COMMENT '任务状态',
  priority ENUM('low', 'medium', 'high') DEFAULT 'medium' COMMENT '优先级',
  remark TEXT COMMENT '任务说明',
  created_by INT COMMENT '创建人',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_tenant_taskcode (tenant_id, task_code),
  INDEX idx_tenant_status (tenant_id, status),
  INDEX idx_tenant_assignee (tenant_id, assignee_id),
  INDEX idx_plan_date (plan_date),
  INDEX idx_template (template_id),
  INDEX idx_asset (asset_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='巡检任务表';

-- -----------------------------------------------------
-- 4. 巡检记录单表（核心规范表）
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS inspection_records (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL COMMENT '租户ID',
  record_code VARCHAR(50) NOT NULL COMMENT '记录单编号（规范格式：INS-YYYYMMDD-XXXX）',
  task_id INT COMMENT '关联任务ID',
  template_id INT COMMENT '关联模板ID',
  asset_id INT COMMENT '关联资产ID',
  asset_code VARCHAR(100) COMMENT '资产编码（冗余便于查询）',
  asset_name VARCHAR(200) COMMENT '资产名称（冗余）',

  -- 巡检基本信息
  inspection_title VARCHAR(200) NOT NULL COMMENT '巡检标题',
  inspection_type VARCHAR(50) NOT NULL DEFAULT 'daily' COMMENT '巡检类型',
  inspection_area VARCHAR(200) COMMENT '巡检区域/位置',
  inspection_date DATE NOT NULL COMMENT '巡检日期',
  start_time DATETIME COMMENT '开始时间',
  end_time DATETIME COMMENT '结束时间',

  -- 巡检人员
  inspector_id INT COMMENT '巡检人ID',
  inspector_name VARCHAR(100) NOT NULL COMMENT '巡检人姓名',
  reviewer_id INT COMMENT '复核人ID',
  reviewer_name VARCHAR(100) COMMENT '复核人姓名',
  reviewed_at TIMESTAMP NULL COMMENT '复核时间',

  -- 巡检结论
  total_items INT DEFAULT 0 COMMENT '总检查项数',
  normal_items INT DEFAULT 0 COMMENT '正常项数',
  abnormal_items INT DEFAULT 0 COMMENT '异常项数',
  overall_result ENUM('normal', 'abnormal', 'need_attention') DEFAULT 'normal' COMMENT '总体结论：normal-正常, abnormal-异常, need_attention-需关注',

  -- 总结与建议
  summary TEXT COMMENT '巡检总结',
  suggestions TEXT COMMENT '改进建议',
  remark TEXT COMMENT '备注',

  -- 附件
  attachments JSON COMMENT '附件列表（照片、文件等）',

  -- 状态与签字确认
  status ENUM('draft', 'submitted', 'reviewed', 'archived') DEFAULT 'draft' COMMENT '记录单状态：draft-草稿, submitted-已提交, reviewed-已复核, archived-已归档',
  signature_inspector VARCHAR(500) COMMENT '巡检人签字（base64或图片URL）',
  signature_reviewer VARCHAR(500) COMMENT '复核人签字',

  created_by INT COMMENT '记录创建人',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_tenant_recordcode (tenant_id, record_code),
  INDEX idx_tenant_status (tenant_id, status),
  INDEX idx_tenant_date (tenant_id, inspection_date),
  INDEX idx_task (task_id),
  INDEX idx_asset (asset_id),
  INDEX idx_inspector (inspector_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='巡检记录单表';

-- -----------------------------------------------------
-- 5. 巡检记录检查项明细表（记录单明细）
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS inspection_record_items (
  id INT PRIMARY KEY AUTO_INCREMENT,
  record_id INT NOT NULL COMMENT '巡检记录单ID',
  tenant_id INT NOT NULL COMMENT '租户ID',
  template_item_id INT COMMENT '模板检查项ID',
  item_code VARCHAR(50) COMMENT '检查项编号',
  item_name VARCHAR(200) NOT NULL COMMENT '检查项名称',
  item_category VARCHAR(100) COMMENT '检查类别',
  check_method VARCHAR(200) COMMENT '检查方法',
  check_standard VARCHAR(500) COMMENT '检查标准',
  expected_value VARCHAR(200) COMMENT '期望值',

  -- 巡检结果
  check_result ENUM('normal', 'abnormal', 'na') DEFAULT 'normal' COMMENT '检查结果：normal-正常, abnormal-异常, na-不适用',
  actual_value VARCHAR(500) COMMENT '实测值/检查描述',
  unit VARCHAR(50) COMMENT '单位',
  problem_desc TEXT COMMENT '问题描述（异常时填写）',
  risk_level ENUM('high', 'medium', 'low') COMMENT '风险等级',
  photo_urls JSON COMMENT '现场照片URL列表',
  remark VARCHAR(500) COMMENT '备注',

  sort_order INT DEFAULT 0 COMMENT '排序',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_record (record_id),
  INDEX idx_tenant (tenant_id),
  INDEX idx_result (check_result)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='巡检记录检查项明细表';

-- -----------------------------------------------------
-- 6. 巡检问题表（异常问题整改跟踪）
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS inspection_issues (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL COMMENT '租户ID',
  issue_code VARCHAR(50) NOT NULL COMMENT '问题编号',
  record_id INT NOT NULL COMMENT '关联巡检记录单ID',
  record_item_id INT COMMENT '关联检查项ID',
  asset_id INT COMMENT '关联资产ID',
  asset_name VARCHAR(200) COMMENT '资产名称',

  -- 问题信息
  problem_title VARCHAR(200) NOT NULL COMMENT '问题标题',
  problem_desc TEXT NOT NULL COMMENT '问题描述',
  problem_category VARCHAR(100) COMMENT '问题类别：function-功能故障, appearance-外观损坏, safety-安全隐患, environment-环境问题, other-其他',
  risk_level ENUM('high', 'medium', 'low') NOT NULL DEFAULT 'medium' COMMENT '风险等级',
  photo_urls JSON COMMENT '问题照片',

  -- 整改要求
  rectification_measures TEXT COMMENT '整改措施',
  rectification_assignee_id INT COMMENT '整改责任人ID',
  rectification_assignee_name VARCHAR(100) COMMENT '整改责任人',
  rectification_deadline DATE COMMENT '整改期限',

  -- 整改结果
  status ENUM('open', 'in_progress', 'resolved', 'verified', 'deferred') DEFAULT 'open' COMMENT '状态：open-待处理, in_progress-整改中, resolved-已整改, verified-已验证, deferred-暂缓',
  rectification_result TEXT COMMENT '整改结果说明',
  rectification_photo_urls JSON COMMENT '整改后照片',
  rectification_date DATE COMMENT '整改完成日期',
  verifier_id INT COMMENT '验证人ID',
  verifier_name VARCHAR(100) COMMENT '验证人姓名',
  verified_at TIMESTAMP NULL COMMENT '验证时间',
  verify_remark TEXT COMMENT '验证说明',

  created_by INT COMMENT '创建人',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_tenant_issuecode (tenant_id, issue_code),
  INDEX idx_tenant_status (tenant_id, status),
  INDEX idx_record (record_id),
  INDEX idx_asset (asset_id),
  INDEX idx_risk (risk_level)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='巡检问题表';
