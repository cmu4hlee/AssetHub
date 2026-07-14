-- 资产AI助手模块配置
-- 执行此脚本将统一的资产AI助手模块添加到系统模块中

USE zcgl;

-- 1. 检查并添加系统模块
INSERT INTO system_modules (
    id, name, version, description, category, type, status, author,
    dependencies, compatibility, frontend_config, backend_config,
    config_schema, default_config, interfaces, created_at, updated_at
) VALUES (
    'asset-ai-assistant',
    '资产AI助手',
    '1.0.0',
    '统一的资产AI助手入口，整合SQL智能分析、文档智能助手、维修AI助手和智能搜索功能',
    'ai',
    'unified',
    'stable',
    'System',
    '["sqlbot", "technical-documents-ai", "maintenance-ai"]',
    NULL,
    '{"entryPath": "/ai-assistant", "modes": ["sqlbot", "documents", "maintenance", "search"], "iframeUrl": "http://localhost:8000/#/zcgl"}',
    NULL,
    '{"modes": {"type": "array", "items": {"type": "string"}, "default": ["sqlbot", "documents", "maintenance", "search"]}, "iframeEnabled": {"type": "boolean", "default": true}}',
    '{"modes": ["sqlbot", "documents", "maintenance", "search"], "iframeEnabled": true, "defaultMode": "sqlbot"}',
    NULL,
    NOW(),
    NOW()
) ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    version = VALUES(version),
    description = VALUES(description),
    frontend_config = VALUES(frontend_config),
    default_config = VALUES(default_config),
    updated_at = NOW();

-- 2. 添加菜单定义
INSERT INTO menu_definitions (
    menu_key, parent_key, menu_name, menu_icon, menu_path, menu_order, is_visible, created_at
) VALUES
    ('ai-assistant-parent', NULL, '资产AI助手', 'RobotOutlined', NULL, 15, 1, NOW()),
    ('ai-assistant', 'ai-assistant-parent', '统一AI入口', 'AppstoreOutlined', '/ai-assistant', 1, 1, NOW()),
    ('asset-ai-analysis', 'ai-assistant-parent', 'SQL智能分析', 'DatabaseOutlined', '/asset-ai-analysis', 2, 1, NOW()),
    ('ai-maintenance', 'ai-assistant-parent', '维修AI助手', 'ToolOutlined', '/ai-maintenance', 3, 1, NOW()),
    ('ai-question-records', 'ai-assistant-parent', '智能搜索', 'SearchOutlined', '/ai-question-records', 4, 1, NOW())
ON DUPLICATE KEY UPDATE menu_name = VALUES(menu_name);

-- 3. 为所有租户启用AI助手模块（可选）
INSERT INTO tenant_module_configs (
    tenant_id, module_id, enabled, config, version, enabled_at, created_at, updated_at
)
SELECT DISTINCT t.id, 'asset-ai-assistant', 1, '{"modes": ["sqlbot", "documents", "maintenance", "search"], "iframeEnabled": true}', '1.0.0', NOW(), NOW(), NOW()
FROM tenants t
ON DUPLICATE KEY UPDATE enabled = 1, config = VALUES(config);

-- 4. 添加权限配置
INSERT INTO role_permissions (
    role_name, permission_key, permission_type, menu_key, description, created_at
) VALUES
    ('super_admin', 'ai-assistant:view', 'menu', 'ai-assistant-parent', '查看资产AI助手菜单', NOW()),
    ('system_admin', 'ai-assistant:view', 'menu', 'ai-assistant-parent', '查看资产AI助手菜单', NOW()),
    ('asset_manager', 'ai-assistant:view', 'menu', 'ai-assistant-parent', '查看资产AI助手菜单', NOW()),
    ('maintenance_staff', 'ai-assistant:maintenance:use', 'menu', 'ai-maintenance', '使用维修AI助手', NOW()),
    ('maintenance_manager', 'ai-assistant:maintenance:use', 'menu', 'ai-maintenance', '使用维修AI助手', NOW())
ON DUPLICATE KEY UPDATE description = VALUES(description);

-- 5. 验证模块配置
SELECT
    m.id,
    m.name,
    m.version,
    m.status,
    m.description,
    c.enabled,
    c.config
FROM system_modules m
LEFT JOIN tenant_module_configs c ON m.id = c.module_id AND c.tenant_id = 1
WHERE m.id = 'asset-ai-assistant';

-- 6. 验证菜单配置
SELECT
    menu_key,
    parent_key,
    menu_name,
    menu_path,
    is_visible
FROM menu_definitions
WHERE menu_key IN ('ai-assistant-parent', 'ai-assistant', 'asset-ai-analysis', 'ai-maintenance', 'ai-question-records')
ORDER BY menu_order;

-- 7. 显示完成信息
SELECT '资产AI助手模块配置完成！' AS status,
       '请刷新前端页面或重新登录以看到新的菜单项' AS note;
