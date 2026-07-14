// 确保正确加载环境变量
require('dotenv').config();
const db = require('../config/database');

/**
 * 清理users表中的冗余字段
 * 删除tenant_id、role和managed_departments字段，这些字段已迁移到user_tenant_roles表
 */
async function cleanupUsersTable() {
  try {
    console.log('开始清理users表中的冗余字段...');

    // 1. 验证所有用户是否都已迁移到user_tenant_roles表
    console.log('1. 验证用户迁移情况...');
    const [users] = await db.execute('SELECT id, tenant_id, role FROM users');

    let missingRoles = 0;
    for (const user of users) {
      const [roles] = await db.execute('SELECT id FROM user_tenant_roles WHERE user_id = ?', [
        user.id,
      ]);

      // 如果用户在旧表中有tenant_id但在新表中没有角色记录，则创建默认记录
      if (user.tenant_id && roles.length === 0) {
        console.log(`用户 ${user.id} 缺少角色记录，正在创建...`);
        await db.execute(
          `INSERT INTO user_tenant_roles (user_id, tenant_id, role, is_default, status) 
           VALUES (?, ?, ?, ?, ?)`,
          [user.id, user.tenant_id, user.role || 'user', 1, 'active'],
        );
        missingRoles++;
      }
    }

    console.log(`✅ 迁移验证完成，创建了 ${missingRoles} 条缺失的角色记录`);

    // 2. 删除users表中的冗余字段
    console.log('2. 删除users表中的冗余字段...');

    // 2.1 删除外键约束（如果存在）
    try {
      await db.execute('ALTER TABLE users DROP FOREIGN KEY users_ibfk_1');
      console.log('✅ 已删除users表的外键约束users_ibfk_1');
    } catch (error) {
      if (error.message.includes('Unknown foreign key')) {
        console.log('ℹ️ 外键约束users_ibfk_1不存在，跳过删除');
      } else {
        console.error('❌ 删除外键约束失败:', error.message);
      }
    }

    // 2.2 删除冗余字段
    const fieldsToDelete = ['managed_departments', 'tenant_id', 'role'];

    for (const field of fieldsToDelete) {
      try {
        await db.execute(`ALTER TABLE users DROP COLUMN ${field}`);
        console.log(`✅ 已删除${field}字段`);
      } catch (error) {
        if (error.message.includes('Unknown column')) {
          console.log(`ℹ️ ${field}字段不存在，跳过删除`);
        } else {
          console.error(`❌ 删除${field}字段失败:`, error.message);
        }
      }
    }

    console.log('🎉 users表冗余字段清理完成！');
    return true;
  } catch (error) {
    console.error('❌ 清理users表冗余字段失败:', error);
    return false;
  }
}

// 如果直接运行此脚本，则执行清理操作
if (require.main === module) {
  cleanupUsersTable().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = { cleanupUsersTable };
