/**
 * 创建超级管理员账号 (su) 脚本
 * 使用说明：
 *   node create-su-account.js
 * 
 * 环境变量：
 *   DB_HOST - 数据库地址（默认: 127.0.0.1）
 *   DB_PORT - 数据库端口（默认: 3306）
 *   DB_USER - 数据库用户名（默认: root）
 *   DB_PASSWORD - 数据库密码（必填）
 *   DB_NAME - 数据库名称（默认: zcgl）
 *   SU_PASSWORD - su账号密码（默认: 123）
 */

const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

async function createSuAccount() {
  const dbConfig = {
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'zcgl',
  };

  if (!dbConfig.password) {
    console.error('❌ 错误: 未设置数据库密码环境变量 DB_PASSWORD！');
    console.error('请运行: export DB_PASSWORD="your-db-password"');
    process.exit(1);
  }

  const suPassword = process.env.SU_PASSWORD || '123';

  const connection = await mysql.createConnection(dbConfig);

  try {
    console.log('=== 创建su账号 ===');

    const [existingUsers] = await connection.query("SELECT id FROM users WHERE username = 'su'");

    if (existingUsers.length > 0) {
      console.log('su账号已存在，将更新密码...');
      const hashedPassword = await bcrypt.hash(suPassword, 10);
      await connection.query(
        "UPDATE users SET password = ?, status = 'active', tenant_id = NULL WHERE username = 'su'",
        [hashedPassword],
      );
      console.log('✅ su账号密码已更新');
    } else {
      console.log('正在创建su账号...');
      const hashedPassword = await bcrypt.hash(suPassword, 10);
      await connection.query(
        'INSERT INTO users (username, password, real_name, status, tenant_id) VALUES (?, ?, ?, ?, ?)',
        ['su', hashedPassword, '超级管理员', 'active', null],
      );
      console.log('✅ su账号创建成功');
    }

    const [users] = await connection.query(
      "SELECT id, username, real_name, status, tenant_id FROM users WHERE username = 'su'",
    );

    if (users.length > 0) {
      const user = users[0];
      console.log('\n账号信息:');
      console.log('  用户ID:', user.id);
      console.log('  用户名:', user.username);
      console.log('  姓名:', user.real_name);
      console.log('  状态:', user.status);
      console.log('  租户ID:', user.tenant_id || '无（超级管理员）');
    }

    console.log('\n⚠️  请尽快修改su账号的默认密码！');

  } catch (error) {
    console.error('❌ 操作失败:', error.message);
  } finally {
    await connection.end();
  }
}

createSuAccount();
