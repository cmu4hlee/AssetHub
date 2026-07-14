require('dotenv').config(); // 确保能读取.env文件
const db = require('../config/database');

async function modifyRelationTable() {
  try {
    console.log('开始修改技术资料与资产关联表结构...');

    // 1. 检查中间表是否已存在asset.code字段
    const [relationColumnExists] = await db.execute(`
      SELECT COLUMN_NAME FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'technical_document_asset_relations' AND COLUMN_NAME = 'asset.code';
    `);

    if (relationColumnExists.length === 0) {
      await db.execute(`
        ALTER TABLE technical_document_asset_relations 
        ADD COLUMN asset.code VARCHAR(255) NULL COMMENT '资产编码' AFTER asset_id;
      `);
      console.log('✅ 添加asset.code字段到中间表成功');
    } else {
      console.log('✅ asset.code字段已存在于中间表，跳过添加');
    }

    // 2. 更新现有数据的asset.code字段（如果需要）
    await db.execute(`
      UPDATE technical_document_asset_relations r 
      JOIN assets a ON r.asset_id = a.id 
      SET r.asset.code = a.code 
      WHERE r.asset.code IS NULL OR r.asset.code = '';
    `);
    console.log('✅ 更新现有数据的asset.code字段成功');

    // 3. 检查并创建唯一索引（使用前缀索引解决键长问题）
    const [indexExists] = await db.execute(`
      SELECT INDEX_NAME FROM information_schema.STATISTICS 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'technical_document_asset_relations' AND INDEX_NAME = 'uk_document_asset.code';
    `);

    if (indexExists.length === 0) {
      // 使用前缀索引，只索引asset.code的前100个字符
      await db.execute(`
        CREATE UNIQUE INDEX uk_document_asset.code ON technical_document_asset_relations(document_id, asset.code(100));
      `);
      console.log('✅ 添加uk_document_asset.code唯一索引成功');
    } else {
      console.log('✅ uk_document_asset.code唯一索引已存在，跳过创建');
    }

    // 4. 检查并创建资产编码索引（使用前缀索引）
    const [codeIndexExists] = await db.execute(`
      SELECT INDEX_NAME FROM information_schema.STATISTICS 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'technical_document_asset_relations' AND INDEX_NAME = 'idx_asset.code';
    `);

    if (codeIndexExists.length === 0) {
      // 使用前缀索引，只索引asset.code的前100个字符
      await db.execute(`
        CREATE INDEX idx_asset.code ON technical_document_asset_relations(asset.code(100));
      `);
      console.log('✅ 添加idx_asset.code索引成功');
    } else {
      console.log('✅ idx_asset.code索引已存在，跳过创建');
    }

    // 5. 检查技术资料表是否已存在asset.code字段
    const [docColumnExists] = await db.execute(`
      SELECT COLUMN_NAME FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'technical_documents' AND COLUMN_NAME = 'asset.code';
    `);

    if (docColumnExists.length === 0) {
      await db.execute(`
        ALTER TABLE technical_documents 
        ADD COLUMN asset.code VARCHAR(255) NULL COMMENT '资产编码' AFTER asset_id;
      `);
      console.log('✅ 在技术资料表中添加asset.code字段成功');
    } else {
      console.log('✅ asset.code字段已存在于技术资料表，跳过添加');
    }

    // 6. 更新技术资料表的asset.code字段
    await db.execute(`
      UPDATE technical_documents td 
      JOIN assets a ON td.asset_id = a.id 
      SET td.asset.code = a.code 
      WHERE td.asset.code IS NULL OR td.asset.code = '';
    `);
    console.log('✅ 更新技术资料表的asset.code字段成功');

    // 7. 检查并创建技术资料表asset.code字段的索引（使用前缀索引）
    const [tdCodeIndexExists] = await db.execute(`
      SELECT INDEX_NAME FROM information_schema.STATISTICS 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'technical_documents' AND INDEX_NAME = 'idx_td_asset.code';
    `);

    if (tdCodeIndexExists.length === 0) {
      // 使用前缀索引，只索引asset.code的前100个字符
      await db.execute(`
        CREATE INDEX idx_td_asset.code ON technical_documents(asset.code(100));
      `);
      console.log('✅ 添加技术资料表asset.code字段索引成功');
    } else {
      console.log('✅ 技术资料表asset.code字段索引已存在，跳过创建');
    }

    // 8. 修改技术资料上传逻辑，确保使用asset.code进行关联
    console.log('✅ 技术资料与资产关联表结构修改完成！');
    process.exit(0);
  } catch (error) {
    console.error('❌ 修改表结构失败:', error.message);
    console.error('错误堆栈:', error.stack);
    process.exit(1);
  }
}

modifyRelationTable();
