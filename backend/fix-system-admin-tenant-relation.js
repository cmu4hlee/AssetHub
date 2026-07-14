const db = require('./config/database');

/**
 * 修复系统管理员与企业的关联关系
 * 1. 检查现有系统管理员是否已在user_tenant_roles表中
 * 2. 如果不在，将他们添加到user_tenant_roles表
 * 3. 确保系统管理员能在用户管理页面看到自己
 */
async function fixSystemAdminTenantRelation() {
  console.log('开始修复系统管理员与企业的关联关系...');

  try {
    // 1. 查询所有系统管理员（包括super_admin和system_admin）
    const [users] = await db.execute(
      'SELECT id, username, real_name, role FROM users WHERE role IN ("super_admin", "system_admin")',
    );

    console.log(`找到 ${users.length} 个系统管理员`);

    for (const user of users) {
      console.log(`\n处理用户: ${user.username} (ID: ${user.id}, 角色: ${user.role})`);

      // 2. 检查用户是否已在user_tenant_roles表中
      const [existingRelations] = await db.execute(
        'SELECT id, tenant_id, role, status FROM user_tenant_roles WHERE user_id = ?',
        [user.id],
      );

      if (existingRelations.length > 0) {
        console.log(
          `✅ 用户已存在于user_tenant_roles表中，关联关系数量: ${existingRelations.length}`,
        );
        existingRelations.forEach(relation => {
          console.log(
            `   - 关联ID: ${relation.id}, 企业ID: ${relation.tenant_id}, 角色: ${relation.role}, 状态: ${relation.status}`,
          );
        });
        continue;
      }

      console.log('❌ 用户不在user_tenant_roles表中，开始创建关联关系...');

      // 3. 查找用户关联的企业
      let tenantId = null;
      let tenantName = null;

      // 对于system_admin，查找他们创建的企业
      if (user.role === 'system_admin') {
        const [createdTenants] = await db.execute(
          'SELECT id, tenant_name FROM tenants WHERE contact_person = ? AND status = "active" LIMIT 1',
          [user.real_name],
        );

        if (createdTenants.length > 0) {
          tenantId = createdTenants[0].id;
          tenantName = createdTenants[0].tenant_name;
          console.log(`✅ 找到用户创建的企业: ${tenantName} (ID: ${tenantId})`);
        } else {
          // 如果没有找到，尝试查找默认企业
          const [defaultTenants] = await db.execute(
            'SELECT id, tenant_name FROM tenants WHERE status = "active" LIMIT 1',
          );

          if (defaultTenants.length > 0) {
            tenantId = defaultTenants[0].id;
            tenantName = defaultTenants[0].tenant_name;
            console.log(`✅ 找到默认企业: ${tenantName} (ID: ${tenantId})`);
          } else {
            console.log('⚠️  未找到关联企业，跳过该用户');
            continue;
          }
        }
      }
      // 对于super_admin，可以关联到所有企业，但这里只关联到第一个企业
      else if (user.role === 'super_admin') {
        const [allTenants] = await db.execute(
          'SELECT id, tenant_name FROM tenants WHERE status = "active" LIMIT 1',
        );

        if (allTenants.length > 0) {
          tenantId = allTenants[0].id;
          tenantName = allTenants[0].tenant_name;
          console.log(`✅ 为超级管理员关联到企业: ${tenantName} (ID: ${tenantId})`);
        }
      }

      // 4. 创建关联关系
      if (tenantId) {
        await db.execute(
          `INSERT INTO user_tenant_roles (user_id, tenant_id, role, is_default, status, created_at)
           VALUES (?, ?, ?, ?, ?, NOW())`,
          [user.id, tenantId, user.role, 1, 'active'],
        );

        console.log(
          `✅ 成功创建关联关系: 用户 ${user.username} -> 企业 ${tenantName} (ID: ${tenantId})`,
        );
      }
    }

    console.log('\n🎉 系统管理员与企业的关联关系修复完成！');
    process.exit(0);
  } catch (error) {
    console.error('❌ 修复过程中出现错误:', error);
    console.error('错误详情:', error.message);
    console.error('错误堆栈:', error.stack);
    process.exit(1);
  }
}

// 执行修复
fixSystemAdminTenantRelation();
