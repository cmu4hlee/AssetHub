const db = require('../config/database');

/**
 * 创建角色表，支持动态添加角色
 */
async function createRolesTable() {
  try {
    console.log('开始创建角色表...');

    // 1. 创建角色表
    await db.execute(`
      CREATE TABLE IF NOT EXISTS roles (
        id INT PRIMARY KEY AUTO_INCREMENT,
        role_code VARCHAR(50) NOT NULL UNIQUE COMMENT '角色代码（如：system_admin）',
        role_name VARCHAR(100) NOT NULL COMMENT '角色名称（如：系统管理员）',
        description TEXT COMMENT '角色描述',
        is_system_role TINYINT(1) DEFAULT 0 COMMENT '是否系统内置角色（1=是，0=否，系统角色不能删除）',
        is_active TINYINT(1) DEFAULT 1 COMMENT '是否启用（1=启用，0=禁用）',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT NULL,
        created_by VARCHAR(50) COMMENT '创建人',
        INDEX idx_role_code (role_code),
        INDEX idx_is_active (is_active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='角色表'
    `);
    console.log('✅ 角色表创建成功');

    // 2. 插入系统默认角色
    const defaultRoles = [
      {
        role_code: 'super_admin',
        role_name: '超级管理员',
        description: '拥有系统所有权限，可以跨租户管理',
        is_system_role: 1,
        is_active: 1,
      },
      {
        role_code: 'system_admin',
        role_name: '系统管理员',
        description: '拥有租户内所有权限，可以管理用户、角色、权限等',
        is_system_role: 1,
        is_active: 1,
      },
      {
        role_code: 'asset_admin',
        role_name: '资产管理员',
        description: '可以管理资产、上传图片、管理技术资料等',
        is_system_role: 1,
        is_active: 1,
      },
      {
        role_code: 'department_admin',
        role_name: '科室管理员',
        description: '可以查看本科室的资产信息',
        is_system_role: 1,
        is_active: 1,
      },
      {
        role_code: 'metrology_admin',
        role_name: '计量管理员',
        description: '可以管理计量相关的资产和记录',
        is_system_role: 1,
        is_active: 1,
      },
      {
        role_code: 'quality_admin',
        role_name: '质量管理员',
        description: '可以管理质量控制相关的记录',
        is_system_role: 1,
        is_active: 1,
      },
      {
        role_code: 'maintenance_admin',
        role_name: '维护管理员',
        description: '可以管理维修维护相关的记录',
        is_system_role: 1,
        is_active: 1,
      },
      {
        role_code: 'maintenance_engineer',
        role_name: '维修工程师',
        description: '可以处理维修工单、填写维修日志、执行预防性维护',
        is_system_role: 1,
        is_active: 1,
      },
      {
        role_code: 'acceptance_admin',
        role_name: '验收管理员',
        description: '可以管理验收相关的记录',
        is_system_role: 1,
        is_active: 1,
      },
      {
        role_code: 'transfer_admin',
        role_name: '调配管理员',
        description: '可以管理资产调配相关的记录',
        is_system_role: 1,
        is_active: 1,
      },
      {
        role_code: 'inventory_admin',
        role_name: '盘点管理员',
        description: '可以管理资产盘点相关的记录',
        is_system_role: 1,
        is_active: 1,
      },
      {
        role_code: 'user',
        role_name: '普通用户',
        description: '可以查看基本的资产信息',
        is_system_role: 1,
        is_active: 1,
      },
    ];

    const insertRoleSQL = `
      INSERT INTO roles (role_code, role_name, description, is_system_role, is_active)
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE 
        role_name = VALUES(role_name),
        description = VALUES(description),
        updated_at = CURRENT_TIMESTAMP
    `;

    for (const role of defaultRoles) {
      await db.execute(insertRoleSQL, [
        role.role_code,
        role.role_name,
        role.description,
        role.is_system_role,
        role.is_active,
      ]);
    }
    console.log('✅ 默认角色插入成功');

    // 3. 修改 users 表的 role 字段从 ENUM 改为 VARCHAR（如果还是 ENUM）
    try {
      const [columns] = await db.execute(`
        SELECT COLUMN_TYPE 
        FROM information_schema.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'users' 
        AND COLUMN_NAME = 'role'
      `);

      if (columns.length > 0 && columns[0].COLUMN_TYPE.includes('enum')) {
        await db.execute(`
          ALTER TABLE users 
          MODIFY COLUMN role VARCHAR(50) NOT NULL
        `);
        console.log('✅ users 表的 role 字段已修改为 VARCHAR');
      } else {
        console.log('✅ users 表的 role 字段已经是 VARCHAR 类型');
      }
    } catch (error) {
      console.warn('⚠️  修改 users 表 role 字段失败（可能已经是 VARCHAR）:', error.message);
    }

    // 4. 修改 role_permissions 表的 role 字段从 ENUM 改为 VARCHAR（如果还是 ENUM）
    try {
      const [columns] = await db.execute(`
        SELECT COLUMN_TYPE 
        FROM information_schema.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'role_permissions' 
        AND COLUMN_NAME = 'role'
      `);

      if (columns.length > 0 && columns[0].COLUMN_TYPE.includes('enum')) {
        await db.execute(`
          ALTER TABLE role_permissions 
          MODIFY COLUMN role VARCHAR(50) NOT NULL
        `);
        console.log('✅ role_permissions 表的 role 字段已修改为 VARCHAR');
      } else {
        console.log('✅ role_permissions 表的 role 字段已经是 VARCHAR 类型');
      }
    } catch (error) {
      console.warn(
        '⚠️  修改 role_permissions 表 role 字段失败（可能已经是 VARCHAR）:',
        error.message,
      );
    }

    console.log('\n✅ 角色表创建完成！');
    console.log('\n系统默认角色：');
    defaultRoles.forEach(role => {
      console.log(`  - ${role.role_code}: ${role.role_name}`);
    });
  } catch (error) {
    console.error('❌ 创建角色表失败:', error);
    throw error;
  }
}

// 执行脚本
if (require.main === module) {
  createRolesTable()
    .then(() => {
      console.log('脚本执行完成');
      process.exit(0);
    })
    .catch(error => {
      console.error('脚本执行失败:', error);
      process.exit(1);
    });
}

module.exports = { createRolesTable };
