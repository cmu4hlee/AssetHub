const db = require('../config/database');

async function addStorageLocationField() {
  try {
    console.log('开始为资产表添加存放地点字段...');

    // 1. 为assets表添加storage_location字段
    await db.execute(`
      ALTER TABLE assets 
      ADD COLUMN storage_location VARCHAR(200) NULL 
      AFTER location
    `);
    console.log('存放地点字段添加成功');

    console.log('\n资产表添加存放地点字段完成！');
  } catch (error) {
    console.error('添加存放地点字段失败:', error);
  }
}

// 执行脚本
addStorageLocationField();
