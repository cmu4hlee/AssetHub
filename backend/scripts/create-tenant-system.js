/**
 * 创建多租户（企业）系统
 * 支持多个企业独立使用系统
 */

require('dotenv').config();
const mysql = require('mysql2/promise');
const { database: databaseConfig } = require('../config/app.config');

async function createTenantSystem() {
  let connection;
  try {
    console.log('开始创建多租户系统...\n');

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

    // 1. 创建租户（企业）表
    console.log('正在创建 tenants 表...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS tenants (
        id INT PRIMARY KEY AUTO_INCREMENT,
        tenant_code VARCHAR(50) NOT NULL UNIQUE COMMENT '租户编码',
        tenant_name VARCHAR(200) NOT NULL COMMENT '企业名称',
        contact_person VARCHAR(50) COMMENT '联系人',
        contact_phone VARCHAR(50) COMMENT '联系电话',
        contact_email VARCHAR(100) COMMENT '联系邮箱',
        address TEXT COMMENT '企业地址',
        license_no VARCHAR(100) COMMENT '营业执照号',
        status ENUM('active', 'inactive', 'suspended') DEFAULT 'active' COMMENT '状态',
        max_users INT DEFAULT 100 COMMENT '最大用户数',
        max_assets INT DEFAULT 10000 COMMENT '最大资产数',
        subscription_type ENUM('free', 'basic', 'professional', 'enterprise') DEFAULT 'free' COMMENT '订阅类型',
        subscription_start_date DATE COMMENT '订阅开始日期',
        subscription_end_date DATE COMMENT '订阅结束日期',
        remark TEXT COMMENT '备注',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NULL DEFAULT NULL,
        INDEX idx_tenant_code (tenant_code),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='租户（企业）表'
    `);
    console.log('✓ tenants 表创建成功\n');

    // 2. 修改用户表，添加租户关联
    console.log('正在修改 users 表，添加租户关联...');
    try {
      await connection.execute(`
        ALTER TABLE users 
        ADD COLUMN tenant_id INT COMMENT '租户ID' AFTER id,
        ADD INDEX idx_tenant_id (tenant_id),
        ADD FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
      `);
      console.log('✓ users 表已添加 tenant_id 字段\n');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('  - tenant_id 字段已存在，跳过\n');
      } else {
        throw error;
      }
    }

    // 3. 创建默认租户（用于现有数据迁移）
    console.log('正在创建默认租户...');
    await connection.execute(`
      INSERT INTO tenants (tenant_code, tenant_name, status, subscription_type)
      VALUES ('default', '默认企业', 'active', 'enterprise')
      ON DUPLICATE KEY UPDATE tenant_name = '默认企业'
    `);
    console.log('✓ 默认租户创建成功\n');

    // 4. 为现有用户分配默认租户
    console.log('正在为现有用户分配默认租户...');
    const [defaultTenant] = await connection.execute(
      'SELECT id FROM tenants WHERE tenant_code = ?',
      ['default'],
    );
    if (defaultTenant.length > 0) {
      await connection.execute('UPDATE users SET tenant_id = ? WHERE tenant_id IS NULL', [
        defaultTenant[0].id,
      ]);
      console.log('✓ 现有用户已分配默认租户\n');
    }

    // 5. 显示租户表结构
    const [tableInfo] = await connection.execute(
      `
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_COMMENT
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'tenants'
      ORDER BY ORDINAL_POSITION
    `,
      [databaseConfig.database],
    );

    console.log('tenants 表结构:');
    console.log('─────────────────────────────────────');
    tableInfo.forEach(col => {
      console.log(`  ${col.COLUMN_NAME} (${col.DATA_TYPE}) - ${col.COLUMN_COMMENT || ''}`);
    });
    console.log('─────────────────────────────────────\n');

    await connection.end();
    console.log('✅ 多租户系统创建完成！');
    console.log('\n下一步：');
    console.log('1. 运行脚本为所有业务表添加 tenant_id 字段');
    console.log('2. 修改所有查询接口，添加租户过滤');
    console.log('3. 更新登录流程，支持租户选择');
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
createTenantSystem()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('脚本执行异常:', error);
    process.exit(1);
  });
