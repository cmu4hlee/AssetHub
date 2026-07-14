const db = require('../config/database');
const fs = require('fs');

async function executeQuery(query, params, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const result = await db.execute(query, params);
      return result;
    } catch (error) {
      if (
        (error.code === 'PROTOCOL_CONNECTION_LOST' || error.code === 'ECONNREFUSED') &&
        i < retries - 1
      ) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        continue;
      }
      throw error;
    }
  }
}

async function migrate() {
  console.log('开始创建AI对话历史表...\n');

  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS ai_document_conversations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      tenant_id INT NOT NULL COMMENT '租户ID',
      user_id INT NOT NULL COMMENT '用户ID',
      conversation_id VARCHAR(100) NOT NULL COMMENT '对话ID',
      message_role ENUM('user', 'assistant', 'system') NOT NULL COMMENT '消息角色',
      message_content TEXT NOT NULL COMMENT '消息内容',
      document_ids TEXT COMMENT '关联文档ID列表(JSON数组)',
      sources TEXT COMMENT '来源文档信息(JSON)',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
      INDEX idx_tenant_user (tenant_id, user_id),
      INDEX idx_conversation_id (conversation_id),
      INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI文档对话历史表';
  `;

  try {
    await executeQuery(createTableSQL);
    console.log('✅ ai_document_conversations 表创建成功');
  } catch (error) {
    if (error.code === 'ER_TABLE_EXISTS_ERROR') {
      console.log('ℹ️  ai_document_conversations 表已存在');
    } else {
      console.error('❌ 创建 ai_document_conversations 表失败:', error.message);
      throw error;
    }
  }

  // 检查并添加缺少的字段到 technical_documents 表
  console.log('\n检查 technical_documents 表字段...');

  try {
    const [columns] = await executeQuery('DESCRIBE technical_documents');
    const columnNames = columns.map(c => c.Field);

    const neededColumns = [
      { name: 'category', type: 'VARCHAR(100)', after: 'file_size' },
      { name: 'uploaded_by', type: 'VARCHAR(50)', after: 'token_expires_at' },
      { name: 'upload_date', type: 'DATETIME', after: 'uploaded_by' },
    ];

    for (const col of neededColumns) {
      if (!columnNames.includes(col.name)) {
        await executeQuery(`ALTER TABLE technical_documents ADD COLUMN ${col.name} ${col.type} NULL AFTER ${col.after}`);
        console.log(`✅ 添加字段 ${col.name} 成功`);
      } else {
        console.log(`ℹ️  字段 ${col.name} 已存在`);
      }
    }
  } catch (error) {
    console.error('⚠️  检查/添加字段时出错:', error.message);
  }

  console.log('\n✅ 数据库迁移完成！');
}

migrate().catch(error => {
  console.error('迁移失败:', error);
  process.exit(1);
});
