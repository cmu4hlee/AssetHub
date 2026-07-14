-- =====================================================
-- 《医学装备整体运维管理服务规范》合规性表结构
-- 创建时间: 2026-03-02
-- =====================================================

-- -----------------------------------------------------
-- 1. 设备风险等级表 (用于分级保养)
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS asset_risk_levels (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL COMMENT '租户ID',
  asset_id INT NOT NULL COMMENT '资产ID',
  risk_level ENUM('high', 'medium', 'low') NOT NULL COMMENT '风险等级: 高/中/低',
  risk_score INT COMMENT '风险评分(1-100)',
  assessment_items JSON COMMENT '评估项目详情',
  assessment_date DATE NOT NULL COMMENT '评估日期',
  assessor_id INT COMMENT '评估人ID',
  next_assessment_date DATE COMMENT '下次评估日期',
  remarks TEXT COMMENT '备注',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_tenant_asset (tenant_id, asset_id),
  INDEX idx_risk_level (risk_level),
  INDEX idx_assessment_date (assessment_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='设备风险等级评估表';

-- -----------------------------------------------------
-- 2. 分级保养模板表
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS maintenance_level_templates (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL COMMENT '租户ID',
  template_code VARCHAR(50) NOT NULL COMMENT '模板编码',
  template_name VARCHAR(100) NOT NULL COMMENT '模板名称',
  maintenance_level ENUM('daily', 'level1', 'level2', 'level3') NOT NULL COMMENT '保养级别: 日常/一级/二级/三级',
  asset_category VARCHAR(100) COMMENT '适用设备类别',
  asset_type VARCHAR(100) COMMENT '适用设备类型',
  risk_level VARCHAR(20) COMMENT '适用风险等级',
  cycle_days INT NOT NULL COMMENT '保养周期(天)',
  cycle_type ENUM('day', 'week', 'month', 'quarter', 'year') NOT NULL COMMENT '周期类型',
  maintenance_items JSON NOT NULL COMMENT '保养项目清单',
  required_tools TEXT COMMENT '所需工具',
  required_materials TEXT COMMENT '所需耗材',
  estimated_hours DECIMAL(4,1) COMMENT '预计工时(小时)',
  standards TEXT COMMENT '执行标准',
  safety_requirements TEXT COMMENT '安全要求',
  status ENUM('active', 'inactive') DEFAULT 'active' COMMENT '状态',
  created_by INT COMMENT '创建人',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_tenant_level (tenant_id, maintenance_level),
  INDEX idx_category (asset_category),
  INDEX idx_status (status),
  UNIQUE KEY uk_tenant_code (tenant_id, template_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='分级保养模板表';

-- -----------------------------------------------------
-- 3. 分级保养计划表
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS maintenance_level_plans (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL COMMENT '租户ID',
  plan_no VARCHAR(50) NOT NULL COMMENT '计划编号',
  asset_id INT NOT NULL COMMENT '资产ID',
  template_id INT NOT NULL COMMENT '模板ID',
  maintenance_level ENUM('daily', 'level1', 'level2', 'level3') NOT NULL COMMENT '保养级别',
  plan_date DATE NOT NULL COMMENT '计划日期',
  due_date DATE NOT NULL COMMENT '截止日期',
  executor_id INT COMMENT '执行人ID',
  executor_name VARCHAR(100) COMMENT '执行人姓名',
  status ENUM('pending', 'processing', 'completed', 'overdue', 'cancelled') DEFAULT 'pending' COMMENT '状态',
  actual_date DATE COMMENT '实际执行日期',
  completion_status ENUM('qualified', 'unqualified', 'partial') COMMENT '完成质量',
  work_hours DECIMAL(4,1) COMMENT '实际工时',
  materials_used JSON COMMENT '使用耗材',
  findings TEXT COMMENT '检查发现',
  measures TEXT COMMENT '采取措施',
  remarks TEXT COMMENT '备注',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_tenant_asset (tenant_id, asset_id),
  INDEX idx_plan_date (plan_date),
  INDEX idx_status (status),
  INDEX idx_due_date (due_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='分级保养计划表';

-- -----------------------------------------------------
-- 4. 设备运行记录表 (用于开机率统计)
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS asset_operation_logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL COMMENT '租户ID',
  asset_id INT NOT NULL COMMENT '资产ID',
  operation_date DATE NOT NULL COMMENT '记录日期',
  
  -- 运行时间记录
  planned_operating_hours DECIMAL(5,2) DEFAULT 24.00 COMMENT '计划运行时长(小时)',
  actual_operating_hours DECIMAL(5,2) DEFAULT 0 COMMENT '实际运行时长(小时)',
  downtime_hours DECIMAL(5,2) DEFAULT 0 COMMENT '停机时长(小时)',
  
  -- 状态记录
  status_changes JSON COMMENT '状态变化记录',
  
  -- 停机原因
  downtime_reason VARCHAR(200) COMMENT '停机原因',
  downtime_type ENUM('maintenance', 'repair', 'fault', 'inspection', 'other') COMMENT '停机类型',
  
  -- 数据来源
  data_source ENUM('iot', 'manual', 'system') DEFAULT 'manual' COMMENT '数据来源',
  iot_device_id VARCHAR(50) COMMENT 'IoT设备ID',
  
  -- 记录人
  recorded_by INT COMMENT '记录人ID',
  recorded_by_name VARCHAR(100) COMMENT '记录人姓名',
  remarks TEXT COMMENT '备注',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_tenant_asset (tenant_id, asset_id),
  INDEX idx_operation_date (operation_date),
  INDEX idx_asset_date (asset_id, operation_date),
  UNIQUE KEY uk_asset_date (tenant_id, asset_id, operation_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='设备运行记录表';

-- -----------------------------------------------------
-- 5. 开机率统计表 (按月汇总)
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS asset_uptime_statistics (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL COMMENT '租户ID',
  asset_id INT NOT NULL COMMENT '资产ID',
  stat_year INT NOT NULL COMMENT '统计年份',
  stat_month INT NOT NULL COMMENT '统计月份',
  
  -- 开机率数据
  planned_operating_days INT DEFAULT 30 COMMENT '计划运行天数',
  actual_operating_days INT DEFAULT 0 COMMENT '实际运行天数',
  total_planned_hours DECIMAL(8,2) DEFAULT 720.00 COMMENT '总计划运行时长',
  total_actual_hours DECIMAL(8,2) DEFAULT 0 COMMENT '总实际运行时长',
  total_downtime_hours DECIMAL(8,2) DEFAULT 0 COMMENT '总停机时长',
  uptime_rate DECIMAL(5,2) DEFAULT 0 COMMENT '开机率(%)',
  
  -- 停机统计
  maintenance_count INT DEFAULT 0 COMMENT '保养停机次数',
  repair_count INT DEFAULT 0 COMMENT '维修停机次数',
  fault_count INT DEFAULT 0 COMMENT '故障停机次数',
  inspection_count INT DEFAULT 0 COMMENT '检查停机次数',
  other_count INT DEFAULT 0 COMMENT '其他停机次数',
  
  -- 停机时长统计
  maintenance_hours DECIMAL(8,2) DEFAULT 0 COMMENT '保养停机时长',
  repair_hours DECIMAL(8,2) DEFAULT 0 COMMENT '维修停机时长',
  fault_hours DECIMAL(8,2) DEFAULT 0 COMMENT '故障停机时长',
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_tenant_asset (tenant_id, asset_id),
  INDEX idx_year_month (stat_year, stat_month),
  INDEX idx_uptime_rate (uptime_rate),
  UNIQUE KEY uk_asset_month (tenant_id, asset_id, stat_year, stat_month)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='设备开机率统计表';

-- -----------------------------------------------------
-- 6. 人员资质表
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS staff_qualifications (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL COMMENT '租户ID',
  user_id INT NOT NULL COMMENT '用户ID',
  
  -- 基本信息
  qualification_type ENUM('professional', 'skill', 'safety', 'special') NOT NULL COMMENT '资质类型: 专业/技能/安全/特种',
  qualification_name VARCHAR(100) NOT NULL COMMENT '资质名称',
  qualification_level VARCHAR(50) COMMENT '资质等级',
  certificate_no VARCHAR(100) COMMENT '证书编号',
  issuing_authority VARCHAR(200) COMMENT '发证机构',
  issue_date DATE COMMENT '发证日期',
  expiry_date DATE COMMENT '有效期至',
  
  -- 专业资质详情
  professional_field VARCHAR(100) COMMENT '专业领域',
  applicable_equipment TEXT COMMENT '适用设备范围',
  
  -- 附件
  certificate_image VARCHAR(500) COMMENT '证书图片',
  attachments JSON COMMENT '附件列表',
  
  -- 状态
  status ENUM('active', 'expired', 'revoked', 'pending') DEFAULT 'active' COMMENT '状态',
  
  remarks TEXT COMMENT '备注',
  created_by INT COMMENT '创建人',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_tenant_user (tenant_id, user_id),
  INDEX idx_type (qualification_type),
  INDEX idx_expiry (expiry_date),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='人员资质表';

-- -----------------------------------------------------
-- 7. 人员培训记录表
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS staff_training_records (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL COMMENT '租户ID',
  user_id INT NOT NULL COMMENT '用户ID',
  
  -- 培训信息
  training_type ENUM('onboarding', 'skill', 'safety', 'regulation', 'equipment') NOT NULL COMMENT '培训类型',
  training_name VARCHAR(200) NOT NULL COMMENT '培训名称',
  training_content TEXT COMMENT '培训内容',
  training_method ENUM('online', 'offline', 'hybrid') COMMENT '培训方式',
  
  -- 时间地点
  training_date DATE NOT NULL COMMENT '培训日期',
  training_duration DECIMAL(4,1) COMMENT '培训时长(小时)',
  training_location VARCHAR(200) COMMENT '培训地点',
  trainer VARCHAR(100) COMMENT '培训讲师',
  
  -- 考核信息
  assessment_required BOOLEAN DEFAULT TRUE COMMENT '是否需要考核',
  assessment_score DECIMAL(5,2) COMMENT '考核成绩',
  assessment_result ENUM('pass', 'fail', 'excellent') COMMENT '考核结果',
  certificate_no VARCHAR(100) COMMENT '培训证书编号',
  
  -- 关联设备
  related_equipment TEXT COMMENT '关联设备类型',
  
  -- 附件
  attachments JSON COMMENT '附件',
  
  remarks TEXT COMMENT '备注',
  created_by INT COMMENT '记录人',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_tenant_user (tenant_id, user_id),
  INDEX idx_type (training_type),
  INDEX idx_date (training_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='人员培训记录表';

-- -----------------------------------------------------
-- 8. 特种设备表
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS special_equipment (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL COMMENT '租户ID',
  asset_id INT NOT NULL COMMENT '关联资产ID',
  
  -- 特种设备信息
  equipment_type ENUM('pressure_vessel', 'elevator', 'crane', 'forklift', 'pressure_pipeline', 'boiler', 'medical_radiation', 'oxygen_chamber') NOT NULL COMMENT '设备类型',
  equipment_category VARCHAR(100) COMMENT '设备类别',
  
  -- 注册信息
  registration_no VARCHAR(100) COMMENT '使用登记证编号',
  registration_date DATE COMMENT '注册登记日期',
  registrant VARCHAR(200) COMMENT '注册机构',
  
  -- 制造信息
  manufacturer_license_no VARCHAR(100) COMMENT '制造许可证编号',
  product_serial_no VARCHAR(100) COMMENT '产品出厂编号',
  manufacturing_date DATE COMMENT '制造日期',
  
  -- 检验信息
  first_inspection_date DATE COMMENT '首次检验日期',
  last_inspection_date DATE COMMENT '上次检验日期',
  next_inspection_date DATE COMMENT '下次检验日期',
  inspection_cycle_months INT COMMENT '检验周期(月)',
  inspection_result ENUM('qualified', 'unqualified', 'conditional') COMMENT '检验结论',
  inspection_certificate_no VARCHAR(100) COMMENT '检验证书编号',
  
  -- 安全附件
  safety_valve_info JSON COMMENT '安全阀信息',
  pressure_gauge_info JSON COMMENT '压力表信息',
  
  -- 状态
  use_status ENUM('in_use', 'suspended', 'scrapped', 'transferred') DEFAULT 'in_use' COMMENT '使用状态',
  
  -- 责任人
  safety_manager VARCHAR(100) COMMENT '安全管理人员',
  operator_certificate_no VARCHAR(100) COMMENT '作业人员证书编号',
  
  remarks TEXT COMMENT '备注',
  created_by INT COMMENT '创建人',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_tenant_asset (tenant_id, asset_id),
  INDEX idx_type (equipment_type),
  INDEX idx_next_inspection (next_inspection_date),
  INDEX idx_status (use_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='特种设备表';

-- -----------------------------------------------------
-- 9. 特种设备检验记录表
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS special_equipment_inspections (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL COMMENT '租户ID',
  equipment_id INT NOT NULL COMMENT '特种设备ID',
  
  -- 检验信息
  inspection_type ENUM('regular', 'annual', 'comprehensive') NOT NULL COMMENT '检验类型',
  inspection_date DATE NOT NULL COMMENT '检验日期',
  inspection_agency VARCHAR(200) COMMENT '检验机构',
  inspector VARCHAR(100) COMMENT '检验人员',
  
  -- 检验项目
  inspection_items JSON COMMENT '检验项目',
  inspection_content TEXT COMMENT '检验内容',
  
  -- 检验结果
  inspection_result ENUM('qualified', 'unqualified', 'conditional') NOT NULL COMMENT '检验结论',
  issues_found TEXT COMMENT '发现问题',
  rectification_measures TEXT COMMENT '整改措施',
  rectification_deadline DATE COMMENT '整改期限',
  rectification_completed_date DATE COMMENT '整改完成日期',
  
  -- 证书
  certificate_no VARCHAR(100) COMMENT '检验证书编号',
  certificate_image VARCHAR(500) COMMENT '证书图片',
  
  -- 下次检验
  next_inspection_date DATE COMMENT '下次检验日期',
  
  remarks TEXT COMMENT '备注',
  created_by INT COMMENT '记录人',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_equipment (equipment_id),
  INDEX idx_date (inspection_date),
  INDEX idx_next (next_inspection_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='特种设备检验记录表';

-- -----------------------------------------------------
-- 10. 安全检测表 (电气安全、辐射安全)
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS safety_inspections (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL COMMENT '租户ID',
  asset_id INT NOT NULL COMMENT '资产ID',
  
  -- 检测信息
  inspection_type ENUM('electrical', 'radiation', 'biological', 'mechanical', 'other') NOT NULL COMMENT '检测类型',
  inspection_category VARCHAR(100) COMMENT '检测类别',
  inspection_name VARCHAR(200) NOT NULL COMMENT '检测项目名称',
  
  -- 检测标准
  inspection_standard VARCHAR(200) COMMENT '检测标准',
  standard_code VARCHAR(100) COMMENT '标准编号',
  
  -- 时间
  inspection_date DATE NOT NULL COMMENT '检测日期',
  inspection_cycle_months INT COMMENT '检测周期(月)',
  next_inspection_date DATE COMMENT '下次检测日期',
  
  -- 检测机构和人员
  inspection_agency VARCHAR(200) COMMENT '检测机构',
  inspector VARCHAR(100) COMMENT '检测人员',
  
  -- 检测结果
  inspection_result ENUM('qualified', 'unqualified', 'conditional') NOT NULL COMMENT '检测结论',
  inspection_items JSON COMMENT '检测项目明细',
  inspection_data JSON COMMENT '检测数据',
  
  -- 问题与整改
  issues_found TEXT COMMENT '发现问题',
  risk_level ENUM('high', 'medium', 'low') COMMENT '风险等级',
  rectification_required BOOLEAN DEFAULT FALSE COMMENT '是否需要整改',
  rectification_measures TEXT COMMENT '整改措施',
  rectification_deadline DATE COMMENT '整改期限',
  rectification_completed_date DATE COMMENT '整改完成日期',
  rectification_result VARCHAR(50) COMMENT '整改结果',
  
  -- 证书
  certificate_no VARCHAR(100) COMMENT '检测证书编号',
  certificate_image VARCHAR(500) COMMENT '证书图片',
  report_file VARCHAR(500) COMMENT '检测报告文件',
  
  remarks TEXT COMMENT '备注',
  created_by INT COMMENT '记录人',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_tenant_asset (tenant_id, asset_id),
  INDEX idx_type (inspection_type),
  INDEX idx_date (inspection_date),
  INDEX idx_next (next_inspection_date),
  INDEX idx_result (inspection_result)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='安全检测表';

-- -----------------------------------------------------
-- 初始化数据
-- -----------------------------------------------------

-- 插入默认的分级保养模板
INSERT INTO maintenance_level_templates (
  tenant_id, template_code, template_name, maintenance_level, 
  cycle_days, cycle_type, maintenance_items, created_by
) VALUES 
(1, 'DAILY-001', '日常保养模板', 'daily', 1, 'day', 
 '[{"item": "清洁设备表面", "standard": "无灰尘、无污渍"}, {"item": "检查电源线", "standard": "无破损、连接牢固"}, {"item": "检查运行状态", "standard": "运行正常、无异常声响"}]',
 1),
(1, 'LV1-001', '一级保养模板', 'level1', 7, 'week', 
 '[{"item": "清洁设备内外", "standard": "内外清洁无尘"}, {"item": "检查紧固件", "standard": "螺丝无松动"}, {"item": "润滑运动部件", "standard": "润滑良好"}]',
 1),
(1, 'LV2-001', '二级保养模板', 'level2', 30, 'month', 
 '[{"item": "全面清洁", "standard": "彻底清洁各部件"}, {"item": "检查电气系统", "standard": "接线牢固、绝缘良好"}, {"item": "校准精度", "standard": "精度符合标准"}]',
 1),
(1, 'LV3-001', '三级保养模板', 'level3', 90, 'quarter', 
 '[{"item": "全面检查", "standard": "各系统全面检查"}, {"item": "更换易损件", "standard": "更换到期易损件"}, {"item": "性能测试", "standard": "性能达标"}]',
 1);

-- 添加表注释
SELECT '分级保养和合规性表结构创建完成' AS message;
