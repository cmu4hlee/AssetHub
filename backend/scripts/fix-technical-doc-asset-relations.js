// 修复 technical_document_asset_relations 表中 asset_id 实际存的是 asset_code 的问题
// 目标：统一保证 asset_id = assets.id，asset_code = assets.asset_code

const path = require('path');
const fs = require('fs');

// 优先加载 backend/.env，其次是项目根目录 .env
const envPath = path.join(__dirname, '../.env');
const parentEnvPath = path.join(__dirname, '../../.env');

if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
} else if (fs.existsSync(parentEnvPath)) {
  require('dotenv').config({ path: parentEnvPath });
} else {
  require('dotenv').config();
}

const db = require('../config/database');

async function fixTechnicalDocAssetRelations() {
  try {
    console.log(
      '开始修复 technical_document_asset_relations.asset_id 与 asset_code 不一致的问题...',
    );

    // 1. 统计当前中间表记录数
    const [countRows] = await db.execute(
      'SELECT COUNT(*) AS total FROM technical_document_asset_relations',
    );
    console.log(`当前中间表总记录数: ${countRows[0].total}`);

    // 2. 找出存在潜在问题的记录：
    //    通过 asset_code 关联 assets 表，检查 asset_id 是否为对应的 assets.id
    const [mismatched] = await db.execute(`
      SELECT r.id, r.document_id, r.asset_id AS relation_asset_id, r.asset_code,
             a.id AS real_asset_id
      FROM technical_document_asset_relations r
      JOIN assets a ON r.asset_code = a.asset_code
      WHERE r.asset_id IS NULL OR r.asset_id <> a.id
    `);

    if (mismatched.length === 0) {
      console.log('✅ 未发现 asset_id 与 asset_code 不一致的记录，无需修复。');
      process.exit(0);
    }

    console.log(`发现 ${mismatched.length} 条 asset_id 需要修复的记录。`);

    // 3. 逐条修复 asset_id
    for (const row of mismatched) {
      console.log(
        `修复记录ID=${row.id}, document_id=${row.document_id}, ` +
          `asset_code=${row.asset_code}, relation_asset_id=${row.relation_asset_id}, real_asset_id=${row.real_asset_id}`,
      );

      await db.execute('UPDATE technical_document_asset_relations SET asset_id = ? WHERE id = ?', [
        row.real_asset_id,
        row.id,
      ]);
    }

    console.log('✅ 所有不一致的 asset_id 已修复完成。');

    // 4. 再次校验
    const [remain] = await db.execute(`
      SELECT COUNT(*) AS remain
      FROM technical_document_asset_relations r
      JOIN assets a ON r.asset_code = a.asset_code
      WHERE r.asset_id IS NULL OR r.asset_id <> a.id
    `);

    if (remain[0].remain === 0) {
      console.log('✅ 校验通过：所有记录的 asset_id 与 asset_code 对应的 assets.id 一致。');
    } else {
      console.warn(`⚠️ 仍有 ${remain[0].remain} 条记录不一致，请手工检查。`);
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ 修复过程出错:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

if (require.main === module) {
  fixTechnicalDocAssetRelations();
}

module.exports = fixTechnicalDocAssetRelations;
