const db = require('../config/database');

async function createUserSystem() {
  try {
    console.log('开始创建用户系统...');

    // 1. 创建用户表
    await db.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT PRIMARY KEY AUTO_INCREMENT,
        username VARCHAR(50) NOT NULL UNIQUE,
        password VARCHAR(100) NOT NULL,
        real_name VARCHAR(50) NOT NULL,
        department_code VARCHAR(50),
        role ENUM('system_admin', 'asset_admin', 'department_admin') NOT NULL,
        email VARCHAR(100) NULL,
        phone VARCHAR(20) NULL,
        status ENUM('active', 'inactive', 'pending') DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT NULL
      )
    `);
    console.log('用户表创建成功');

    // 2. 创建系统管理员用户（密码：admin123）
    await db.execute(`
      INSERT INTO users (username, password, real_name, role, status)
      VALUES ('admin', '$2a$10$e4V2zB8X7y6r5t4y3u2i1o0p9a8s7d6f5g4h3j2k1l0', '系统管理员', 'system_admin', 'active')
      ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP
    `);
    console.log('系统管理员用户创建成功');

    // 3. 创建角色权限表
    await db.execute(`
      CREATE TABLE IF NOT EXISTS role_permissions (
        id INT PRIMARY KEY AUTO_INCREMENT,
        role ENUM('system_admin', 'asset_admin', 'department_admin') NOT NULL,
        permission VARCHAR(50) NOT NULL,
        description VARCHAR(200) NULL,
        UNIQUE KEY uk_role_permission (role, permission)
      )
    `);
    console.log('角色权限表创建成功');

    // 4. 插入默认权限
    const permissions = [
      // 系统管理员权限
      { role: 'system_admin', permission: 'view_all_assets', description: '查看所有资产' },
      { role: 'system_admin', permission: 'edit_all_assets', description: '编辑所有资产' },
      { role: 'system_admin', permission: 'add_assets', description: '添加资产' },
      { role: 'system_admin', permission: 'delete_assets', description: '删除资产' },
      { role: 'system_admin', permission: 'manage_users', description: '管理用户' },
      { role: 'system_admin', permission: 'manage_departments', description: '管理科室' },
      { role: 'system_admin', permission: 'view_statistics', description: '查看统计信息' },

      // 资产管理员权限
      {
        role: 'asset_admin',
        permission: 'view_own_department_assets',
        description: '查看自己科室的资产',
      },
      {
        role: 'asset_admin',
        permission: 'edit_own_department_assets',
        description: '编辑自己科室的资产',
      },
      { role: 'asset_admin', permission: 'add_assets', description: '添加资产' },
      { role: 'asset_admin', permission: 'view_statistics', description: '查看统计信息' },

      // 职能科室管理员权限
      {
        role: 'department_admin',
        permission: 'view_own_department_assets',
        description: '查看自己科室的资产',
      },
      { role: 'department_admin', permission: 'view_statistics', description: '查看统计信息' },
    ];

    const insertPermissionSQL = `
      INSERT INTO role_permissions (role, permission, description)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE description = VALUES(description)
    `;

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      for (const perm of permissions) {
        await connection.execute(insertPermissionSQL, [
          perm.role,
          perm.permission,
          perm.description,
        ]);
      }

      await connection.commit();
      console.log('默认权限插入成功');
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    console.log('\n用户系统创建完成！');
    console.log('\n默认用户：');
    console.log('用户名：admin');
    console.log('密码：admin123');
    console.log('角色：系统管理员');
  } catch (error) {
    console.error('创建用户系统失败:', error);
  }
}

// 导出函数，以便其他模块调用
module.exports = createUserSystem;

// 如果直接运行该脚本，则执行创建逻辑
if (require.main === module) {
  createUserSystem();
}
