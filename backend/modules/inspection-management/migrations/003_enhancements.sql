-- ============================================================
-- 巡检管理模块增强迁移
-- 解决:任务号并发、record_item_id 关联、转工单、模板复制、周期任务
-- ============================================================

-- 1. 巡检编号自增序列表（用事务+行锁保证唯一）
CREATE TABLE IF NOT EXISTS inspection_sequences (
  tenant_id INT NOT NULL,
  seq_key VARCHAR(50) NOT NULL COMMENT '序列类型:record/task/issue/template',
  seq_year INT NOT NULL COMMENT '年份',
  current_value BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (tenant_id, seq_key, seq_year)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='巡检编号自增序列表';

-- 2. 巡检任务表增强
ALTER TABLE inspection_tasks
  ADD COLUMN parent_task_id INT DEFAULT NULL COMMENT '上一周期任务ID（自动派发时关联）' AFTER task_code,
  ADD COLUMN recurring_plan_id INT DEFAULT NULL COMMENT '所属巡检计划ID' AFTER parent_task_id,
  ADD COLUMN auto_generated TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否系统自动生成' AFTER recurring_plan_id,
  ADD COLUMN started_at TIMESTAMP NULL COMMENT '实际开始时间' AFTER plan_date,
  ADD COLUMN completed_at TIMESTAMP NULL COMMENT '实际完成时间' AFTER started_at,
  ADD COLUMN completed_by INT DEFAULT NULL COMMENT '完成人ID' AFTER completed_at,
  ADD INDEX idx_recurring (recurring_plan_id),
  ADD INDEX idx_parent_task (parent_task_id);

-- 3. 巡检计划表（按周期批量派发任务的源头）
CREATE TABLE IF NOT EXISTS inspection_plans (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL,
  plan_code VARCHAR(50) NOT NULL COMMENT '计划编号',
  plan_name VARCHAR(200) NOT NULL COMMENT '计划名称',
  template_id INT DEFAULT NULL COMMENT '关联模板ID',
  cycle_days INT NOT NULL DEFAULT 30 COMMENT '巡检周期(天)',
  cycle_type ENUM('daily', 'weekly', 'monthly', 'quarterly', 'yearly') NOT NULL DEFAULT 'monthly' COMMENT '周期类型',
  weekday TINYINT DEFAULT NULL COMMENT '周几（周周期）0-6',
  day_of_month TINYINT DEFAULT NULL COMMENT '几号（月周期）1-31',
  start_date DATE NOT NULL COMMENT '计划起始日期',
  end_date DATE DEFAULT NULL COMMENT '计划截止日期（空=长期）',
  next_run_date DATE DEFAULT NULL COMMENT '下次派发日期',
  last_run_date DATE DEFAULT NULL COMMENT '上次派发日期',
  asset_ids JSON DEFAULT NULL COMMENT '覆盖的资产ID列表（空=按模板适用范围）',
  scope_type ENUM('assets', 'department', 'category', 'area') NOT NULL DEFAULT 'assets' COMMENT '范围类型',
  scope_value VARCHAR(500) DEFAULT NULL COMMENT '范围值（部门ID/分类/区域）',
  default_assignee_id INT DEFAULT NULL COMMENT '默认巡检人ID',
  default_assignee_name VARCHAR(100) DEFAULT NULL,
  default_priority ENUM('low', 'medium', 'high') DEFAULT 'medium',
  auto_create_workorder TINYINT(1) NOT NULL DEFAULT 0 COMMENT '异常时自动转工单',
  status ENUM('active', 'paused', 'ended') NOT NULL DEFAULT 'active',
  remark TEXT,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_tenant_plancode (tenant_id, plan_code),
  INDEX idx_tenant_status (tenant_id, status),
  INDEX idx_next_run (next_run_date),
  INDEX idx_template (template_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='巡检计划表（按周期自动派发）';

-- 4. 巡检路线/路线点（按顺序巡检多个资产）
CREATE TABLE IF NOT EXISTS inspection_routes (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL,
  route_code VARCHAR(50) NOT NULL,
  route_name VARCHAR(200) NOT NULL,
  description TEXT,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  estimated_minutes INT DEFAULT 60 COMMENT '预计耗时(分钟)',
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_tenant_routecode (tenant_id, route_code),
  INDEX idx_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='巡检路线表';

CREATE TABLE IF NOT EXISTS inspection_route_points (
  id INT PRIMARY KEY AUTO_INCREMENT,
  route_id INT NOT NULL,
  tenant_id INT NOT NULL,
  point_order INT NOT NULL DEFAULT 0 COMMENT '顺序号',
  asset_id INT DEFAULT NULL COMMENT '关联资产ID',
  location_code VARCHAR(100) DEFAULT NULL COMMENT '位置编码（无资产时手动记录）',
  location_name VARCHAR(200) DEFAULT NULL,
  check_items JSON DEFAULT NULL COMMENT '该点位专项检查项（覆盖模板项）',
  qr_code VARCHAR(500) DEFAULT NULL COMMENT '点位二维码内容',
  remark VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_route (route_id, point_order),
  INDEX idx_asset (asset_id),
  INDEX idx_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='巡检路线点位表';

-- 5. 巡检记录单 - 路线/计划关联
ALTER TABLE inspection_records
  ADD COLUMN route_id INT DEFAULT NULL COMMENT '关联巡检路线ID' AFTER template_id,
  ADD COLUMN plan_id INT DEFAULT NULL COMMENT '关联巡检计划ID' AFTER route_id,
  ADD COLUMN reviewed_remark VARCHAR(500) DEFAULT NULL COMMENT '复核意见' AFTER signature_reviewer,
  ADD INDEX idx_route (route_id),
  ADD INDEX idx_plan (plan_id);

-- 6. 巡检问题 - 维修工单关联 + 整改照片
ALTER TABLE inspection_issues
  ADD COLUMN work_order_id INT DEFAULT NULL COMMENT '关联维修工单ID' AFTER record_item_id,
  ADD COLUMN work_order_code VARCHAR(50) DEFAULT NULL COMMENT '工单编号冗余' AFTER work_order_id,
  ADD INDEX idx_work_order (work_order_id);

-- 7. 巡检问题 - 整改历史表（记录每次状态变更）
CREATE TABLE IF NOT EXISTS inspection_issue_histories (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL,
  issue_id INT NOT NULL,
  action VARCHAR(50) NOT NULL COMMENT '动作：created/assigned/in_progress/resolved/verified/deferred/reopened',
  operator_id INT,
  operator_name VARCHAR(100),
  from_status VARCHAR(50),
  to_status VARCHAR(50),
  remark TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_issue (issue_id),
  INDEX idx_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='巡检问题操作历史表';

-- 8. 通知/提醒记录表（到期提醒使用）
CREATE TABLE IF NOT EXISTS inspection_notifications (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL,
  notify_type VARCHAR(50) NOT NULL COMMENT 'task_expiring/issue_overdue/plan_due',
  ref_id INT NOT NULL COMMENT '关联对象ID',
  ref_code VARCHAR(50),
  recipient_id INT NOT NULL COMMENT '接收人ID',
  recipient_name VARCHAR(100),
  title VARCHAR(200) NOT NULL,
  content TEXT,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  read_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_tenant_recipient (tenant_id, recipient_id, is_read),
  INDEX idx_ref (ref_id, notify_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='巡检通知表';

-- 9. 安全检测表增强在 safety-inspection-management 模块独立迁移
--    (本迁移文件仅负责通用巡检的增强)

SELECT '巡检管理增强迁移完成' AS result;
