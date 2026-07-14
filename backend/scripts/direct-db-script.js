const mysql = require('mysql2/promise');
require('dotenv').config();

// 从环境变量读取数据库配置
const DB_CONFIG = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectTimeout: parseInt(process.env.DB_CONNECT_TIMEOUT) || 10000,
  charset: 'utf8mb4',
  timezone: '+08:00',
};

// 主函数
async function runDirectDBQueries() {
  console.log('=== 开始直接连接数据库 ===');
  console.log(`开始时间: ${new Date().toISOString()}`);

  let connection = null;

  try {
    // 创建直接连接
    connection = await mysql.createConnection(DB_CONFIG);
    console.log('✅ 数据库连接成功');

    // 示例查询：获取数据库版本
    console.log('\n📋 执行示例查询：获取数据库版本');
    const [versionRows] = await connection.query('SELECT VERSION() as version');
    console.log(`✅ 数据库版本: ${versionRows[0].version}`);

    // 示例查询：获取表列表
    console.log('\n📋 执行示例查询：获取表列表');
    const [tablesRows] = await connection.query(
      `SELECT TABLE_NAME, TABLE_ROWS 
       FROM information_schema.TABLES 
       WHERE TABLE_SCHEMA = ? 
       ORDER BY TABLE_NAME`,
      [DB_CONFIG.database],
    );
    console.log('✅ 表列表：');
    tablesRows.forEach(table => {
      console.log(`   - ${table.TABLE_NAME} (${table.TABLE_ROWS || 0} 行)`);
    });

    // 示例查询：获取资产数量统计
    console.log('\n📋 执行示例查询：获取资产数量统计');
    const [assetsCountRows] = await connection.query(
      `SELECT 
         COUNT(*) as total_assets, 
         status, 
         COUNT(*) as status_count 
       FROM assets 
       GROUP BY status`,
    );
    console.log('✅ 资产数量统计：');
    assetsCountRows.forEach(row => {
      console.log(`   - 状态: ${row.status}, 数量: ${row.status_count}`);
    });

    console.log('\n✅ 所有查询执行成功');
  } catch (error) {
    console.error('❌ 数据库操作失败:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n✅ 数据库连接已关闭');
    }
  }

  console.log('\n=== 直接连接数据库操作完成 ===');
  console.log(`结束时间: ${new Date().toISOString()}`);
}

// 执行脚本
runDirectDBQueries().catch(error => {
  console.error('❌ 脚本执行失败:', error);
  process.exit(1);
});
