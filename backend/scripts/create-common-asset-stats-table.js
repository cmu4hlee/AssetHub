const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// 数据库配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'zcgl',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

async function createCommonAssetStatsTable() {
  let connection;

  try {
    // 创建数据库连接
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功');

    // 创建通用资产统计表
    const createTableSql = `
      CREATE TABLE IF NOT EXISTS common_asset_stats (
        id INT(11) NOT NULL AUTO_INCREMENT,
        department_id INT(11) NOT NULL,
        asset_name VARCHAR(100) NOT NULL,
        count INT(11) NOT NULL DEFAULT 0,
        tenant_id INT(11) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NULL DEFAULT NULL,
        PRIMARY KEY (id),
        UNIQUE KEY uk_department_asset (department_id, asset_name),
        INDEX idx_tenant_id (tenant_id),
        INDEX idx_asset_name (asset_name),
        FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    `;

    await connection.execute(createTableSql);
    console.log('✅ common_asset_stats表创建成功');

    console.log('\n🎉 所有表创建完成！');
  } catch (error) {
    console.error('❌ 数据库操作失败:', error.message);
  } finally {
    // 关闭数据库连接
    if (connection) {
      await connection.end();
      console.log('✅ 数据库连接已关闭');
    }
  }
}

// 执行函数
createCommonAssetStatsTable();
