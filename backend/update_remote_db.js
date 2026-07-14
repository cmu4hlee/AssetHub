const mysql = require('mysql2/promise');

// 远程数据库配置
const config = {
  host: '101.37.236.101',
  port: 3306,
  user: 'root',
  password: 'Cmu19801008',
  database: 'zcgl',
};

async function updateRemoteDatabase() {
  let connection;

  try {
    // 连接到远程数据库
    connection = await mysql.createConnection(config);
    console.log('✅ 成功连接到远程数据库');

    // 1. 向assets表添加asset_department_code字段
    console.log('\n📝 向assets表添加asset_department_code字段...');
    await connection.execute(`
      ALTER TABLE assets ADD COLUMN asset_department_code VARCHAR(50) NULL COMMENT '部门代码'
    `);
    console.log('✅ 成功添加asset_department_code字段');

    // 2. 获取部门映射关系 (department_name -> department_code)
    console.log('\n📊 获取部门映射关系...');
    const [departments] = await connection.execute(`
      SELECT department_name, department_code FROM department
    `);

    const departmentMap = new Map();
    departments.forEach(dept => {
      // 转换为小写用于不区分大小写匹配
      const deptName = dept.department_name.toLowerCase();
      departmentMap.set(deptName, dept.department_code);
      console.log(`  ${dept.department_name} -> ${dept.department_code}`);
    });

    console.log('✅ 成功获取部门映射关系');

    // 3. 更新assets表的asset_department_code字段
    console.log('\n🔄 更新assets表的asset_department_code字段...');

    // 首先获取所有需要更新的资产
    const [assets] = await connection.execute(`
      SELECT id, department FROM assets WHERE department IS NOT NULL AND department != ''
    `);

    console.log(`  共发现 ${assets.length} 条需要更新的资产记录`);

    // 批量更新记录
    let updatedCount = 0;
    for (const asset of assets) {
      const assetDept = asset.department.toLowerCase();
      const matchedDeptCode = departmentMap.get(assetDept);

      if (matchedDeptCode) {
        await connection.execute('UPDATE assets SET asset_department_code = ? WHERE id = ?', [
          matchedDeptCode,
          asset.id,
        ]);
        updatedCount++;
      } else {
        console.log(`  ⚠️  未找到匹配的部门代码: ${asset.department}`);
      }
    }

    console.log(`✅ 成功更新 ${updatedCount} 条记录`);

    // 4. 验证更新结果
    console.log('\n🔍 验证更新结果...');
    const [validationResult] = await connection.execute(`
      SELECT COUNT(*) as total, SUM(CASE WHEN asset_department_code IS NOT NULL THEN 1 ELSE 0 END) as updated 
      FROM assets WHERE department IS NOT NULL AND department != ''
    `);

    console.log(
      `  验证结果: 总记录数 = ${validationResult[0].total}, 已更新记录数 = ${validationResult[0].updated}`,
    );
  } catch (error) {
    console.error('❌ 操作失败:', error.message);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n✅ 数据库连接已关闭');
    }
  }
}

// 执行更新
updateRemoteDatabase();
