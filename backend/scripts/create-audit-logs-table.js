const db = require('../config/database');

async function createAuditLogsTable() {
  try {
    console.log('开始创建操作日志表...');

    // 检查表是否已存在
    const [tables] = await db.execute(
      `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
       WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME = 'audit_logs'`,
    );

    if (tables.length > 0) {
      console.log('✅ 操作日志表已存在，跳过创建');
      process.exit(0);
    }

    // 创建操作日志表
    await db.execute(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT COMMENT '用户ID',
        username VARCHAR(50) COMMENT '用户名',
        real_name VARCHAR(50) COMMENT '真实姓名',
        role VARCHAR(50) COMMENT '用户角色',
        action_type VARCHAR(50) NOT NULL COMMENT '操作类型（create, update, delete, login, logout, view, export, import等）',
        module VARCHAR(50) NOT NULL COMMENT '操作模块（assets, users, technical-documents, maintenance等）',
        resource_type VARCHAR(50) COMMENT '资源类型（asset, user, document等）',
        resource_id INT COMMENT '资源ID',
        resource_name VARCHAR(200) COMMENT '资源名称（如资产名称、用户名等）',
        action_description TEXT COMMENT '操作描述',
        old_value TEXT COMMENT '修改前的值（JSON格式）',
        new_value TEXT COMMENT '修改后的值（JSON格式）',
        ip_address VARCHAR(50) COMMENT 'IP地址',
        user_agent TEXT COMMENT '用户代理（浏览器信息）',
        request_method VARCHAR(10) COMMENT 'HTTP方法（GET, POST, PUT, DELETE）',
        request_path VARCHAR(500) COMMENT '请求路径',
        request_params TEXT COMMENT '请求参数（JSON格式）',
        response_status INT COMMENT '响应状态码',
        error_message TEXT COMMENT '错误信息（如果操作失败）',
        execution_time INT COMMENT '执行时间（毫秒）',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
        INDEX idx_user_id (user_id),
        INDEX idx_username (username),
        INDEX idx_action_type (action_type),
        INDEX idx_module (module),
        INDEX idx_resource_type (resource_type),
        INDEX idx_resource_id (resource_id),
        INDEX idx_created_at (created_at),
        INDEX idx_user_action (user_id, action_type),
        INDEX idx_module_action (module, action_type)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='操作日志表（审计）';
    `);
    console.log('✅ 操作日志表创建成功');

    console.log('✅ 操作日志表创建完成！');
    process.exit(0);
  } catch (error) {
    console.error('❌ 创建表失败:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  createAuditLogsTable();
}

module.exports = createAuditLogsTable;
