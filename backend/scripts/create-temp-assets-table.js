const db = require('../config/database');

async function createTempAssetsTable() {
  try {
    console.log('=== 创建临时资产表 ===\n');

    // 检查临时资产表是否已存在
    const [existingTables] = await db.execute(
      `SELECT TABLE_NAME FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'temp_assets'`,
    );

    if (existingTables.length > 0) {
      console.log('✅ 临时资产表已存在，跳过创建');
      return;
    }

    // 创建临时资产表
    await db.execute(`
      CREATE TABLE temp_assets (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        asset_name VARCHAR(200) NOT NULL,
        asset_type VARCHAR(100),
        brand VARCHAR(100),
        model VARCHAR(100),
        specification TEXT,
        location VARCHAR(200),
        department VARCHAR(100),
        status ENUM('在用', '闲置', '维修', '报废') DEFAULT '闲置',
        source ENUM('盘盈', '临时') DEFAULT '临时',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT NULL,
        created_by VARCHAR(50),
        remark TEXT,

        -- 外键约束
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,

        -- 索引
        INDEX idx_tenant_id (tenant_id),
        INDEX idx_asset_name (asset_name),
        INDEX idx_status (status),
        INDEX idx_source (source),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    console.log('✅ 临时资产表创建成功');

    // 显示表结构
    const [columns] = await db.execute('DESCRIBE temp_assets');
    console.log('\n=== 临时资产表结构 ===');
    console.table(columns);
  } catch (error) {
    console.error('❌ 创建临时资产表失败:', error.message);
    throw error;
  } finally {
    // 关闭数据库连接
    await db.end();
  }
}

// 执行创建表操作
createTempAssetsTable()
  .then(() => {
    console.log('\n=== 操作完成 ===');
  })
  .catch(error => {
    console.error('❌ 操作失败:', error.message);
    process.exit(1);
  });
