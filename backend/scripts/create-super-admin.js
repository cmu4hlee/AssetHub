/**
 * 创建超级管理员用户脚本
 * 用户名: suadmin
 * 密码: 123
 * 角色: super_admin
 */

const db = require('../config/database');
const bcrypt = require('bcryptjs');

async function createSuperAdmin() {
  try {
    console.log('开始创建超级管理员用户...');

    // 检查用户是否已存在
    const [existingUsers] = await db.execute('SELECT id FROM users WHERE username = ?', [
      'suadmin',
    ]);

    if (existingUsers.length > 0) {
      console.log('超级管理员用户已存在，更新密码和角色...');
      const userId = existingUsers[0].id;

      // 加密密码
      const hashedPassword = await bcrypt.hash('123', 10);

      // 更新用户信息
      await db.execute(
        'UPDATE users SET password = ?, role = ?, status = ?, tenant_id = NULL WHERE id = ?',
        [hashedPassword, 'super_admin', 'active', userId],
      );

      console.log('✅ 超级管理员用户更新成功');
      console.log('   用户名: suadmin');
      console.log('   密码: 123');
      console.log('   角色: super_admin');
    } else {
      // 创建新用户
      const hashedPassword = await bcrypt.hash('123', 10);

      const [result] = await db.execute(
        `INSERT INTO users (
          username, password, real_name, role, status, tenant_id
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        ['suadmin', hashedPassword, '超级管理员', 'super_admin', 'active', null],
      );

      console.log('✅ 超级管理员用户创建成功');
      console.log('   用户ID:', result.insertId);
      console.log('   用户名: suadmin');
      console.log('   密码: 123');
      console.log('   角色: super_admin');
    }

    // 验证创建结果
    const [verifyUsers] = await db.execute(
      'SELECT id, username, role, status, tenant_id FROM users WHERE username = ?',
      ['suadmin'],
    );

    if (verifyUsers.length > 0) {
      const user = verifyUsers[0];
      console.log('\n验证结果:');
      console.log('   用户ID:', user.id);
      console.log('   用户名:', user.username);
      console.log('   角色:', user.role);
      console.log('   状态:', user.status);
      console.log(
        '   租户ID:',
        user.tenant_id === null ? '无（超级管理员不关联租户）' : user.tenant_id,
      );
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ 创建超级管理员失败:', error);
    process.exit(1);
  }
}

// 执行脚本
createSuperAdmin();
