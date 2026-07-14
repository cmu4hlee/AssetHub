const mysql = require('mysql2/promise');

// 远程数据库配置
const config = {
  host: '101.37.236.101',
  port: 3306,
  user: 'root',
  password: 'Cmu19801008',
  database: 'zcgl',
};

async function improveDepartmentMatching() {
  let connection;

  try {
    // 连接到远程数据库
    connection = await mysql.createConnection(config);
    console.log('✅ 成功连接到远程数据库');

    // 1. 检查assets表的department_new字段
    console.log('\n🔍 检查assets表的department_new字段...');
    const [departmentNewSample] = await connection.execute(`
      SELECT department, department_new, asset_department_code FROM assets WHERE department_new IS NOT NULL AND department_new != '' LIMIT 10
    `);

    console.log('department vs department_new 示例数据:');
    console.table(departmentNewSample);

    // 2. 获取所有部门名称，用于分析匹配模式
    console.log('\n📊 获取所有部门名称...');
    const [allDepartments] = await connection.execute(`
      SELECT department_name FROM departments
    `);

    const departmentNames = allDepartments.map(dept => dept.department_name);
    console.log('部门表中的部门名称:');
    console.log(departmentNames.sort().join(', '));

    // 3. 获取未匹配的部门示例，用于分析
    console.log('\n❌ 获取未匹配的部门示例...');
    const [unmatchedAssets] = await connection.execute(`
      SELECT department, department_new FROM assets WHERE (asset_department_code IS NULL OR asset_department_code = '') AND department IS NOT NULL AND department != '' LIMIT 20
    `);

    console.log('未匹配的部门示例:');
    console.table(unmatchedAssets);

    // 4. 尝试使用更智能的匹配逻辑（去除括号内容，模糊匹配）
    console.log('\n🔄 使用智能匹配逻辑更新部门代码...');

    // 首先获取部门映射关系
    const [departments] = await connection.execute(`
      SELECT department_name, department_code FROM departments
    `);

    // 5. 使用更智能的匹配策略：
    //    a. 先尝试精确匹配
    //    b. 尝试去除括号内容后匹配
    //    c. 尝试模糊匹配（包含关系）
    console.log('\n📝 构建智能部门映射...');
    const smartDepartmentMap = new Map();

    departments.forEach(dept => {
      const baseName = dept.department_name.toLowerCase();
      smartDepartmentMap.set(baseName, dept.department_code);

      // 添加去除括号内容的版本
      const nameWithoutBrackets = baseName.replace(/\s*\([^)]*\)\s*/g, '').trim();
      if (nameWithoutBrackets && nameWithoutBrackets !== baseName) {
        smartDepartmentMap.set(nameWithoutBrackets, dept.department_code);
      }
    });

    console.log('✅ 智能部门映射构建完成');

    // 6. 更新未匹配的记录
    console.log('\n🔄 使用智能匹配更新未匹配的记录...');

    // 获取所有未匹配的记录
    const [unmatchedRecords] = await connection.execute(`
      SELECT id, department, department_new FROM assets WHERE (asset_department_code IS NULL OR asset_department_code = '') AND department IS NOT NULL AND department != ''
    `);

    console.log(`  共发现 ${unmatchedRecords.length} 条未匹配记录`);

    let updatedCount = 0;
    for (const asset of unmatchedRecords) {
      let matchedCode = null;
      let matchType = 'none';

      // 优先使用department_new字段（如果有）
      let assetDept = asset.department_new || asset.department;
      assetDept = assetDept.toLowerCase();

      // 1. 精确匹配
      if (smartDepartmentMap.has(assetDept)) {
        matchedCode = smartDepartmentMap.get(assetDept);
        matchType = 'exact';
      }
      // 2. 去除括号内容后匹配
      else {
        const deptWithoutBrackets = assetDept.replace(/\s*\([^)]*\)\s*/g, '').trim();
        if (deptWithoutBrackets && smartDepartmentMap.has(deptWithoutBrackets)) {
          matchedCode = smartDepartmentMap.get(deptWithoutBrackets);
          matchType = 'brackets_removed';
        }
        // 3. 模糊匹配（包含关系）
        else {
          for (const [deptName, deptCode] of smartDepartmentMap.entries()) {
            if (assetDept.includes(deptName) || deptName.includes(assetDept)) {
              matchedCode = deptCode;
              matchType = 'fuzzy';
              break;
            }
          }
        }
      }

      if (matchedCode) {
        await connection.execute('UPDATE assets SET asset_department_code = ? WHERE id = ?', [
          matchedCode,
          asset.id,
        ]);
        updatedCount++;

        if (updatedCount <= 10) {
          // 只显示前10条匹配结果
          console.log(`  ✅ 匹配: ${asset.department} -> ${matchedCode} (${matchType})`);
        }
      }
    }

    console.log(`✅ 智能匹配成功更新 ${updatedCount} 条记录`);

    // 7. 验证最终结果
    console.log('\n🔍 验证最终结果...');
    const [finalResult] = await connection.execute(`
      SELECT 
        COUNT(*) as total, 
        SUM(CASE WHEN asset_department_code IS NOT NULL AND asset_department_code != '' THEN 1 ELSE 0 END) as updated 
      FROM assets 
      WHERE department IS NOT NULL AND department != ''
    `);

    console.log(
      `  最终结果: 总记录数 = ${finalResult[0].total}, 已更新记录数 = ${finalResult[0].updated}, 匹配率 = ${((finalResult[0].updated / finalResult[0].total) * 100).toFixed(2)}%`,
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
improveDepartmentMatching();
