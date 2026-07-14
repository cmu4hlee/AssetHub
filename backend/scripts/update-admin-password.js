const bcrypt = require('bcryptjs');
const db = require('../config/database');

async function updateAdminPassword() {
  try {
    const password = '***TEST_PASSWORD***';
    const hashedPassword = await bcrypt.hash(password, 10);

    console.log('生成的密码哈希:', hashedPassword);

    // 更新系统管理员密码
    await db.execute('UPDATE users SET password = ? WHERE username = ?', [hashedPassword, 'admin']);

    console.log('系统管理员密码更新成功');
    console.log('用户名: admin');
    console.log('密码: admin123');
  } catch (error) {
    console.error('更新密码失败:', error);
  }
}

updateAdminPassword();
