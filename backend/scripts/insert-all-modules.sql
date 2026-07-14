-- 插入所有模块到 system_modules 表
-- 包括原有模块和新模块

-- 清空并重新插入（开发环境使用）
-- DELETE FROM tenant_module_configs;
-- DELETE FROM system_modules;

-- 系统基础类模块
INSERT INTO system_modules (id, name, version, description, category, type, status, author, dependencies, frontend_config, backend_config, config_schema, default_config) VALUES
('user-management', '用户管理', '1.0.0', '提供用户管理功能，包括用户创建、编辑、删除、角色分配等。', '系统基础', 'system', 'stable', 'System Team', '[]', '{"menu_routes": [{"key": "/users", "icon": "UserOutlined", "label": "用户管理", "path": "/users", "component": "UserList", "permissions": ["user:read"]}, {"key": "/users/new", "icon": "PlusOutlined", "label": "新增用户", "path": "/users/new", "component": "UserNew", "permissions": ["user:create"]}, {"key": "/users/:id", "icon": "EditOutlined", "label": "编辑用户", "path": "/users/:id", "component": "UserEdit", "permissions": ["user:update"], "hideInMenu": true}], "permissions": ["user:read", "user:create", "user:update", "user:delete"]}', '{"api_prefix": "/api/users", "routes_path": "routes"}', '[{"key": "enable_password_reset", "name": "启用密码重置", "type": "boolean", "default": true}, {"key": "default_user_role", "name": "默认用户角色", "type": "string", "default": "operator"}]', '{"enable_password_reset": true, "default_user_role": "operator"}'),

('department-management', '部门管理', '1.0.0', '提供部门管理功能，包括部门创建、编辑、删除、层级管理等。', '系统基础', 'system', 'stable', 'System Team', '[]', '{"menu_routes": [{"key": "/departments", "icon": "ApartmentOutlined", "label": "部门管理", "path": "/departments", "component": "DepartmentList", "permissions": ["department:read"]}], "permissions": ["department:read", "department:create", "department:update", "department:delete"]}', '{"api_prefix": "/api/departments", "routes_path": "routes"}', '[]', '{}'),

('quality-common', '平台公共能力', '1.0.0', '提供权限管理、数据字典、日志记录等平台级基础能力。', '系统基础', 'system', 'stable', 'System Team', '[{"module_id": "user-management", "dependency_type": "required", "min_version": "1.0.0"}]', '{"menu_routes": [], "permissions": ["admin", "quality_manager", "operator"]}', '{"api_prefix": "/api/quality-common"}', '[]', '{}'),

('message-integration', '消息平台集成', '1.0.0', '统一管理微信绑定、短信通知、飞书绑定、钉钉绑定等外部消息平台集成能力。', '系统基础', 'integration', 'stable', 'System Team', '[{"module_id": "user-management", "dependency_type": "required", "min_version": "1.0.0"}]', '{"menu_keys": ["/message-integration-parent", "/integration/wechat-binding", "/integration/sms-notification", "/integration/feishu-binding", "/integration/dingtalk-binding"], "permissions": ["integration:read", "integration:manage"]}', '{"api_prefix": "/api/message-integration"}', '[{"key": "wechat_enabled", "name": "启用微信", "type": "boolean", "default": false}, {"key": "sms_enabled", "name": "启用短信", "type": "boolean", "default": false}, {"key": "feishu_enabled", "name": "启用飞书", "type": "boolean", "default": false}, {"key": "dingtalk_enabled", "name": "启用钉钉", "type": "boolean", "default": false}]', '{"wechat_enabled": false, "sms_enabled": false, "feishu_enabled": false, "dingtalk_enabled": false}'),

-- 资产生命周期类模块
('asset-management', '库存管理', '1.0.0', '提供完整的库存管理功能，包括资产入库、使用、维护、调拨、报废等全生命周期管理。', '资产生命周期', 'system', 'stable', 'System Team', '[{"module_id": "user-management", "dependency_type": "required", "min_version": "1.0.0"}, {"module_id": "department-management", "dependency_type": "optional", "min_version": "1.0.0"}]', '{"menu_keys": ["/assets", "/assets/list", "/assets/categories", "/assets/usage"], "permissions": ["asset:read", "asset:create", "asset:update", "asset:delete", "asset:transfer", "asset:scrap"]}', '{"api_prefix": "/api/assets", "routes_path": "routes"}', '[{"key": "enable_asset_barcode", "name": "启用资产条码", "type": "boolean", "default": true}, {"key": "asset_code_prefix", "name": "资产编码前缀", "type": "string", "default": "ZC"}]', '{"enable_asset_barcode": true, "asset_code_prefix": "ZC"}'),

