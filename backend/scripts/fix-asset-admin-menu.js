const db = require('../config/database');

async function fixAssetAdminMenuPermissions() {
  try {
    console.log('=== 开始修复资产管理员菜单权限 ===');

    // 修复资产管理父菜单权限
    const [result] = await db.execute(
      'UPDATE role_menu_permissions SET is_visible = 1 WHERE role = ? AND menu_key = ?',
      ['asset_admin', '/assets-parent'],
    );

    console.log('资产管理父菜单修复结果:', result);

    // 验证修复结果
    const [rows] = await db.execute(
      'SELECT role, menu_key, is_visible FROM role_menu_permissions WHERE role = ? AND menu_key = ?',
      ['asset_admin', '/assets-parent'],
    );

    console.log('验证修复结果:', rows);

    // 同时修复其他相关的父菜单权限
    const menusToFix = ['/maintenance-parent', '/transfer-parent'];

    for (const menuKey of menusToFix) {
      const [fixResult] = await db.execute(
        'UPDATE role_menu_permissions SET is_visible = 1 WHERE role = ? AND menu_key = ?',
        ['asset_admin', menuKey],
      );
      console.log(`修复 ${menuKey}:`, fixResult);
    }

    console.log('=== 资产管理员菜单权限修复完成 ===');
  } catch (error) {
    console.error('修复菜单权限时出错:', error);
  } finally {
    // 关闭数据库连接
    if (db.end) {
      await db.end();
    }
  }
}

fixAssetAdminMenuPermissions();
