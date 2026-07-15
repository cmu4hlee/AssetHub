/**
 * 通知规则种子数据
 * 为已集成 EventBus 的关键流程创建默认通知规则
 */
const mysql = require('mysql2/promise');

const RULES = [
  // ===== 维修维护 =====
  {
    rule_name: '报修申请创建 → 通知管理员',
    process_type: 'maintenance',
    event_code: 'maintenance_request:created',
    template_code: 'maintenance_request_created_feishu',
    recipients: [{ recipient_type: 'node', recipient_value: 'approver' }],
  },
  {
    rule_name: '报修申请批准 → 通知报修人',
    process_type: 'maintenance',
    event_code: 'maintenance_request:approved',
    template_code: 'maintenance_request_approved_feishu',
    recipients: [{ recipient_type: 'node', recipient_value: 'request_person' }],
  },
  {
    rule_name: '报修申请驳回 → 通知报修人',
    process_type: 'maintenance',
    event_code: 'maintenance_request:rejected',
    template_code: 'maintenance_request_rejected_feishu',
    recipients: [{ recipient_type: 'node', recipient_value: 'request_person' }],
  },
  {
    rule_name: '维修完成 → 通知报修人',
    process_type: 'maintenance',
    event_code: 'maintenance_request:completed',
    template_code: 'maintenance_request_completed_feishu',
    recipients: [{ recipient_type: 'node', recipient_value: 'request_person' }],
  },
  {
    rule_name: '工单分配 → 通知维修工程师',
    process_type: 'maintenance',
    event_code: 'workorder:assigned',
    template_code: 'workorder_assigned_feishu',
    recipients: [{ recipient_type: 'node', recipient_value: 'assignee' }],
  },
  {
    rule_name: '工单完成 → 通知报修人',
    process_type: 'maintenance',
    event_code: 'workorder:completed',
    template_code: 'workorder_completed_feishu',
    recipients: [{ recipient_type: 'node', recipient_value: 'request_person' }],
  },
  // ===== 资产盘点 =====
  {
    rule_name: '盘点任务创建 → 通知负责人',
    process_type: 'inventory',
    event_code: 'inventory_task:created',
    template_code: 'inventory_task_created_feishu',
    recipients: [{ recipient_type: 'node', recipient_value: 'responsible_person' }],
  },
  {
    rule_name: '盘点完成 → 通知创建人',
    process_type: 'inventory',
    event_code: 'inventory_task:completed',
    template_code: 'inventory_completed_feishu',
    recipients: [{ recipient_type: 'node', recipient_value: 'creator' }],
  },
  // ===== 招标采购 =====
  {
    rule_name: '招标创建 → 站内通知',
    process_type: 'tender',
    event_code: 'tender:created',
    template_code: 'tender_created_feishu',
    recipients: [{ recipient_type: 'node', recipient_value: 'approver' }],
  },
  {
    rule_name: '招标定标 → 通知创建人',
    process_type: 'tender',
    event_code: 'tender:awarded',
    template_code: 'tender_awarded_feishu',
    recipients: [{ recipient_type: 'node', recipient_value: 'creator' }],
  },
  // ===== 验收管理 =====
  {
    rule_name: '验收催办提醒',
    process_type: 'acceptance',
    event_code: 'acceptance:reminder',
    template_code: 'acceptance_reminder_feishu',
    recipients: [{ recipient_type: 'node', recipient_value: 'responsible_person' }],
  },
  // ===== 审批流程 =====
  {
    rule_name: '审批发起 → 通知审批人',
    process_type: 'approval',
    event_code: 'approval:created',
    template_code: 'approval_created_feishu',
    recipients: [{ recipient_type: 'node', recipient_value: 'approver' }],
  },
  {
    rule_name: '审批通过 → 通知申请人',
    process_type: 'approval',
    event_code: 'approval:approved',
    template_code: 'approval_approved_feishu',
    recipients: [{ recipient_type: 'node', recipient_value: 'applicant' }],
  },
  {
    rule_name: '审批驳回 → 通知申请人',
    process_type: 'approval',
    event_code: 'approval:rejected',
    template_code: 'approval_rejected_feishu',
    recipients: [{ recipient_type: 'node', recipient_value: 'applicant' }],
  },
];

