-- ============================================================
-- 巡检管理模块注册脚本
-- 将模块注册到 system_modules 和 tenant_module_configs 表
-- ============================================================

-- 1. 注册巡检管理模块到系统模块表
INSERT INTO system_modules (
  id, name, version, description, category, type, status, author,
  dependencies, frontend_config, backend_config, config_schema, default_config
) VALUES (
  'inspection-management',
  '巡检管理',
  '1.0.0',
  '资产日常巡检计划、任务派发、规范巡检记录单与异常问题整改跟踪模块',
  '质量与安全',
  'system',
  'stable',
  'System Team',
  '[{"module_id": "asset-management", "dependency_type": "required", "min_version": "1.0.0"}, {"module_id": "user-management", "dependency_type": "required", "min_version": "1.0.0"}]',
  JSON_OBJECT(
    'menu_keys', JSON_ARRAY('/inspection-parent', '/inspection', '/inspection/records', '/inspection/templates', '/inspection/issues', '/inspection/statistics'),
    'permissions', JSON_ARRAY('inspection:read', 'inspection:create', 'inspection:update', 'inspection:delete', 'inspection:execute', 'inspection:review')
  ),
  JSON_OBJECT('api_prefix', '/api/inspection'),
  '[{"key": "default_cycle_days", "name": "默认巡检周期(天)", "type": "number", "default": 30}, {"key": "expiring_alert_days", "name": "到期提醒天数", "type": "number", "default": 3}, {"key": "require_review", "name": "需要复核", "type": "boolean", "default": true}]',
  JSON_OBJECT('default_cycle_days', 30, 'expiring_alert_days', 3, 'require_review', true)
)
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

-- 2. 为所有已存在的租户启用巡检管理模块
INSERT INTO tenant_module_configs (tenant_id, module_id, enabled, config, version)
SELECT t.id, 'inspection-management', 1,
  JSON_OBJECT('default_cycle_days', 30, 'expiring_alert_days', 3, 'require_review', true),
  '1.0.0'
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM tenant_module_configs tmc
  WHERE tmc.tenant_id = t.id AND tmc.module_id = 'inspection-management'
);

-- 3. 如果没有 tenants 表或想确保默认租户(1)启用，单独插入
INSERT INTO tenant_module_configs (tenant_id, module_id, enabled, config, version)
SELECT 1, 'inspection-management', 1,
  JSON_OBJECT('default_cycle_days', 30, 'expiring_alert_days', 3, 'require_review', true),
  '1.0.0'
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM tenant_module_configs
  WHERE tenant_id = 1 AND module_id = 'inspection-management'
);

-- 4. 注册菜单定义到 menu_definitions 表（确保菜单可见）
INSERT INTO menu_definitions (menu_key, menu_label, parent_key, icon, order_index, is_active)
VALUES
  ('/inspection-parent', '巡检管理', NULL, 'ReconciliationOutlined', 12, 1),
  ('/inspection', '巡检任务', '/inspection-parent', NULL, 1, 1),
  ('/inspection/calendar', '巡检日历', '/inspection-parent', 'CalendarOutlined', 2, 1),
  ('/inspection/plans', '巡检计划', '/inspection-parent', 'ScheduleOutlined', 3, 1),
  ('/inspection/routes', '巡检路线', '/inspection-parent', 'EnvironmentOutlined', 4, 1),
  ('/inspection/records', '巡检记录单', '/inspection-parent', NULL, 5, 1),
  ('/inspection/templates', '巡检模板', '/inspection-parent', 'ProfileOutlined', 6, 1),
  ('/inspection/issues', '异常问题', '/inspection-parent', NULL, 7, 1),
  ('/inspection/statistics', '巡检统计', '/inspection-parent', 'BarChartOutlined', 8, 1)
ON DUPLICATE KEY UPDATE
  menu_label = VALUES(menu_label),
  parent_key = VALUES(parent_key),
  icon = VALUES(icon),
  order_index = VALUES(order_index),
  is_active = 1;

SELECT '巡检管理模块注册完成' AS result;
