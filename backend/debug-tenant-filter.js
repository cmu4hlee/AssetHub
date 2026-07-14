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

async function debugTenantFilter() {
  const connection = await mysql.createConnection(config);

  try {
    console.log('=== 调试租户过滤逻辑 ===');

    // 资产信息
    const assetCode = 'JJ2023000007';
    console.log(`\n1. 查询资产 ${assetCode} 的详细信息:`);

    const [assets] = await connection.execute(
      `SELECT id, code, asset_code, asset_name, brand, model, tenant_id FROM assets 
       WHERE code = ?`,
      [assetCode],
    );

    const asset = assets[0];
    console.log('✅ 找到资产:');
    console.log(`   id: ${asset.id}`);
    console.log(`   code: ${asset.code}`);
    console.log(`   asset_code: ${asset.asset_code}`);
    console.log(`   tenant_id: ${asset.tenant_id}`);

    // 2. 查询技术资料表中的tenant_id字段
    console.log('\n2. 查询技术资料表中的tenant_id字段:');
    const [techDocs] = await connection.execute(
      `SELECT id, title, brand, model, tenant_id, status FROM technical_documents 
       WHERE (brand = '待完善' AND (model IS NULL OR model = '')) OR id IN (22, 23, 21, 7, 6) 
       ORDER BY id DESC`,
    );

    console.log(`找到 ${techDocs.length} 条技术资料:`);
    techDocs.forEach(doc => {
      console.log(
        `   - ${doc.title} (ID: ${doc.id}, brand: ${doc.brand || '无'}, model: ${doc.model || '无'}, tenant_id: ${doc.tenant_id}, status: ${doc.status})`,
      );
    });

    // 3. 检查中间表中的关联记录，查看关联的资产ID
    console.log('\n3. 检查中间表中的关联记录:');
    const [relations] = await connection.execute(
      `SELECT r.*, a.id as asset_id, a.code as asset_code, a.tenant_id as asset_tenant_id 
       FROM technical_document_asset_relations r
       LEFT JOIN assets a ON r.asset_id = a.id 
       WHERE r.asset_code = ?`,
      [assetCode],
    );

    console.log(`中间表中有 ${relations.length} 条关联记录:`);
    relations.forEach(relation => {
      console.log(
        `   - 文档ID: ${relation.document_id}, 资产ID: ${relation.asset_id}, 资产编码: ${relation.asset_code}, 资产租户ID: ${relation.asset_tenant_id}`,
      );
    });

    // 4. 模拟API查询，包括租户过滤
    console.log('\n4. 模拟API查询，包括租户过滤:');
    const tenantId = asset.tenant_id;
    const [apiResult] = await connection.execute(
      `SELECT td.*,
            CASE 
              WHEN td.id IN (SELECT document_id FROM technical_document_asset_relations WHERE asset_id = ? OR asset_code = ? OR asset_code = ?) THEN '直接关联'
              WHEN (td.brand = ? OR (td.brand IS NULL AND ? IS NULL)) AND (td.model = ? OR (td.model IS NULL AND ? IS NULL)) THEN '品牌型号匹配'
              ELSE '其他'
            END as link_type
       FROM technical_documents td
       WHERE td.status != 'deleted' AND td.tenant_id = ? AND (
         td.id IN (SELECT document_id FROM technical_document_asset_relations WHERE asset_id = ? OR asset_code = ? OR asset_code = ?)
         OR ((td.brand = ? OR (td.brand IS NULL AND ? IS NULL)) AND (td.model = ? OR (td.model IS NULL AND ? IS NULL)))
       )
       ORDER BY td.upload_date DESC`,
      [
        asset.id,
        asset.code,
        asset.asset_code,
        asset.brand,
        asset.brand,
        asset.model,
        asset.model,
        tenantId,
        asset.id,
        asset.code,
        asset.asset_code,
        asset.brand,
        asset.brand,
        asset.model,
        asset.model,
      ],
    );

    console.log(`API查询返回 ${apiResult.length} 条技术资料:`);
    apiResult.forEach(doc => {
      console.log(
        `   - ${doc.title} (关联类型: ${doc.link_type}, brand: ${doc.brand || '无'}, model: ${doc.model || '无'}, tenant_id: ${doc.tenant_id})`,
      );
    });

    // 5. 不使用租户过滤的API查询
    console.log('\n5. 不使用租户过滤的API查询:');
    const [noTenantResult] = await connection.execute(
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
       )
       ORDER BY td.upload_date DESC`,
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

    console.log(`不使用租户过滤的API查询返回 ${noTenantResult.length} 条技术资料:`);
    noTenantResult.forEach(doc => {
      console.log(
        `   - ${doc.title} (关联类型: ${doc.link_type}, brand: ${doc.brand || '无'}, model: ${doc.model || '无'}, tenant_id: ${doc.tenant_id})`,
      );
    });
  } catch (error) {
    console.error('❌ 调试过程中发生错误:', error.message);
    console.error('错误堆栈:', error.stack);
  } finally {
    await connection.end();
  }
}

debugTenantFilter();
