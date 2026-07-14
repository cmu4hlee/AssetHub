/**
 * 删除质量管理菜单下的"质量管理"二级菜单项
 */

require('dotenv').config();
const mysql = require('mysql2/promise');
const { database: databaseConfig } = require('../config/app.config');

async function removeQualityManagementMenu() {
  let connection;
  try {
    console.log('开始删除"质量管理"二级菜单项...\n');

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

    // 检查菜单是否存在
    const [menus] = await connection.execute('SELECT * FROM menu_definitions WHERE menu_key = ?', [
      '/quality-control/quality-control',
    ]);

    if (menus.length === 0) {
      console.log('⚠️ 菜单项不存在，无需删除\n');
    } else {
      const menu = menus[0];
      console.log(`找到菜单项: ${menu.menu_label} (${menu.menu_key})\n`);

      // 删除菜单权限
      await connection.execute('DELETE FROM role_menu_permissions WHERE menu_key = ?', [
        '/quality-control/quality-control',
      ]);
      console.log('✓ 已删除菜单权限\n');

      // 删除菜单定义
      await connection.execute('DELETE FROM menu_definitions WHERE menu_key = ?', [
        '/quality-control/quality-control',
      ]);
      console.log('✓ 已删除菜单定义\n');
    }

    // 更新其他菜单的排序
    await connection.execute('UPDATE menu_definitions SET order_index = ? WHERE menu_key = ?', [
      1,
      '/quality-control/metrology',
    ]);
    console.log('✓ 计量管理菜单排序已更新为 1\n');

    await connection.execute('UPDATE menu_definitions SET order_index = ? WHERE menu_key = ?', [
      2,
      '/quality-control/qc',
    ]);
    console.log('✓ 质控管理菜单排序已更新为 2\n');

    // 显示更新后的菜单结构
    const [updatedMenus] = await connection.execute(`
      SELECT menu_key, menu_label, parent_key, order_index
      FROM menu_definitions
      WHERE menu_key LIKE '/quality-control%'
      ORDER BY order_index, id
    `);

    console.log('更新后的菜单结构:');
    console.log('─────────────────────────────────────');
    updatedMenus.forEach(menu => {
      const indent = menu.parent_key ? '  └─ ' : '';
      console.log(`${indent}${menu.menu_label} (${menu.menu_key}) [排序: ${menu.order_index}]`);
    });
    console.log('─────────────────────────────────────\n');

    await connection.end();
    console.log('✅ 菜单删除完成！');
    return true;
  } catch (error) {
    console.error('\n❌ 删除失败:');
    console.error('错误代码:', error.code);
    console.error('错误消息:', error.message);
    console.error('错误堆栈:', error.stack);
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

// 运行删除
removeQualityManagementMenu()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('脚本执行异常:', error);
    process.exit(1);
  });
