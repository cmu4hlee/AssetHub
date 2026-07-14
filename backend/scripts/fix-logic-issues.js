/**
 * 逻辑问题修复脚本
 * 修复发现的各种数据逻辑问题
 */

const db = require('../config/database');

// 1. 修复现值 > 购置价的资产
async function fixValueLogic() {
  console.log('\n=== 1. 修复现值 > 购置价的资产 ===');

  const [assets] = await db.execute(
    `SELECT id, asset_name, purchase_price, current_value 
     FROM assets 
     WHERE tenant_id = 2 AND current_value > purchase_price`,
  );

  console.log(`   找到 ${assets.length} 条记录`);

  if (assets.length > 0) {
    await db.execute(
      `UPDATE assets 
       SET current_value = purchase_price 
       WHERE tenant_id = 2 AND current_value > purchase_price`,
    );
    console.log('   ✅ 已修复：现值设置为购置价');
  }
}

// 2. 修复折旧月数超限
async function fixDepreciationMonths() {
  console.log('\n=== 2. 修复折旧月数超限 ===');

  const [assets] = await db.execute(
    `SELECT id, depreciation_years, depreciation_months 
     FROM assets 
     WHERE tenant_id = 2 AND depreciation_months > depreciation_years * 12`,
  );

  console.log(`   找到 ${assets.length} 条记录`);

  if (assets.length > 0) {
    await db.execute(
      `UPDATE assets 
       SET depreciation_months = depreciation_years * 12 
       WHERE tenant_id = 2 AND depreciation_months > depreciation_years * 12`,
    );
    console.log('   ✅ 已修复：折旧月数设置为最大值');
  }
}

// 3. 修复报废但现值过高的资产
async function fixScrappedAssets() {
  console.log('\n=== 3. 修复报废但现值过高的资产 ===');

  const [assets] = await db.execute(
    `SELECT id, asset_name, current_value 
     FROM assets 
     WHERE tenant_id = 2 AND status = '报废' AND current_value > 1000`,
  );

  console.log(`   找到 ${assets.length} 条记录`);

  if (assets.length > 0) {
    await db.execute(
      `UPDATE assets 
       SET current_value = 0 
       WHERE tenant_id = 2 AND status = '报废' AND current_value > 1000`,
    );
    console.log('   ✅ 已修复：报废资产现值清零');
  }
}

// 4. 补充缺失的购置日期
async function fixNullPurchaseDate() {
  console.log('\n=== 4. 补充缺失的购置日期 ===');

  const [assets] = await db.execute(
    `SELECT id, created_at 
     FROM assets 
     WHERE tenant_id = 2 AND purchase_date IS NULL`,
  );

  console.log(`   找到 ${assets.length} 条记录`);

  if (assets.length > 0) {
    await db.execute(
      `UPDATE assets 
       SET purchase_date = created_at 
       WHERE tenant_id = 2 AND purchase_date IS NULL`,
    );
    console.log('   ✅ 已修复：购置日期设置为创建日期');
  }
}

// 5. 修复提足折旧但仍在用的资产
async function fixFullyDepreciatedAssets() {
  console.log('\n=== 5. 标记提足折旧但仍在用的资产 ===');

  const [assets] = await db.execute(
    `SELECT COUNT(*) as cnt
     FROM assets 
     WHERE tenant_id = 2 AND status = '在用' 
     AND depreciation_months >= depreciation_years * 12
     AND depreciation_years > 0`,
  );

  const count = assets[0].cnt;
  console.log(`   找到 ${count} 条提足折旧但在用的资产`);
  console.log('   ⚠️ 这些资产建议进行报废评估');
  console.log('   SQL: SELECT * FROM assets WHERE status="在用" AND depreciation_months >= depreciation_years * 12');
}

// 6. 修复跨租户关联
async function fixCrossTenantIssues() {
  console.log('\n=== 6. 修复跨租户关联 ===');

  const [issues] = await db.execute(
    `SELECT a.id, a.tenant_id as asset_tenant, d.tenant_id as dept_tenant
     FROM assets a 
     JOIN departments d ON a.department_new = d.department_code 
     WHERE a.tenant_id != d.tenant_id`,
  );

  console.log(`   找到 ${issues.length} 条跨租户关联`);

  if (issues.length > 0) {
    // 统一设置为资产所属租户
    await db.execute(
      `UPDATE departments d 
       JOIN assets a ON a.department_new = d.department_code 
       SET d.tenant_id = a.tenant_id 
       WHERE a.tenant_id != d.tenant_id`,
    );
    console.log('   ✅ 已修复：部门租户统一为资产租户');
  }
}

// 验证修复结果
async function verifyLogicFixes() {
  console.log('\n=== 验证修复结果 ===');

  const checks = await db.execute(`
    SELECT 
      (SELECT COUNT(*) FROM assets WHERE tenant_id = 2 AND current_value > purchase_price) as value_logic_error,
      (SELECT COUNT(*) FROM assets WHERE tenant_id = 2 AND depreciation_months > depreciation_years * 12) as depreciation_error,
      (SELECT COUNT(*) FROM assets WHERE tenant_id = 2 AND status = '报废' AND current_value > 1000) as scrapped_error,
      (SELECT COUNT(*) FROM assets WHERE tenant_id = 2 AND purchase_date IS NULL) as null_date_error
    FROM dual
  `);

  const c = checks[0][0];
  console.log(`   现值>购置价: ${c.value_logic_error} (应为0)`);
  console.log(`   折旧月数超限: ${c.depreciation_error} (应为0)`);
  console.log(`   报废但现值>1000: ${c.scrapped_error} (应为0)`);
  console.log(`   无购置日期: ${c.null_date_error} (应为0)`);

  const allFixed = c.value_logic_error == 0 && c.depreciation_error == 0 &&
                   c.scrapped_error == 0 && c.null_date_error == 0;

  if (allFixed) {
    console.log('   ✅ 所有逻辑问题已修复！');
  } else {
    console.log('   ⚠️ 仍有部分问题未解决');
  }
}

async function main() {
  try {
    console.log('开始修复逻辑问题...');

    await fixValueLogic();
    await fixDepreciationMonths();
    await fixScrappedAssets();
    await fixNullPurchaseDate();
    await fixFullyDepreciatedAssets();
    await fixCrossTenantIssues();
    await verifyLogicFixes();

    console.log('\n✅ 逻辑问题修复完成！');
    process.exit(0);
  } catch (error) {
    console.error('修复失败:', error);
    process.exit(1);
  }
}

main();
