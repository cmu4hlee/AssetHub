/**
 * 数据质量问题修复脚本
 * 1. 修复重复asset_code
 * 2. 修复current_value为0的资产
 * 3. 修复无asset_code的资产
 */

const db = require('../config/database');

async function fixDuplicateAssetCodes() {
  console.log('\n=== 修复重复asset_code ===\n');

  // 查找重复的asset_code
  const [dupCodes] = await db.execute(
    `SELECT asset_code, COUNT(*) as cnt, GROUP_CONCAT(id ORDER BY id) as ids
     FROM assets 
     WHERE tenant_id = 2 AND asset_code IS NOT NULL 
     GROUP BY asset_code 
     HAVING cnt > 1`,
  );

  console.log(`找到 ${dupCodes.length} 个重复的asset_code`);

  let fixedCount = 0;

  for (const dup of dupCodes) {
    const ids = dup.ids.split(',').map(Number);
    // 保留第一个，其他的添加后缀
    for (let i = 1; i < ids.length; i++) {
      const newCode = `${dup.asset_code}_DUP${i}`;
      await db.execute(
        'UPDATE assets SET asset_code = ? WHERE id = ?',
        [newCode, ids[i]],
      );
      fixedCount++;
    }
  }

  console.log(`✅ 已修复 ${fixedCount} 条重复记录`);
}

async function fixZeroCurrentValue() {
  console.log('\n=== 修复current_value为0的资产 ===\n');

  // 查找current_value为0但purchase_price不为0的资产
  const [assets] = await db.execute(
    `SELECT id, asset_name, purchase_price, depreciation_method, depreciation_years, 
            depreciation_months, purchase_date, current_value
     FROM assets 
     WHERE tenant_id = 2 AND current_value = 0 AND purchase_price > 0`,
  );

  console.log(`找到 ${assets.length} 条current_value为0的资产`);

  let fixedCount = 0;

  for (const asset of assets) {
    let newValue = 0;

    if (asset.depreciation_method && asset.depreciation_method.includes('平均年限')) {
      // 平均年限法: 当前价值 = 购置价格 * (剩余年限 / 总年限)
      const totalMonths = (asset.depreciation_years || 5) * 12;
      const usedMonths = asset.depreciation_months || 0;
      const remainingMonths = Math.max(0, totalMonths - usedMonths);
      newValue = asset.purchase_price * (remainingMonths / totalMonths);
    } else {
      // 其他情况：如果没有折旧信息，设为购置价格的80%
      newValue = asset.purchase_price * 0.8;
    }

    // 保留2位小数
    newValue = Math.round(newValue * 100) / 100;

    await db.execute(
      'UPDATE assets SET current_value = ? WHERE id = ?',
      [newValue, asset.id],
    );
    fixedCount++;

    if (fixedCount % 1000 === 0) {
      console.log(`   已处理 ${fixedCount}/${assets.length}...`);
    }
  }

  console.log(`✅ 已修复 ${fixedCount} 条记录`);
}

async function fixNullAssetCodes() {
  console.log('\n=== 修复无asset_code的资产 ===\n');

  // 查找无asset_code的资产
  const [assets] = await db.execute(
    `SELECT id, asset_name, category_id, created_at
     FROM assets 
     WHERE tenant_id = 2 AND asset_code IS NULL`,
  );

  console.log(`找到 ${assets.length} 条无asset_code的资产`);

  let fixedCount = 0;

  for (const asset of assets) {
    // 生成新的asset_code: 前缀 + 时间戳 + ID
    const timestamp = Date.now().toString(36).toUpperCase();
    const newCode = `GEN${timestamp}${asset.id}`;

    await db.execute(
      'UPDATE assets SET asset_code = ? WHERE id = ?',
      [newCode, asset.id],
    );
    fixedCount++;
  }

  console.log(`✅ 已生成 ${fixedCount} 个新asset_code`);
}

async function verifyFixes() {
  console.log('\n=== 验证修复结果 ===\n');

  // 检查重复asset_code
  const [dupCheck] = await db.execute(
    `SELECT COUNT(*) as cnt 
     FROM (SELECT asset_code FROM assets WHERE tenant_id = 2 AND asset_code IS NOT NULL GROUP BY asset_code HAVING COUNT(*) > 1) t`,
  );
  console.log(`重复asset_code: ${dupCheck[0].cnt} (应为0)`);

  // 检查current_value为0的资产
  const [zeroCheck] = await db.execute(
    'SELECT COUNT(*) as cnt FROM assets WHERE tenant_id = 2 AND current_value = 0 AND purchase_price > 0',
  );
  console.log(`current_value为0: ${zeroCheck[0].cnt} (应为0)`);

  // 检查无asset_code的资产
  const [nullCheck] = await db.execute(
    'SELECT COUNT(*) as cnt FROM assets WHERE tenant_id = 2 AND asset_code IS NULL',
  );
  console.log(`无asset_code: ${nullCheck[0].cnt} (应为0)`);

  // 检查新的统计
  const [stats] = await db.execute(
    `SELECT COUNT(*) as total, 
            SUM(purchase_price) as purchase_value,
            SUM(current_value) as current_value
     FROM assets WHERE tenant_id = 2`,
  );
  console.log('\n修复后统计:');
  console.log(`  总资产: ${stats[0].total}`);
  console.log(`  资产原值: ¥${stats[0].purchase_value}`);
  console.log(`  资产现值: ¥${stats[0].current_value}`);
}

async function main() {
  try {
    console.log('开始修复数据质量问题...');

    await fixDuplicateAssetCodes();
    await fixZeroCurrentValue();
    await fixNullAssetCodes();
    await verifyFixes();

    console.log('\n✅ 所有数据修复完成！');
    process.exit(0);
  } catch (error) {
    console.error('修复失败:', error);
    process.exit(1);
  }
}

main();