('inventory-management', '盘点管理', '1.0.0', '盘点管理模块，聚焦资产盘点、盘点差异处理与盘点执行。', '资产生命周期', 'system', 'stable', 'System Team', '[{"module_id": "asset-management", "dependency_type": "required", "min_version": "1.0.0"}, {"module_id": "user-management", "dependency_type": "required", "min_version": "1.0.0"}]', '{"menu_keys": ["/inventory", "/inventory/plans", "/inventory/tasks", "/inventory/differences"], "permissions": ["inventory:read", "inventory:create", "inventory:execute"]}', '{"api_prefix": "/api/inventory"}', '[]', '{}'),

('procurement-management', '采购与招标', '1.1.0', '采购与招标统一模块：将原采购管理（采购申请）和招标采购（招标项目、供应商、合同、付款里程碑）合并为统一闭环。数据迁移由 scripts/migrate-procurement-to-tendering.js 执行。', '资产生命周期', 'system', 'stable', 'System Team', '[{"module_id": "asset-management", "dependency_type": "required", "min_version": "1.0.0"}]', '{"menu_keys": ["/tendering", "/tendering/requests", "/tendering/projects", "/tendering/suppliers", "/tendering/contracts", "/tendering/statistics"], "permissions": ["tendering:read", "tendering:create", "tendering:update", "tendering:publish", "tendering:evaluate", "tendering:supplier:read", "tendering:contract:read", "tendering:contract:create", "tendering:contract:approve", "tendering:contract:sign", "tendering:contract:archive", "tendering:request:read", "tendering:request:create", "tendering:request:update", "tendering:request:approve", "tendering:simple:approve"]}', '{"api_prefix": "/api/tendering"}', '[]', '{}'),

('label-management', '标签管理', '1.0.0', '独立的资产标签管理模块，负责标签模板与标签打印。', '资产生命周期', 'system', 'stable', 'System Team', '[{"module_id": "asset-management", "dependency_type": "required", "min_version": "1.0.0"}]', '{"menu_keys": ["/label-management-parent", "/asset-labels/templates", "/asset-labels/print"], "permissions": ["label:read", "label:create", "label:print"]}', '{"api_prefix": "/api/labels"}', '[]', '{}'),

('asset-usage-management', '资产使用', '1.0.0', '资产使用记录与管理模块。', '资产生命周期', 'system', 'stable', 'System Team', '[{"module_id": "asset-management", "dependency_type": "required", "min_version": "1.0.0"}]', '{"permissions": ["asset:usage:read", "asset:usage:create"]}', '{"api_prefix": "/api/asset-usage"}', '[]', '{}'),

('depreciation-management', '折旧管理', '1.0.0', '独立的资产折旧管理模块，提供折旧测算、汇总分析、趋势统计和报表导出能力。', '财务管理', 'system', 'stable', 'System Team', '[{"module_id": "asset-management", "dependency_type": "required", "min_version": "1.0.0"}, {"module_id": "user-management", "dependency_type": "required", "min_version": "1.0.0"}]', '{"menu_keys": ["/depreciation", "/depreciation/calculation", "/depreciation/reports"], "permissions": ["depreciation:read", "depreciation:calculate"]}', '{"api_prefix": "/api/depreciation"}', '[{"key": "default_depreciation_method", "name": "默认折旧方法", "type": "string", "default": "straight_line"}, {"key": "default_depreciation_years", "name": "默认折旧年限", "type": "number", "default": 5}]', '{"default_depreciation_method": "straight_line", "default_depreciation_years": 5}'),

('asset-ai-assistant', '资产AI助手', '1.0.0', '统一的资产AI入口模块，为资产AI能力提供统一入口。', '资产生命周期', 'system', 'stable', 'System Team', '[{"module_id": "asset-management", "dependency_type": "required", "min_version": "1.0.0"}, {"module_id": "user-management", "dependency_type": "required", "min_version": "1.0.0"}]', '{"menu_keys": ["/ai-assistant"], "permissions": ["ai:read", "ai:use"]}', '{}', '[{"key": "enable_ai_assistant", "name": "启用AI助手", "type": "boolean", "default": true}]', '{"enable_ai_assistant": true}'),

