/**
 * 添加不良事件管理菜单到菜单定义表
 */

require('dotenv').config();
const mysql = require('mysql2/promise');
const { database: databaseConfig } = require('../config/app.config');

async function addAdverseReactionMenu() {
  let connection;
  try {
    console.log('开始添加不良事件管理菜单...\n');

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

    // 添加菜单定义
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
      ['/adverse-reaction', '不良事件管理', null, 'WarningOutlined', 10],
    );
    console.log('✓ 已添加/更新菜单: 不良事件管理\n');

    // 为所有角色设置菜单权限
    const [roles] = await connection.execute('SELECT role_code FROM roles');
    const isVisible = 1; // 所有角色可见

    for (const role of roles) {
      await connection.execute(
        `
        INSERT INTO role_menu_permissions (role, menu_key, is_visible)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE is_visible = VALUES(is_visible)
      `,
        [role.role_code, '/adverse-reaction', isVisible],
      );
    }
    console.log('✓ 菜单权限已更新\n');

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
addAdverseReactionMenu()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('脚本执行异常:', error);
    process.exit(1);
  });
