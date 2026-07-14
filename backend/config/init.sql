-- 创建数据库（如果不存在）
CREATE DATABASE IF NOT EXISTS zcgl CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE zcgl;

-- 资产分类表
CREATE TABLE IF NOT EXISTS asset_categories (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL DEFAULT 1 COMMENT '租户ID',
  name VARCHAR(100) NOT NULL COMMENT '分类名称',
  code VARCHAR(50) UNIQUE NOT NULL COMMENT '分类编码',
  parent_id INT DEFAULT 0 COMMENT '父分类ID',
  description TEXT COMMENT '分类描述',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='资产分类表';

-- 资产主表
CREATE TABLE IF NOT EXISTS assets (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL DEFAULT 1 COMMENT '租户ID',
  asset_code VARCHAR(100) NOT NULL COMMENT '资产编号（主编号）',
  code VARCHAR(100) COMMENT '原始编码code',
  code2 VARCHAR(100) COMMENT '原始编码code2',
  code3 VARCHAR(100) COMMENT '原始编码code3',
  asset_name VARCHAR(200) NOT NULL COMMENT '资产名称',
  category_id INT NOT NULL COMMENT '分类ID',
  asset_type ENUM('医疗设备', '普通设备', '房产建筑', '办公家具', '其他') NOT NULL COMMENT '资产类型',
  brand VARCHAR(100) COMMENT '品牌',
  model VARCHAR(100) COMMENT '型号',
  specification TEXT COMMENT '规格参数',
  purchase_date DATE COMMENT '购置日期',
  purchase_price DECIMAL(15, 2) COMMENT '购置价格',
  current_value DECIMAL(15, 2) COMMENT '当前价值',
  depreciation_method VARCHAR(50) COMMENT '折旧方式',
  depreciation_years INT COMMENT '折旧年限',
  location VARCHAR(200) COMMENT '存放位置',
  department VARCHAR(100) COMMENT '使用部门',
  unit VARCHAR(200) COMMENT '单位',
  responsible_person VARCHAR(50) COMMENT '责任人',
  status ENUM('在用', '闲置', '维修', '报废', '调配中') DEFAULT '在用' COMMENT '资产状态',
  supplier VARCHAR(200) COMMENT '供应商',
  data_id VARCHAR(100) COMMENT '数据标识',
  original_created_at DATETIME COMMENT '原始创建时间',
  warranty_period INT COMMENT '保修期（月）',
  warranty_end_date DATE COMMENT '保修到期日',
  remark TEXT COMMENT '备注',
  department_new VARCHAR(100) COMMENT '使用部门（编码）',
  is_deleted TINYINT(1) DEFAULT 0 COMMENT '是否删除：0-正常，1-已删除',
  deleted_at TIMESTAMP NULL DEFAULT NULL COMMENT '删除时间',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL,
  created_by VARCHAR(50) COMMENT '创建人',
  updated_by VARCHAR(50) COMMENT '更新人',
  INDEX idx_category (category_id),
  INDEX idx_type (asset_type),
  INDEX idx_status (status),
  INDEX idx_department (department),
  INDEX idx_asset_code (asset_code),
  -- 租户相关索引
  INDEX idx_tenant (tenant_id),
  INDEX idx_tenant_status (tenant_id, status),
  INDEX idx_tenant_department (tenant_id, department_new),
  INDEX idx_tenant_category (tenant_id, category_id),
  INDEX idx_tenant_asset_code (tenant_id, asset_code),
  INDEX idx_tenant_status_deleted (tenant_id, status, is_deleted),
  INDEX idx_asset_code_prefix (asset_code(20)),
  -- 多租户 UNIQUE 约束：同租户内 asset_code 不可重复，跨租户允许
  -- 修复前是 asset_code UNIQUE（全局唯一），导致不同租户无法使用相同编号
  UNIQUE KEY uk_tenant_asset_code (tenant_id, asset_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='资产主表';

-- 资产盘点表
CREATE TABLE IF NOT EXISTS inventory_records (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL DEFAULT 1 COMMENT '租户ID',
  inventory_no VARCHAR(100) UNIQUE NOT NULL COMMENT '盘点单号',
  inventory_date DATE NOT NULL COMMENT '盘点日期',
  inventory_type ENUM('全面盘点', '抽查盘点', '专项盘点') NOT NULL COMMENT '盘点类型',
  inventory_person VARCHAR(50) NOT NULL COMMENT '盘点人',
  status ENUM('进行中', '已完成', '已取消') DEFAULT '进行中' COMMENT '盘点状态',
  remark TEXT COMMENT '备注',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='盘点记录表';

-- 盘点明细表
CREATE TABLE IF NOT EXISTS inventory_details (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL DEFAULT 1 COMMENT '租户ID',
  inventory_id INT NOT NULL COMMENT '盘点单ID',
  asset_code VARCHAR(100) NOT NULL COMMENT '资产编号',
  expected_location VARCHAR(200) COMMENT '预期位置',
  actual_location VARCHAR(200) COMMENT '实际位置',
  expected_status VARCHAR(50) COMMENT '预期状态',
  actual_status VARCHAR(50) COMMENT '实际状态',
  discrepancy_type ENUM('正常', '位置不符', '状态不符', '缺失', '多余') DEFAULT '正常' COMMENT '差异类型',
  discrepancy_desc TEXT COMMENT '差异说明',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_inventory (inventory_id),
  INDEX idx_asset_code (asset_code),
  FOREIGN KEY (inventory_id) REFERENCES inventory_records(id) ON DELETE CASCADE,
  FOREIGN KEY (asset_code) REFERENCES assets(asset_code) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='盘点明细表';

-- 资产调配表
CREATE TABLE IF NOT EXISTS transfer_records (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL DEFAULT 1 COMMENT '租户ID',
  transfer_no VARCHAR(100) UNIQUE NOT NULL COMMENT '调配单号',
  asset_code VARCHAR(100) NOT NULL COMMENT '资产编号',
  from_department VARCHAR(100) NOT NULL COMMENT '调出部门',
  to_department VARCHAR(100) NOT NULL COMMENT '调入部门',
  from_location VARCHAR(200) COMMENT '调出位置',
  to_location VARCHAR(200) COMMENT '调入位置',
  from_person VARCHAR(50) COMMENT '调出责任人',
  to_person VARCHAR(50) COMMENT '调入责任人',
  transfer_date DATE NOT NULL COMMENT '调配日期',
  transfer_reason TEXT COMMENT '调配原因',
  status ENUM('待审批', '已批准', '已完成', '已取消') DEFAULT '待审批' COMMENT '调配状态',
  approver VARCHAR(50) COMMENT '审批人',
  approve_date DATE COMMENT '审批日期',
  remark TEXT COMMENT '备注',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL,
  created_by VARCHAR(50) COMMENT '创建人',
  INDEX idx_asset_code (asset_code),
  INDEX idx_status (status),
  FOREIGN KEY (asset_code) REFERENCES assets(asset_code) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='资产调配表';

-- 闲置资产发布表
CREATE TABLE IF NOT EXISTS idle_assets (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_id INT NOT NULL DEFAULT 1 COMMENT '租户ID',
  asset_id INT NOT NULL COMMENT '资产ID',
  publish_date DATE NOT NULL COMMENT '发布日期',
  publish_person VARCHAR(50) NOT NULL COMMENT '发布人',
  expected_use VARCHAR(200) COMMENT '用途',
  contact_person VARCHAR(50) COMMENT '联系人',
  contact_phone VARCHAR(20) COMMENT '联系电话',
  status ENUM('发布中', '已分配', '已取消') DEFAULT '发布中' COMMENT '发布状态',
  allocated_to VARCHAR(100) COMMENT '分配对象',
  allocated_date DATE COMMENT '分配日期',
  remark TEXT COMMENT '备注',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT NULL,
  INDEX idx_asset (asset_id),
  INDEX idx_status (status),
  FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='闲置资产发布表';

-- 插入初始分类数据
INSERT INTO asset_categories (name, code, parent_id, description) VALUES
('医疗设备', 'YL', 0, '医院医疗设备分类'),
('普通设备', 'PT', 0, '普通设备分类'),
('房产建筑', 'FC', 0, '房产建筑分类'),
('办公家具', 'BG', 0, '办公家具分类'),
('医疗影像设备', 'YL-01', 1, 'CT、MRI、X光机等'),
('生命支持设备', 'YL-02', 1, '呼吸机、监护仪等'),
('检验设备', 'YL-03', 1, '生化分析仪、血球仪等'),
('办公设备', 'PT-01', 2, '电脑、打印机等'),
('车辆', 'PT-02', 2, '各类车辆'),
('建筑物', 'FC-01', 3, '各类建筑物'),
('土地', 'FC-02', 3, '土地资产'),
('办公桌椅', 'BG-01', 4, '办公桌椅'),
('文件柜', 'BG-02', 4, '文件柜、储物柜');

-- 操作日志表（审计）
CREATE TABLE IF NOT EXISTS audit_logs (
  id INT NOT NULL AUTO_INCREMENT,
  tenant_id INT DEFAULT NULL,
  user_id INT DEFAULT NULL COMMENT '用户ID',
  username VARCHAR(50) DEFAULT NULL COMMENT '用户名',
  real_name VARCHAR(50) DEFAULT NULL COMMENT '真实姓名',
  role VARCHAR(50) DEFAULT NULL COMMENT '用户角色',
  action_type VARCHAR(50) NOT NULL COMMENT '操作类型（create, update, delete, login, logout, view, export, import等）',
  module VARCHAR(50) NOT NULL COMMENT '操作模块（assets, users, technical-documents, maintenance等）',
  resource_type VARCHAR(50) DEFAULT NULL COMMENT '资源类型（asset, user, document等）',
  resource_id INT DEFAULT NULL COMMENT '资源ID',
  resource_name VARCHAR(200) DEFAULT NULL COMMENT '资源名称',
  action_description TEXT COMMENT '操作描述',
  old_value TEXT COMMENT '修改前的值（JSON格式）',
  new_value TEXT COMMENT '修改后的值（JSON格式）',
  ip_address VARCHAR(50) DEFAULT NULL COMMENT 'IP地址',
  user_agent TEXT COMMENT '浏览器User Agent',
  request_method VARCHAR(10) DEFAULT NULL COMMENT 'HTTP方法',
  request_path VARCHAR(500) DEFAULT NULL COMMENT '请求路径',
  request_params TEXT COMMENT '请求参数（JSON格式）',
  response_status INT DEFAULT NULL COMMENT '响应状态码',
  error_message TEXT COMMENT '错误信息',
  execution_time INT DEFAULT NULL COMMENT '执行时间（毫秒）',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (id),
  KEY idx_username (username),
  KEY idx_action_type (action_type),
  KEY idx_module (module),
  KEY idx_resource_type (resource_type),
  KEY idx_resource_id (resource_id),
  KEY idx_audit_logs_tenant (tenant_id),
  KEY idx_audit_logs_user (user_id),
  KEY idx_audit_logs_created (created_at),
  KEY idx_audit_logs_time_user (tenant_id, created_at, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='操作日志表（审计）';

-- 权限变更审计日志表
CREATE TABLE IF NOT EXISTS permission_audit_logs (
  id BIGINT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL COMMENT '操作用户ID',
  tenant_id INT NOT NULL COMMENT '租户ID',
  action VARCHAR(50) NOT NULL COMMENT '操作类型: grant/deny/revoke/change_scope',
  target_type VARCHAR(20) NOT NULL COMMENT '目标类型: role/user',
  target_id VARCHAR(100) NOT NULL COMMENT '目标ID',
  permission VARCHAR(100) DEFAULT NULL COMMENT '权限代码',
  old_value TEXT COMMENT '旧值',
  new_value TEXT COMMENT '新值',
  ip_address VARCHAR(45) DEFAULT NULL COMMENT 'IP地址',
  user_agent TEXT COMMENT 'User Agent',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_user_id (user_id),
  KEY idx_tenant_id (tenant_id),
  KEY idx_target (target_type, target_id),
  KEY idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='权限变更审计日志表';

