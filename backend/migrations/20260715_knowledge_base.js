/**
 * 知识库模块数据库迁移
 *
 * 目标:
 * - 知识库逻辑分组(每个租户可建多个知识库)
 * - 文档上传与元数据
 * - 文档分块(用于 RAG 检索,前置 RAG 模式,不需要向量数据库)
 * - 问答记录(可追溯 AI 引用)
 * - 知识库设置(分块大小、top_k、是否启用 AI 问答等)
 */

const db = require('../config/database');

async function migrate() {
  console.log('开始创建知识库模块表...');

  try {
    // 1. 知识库表
    await db.execute(`
      CREATE TABLE IF NOT EXISTS knowledge_bases (
        id INT PRIMARY KEY AUTO_INCREMENT,
        tenant_id INT NOT NULL COMMENT '租户ID',
        kb_code VARCHAR(64) NOT NULL COMMENT '知识库编码',
        kb_name VARCHAR(128) NOT NULL COMMENT '知识库名称',
        description TEXT NULL COMMENT '知识库描述',
        scope VARCHAR(32) DEFAULT 'general' COMMENT '用途: general / asset / maintenance / sop',
        icon VARCHAR(64) DEFAULT 'book' COMMENT '图标',
        sort_order INT DEFAULT 0 COMMENT '排序',
        doc_count INT DEFAULT 0 COMMENT '文档数量(冗余)',
        chunk_count INT DEFAULT 0 COMMENT '分块数量(冗余)',
        status VARCHAR(16) DEFAULT 'active' COMMENT 'active/archived',
        created_by VARCHAR(64) NULL COMMENT '创建人',
        created_by_id INT NULL COMMENT '创建人ID',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT NULL,
        UNIQUE KEY uk_tenant_code (tenant_id, kb_code),
        INDEX idx_tenant_status (tenant_id, status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='知识库表'
    `);
    console.log('✓ knowledge_bases 表创建成功');

    // 2. 知识库文档表
    await db.execute(`
      CREATE TABLE IF NOT EXISTS knowledge_documents (
        id INT PRIMARY KEY AUTO_INCREMENT,
        tenant_id INT NOT NULL COMMENT '租户ID',
        kb_id INT NOT NULL COMMENT '所属知识库ID',
        title VARCHAR(255) NOT NULL COMMENT '文档标题',
        description TEXT NULL COMMENT '文档描述',
        file_name VARCHAR(255) NOT NULL COMMENT '原始文件名',
        file_path VARCHAR(500) NOT NULL COMMENT '存储路径',
        file_size BIGINT DEFAULT 0 COMMENT '文件大小(bytes)',
        file_ext VARCHAR(16) NULL COMMENT '文件扩展名',
        mime_type VARCHAR(128) NULL COMMENT 'MIME 类型',
        file_hash VARCHAR(64) NULL COMMENT '文件 SHA256',
        char_count INT DEFAULT 0 COMMENT '字符数',
        chunk_count INT DEFAULT 0 COMMENT '分块数',
        parse_status VARCHAR(16) DEFAULT 'pending' COMMENT 'pending/parsing/ready/failed',
        parse_error TEXT NULL COMMENT '解析失败原因',
        status VARCHAR(16) DEFAULT 'active' COMMENT 'active/deleted',
        uploaded_by VARCHAR(64) NULL COMMENT '上传人',
        uploaded_by_id INT NULL COMMENT '上传人ID',
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        parsed_at DATETIME DEFAULT NULL,
        INDEX idx_tenant_kb (tenant_id, kb_id),
        INDEX idx_status (tenant_id, parse_status),
        INDEX idx_hash (tenant_id, file_hash)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='知识库文档表'
    `);
    console.log('✓ knowledge_documents 表创建成功');

    // 3. 文档分块表(用于 RAG 检索)
    await db.execute(`
      CREATE TABLE IF NOT EXISTS knowledge_chunks (
        id INT PRIMARY KEY AUTO_INCREMENT,
        tenant_id INT NOT NULL COMMENT '租户ID',
        doc_id INT NOT NULL COMMENT '文档ID',
        kb_id INT NOT NULL COMMENT '知识库ID',
        chunk_index INT NOT NULL COMMENT '分块序号',
        content MEDIUMTEXT NOT NULL COMMENT '分块内容',
        content_length INT NOT NULL COMMENT '字符数',
        keywords TEXT NULL COMMENT '预提取的关键词(JSON 数组)',
        tokens_estimate INT DEFAULT 0 COMMENT '粗略 token 估算',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_doc (doc_id),
        INDEX idx_tenant_kb (tenant_id, kb_id),
        FULLTEXT KEY ft_content (content)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='知识库文档分块表'
    `);
    console.log('✓ knowledge_chunks 表创建成功');

    // 4. 问答记录表
    await db.execute(`
      CREATE TABLE IF NOT EXISTS knowledge_qa_records (
        id INT PRIMARY KEY AUTO_INCREMENT,
        tenant_id INT NOT NULL COMMENT '租户ID',
        kb_id INT NULL COMMENT '限定知识库ID(NULL = 全租户)',
        session_id VARCHAR(64) NULL COMMENT '会话ID(前端传入)',
        user_id INT NULL COMMENT '用户ID',
        user_name VARCHAR(64) NULL COMMENT '用户姓名',
        question TEXT NOT NULL COMMENT '用户问题',
        answer MEDIUMTEXT NULL COMMENT 'AI 回答',
        retrieved_chunks MEDIUMTEXT NULL COMMENT '检索到的分块(JSON)',
        citations MEDIUMTEXT NULL COMMENT '引用来源(JSON)',
        provider VARCHAR(32) NULL COMMENT 'AI provider',
        model VARCHAR(64) NULL COMMENT 'AI 模型',
        latency_ms INT DEFAULT 0 COMMENT '响应耗时',
        status VARCHAR(16) DEFAULT 'success' COMMENT 'success/failed',
        error_message TEXT NULL COMMENT '错误信息',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_tenant_kb (tenant_id, kb_id),
        INDEX idx_user (tenant_id, user_id),
        INDEX idx_session (session_id),
        INDEX idx_created (tenant_id, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='知识库问答记录表'
    `);
    console.log('✓ knowledge_qa_records 表创建成功');

    // 5. 知识库设置表(每租户一份)
    await db.execute(`
      CREATE TABLE IF NOT EXISTS knowledge_settings (
        id INT PRIMARY KEY AUTO_INCREMENT,
        tenant_id INT NOT NULL COMMENT '租户ID',
        chunk_size INT DEFAULT 600 COMMENT '分块字符数',
        chunk_overlap INT DEFAULT 80 COMMENT '分块重叠字符数',
        top_k INT DEFAULT 5 COMMENT '检索返回 top K',
        min_score DECIMAL(4,3) DEFAULT 0.020 COMMENT '最低分阈值(0-1)',
        ai_enabled TINYINT(1) DEFAULT 1 COMMENT '是否启用 AI 问答',
        ai_provider VARCHAR(32) DEFAULT 'openclaw' COMMENT 'AI provider',
        ai_model VARCHAR(64) DEFAULT 'openclaw' COMMENT 'AI 模型',
        system_prompt TEXT NULL COMMENT '自定义系统提示',
        max_context_chars INT DEFAULT 6000 COMMENT '注入 prompt 的最大字符数',
        updated_at DATETIME DEFAULT NULL,
        updated_by INT NULL,
        UNIQUE KEY uk_tenant (tenant_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='知识库设置表'
    `);
    console.log('✓ knowledge_settings 表创建成功');

    console.log('知识库模块所有表创建完成');
  } catch (error) {
    console.error('知识库模块迁移失败:', error);
    throw error;
  }
}

async function rollback() {
  console.log('回滚知识库模块表...');
  const tables = [
    'knowledge_qa_records',
    'knowledge_chunks',
    'knowledge_documents',
    'knowledge_bases',
    'knowledge_settings',
  ];
  for (const table of tables) {
    try {
      await db.execute(`DROP TABLE IF EXISTS ${table}`);
      console.log(`✓ 已删除 ${table}`);
    } catch (err) {
      console.error(`删除 ${table} 失败:`, err.message);
    }
  }
}

if (require.main === module) {
  const action = process.argv[2] || 'up';
  (async () => {
    try {
      if (action === 'down') {
        await rollback();
      } else {
        await migrate();
      }
      process.exit(0);
    } catch (err) {
      console.error(err);
      process.exit(1);
    }
  })();
}

module.exports = { migrate, rollback };
