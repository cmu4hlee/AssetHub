/**
 * 重置用户密码脚本
 * 使用说明：
 *   node reset-password.js [username] [password]
 * 
 * 示例：
 *   node reset-password.js admin "my-new-password"
 * 
 * 如果不提供参数，将通过环境变量读取：
 *   RESET_USERNAME - 要重置密码的用户名（默认: admin）
 *   RESET_PASSWORD - 新密码（必须设置）
 */

const bcrypt = require('bcryptjs');
const db = require('./config/database');

async function resetPassword() {
  // 从命令行参数或环境变量获取用户名和密码
  const username = process.argv[2] || process.env.RESET_USERNAME || 'admin';
  const password = process.argv[3] || process.env.RESET_PASSWORD || '';

  if (!password) {
    console.error('❌ 错误: 未提供密码！');
    console.error('请通过以下方式之一提供密码：');
    console.error('  1. 命令行参数: node reset-password.js [username] [password]');
    console.error('  2. 环境变量: export RESET_PASSWORD="your-password" && node reset-password.js');
    console.error('');
    console.error('⚠️  警告: 请勿在生产环境中直接使用此脚本，建议删除或修改默认密码');
    process.exit(1);
  }

  console.log(`🔑 重置用户 "${username}" 的密码`);

  try {
    // 生成密码哈希
    const hashedPassword = await bcrypt.hash(password, 10);

    // 更新用户密码
    const [result] = await db.execute(
      'UPDATE users SET password = ? WHERE username = ?',
      [hashedPassword, username],
    );

    if (result.affectedRows > 0) {
      console.log('✅ 密码更新成功');
    } else {
      console.log('❌ 未找到用户');
    }

  } catch (error) {
    console.error('重置密码失败:', error);
  } finally {
    db.end();
  }
}

resetPassword();
