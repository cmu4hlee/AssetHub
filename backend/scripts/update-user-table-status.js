const db = require('../config/database');

async function updateUserTableStatus() {
  try {
    console.log('开始更新用户表状态字段...');

    // 首先检查status字段是否包含pending选项
    const [columns] = await db.execute('SHOW COLUMNS FROM users WHERE Field = "status"');

    if (columns.length === 0) {
      console.error('未找到status字段');
      return;
    }

    const statusColumn = columns[0];
    const type = statusColumn.Type;

    console.log('当前status字段类型:', type);

    // 如果不包含pending，添加它
    if (!type.includes('pending')) {
      await db.execute(
        'ALTER TABLE users MODIFY COLUMN status ENUM("active", "inactive", "pending") DEFAULT "active"',
      );
      console.log('✅ 已成功将pending状态添加到status字段');
    } else {
      console.log('✅ status字段已经包含pending状态');
    }
  } catch (error) {
    console.error('更新用户表状态字段失败:', error);
  }
}

// 执行脚本
updateUserTableStatus();

// 导出函数，以便其他模块调用
module.exports = updateUserTableStatus;
