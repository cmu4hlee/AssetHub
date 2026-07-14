const db = require('../config/database');

/**
 * 创建菜单权限表
 * 用于存储菜单定义和角色-菜单权限关系
 */
async function createMenuPermissionsTable() {
  try {
    console.log('开始创建菜单权限表...');

    // 1. 创建菜单定义表
    await db.execute(`
      CREATE TABLE IF NOT EXISTS menu_definitions (
        id INT PRIMARY KEY AUTO_INCREMENT,
        menu_key VARCHAR(100) NOT NULL UNIQUE COMMENT '菜单键（如：/dashboard）',
        menu_label VARCHAR(100) NOT NULL COMMENT '菜单名称（如：仪表盘）',
        parent_key VARCHAR(100) NULL COMMENT '父菜单键（如果是子菜单）',
        icon VARCHAR(50) NULL COMMENT '图标名称',
        order_index INT DEFAULT 0 COMMENT '排序索引',
        is_active TINYINT(1) DEFAULT 1 COMMENT '是否启用',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT NULL,
        INDEX idx_parent_key (parent_key),
        INDEX idx_order_index (order_index)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='菜单定义表'
    `);
    console.log('✅ 菜单定义表创建成功');

    // 2. 创建角色菜单权限表
    await db.execute(`
      CREATE TABLE IF NOT EXISTS role_menu_permissions (
        id INT PRIMARY KEY AUTO_INCREMENT,
        role VARCHAR(50) NOT NULL COMMENT '角色代码',
        menu_key VARCHAR(100) NOT NULL COMMENT '菜单键',
        is_visible TINYINT(1) DEFAULT 1 COMMENT '是否可见（1=可见，0=不可见）',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT NULL,
        UNIQUE KEY uk_role_menu (role, menu_key),
        INDEX idx_role (role),
        INDEX idx_menu_key (menu_key)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='角色菜单权限表'
    `);
    console.log('✅ 角色菜单权限表创建成功');

    // 清理已移除的菜单
    await db.execute('DELETE FROM menu_definitions WHERE menu_key = ?', ['/dashboards']);
    await db.execute('DELETE FROM role_menu_permissions WHERE menu_key = ?', ['/dashboards']);

    // 3. 插入默认菜单定义（基于Layout.jsx中的菜单结构）
    const defaultMenus = [
      // 一级菜单
    {
      menu_key: '/dashboard',
      menu_label: '仪表盘',
      parent_key: null,
      icon: 'DashboardOutlined',
      order_index: 1,
    },
    {
      menu_key: '/assets-parent',
      menu_label: '资产管理',
      parent_key: null,
      icon: 'AppstoreOutlined',
        order_index: 2,
      },
      {
        menu_key: '/ai-tools-parent',
        menu_label: 'AI工具',
        parent_key: null,
        icon: 'RobotOutlined',
        order_index: 3,
      },
      {
        menu_key: '/transfer-parent',
        menu_label: '资产调配',
        parent_key: null,
        icon: 'SwapOutlined',
        order_index: 4,
      },
      {
        menu_key: '/idle',
        menu_label: '闲置资产',
        parent_key: null,
        icon: 'GiftOutlined',
        order_index: 5,
      },
      {
        menu_key: '/maintenance-parent',
        menu_label: '维修维护',
        parent_key: null,
        icon: 'ToolOutlined',
        order_index: 6,
      },
      {
        menu_key: '/asset-monitoring-parent',
        menu_label: '资产定位',
        parent_key: null,
        icon: 'EnvironmentOutlined',
        order_index: 7,
      },
      {
        menu_key: '/technical-documents-parent',
        menu_label: '技术资料',
        parent_key: null,
        icon: 'FileTextOutlined',
        order_index: 8,
      },
      {
        menu_key: '/quality-control-parent',
        menu_label: '质量管理',
        parent_key: null,
        icon: 'ExperimentOutlined',
        order_index: 9,
      },
      {
        menu_key: '/acceptance-parent',
        menu_label: '验收管理',
        parent_key: null,
        icon: 'CheckCircleOutlined',
        order_index: 10,
      },
      {
        menu_key: '/depreciation-parent',
        menu_label: '折旧管理',
        parent_key: null,
        icon: 'DollarOutlined',
        order_index: 11,
      },
      {
        menu_key: '/modules',
        menu_label: '模块管理',
        parent_key: null,
        icon: 'AppstoreOutlined',
        order_index: 12,
      },
      {
        menu_key: '/system-parent',
        menu_label: '系统管理',
        parent_key: null,
        icon: 'SettingOutlined',
        order_index: 13,
      },

      // 资产管理子菜单
      {
        menu_key: '/assets',
        menu_label: '资产列表',
        parent_key: '/assets-parent',
        icon: null,
        order_index: 1,
      },
      {
        menu_key: '/assets/add',
        menu_label: '添加资产',
        parent_key: '/assets-parent',
        icon: null,
        order_index: 2,
      },
      {
        menu_key: '/inventory',
        menu_label: '资产盘点',
        parent_key: '/assets-parent',
        icon: null,
        order_index: 3,
      },
      {
        menu_key: '/inventory/self',
        menu_label: '我的资产盘点',
        parent_key: '/assets-parent',
        icon: null,
        order_index: 4,
      },
      {
        menu_key: '/temp-assets',
        menu_label: '临时资产',
        parent_key: '/assets-parent',
        icon: null,
        order_index: 6,
      },
      {
        menu_key: '/asset-labels/templates',
        menu_label: '标签模板管理',
        parent_key: '/assets-parent',
        icon: null,
        order_index: 5,
      },
      {
        menu_key: '/asset-labels/print',
        menu_label: '标签打印',
        parent_key: '/assets-parent',
        icon: null,
        order_index: 6,
      },
      {
        menu_key: '/assets/import',
        menu_label: '导入资产',
        parent_key: '/assets-parent',
        icon: null,
        order_index: 7,
      },

      // 折旧管理子菜单
      {
        menu_key: '/depreciation',
        menu_label: '资产折旧',
        parent_key: '/depreciation-parent',
        icon: null,
        order_index: 1,
      },
      {
        menu_key: '/asset-depreciation',
        menu_label: '资产折旧（兼容路径）',
        parent_key: '/depreciation-parent',
        icon: null,
        order_index: 2,
      },

      // AI工具子菜单
      {
        menu_key: '/asset-ai-analysis',
        menu_label: 'AI分析',
        parent_key: '/ai-tools-parent',
        icon: null,
        order_index: 1,
      },
      {
        menu_key: '/ai-question-records',
        menu_label: '提问记录',
        parent_key: '/ai-tools-parent',
        icon: null,
        order_index: 2,
      },
      {
        menu_key: '/ai-maintenance',
        menu_label: 'AI助手',
        parent_key: '/ai-tools-parent',
        icon: null,
        order_index: 3,
      },

      // 资产调配子菜单
      {
        menu_key: '/transfer',
        menu_label: '调配记录',
        parent_key: '/transfer-parent',
        icon: null,
        order_index: 1,
      },
      {
        menu_key: '/transfer/new',
        menu_label: '调配申请',
        parent_key: '/transfer-parent',
        icon: null,
        order_index: 2,
      },
      {
        menu_key: '/transfer/requests',
        menu_label: '调配申请处理',
        parent_key: '/transfer-parent',
        icon: null,
        order_index: 3,
      },

      // 维修维护子菜单
      {
        menu_key: '/maintenance/logs',
        menu_label: '维修日志',
        parent_key: '/maintenance-parent',
        icon: null,
        order_index: 1,
      },
      {
        menu_key: '/maintenance/plans',
        menu_label: '预防性维护',
        parent_key: '/maintenance-parent',
        icon: null,
        order_index: 2,
      },
      {
        menu_key: '/maintenance/templates',
        menu_label: '维护计划模板',
        parent_key: '/maintenance-parent',
        icon: null,
        order_index: 3,
      },
      {
        menu_key: '/maintenance/requests',
        menu_label: '维修申请',
        parent_key: '/maintenance-parent',
        icon: null,
        order_index: 4,
      },
      {
        menu_key: '/maintenance/efficiency',
        menu_label: '维护效率分析',
        parent_key: '/maintenance-parent',
        icon: null,
        order_index: 5,
      },
      {
        menu_key: '/maintenance/reminders',
        menu_label: '维护提醒管理',
        parent_key: '/maintenance-parent',
        icon: null,
        order_index: 6,
      },
      {
        menu_key: '/maintenance/usage-triggers',
        menu_label: '阈值触发管理',
        parent_key: '/maintenance-parent',
        icon: null,
        order_index: 7,
      },
      {
        menu_key: '/maintenance/asset-usage',
        menu_label: '资产使用量管理',
        parent_key: '/maintenance-parent',
        icon: null,
        order_index: 8,
      },
      {
        menu_key: '/maintenance/workorders',
        menu_label: '维护工单',
        parent_key: '/maintenance-parent',
        icon: null,
        order_index: 9,
      },

      // 资产定位子菜单
      {
        menu_key: '/asset-location',
        menu_label: '地理定位',
        parent_key: '/asset-monitoring-parent',
        icon: null,
        order_index: 1,
      },
      {
        menu_key: '/beacon-location',
        menu_label: '区域定位',
        parent_key: '/asset-monitoring-parent',
        icon: null,
        order_index: 2,
      },
      {
        menu_key: '/iot-devices',
        menu_label: '区域定位配置',
        parent_key: '/asset-monitoring-parent',
        icon: null,
        order_index: 3,
      },

      // 技术资料子菜单
      {
        menu_key: '/technical-documents',
        menu_label: '资料列表',
        parent_key: '/technical-documents-parent',
        icon: null,
        order_index: 1,
      },
      {
        menu_key: '/technical-documents/ai',
        menu_label: 'AI智能助手',
        parent_key: '/technical-documents-parent',
        icon: null,
        order_index: 2,
      },
      {
        menu_key: '/technical-documents/review',
        menu_label: '资料审核',
        parent_key: '/technical-documents-parent',
        icon: null,
        order_index: 3,
      },

      // 质量管理子菜单
      {
        menu_key: '/quality-control/metrology',
        menu_label: '计量管理',
        parent_key: '/quality-control-parent',
        icon: null,
        order_index: 1,
      },
      {
        menu_key: '/quality-control/metrology/upload',
        menu_label: '报告智能识别',
        parent_key: '/quality-control-parent',
        icon: null,
        order_index: 2,
      },
      {
        menu_key: '/quality-control/qc',
        menu_label: '质控管理',
        parent_key: '/quality-control-parent',
        icon: null,
        order_index: 3,
      },
      {
        menu_key: '/quality-control/statistics',
        menu_label: '统计分析',
        parent_key: '/quality-control-parent',
        icon: null,
        order_index: 4,
      },
      {
        menu_key: '/adverse-reaction',
        menu_label: '不良事件管理',
        parent_key: '/quality-control-parent',
        icon: null,
        order_index: 5,
      },

      // 验收管理子菜单
      {
        menu_key: '/acceptance',
        menu_label: '验收记录',
        parent_key: '/acceptance-parent',
        icon: null,
        order_index: 1,
      },
      {
        menu_key: '/acceptance/create',
        menu_label: '创建验收记录',
        parent_key: '/acceptance-parent',
        icon: null,
        order_index: 2,
      },

      // 系统管理子菜单
      {
        menu_key: '/tenants',
        menu_label: '企业管理',
        parent_key: '/system-parent',
        icon: null,
        order_index: 1,
      },
      {
        menu_key: '/users',
        menu_label: '用户管理',
        parent_key: '/system-parent',
        icon: null,
        order_index: 2,
      },
      {
        menu_key: '/departments',
        menu_label: '部门管理',
        parent_key: '/system-parent',
        icon: null,
        order_index: 3,
      },
      {
        menu_key: '/roles-permissions',
        menu_label: '角色和权限管理',
        parent_key: '/system-parent',
        icon: null,
        order_index: 4,
      },
      {
        menu_key: '/dashboard-configs',
        menu_label: '仪表盘配置',
        parent_key: '/system-parent',
        icon: null,
        order_index: 5,
      },
      {
        menu_key: '/cloud-sync',
        menu_label: '云/IoT 同步',
        parent_key: '/system-parent',
        icon: null,
        order_index: 6,
      },
      {
        menu_key: '/audit-logs',
        menu_label: '操作日志',
        parent_key: '/system-parent',
        icon: null,
        order_index: 7,
      },
      {
        menu_key: '/backup',
        menu_label: '数据库备份',
        parent_key: '/system-parent',
        icon: null,
        order_index: 8,
      },
      {
        menu_key: '/database-connection',
        menu_label: '数据库连接管理',
        parent_key: '/system-parent',
        icon: null,
        order_index: 7,
      },
      {
        menu_key: '/api-docs',
        menu_label: 'Swagger API 文档',
        parent_key: '/system-parent',
        icon: null,
        order_index: 8,
      },
      {
        menu_key: '/api-documentation',
        menu_label: '完整API文档',
        parent_key: '/system-parent',
        icon: null,
        order_index: 9,
      },
    ];

    const insertMenuSQL = `
      INSERT INTO menu_definitions (menu_key, menu_label, parent_key, icon, order_index, is_active)
      VALUES (?, ?, ?, ?, ?, 1)
      ON DUPLICATE KEY UPDATE 
        menu_label = VALUES(menu_label),
        parent_key = VALUES(parent_key),
        icon = VALUES(icon),
        order_index = VALUES(order_index),
        updated_at = CURRENT_TIMESTAMP
    `;

    for (const menu of defaultMenus) {
      await db.execute(insertMenuSQL, [
        menu.menu_key,
        menu.menu_label,
        menu.parent_key,
        menu.icon,
        menu.order_index,
      ]);
    }
    console.log(`✅ 已插入 ${defaultMenus.length} 个默认菜单定义`);

    // 4. 设置默认菜单权限：系统管理员全可见，其它角色均不可见
    const [menus] = await db.execute('SELECT menu_key FROM menu_definitions');
    const [roles] = await db.execute('SELECT role_code FROM roles');

    for (const role of roles) {
      const roleCode = role.role_code;
      for (const menu of menus) {
        // 系统管理员全可见，其它角色均不可见
        const isVisible = roleCode === 'system_admin' ? 1 : 0;
        await db.execute(
          `
          INSERT INTO role_menu_permissions (role, menu_key, is_visible)
          VALUES (?, ?, ?)
          ON DUPLICATE KEY UPDATE is_visible = VALUES(is_visible)
        `,
          [roleCode, menu.menu_key, isVisible],
        );
      }
    }
    console.log('✅ 已为所有角色设置默认菜单权限（系统管理员全可见，其它角色均不可见）');

    console.log('✅ 菜单权限表创建完成！');
    process.exit(0);
  } catch (error) {
    console.error('❌ 创建表失败:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  createMenuPermissionsTable();
}

module.exports = { createMenuPermissionsTable };
