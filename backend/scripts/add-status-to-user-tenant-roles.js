// 确保正确加载环境变量
require('dotenv').config();
const db = require('../config/database');

/**
 * 为用户-租户-角色关联表添加status字段
 * 用于支持用户申请加入企业的功能
 */
async function addStatusToUserTenantRoles() {
  try {
    console.log('开始为用户-租户-角色关联表添加status字段...');

    // 为user_tenant_roles表添加status字段
    await db.execute(`
      ALTER TABLE user_tenant_roles
      ADD COLUMN status VARCHAR(50) NOT NULL DEFAULT 'active'
    `);
    console.log('✅ 成功添加status字段');

    console.log('🎉 用户-租户-角色关联表status字段添加完成！');
    return true;
  } catch (error) {
    console.error('❌ 添加status字段失败:', error);
    return false;
  }
}

// 如果直接运行此脚本，则执行添加字段操作
if (require.main === module) {
  addStatusToUserTenantRoles().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = { addStatusToUserTenantRoles };
