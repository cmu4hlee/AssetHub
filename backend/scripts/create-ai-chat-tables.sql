-- 创建AI智能问答相关表的SQL脚本
-- 执行方式：在MySQL客户端中执行此SQL文件，或通过命令行：mysql -u用户名 -p数据库名 < create-ai-chat-tables.sql

-- 1. 创建AI对话会话表
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='AI对话会话表';

-- 2. 创建AI对话消息表
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='AI对话消息表';
