-- 插入新增模块到 system_modules 表
-- 模块化目标：特种设备 / 安全检测 / 风险管理均可独立启停，降低与非核心模块耦合

-- 模块1: 合规性管理（仅保留分级保养）
INSERT INTO system_modules (
  id, name, version, description, category, type, status, author,
  dependencies, frontend_config, backend_config, config_schema, default_config
) VALUES (
  'compliance-management',
  '合规性管理',
  '1.0.0',
  '医学装备整体运维管理服务规范中的合规核心模块，聚焦分级保养策略与计划治理',
  '质量与合规',
  'system',
  'stable',
  'System Team',
  '[{"module_id": "asset-management", "dependency_type": "required", "min_version": "1.0.0"}, {"module_id": "user-management", "dependency_type": "required", "min_version": "1.0.0"}]',
  '{"menu_keys": ["/compliance", "/compliance/maintenance-level"], "menu_routes": [{"key": "/compliance", "icon": "SafetyCertificateOutlined", "label": "合规性管理", "path": "/compliance", "component": "ComplianceDashboard", "permissions": ["compliance:read"]}, {"key": "/compliance/maintenance-level", "icon": "ToolOutlined", "label": "分级保养", "path": "/compliance/maintenance-level", "component": "MaintenanceLevelManagement", "permissions": ["compliance:maintenance:read"]}], "permissions": ["compliance:read", "compliance:maintenance:read", "compliance:maintenance:create", "compliance:maintenance:update", "compliance:maintenance:delete"]}',
  '{"api_prefix": "/api/compliance", "routes_path": "routes", "database_tables": ["maintenance_level_templates", "maintenance_level_plans"]}',
  '[{"key": "maintenance_level_enabled", "name": "启用分级保养", "type": "boolean", "default": true}, {"key": "enable_auto_plan_generation", "name": "自动生成保养计划", "type": "boolean", "default": true}]',
  '{"maintenance_level_enabled": true, "enable_auto_plan_generation": true}'
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  version = VALUES(version),
  description = VALUES(description),
  category = VALUES(category),
  frontend_config = VALUES(frontend_config),
  backend_config = VALUES(backend_config),
  config_schema = VALUES(config_schema),
  default_config = VALUES(default_config),
  updated_at = CURRENT_TIMESTAMP;

-- 模块2: 特种设备管理（独立模块）
INSERT INTO system_modules (
  id, name, version, description, category, type, status, author,
  dependencies, frontend_config, backend_config, config_schema, default_config
) VALUES (
  'special-equipment-management',
  '特种设备管理',
  '1.0.0',
  '特种设备台账、检验记录、到期提醒与统计分析模块',
  '质量与安全',
  'system',
  'stable',
  'System Team',
  '[{"module_id": "asset-management", "dependency_type": "required", "min_version": "1.0.0"}, {"module_id": "user-management", "dependency_type": "required", "min_version": "1.0.0"}]',
  '{"menu_keys": ["/special-equipment"], "menu_routes": [{"key": "/special-equipment", "icon": "AlertOutlined", "label": "特种设备", "path": "/special-equipment", "component": "SpecialEquipmentManagement", "permissions": ["special_equipment:read"]}], "permissions": ["special_equipment:read", "special_equipment:create", "special_equipment:update", "special_equipment:delete", "special_equipment:inspection:read", "special_equipment:inspection:create", "special_equipment:inspection:update", "special_equipment:inspection:delete"]}',
  '{"api_prefix": "/api/special-equipment", "routes_path": "routes", "database_tables": ["special_equipment", "special_equipment_inspections"]}',
  '[{"key": "equipment_registry_enabled", "name": "启用设备台账", "type": "boolean", "default": true}, {"key": "inspection_records_enabled", "name": "启用检验记录", "type": "boolean", "default": true}, {"key": "default_inspection_reminder_days", "name": "检验提醒提前天数", "type": "number", "default": 90, "min": 1, "max": 365}]',
  '{"equipment_registry_enabled": true, "inspection_records_enabled": true, "default_inspection_reminder_days": 90}'
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  version = VALUES(version),
  description = VALUES(description),
  category = VALUES(category),
  frontend_config = VALUES(frontend_config),
  backend_config = VALUES(backend_config),
  config_schema = VALUES(config_schema),
  default_config = VALUES(default_config),
  updated_at = CURRENT_TIMESTAMP;

-- 模块3: 安全检测管理（独立模块）
INSERT INTO system_modules (
  id, name, version, description, category, type, status, author,
  dependencies, frontend_config, backend_config, config_schema, default_config
) VALUES (
  'safety-inspection-management',
  '安全检测管理',
  '1.0.0',
  '医疗设备电气、辐射、机械等安全检测记录与整改跟踪模块',
  '质量与安全',
  'system',
  'stable',
  'System Team',
  '[{"module_id": "asset-management", "dependency_type": "required", "min_version": "1.0.0"}, {"module_id": "user-management", "dependency_type": "required", "min_version": "1.0.0"}]',
  '{"menu_keys": ["/safety-inspection"], "menu_routes": [{"key": "/safety-inspection", "icon": "SafetyOutlined", "label": "安全检测", "path": "/safety-inspection", "component": "SafetyInspectionManagement", "permissions": ["safety_inspection:read"]}], "permissions": ["safety_inspection:read", "safety_inspection:create", "safety_inspection:update", "safety_inspection:delete"]}',
  '{"api_prefix": "/api/safety-inspection", "routes_path": "routes", "database_tables": ["safety_inspections"]}',
  '[{"key": "inspection_records_enabled", "name": "启用检测记录", "type": "boolean", "default": true}, {"key": "rectification_tracking_enabled", "name": "启用整改追踪", "type": "boolean", "default": true}, {"key": "default_expiring_days", "name": "到期提醒天数", "type": "number", "default": 30, "min": 1, "max": 365}]',
  '{"inspection_records_enabled": true, "rectification_tracking_enabled": true, "default_expiring_days": 30}'
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  version = VALUES(version),
  description = VALUES(description),
  category = VALUES(category),
  frontend_config = VALUES(frontend_config),
  backend_config = VALUES(backend_config),
  config_schema = VALUES(config_schema),
  default_config = VALUES(default_config),
  updated_at = CURRENT_TIMESTAMP;

-- 模块4: 开机率管理
INSERT INTO system_modules (
  id, name, version, description, category, type, status, author,
  dependencies, frontend_config, backend_config, config_schema, default_config
) VALUES (
  'uptime-management',
  '开机率管理',
  '1.0.0',
  '医疗设备开机率统计与分析模块，支持生命支持类、大型设备、常规设备分类统计',
  '分析与统计',
  'system',
  'stable',
  'System Team',
  '[{"module_id": "asset-management", "dependency_type": "required", "min_version": "1.0.0"}]',
  '{"menu_keys": ["/uptime", "/uptime/dashboard", "/uptime/operation-logs", "/uptime/statistics"], "menu_routes": [{"key": "/uptime", "icon": "PieChartOutlined", "label": "开机率管理", "path": "/uptime", "component": "UptimeDashboard", "permissions": ["uptime:read"]}, {"key": "/uptime/dashboard", "icon": "DashboardOutlined", "label": "开机率概览", "path": "/uptime/dashboard", "component": "UptimeOverview", "permissions": ["uptime:read"]}, {"key": "/uptime/operation-logs", "icon": "EditOutlined", "label": "运行记录", "path": "/uptime/operation-logs", "component": "OperationLogManagement", "permissions": ["uptime:log:read"]}, {"key": "/uptime/statistics", "icon": "BarChartOutlined", "label": "统计分析", "path": "/uptime/statistics", "component": "UptimeStatistics", "permissions": ["uptime:statistics:read"]}], "permissions": ["uptime:read", "uptime:log:read", "uptime:log:create", "uptime:statistics:read"]}',
  '{"api_prefix": "/api/uptime", "routes_path": "routes", "database_tables": ["asset_operation_logs", "asset_uptime_statistics"]}',
  '[{"key": "operation_log_enabled", "name": "启用运行记录", "type": "boolean", "default": true}, {"key": "auto_calculation_enabled", "name": "自动计算开机率", "type": "boolean", "default": true}, {"key": "life_support_uptime_threshold", "name": "生命支持类设备开机率阈值(%)", "type": "number", "default": 99, "min": 90, "max": 100}, {"key": "large_equipment_uptime_threshold", "name": "大型设备开机率阈值(%)", "type": "number", "default": 95, "min": 80, "max": 100}, {"key": "regular_equipment_uptime_threshold", "name": "常规设备开机率阈值(%)", "type": "number", "default": 95, "min": 80, "max": 100}]',
  '{"operation_log_enabled": true, "auto_calculation_enabled": true, "life_support_uptime_threshold": 99, "large_equipment_uptime_threshold": 95, "regular_equipment_uptime_threshold": 95}'
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  version = VALUES(version),
  description = VALUES(description),
  category = VALUES(category),
  frontend_config = VALUES(frontend_config),
  backend_config = VALUES(backend_config),
  config_schema = VALUES(config_schema),
  default_config = VALUES(default_config),
  updated_at = CURRENT_TIMESTAMP;

-- 模块5: 人员资质管理
INSERT INTO system_modules (
  id, name, version, description, category, type, status, author,
  dependencies, frontend_config, backend_config, config_schema, default_config
) VALUES (
  'staff-qualification',
  '人员资质管理',
  '1.0.0',
  '医学装备管理人员资质、培训记录、考核管理模块',
  '人力资源',
  'system',
  'stable',
  'System Team',
  '[{"module_id": "user-management", "dependency_type": "required", "min_version": "1.0.0"}]',
  '{"menu_keys": ["/staff", "/staff/qualifications", "/staff/training"], "menu_routes": [{"key": "/staff", "icon": "TeamOutlined", "label": "人员管理", "path": "/staff", "component": "StaffDashboard", "permissions": ["staff:read"]}, {"key": "/staff/qualifications", "icon": "IdcardOutlined", "label": "资质管理", "path": "/staff/qualifications", "component": "QualificationManagement", "permissions": ["staff:qualification:read"]}, {"key": "/staff/training", "icon": "BookOutlined", "label": "培训管理", "path": "/staff/training", "component": "TrainingManagement", "permissions": ["staff:training:read"]}], "permissions": ["staff:read", "staff:qualification:read", "staff:qualification:create", "staff:training:read", "staff:training:create"]}',
  '{"api_prefix": "/api/staff", "routes_path": "routes", "database_tables": ["staff_qualifications", "staff_training_records"]}',
  '[{"key": "qualification_management_enabled", "name": "启用资质管理", "type": "boolean", "default": true}, {"key": "training_management_enabled", "name": "启用培训管理", "type": "boolean", "default": true}, {"key": "qualification_reminder_days", "name": "资质到期提醒天数", "type": "number", "default": 90, "min": 7, "max": 365}]',
  '{"qualification_management_enabled": true, "training_management_enabled": true, "qualification_reminder_days": 90}'
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  version = VALUES(version),
  description = VALUES(description),
  category = VALUES(category),
  frontend_config = VALUES(frontend_config),
  backend_config = VALUES(backend_config),
  config_schema = VALUES(config_schema),
  default_config = VALUES(default_config),
  updated_at = CURRENT_TIMESTAMP;

-- 模块6: 风险管理（独立模块）
INSERT INTO system_modules (
  id, name, version, description, category, type, status, author,
  dependencies, frontend_config, backend_config, config_schema, default_config
) VALUES (
  'asset-risk-management',
  '风险管理',
  '1.0.0',
  '独立的医疗设备风险评估、风险分级、风险控制与预警管理模块',
  '质量与安全',
  'system',
  'stable',
  'System Team',
  '[{"module_id": "asset-management", "dependency_type": "required", "min_version": "1.0.0"}]',
  '{"menu_keys": ["/risk/dashboard", "/risk/assessment", "/risk/classification", "/risk/control"], "menu_routes": [{"key": "/risk/dashboard", "icon": "WarningOutlined", "label": "风险管理", "path": "/risk/dashboard", "component": "RiskDashboard", "permissions": ["risk:read"]}, {"key": "/risk/assessment", "icon": "SafetyOutlined", "label": "风险评估", "path": "/risk/assessment", "component": "RiskAssessment", "permissions": ["risk:assessment:read"]}, {"key": "/risk/classification", "icon": "ApartmentOutlined", "label": "风险分级", "path": "/risk/classification", "component": "RiskClassification", "permissions": ["risk:classification:read"]}, {"key": "/risk/control", "icon": "ControlOutlined", "label": "风险控制", "path": "/risk/control", "component": "RiskControl", "permissions": ["risk:control:read"]}], "permissions": ["risk:read", "risk:assessment:read", "risk:assessment:create", "risk:classification:read", "risk:control:read"]}',
  '{"api_prefix": "/api/risk", "routes_path": "routes", "database_tables": ["asset_risk_levels", "risk_control_measures", "risk_assessment_records"]}',
  '[{"key": "risk_assessment_enabled", "name": "启用风险评估", "type": "boolean", "default": true}, {"key": "auto_risk_classification", "name": "自动风险分级", "type": "boolean", "default": true}, {"key": "high_risk_threshold", "name": "高风险阈值", "type": "number", "default": 80, "min": 0, "max": 100}, {"key": "medium_risk_threshold", "name": "中风险阈值", "type": "number", "default": 50, "min": 0, "max": 100}]',
  '{"risk_assessment_enabled": true, "auto_risk_classification": true, "high_risk_threshold": 80, "medium_risk_threshold": 50}'
) ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  version = VALUES(version),
  description = VALUES(description),
  category = VALUES(category),
  frontend_config = VALUES(frontend_config),
  backend_config = VALUES(backend_config),
  config_schema = VALUES(config_schema),
  default_config = VALUES(default_config),
  updated_at = CURRENT_TIMESTAMP;

-- 为默认租户初始化模块配置（默认启用）
INSERT INTO tenant_module_configs (tenant_id, module_id, enabled, config, version) VALUES
(1, 'compliance-management', 1, '{"maintenance_level_enabled": true, "enable_auto_plan_generation": true}', '1.0.0'),
(1, 'special-equipment-management', 1, '{"equipment_registry_enabled": true, "inspection_records_enabled": true, "default_inspection_reminder_days": 90}', '1.0.0'),
(1, 'safety-inspection-management', 1, '{"inspection_records_enabled": true, "rectification_tracking_enabled": true, "default_expiring_days": 30}', '1.0.0'),
(1, 'uptime-management', 1, '{"operation_log_enabled": true, "auto_calculation_enabled": true, "life_support_uptime_threshold": 99, "large_equipment_uptime_threshold": 95, "regular_equipment_uptime_threshold": 95}', '1.0.0'),
(1, 'staff-qualification', 1, '{"qualification_management_enabled": true, "training_management_enabled": true, "qualification_reminder_days": 90}', '1.0.0'),
(1, 'asset-risk-management', 1, '{"risk_assessment_enabled": true, "auto_risk_classification": true, "high_risk_threshold": 80, "medium_risk_threshold": 50}', '1.0.0')
ON DUPLICATE KEY UPDATE
  enabled = VALUES(enabled),
  config = VALUES(config),
  version = VALUES(version);

SELECT '新模块插入完成' AS message;