('ct-maintenance-assistant-management', 'CT维护助手模块', '1.0.0', '资产AI助手下的CT维护专用助手模块', '资产生命周期', 'system', 'stable', 'System Team', '[{"module_id": "asset-ai-assistant", "dependency_type": "required", "min_version": "1.0.0"}]', '{"menu_keys": ["/ai-assistant-parent", "/ai-assistant/ct-maintenance"], "permissions": ["ai:ct:read"]}', '{"api_prefix": "/api/ct-assistant"}', '[]', '{}'),

-- 维护与工单类模块
('maintenance-management', '日常维修', '1.0.0', '提供维修日志、维修工单、维修申请等日常维修能力。', '维护与工单', 'system', 'stable', 'System Team', '[{"module_id": "asset-management", "dependency_type": "required", "min_version": "1.0.0"}, {"module_id": "user-management", "dependency_type": "required", "min_version": "1.0.0"}]', '{"menu_keys": ["/maintenance", "/maintenance/logs", "/maintenance/workorders", "/maintenance/requests"], "permissions": ["maintenance:read", "maintenance:create", "maintenance:assign", "maintenance:complete"]}', '{"api_prefix": "/api/maintenance"}', '[]', '{}'),

('preventive-maintenance-management', '预防性维护', '1.0.0', '预防性维护模块，支持维护计划、模板、提醒与效率分析。', '维护与工单', 'system', 'stable', 'System Team', '[{"module_id": "asset-management", "dependency_type": "required", "min_version": "1.0.0"}, {"module_id": "user-management", "dependency_type": "required", "min_version": "1.0.0"}]', '{"menu_keys": ["/preventive-maintenance", "/preventive-maintenance/plans", "/preventive-maintenance/templates"], "permissions": ["preventive:read", "preventive:create", "preventive:manage"]}', '{"api_prefix": "/api/preventive-maintenance"}', '[{"key": "auto_reminder_enabled", "name": "启用自动提醒", "type": "boolean", "default": true}, {"key": "reminder_days_before", "name": "提前提醒天数", "type": "number", "default": 7}]', '{"auto_reminder_enabled": true, "reminder_days_before": 7}'),

-- 质量与安全类模块
('quality-control', '计量管理', '1.1.0', '计量管理模块，支持计量器具台账、检定校准、报告识别与到期提醒。', '质量与安全', 'system', 'stable', 'System Team', '[{"module_id": "quality-common", "dependency_type": "required", "min_version": "1.0.0"}, {"module_id": "asset-management", "dependency_type": "required", "min_version": "1.0.0"}, {"module_id": "user-management", "dependency_type": "required", "min_version": "1.0.0"}]', '{"menu_keys": ["/quality", "/quality/metrology", "/quality/calibration"], "permissions": ["quality:read", "quality:create", "quality:calibrate"]}', '{"api_prefix": "/api/quality"}', '[{"key": "auto_reminder_enabled", "name": "启用到期提醒", "type": "boolean", "default": true}, {"key": "reminder_days_before", "name": "提前提醒天数", "type": "number", "default": 30}]', '{"auto_reminder_enabled": true, "reminder_days_before": 30}'),

('quality-assurance-management', '质控管理', '1.0.0', '质控管理模块，支持质控记录、统计分析和质量趋势评估。', '质量与安全', 'system', 'stable', 'System Team', '[{"module_id": "quality-common", "dependency_type": "required", "min_version": "1.0.0"}, {"module_id": "asset-management", "dependency_type": "required", "min_version": "1.0.0"}, {"module_id": "user-management", "dependency_type": "required", "min_version": "1.0.0"}]', '{"menu_keys": ["/quality-assurance", "/quality-assurance/records", "/quality-assurance/statistics"], "permissions": ["quality:assurance:read", "quality:assurance:create"]}', '{"api_prefix": "/api/quality-assurance"}', '[]', '{}'),

('adverse-event', '不良事件', '1.0.0', '提供完整的不良事件功能，包括事件上报、分类分级、处理流程跟踪、根本原因分析及预防措施管理等。', '质量与安全', 'system', 'stable', 'System Team', '[{"module_id": "quality-common", "dependency_type": "required", "min_version": "1.0.0"}, {"module_id": "asset-management", "dependency_type": "required", "min_version": "1.0.0"}, {"module_id": "user-management", "dependency_type": "required", "min_version": "1.0.0"}]', '{"menu_keys": ["/adverse-events", "/adverse-events/list", "/adverse-events/report"], "permissions": ["adverse:read", "adverse:create", "adverse:process"]}', '{"api_prefix": "/api/adverse-events"}', '[]', '{}'),

