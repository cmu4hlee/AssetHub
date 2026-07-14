// 确保正确加载环境变量
require('dotenv').config();
const db = require('../config/database');
const bcrypt = require('bcryptjs');

/**
 * 创建super_user表并初始化超级管理员账号
 */
async function createSuperUserTable() {
  try {
    console.log('开始创建super_user表...');

    // 1. 创建super_user表
    await db.execute(`
      CREATE TABLE IF NOT EXISTS super_users (
        id INT PRIMARY KEY AUTO_INCREMENT,
        username VARCHAR(50) NOT NULL UNIQUE,
        password VARCHAR(100) NOT NULL,
        real_name VARCHAR(50) NOT NULL,
        email VARCHAR(100) NULL,
        phone VARCHAR(20) NULL,
        status ENUM('active', 'inactive') DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT NULL,
        last_login_at DATETIME DEFAULT NULL,
        login_count INT DEFAULT 0
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ super_user表创建成功');

    // 2. 创建初始超级管理员账号
    console.log('开始创建初始超级管理员账号...');
    const hashedPassword = await bcrypt.hash('123', 10);

    try {
      await db.execute(
        `INSERT INTO super_users (username, password, real_name, status) 
         VALUES (?, ?, ?, ?) 
         ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP`,
        ['su', hashedPassword, '超级管理员', 'active'],
      );
      console.log('✅ 初始超级管理员账号创建成功');
    } catch (error) {
      console.error('❌ 创建初始超级管理员账号失败:', error.message);
    }

    console.log('🎉 super_user表创建和初始化完成！');
    return true;
  } catch (error) {
    console.error('❌ 创建super_user表失败:', error);
    return false;
  }
}

// 执行创建操作
createSuperUserTable().then(success => {
  process.exit(success ? 0 : 1);
});
