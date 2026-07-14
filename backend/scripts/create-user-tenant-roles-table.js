// 确保正确加载环境变量
require('dotenv').config();
const db = require('../config/database');

/**
 * 创建用户-租户-角色关联表
 * 用于支持用户在不同企业有不同角色的功能
 */
async function createUserTenantRolesTable() {
  try {
    console.log('开始创建用户-租户-角色关联表...');

    // 创建用户-租户-角色关联表
    await db.execute(`
      CREATE TABLE IF NOT EXISTS user_tenant_roles (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        tenant_id INT NOT NULL,
        role VARCHAR(50) NOT NULL,
        managed_departments TEXT,
        is_default TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
        UNIQUE KEY uk_user_tenant (user_id, tenant_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ 用户-租户-角色关联表创建成功');

    // 为现有用户创建默认的租户角色关联
    console.log('开始为现有用户创建默认租户角色关联...');
    const [users] = await db.execute(
      'SELECT id, tenant_id, role, managed_departments FROM users WHERE tenant_id IS NOT NULL',
    );

    for (const user of users) {
      try {
        await db.execute(
          `INSERT IGNORE INTO user_tenant_roles 
           (user_id, tenant_id, role, managed_departments, is_default) 
           VALUES (?, ?, ?, ?, ?)`,
          [user.id, user.tenant_id, user.role, user.managed_departments, true],
        );
      } catch (error) {
        console.error(`❌ 为用户 ${user.id} 创建租户角色关联失败:`, error.message);
      }
    }
    console.log(`✅ 已为 ${users.length} 个现有用户创建默认租户角色关联`);

    // 添加索引以提高查询性能
    await db.execute(
      'CREATE INDEX idx_user_tenant_roles_tenant_id ON user_tenant_roles(tenant_id)',
    );
    await db.execute('CREATE INDEX idx_user_tenant_roles_user_id ON user_tenant_roles(user_id)');
    console.log('✅ 已添加查询索引');

    console.log('🎉 用户-租户-角色关联表创建和初始化完成！');
    return true;
  } catch (error) {
    console.error('❌ 创建用户-租户-角色关联表失败:', error);
    return false;
  }
}

// 如果直接运行此脚本，则执行创建表操作
if (require.main === module) {
  createUserTenantRolesTable().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = { createUserTenantRolesTable };