('asset-risk-management', '风险管理', '1.0.0', '独立的医疗设备风险评估、风险分级、风险控制与预警管理模块', '质量与安全', 'system', 'stable', 'System Team', '[{"module_id": "asset-management", "dependency_type": "required", "min_version": "1.0.0"}]', '{"menu_keys": ["/risk/dashboard", "/risk/assessment", "/risk/classification", "/risk/control"], "permissions": ["risk:read", "risk:assessment:read", "risk:assessment:create"]}', '{"api_prefix": "/api/risk"}', '[{"key": "risk_assessment_enabled", "name": "启用风险评估", "type": "boolean", "default": true}, {"key": "auto_risk_classification", "name": "自动风险分级", "type": "boolean", "default": true}]', '{"risk_assessment_enabled": true, "auto_risk_classification": true}'),

-- 物联与定位类模块
('iot-management', '物联网管理', '1.0.0', '物联网设备管理、数据采集、监控预警和资产定位集成', '物联与定位', 'system', 'stable', 'System Team', '[{"module_id": "asset-management", "dependency_type": "required", "min_version": "1.0.0"}]', '{"menu_keys": ["/iot", "/iot/devices", "/iot/monitoring"], "permissions": ["iot:read", "iot:manage"]}', '{"api_prefix": "/api/iot"}', '[{"key": "mqtt_enabled", "name": "启用MQTT", "type": "boolean", "default": false}]', '{"mqtt_enabled": false}'),

('iot-asset-monitoring-management', '资产监测模块', '1.0.0', '资产运行状态与遥测监测接入模块（MQTT + Kafka + 时序）', '物联与定位', 'system', 'stable', 'System Team', '[{"module_id": "iot-management", "dependency_type": "required", "min_version": "1.0.0"}, {"module_id": "asset-management", "dependency_type": "required", "min_version": "1.0.0"}]', '{"menu_keys": ["/iot-asset-monitoring"], "permissions": ["iot:monitoring:read"]}', '{"api_prefix": "/api/iot/asset-monitoring"}', '[]', '{}'),

('iot-environment-monitoring-management', '环境监测模块', '1.0.0', '温湿度等环境参数采集模块（MQTT + Kafka + 时序）', '物联与定位', 'system', 'stable', 'System Team', '[{"module_id": "iot-management", "dependency_type": "required", "min_version": "1.0.0"}]', '{"menu_keys": ["/environment-monitoring"], "permissions": ["iot:env:read"]}', '{"api_prefix": "/api/iot/environment"}', '[]', '{}'),

('iot-geo-location-management', '地理定位模块', '1.0.0', '基于地图的资产地理定位与轨迹管理模块', '物联与定位', 'system', 'stable', 'System Team', '[{"module_id": "iot-management", "dependency_type": "required", "min_version": "1.0.0"}, {"module_id": "asset-management", "dependency_type": "required", "min_version": "1.0.0"}]', '{"menu_keys": ["/geo-location"], "permissions": ["iot:geo:read"]}', '{"api_prefix": "/api/iot/geo-location"}', '[]', '{}'),

('iot-zone-location-management', '区域定位模块', '1.0.0', '面向信标与定位网关的区域定位接入模块（MQTT + Kafka + 时序）', '物联与定位', 'system', 'stable', 'System Team', '[{"module_id": "iot-management", "dependency_type": "required", "min_version": "1.0.0"}]', '{"menu_keys": ["/beacon-location"], "permissions": ["iot:zone:read"]}', '{"api_prefix": "/api/iot/zone-location"}', '[]', '{}'),

-- 分析与统计类模块
('uptime-management', '开机率管理', '1.0.0', '医疗设备开机率统计与分析模块，支持生命支持类、大型设备、常规设备分类统计', '分析与统计', 'system', 'stable', 'System Team', '[{"module_id": "asset-management", "dependency_type": "required", "min_version": "1.0.0"}]', '{"menu_keys": ["/uptime", "/uptime/dashboard", "/uptime/operation-logs", "/uptime/statistics"], "permissions": ["uptime:read", "uptime:log:read", "uptime:statistics:read"]}', '{"api_prefix": "/api/uptime"}', '[{"key": "operation_log_enabled", "name": "启用运行记录", "type": "boolean", "default": true}, {"key": "life_support_uptime_threshold", "name": "生命支持类开机率阈值(%)", "type": "number", "default": 99}]', '{"operation_log_enabled": true, "life_support_uptime_threshold": 99}'),

