-- ==========================================
-- 创建缺失的模块数据库表
-- ==========================================

-- 资产风险管理模块表
CREATE TABLE IF NOT EXISTS risk_assessments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  asset_id INT NOT NULL COMMENT '资产ID',
  risk_level ENUM('low', 'medium', 'high', 'critical') NOT NULL COMMENT '风险等级',
  risk_score INT COMMENT '风险评分',
  assessment_date DATE NOT NULL COMMENT '评估日期',
  next_assessment_date DATE COMMENT '下次评估日期',
  assessor_id INT COMMENT '评估人ID',
  risk_factors TEXT COMMENT '风险因素',
  mitigation_measures TEXT COMMENT '缓解措施',
  status ENUM('active', 'mitigated', 'closed') DEFAULT 'active' COMMENT '状态',
  tenant_id INT DEFAULT 1 COMMENT '租户ID',
  created_at DATETIME,
  updated_at DATETIME,
  INDEX idx_asset_id (asset_id),
  INDEX idx_risk_level (risk_level),
  INDEX idx_tenant_id (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='风险评估表';

CREATE TABLE IF NOT EXISTS risk_controls (
  id INT PRIMARY KEY AUTO_INCREMENT,
  assessment_id INT NOT NULL COMMENT '评估ID',
  control_measure TEXT NOT NULL COMMENT '控制措施',
  responsible_person_id INT COMMENT '负责人ID',
  due_date DATE COMMENT '截止日期',
  completion_date DATE COMMENT '完成日期',
  status ENUM('pending', 'in_progress', 'completed') DEFAULT 'pending' COMMENT '状态',
  effectiveness_rating ENUM('excellent', 'good', 'fair', 'poor') COMMENT '效果评级',
  tenant_id INT DEFAULT 1 COMMENT '租户ID',
  created_at DATETIME,
  updated_at DATETIME,
  INDEX idx_assessment_id (assessment_id),
  INDEX idx_tenant_id (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='风险控制措施表';

-- 人员资质管理模块表
CREATE TABLE IF NOT EXISTS staff_qualifications (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL COMMENT '用户ID',
  qualification_type VARCHAR(100) NOT NULL COMMENT '资质类型',
  qualification_name VARCHAR(200) NOT NULL COMMENT '资质名称',
  certificate_number VARCHAR(100) COMMENT '证书编号',
  issue_date DATE NOT NULL COMMENT '颁发日期',
  expiry_date DATE COMMENT '到期日期',
  issuing_authority VARCHAR(200) COMMENT '颁发机构',
  attachment_url VARCHAR(500) COMMENT '证书附件',
  status ENUM('active', 'expired', 'revoked') DEFAULT 'active' COMMENT '状态',
  tenant_id INT DEFAULT 1 COMMENT '租户ID',
  created_at DATETIME,
  updated_at DATETIME,
  INDEX idx_user_id (user_id),
  INDEX idx_expiry_date (expiry_date),
  INDEX idx_tenant_id (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='人员资质表';

CREATE TABLE IF NOT EXISTS training_records (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL COMMENT '用户ID',
  training_name VARCHAR(200) NOT NULL COMMENT '培训名称',
  training_type VARCHAR(100) COMMENT '培训类型',
  training_date DATE NOT NULL COMMENT '培训日期',
  duration_hours INT COMMENT '培训时长(小时)',
  training_provider VARCHAR(200) COMMENT '培训机构',
  trainer VARCHAR(100) COMMENT '培训师',
  certificate_number VARCHAR(100) COMMENT '证书编号',
  attachment_url VARCHAR(500) COMMENT '附件',
  tenant_id INT DEFAULT 1 COMMENT '租户ID',
  created_at DATETIME,
  updated_at DATETIME,
  INDEX idx_user_id (user_id),
  INDEX idx_training_date (training_date),
  INDEX idx_tenant_id (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='培训记录表';

CREATE TABLE IF NOT EXISTS assessment_records (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL COMMENT '用户ID',
  assessment_name VARCHAR(200) NOT NULL COMMENT '考核名称',
  assessment_type VARCHAR(100) COMMENT '考核类型',
  assessment_date DATE NOT NULL COMMENT '考核日期',
  score DECIMAL(5,2) COMMENT '得分',
  result ENUM('pass', 'fail', 'excellent') COMMENT '结果',
  evaluator_id INT COMMENT '考核人ID',
  comments TEXT COMMENT '评语',
  tenant_id INT DEFAULT 1 COMMENT '租户ID',
  created_at DATETIME,
  updated_at DATETIME,
  INDEX idx_user_id (user_id),
  INDEX idx_assessment_date (assessment_date),
  INDEX idx_tenant_id (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='考核记录表';

-- 开机率管理模块表
CREATE TABLE IF NOT EXISTS uptime_statistics (
  id INT PRIMARY KEY AUTO_INCREMENT,
  asset_id INT NOT NULL COMMENT '资产ID',
  device_type ENUM('life_support', 'large_equipment', 'regular_equipment') NOT NULL COMMENT '设备类型',
  statistics_date DATE NOT NULL COMMENT '统计日期',
  planned_hours INT NOT NULL COMMENT '计划运行小时数',
  actual_hours INT NOT NULL COMMENT '实际运行小时数',
  downtime_hours INT DEFAULT 0 COMMENT '停机小时数',
  uptime_rate DECIMAL(5,2) COMMENT '开机率(%)',
  downtime_reason TEXT COMMENT '停机原因',
  tenant_id INT DEFAULT 1 COMMENT '租户ID',
  created_at DATETIME,
  updated_at DATETIME,
  INDEX idx_asset_id (asset_id),
  INDEX idx_statistics_date (statistics_date),
  INDEX idx_device_type (device_type),
  INDEX idx_tenant_id (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='开机率统计表';

CREATE TABLE IF NOT EXISTS operation_logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  asset_id INT NOT NULL COMMENT '资产ID',
  operation_type ENUM('start', 'stop', 'maintenance', 'fault') NOT NULL COMMENT '操作类型',
  operation_time DATETIME NOT NULL COMMENT '操作时间',
  operator_id INT COMMENT '操作人ID',
  start_time DATETIME COMMENT '开机时间',
  end_time DATETIME COMMENT '关机时间',
  duration_minutes INT COMMENT '运行时长(分钟)',
  notes TEXT COMMENT '备注',
  tenant_id INT DEFAULT 1 COMMENT '租户ID',
  created_at DATETIME,
  updated_at DATETIME,
  INDEX idx_asset_id (asset_id),
  INDEX idx_operation_time (operation_time),
  INDEX idx_tenant_id (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT '设备运行记录表';

-- 不良事件管理模块表
CREATE TABLE IF NOT EXISTS adverse_events (
  id INT PRIMARY KEY AUTO_INCREMENT,
  event_code VARCHAR(50) NOT NULL COMMENT '事件编号',
  asset_id INT COMMENT '关联资产ID',
  event_type VARCHAR(100) NOT NULL COMMENT '事件类型',
  severity_level ENUM('minor', 'moderate', 'serious', 'critical') NOT NULL COMMENT '严重程度',
  occurrence_date DATETIME NOT NULL COMMENT '发生时间',
  discovery_date DATETIME COMMENT '发现时间',
  reporter_id INT NOT NULL COMMENT '报告人ID',
  description TEXT NOT NULL COMMENT '事件描述',
  immediate_action TEXT COMMENT '立即采取措施',
  status ENUM('reported', 'investigating', 'processing', 'closed') DEFAULT 'reported' COMMENT '状态',
  root_cause TEXT COMMENT '根本原因',
  corrective_action TEXT COMMENT '纠正措施',
  preventive_action TEXT COMMENT '预防措施',
  closed_date DATE COMMENT '关闭日期',
  closed_by INT COMMENT '关闭人ID',
  tenant_id INT DEFAULT 1 COMMENT '租户ID',
  created_at DATETIME,
  updated_at DATETIME,
  UNIQUE KEY uk_event_code (event_code),
  INDEX idx_asset_id (asset_id),
  INDEX idx_severity (severity_level),
  INDEX idx_status (status),
  INDEX idx_tenant_id (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='不良事件表';

-- ============================================================
-- 历史「采购管理」表（已合入 tendering-management，本段保留只读 RO 视图）
-- 历史数据迁移：tendring-management/migrations/009 + scripts/migrate-procurement-to-tendering.js
-- 不要再以本段初始化采购管理表！
-- ============================================================
-- 已合并：原 procurement_requests / procurement_files 已被 tender_projects / tender_files 取代
-- 仅保留只读追溯视图（兼容未完成迁移的环境）
DROP TABLE IF EXISTS procurement_requests_legacy_ro;
CREATE VIEW procurement_requests_legacy_ro AS
SELECT
  id, migrated_to_tender_id, request_code, title, request_type, request_date,
  requester_id, department_id, budget_amount, currency, description, justification,
  status, approver_id, approval_date, approval_comments, tenant_id,
  created_at, updated_at
FROM procurement_requests
WHERE migrated_to_tender_id IS NOT NULL;
-- 数据迁移完成后，旧 procurement_requests 表删除由迁移脚本（脚本中保留 -backup 表）保障

-- 盘点管理模块表
CREATE TABLE IF NOT EXISTS inventory_plans (
  id INT PRIMARY KEY AUTO_INCREMENT,
  plan_code VARCHAR(50) NOT NULL COMMENT '计划编号',
  plan_name VARCHAR(200) NOT NULL COMMENT '计划名称',
  plan_type ENUM('full', 'partial', 'random') NOT NULL COMMENT '盘点类型',
  start_date DATE NOT NULL COMMENT '开始日期',
  end_date DATE NOT NULL COMMENT '结束日期',
  department_scope TEXT COMMENT '盘点范围(部门列表)',
  category_scope TEXT COMMENT '盘点范围(资产类别)',
  responsible_person_id INT NOT NULL COMMENT '负责人ID',
  description TEXT COMMENT '计划说明',
  status ENUM('planned', 'in_progress', 'completed', 'cancelled') DEFAULT 'planned' COMMENT '状态',
  completion_date DATE COMMENT '完成日期',
  tenant_id INT DEFAULT 1 COMMENT '租户ID',
  created_at DATETIME,
  updated_at DATETIME,
  UNIQUE KEY uk_plan_code (plan_code),
  INDEX idx_status (status),
  INDEX idx_tenant_id (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='盘点计划表';

CREATE TABLE IF NOT EXISTS inventory_tasks (
  id INT PRIMARY KEY AUTO_INCREMENT,
  plan_id INT NOT NULL COMMENT '计划ID',
  asset_id INT NOT NULL COMMENT '资产ID',
  assigned_to INT COMMENT '分配给',
  expected_location VARCHAR(200) COMMENT '预期位置',
  actual_location VARCHAR(200) COMMENT '实际位置',
  inventory_status ENUM('pending', 'found', 'missing', 'moved') DEFAULT 'pending' COMMENT '盘点状态',
  inventory_result ENUM('normal', 'abnormal') COMMENT '盘点结果',
  exception_description TEXT COMMENT '异常描述',
  inventory_time DATETIME COMMENT '盘点时间',
  confirmed_by INT COMMENT '确认人ID',
  confirmed_time DATETIME COMMENT '确认时间',
  tenant_id INT DEFAULT 1 COMMENT '租户ID',
  created_at DATETIME,
  updated_at DATETIME,
  INDEX idx_plan_id (plan_id),
  INDEX idx_asset_id (asset_id),
  INDEX idx_inventory_status (inventory_status),
  INDEX idx_tenant_id (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='盘点任务表';

-- IoT设备管理模块表
CREATE TABLE IF NOT EXISTS iot_devices (
  id INT PRIMARY KEY AUTO_INCREMENT,
  device_code VARCHAR(50) NOT NULL COMMENT '设备编码',
  device_name VARCHAR(200) NOT NULL COMMENT '设备名称',
  device_type VARCHAR(100) NOT NULL COMMENT '设备类型',
  protocol VARCHAR(50) COMMENT '通信协议(mqtt/http/coap)',
  asset_id INT COMMENT '关联资产ID',
  manufacturer VARCHAR(100) COMMENT '制造商',
  model VARCHAR(100) COMMENT '型号',
  serial_number VARCHAR(100) COMMENT '序列号',
  ip_address VARCHAR(50) COMMENT 'IP地址',
  mac_address VARCHAR(50) COMMENT 'MAC地址',
  status ENUM('online', 'offline', 'error', 'maintenance') DEFAULT 'offline' COMMENT '状态',
  last_heartbeat DATETIME COMMENT '最后心跳时间',
  config TEXT COMMENT '设备配置',
  tenant_id INT DEFAULT 1 COMMENT '租户ID',
  created_at DATETIME,
  updated_at DATETIME,
  UNIQUE KEY uk_device_code (device_code),
  INDEX idx_asset_id (asset_id),
  INDEX idx_status (status),
  INDEX idx_tenant_id (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='IoT设备表';

CREATE TABLE IF NOT EXISTS iot_data_points (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  device_id INT NOT NULL COMMENT '设备ID',
  data_type VARCHAR(50) NOT NULL COMMENT '数据类型',
  metric_name VARCHAR(100) NOT NULL COMMENT '指标名称',
  metric_value DECIMAL(18,4) NOT NULL COMMENT '指标值',
  unit VARCHAR(20) COMMENT '单位',
  collected_at DATETIME NOT NULL COMMENT '采集时间',
  tenant_id INT DEFAULT 1 COMMENT '租户ID',
  INDEX idx_device_id (device_id),
  INDEX idx_metric_name (metric_name),
  INDEX idx_collected_at (collected_at),
  INDEX idx_tenant_id (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='IoT数据点表';

CREATE TABLE IF NOT EXISTS environment_monitoring (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  device_id INT NOT NULL COMMENT '设备ID',
  location VARCHAR(200) COMMENT '位置',
  temperature DECIMAL(5,2) COMMENT '温度(°C)',
  humidity DECIMAL(5,2) COMMENT '湿度(%)',
  pressure DECIMAL(8,2) COMMENT '气压(hPa)',
  pm25 DECIMAL(6,2) COMMENT 'PM2.5',
  co2 DECIMAL(8,2) COMMENT 'CO2浓度',
  other_metrics TEXT COMMENT '其他指标(JSON格式)',
  alert_status ENUM('normal', 'warning', 'critical') DEFAULT 'normal' COMMENT '告警状态',
  monitored_at DATETIME NOT NULL COMMENT '监测时间',
  tenant_id INT DEFAULT 1 COMMENT '租户ID',
  INDEX idx_device_id (device_id),
  INDEX idx_alert_status (alert_status),
  INDEX idx_monitored_at (monitored_at),
  INDEX idx_tenant_id (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='环境监测表';

-- 计量管理模块表
CREATE TABLE IF NOT EXISTS metrology_devices (
  id INT PRIMARY KEY AUTO_INCREMENT,
  device_code VARCHAR(50) NOT NULL COMMENT '设备编码',
  device_name VARCHAR(200) NOT NULL COMMENT '设备名称',
  device_type VARCHAR(100) NOT NULL COMMENT '设备类型',
  asset_id INT COMMENT '关联资产ID',
  measurement_range VARCHAR(100) COMMENT '测量范围',
  accuracy_class VARCHAR(50) COMMENT '精度等级',
  manufacturer VARCHAR(100) COMMENT '制造商',
  serial_number VARCHAR(100) COMMENT '序列号',
  verification_cycle INT DEFAULT 12 COMMENT '检定周期(月)',
  last_verification_date DATE COMMENT '上次检定日期',
  next_verification_date DATE COMMENT '下次检定日期',
  status ENUM('normal', 'expired', 'pending', 'disabled') DEFAULT 'normal' COMMENT '状态',
  certificate_number VARCHAR(100) COMMENT '证书编号',
  tenant_id INT DEFAULT 1 COMMENT '租户ID',
  created_at DATETIME,
  updated_at DATETIME,
  UNIQUE KEY uk_device_code (device_code),
  INDEX idx_asset_id (asset_id),
  INDEX idx_next_verification (next_verification_date),
  INDEX idx_status (status),
  INDEX idx_tenant_id (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='计量器具表';

CREATE TABLE IF NOT EXISTS metrology_records (
  id INT PRIMARY KEY AUTO_INCREMENT,
  device_id INT NOT NULL COMMENT '器具ID',
  verification_type ENUM('verification', 'calibration', 'inspection') NOT NULL COMMENT '检定类型',
  verification_date DATE NOT NULL COMMENT '检定日期',
  verification_org VARCHAR(200) COMMENT '检定机构',
  verifier VARCHAR(100) COMMENT '检定员',
  result ENUM('pass', 'fail', 'conditional') NOT NULL COMMENT '检定结果',
  certificate_number VARCHAR(100) COMMENT '证书编号',
  certificate_url VARCHAR(500) COMMENT '证书URL',
  cost DECIMAL(10,2) COMMENT '费用',
  next_date DATE COMMENT '下次检定日期',
  notes TEXT COMMENT '备注',
  tenant_id INT DEFAULT 1 COMMENT '租户ID',
  created_at DATETIME,
  updated_at DATETIME,
  INDEX idx_device_id (device_id),
  INDEX idx_verification_date (verification_date),
  INDEX idx_result (result),
  INDEX idx_tenant_id (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='计量记录表';
