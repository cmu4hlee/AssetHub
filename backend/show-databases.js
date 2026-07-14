const mysql = require('mysql2/promise');
const { database: dbConfig } = require('./config/app.config');

async function showRemoteDatabases() {
  try {
    console.log('=== 查看远程MySQL数据库列表 ===');
    console.log(`连接到: ${dbConfig.host}:${dbConfig.port}`);
    console.log(`用户名: ${dbConfig.user}`);
    console.log('==============================\n');

    // 创建连接（不指定数据库名，以便查看所有数据库）
    const connection = await mysql.createConnection({
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      password: dbConfig.password,
      charset: 'utf8mb4',
      timezone: '+08:00',
    });

    console.log('✅ 成功连接到远程MySQL服务器');

    // 查看数据库列表
    const [databases] = await connection.execute('SHOW DATABASES');

    console.log('\n📋 远程数据库列表:');
    console.log('------------------');
    databases.forEach((db, index) => {
      console.log(`${index + 1}. ${db.Database}`);
    });

    console.log(`\n✅ 共找到 ${databases.length} 个数据库`);

    // 查看当前项目使用的数据库中的表
    console.log(`\n📋 项目数据库 ${dbConfig.database} 中的表:`);
    console.log('---------------------------------');
    await connection.changeUser({ database: dbConfig.database });
    const [tables] = await connection.execute('SHOW TABLES');

    tables.forEach((table, index) => {
      const tableName = Object.values(table)[0];
      console.log(`${index + 1}. ${tableName}`);
    });

    console.log(`\n✅ 项目数据库共包含 ${tables.length} 个表`);

    // 关闭连接
    await connection.end();
    console.log('\n✅ 连接已关闭');
  } catch (error) {
    console.error('\n❌ 连接失败:', error.message);
    console.error('\n可能的原因：');
    console.error('1. 网络连接问题');
    console.error('2. 数据库服务器未运行');
    console.error('3. 用户名或密码错误');
    console.error('4. 远程访问权限未开启');
  } finally {
    process.exit();
  }
}

showRemoteDatabases();
