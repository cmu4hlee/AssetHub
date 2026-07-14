const db = require('../config/database');

async function addSerialNumberField() {
  try {
    console.log('开始为资产表添加出厂编号字段...');

    // 1. 为assets表添加serial_number字段
    await db.execute(`
      ALTER TABLE assets 
      ADD COLUMN serial_number VARCHAR(100) NULL 
      AFTER model
    `);
    console.log('出厂编号字段添加成功');

    console.log('\n资产表添加出厂编号字段完成！');
  } catch (error) {
    console.error('添加出厂编号字段失败:', error);
  }
}

// 执行脚本
addSerialNumberField();
