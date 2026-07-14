/**
 * 国际化相关数据库迁移
 * 添加用户语言偏好字段
 */

const db = require('../../config/database');

async function runMigration() {
  try {
    console.log('[Migration] 开始运行 i18n 迁移...');

    // 检查字段是否存在
    const [columns] = await db.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'users' 
      AND COLUMN_NAME = 'preferred_language'
    `);

    if (columns.length === 0) {
      // 添加字段
      await db.execute(`
        ALTER TABLE users 
        ADD COLUMN preferred_language VARCHAR(10) DEFAULT NULL COMMENT '用户语言偏好(zh/en)'
      `);
      console.log('[Migration] ✅ 已添加 preferred_language 字段');

      // 创建索引
      await db.execute(`
        CREATE INDEX idx_users_preferred_language ON users(preferred_language)
      `);
      console.log('[Migration] ✅ 已创建索引 idx_users_preferred_language');
    } else {
      console.log('[Migration] ℹ️ preferred_language 字段已存在，跳过');
    }

    console.log('[Migration] ✅ i18n 迁移完成');
    process.exit(0);
  } catch (error) {
    console.error('[Migration] ❌ 迁移失败:', error.message);
    process.exit(1);
  }
}

runMigration();
