/**
 * 将所有现有用户更新为"中国医科大学附属第四医院"企业
 */

require('dotenv').config();
const mysql = require('mysql2/promise');
const { database: databaseConfig } = require('../config/app.config');

async function updateAllUsersToDefaultTenant() {
  let connection;
  try {
    console.log('开始更新所有用户到默认企业...\n');

    // 创建数据库连接
    connection = await mysql.createConnection({
      host: databaseConfig.host,
      port: databaseConfig.port,
      user: databaseConfig.user,
      password: databaseConfig.password,
      database: databaseConfig.database,
      connectTimeout: 10000,
    });

    console.log('✓ 数据库连接成功\n');

    // 查找"中国医科大学附属第四医院"的企业ID
    const [tenants] = await connection.execute(
      'SELECT id, tenant_code, tenant_name FROM tenants WHERE tenant_code = ? OR tenant_name LIKE ?',
      ['001', '%中国医科大学附属第四医院%'],
    );

    if (tenants.length === 0) {
      console.error('❌ 未找到"中国医科大学附属第四医院"企业，请先创建该企业');
      return false;
    }

    const tenant = tenants[0];
    console.log(
      `✓ 找到企业: ${tenant.tenant_name} (编码: ${tenant.tenant_code}, ID: ${tenant.id})\n`,
    );

    // 统计现有用户数量
    const [userCount] = await connection.execute('SELECT COUNT(*) as count FROM users');
    console.log(`当前用户总数: ${userCount[0].count}\n`);

    // 更新所有用户的 tenant_id
    const [updateResult] = await connection.execute(
      'UPDATE users SET tenant_id = ? WHERE tenant_id IS NULL OR tenant_id != ?',
      [tenant.id, tenant.id],
    );

    console.log(`✓ 已更新 ${updateResult.affectedRows} 个用户的 tenant_id\n`);

    // 验证更新结果
    const [verifyResult] = await connection.execute(
      'SELECT COUNT(*) as count FROM users WHERE tenant_id = ?',
      [tenant.id],
    );
    console.log(`✓ 验证：当前有 ${verifyResult[0].count} 个用户属于该企业\n`);

    // 统计仍没有 tenant_id 的用户
    const [nullTenantCount] = await connection.execute(
      'SELECT COUNT(*) as count FROM users WHERE tenant_id IS NULL',
    );
    if (nullTenantCount[0].count > 0) {
      console.log(`⚠️  警告：仍有 ${nullTenantCount[0].count} 个用户的 tenant_id 为空\n`);
    }

    await connection.end();
    console.log('✅ 更新完成！');
    return true;
  } catch (error) {
    console.error('\n❌ 更新失败:');
    console.error('错误代码:', error.code);
    console.error('错误消息:', error.message);
    if (connection) {
      try {
        await connection.end();
      } catch (e) {
        // 忽略关闭错误
      }
    }
    return false;
  }
}

// 运行更新
updateAllUsersToDefaultTenant()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('脚本执行异常:', error);
    process.exit(1);
  });
