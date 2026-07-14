const db = require('../config/database');

async function removeDepartmentIdFields() {
  try {
    console.log('开始删除数据库表中的department_id字段...');

    // 1. 修改common_asset_stats表
    console.log('\n1. 修改common_asset_stats表:');
    try {
      // 先检查是否存在department_id字段
      const [columns1] = await db.execute(`
        SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'common_asset_stats' 
        AND COLUMN_NAME = 'department_id'
      `);

      if (columns1.length > 0) {
        // 删除外键约束
        try {
          await db.execute(
            'ALTER TABLE common_asset_stats DROP FOREIGN KEY common_asset_stats_ibfk_1',
          );
          console.log('  ✓ 已删除外键约束');
        } catch (error) {
          console.log('  ℹ 外键约束不存在或已删除:', error.message);
        }

        // 删除唯一索引
        try {
          await db.execute('ALTER TABLE common_asset_stats DROP INDEX uk_dept_asset');
          console.log('  ✓ 已删除唯一索引');
        } catch (error) {
          console.log('  ℹ 唯一索引不存在或已删除:', error.message);
        }

        // 删除department_id字段
        await db.execute('ALTER TABLE common_asset_stats DROP COLUMN department_id');
        console.log('  ✓ 已删除department_id字段');
      } else {
        console.log('  ℹ department_id字段不存在，跳过删除');
      }
    } catch (error) {
      console.error('  ✗ 修改common_asset_stats表失败:', error.message);
    }

    // 2. 修改user_managed_departments表
    console.log('\n2. 修改user_managed_departments表:');
    try {
      // 先检查是否存在department_id字段
      const [columns2] = await db.execute(`
        SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'user_managed_departments' 
        AND COLUMN_NAME = 'department_id'
      `);

      if (columns2.length > 0) {
        // 删除外键约束
        try {
          await db.execute(
            'ALTER TABLE user_managed_departments DROP FOREIGN KEY user_managed_departments_ibfk_3',
          );
          console.log('  ✓ 已删除外键约束');
        } catch (error) {
          console.log('  ℹ 外键约束不存在或已删除:', error.message);
        }

        // 删除唯一索引
        try {
          await db.execute(
            'ALTER TABLE user_managed_departments DROP INDEX unique_user_department',
          );
          console.log('  ✓ 已删除唯一索引');
        } catch (error) {
          console.log('  ℹ 唯一索引不存在或已删除:', error.message);
        }

        // 删除department_id字段
        await db.execute('ALTER TABLE user_managed_departments DROP COLUMN department_id');
        console.log('  ✓ 已删除department_id字段');
      } else {
        console.log('  ℹ department_id字段不存在，跳过删除');
      }
    } catch (error) {
      console.error('  ✗ 修改user_managed_departments表失败:', error.message);
    }

    // 3. 验证修改结果
    console.log('\n3. 验证修改结果:');
    try {
      console.log('\ncommon_asset_stats表结构:');
      const [commonAssetStatsColumns] = await db.execute('SHOW COLUMNS FROM common_asset_stats');
      commonAssetStatsColumns.forEach(col => {
        if (col.Field !== 'department_id') {
          console.log(
            `  ${col.Field} (${col.Type}) ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${col.Default ? `DEFAULT ${col.Default}` : ''} ${col.Comment}`,
          );
        }
      });

      console.log('\nuser_managed_departments表结构:');
      const [userManagedDepartmentsColumns] = await db.execute(
        'SHOW COLUMNS FROM user_managed_departments',
      );
      userManagedDepartmentsColumns.forEach(col => {
        if (col.Field !== 'department_id') {
          console.log(
            `  ${col.Field} (${col.Type}) ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${col.Default ? `DEFAULT ${col.Default}` : ''} ${col.Comment}`,
          );
        }
      });
    } catch (error) {
      console.error('  ✗ 验证修改结果失败:', error.message);
    }

    console.log('\n🎉 删除department_id字段操作完成!');
  } catch (error) {
    console.error('❌ 执行失败:', error.message);
  } finally {
    // 关闭数据库连接
    try {
      await db.end();
      console.log('\n✓ 数据库连接已关闭');
    } catch (error) {
      console.error('✗ 关闭数据库连接失败:', error.message);
    }
  }
}

// 执行脚本
removeDepartmentIdFields();
