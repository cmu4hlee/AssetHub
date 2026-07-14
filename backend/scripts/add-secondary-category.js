const db = require('../config/database');

async function addSecondaryCategory() {
  try {
    console.log('开始添加二级分类字段...');

    // 执行ALTER TABLE语句添加二级分类字段
    await db.execute(
      'ALTER TABLE assets ADD COLUMN category_secondary_id INT COMMENT "二级分类ID" AFTER category_id',
    );
    console.log('✅ 已添加category_secondary_id字段到assets表');

    // 创建索引以提高查询性能
    await db.execute('CREATE INDEX idx_secondary_category ON assets(category_secondary_id)');
    console.log('✅ 已创建二级分类索引');

    console.log('🎉 二级分类字段添加完成');
    process.exit(0);
  } catch (error) {
    console.error('❌ 添加二级分类字段失败:', error.message);
    process.exit(1);
  }
}

addSecondaryCategory();
