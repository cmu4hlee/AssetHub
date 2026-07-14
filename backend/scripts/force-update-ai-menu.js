const db = require('../config/database');

async function forceUpdateAIMenu() {
  try {
    console.log('开始强制更新AI工具菜单...');

    // 1. 确保菜单权限表存在
    console.log('1. 检查菜单权限表结构...');
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

    console.log('  ✅ 菜单权限表结构检查完成');

    // 2. 强制更新AI工具菜单
    console.log('2. 强制更新AI工具菜单...');

    // AI工具父菜单
    await db.execute(`
      INSERT INTO menu_definitions (menu_key, menu_label, parent_key, icon, order_index, is_active)
      VALUES ('/ai-tools-parent', 'AI工具', NULL, 'RobotOutlined', 3, 1)
      ON DUPLICATE KEY UPDATE
        menu_label = VALUES(menu_label),
        parent_key = VALUES(parent_key),
        icon = VALUES(icon),
        order_index = VALUES(order_index),
        is_active = VALUES(is_active),
        updated_at = NOW()
    `);
    console.log('  ✅ AI工具父菜单已更新');

    // AI分析菜单
    await db.execute(`
      INSERT INTO menu_definitions (menu_key, menu_label, parent_key, icon, order_index, is_active)
      VALUES ('/asset-ai-analysis', 'AI分析', '/ai-tools-parent', NULL, 1, 1)
      ON DUPLICATE KEY UPDATE
        menu_label = VALUES(menu_label),
        parent_key = VALUES(parent_key),
        icon = VALUES(icon),
        order_index = VALUES(order_index),
        is_active = VALUES(is_active),
        updated_at = NOW()
    `);
    console.log('  ✅ AI分析菜单已更新');

    // 提问记录菜单
    await db.execute(`
      INSERT INTO menu_definitions (menu_key, menu_label, parent_key, icon, order_index, is_active)
      VALUES ('/ai-question-records', '提问记录', '/ai-tools-parent', NULL, 2, 1)
      ON DUPLICATE KEY UPDATE
        menu_label = VALUES(menu_label),
        parent_key = VALUES(parent_key),
        icon = VALUES(icon),
        order_index = VALUES(order_index),
        is_active = VALUES(is_active),
        updated_at = NOW()
    `);
    console.log('  ✅ 提问记录菜单已更新');

    // 3. 为所有角色添加AI工具菜单权限
    console.log('3. 为所有角色添加AI工具菜单权限...');

    // 获取所有角色
    const [rolesResult] = await db.execute('SELECT DISTINCT role FROM role_menu_permissions');
    const roles = rolesResult.map(row => row.role);

    // 如果没有角色，添加默认角色
    if (roles.length === 0) {
      const defaultRoles = ['super_admin', 'system_admin', 'asset_admin', 'department_admin'];
      for (const role of defaultRoles) {
        await db.execute(
          'INSERT IGNORE INTO role_menu_permissions (role, menu_key, is_visible) VALUES (?, ?, 1)',
          [role, '/dashboard'],
        );
      }
      roles.push(...defaultRoles);
    }

    // 为每个角色添加AI工具菜单权限
    const aiMenuKeys = ['/ai-tools-parent', '/asset-ai-analysis', '/ai-question-records'];

    for (const role of roles) {
      console.log(`  为角色 ${role} 添加AI工具菜单权限...`);
      for (const menuKey of aiMenuKeys) {
        await db.execute(
          `
          INSERT IGNORE INTO role_menu_permissions (role, menu_key, is_visible)
          VALUES (?, ?, 1)
        `,
          [role, menuKey],
        );
      }
    }

    // 4. 验证菜单更新结果
    console.log('4. 验证菜单更新结果...');

    const [menusResult] = await db.execute(`
      SELECT menu_key, menu_label, parent_key, is_active
      FROM menu_definitions
      WHERE menu_key LIKE '%ai%'
      ORDER BY menu_key
    `);

    console.log('  AI相关菜单:');
    menusResult.forEach(menu => {
      console.log(
        `    ✅ ${menu.menu_key} - ${menu.menu_label} (父菜单: ${menu.parent_key}, 状态: ${menu.is_active ? '激活' : '禁用'})`,
      );
    });

    // 验证角色权限
    for (const role of roles) {
      const [permissionsResult] = await db.execute(
        `
        SELECT menu_key, is_visible
        FROM role_menu_permissions
        WHERE role = ? AND menu_key LIKE '%ai%'
      `,
        [role],
      );

      if (permissionsResult.length > 0) {
        console.log(`  角色 ${role} 的AI菜单权限:`);
        permissionsResult.forEach(perm => {
          console.log(`    ✅ ${perm.menu_key} - ${perm.is_visible ? '可见' : '不可见'}`);
        });
      }
    }

    console.log('\n🎉 强制更新AI工具菜单完成！');
    console.log('\n建议操作:');
    console.log('1. 清除浏览器缓存 (Ctrl+Shift+Del)');
    console.log('2. 重新登录系统');
    console.log('3. 检查AI工具菜单是否显示');
  } catch (error) {
    console.error('强制更新AI工具菜单失败:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

// 运行脚本
forceUpdateAIMenu();
