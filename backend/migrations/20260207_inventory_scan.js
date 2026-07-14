const db = require('../config/database');

async function migrate() {
  console.log('开始创建盘点扫描日志表...\n');

  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS inventory_scan_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tenant_id INT NOT NULL DEFAULT 1 COMMENT '租户ID',
      inventory_id INT NOT NULL COMMENT '盘点记录ID',
      asset_code VARCHAR(100) NOT NULL COMMENT '资产编号',
      scan_time DATETIME NOT NULL COMMENT '扫描时间',
      scan_type ENUM('qr_code', 'manual', 'barcode') NOT NULL DEFAULT 'qr_code' COMMENT '扫描类型',
      scan_by VARCHAR(50) COMMENT '扫描人',
      location VARCHAR(255) COMMENT '扫描位置',
      status VARCHAR(50) COMMENT '资产状态',
      result VARCHAR(50) COMMENT '盘点结果',
      photo_url VARCHAR(500) COMMENT '照片URL',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
      INDEX idx_tenant_id (tenant_id),
      INDEX idx_inventory_id (inventory_id),
      INDEX idx_asset_code (asset_code),
      INDEX idx_scan_time (scan_time),
      INDEX idx_scan_by (scan_by)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='盘点扫描日志表';
  `;

  try {
    await db.execute(createTableSQL);
    console.log('✅ inventory_scan_logs 表创建成功');
  } catch (error) {
    if (error.code === 'ER_TABLE_EXISTS_ERROR') {
      console.log('ℹ️  inventory_scan_logs 表已存在');
    } else {
      console.error('❌ 创建 inventory_scan_logs 表失败:', error.message);
      throw error;
    }
  }

  // 检查 inventory_details 表是否需要添加新字段
  console.log('\n检查 inventory_details 表字段...');

  try {
    const [columns] = await db.execute('DESCRIBE inventory_details');
    const columnNames = columns.map(c => c.Field);

    const neededColumns = [
      { name: 'scan_time', type: 'DATETIME', after: 'discrepancy_desc', comment: '扫描时间' },
      { name: 'scan_type', type: "ENUM('qr_code', 'manual', 'barcode')", after: 'scan_time', comment: '扫描类型' },
      { name: 'scan_by', type: 'VARCHAR(50)', after: 'scan_type', comment: '扫描人' },
      { name: 'photo_url', type: 'VARCHAR(500)', after: 'scan_by', comment: '照片URL' },
    ];

    for (const col of neededColumns) {
      if (!columnNames.includes(col.name)) {
        await db.execute(`ALTER TABLE inventory_details ADD COLUMN ${col.name} ${col.type} NULL COMMENT '${col.comment}' AFTER ${col.after}`);
        console.log(`✅ 添加字段 ${col.name} 成功`);
      } else {
        console.log(`ℹ️  字段 ${col.name} 已存在`);
      }
    }
  } catch (error) {
    console.error('⚠️  检查/添加字段时出错:', error.message);
  }

  console.log('\n✅ 数据库迁移完成！');
}

migrate().catch(error => {
  console.error('迁移失败:', error);
  process.exit(1);
});
