const db = require('../config/database');

async function addManagedDepartments() {
  try {
    console.log('开始为users表添加managed_departments字段...');

    // 检查字段是否已存在
    const [columns] = await db.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'zcgl' 
      AND TABLE_NAME = 'users' 
      AND COLUMN_NAME = 'managed_departments'
    `);

    if (columns.length > 0) {
      console.log('managed_departments字段已存在，跳过添加');
      return;
    }

    // 添加managed_departments字段（存储JSON格式的管理科室ID数组）
    await db.execute(`
      ALTER TABLE users 
      ADD COLUMN managed_departments TEXT NULL 
      COMMENT '管理科室ID列表（JSON数组格式）'
      AFTER department_code
    `);
    console.log('managed_departments字段添加成功');
  } catch (error) {
    console.error('添加字段失败:', error.message);
    throw error;
  }
}

// 执行
addManagedDepartments()
  .then(() => {
    console.log('操作完成');
    process.exit(0);
  })
  .catch(error => {
    console.error('操作失败:', error);
    process.exit(1);
  });
