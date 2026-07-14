const mysql = require('mysql2/promise');
const { database: dbConfig } = require('../config/app.config');

async function createAIAssistantMenu() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: dbConfig.master.host,
      port: dbConfig.master.port,
      user: dbConfig.master.user,
      password: dbConfig.master.password,
      database: dbConfig.master.database,
    });

    console.log('数据库连接成功！\n');

    // 创建父菜单 - 资产AI助手
    await connection.execute(
      "INSERT INTO menu_definitions (menu_key, menu_label, parent_key, icon, order_index, is_active) VALUES ('/ai-assistant-parent', '资产AI助手', NULL, 'RobotOutlined', 15, 1) ON DUPLICATE KEY UPDATE menu_label = VALUES(menu_label)",
    );
    console.log('✓ 已创建/更新父菜单: 资产AI助手');

    // 创建子菜单 - 统一AI入口
    await connection.execute(
      "INSERT INTO menu_definitions (menu_key, menu_label, parent_key, icon, order_index, is_active) VALUES ('/ai-assistant', '统一AI入口', '/ai-assistant-parent', 'AppstoreOutlined', 1, 1) ON DUPLICATE KEY UPDATE menu_label = VALUES(menu_label)",
    );
    console.log('✓ 已创建子菜单: 统一AI入口');

    // 查询验证
    const [menus] = await connection.execute(
      "SELECT id, menu_key, menu_label, parent_key FROM menu_definitions WHERE menu_key = '/ai-assistant-parent' OR parent_key = '/ai-assistant-parent' ORDER BY order_index",
    );

    console.log('\n========== 当前菜单结构 ==========');
    menus.forEach(m => {
      console.log(`  ${m.menu_key} -> ${m.menu_label} (父: ${m.parent_key || '无'})`);
    });
    console.log('==================================\n');

    await connection.end();
    console.log('✅ 菜单创建完成！');

  } catch (error) {
    console.error('\n❌ 操作失败:', error.message);
    if (connection) {
      try {
        await connection.end();
      } catch (_error) {
        // Ignore cleanup errors while closing the connection.
      }
    }
  }
}

createAIAssistantMenu();
