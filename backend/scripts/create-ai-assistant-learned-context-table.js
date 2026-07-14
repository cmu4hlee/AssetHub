/**
 * 创建 AI 助手「学习上下文」表，用于存储用户纠正与成功表述，实现上下文可变与自我学习
 * 执行: node backend/scripts/create-ai-assistant-learned-context-table.js
 */
const db = require('../config/database');

async function createTable() {
  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS ai_assistant_learned_context (
        id INT PRIMARY KEY AUTO_INCREMENT,
        tenant_id INT NOT NULL COMMENT '租户ID',
        context_type VARCHAR(20) NOT NULL DEFAULT 'correction' COMMENT '类型: correction-用户纠正, phrase-成功表述',
        source_phrase VARCHAR(500) NULL COMMENT '用户原话摘要或触发语',
        inferred_intent VARCHAR(50) NULL COMMENT '系统原推断的意图',
        actual_intent VARCHAR(50) NULL COMMENT '用户纠正后的意图或成功提交的意图',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_tenant (tenant_id),
        INDEX idx_tenant_type (tenant_id, context_type),
        INDEX idx_created (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='AI助手学习上下文（用户纠正与成功表述）'
    `);
    console.log('✓ ai_assistant_learned_context 表已创建或已存在');
    process.exit(0);
  } catch (err) {
    console.error('创建表失败:', err.message);
    process.exit(1);
  }
}

createTable();
