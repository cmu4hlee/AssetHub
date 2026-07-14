const db = require('../config/database');

// 创建资产图片表的SQL语句
const createAssetImagesTable = `
CREATE TABLE IF NOT EXISTS asset_images (
  id INT PRIMARY KEY AUTO_INCREMENT,
  asset_id VARCHAR(100) NOT NULL,
  file_id VARCHAR(255) NOT NULL,
  temp_file_url VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT NULL
);
`;

// 执行创建表操作
async function createTable() {
  try {
    await db.query(createAssetImagesTable);
    console.log('资产图片表创建成功');
  } catch (err) {
    console.error('创建资产图片表失败:', err);
    process.exit(1);
  } finally {
    // 关闭数据库连接
    await db.end();
  }
}

createTable();
