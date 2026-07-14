const db = require('../config/database');
const path = require('path');
const { readFirstWorksheetObjects } = require('../utils/excel-reader');

async function importAssetImages() {
  try {
    // 读取Excel文件
    const jsonData = await readFirstWorksheetObjects(path.join(__dirname, '../config/db.xlsx'));

    console.log(`Excel文件共包含 ${jsonData.length} 条图片记录`);

    // 准备插入数据
    const insertQuery = `
      INSERT INTO asset_images (asset_code, file_id, temp_file_url)
      VALUES (?, ?, ?)
    `;

    // 批量插入数据
    let insertedCount = 0;
    for (let i = 0; i < jsonData.length; i++) {
      const row = jsonData[i];

      // 清理assetId中的制表符
      const assetId = String(row.assetId).trim();
      const fileId = String(row.fileID).trim();
      const tempFileUrl = String(row.tempFileURL || '').trim();

      try {
        await db.query(insertQuery, [assetId, fileId, tempFileUrl]);
        insertedCount++;

        // 每插入1000条记录显示进度
        if (insertedCount % 1000 === 0) {
          console.log(`已插入 ${insertedCount} 条记录`);
        }
      } catch (err) {
        console.error(`插入记录失败 (${i + 1}/${jsonData.length}):`, err.message);
        // 忽略错误，继续插入其他记录
      }
    }

    console.log(`数据导入完成，成功插入 ${insertedCount} 条记录`);
  } catch (err) {
    console.error('导入过程中发生错误:', err);
    process.exit(1);
  } finally {
    // 关闭数据库连接
    await db.end();
  }
}

importAssetImages();
