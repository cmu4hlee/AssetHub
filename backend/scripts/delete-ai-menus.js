const mysql = require('mysql2/promise');
const { database: dbConfig } = require('../config/app.config');

async function deleteAIMenus() {
  let connection;
  try {
    console.log('正在连接数据库...\n');

    connection = await mysql.createConnection({
      host: dbConfig.master.host,
      port: dbConfig.master.port,
      user: dbConfig.master.user,
      password: dbConfig.master.password,
      database: dbConfig.master.database,
    });

    console.log('数据库连接成功！\n');

    // 删除资产AI助手子菜单
    const [result1] = await connection.execute(
      "DELETE FROM menu_definitions WHERE menu_key IN ('/ai-assistant', '/asset-ai-analysis', '/ai-question-records', '/ai-maintenance') OR parent_key = '/ai-assistant-parent'",
    );
    console.log(`✓ 已删除4个AI助手子菜单，影响 ${result1.affectedRows} 行`);

    // 删除资产AI助手父菜单
    const [result2] = await connection.execute(
      "DELETE FROM menu_definitions WHERE menu_key = '/ai-assistant-parent'",
    );
    console.log(`✓ 已删除父菜单 /ai-assistant-parent，影响 ${result2.affectedRows} 行`);

    // 删除技术资料下的AI智能助手
    const [result3] = await connection.execute(
      "DELETE FROM menu_definitions WHERE menu_key = '/technical-documents/ai'",
    );
    console.log(`✓ 已删除技术资料下的AI智能助手，影响 ${result3.affectedRows} 行`);

    // 查询验证
    const [menus] = await connection.execute(
      "SELECT id, menu_key, menu_label, parent_key FROM menu_definitions WHERE menu_key LIKE '%ai%' OR parent_key LIKE '%ai%' ORDER BY parent_key, order_index",
    );

    console.log('\n========== 删除后所有AI相关菜单 ==========');
    if (menus.length === 0) {
      console.log('(无AI相关菜单，已全部删除)');
    } else {
      menus.forEach(m => {
        console.log(`  ${m.menu_key} -> ${m.menu_label} (父: ${m.parent_key || '无'})`);
      });
    }
    console.log('==========================================\n');

    await connection.end();
    console.log('✅ 所有AI菜单已删除完成！');
    console.log('\n提示：如需保留统一AI助手功能，请重新创建菜单。');

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

deleteAIMenus();
