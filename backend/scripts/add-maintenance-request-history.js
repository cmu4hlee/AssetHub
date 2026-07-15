/**
 * 维修申请审计历史表迁移
 *
 * 给 maintenance_requests 加一张审计表 maintenance_request_history：
 *   - 类似 work_order_history 的结构
 *   - 记录状态变更：审批/开始/完成/取消/修订/重新打开 等
 *   - 修订"已完成"工单时，revision_snapshot 字段保存旧 content/cost/parts 用于审计
 *
 * 使用 INFORMATION_SCHEMA 检测，可重入。
 *
 * 使用：node backend/scripts/add-maintenance-request-history.js
 */
const db = require('../config/database');

const NEW_TABLE = {
  name: 'maintenance_request_history',
  ddl: `
    CREATE TABLE IF NOT EXISTS maintenance_request_history (
      id INT PRIMARY KEY AUTO_INCREMENT,
      request_id INT NOT NULL,
      tenant_id INT,
      action_type VARCHAR(50) NOT NULL COMMENT 'approve/reject/start/complete/revise/reopen/cancel',
      action_description TEXT NOT NULL,
      action_by VARCHAR(100) NOT NULL,
      action_at DATETIME NOT NULL,
      revision_snapshot JSON NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_request_id (request_id),
      INDEX idx_action_at (action_at),
      INDEX idx_action_type (action_type)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `,
};

async function tableExists(tableName) {
  const [rows] = await db.execute(
    `SELECT COUNT(*) AS cnt
       FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [tableName],
  );
  return rows[0].cnt > 0;
}

async function run() {
  try {
    const exists = await tableExists(NEW_TABLE.name);
    if (exists) {
      console.log(`  · 跳过（已存在）: ${NEW_TABLE.name}`);
      console.log('\n🎉 迁移完成：0 个新表');
      process.exit(0);
    }
    await db.execute(NEW_TABLE.ddl);
    console.log(`  ✓ 已创建: ${NEW_TABLE.name}`);
    console.log('\n🎉 迁移完成：1 个新表');
    process.exit(0);
  } catch (error) {
    console.error('迁移失败:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  run();
}

module.exports = { run, NEW_TABLE };
