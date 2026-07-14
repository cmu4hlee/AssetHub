const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

async function initUsers() {
  const config = {
    host: process.env.DB_HOST || '192.168.1.111',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'Cmu19801008',
    database: process.env.DB_NAME || 'zcgl'
  };

  console.log('==========================================');
  console.log('  AssetHub 用户初始化');
  console.log('==========================================');
  console.log('');
  console.log('数据库配置:');
  console.log('  Host:', config.host);
  console.log('  Port:', config.port);
  console.log('  Database:', config.database);
  console.log('');

  const connection = await mysql.createConnection(config);

  try {
    // 创建/更新 su 账号
    console.log('正在处理用户: su');
    
    const username = 'su';
    const realName = 'Super Admin';
    const password = '123';
    const hashedPassword = await bcrypt.hash(password, 10);

    const [existingUsers] = await connection.query(
      'SELECT id, username FROM users WHERE username = ?',
      [username]
    );

    if (existingUsers.length > 0) {
      console.log('  用户已存在，更新密码...');
      await connection.query(
        'UPDATE users SET password = ?, status = ?, tenant_id = NULL WHERE username = ?',
        [hashedPassword, 'active', username]
      );
      console.log('  ✅ 用户密码已更新');
    } else {
      console.log('  创建新用户...');
      await connection.query(
        'INSERT INTO users (username, password, real_name, status, tenant_id) VALUES (?, ?, ?, ?, NULL)',
        [username, hashedPassword, realName, 'active']
      );
      console.log('  ✅ 用户创建成功');
    }

    // 验证用户
    const [users] = await connection.query(
      'SELECT id, username, real_name, status FROM users WHERE username = ?',
      [username]
    );

    if (users.length > 0) {
      const user = users[0];
      console.log('');
      console.log('==========================================');
      console.log('  ✅ 用户初始化完成！');
      console.log('==========================================');
      console.log('');
      console.log('账户信息:');
      console.log('  ID:', user.id);
      console.log('  用户名:', user.username);
      console.log('  姓名:', user.real_name);
      console.log('  状态:', user.status);
      console.log('');
      console.log('登录凭证:');
      console.log('  用户名:', username);
      console.log('  密码:', password);
      console.log('');
    }

  } catch (error) {
    console.error('');
    console.error('❌ 错误:', error.message);
    console.error('');
    throw error;
  } finally {
    await connection.end();
  }
}

initUsers().catch((err => {
  console.error('初始化失败:', err);
  process.exit(1);
});
