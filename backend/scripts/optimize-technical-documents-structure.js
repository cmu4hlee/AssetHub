const db = require('../config/database');

async function optimizeTechnicalDocumentsStructure() {
  try {
    console.log('开始优化技术资料表结构...');

    // 1. 创建技术资料与资产的多对多关联中间表
    await db.execute(`
      CREATE TABLE IF NOT EXISTS technical_document_asset_relations (
        id INT PRIMARY KEY AUTO_INCREMENT,
        document_id INT NOT NULL COMMENT '技术资料ID',
        asset_id INT NOT NULL COMMENT '资产ID',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (document_id) REFERENCES technical_documents(id) ON DELETE CASCADE,
        FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE,
        UNIQUE KEY uk_document_asset (document_id, asset_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='技术资料与资产关联表';
    `);
    console.log('✅ 创建技术资料与资产关联表成功');

    // 2. 添加索引到中间表
    await db.execute(`
      CREATE INDEX idx_asset_document ON technical_document_asset_relations(asset_id, document_id);
    `);
    console.log('✅ 为中间表添加索引成功');

    // 3. 删除冗余字段 asset.code 和 asset_name
    await db.execute(`
      ALTER TABLE technical_documents DROP COLUMN IF EXISTS asset.code;
    `);
    await db.execute(`
      ALTER TABLE technical_documents DROP COLUMN IF EXISTS asset_name;
    `);
    console.log('✅ 删除冗余字段成功');

    // 4. 优化字段长度
    await db.execute(`
      ALTER TABLE technical_documents MODIFY COLUMN title VARCHAR(255) NOT NULL COMMENT '资料标题';
    `);
    await db.execute(`
      ALTER TABLE technical_documents MODIFY COLUMN file_name VARCHAR(255) NOT NULL COMMENT '文件名';
    `);
    console.log('✅ 优化字段长度成功');

    // 5. 添加优化的复合索引
    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_tenant_status_review ON technical_documents(tenant_id, status, review_status);
    `);
    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_tenant_asset ON technical_documents(tenant_id, asset_id);
    `);
    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_tenant_brand_model ON technical_documents(tenant_id, brand, model);
    `);
    console.log('✅ 添加复合索引成功');

    // 6. 数据迁移：将现有asset_ids数据迁移到中间表
    console.log('开始迁移数据...');

    // 查询所有有asset_ids的技术资料
    const [documents] = await db.execute(`
      SELECT id, asset_ids FROM technical_documents WHERE asset_ids IS NOT NULL AND asset_ids != '';
    `);

    console.log(`找到 ${documents.length} 条需要迁移的技术资料`);

    // 迁移数据
    for (const doc of documents) {
      try {
        const assetIds = JSON.parse(doc.asset_ids);
        if (Array.isArray(assetIds) && assetIds.length > 0) {
          // 批量插入关联数据
          const values = assetIds.map(assetId => `(${doc.id}, ${assetId})`).join(',');
          await db.execute(`
            INSERT INTO technical_document_asset_relations (document_id, asset_id)
            VALUES ${values};
          `);
          console.log(`✅ 迁移技术资料 ${doc.id} 的 ${assetIds.length} 个资产关联成功`);
        }
      } catch (e) {
        console.error(`❌ 迁移技术资料 ${doc.id} 失败:`, e);
        continue;
      }
    }

    console.log('✅ 数据迁移完成');

    // 7. 添加单一资产关联到中间表
    console.log('开始迁移单一资产关联数据...');
    const [singleAssets] = await db.execute(`
      SELECT id, asset_id FROM technical_documents WHERE asset_id IS NOT NULL;
    `);

    console.log(`找到 ${singleAssets.length} 条单一资产关联需要迁移`);

    for (const doc of singleAssets) {
      try {
        await db.execute(`
          INSERT IGNORE INTO technical_document_asset_relations (document_id, asset_id)
          VALUES (${doc.id}, ${doc.asset_id});
        `);
      } catch (e) {
        console.error(`❌ 迁移技术资料 ${doc.id} 的单一资产关联失败:`, e);
        continue;
      }
    }

    console.log('✅ 单一资产关联数据迁移完成');

    console.log('✅ 技术资料表结构优化完成！');
    process.exit(0);
  } catch (error) {
    console.error('❌ 优化表结构失败:', error);
    process.exit(1);
  }
}

optimizeTechnicalDocumentsStructure();
