// 加载环境变量
const path = require('path');
const fs = require('fs');
const envPath = path.join(__dirname, '../.env');
const parentEnvPath = path.join(__dirname, '../../.env');

if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
} else if (fs.existsSync(parentEnvPath)) {
  require('dotenv').config({ path: parentEnvPath });
} else {
  require('dotenv').config();
}

const db = require('../config/database');

async function fixAIToolsMenu() {
  try {
    console.log('修复AI工具菜单定义...\n');

    // 1. 确保AI工具父菜单存在
    console.log('1. 检查/创建AI工具父菜单...');
    await db.execute(`
      INSERT INTO menu_definitions (menu_key, menu_label, parent_key, icon, order_index, is_active)
      VALUES ('/ai-tools-parent', 'AI工具', NULL, 'RobotOutlined', 3, 1)
      ON DUPLICATE KEY UPDATE
        menu_label = VALUES(menu_label),
        parent_key = VALUES(parent_key),
        icon = VALUES(icon),
        order_index = VALUES(order_index),
        is_active = 1,
        updated_at = CURRENT_TIMESTAMP
    `);
    console.log('  ✅ AI工具父菜单已创建/更新');

    // 2. 修复AI分析菜单的父菜单
    console.log('\n2. 修复AI分析菜单的父菜单...');
    await db.execute(`
      UPDATE menu_definitions
      SET parent_key = '/ai-tools-parent',
          order_index = 1,
          is_active = 1,
          updated_at = CURRENT_TIMESTAMP
      WHERE menu_key = '/asset-ai-analysis'
    `);
    const [aiAnalysis] = await db.execute(
      "SELECT * FROM menu_definitions WHERE menu_key = '/asset-ai-analysis'",
    );
    if (aiAnalysis.length > 0) {
      console.log(`  ✅ AI分析菜单已更新，父菜单: ${aiAnalysis[0].parent_key}`);
    } else {
      // 如果不存在，创建它
      await db.execute(`
        INSERT INTO menu_definitions (menu_key, menu_label, parent_key, icon, order_index, is_active)
        VALUES ('/asset-ai-analysis', 'AI分析', '/ai-tools-parent', NULL, 1, 1)
      `);
      console.log('  ✅ AI分析菜单已创建');
    }

    // 3. 确保提问记录菜单存在
    console.log('\n3. 检查/创建提问记录菜单...');
    await db.execute(`
      INSERT INTO menu_definitions (menu_key, menu_label, parent_key, icon, order_index, is_active)
      VALUES ('/ai-question-records', '提问记录', '/ai-tools-parent', NULL, 2, 1)
      ON DUPLICATE KEY UPDATE
        menu_label = VALUES(menu_label),
        parent_key = VALUES(parent_key),
        icon = VALUES(icon),
        order_index = VALUES(order_index),
        is_active = 1,
        updated_at = CURRENT_TIMESTAMP
    `);
    console.log('  ✅ 提问记录菜单已创建/更新');

    // 4. 为所有角色设置AI工具菜单权限（系统管理员可见）
    console.log('\n4. 更新角色菜单权限...');
    // 从role_menu_permissions表中获取所有角色
    const [roles] = await db.execute('SELECT DISTINCT role FROM role_menu_permissions');
    const aiMenuKeys = ['/ai-tools-parent', '/asset-ai-analysis', '/ai-question-records'];

    if (roles.length === 0) {
      // 如果没有角色，使用默认角色列表
      const defaultRoles = [
        'super_admin',
        'system_admin',
        'asset_admin',
        'department_admin',
        'user',
      ];
      for (const role of defaultRoles) {
        for (const menuKey of aiMenuKeys) {
          // 系统管理员和超级管理员可见，其他角色不可见
          const isVisible = role === 'system_admin' || role === 'super_admin' ? 1 : 0;
          await db.execute(
            `
            INSERT INTO role_menu_permissions (role, menu_key, is_visible)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE is_visible = VALUES(is_visible)
          `,
            [role, menuKey, isVisible],
          );
        }
        console.log(`  ✅ ${role} 角色的AI工具菜单权限已更新`);
      }
    } else {
      for (const roleRow of roles) {
        const { role } = roleRow;
        for (const menuKey of aiMenuKeys) {
          // 系统管理员和超级管理员可见，其他角色不可见
          const isVisible = role === 'system_admin' || role === 'super_admin' ? 1 : 0;
          await db.execute(
            `
            INSERT INTO role_menu_permissions (role, menu_key, is_visible)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE is_visible = VALUES(is_visible)
          `,
            [role, menuKey, isVisible],
          );
        }
        console.log(`  ✅ ${role} 角色的AI工具菜单权限已更新`);
      }
    }

    // 5. 验证结果
    console.log('\n5. 验证修复结果...');
    const [aiMenus] = await db.execute(`
      SELECT * FROM menu_definitions
      WHERE menu_key IN ('/ai-tools-parent', '/asset-ai-analysis', '/ai-question-records')
      ORDER BY order_index
    `);

    console.log('\nAI工具菜单结构:');
    aiMenus.forEach(menu => {
      console.log(`  ${menu.is_active ? '✅' : '❌'} ${menu.menu_label} (${menu.menu_key})`);
      console.log(`     父菜单: ${menu.parent_key || '无'}`);
      console.log(`     排序: ${menu.order_index}`);
    });

    console.log('\n✅ AI工具菜单修复完成！');
    process.exit(0);
  } catch (error) {
    console.error('❌ 修复失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

if (require.main === module) {
  fixAIToolsMenu();
}

module.exports = fixAIToolsMenu;
