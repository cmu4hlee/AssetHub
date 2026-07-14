const http = require('http');

/**
 * 通过API调用强制更新菜单（包括质量控制菜单）
 * 需要先登录获取token
 */
async function forceUpdateMenusViaAPI() {
  return new Promise((resolve, reject) => {
    // 这里需要先登录获取token
    // 为了简化，我们直接调用后端的forceUpdateMenus函数
    console.log('提示：请通过以下方式之一添加菜单：');
    console.log('\n方法1：通过前端界面');
    console.log('  1. 登录系统（系统管理员账号）');
    console.log('  2. 进入"角色和权限管理"页面');
    console.log('  3. 点击"强制更新菜单"按钮');
    console.log('\n方法2：直接运行后端脚本（需要数据库连接）');
    console.log('  运行: node scripts/force-update-menus.js');
    console.log('\n方法3：通过API调用（需要token）');
    console.log('  POST http://localhost:5174/api/roles-permissions/menus/force-update');
    console.log('  Headers: Authorization: Bearer <token>');

    resolve();
  });
}

// 直接导入并使用后端的forceUpdateMenus函数
async function addMenuDirect() {
  try {
    console.log('正在使用后端数据库连接添加菜单...\n');

    // 导入后端的forceUpdateMenus函数
    const { forceUpdateMenus } = require('../routes/roles-permissions');

    // 由于forceUpdateMenus不是导出的，我们需要直接调用数据库
    const db = require('../config/database');

    // 检查表是否存在
    try {
      await db.execute('SELECT 1 FROM menu_definitions LIMIT 1');
    } catch (tableError) {
      if (tableError.code === 'ER_NO_SUCH_TABLE') {
        console.log('❌ 菜单定义表不存在！');
        console.log('请先运行: node scripts/create-menu-permissions-table.js');
        process.exit(1);
      }
      throw tableError;
    }

    // 检查是否已有质量控制菜单
    const [existing] = await db.execute(
      'SELECT menu_key, menu_label FROM menu_definitions WHERE menu_key LIKE "/quality-control%"',
    );

    if (existing.length > 0) {
      console.log('📋 已存在的质量控制菜单：');
      existing.forEach(menu => {
        console.log(`  - ${menu.menu_label} (${menu.menu_key})`);
      });
      console.log('\n✅ 质量控制菜单已存在！');
      process.exit(0);
    }

    // 定义要添加的菜单
    const qualityControlMenus = [
      {
        menu_key: '/quality-control-parent',
        menu_label: '质量控制',
        parent_key: null,
        icon: 'ExperimentOutlined',
        order_index: 9,
      },
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

    console.log('开始添加质量控制菜单...\n');

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

    // 为所有角色设置菜单权限
    console.log('\n正在设置菜单权限...\n');

    const [roles] = await db.execute('SELECT role_code FROM roles');
    const [menus] = await db.execute(
      'SELECT menu_key FROM menu_definitions WHERE menu_key LIKE "/quality-control%"',
    );

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
      console.log(`✓ 已为角色 ${roleCode} 设置菜单权限（系统管理员可见，其他角色不可见）`);
    }

    // 验证添加结果
    console.log('\n验证添加结果...\n');
    const [result] = await db.execute(
      `SELECT menu_key, menu_label, parent_key, is_active 
       FROM menu_definitions 
       WHERE menu_key LIKE "/quality-control%" 
       ORDER BY order_index`,
    );

    console.log('✅ 质量控制菜单列表：');
    result.forEach(menu => {
      const status = menu.is_active ? '✅' : '❌';
      const parent = menu.parent_key ? `(父菜单: ${menu.parent_key})` : '(一级菜单)';
      console.log(`  ${status} ${menu.menu_label} (${menu.menu_key}) ${parent}`);
    });

    console.log('\n✅ 质量控制菜单添加完成！');
    console.log('\n提示：');
    console.log('  1. 刷新浏览器页面（或重新登录）');
    console.log('  2. 检查左侧菜单是否出现"质量控制"菜单项');
    console.log('  3. 如果仍然看不到，请检查用户角色权限设置');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ 添加菜单失败:', error.message);
    if (error.code) {
      console.error(`错误代码: ${error.code}`);
    }
    console.error(error.stack);
    process.exit(1);
  }
}

// 执行脚本
if (require.main === module) {
  addMenuDirect();
}

module.exports = addMenuDirect;
