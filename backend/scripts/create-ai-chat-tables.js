// 创建AI智能问答相关表的脚本
const db = require('../config/database');

async function createAIChatTables() {
  let connection;
  try {
    console.log('开始创建AI智能问答相关表...');
    connection = await db.getConnection();
    console.log('✅ 数据库连接已建立');

    // 1. 创建AI对话会话表
    console.log('创建AI对话会话表...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS ai_chat_sessions (
        id INT PRIMARY KEY AUTO_INCREMENT,
        tenant_id INT NOT NULL COMMENT '租户ID',
        user_id INT NOT NULL COMMENT '用户ID',
        session_name VARCHAR(200) COMMENT '会话名称',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
        updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
        INDEX idx_tenant_id (tenant_id),
        INDEX idx_user_id (user_id),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='AI对话会话表'
    `);
    console.log('✅ ai_chat_sessions 表创建成功');

    // 2. 创建AI对话消息表
    console.log('创建AI对话消息表...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS ai_chat_messages (
        id INT PRIMARY KEY AUTO_INCREMENT,
        tenant_id INT NOT NULL COMMENT '租户ID',
        session_id INT NOT NULL COMMENT '会话ID',
        role ENUM('user', 'assistant') NOT NULL COMMENT '角色：user-用户，assistant-AI助手',
        content TEXT NOT NULL COMMENT '消息内容',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
        INDEX idx_tenant_id (tenant_id),
        INDEX idx_session_id (session_id),
        INDEX idx_created_at (created_at),
        FOREIGN KEY (session_id) REFERENCES ai_chat_sessions(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='AI对话消息表'
    `);
    console.log('✅ ai_chat_messages 表创建成功');

    console.log('\n🎉 所有AI智能问答相关表创建完成！');
  } catch (error) {
    console.error('❌ 创建表失败:', error);
    throw error;
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

// 执行脚本
if (require.main === module) {
  createAIChatTables()
    .then(() => {
      console.log('脚本执行完成');
      process.exit(0);
    })
    .catch(error => {
      console.error('脚本执行失败:', error);
      process.exit(1);
    });
}

module.exports = createAIChatTables;
