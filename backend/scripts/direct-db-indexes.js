const mysql = require('mysql2');

// 直接数据库连接配置
const DB_CONFIG = {
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: '',
  database: 'zcgl',
  connectTimeout: 10000,
  charset: 'utf8mb4',
  timezone: '+08:00',
};

// 索引定义
const INDEXES = [
  // assets 表索引
  {
    table: 'assets',
    name: 'idx_assets_tenant_id',
    columns: ['tenant_id'],
    type: 'BTREE',
  },
  {
    table: 'assets',
    name: 'idx_assets_status',
    columns: ['status'],
    type: 'BTREE',
  },
  {
    table: 'assets',
    name: 'idx_assets_department',
    columns: ['department'],
    type: 'BTREE',
  },
  {
    table: 'assets',
    name: 'idx_assets_department_new',
    columns: ['department_new'],
    type: 'BTREE',
  },
  {
    table: 'assets',
    name: 'idx_assets_tenant_department',
    columns: ['tenant_id', 'department'],
    type: 'BTREE',
  },
  {
    table: 'assets',
    name: 'idx_assets_tenant_status',
    columns: ['tenant_id', 'status'],
    type: 'BTREE',
  },

  // departments 表索引
  {
    table: 'departments',
    name: 'idx_departments_tenant_id',
    columns: ['tenant_id'],
    type: 'BTREE',
  },
  {
    table: 'departments',
    name: 'idx_departments_code',
    columns: ['department_code'],
    type: 'BTREE',
    unique: false,
  },
  {
    table: 'departments',
    name: 'idx_departments_tenant_code',
    columns: ['tenant_id', 'department_code'],
    type: 'BTREE',
    unique: true,
  },

  // tenants 表索引
  {
    table: 'tenants',
    name: 'idx_tenants_code',
    columns: ['tenant_code'],
    type: 'BTREE',
    unique: true,
  },
  {
    table: 'tenants',
    name: 'idx_tenants_status',
    columns: ['status'],
    type: 'BTREE',
  },
  {
    table: 'tenants',
    name: 'idx_tenants_created_at',
    columns: ['created_at'],
    type: 'BTREE',
  },

  // users 表索引
  {
    table: 'users',
    name: 'idx_users_username',
    columns: ['username'],
    type: 'BTREE',
    unique: true,
  },
  {
    table: 'users',
    name: 'idx_users_tenant_id',
    columns: ['tenant_id'],
    type: 'BTREE',
  },
  {
    table: 'users',
    name: 'idx_users_role',
    columns: ['role'],
    type: 'BTREE',
  },
  {
    table: 'users',
    name: 'idx_users_tenant_role',
    columns: ['tenant_id', 'role'],
    type: 'BTREE',
  },
];

// 主函数
async function addIndexesDirectly() {
  console.log('=== 开始直接连接数据库添加索引 ===');
  console.log(`开始时间: ${new Date().toISOString()}`);

  // 创建直接连接（不使用连接池）
  const connection = mysql.createConnection(DB_CONFIG);

  let successCount = 0;
  let failCount = 0;

  // 连接到数据库
  await new Promise((resolve, reject) => {
    connection.connect(err => {
      if (err) {
        console.error('❌ 数据库连接失败:', err.message);
        reject(err);
      } else {
        console.log('✅ 数据库连接成功');
        resolve();
      }
    });
  });

  // 执行索引创建
  for (const index of INDEXES) {
    const { table, name, columns, type = 'BTREE', unique = false } = index;

    try {
      // 检查索引是否已存在
      const [indexExists] = await connection
        .promise()
        .query(
          'SELECT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME = ?',
          [DB_CONFIG.database, table, name],
        );

      if (indexExists.length > 0) {
        console.log(`✅ 索引 ${name} 已存在，跳过创建`);
        successCount++;
        continue;
      }

      // 创建索引
      const uniqueStr = unique ? 'UNIQUE' : '';
      const columnsStr = columns.join(', ');
      const sql = `CREATE ${uniqueStr} INDEX ${name} ON ${table} (${columnsStr}) USING ${type}`;

      console.log(`📋 执行SQL: ${sql}`);
      await connection.promise().query(sql);

      console.log(`✅ 成功创建索引: ${name} (${table})`);
      successCount++;
    } catch (error) {
      console.error(`❌ 创建索引 ${name} 失败:`, error.message);
      failCount++;
    }

    // 避免过于频繁的数据库操作
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // 关闭连接
  connection.end(err => {
    if (err) {
      console.error('❌ 关闭数据库连接失败:', err.message);
    } else {
      console.log('✅ 数据库连接已关闭');
    }
  });

  console.log('\n=== 索引添加完成 ===');
  console.log(`结束时间: ${new Date().toISOString()}`);
  console.log(`总计: ${INDEXES.length} 个索引`);
  console.log(`成功: ${successCount} 个`);
  console.log(`失败: ${failCount} 个`);
}

// 执行脚本
addIndexesDirectly().catch(error => {
  console.error('❌ 脚本执行失败:', error);
  process.exit(1);
});
