const db = require('../config/database');

// 删除users表中的tenant_id和managed_departments字段
const removeFieldsFromUsersTable = async () => {
  try {
    console.log('开始删除users表中的tenant_id和managed_departments字段...');

    // 删除tenant_id字段
    await db.execute('ALTER TABLE users DROP COLUMN IF EXISTS tenant_id');
    console.log('✅ 成功删除tenant_id字段');

    // 删除managed_departments字段
    await db.execute('ALTER TABLE users DROP COLUMN IF EXISTS managed_departments');
    console.log('✅ 成功删除managed_departments字段');

    console.log('所有字段删除完成！');
  } catch (error) {
    console.error('❌ 删除字段失败:', error.message);
    throw error;
  }
};

// 初始化
const init = async () => {
  try {
    await removeFieldsFromUsersTable();
    console.log('✅ 初始化完成！');
    process.exit(0);
  } catch (error) {
    console.error('❌ 初始化失败:', error.message);
    process.exit(1);
  }
};

// 执行初始化
init();