-- 人力资源类模块
('staff-qualification', '人员资质管理', '1.0.0', '医学装备管理人员资质、培训记录、考核管理模块', '人力资源', 'system', 'stable', 'System Team', '[{"module_id": "user-management", "dependency_type": "required", "min_version": "1.0.0"}]', '{"menu_keys": ["/staff", "/staff/qualifications", "/staff/training"], "permissions": ["staff:read", "staff:qualification:read", "staff:training:read"]}', '{"api_prefix": "/api/staff"}', '[{"key": "qualification_management_enabled", "name": "启用资质管理", "type": "boolean", "default": true}, {"key": "qualification_reminder_days", "name": "资质到期提醒天数", "type": "number", "default": 90}]', '{"qualification_management_enabled": true, "qualification_reminder_days": 90}'),

-- 质量与安全扩展模块（新模块）
('special-equipment-management', '特种设备管理', '1.0.0', '特种设备台账、检验记录、到期提醒与统计分析模块', '质量与安全', 'system', 'stable', 'System Team', '[{"module_id": "asset-management", "dependency_type": "required", "min_version": "1.0.0"}, {"module_id": "user-management", "dependency_type": "required", "min_version": "1.0.0"}]', '{"menu_keys": ["/special-equipment"], "permissions": ["special_equipment:read", "special_equipment:create", "special_equipment:update", "special_equipment:delete"]}', '{"api_prefix": "/api/special-equipment"}', '[{"key": "equipment_registry_enabled", "name": "启用设备台账", "type": "boolean", "default": true}, {"key": "inspection_records_enabled", "name": "启用检验记录", "type": "boolean", "default": true}, {"key": "default_inspection_reminder_days", "name": "检验提醒提前天数", "type": "number", "default": 90}]', '{"equipment_registry_enabled": true, "inspection_records_enabled": true, "default_inspection_reminder_days": 90}'),

('safety-inspection-management', '安全检测管理', '1.0.0', '医疗设备电气、辐射、机械等安全检测记录与整改跟踪模块', '质量与安全', 'system', 'stable', 'System Team', '[{"module_id": "asset-management", "dependency_type": "required", "min_version": "1.0.0"}, {"module_id": "user-management", "dependency_type": "required", "min_version": "1.0.0"}]', '{"menu_keys": ["/safety-inspection"], "permissions": ["safety_inspection:read", "safety_inspection:create", "safety_inspection:update", "safety_inspection:delete"]}', '{"api_prefix": "/api/safety-inspection"}', '[{"key": "inspection_records_enabled", "name": "启用检测记录", "type": "boolean", "default": true}, {"key": "rectification_tracking_enabled", "name": "启用整改追踪", "type": "boolean", "default": true}, {"key": "default_expiring_days", "name": "到期提醒天数", "type": "number", "default": 30}]', '{"inspection_records_enabled": true, "rectification_tracking_enabled": true, "default_expiring_days": 30}'),

-- 质量与合规类模块（新模块）
('compliance-management', '合规性管理', '1.0.0', '医学装备整体运维管理服务规范中的合规核心模块，聚焦分级保养策略与计划治理', '质量与合规', 'system', 'stable', 'System Team', '[{"module_id": "asset-management", "dependency_type": "required", "min_version": "1.0.0"}, {"module_id": "user-management", "dependency_type": "required", "min_version": "1.0.0"}]', '{"menu_keys": ["/compliance", "/compliance/maintenance-level"], "permissions": ["compliance:read", "compliance:maintenance:read", "compliance:maintenance:create", "compliance:maintenance:update", "compliance:maintenance:delete"]}', '{"api_prefix": "/api/compliance"}', '[{"key": "maintenance_level_enabled", "name": "启用分级保养", "type": "boolean", "default": true}, {"key": "enable_auto_plan_generation", "name": "自动生成保养计划", "type": "boolean", "default": true}]', '{"maintenance_level_enabled": true, "enable_auto_plan_generation": true}')

ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  version = VALUES(version),
  description = VALUES(description),
  category = VALUES(category),
  dependencies = VALUES(dependencies),
  frontend_config = VALUES(frontend_config),
  backend_config = VALUES(backend_config),
  config_schema = VALUES(config_schema),
  default_config = VALUES(default_config),
  updated_at = CURRENT_TIMESTAMP;

-- 为默认租户初始化所有模块配置（默认启用）
INSERT INTO tenant_module_configs (tenant_id, module_id, enabled, config, version)
SELECT 1, id, 1, default_config, version
FROM system_modules
ON DUPLICATE KEY UPDATE
  enabled = VALUES(enabled),
  config = VALUES(config),
  version = VALUES(version);

SELECT CONCAT('共插入 ', COUNT(*), ' 个模块') AS message FROM system_modules;
