const db = require('../config/database');

// 为资产图片表添加描述字段的SQL语句
const addDescriptionColumn = `
ALTER TABLE asset_images
ADD COLUMN description VARCHAR(255) DEFAULT NULL;
`;

// 执行添加字段操作
async function addDescriptionColumnToTable() {
  try {
    await db.query(addDescriptionColumn);
    console.log('为资产图片表添加描述字段成功');
  } catch (err) {
    console.error('为资产图片表添加描述字段失败:', err);
    process.exit(1);
  } finally {
    // 关闭数据库连接
    await db.end();
  }
}

addDescriptionColumnToTable();
