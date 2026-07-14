const db = require('../config/database');

/**
 * 扩展权限系统
 * 添加更细粒度的权限控制，包括：
 * - 资产操作：增加、编辑、删除、查看
 * - 文件操作：上传图片、上传技术资料、下载文件
 * - 关联操作：更改关联、取消关联
 * - 系统操作：备份、恢复、系统配置等
 */
async function extendPermissionsSystem() {
  try {
    console.log('开始扩展权限系统...');

    // 1. 扩展角色权限表，添加更多权限字段
    await db.execute(`
      ALTER TABLE role_permissions 
      MODIFY COLUMN permission VARCHAR(100) NOT NULL,
      MODIFY COLUMN description VARCHAR(500) NULL
    `);
    console.log('✅ 角色权限表扩展成功');

    // 2. 定义所有权限
    const allPermissions = [
      // ========== 资产相关权限 ==========
      { permission: 'asset.view_all', description: '查看所有资产' },
      { permission: 'asset.view_own_department', description: '查看本科室资产' },
      { permission: 'asset.add', description: '添加资产' },
      { permission: 'asset.edit_all', description: '编辑所有资产' },
      { permission: 'asset.edit_own_department', description: '编辑本科室资产' },
      { permission: 'asset.delete_all', description: '删除所有资产' },
      { permission: 'asset.delete_own_department', description: '删除本科室资产' },
      { permission: 'asset.import', description: '导入资产' },
      { permission: 'asset.export', description: '导出资产' },

      // ========== 图片相关权限 ==========
      { permission: 'image.upload', description: '上传资产图片' },
      { permission: 'image.delete', description: '删除资产图片' },
      { permission: 'image.view', description: '查看资产图片' },

      // ========== 技术资料相关权限 ==========
      { permission: 'document.upload', description: '上传技术资料' },
      { permission: 'document.download', description: '下载技术资料' },
      { permission: 'document.delete', description: '删除技术资料' },
      { permission: 'document.link', description: '关联技术资料' },
      { permission: 'document.unlink', description: '取消关联技术资料' },
      { permission: 'document.review', description: '审核技术资料' },
      { permission: 'document.share_link', description: '生成分享链接' },

      // ========== 维护日志相关权限 ==========
      { permission: 'maintenance.view', description: '查看维护日志' },
      { permission: 'maintenance.add', description: '添加维护日志' },
      { permission: 'maintenance.edit', description: '编辑维护日志' },
      { permission: 'maintenance.delete', description: '删除维护日志' },

      // ========== 用户管理权限 ==========
      { permission: 'user.view', description: '查看用户列表' },
      { permission: 'user.add', description: '添加用户' },
      { permission: 'user.edit', description: '编辑用户' },
      { permission: 'user.delete', description: '删除用户' },
      { permission: 'user.manage_role', description: '管理用户角色' },

      // ========== 角色和权限管理 ==========
      { permission: 'role.view', description: '查看角色列表' },
      { permission: 'role.add', description: '添加角色' },
      { permission: 'role.edit', description: '编辑角色' },
      { permission: 'role.delete', description: '删除角色' },
      { permission: 'role.manage_permissions', description: '管理角色权限' },

      // ========== 科室管理权限 ==========
      { permission: 'department.view', description: '查看科室列表' },
      { permission: 'department.add', description: '添加科室' },
      { permission: 'department.edit', description: '编辑科室' },
      { permission: 'department.delete', description: '删除科室' },

      // ========== 统计信息权限 ==========
      { permission: 'statistics.view', description: '查看统计信息' },
      { permission: 'statistics.export', description: '导出统计报表' },

      // ========== 系统操作权限 ==========
      { permission: 'system.backup', description: '系统备份' },
      { permission: 'system.restore', description: '系统恢复' },
      { permission: 'system.config', description: '系统配置' },
      { permission: 'system.audit_log', description: '查看审计日志' },

      // ========== 调配相关权限 ==========
      { permission: 'transfer.view', description: '查看调配记录' },
      { permission: 'transfer.apply', description: '申请调配' },
      { permission: 'transfer.approve', description: '审批调配' },
      { permission: 'transfer.complete', description: '完成调配' },

      // ========== 盘点相关权限 ==========
      { permission: 'inventory.view', description: '查看盘点记录' },
      { permission: 'inventory.create', description: '创建盘点' },
      { permission: 'inventory.edit', description: '编辑盘点' },
      { permission: 'inventory.delete', description: '删除盘点' },
    ];

    // 3. 为系统管理员分配所有权限
    const systemAdminPermissions = allPermissions.map(p => ({
      role: 'system_admin',
      permission: p.permission,
      description: p.description,
    }));

    // 4. 为资产管理员分配基础权限
    const assetAdminPermissions = [
      {
        role: 'asset_admin',
        permission: 'asset.view_own_department',
        description: '查看本科室资产',
      },
      { role: 'asset_admin', permission: 'asset.add', description: '添加资产' },
      {
        role: 'asset_admin',
        permission: 'asset.edit_own_department',
        description: '编辑本科室资产',
      },
      {
        role: 'asset_admin',
        permission: 'asset.delete_own_department',
        description: '删除本科室资产',
      },
      { role: 'asset_admin', permission: 'asset.export', description: '导出资产' },
      { role: 'asset_admin', permission: 'image.upload', description: '上传资产图片' },
      { role: 'asset_admin', permission: 'image.delete', description: '删除资产图片' },
      { role: 'asset_admin', permission: 'image.view', description: '查看资产图片' },
      { role: 'asset_admin', permission: 'document.upload', description: '上传技术资料' },
      { role: 'asset_admin', permission: 'document.download', description: '下载技术资料' },
      { role: 'asset_admin', permission: 'document.link', description: '关联技术资料' },
      { role: 'asset_admin', permission: 'document.unlink', description: '取消关联技术资料' },
      { role: 'asset_admin', permission: 'document.review', description: '审核技术资料' },
      { role: 'asset_admin', permission: 'document.share_link', description: '生成分享链接' },
      { role: 'asset_admin', permission: 'maintenance.view', description: '查看维护日志' },
      { role: 'asset_admin', permission: 'maintenance.add', description: '添加维护日志' },
      { role: 'asset_admin', permission: 'maintenance.edit', description: '编辑维护日志' },
      { role: 'asset_admin', permission: 'statistics.view', description: '查看统计信息' },
      { role: 'asset_admin', permission: 'transfer.view', description: '查看调配记录' },
      { role: 'asset_admin', permission: 'transfer.apply', description: '申请调配' },
      { role: 'asset_admin', permission: 'inventory.view', description: '查看盘点记录' },
      { role: 'asset_admin', permission: 'inventory.create', description: '创建盘点' },
    ];

    // 5. 为科室管理员分配查看权限
    const departmentAdminPermissions = [
      {
        role: 'department_admin',
        permission: 'asset.view_own_department',
        description: '查看本科室资产',
      },
      { role: 'department_admin', permission: 'image.view', description: '查看资产图片' },
      { role: 'department_admin', permission: 'document.download', description: '下载技术资料' },
      { role: 'department_admin', permission: 'maintenance.view', description: '查看维护日志' },
      { role: 'department_admin', permission: 'statistics.view', description: '查看统计信息' },
    ];

    // 6. 为计量管理员分配权限
    const metrologyAdminPermissions = [
      { role: 'metrology_admin', permission: 'asset.view_own_department', description: '查看本科室资产' },
      { role: 'metrology_admin', permission: 'quality_control.view_own_department', description: '查看本科室质量控制' },
      { role: 'metrology_admin', permission: 'statistics.view', description: '查看统计信息' },
      { role: 'metrology_admin', permission: 'image.view', description: '查看资产图片' },
    ];

    // 7. 为质量管理员分配权限
    const qualityAdminPermissions = [
      { role: 'quality_admin', permission: 'asset.view_own_department', description: '查看本科室资产' },
      { role: 'quality_admin', permission: 'quality_control.view_all', description: '查看所有质量控制' },
      { role: 'quality_admin', permission: 'quality_control.edit_all', description: '编辑所有质量控制' },
      { role: 'quality_admin', permission: 'statistics.view', description: '查看统计信息' },
      { role: 'quality_admin', permission: 'image.view', description: '查看资产图片' },
      { role: 'quality_admin', permission: 'document.download', description: '下载技术资料' },
    ];

    // 8. 为维护管理员分配权限
    const maintenanceAdminPermissions = [
      { role: 'maintenance_admin', permission: 'asset.view_own_department', description: '查看本科室资产' },
      { role: 'maintenance_admin', permission: 'maintenance.view', description: '查看维护日志' },
      { role: 'maintenance_admin', permission: 'maintenance.add', description: '添加维护日志' },
      { role: 'maintenance_admin', permission: 'maintenance.edit', description: '编辑维护日志' },
      { role: 'maintenance_admin', permission: 'maintenance.delete', description: '删除维护日志' },
      { role: 'maintenance_admin', permission: 'statistics.view', description: '查看统计信息' },
      { role: 'maintenance_admin', permission: 'image.view', description: '查看资产图片' },
    ];

    // 9. 为验收管理员分配权限
    const acceptanceAdminPermissions = [
      { role: 'acceptance_admin', permission: 'asset.view_own_department', description: '查看本科室资产' },
      { role: 'acceptance_admin', permission: 'asset.add', description: '添加资产' },
      { role: 'acceptance_admin', permission: 'asset.edit_own_department', description: '编辑本科室资产' },
      { role: 'acceptance_admin', permission: 'statistics.view', description: '查看统计信息' },
      { role: 'acceptance_admin', permission: 'image.view', description: '查看资产图片' },
      { role: 'acceptance_admin', permission: 'document.upload', description: '上传技术资料' },
      { role: 'acceptance_admin', permission: 'document.download', description: '下载技术资料' },
    ];

    // 10. 为调配管理员分配权限
    const transferAdminPermissions = [
      { role: 'transfer_admin', permission: 'asset.view_own_department', description: '查看本科室资产' },
      { role: 'transfer_admin', permission: 'transfer.view', description: '查看调配记录' },
      { role: 'transfer_admin', permission: 'transfer.apply', description: '申请调配' },
      { role: 'transfer_admin', permission: 'transfer.approve', description: '审批调配' },
      { role: 'transfer_admin', permission: 'transfer.complete', description: '完成调配' },
      { role: 'transfer_admin', permission: 'statistics.view', description: '查看统计信息' },
      { role: 'transfer_admin', permission: 'image.view', description: '查看资产图片' },
    ];

    // 11. 为盘点管理员分配权限
    const inventoryAdminPermissions = [
      { role: 'inventory_admin', permission: 'asset.view_own_department', description: '查看本科室资产' },
      { role: 'inventory_admin', permission: 'inventory.view', description: '查看盘点记录' },
      { role: 'inventory_admin', permission: 'inventory.create', description: '创建盘点' },
      { role: 'inventory_admin', permission: 'inventory.edit', description: '编辑盘点' },
      { role: 'inventory_admin', permission: 'inventory.delete', description: '删除盘点' },
      { role: 'inventory_admin', permission: 'statistics.view', description: '查看统计信息' },
      { role: 'inventory_admin', permission: 'image.view', description: '查看资产图片' },
    ];

    // 12. 为普通用户分配权限
    const userPermissions = [
      { role: 'user', permission: 'asset.view_own_department', description: '查看本科室资产' },
      { role: 'user', permission: 'image.view', description: '查看资产图片' },
      { role: 'user', permission: 'document.download', description: '下载技术资料' },
      { role: 'user', permission: 'maintenance.view', description: '查看维护日志' },
      { role: 'user', permission: 'statistics.view', description: '查看统计信息' },
      { role: 'user', permission: 'transfer.view', description: '查看调配记录' },
      { role: 'user', permission: 'inventory.view', description: '查看盘点记录' },
    ];

    // 13. 插入所有权限
    const insertPermissionSQL = `
      INSERT INTO role_permissions (role, permission, description)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE description = VALUES(description)
    `;

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      // 定义所有角色权限数组
      const allRolePermissions = [
        ...systemAdminPermissions,
        ...assetAdminPermissions,
        ...departmentAdminPermissions,
        ...metrologyAdminPermissions,
        ...qualityAdminPermissions,
        ...maintenanceAdminPermissions,
        ...acceptanceAdminPermissions,
        ...transferAdminPermissions,
        ...inventoryAdminPermissions,
        ...userPermissions,
      ];

      // 批量插入所有权限
      for (const perm of allRolePermissions) {
        await connection.execute(insertPermissionSQL, [
          perm.role,
          perm.permission,
          perm.description,
        ]);
      }

      await connection.commit();
      console.log('✅ 权限数据插入成功');
      console.log(`   - 系统管理员权限: ${systemAdminPermissions.length} 项`);
      console.log(`   - 资产管理员权限: ${assetAdminPermissions.length} 项`);
      console.log(`   - 科室管理员权限: ${departmentAdminPermissions.length} 项`);
      console.log(`   - 计量管理员权限: ${metrologyAdminPermissions.length} 项`);
      console.log(`   - 质量管理员权限: ${qualityAdminPermissions.length} 项`);
      console.log(`   - 维护管理员权限: ${maintenanceAdminPermissions.length} 项`);
      console.log(`   - 验收管理员权限: ${acceptanceAdminPermissions.length} 项`);
      console.log(`   - 调配管理员权限: ${transferAdminPermissions.length} 项`);
      console.log(`   - 盘点管理员权限: ${inventoryAdminPermissions.length} 项`);
      console.log(`   - 普通用户权限: ${userPermissions.length} 项`);
      console.log(`   - 总计: ${allRolePermissions.length} 项`);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    // 7. 创建权限定义表（用于前端显示）
    await db.execute(`
      CREATE TABLE IF NOT EXISTS permission_definitions (
        id INT PRIMARY KEY AUTO_INCREMENT,
        permission VARCHAR(100) NOT NULL UNIQUE,
        category VARCHAR(50) NOT NULL COMMENT '权限分类',
        name VARCHAR(200) NOT NULL COMMENT '权限名称',
        description VARCHAR(500) NULL COMMENT '权限描述',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_category (category)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='权限定义表'
    `);
    console.log('✅ 权限定义表创建成功');

    // 8. 插入权限定义
    const permissionCategories = {
      资产: allPermissions.filter(p => p.permission.startsWith('asset.')),
      图片: allPermissions.filter(p => p.permission.startsWith('image.')),
      技术资料: allPermissions.filter(p => p.permission.startsWith('document.')),
      维护日志: allPermissions.filter(p => p.permission.startsWith('maintenance.')),
      用户管理: allPermissions.filter(p => p.permission.startsWith('user.')),
      角色权限: allPermissions.filter(p => p.permission.startsWith('role.')),
      科室管理: allPermissions.filter(p => p.permission.startsWith('department.')),
      统计信息: allPermissions.filter(p => p.permission.startsWith('statistics.')),
      系统操作: allPermissions.filter(p => p.permission.startsWith('system.')),
      调配: allPermissions.filter(p => p.permission.startsWith('transfer.')),
      盘点: allPermissions.filter(p => p.permission.startsWith('inventory.')),
    };

    const insertDefinitionSQL = `
      INSERT INTO permission_definitions (permission, category, name, description)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE 
        category = VALUES(category),
        name = VALUES(name),
        description = VALUES(description)
    `;

    const connection2 = await db.getConnection();
    try {
      await connection2.beginTransaction();

      for (const [category, permissions] of Object.entries(permissionCategories)) {
        for (const perm of permissions) {
          const name = perm.description || perm.permission;
          await connection2.execute(insertDefinitionSQL, [
            perm.permission,
            category,
            name,
            perm.description,
          ]);
        }
      }

      await connection2.commit();
      console.log('✅ 权限定义数据插入成功');
    } catch (error) {
      await connection2.rollback();
      throw error;
    } finally {
      connection2.release();
    }

    console.log('\n✅ 权限系统扩展完成！');
    console.log(`\n总共定义了 ${allPermissions.length} 项权限`);
  } catch (error) {
    console.error('❌ 扩展权限系统失败:', error);
    throw error;
  }
}

// 执行脚本
if (require.main === module) {
  extendPermissionsSystem()
    .then(() => {
      console.log('脚本执行完成');
      process.exit(0);
    })
    .catch(error => {
      console.error('脚本执行失败:', error);
      process.exit(1);
    });
}

module.exports = { extendPermissionsSystem };
