const db = require('../config/database');

async function dropTransferRecordsTable() {
  try {
    console.log('开始删除 transfer_records 表...');

    // 删除资产调配表
    await db.execute('DROP TABLE IF EXISTS transfer_records');

    console.log('✓ transfer_records 表删除成功');

    process.exit(0);
  } catch (error) {
    console.error('删除表失败:', error);
    process.exit(1);
  }
}

dropTransferRecordsTable();
