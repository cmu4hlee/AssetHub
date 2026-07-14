const db = require('../config/database');

// 创建用户管理科室关联表
const createUserManagedDepartmentsTable = async () => {
  try {
    // 检查表是否已经存在
    const [existingTables] = await db.execute(
      `SELECT TABLE_NAME FROM information_schema.TABLES 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_managed_departments'`,
    );

    if (existingTables.length > 0) {
      console.log('✅ user_managed_departments表已存在，跳过创建');
      return;
    }

    // 创建表
    await db.execute(`
      CREATE TABLE user_managed_departments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        tenant_id INT NOT NULL,
        department_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        -- 外键约束
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
        FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE,
        
        -- 唯一约束，确保一个用户在一个企业中只能管理一个科室一次
        UNIQUE KEY unique_user_department (user_id, tenant_id, department_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    console.log('✅ user_managed_departments表创建成功');
  } catch (error) {
    console.error('❌ 创建user_managed_departments表失败:', error.message);
    throw error;
  }
};

// 初始化表
const init = async () => {
  try {
    console.log('开始创建用户管理科室关联表...');
    await createUserManagedDepartmentsTable();
    console.log('用户管理科室关联表创建完成！');
  } catch (error) {
    console.error('❌ 初始化失败:', error.message);
    process.exit(1);
  } finally {
    // 关闭数据库连接
    await db.end();
  }
};

// 执行初始化
init();
