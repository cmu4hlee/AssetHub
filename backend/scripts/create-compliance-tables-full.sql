-- ==========================================
-- 合规性管理模块完整表结构
-- ==========================================

-- 分级保养模板表
CREATE TABLE IF NOT EXISTS maintenance_level_templates (
  id INT PRIMARY KEY AUTO_INCREMENT,
  template_code VARCHAR(50) NOT NULL COMMENT '模板编码',
  template_name VARCHAR(200) NOT NULL COMMENT '模板名称',
  maintenance_level ENUM('daily', 'level1', 'level2', 'level3') NOT NULL COMMENT '保养级别:日常/一级/二级/三级',
  asset_category VARCHAR(100) COMMENT '适用资产类别',
  asset_type VARCHAR(100) COMMENT '适用资产类型',
  risk_level ENUM('low', 'medium', 'high', 'critical') COMMENT '适用风险等级',
  cycle_days INT DEFAULT 30 COMMENT '保养周期(天)',
  cycle_type ENUM('fixed', 'floating') DEFAULT 'fixed' COMMENT '周期类型:固定/浮动',
  maintenance_items TEXT COMMENT '保养项目(JSON格式)',
  maintenance_standards TEXT COMMENT '保养标准',
  required_tools TEXT COMMENT '所需工具',
  estimated_duration INT COMMENT '预计时长(分钟)',
  status ENUM('active', 'inactive') DEFAULT 'active' COMMENT '状态',
  remark TEXT COMMENT '备注',
  tenant_id INT DEFAULT 1 COMMENT '租户ID',
  created_by INT COMMENT '创建人ID',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL,
  UNIQUE KEY uk_template_code (template_code, tenant_id),
  INDEX idx_maintenance_level (maintenance_level),
  INDEX idx_asset_category (asset_category),
  INDEX idx_status (status),
  INDEX idx_tenant_id (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='分级保养模板表';

-- 分级保养计划表
CREATE TABLE IF NOT EXISTS maintenance_level_plans (
  id INT PRIMARY KEY AUTO_INCREMENT,
  plan_code VARCHAR(50) NOT NULL COMMENT '计划编码',
  plan_name VARCHAR(200) NOT NULL COMMENT '计划名称',
  template_id INT COMMENT '关联模板ID',
  asset_id INT NOT NULL COMMENT '资产ID',
  maintenance_level ENUM('daily', 'level1', 'level2', 'level3') NOT NULL COMMENT '保养级别',
  plan_date DATE NOT NULL COMMENT '计划日期',
  actual_date DATE COMMENT '实际执行日期',
  executor_id INT COMMENT '执行人ID',
  supervisor_id INT COMMENT '监督人ID',
  maintenance_items TEXT COMMENT '保养项目执行详情(JSON)',
  maintenance_result ENUM('pass', 'fail', 'partial') COMMENT '保养结果',
  issues_found TEXT COMMENT '发现的问题',
  improvements TEXT COMMENT '改进建议',
  next_plan_date DATE COMMENT '下次计划日期',
  status ENUM('planned', 'processing', 'completed', 'overdue', 'cancelled') DEFAULT 'planned' COMMENT '状态',
  remark TEXT COMMENT '备注',
  tenant_id INT DEFAULT 1 COMMENT '租户ID',
  created_by INT COMMENT '创建人ID',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL,
  UNIQUE KEY uk_plan_code (plan_code, tenant_id),
  INDEX idx_asset_id (asset_id),
  INDEX idx_template_id (template_id),
  INDEX idx_plan_date (plan_date),
  INDEX idx_status (status),
  INDEX idx_tenant_id (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='分级保养计划表';

-- 特种设备表
CREATE TABLE IF NOT EXISTS special_equipment (
  id INT PRIMARY KEY AUTO_INCREMENT,
  equipment_code VARCHAR(50) NOT NULL COMMENT '设备编码',
  equipment_name VARCHAR(200) NOT NULL COMMENT '设备名称',
  equipment_type ENUM('pressure_vessel', 'elevator', 'crane', 'forklift', 'boiler', 'other') NOT NULL COMMENT '设备类型',
  asset_id INT COMMENT '关联资产ID',
  manufacturer VARCHAR(200) COMMENT '制造商',
  model VARCHAR(100) COMMENT '型号',
  serial_number VARCHAR(100) COMMENT '序列号',
  registration_code VARCHAR(100) COMMENT '使用登记证编号',
  certificate_no VARCHAR(100) COMMENT '检验合格证号',
  install_location VARCHAR(200) COMMENT '安装地点',
  install_date DATE COMMENT '安装日期',
  first_use_date DATE COMMENT '首次使用日期',
  last_inspection_date DATE COMMENT '上次检验日期',
  next_inspection_date DATE COMMENT '下次检验日期',
  inspection_cycle INT DEFAULT 12 COMMENT '检验周期(月)',
  inspection_org VARCHAR(200) COMMENT '检验机构',
  safety_status ENUM('normal', 'expiring', 'expired', 'stopped') DEFAULT 'normal' COMMENT '安全状态',
  responsible_person_id INT COMMENT '责任人ID',
  management_department_id INT COMMENT '管理部门ID',
  technical_file_url VARCHAR(500) COMMENT '技术档案URL',
  status ENUM('in_use', 'out_of_service', 'scrapped') DEFAULT 'in_use' COMMENT '使用状态',
  remark TEXT COMMENT '备注',
  tenant_id INT DEFAULT 1 COMMENT '租户ID',
  created_by INT COMMENT '创建人ID',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL,
  UNIQUE KEY uk_equipment_code (equipment_code, tenant_id),
  INDEX idx_asset_id (asset_id),
  INDEX idx_next_inspection (next_inspection_date),
  INDEX idx_safety_status (safety_status),
  INDEX idx_status (status),
  INDEX idx_tenant_id (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='特种设备表';

-- 特种设备检验记录表
CREATE TABLE IF NOT EXISTS special_equipment_inspections (
  id INT PRIMARY KEY AUTO_INCREMENT,
  equipment_id INT NOT NULL COMMENT '设备ID',
  inspection_type ENUM('regular', 'reinspection', 'temporary') NOT NULL COMMENT '检验类型',
  inspection_date DATE NOT NULL COMMENT '检验日期',
  inspection_org VARCHAR(200) COMMENT '检验机构',
  inspector VARCHAR(100) COMMENT '检验员',
  inspection_result ENUM('pass', 'fail', 'conditional') NOT NULL COMMENT '检验结果',
  issues_found TEXT COMMENT '发现问题',
  rectification_measures TEXT COMMENT '整改措施',
  rectification_deadline DATE COMMENT '整改期限',
  rectification_completed_date DATE COMMENT '整改完成日期',
  certificate_no VARCHAR(100) COMMENT '检验证书号',
  certificate_url VARCHAR(500) COMMENT '证书URL',
  next_inspection_date DATE COMMENT '下次检验日期',
  inspection_report_url VARCHAR(500) COMMENT '检验报告URL',
  cost DECIMAL(10,2) COMMENT '检验费用',
  status ENUM('completed', 'pending_rectification', 'overdue') DEFAULT 'completed' COMMENT '状态',
  remark TEXT COMMENT '备注',
  tenant_id INT DEFAULT 1 COMMENT '租户ID',
  created_by INT COMMENT '创建人ID',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL,
  INDEX idx_equipment_id (equipment_id),
  INDEX idx_inspection_date (inspection_date),
  INDEX idx_next_inspection (next_inspection_date),
  INDEX idx_tenant_id (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='特种设备检验记录表';

-- 安全检测表
CREATE TABLE IF NOT EXISTS safety_inspections (
  id INT PRIMARY KEY AUTO_INCREMENT,
  inspection_code VARCHAR(50) NOT NULL COMMENT '检测编号',
  inspection_name VARCHAR(200) NOT NULL COMMENT '检测名称',
  asset_id INT COMMENT '关联资产ID',
  inspection_type ENUM('electrical', 'radiation', 'mechanical', 'chemical', 'biological', 'other') NOT NULL COMMENT '检测类型',
  inspection_date DATE NOT NULL COMMENT '检测日期',
  inspection_org VARCHAR(200) COMMENT '检测机构',
  inspector VARCHAR(100) COMMENT '检测员',
  inspection_result ENUM('pass', 'fail', 'conditional') NOT NULL COMMENT '检测结果',
  inspection_items TEXT COMMENT '检测项目(JSON)',
  issues_found TEXT COMMENT '发现问题',
  rectification_requirements TEXT COMMENT '整改要求',
  rectification_deadline DATE COMMENT '整改期限',
  rectification_completed_date DATE COMMENT '整改完成日期',
  certificate_no VARCHAR(100) COMMENT '检测证书号',
  certificate_url VARCHAR(500) COMMENT '证书URL',
  next_inspection_date DATE COMMENT '下次检测日期',
  inspection_report_url VARCHAR(500) COMMENT '检测报告URL',
  cost DECIMAL(10,2) COMMENT '检测费用',
  status ENUM('completed', 'pending_rectification', 'overdue') DEFAULT 'completed' COMMENT '状态',
  remark TEXT COMMENT '备注',
  tenant_id INT DEFAULT 1 COMMENT '租户ID',
  created_by INT COMMENT '创建人ID',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL,
  UNIQUE KEY uk_inspection_code (inspection_code, tenant_id),
  INDEX idx_asset_id (asset_id),
  INDEX idx_inspection_type (inspection_type),
  INDEX idx_inspection_date (inspection_date),
  INDEX idx_next_inspection (next_inspection_date),
  INDEX idx_tenant_id (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='安全检测表';

-- 插入一些示例数据
INSERT INTO maintenance_level_templates (template_code, template_name, maintenance_level, asset_category, cycle_days, maintenance_items, status, tenant_id, created_by) VALUES
('TEMP001', 'CT机日常保养模板', 'daily', '医疗设备', 1, '["清洁设备表面", "检查电源连接", "检查运行状态"]', 'active', 1, 1),
('TEMP002', 'CT机一级保养模板', 'level1', '医疗设备', 30, '["更换滤芯", "检查电缆", "校准设备"]', 'active', 1, 1),
('TEMP003', 'MRI机二级保养模板', 'level2', '医疗设备', 90, '["深度清洁", "检查制冷系统", "检查磁场强度"]', 'active', 1, 1);

INSERT INTO special_equipment (equipment_code, equipment_name, equipment_type, registration_code, install_location, next_inspection_date, safety_status, status, tenant_id, created_by) VALUES
('TZ001', '1号电梯', 'elevator', 'E2024001', '门诊楼A区', '2026-06-30', 'normal', 'in_use', 1, 1),
('TZ002', '2号电梯', 'elevator', 'E2024002', '住院部B区', '2026-05-15', 'expiring', 'in_use', 1, 1),
('TZ003', '压力容器1号', 'pressure_vessel', 'R2024001', '锅炉房', '2026-03-10', 'expiring', 'in_use', 1, 1);

INSERT INTO safety_inspections (inspection_code, inspection_name, inspection_type, inspection_date, inspection_org, inspector, inspection_result, next_inspection_date, status, tenant_id, created_by) VALUES
('AQ001', 'CT机电气安全检测', 'electrical', '2026-02-15', '省特种设备检验院', '张三', 'pass', '2027-02-15', 'completed', 1, 1),
('AQ002', 'X光机辐射安全检测', 'radiation', '2026-01-20', '市放射防护所', '李四', 'pass', '2027-01-20', 'completed', 1, 1);
