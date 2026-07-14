require('dotenv').config(); // 确保能读取.env文件
const db = require('../config/database');

async function optimizeTechnicalDocumentsStructure() {
  try {
    console.log('开始优化技术资料表结构...');
    console.log('使用的数据库配置:');
    console.log(`  主机: ${process.env.DB_HOST || 'localhost'}`);
    console.log(`  端口: ${process.env.DB_PORT || 3306}`);
    console.log(`  用户名: ${process.env.DB_USER || 'root'}`);
    console.log(`  数据库名: ${process.env.DB_NAME || 'zcgl'}`);

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
    try {
      await db.execute(`
        ALTER TABLE technical_documents DROP COLUMN IF EXISTS asset.code;
      `);
      console.log('✅ 删除 asset.code 字段成功');
    } catch (e) {
      console.error('⚠️ 删除 asset.code 字段失败:', e.message);
    }

    try {
      await db.execute(`
        ALTER TABLE technical_documents DROP COLUMN IF EXISTS asset_name;
      `);
      console.log('✅ 删除 asset_name 字段成功');
    } catch (e) {
      console.error('⚠️ 删除 asset_name 字段失败:', e.message);
    }

    // 4. 优化字段长度
    try {
      await db.execute(`
        ALTER TABLE technical_documents MODIFY COLUMN title VARCHAR(255) NOT NULL COMMENT '资料标题';
      `);
      console.log('✅ 优化 title 字段长度成功');
    } catch (e) {
      console.error('⚠️ 优化 title 字段长度失败:', e.message);
    }

    try {
      await db.execute(`
        ALTER TABLE technical_documents MODIFY COLUMN file_name VARCHAR(255) NOT NULL COMMENT '文件名';
      `);
      console.log('✅ 优化 file_name 字段长度成功');
    } catch (e) {
      console.error('⚠️ 优化 file_name 字段长度失败:', e.message);
    }

    // 5. 添加复合索引
    try {
      await db.execute(`
        CREATE INDEX IF NOT EXISTS idx_tenant_status_review ON technical_documents(tenant_id, status, review_status);
      `);
      console.log('✅ 添加 idx_tenant_status_review 索引成功');
    } catch (e) {
      console.error('⚠️ 添加 idx_tenant_status_review 索引失败:', e.message);
    }

    try {
      await db.execute(`
        CREATE INDEX IF NOT EXISTS idx_tenant_asset ON technical_documents(tenant_id, asset_id);
      `);
      console.log('✅ 添加 idx_tenant_asset 索引成功');
    } catch (e) {
      console.error('⚠️ 添加 idx_tenant_asset 索引失败:', e.message);
    }

    try {
      await db.execute(`
        CREATE INDEX IF NOT EXISTS idx_tenant_brand_model ON technical_documents(tenant_id, brand, model);
      `);
      console.log('✅ 添加 idx_tenant_brand_model 索引成功');
    } catch (e) {
      console.error('⚠️ 添加 idx_tenant_brand_model 索引失败:', e.message);
    }

    // 6. 检查并迁移数据
    console.log('开始检查是否需要数据迁移...');

    // 检查中间表是否为空
    const [countResult] = await db.execute(`
      SELECT COUNT(*) as count FROM technical_document_asset_relations;
    `);
    const relationCount = countResult[0].count;
    console.log(`中间表当前记录数: ${relationCount}`);

    // 如果中间表为空，尝试迁移数据
    if (relationCount === 0) {
      console.log('开始迁移数据到中间表...');

      // 迁移单一资产关联
      const [singleResult] = await db.execute(`
        INSERT IGNORE INTO technical_document_asset_relations (document_id, asset_id)
        SELECT id, asset_id FROM technical_documents WHERE asset_id IS NOT NULL;
      `);
      console.log(`✅ 迁移了 ${singleResult.affectedRows} 条单一资产关联`);

      // 迁移asset_ids数据（如果存在）
      try {
        // 检查asset_ids字段是否存在
        const [columns] = await db.execute(`
          SELECT COLUMN_NAME FROM information_schema.COLUMNS 
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'technical_documents' AND COLUMN_NAME = 'asset_ids';
        `);

        if (columns.length > 0) {
          console.log('开始迁移 asset_ids 数据...');

          // 查询所有有asset_ids的技术资料
          const [documents] = await db.execute(`
            SELECT id, asset_ids FROM technical_documents WHERE asset_ids IS NOT NULL AND asset_ids != '' AND asset_ids != '[]';
          `);

          console.log(`找到 ${documents.length} 条需要迁移的asset_ids记录`);

          // 逐条迁移
          let assetIdsCount = 0;
          for (const doc of documents) {
            try {
              const assetIds = JSON.parse(doc.asset_ids);
              if (Array.isArray(assetIds) && assetIds.length > 0) {
                // 过滤有效的asset_id
                const validAssetIds = assetIds.filter(id => Number.isInteger(id) && id > 0);

                if (validAssetIds.length > 0) {
                  // 批量插入
                  const values = validAssetIds.map(assetId => `(${doc.id}, ${assetId})`).join(',');
                  await db.execute(`
                    INSERT IGNORE INTO technical_document_asset_relations (document_id, asset_id)
                    VALUES ${values};
                  `);
                  assetIdsCount += validAssetIds.length;
                }
              }
            } catch (e) {
              console.warn(`⚠️ 迁移技术资料 ${doc.id} 的asset_ids失败:`, e.message);
              continue;
            }
          }

          console.log(`✅ 迁移了 ${assetIdsCount} 条asset_ids关联`);
        }
      } catch (e) {
        console.error('⚠️ 迁移asset_ids数据失败:', e.message);
      }
    } else {
      console.log('⚠️ 中间表已有数据，跳过数据迁移');
    }

    console.log('✅ 技术资料表结构优化完成！');
    process.exit(0);
  } catch (error) {
    console.error('❌ 优化表结构失败:', error.message);
    console.error('错误堆栈:', error.stack);
    process.exit(1);
  }
}

optimizeTechnicalDocumentsStructure();
