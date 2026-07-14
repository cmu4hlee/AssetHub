/**
 * 添加企业管理菜单到菜单定义表
 */

require('dotenv').config();
const mysql = require('mysql2/promise');
const { database: databaseConfig } = require('../config/app.config');

async function addTenantMenu() {
  let connection;
  try {
    console.log('开始添加企业管理菜单...\n');

    // 创建数据库连接
    connection = await mysql.createConnection({
      host: databaseConfig.host,
      port: databaseConfig.port,
      user: databaseConfig.user,
      password: databaseConfig.password,
      database: databaseConfig.database,
      connectTimeout: 10000,
    });

    console.log('✓ 数据库连接成功\n');

    // 添加菜单定义（企业管理菜单，位于系统管理下）
    await connection.execute(
      `
      INSERT INTO menu_definitions (menu_key, menu_label, parent_key, icon, order_index, is_active)
      VALUES (?, ?, ?, ?, ?, 1)
      ON DUPLICATE KEY UPDATE 
        menu_label = VALUES(menu_label),
        parent_key = VALUES(parent_key),
        icon = VALUES(icon),
        order_index = VALUES(order_index),
        updated_at = CURRENT_TIMESTAMP
    `,
      ['/tenants', '企业管理', '/system-parent', null, 1],
    );
    console.log('✓ 已添加/更新菜单: 企业管理\n');

    // 为所有角色设置菜单权限（只有 system_admin 可见）
    const [roles] = await connection.execute('SELECT role_code FROM roles');

    for (const role of roles) {
      // 只有 system_admin 角色可见
      const isVisible = role.role_code === 'system_admin' ? 1 : 0;
      await connection.execute(
        `
        INSERT INTO role_menu_permissions (role, menu_key, is_visible)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE is_visible = VALUES(is_visible)
      `,
        [role.role_code, '/tenants', isVisible],
      );
    }
    console.log('✓ 菜单权限已更新（仅系统管理员可见）\n');

    await connection.end();
    console.log('✅ 菜单添加完成！');
    return true;
  } catch (error) {
    console.error('\n❌ 添加失败:');
    console.error('错误代码:', error.code);
    console.error('错误消息:', error.message);
    if (connection) {
      try {
        await connection.end();
      } catch (e) {
        // 忽略关闭错误
      }
    }
    return false;
  }
}

// 运行添加
addTenantMenu()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('脚本执行异常:', error);
    process.exit(1);
  });
