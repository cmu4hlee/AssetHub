-- ============================================
-- 验收管理模块增强 - 数据库迁移脚本
-- 新增：验收申请、审批记录、验收小组、提醒、模板扩展
-- ============================================

-- 1. 验收申请表
CREATE TABLE IF NOT EXISTS acceptance_applications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  application_code VARCHAR(50) COMMENT '申请编号',
  title VARCHAR(200) NOT NULL COMMENT '申请标题',
  asset_code VARCHAR(50) COMMENT '资产编号',
  asset_name VARCHAR(100) COMMENT '资产名称',
  supplier VARCHAR(200) COMMENT '供应商',
  planned_acceptance_date DATE COMMENT '计划验收日期',
  applicant_id INT COMMENT '申请人ID',
  applicant_name VARCHAR(50) COMMENT '申请人姓名',
  department VARCHAR(100) COMMENT '申请科室',
  functional_department VARCHAR(100) COMMENT '职能部门',
  priority ENUM('低','中','高') DEFAULT '中' COMMENT '优先级',
  status ENUM('草稿','待审批','审批中','已批准','已拒绝','已撤回','已完成') DEFAULT '草稿' COMMENT '申请状态',
  description TEXT COMMENT '申请说明',
  acceptance_record_id INT NULL COMMENT '关联验收记录ID',
  approval_comment TEXT NULL COMMENT '审批意见',
  approved_by VARCHAR(50) NULL COMMENT '审批人',
  approved_at DATETIME NULL COMMENT '审批时间',
  created_by VARCHAR(50) COMMENT '创建人',
  updated_by VARCHAR(50) NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  is_deleted TINYINT(1) DEFAULT 0,
  deleted_at DATETIME NULL,
  deleted_by VARCHAR(50) NULL,
  INDEX idx_tenant (tenant_id),
  INDEX idx_status (status),
  INDEX idx_application_code (application_code),
  INDEX idx_applicant (applicant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='验收申请';

-- 2. 审批记录表
CREATE TABLE IF NOT EXISTS acceptance_approvals (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  application_id INT NOT NULL COMMENT '验收申请ID',
  approver_id INT COMMENT '审批人ID',
  approver_name VARCHAR(50) NOT NULL COMMENT '审批人姓名',
  action ENUM('submit','approve','reject','withdraw','complete') NOT NULL COMMENT '审批动作',
  comment TEXT COMMENT '审批意见',
  from_status VARCHAR(20) COMMENT '变更前状态',
  to_status VARCHAR(20) COMMENT '变更后状态',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_application (application_id),
  INDEX idx_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='验收申请审批记录';

-- 3. 验收小组表
CREATE TABLE IF NOT EXISTS acceptance_teams (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  acceptance_record_id INT NOT NULL COMMENT '验收记录ID',
  user_id INT COMMENT '成员用户ID',
  member_name VARCHAR(50) NOT NULL COMMENT '成员姓名',
  role ENUM('组长','成员','观察员') DEFAULT '成员' COMMENT '角色',
  department VARCHAR(100) COMMENT '所属科室',
  assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '分配时间',
  INDEX idx_record (acceptance_record_id),
  INDEX idx_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='验收小组';

-- 4. 验收提醒表
CREATE TABLE IF NOT EXISTS acceptance_reminders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  acceptance_record_id INT NULL COMMENT '关联验收记录',
  application_id INT NULL COMMENT '关联验收申请',
  reminder_type ENUM('到期提醒','超期预警','审批待办','整改通知') NOT NULL COMMENT '提醒类型',
  title VARCHAR(200) NOT NULL COMMENT '提醒标题',
  content TEXT COMMENT '提醒内容',
  remind_date DATE NOT NULL COMMENT '提醒日期',
  status ENUM('待发送','已发送','已读','已忽略') DEFAULT '待发送' COMMENT '状态',
  target_user_id INT NULL COMMENT '目标用户ID',
  target_department VARCHAR(100) NULL COMMENT '目标科室',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  sent_at DATETIME NULL,
  INDEX idx_record (acceptance_record_id),
  INDEX idx_status (status),
  INDEX idx_remind_date (remind_date),
  INDEX idx_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='验收提醒';

-- 5. 扩展验收模板表 - 增加启用状态和描述字段
ALTER TABLE asset_acceptance_templates
  ADD COLUMN IF NOT EXISTS is_enabled TINYINT(1) DEFAULT 1 COMMENT '是否启用' AFTER is_required,
  ADD COLUMN IF NOT EXISTS template_description VARCHAR(500) NULL COMMENT '模板描述' AFTER template_name;

-- 6. 扩展验收记录表 - 增加报告相关字段
ALTER TABLE asset_acceptance_records
  ADD COLUMN IF NOT EXISTS report_summary TEXT NULL COMMENT '验收报告摘要' AFTER remark,
  ADD COLUMN IF NOT EXISTS report_generated_at DATETIME NULL COMMENT '报告生成时间' AFTER report_summary,
  ADD COLUMN IF NOT EXISTS report_generated_by VARCHAR(50) NULL COMMENT '报告生成人' AFTER report_generated_at,
  ADD COLUMN IF NOT EXISTS acceptance_started_at DATETIME NULL COMMENT '验收开始时间' AFTER acceptance_date,
  ADD COLUMN IF NOT EXISTS acceptance_completed_at DATETIME NULL COMMENT '验收完成时间' AFTER acceptance_started_at;
