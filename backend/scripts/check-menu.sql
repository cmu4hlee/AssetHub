-- 检查质量控制菜单的SQL查询脚本
-- 可以直接在MySQL客户端中运行此脚本

-- 1. 检查菜单定义表中是否有质量控制菜单
SELECT 
    menu_key AS '菜单键',
    menu_label AS '菜单名称',
    parent_key AS '父菜单',
    icon AS '图标',
    order_index AS '排序',
    is_active AS '是否启用',
    created_at AS '创建时间',
    updated_at AS '更新时间'
FROM menu_definitions 
WHERE menu_key LIKE '/quality-control%'
ORDER BY order_index;

-- 2. 检查所有菜单（查看完整菜单列表）
SELECT 
    menu_key AS '菜单键',
    menu_label AS '菜单名称',
    parent_key AS '父菜单',
    order_index AS '排序'
FROM menu_definitions 
WHERE is_active = 1
ORDER BY order_index, id;

-- 3. 检查质量控制菜单的权限设置
SELECT 
    rmp.role AS '角色',
    rmp.menu_key AS '菜单键',
    md.menu_label AS '菜单名称',
    rmp.is_visible AS '是否可见',
    rmp.created_at AS '创建时间'
FROM role_menu_permissions rmp
LEFT JOIN menu_definitions md ON rmp.menu_key = md.menu_key
WHERE rmp.menu_key LIKE '/quality-control%'
ORDER BY rmp.role, rmp.menu_key;

-- 4. 统计质量控制菜单数量
SELECT 
    COUNT(*) AS '质量控制菜单总数'
FROM menu_definitions 
WHERE menu_key LIKE '/quality-control%';

-- 5. 如果菜单不存在，可以使用以下SQL手动添加（需要先确保表存在）
/*
INSERT INTO menu_definitions (menu_key, menu_label, parent_key, icon, order_index, is_active)
VALUES 
    ('/quality-control-parent', '质量控制', NULL, 'ExperimentOutlined', 9, 1),
    ('/quality-control/metrology', '计量管理', '/quality-control-parent', NULL, 1, 1),
    ('/quality-control/qc', '质控管理', '/quality-control-parent', NULL, 2, 1)
ON DUPLICATE KEY UPDATE 
    menu_label = VALUES(menu_label),
    parent_key = VALUES(parent_key),
    icon = VALUES(icon),
    order_index = VALUES(order_index),
    updated_at = CURRENT_TIMESTAMP;
*/
