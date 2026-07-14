const db = require('../config/database');

// 等待数据库连接（最多重试3次）
async function waitForDatabase(maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await db.execute('SELECT 1');
      return true;
    } catch (error) {
      if (i < maxRetries - 1) {
        console.log(`数据库连接失败 (尝试 ${i + 1}/${maxRetries}): ${error.message}`);
        console.log('🔄 3000 毫秒后重试...');
        await new Promise(resolve => setTimeout(resolve, 3000));
      } else {
        throw error;
      }
    }
  }
  return false;
}

/**
 * 添加质量管理菜单到菜单定义表
 * 如果菜单已存在，则更新；如果不存在，则插入
 */
async function addQualityControlMenu() {
  try {
    console.log('开始添加质量管理菜单...');

    // 等待数据库连接
    await waitForDatabase();

    // 检查表是否存在
    try {
      await db.execute('SELECT 1 FROM menu_definitions LIMIT 1');
    } catch (tableError) {
      if (tableError.code === 'ER_NO_SUCH_TABLE') {
        console.log('菜单定义表不存在，请先运行 create-menu-permissions-table.js');
        process.exit(1);
      }
      throw tableError;
    }

    const qualityControlMenus = [
      // 一级菜单
      {
        menu_key: '/quality-control-parent',
        menu_label: '质量管理',
        parent_key: null,
        icon: 'ExperimentOutlined',
        order_index: 9,
      },
      // 子菜单
      {
        menu_key: '/quality-control/metrology',
        menu_label: '计量管理',
        parent_key: '/quality-control-parent',
        icon: null,
        order_index: 1,
      },
      {
        menu_key: '/quality-control/qc',
        menu_label: '质控管理',
        parent_key: '/quality-control-parent',
        icon: null,
        order_index: 2,
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

    for (const menu of qualityControlMenus) {
      await db.execute(insertMenuSQL, [
        menu.menu_key,
        menu.menu_label,
        menu.parent_key,
        menu.icon,
        menu.order_index,
      ]);
      console.log(`✓ 已添加/更新菜单: ${menu.menu_label} (${menu.menu_key})`);
    }

    // 为所有角色设置菜单权限（系统管理员可见，其他角色不可见）
    const [menus] = await db.execute(
      'SELECT menu_key FROM menu_definitions WHERE menu_key LIKE "/quality-control%"',
    );
    const [roles] = await db.execute('SELECT role_code FROM roles');

    for (const role of roles) {
      const roleCode = role.role_code;
      for (const menu of menus) {
        const isVisible = roleCode === 'system_admin' ? 1 : 0;
        await db.execute(
          `INSERT INTO role_menu_permissions (role, menu_key, is_visible)
           VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE is_visible = VALUES(is_visible)`,
          [roleCode, menu.menu_key, isVisible],
        );
      }
    }

    console.log('✅ 质量管理菜单添加完成！');
    console.log('✅ 已为所有角色设置菜单权限（系统管理员可见，其他角色不可见）');
    process.exit(0);
  } catch (error) {
    console.error('❌ 添加菜单失败:', error);
    process.exit(1);
  }
}

// 执行脚本
if (require.main === module) {
  addQualityControlMenu();
}

module.exports = addQualityControlMenu;
