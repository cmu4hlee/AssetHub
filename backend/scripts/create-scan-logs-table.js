const db = require('../config/database');

async function createScanLogsTable() {
  try {
    console.log('开始创建扫码日志表...');

    // 创建扫码日志表
    await db.execute(`
      CREATE TABLE IF NOT EXISTS scan_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        asset_code VARCHAR(50) NOT NULL,
        scan_type ENUM('verify', 'inventory', 'other') NOT NULL,
        scan_by VARCHAR(50) NOT NULL,
        scan_time DATETIME NOT NULL,
        tenant_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_asset_code (asset_code),
        INDEX idx_scan_time (scan_time),
        INDEX idx_scan_type (scan_type),
        INDEX idx_tenant_id (tenant_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    console.log('扫码日志表创建成功');

    // 检查是否需要添加外键约束
    const [result] = await db.execute(`
      SELECT COUNT(*) as count 
      FROM information_schema.KEY_COLUMN_USAGE 
      WHERE TABLE_NAME = 'scan_logs' 
      AND COLUMN_NAME = 'asset_code' 
      AND REFERENCED_TABLE_NAME = 'assets'
    `);

    if (result[0].count === 0) {
      try {
        await db.execute(`
          ALTER TABLE scan_logs 
          ADD CONSTRAINT fk_scan_logs_asset_code 
          FOREIGN KEY (asset_code) 
          REFERENCES assets(asset_code) 
          ON DELETE CASCADE
        `);
        console.log('添加资产外键约束成功');
      } catch (error) {
        console.warn('添加资产外键约束失败，可能是因为资产表结构不同:', error.message);
      }
    }

    console.log('扫码日志表初始化完成');
  } catch (error) {
    console.error('创建扫码日志表失败:', error);
  } finally {
    // 关闭数据库连接
    await db.end();
  }
}

// 执行创建表操作
createScanLogsTable();
