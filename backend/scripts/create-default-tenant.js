/**
 * 创建默认租户：中国医科大学附属第四医院
 * 企业编码：001
 */

require('dotenv').config();
const mysql = require('mysql2/promise');
const { database: databaseConfig } = require('../config/app.config');

async function createDefaultTenant() {
  let connection;
  try {
    console.log('开始创建默认租户...\n');

    connection = await mysql.createConnection({
      host: databaseConfig.host,
      port: databaseConfig.port,
      user: databaseConfig.user,
      password: databaseConfig.password,
      database: databaseConfig.database,
      connectTimeout: 10000,
    });

    console.log('✓ 数据库连接成功\n');

    // 创建或更新租户
    await connection.execute(
      `
      INSERT INTO tenants (
        tenant_code, tenant_name, contact_person, contact_phone, 
        contact_email, address, status, max_users, max_assets, 
        subscription_type
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        tenant_name = VALUES(tenant_name),
        contact_person = VALUES(contact_person),
        contact_phone = VALUES(contact_phone),
        contact_email = VALUES(contact_email),
        address = VALUES(address),
        status = VALUES(status),
        max_users = VALUES(max_users),
        max_assets = VALUES(max_assets),
        subscription_type = VALUES(subscription_type),
        updated_at = NOW()
    `,
      [
        '001',
        '中国医科大学附属第四医院',
        null,
        null,
        null,
        null,
        'active',
        1000,
        100000,
        'enterprise',
      ],
    );

    console.log('✓ 租户创建/更新成功：中国医科大学附属第四医院（编码：001）\n');

    // 获取租户ID
    const [tenants] = await connection.execute('SELECT id FROM tenants WHERE tenant_code = ?', [
      '001',
    ]);

    if (tenants.length > 0) {
      const tenantId = tenants[0].id;

      // 为所有没有租户的用户分配此租户
      await connection.execute('UPDATE users SET tenant_id = ? WHERE tenant_id IS NULL', [
        tenantId,
      ]);
      console.log('✓ 已为所有无租户用户分配默认租户\n');
    }

    await connection.end();
    console.log('✅ 默认租户创建完成！');
    return true;
  } catch (error) {
    console.error('\n❌ 创建失败:');
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

// 运行创建
createDefaultTenant()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('脚本执行异常:', error);
    process.exit(1);
  });
