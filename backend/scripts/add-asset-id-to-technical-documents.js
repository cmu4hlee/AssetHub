const db = require('../config/database');

async function addAssetIdToTechnicalDocuments() {
  try {
    console.log('开始为技术资料表添加资产关联字段...');

    // 检查 asset_id 字段是否已存在
    const [columns] = await db.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME = 'technical_documents' 
       AND COLUMN_NAME = 'asset_id'`,
    );

    if (columns.length === 0) {
      // 添加 asset_id 字段
      await db.execute(`
        ALTER TABLE technical_documents
        ADD COLUMN asset_id INT COMMENT '关联资产ID（可为空，为空时通过品牌型号匹配）',
        ADD COLUMN asset.code VARCHAR(100) COMMENT '关联资产编号',
        ADD COLUMN asset_name VARCHAR(200) COMMENT '关联资产名称',
        ADD INDEX idx_asset_id (asset_id),
        ADD INDEX idx_asset.code (asset.code),
        ADD FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE SET NULL
      `);
      console.log('✅ 已添加 asset_id、asset.code、asset_name 字段');
    } else {
      console.log('✅ asset_id 字段已存在，跳过添加');
    }

    // 检查 asset_ids 字段（用于多资产关联）
    const [columns2] = await db.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME = 'technical_documents' 
       AND COLUMN_NAME = 'asset_ids'`,
    );

    if (columns2.length === 0) {
      // 添加 asset_ids 字段（TEXT格式，存储JSON数组字符串）
      await db.execute(`
        ALTER TABLE technical_documents
        ADD COLUMN asset_ids TEXT COMMENT '关联的多个资产ID（JSON数组字符串，用于相同型号资产共享资料）'
      `);
      console.log('✅ 已添加 asset_ids 字段（多资产关联）');
    } else {
      console.log('✅ asset_ids 字段已存在，跳过添加');
    }

    console.log('✅ 技术资料表结构更新完成！');
    process.exit(0);
  } catch (error) {
    console.error('❌ 更新表结构失败:', error);
    process.exit(1);
  }
}

addAssetIdToTechnicalDocuments();
