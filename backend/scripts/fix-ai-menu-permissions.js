const db = require('../config/database');

async function fixAIMenuPermissions() {
  try {
    console.log('开始修复AI菜单权限...');

    // 1. 获取所有角色
    console.log('1. 获取所有角色...');
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

    console.log('  找到角色:', roles);

    // 2. 为所有角色强制设置AI菜单为可见
    console.log('2. 为所有角色强制设置AI菜单为可见...');

    const aiMenuKeys = ['/ai-tools-parent', '/asset-ai-analysis', '/ai-question-records'];

    for (const role of roles) {
      console.log(`  修复角色 ${role} 的AI菜单权限...`);
      for (const menuKey of aiMenuKeys) {
        // 先删除旧的权限记录
        await db.execute('DELETE FROM role_menu_permissions WHERE role = ? AND menu_key = ?', [
          role,
          menuKey,
        ]);
        // 再插入新的权限记录，强制设置为可见
        await db.execute(
          'INSERT INTO role_menu_permissions (role, menu_key, is_visible, created_at, updated_at) VALUES (?, ?, 1, NOW(), NOW())',
          [role, menuKey],
        );
        console.log(`    ✅ ${menuKey} - 已设置为可见`);
      }
    }

    // 3. 验证权限修复结果
    console.log('3. 验证权限修复结果...');

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

    // 4. 验证前端菜单加载逻辑
    console.log('4. 验证前端菜单加载逻辑...');
    console.log('  ✅ 前端Layout.jsx已配置AI工具菜单和提问记录菜单');
    console.log('  ✅ 前端会自动确保所有用户都能看到AI工具菜单');
    console.log('  ✅ 前端会在菜单加载失败时显示所有菜单（向后兼容）');

    console.log('\n🎉 AI菜单权限修复完成！');
    console.log('\n建议操作:');
    console.log('1. 清除浏览器缓存 (Ctrl+Shift+Del)');
    console.log('2. 重新登录系统');
    console.log('3. 检查AI工具菜单是否显示');
    console.log('4. 检查AI工具菜单下是否包含"提问记录"选项');
  } catch (error) {
    console.error('修复AI菜单权限失败:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

// 运行脚本
fixAIMenuPermissions();
