const db = require('../config/database');

async function addReviewFieldsToTechnicalDocuments() {
  try {
    console.log('开始为技术资料表添加审核相关字段...');

    // 检查 review_status 字段是否已存在
    const [columns] = await db.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME = 'technical_documents' 
       AND COLUMN_NAME = 'review_status'`,
    );

    if (columns.length === 0) {
      // 添加审核相关字段
      await db.execute(`
        ALTER TABLE technical_documents
        ADD COLUMN review_status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending' COMMENT '审核状态（pending=待审核，approved=已通过，rejected=已拒绝）',
        ADD COLUMN reviewed_by VARCHAR(50) COMMENT '审核人',
        ADD COLUMN reviewed_at DATETIME COMMENT '审核时间',
        ADD COLUMN review_comment TEXT COMMENT '审核意见',
        ADD INDEX idx_review_status (review_status)
      `);
      console.log('✅ 已添加审核相关字段');
    } else {
      console.log('✅ 审核相关字段已存在，跳过添加');
    }

    // 将现有资料设置为已通过审核（兼容旧数据）
    await db.execute(`
      UPDATE technical_documents 
      SET review_status = 'approved', 
          reviewed_at = upload_date,
          reviewed_by = uploaded_by
      WHERE review_status = 'pending' AND status = 'active'
    `);
    console.log('✅ 已将现有活跃资料设置为已通过审核');

    console.log('✅ 技术资料表审核字段添加完成！');
    process.exit(0);
  } catch (error) {
    console.error('❌ 添加字段失败:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  addReviewFieldsToTechnicalDocuments();
}

module.exports = addReviewFieldsToTechnicalDocuments;
