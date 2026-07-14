const db = require('../../config/database');
const { getTenantId } = require('../../middleware/tenant-filter');
const { publish, SYSTEM_EVENTS } = require('../../core/EventBus');

function badRequest(message) {
  return { statusCode: 400, body: { success: false, message } };
}

function notFound(message) {
  return { statusCode: 404, body: { success: false, message } };
}

async function getReminders(query, req) {
  const { status, start_date, end_date } = query;
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const pageSize = Math.min(Math.max(parseInt(query.pageSize, 10) || 20, 1), 200);
  const offset = (page - 1) * pageSize;

  const tenantId = getTenantId(req);
  let whereClause = 'WHERE tenant_id = ?';
  const params = [tenantId];

  if (status) {
    whereClause += ' AND status = ?';
    params.push(status);
  }
  if (start_date) {
    whereClause += ' AND reminder_date >= ?';
    params.push(start_date);
  }
  if (end_date) {
    whereClause += ' AND reminder_date <= ?';
    params.push(end_date);
  }

  const [countResult] = await db.execute(
    `SELECT COUNT(*) as total FROM maintenance_reminders ${whereClause}`,
    params,
  );
  const { total } = countResult[0];

  const [rows] = await db.execute(
    `SELECT * FROM maintenance_reminders
     ${whereClause}
     ORDER BY reminder_date ASC, created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
  );

  return {
    success: true,
    data: rows,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

async function sendReminder(body, req) {
  const { plan_id, recipient } = body;

  if (!plan_id) {
    return badRequest('维护计划ID不能为空');
  }

  const tenantId = getTenantId(req);

  const [planResult] = await db.execute(
    `SELECT * FROM preventive_maintenance_plans
     WHERE id = ? AND tenant_id = ?`,
    [plan_id, tenantId],
  );

  if (planResult.length === 0) {
    return notFound('维护计划不存在');
  }

  const plan = planResult[0];
  const responsiblePerson = recipient || plan.responsible_person || null;

  // maintenance_reminders 实际表结构：无 reminder_type/recipient/message 列，
  // status enum 为 ('未处理','已处理','已忽略')，plan_name/next_maintenance_date 为 NOT NULL
  const [result] = await db.execute(
    `INSERT INTO maintenance_reminders
     (tenant_id, plan_id, asset_code, asset_name, plan_name, next_maintenance_date,
      reminder_date, status, responsible_person, created_at)
     VALUES (?, ?, ?, ?, ?, ?, NOW(), '未处理', ?, NOW())`,
    [
      tenantId,
      plan_id,
      plan.asset_code,
      plan.asset_name || null,
      plan.plan_name,
      plan.next_maintenance_date,
      responsiblePerson,
    ],
  );

  // 通知：发布提醒事件，飞书通知服务订阅后推送给负责人
  try {
    let daysUntil = null;
    if (plan.next_maintenance_date) {
      const next = new Date(plan.next_maintenance_date);
      const today = new Date();
      daysUntil = Math.ceil((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    }

    publish(SYSTEM_EVENTS.MAINTENANCE_PLAN_REMINDER, {
      reminder_id: result.insertId,
      plan_id,
      asset_code: plan.asset_code,
      asset_name: plan.asset_name || null,
      plan_name: plan.plan_name,
      next_maintenance_date: plan.next_maintenance_date,
      responsible_person: responsiblePerson,
      days_until: daysUntil,
      tenantId,
      _req: req,
    });
  } catch (e) {
    // 事件发布失败不影响主流程
    console.warn('[reminders] 发布提醒事件失败:', e.message);
  }

  return {
    success: true,
    message: '提醒发送成功',
    data: {
      reminder_id: result.insertId,
      plan_id,
      responsible_person: responsiblePerson,
      status: '未处理',
    },
  };
}

async function configReminder(body, req) {
  const { plan_id, reminder_days, reminder_types, recipient } = body;

  if (!plan_id || !reminder_days || !reminder_types) {
    return badRequest('维护计划ID、提醒天数和提醒类型不能为空');
  }

  const tenantId = getTenantId(req);

  const [planResult] = await db.execute(
    `SELECT * FROM preventive_maintenance_plans
     WHERE id = ? AND tenant_id = ?`,
    [plan_id, tenantId],
  );

  if (planResult.length === 0) {
    return notFound('维护计划不存在');
  }

  const [configResult] = await db.execute(
    `SELECT * FROM maintenance_reminder_configs
     WHERE plan_id = ? AND tenant_id = ?`,
    [plan_id, tenantId],
  );

  if (configResult.length > 0) {
    await db.execute(
      `UPDATE maintenance_reminder_configs
       SET reminder_days = ?, reminder_types = ?, recipient = ?, updated_at = NOW()
       WHERE plan_id = ? AND tenant_id = ?`,
      [reminder_days, JSON.stringify(reminder_types), recipient, plan_id, tenantId],
    );
  } else {
    await db.execute(
      `INSERT INTO maintenance_reminder_configs
       (tenant_id, plan_id, reminder_days, reminder_types, recipient, created_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [tenantId, plan_id, reminder_days, JSON.stringify(reminder_types), recipient],
    );
  }

  return {
    success: true,
    message: '提醒规则配置成功',
    data: {
      plan_id,
      reminder_days,
      reminder_types,
      recipient,
    },
  };
}

async function checkReminders(req) {
  const tenantId = getTenantId(req);

  const [result] = await db.execute(
    `SELECT
       pmp.id, pmp.plan_name, pmp.asset_code, pmp.asset_name,
       pmp.next_maintenance_date, pmp.responsible_person,
       DATEDIFF(pmp.next_maintenance_date, NOW()) as days_until
     FROM preventive_maintenance_plans pmp
     WHERE pmp.tenant_id = ? AND pmp.status = '启用'
     AND pmp.next_maintenance_date BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 7 DAY)
     ORDER BY days_until ASC`,
    [tenantId],
  );

  return {
    success: true,
    data: result,
    count: result.length,
    message: `发现 ${result.length} 个即将到期的维护计划`,
  };
}

module.exports = {
  getReminders,
  sendReminder,
  configReminder,
  checkReminders,
};
