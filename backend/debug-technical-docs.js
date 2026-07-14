const mysql = require('mysql2/promise');
require('dotenv').config();

// 数据库配置
const config = {
  host: process.env.DB_HOST || '101.37.236.101',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'Leon@2024',
  database: process.env.DB_NAME || 'zcgl',
};

async function debugTechnicalDocs() {
  const connection = await mysql.createConnection(config);

  try {
    console.log('=== 调试技术资料关联 ===');

    // 资产信息
    const assetCode = 'JJ2023000007';
    console.log(`\n1. 查询资产 ${assetCode} 的详细信息:`);

    const [assets] = await connection.execute(
      `SELECT id, code, asset_code, asset_name, brand, model, tenant_id FROM assets 
       WHERE code = ? OR asset_code = ?`,
      [assetCode, assetCode],
    );

    if (assets.length === 0) {
      console.log(`❌ 未找到资产 ${assetCode}`);
      return;
    }

    const asset = assets[0];
    console.log('✅ 找到资产:');
    console.log(`   id: ${asset.id}`);
    console.log(`   code: ${asset.code}`);
    console.log(`   asset_code: ${asset.asset_code}`);
    console.log(`   asset_name: ${asset.asset_name}`);
    console.log(`   brand: ${asset.brand}`);
    console.log(`   model: ${asset.model}`);
    console.log(`   tenant_id: ${asset.tenant_id}`);

    // 2. 查询所有技术资料，查看是否有匹配的
    console.log('\n2. 查询技术资料表中的所有资料（前10条）:');
    const [allDocs] = await connection.execute(
      `SELECT id, title, brand, model, status FROM technical_documents 
       WHERE status != 'deleted' LIMIT 10`,
    );

    console.log(`找到 ${allDocs.length} 条技术资料:`);
    allDocs.forEach(doc => {
      console.log(
        `   - ${doc.title} (brand: ${doc.brand || '无'}, model: ${doc.model || '无'}, status: ${doc.status})`,
      );
    });

    // 3. 查询直接关联的技术资料
    console.log('\n3. 查询直接关联的技术资料:');
    const [directDocs] = await connection.execute(
      `SELECT td.*, r.asset_id, r.asset_code FROM technical_documents td
       JOIN technical_document_asset_relations r ON td.id = r.document_id
       WHERE (r.asset_id = ? OR r.asset_code = ? OR r.asset_code = ?) AND td.status != 'deleted'`,
      [asset.id, asset.code, asset.asset_code],
    );

    console.log(`找到 ${directDocs.length} 条直接关联的技术资料:`);
    directDocs.forEach(doc => {
      console.log(
        `   - ${doc.title} (关联类型: 直接关联, 资产ID: ${doc.asset_id}, 资产编码: ${doc.asset_code})`,
      );
    });

    // 4. 查询品牌型号匹配的技术资料
    console.log('\n4. 查询品牌型号匹配的技术资料:');
    const [brandModelDocs] = await connection.execute(
      `SELECT * FROM technical_documents 
       WHERE status != 'deleted' 
       AND (brand = ? OR (brand IS NULL AND ? IS NULL)) 
       AND (model = ? OR (model IS NULL AND ? IS NULL))`,
      [asset.brand, asset.brand, asset.model, asset.model],
    );

    console.log(`找到 ${brandModelDocs.length} 条品牌型号匹配的技术资料:`);
    brandModelDocs.forEach(doc => {
      console.log(`   - ${doc.title} (品牌: ${doc.brand || '无'}, 型号: ${doc.model || '无'})`);
    });

    // 5. 查询所有关联的技术资料（包括直接关联和品牌型号匹配）
    console.log('\n5. 查询所有关联的技术资料:');
    const [allRelatedDocs] = await connection.execute(
      `SELECT td.*,
            CASE 
              WHEN td.id IN (SELECT document_id FROM technical_document_asset_relations WHERE asset_id = ? OR asset_code = ? OR asset_code = ?) THEN '直接关联'
              WHEN (td.brand = ? OR (td.brand IS NULL AND ? IS NULL)) AND (td.model = ? OR (td.model IS NULL AND ? IS NULL)) THEN '品牌型号匹配'
              ELSE '其他'
            END as link_type
       FROM technical_documents td
       WHERE td.status != 'deleted' AND (
         td.id IN (SELECT document_id FROM technical_document_asset_relations WHERE asset_id = ? OR asset_code = ? OR asset_code = ?)
         OR ((td.brand = ? OR (td.brand IS NULL AND ? IS NULL)) AND (td.model = ? OR (td.model IS NULL AND ? IS NULL)))
       )`,
      [
        asset.id,
        asset.code,
        asset.asset_code,
        asset.brand,
        asset.brand,
        asset.model,
        asset.model,
        asset.id,
        asset.code,
        asset.asset_code,
        asset.brand,
        asset.brand,
        asset.model,
        asset.model,
      ],
    );

    console.log(`找到 ${allRelatedDocs.length} 条关联的技术资料:`);
    allRelatedDocs.forEach(doc => {
      console.log(
        `   - ${doc.title} (关联类型: ${doc.link_type}, 品牌: ${doc.brand || '无'}, 型号: ${doc.model || '无'})`,
      );
    });

    // 6. 检查中间表中的关联记录
    console.log('\n6. 检查中间表中的关联记录:');
    const [relations] = await connection.execute(
      `SELECT * FROM technical_document_asset_relations 
       WHERE asset_id = ? OR asset_code = ? OR asset_code = ?`,
      [asset.id, asset.code, asset.asset_code],
    );

    console.log(`中间表中有 ${relations.length} 条关联记录:`);
    relations.forEach(relation => {
      console.log(
        `   - 文档ID: ${relation.document_id}, 资产ID: ${relation.asset_id}, 资产编码: ${relation.asset_code}`,
      );
    });
  } catch (error) {
    console.error('❌ 调试过程中发生错误:', error.message);
    console.error('错误堆栈:', error.stack);
  } finally {
    await connection.end();
  }
}

debugTechnicalDocs();
