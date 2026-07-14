const db = require('../config/database');

async function checkMaintenanceReminders() {
  try {
    console.log('开始检查预防性维护计划提醒...');

    // 计算提醒日期（今天起7天内需要维护的计划）
    const today = new Date();
    const reminderDate = new Date();
    reminderDate.setDate(today.getDate() + 7);

    const todayStr = today.toISOString().split('T')[0];
    const reminderDateStr = reminderDate.toISOString().split('T')[0];

    console.log(`检查范围: ${todayStr} 到 ${reminderDateStr}`);

    // 查询需要提醒的维护计划
    const [plans] = await db.execute(
      `
      SELECT pmp.*, a.department, a.location
      FROM preventive_maintenance_plans pmp
      LEFT JOIN assets a ON pmp.asset_code = a.asset_code
      WHERE pmp.status = '启用'
      AND pmp.next_maintenance_date BETWEEN ? AND ?
      ORDER BY pmp.next_maintenance_date ASC
    `,
      [todayStr, reminderDateStr],
    );

    console.log(`找到 ${plans.length} 个需要提醒的维护计划`);

    if (plans.length === 0) {
      console.log('没有需要提醒的维护计划');
      return;
    }

    // 为每个计划创建提醒记录
    for (const plan of plans) {
      try {
        // 检查是否已经创建过提醒
        const [existingReminders] = await db.execute(
          `
          SELECT id FROM maintenance_reminders
          WHERE plan_id = ? AND reminder_date = ?
        `,
          [plan.id, todayStr],
        );

        if (existingReminders.length === 0) {
          // 创建提醒记录
          await db.execute(
            `
            INSERT INTO maintenance_reminders (
              plan_id, asset_code, asset_name, plan_name,
              next_maintenance_date, reminder_date, status,
              responsible_person, department, location
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
            [
              plan.id,
              plan.asset_code,
              plan.asset_name,
              plan.plan_name,
              plan.next_maintenance_date,
              todayStr,
              '未处理',
              plan.responsible_person,
              plan.department,
              plan.location,
            ],
          );

          console.log(`✓ 为计划 ${plan.plan_name} (资产: ${plan.asset_code}) 创建提醒`);
        } else {
          console.log(`⚠ 计划 ${plan.plan_name} (资产: ${plan.asset_code}) 已存在提醒记录`);
        }
      } catch (error) {
        console.error(`创建提醒记录失败 (计划ID: ${plan.id}):`, error.message);
      }
    }

    console.log('维护计划提醒检查完成');
  } catch (error) {
    console.error('检查维护计划提醒失败:', error);
  }
}

async function createReminderTable() {
  try {
    console.log('检查维护提醒表结构...');

    // 创建维护提醒表
    await db.execute(`
      CREATE TABLE IF NOT EXISTS maintenance_reminders (
        id INT PRIMARY KEY AUTO_INCREMENT,
        tenant_id INT NOT NULL,
        plan_id INT NOT NULL,
        asset_code VARCHAR(100) NOT NULL,
        asset_name VARCHAR(200),
        plan_name VARCHAR(200) NOT NULL,
        next_maintenance_date DATE NOT NULL,
        reminder_date DATE NOT NULL,
        status ENUM('未处理', '已处理', '已忽略') DEFAULT '未处理',
        responsible_person VARCHAR(100),
        department VARCHAR(100),
        location VARCHAR(200),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NULL DEFAULT NULL,
        INDEX idx_tenant (tenant_id),
        INDEX idx_plan_id (plan_id),
        INDEX idx_asset_code (asset_code),
        INDEX idx_reminder_date (reminder_date),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='维护计划提醒表'
    `);

    console.log('✓ 维护提醒表检查完成');
  } catch (error) {
    console.error('创建维护提醒表失败:', error);
  }
}

if (require.main === module) {
  createReminderTable()
    .then(() => checkMaintenanceReminders())
    .then(() => {
      console.log('脚本执行完成');
      process.exit(0);
    })
    .catch(error => {
      console.error('脚本执行失败:', error);
      process.exit(1);
    });
}

module.exports = {
  checkMaintenanceReminders,
  createReminderTable,
};
