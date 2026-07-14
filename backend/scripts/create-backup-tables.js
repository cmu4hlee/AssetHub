const db = require('../config/database');

async function createBackupTables() {
  try {
    console.log('开始创建数据库备份表...');

    // 检查表是否已存在
    const [tables] = await db.execute(
      `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
       WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME = 'database_backups'`,
    );

    if (tables.length > 0) {
      console.log('✅ 数据库备份表已存在，跳过创建');
      process.exit(0);
    }

    // 创建数据库备份表
    await db.execute(`
      CREATE TABLE IF NOT EXISTS database_backups (
        id INT PRIMARY KEY AUTO_INCREMENT,
        file_name VARCHAR(255) NOT NULL COMMENT '备份文件名',
        file_path VARCHAR(500) NOT NULL COMMENT '备份文件路径',
        file_size BIGINT NOT NULL COMMENT '文件大小（字节）',
        description TEXT COMMENT '备份描述',
        tenant_id INT NULL COMMENT '租户ID（NULL表示全库备份）',
        tenant_name VARCHAR(100) NULL COMMENT '租户名称',
        created_by VARCHAR(50) COMMENT '创建人',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
        restored_by VARCHAR(50) COMMENT '恢复人',
        restored_at TIMESTAMP NULL COMMENT '恢复时间',
        INDEX idx_created_at (created_at),
        INDEX idx_tenant_id (tenant_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='数据库备份记录表';
    `);
    console.log('✅ 数据库备份表创建成功');

    console.log('✅ 数据库备份表创建完成！');
    process.exit(0);
  } catch (error) {
    console.error('❌ 创建表失败:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  createBackupTables();
}

module.exports = createBackupTables;
