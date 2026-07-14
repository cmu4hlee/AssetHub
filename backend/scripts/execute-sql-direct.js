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

// 索引定义配置
const INDEXES_TO_CREATE = [
  // assets 表索引
  { table: 'assets', index: 'idx_assets_tenant_id', columns: 'tenant_id' },
  { table: 'assets', index: 'idx_assets_status', columns: 'status' },
  { table: 'assets', index: 'idx_assets_department', columns: 'department' },
  { table: 'assets', index: 'idx_assets_department_new', columns: 'department_new' },
  { table: 'assets', index: 'idx_assets_tenant_department', columns: 'tenant_id, department' },
  { table: 'assets', index: 'idx_assets_tenant_status', columns: 'tenant_id, status' },
  { table: 'assets', index: 'idx_assets_tenant_category', columns: 'tenant_id, category_id' },
  { table: 'assets', index: 'idx_assets_tenant_location', columns: 'tenant_id, location_id' },
  { table: 'assets', index: 'idx_assets_tenant_asset_no', columns: 'tenant_id, asset_no' },
  { table: 'assets', index: 'idx_assets_tenant_ba.code', columns: 'tenant_id, ba.code' },
  { table: 'assets', index: 'idx_assets_purchase_date', columns: 'purchase_date' },
  {
    table: 'assets',
    index: 'idx_assets_tenant_purchase_date',
    columns: 'tenant_id, purchase_date',
  },

  // users 表索引
  { table: 'users', index: 'idx_users_tenant_id', columns: 'tenant_id' },
  { table: 'users', index: 'idx_users_role', columns: 'role' },
  { table: 'users', index: 'idx_users_tenant_role', columns: 'tenant_id, role' },

  // departments 表索引
  { table: 'departments', index: 'idx_departments_tenant_id', columns: 'tenant_id' },
  { table: 'departments', index: 'idx_departments_parent_id', columns: 'parent_id' },
  { table: 'departments', index: 'idx_departments_tenant_parent', columns: 'tenant_id, parent_id' },

  // maintenance_logs 表索引
  {
    table: 'maintenance_logs',
    index: 'idx_maintenance_tenant_asset',
    columns: 'tenant_id, asset_id',
  },
  { table: 'maintenance_logs', index: 'idx_maintenance_logs_date', columns: 'maintenance_date' },

  // asset_images 表索引
  { table: 'asset_images', index: 'idx_asset_images_asset_id', columns: 'asset_id' },
  { table: 'asset_images', index: 'idx_asset_images_tenant_id', columns: 'tenant_id' },

  // inventory_records 表索引
  { table: 'inventory_records', index: 'idx_inventory_tenant', columns: 'tenant_id' },
  { table: 'inventory_records', index: 'idx_inventory_status', columns: 'status' },

  // asset_transfer_requests 表索引
  { table: 'asset_transfer_requests', index: 'idx_transfer_tenant', columns: 'tenant_id' },
  { table: 'asset_transfer_requests', index: 'idx_transfer_status', columns: 'status' },
  { table: 'asset_transfer_requests', index: 'idx_transfer_asset', columns: 'asset_id' },

  // audit_logs 表索引
  { table: 'audit_logs', index: 'idx_audit_logs_tenant', columns: 'tenant_id' },
  { table: 'audit_logs', index: 'idx_audit_logs_user', columns: 'user_id' },
  { table: 'audit_logs', index: 'idx_audit_logs_created', columns: 'created_at' },
  { table: 'audit_logs', index: 'idx_audit_logs_action', columns: 'action' },
];

// 检查索引是否存在的函数
async function checkIndexExists(connection, table, indexName) {
  const [rows] = await connection.query(
    `SELECT INDEX_NAME FROM information_schema.STATISTICS 
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [DB_CONFIG.database, table, indexName],
  );
  return rows.length > 0;
}

// 主函数
async function executeSQLDirectly() {
  console.log('=== 开始直接连接数据库创建索引 ===');
  console.log(`开始时间: ${new Date().toISOString()}`);
  console.log(`总共要创建 ${INDEXES_TO_CREATE.length} 个索引`);

  let connection = null;
  let successCount = 0;
  let failCount = 0;
  let skipCount = 0;

  try {
    // 创建直接连接
    connection = await mysql.createConnection(DB_CONFIG);
    console.log('✅ 数据库连接成功');

    // 执行所有索引创建
    for (let i = 0; i < INDEXES_TO_CREATE.length; i++) {
      const { table, index, columns } = INDEXES_TO_CREATE[i];
      const statementNumber = i + 1;

      try {
        console.log(`\n📋 处理第 ${statementNumber}/${INDEXES_TO_CREATE.length} 个索引:`);
        console.log(`   表: ${table}, 索引: ${index}, 列: ${columns}`);

        // 检查索引是否已存在
        const exists = await checkIndexExists(connection, table, index);
        if (exists) {
          console.log(`✅ 索引 ${index} 已存在，跳过创建`);
          skipCount++;
          continue;
        }

        // 创建索引
        const createSQL = `CREATE INDEX ${index} ON ${table}(${columns})`;
        await connection.query(createSQL);
        console.log(`✅ 索引 ${index} 创建成功`);
        successCount++;
      } catch (error) {
        console.error(`❌ 索引 ${index} 创建失败: ${error.message}`);
        failCount++;
      }

      // 避免过于频繁的数据库操作
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    console.log('\n✅ 所有索引处理完成');
  } catch (error) {
    console.error('❌ 数据库连接或整体执行失败:', error);
    failCount++;
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n✅ 数据库连接已关闭');
    }
  }

  console.log('\n=== 索引创建结果汇总 ===');
  console.log(`开始时间: ${new Date().toISOString()}`);
  console.log(`总共处理: ${INDEXES_TO_CREATE.length} 个索引`);
  console.log(`成功创建: ${successCount} 个`);
  console.log(`已存在跳过: ${skipCount} 个`);
  console.log(`创建失败: ${failCount} 个`);

  if (failCount === 0) {
    console.log('🎉 所有索引处理成功！');
  } else {
    console.log('⚠️  部分索引创建失败，请检查日志');
  }
}

// 执行脚本
executeSQLDirectly().catch(error => {
  console.error('❌ 脚本执行失败:', error);
  process.exit(1);
});