async function main() {
  const pool = mysql.createPool({
    host: '127.0.0.1', port: 3306, user: 'root',
    password: 'Cmu19801008', database: 'zcgl',
    connectionLimit: 2,
  });
  const conn = await pool.getConnection();

  try {
    // 1. 获取所有模板的 id↔code 映射
    const [templates] = await conn.query(
      'SELECT id, code FROM notification_templates WHERE tenant_id = 0'
    );
    const tplMap = {};
    templates.forEach(t => { tplMap[t.code] = t.id; });

    // 2. 检查已有规则数量
    const [existing] = await conn.query('SELECT COUNT(*) as cnt FROM notification_rules WHERE tenant_id = 0');
    if (existing[0].cnt > 0) {
      console.log(`⚠️ 已有 ${existing[0].cnt} 条规则，将清空后重新插入`);
      const [recIds] = await conn.query('SELECT id FROM notification_rules WHERE tenant_id = 0');
      for (const r of recIds) {
        await conn.query('DELETE FROM notification_recipients WHERE rule_id = ?', [r.id]);
      }
      await conn.query('DELETE FROM notification_rules WHERE tenant_id = 0');
    }

    await conn.beginTransaction();

    let inserted = 0;
    let skipped = 0;

    for (const rule of RULES) {
      const tplId = tplMap[rule.template_code];
      if (!tplId) {
        console.log(`  ⊘ 跳过 "${rule.rule_name}"：模板 ${rule.template_code} 不存在`);
        skipped++;
        continue;
      }

      // 检查是否已有同名规则
      const [dup] = await conn.query(
        'SELECT id FROM notification_rules WHERE rule_name = ? AND tenant_id = 0',
        [rule.rule_name]
      );
      if (dup.length > 0) {
        console.log(`  ⊘ 跳过重复: ${rule.rule_name}`);
        skipped++;
        continue;
      }

      // 插入规则
      const [result] = await conn.query(
        `INSERT INTO notification_rules
         (tenant_id, process_type, event_code, rule_name, template_id, enabled, priority, created_at, updated_at)
         VALUES (0, ?, ?, ?, ?, 1, 0, NOW(), NOW())`,
        [rule.process_type, rule.event_code, rule.rule_name, tplId]
      );
      const ruleId = result.insertId;

      // 插入接收人
      for (const rec of rule.recipients) {
        await conn.query(
          `INSERT INTO notification_recipients (rule_id, recipient_type, recipient_value, created_at)
           VALUES (?, ?, ?, NOW())`,
          [ruleId, rec.recipient_type, JSON.stringify(rec.recipient_value)]
        );
      }

      inserted++;
      console.log(`  ✓ [${rule.process_type}] ${rule.rule_name}`);
    }

    await conn.commit();

    // 3. 验证
    const [total] = await conn.query(
      'SELECT COUNT(*) as cnt FROM notification_rules WHERE tenant_id = 0'
    );
    const [byProcess] = await conn.query(
      'SELECT process_type, COUNT(*) as cnt FROM notification_rules WHERE tenant_id = 0 GROUP BY process_type'
    );

    console.log(`\n✅ 完成！插入 ${inserted} 条规则，跳过 ${skipped} 条，当前总数: ${total[0].cnt}`);
    console.log('\n按流程类型分布:');
    byProcess.forEach(r => console.log(`  ${r.process_type}: ${r.cnt} 条`));
  } catch (err) {
    await conn.rollback();
    console.error('❌ 失败:', err.message);
    throw err;
  } finally {
    conn.release();
    await pool.end();
  }
}

main().catch(err => { console.error(err); process.exit(1); });
