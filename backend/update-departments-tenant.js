const mysql = require('mysql2/promise');

// 数据库连接配置
const dbConfig = {
  host: '101.37.236.101',
  port: 3306,
  user: 'root',
  password: 'Cmu19801008',
  database: 'zcgl',
};

// 更新departments表中所有部门的tenant_id为2
async function updateDepartmentsTenant() {
  let connection = null;

  try {
    console.log('连接到远程数据库...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功');

    // 检查departments表结构
    console.log('\n检查departments表结构...');
    const [columns] = await connection.execute('DESCRIBE departments');
    const hasTenantIdColumn = columns.some(col => col.Field === 'tenant_id');

    if (!hasTenantIdColumn) {
      console.error('❌ departments表中不存在tenant_id字段');
      return;
    }

    // 查询当前departments表中的记录数量和tenant_id分布
    console.log('\n查询当前departments表中的记录...');
    const [departments] = await connection.execute(
      'SELECT COUNT(*) as total, tenant_id FROM departments GROUP BY tenant_id',
    );
    console.log(`当前departments表中有 ${departments[0]?.total || 0} 条记录`);
    console.log('当前tenant_id分布:');
    departments.forEach(dept => {
      console.log(`  tenant_id: ${dept.tenant_id}, 数量: ${dept.total}`);
    });

    // 执行更新操作
    console.log('\n执行更新操作...');
    const [result] = await connection.execute('UPDATE departments SET tenant_id = 2');
    console.log(`✅ 更新成功！影响了 ${result.affectedRows} 条记录`);

    // 验证更新结果
    console.log('\n验证更新结果...');
    const [updatedDepartments] = await connection.execute(
      'SELECT COUNT(*) as total, tenant_id FROM departments GROUP BY tenant_id',
    );
    console.log(`更新后departments表中有 ${updatedDepartments[0]?.total || 0} 条记录`);
    console.log('更新后tenant_id分布:');
    updatedDepartments.forEach(dept => {
      console.log(`  tenant_id: ${dept.tenant_id}, 数量: ${dept.total}`);
    });

    // 检查是否所有记录的tenant_id都为2
    const allTenantId2 = updatedDepartments.length === 1 && updatedDepartments[0].tenant_id === 2;
    if (allTenantId2) {
      console.log('\n🎉 所有部门的tenant_id已成功更新为2！');
    } else {
      console.log('\n⚠️  更新结果不符合预期，仍存在其他tenant_id的记录');
    }
  } catch (error) {
    console.error('❌ 发生错误:', error.message);
    if (error.code) {
      console.error('错误代码:', error.code);
    }
    if (error.stack) {
      console.error('错误堆栈:', error.stack);
    }
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n✅ 数据库连接已关闭');
    }
  }
}

// 执行更新操作
updateDepartmentsTenant();
