const db = require('../config/database');

async function createReminderConfigTable() {
  try {
    console.log('检查维护提醒配置表...');

    await db.execute(`
      CREATE TABLE IF NOT EXISTS maintenance_reminder_configs (
        id INT PRIMARY KEY AUTO_INCREMENT,
        tenant_id INT NOT NULL,
        plan_id INT NOT NULL,
        reminder_days INT NOT NULL DEFAULT 7 COMMENT '提前提醒天数',
        reminder_types VARCHAR(500) COMMENT '提醒方式数组(JSON格式)',
        recipient VARCHAR(500) COMMENT '提醒接收人',
        created_at DATETIME,
        updated_at DATETIME,
        INDEX idx_tenant (tenant_id),
        INDEX idx_plan_id (plan_id),
        UNIQUE KEY uk_plan_tenant (plan_id, tenant_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='维护计划提醒配置表'
    `);

    console.log('✓ 维护提醒配置表创建成功');
  } catch (error) {
    console.error('创建维护提醒配置表失败:', error);
    throw error;
  }
}

async function createReminderHistoryTable() {
  try {
    console.log('检查维护提醒历史表...');

    await db.execute(`
      CREATE TABLE IF NOT EXISTS maintenance_reminder_history (
        id INT PRIMARY KEY AUTO_INCREMENT,
        tenant_id INT NOT NULL,
        plan_id INT NOT NULL,
        reminder_type VARCHAR(50) NOT NULL COMMENT '提醒类型：system/email/sms',
        recipient VARCHAR(200) NOT NULL,
        reminder_date DATE NOT NULL,
        status ENUM('已发送', '发送失败', '已读') DEFAULT '已发送',
        message TEXT,
        sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_tenant (tenant_id),
        INDEX idx_plan_id (plan_id),
        INDEX idx_reminder_date (reminder_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='维护提醒历史记录表'
    `);

    console.log('✓ 维护提醒历史表创建成功');
  } catch (error) {
    console.error('创建维护提醒历史表失败:', error);
    throw error;
  }
}

async function enhanceReminderService() {
  try {
    await createReminderConfigTable();
    await createReminderHistoryTable();
    console.log('\n✅ 维护提醒相关表创建完成！');
  } catch (error) {
    console.error('\n❌ 创建维护提醒表失败:', error);
    throw error;
  }
}

if (require.main === module) {
  enhanceReminderService()
    .then(() => {
      console.log('脚本执行完成');
      process.exit(0);
    })
    .catch(error => {
      console.error('脚本执行失败:', error);
      process.exit(1);
    });
}

module.exports = enhanceReminderService;
