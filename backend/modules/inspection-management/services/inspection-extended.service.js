/**
 * 巡检管理扩展服务
 * 负责:模板复制、批量任务、巡检计划、巡检路线、自动派发、转工单、日历、PDF、调度入口
 */
const db = require('../../../config/database');
const logger = require('../../../config/logger');
const { generateSequenceCode, createNotification } = require('../utils/inspection.utils');
const coreInspection = require('./inspection.service');
const workordersService = require('../../../services/maintenance/workorders.service');
const path = require('path');
const fs = require('fs');
const ejs = require('ejs');
const puppeteer = require('puppeteer');

class InspectionExtendedService {
  // ============ 模板复制 ============

  async copyTemplate(sourceId, targetName, tenantId, userId) {
    const [srcRows] = await db.execute(
      'SELECT * FROM inspection_templates WHERE id = ? AND tenant_id = ?',
      [sourceId, tenantId],
    );
    if (srcRows.length === 0) throw new Error('源模板不存在');
    const src = srcRows[0];

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const newCode = await generateSequenceCode(tenantId, 'template', 'TPL');
      const [ins] = await conn.execute(
        `INSERT INTO inspection_templates
          (tenant_id, template_code, template_name, inspection_type, applicable_scope,
           cycle_days, description, status, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
        [
          tenantId, newCode, targetName || `${src.template_name} - 副本`,
          src.inspection_type, src.applicable_scope, src.cycle_days, src.description, userId,
        ],
      );
      const newId = ins.insertId;

      const [items] = await conn.execute(
        'SELECT * FROM inspection_template_items WHERE template_id = ? ORDER BY sort_order',
        [sourceId],
      );
      for (const item of items) {
        await conn.execute(
          `INSERT INTO inspection_template_items
            (template_id, tenant_id, item_code, item_name, item_category, check_method,
             check_standard, expected_value, unit, is_required, sort_order, remark)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            newId, tenantId, item.item_code, item.item_name, item.item_category,
            item.check_method, item.check_standard, item.expected_value, item.unit,
            item.is_required, item.sort_order, item.remark,
          ],
        );
      }
      await conn.commit();
      return { id: newId, template_code: newCode };
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  }

  // ============ 批量生成任务 ============

  async batchCreateTasks(payload, tenantId, userId) {
    const { plan_id, asset_ids, plan_date, deadline, priority, assignee_id, assignee_name, template_id, cycle_days } = payload;
    if (!Array.isArray(asset_ids) || asset_ids.length === 0) {
      throw new Error('请选择至少一个资产');
    }
    const results = { success: 0, failed: 0, task_ids: [], errors: [] };
    for (const assetId of asset_ids) {
      try {
        const r = await coreInspection.createTask(
          {
            task_name: payload.task_name || `巡检任务-${assetId}`,
            template_id: template_id || null,
            asset_id: assetId,
            inspection_type: payload.inspection_type || 'daily',
            assignee_id, assignee_name,
            plan_date, deadline,
            priority: priority || 'medium',
            cycle_days: cycle_days || null,
            remark: payload.remark,
            auto_generated: !!plan_id,
          },
          tenantId, userId,
        );
        results.success += 1;
        results.task_ids.push(r.id);
      } catch (e) {
        results.failed += 1;
        results.errors.push({ asset_id: assetId, error: e.message });
      }
    }
    return results;
  }

  // ============ 巡检计划 CRUD ============

  async getPlans(params) {
    const { tenantId, page = 1, pageSize = 20, status, keyword } = params;
    const where = ['tenant_id = ?'];
    const args = [tenantId];
    if (status) { where.push('status = ?'); args.push(status); }
    if (keyword) {
      where.push('(plan_code LIKE ? OR plan_name LIKE ?)');
      args.push(`%${keyword}%`, `%${keyword}%`);
    }
    const offset = (page - 1) * pageSize;
    const [rows] = await db.execute(
      `SELECT * FROM inspection_plans WHERE ${where.join(' AND ')}
       ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...args, parseInt(pageSize), offset],
    );
    const [cnt] = await db.execute(
      `SELECT COUNT(*) AS total FROM inspection_plans WHERE ${where.join(' AND ')}`,
      args,
    );
    return { data: rows, pagination: { page: parseInt(page), pageSize: parseInt(pageSize), total: cnt[0].total } };
  }

  async getPlanById(id, tenantId) {
    const [rows] = await db.execute(
      'SELECT * FROM inspection_plans WHERE id = ? AND tenant_id = ?',
      [id, tenantId],
    );
    if (rows.length === 0) return null;
    let assets = [];
    if (rows[0].asset_ids) {
      try { assets = JSON.parse(rows[0].asset_ids); } catch (e) { /* ignore */ }
    }
    return { ...rows[0], asset_ids_parsed: assets };
  }

  async createPlan(data, tenantId, userId) {
    const code = data.plan_code || (await generateSequenceCode(tenantId, 'plan', 'PLAN'));
    const [r] = await db.execute(
      `INSERT INTO inspection_plans
        (tenant_id, plan_code, plan_name, template_id, cycle_days, cycle_type,
         weekday, day_of_month, start_date, end_date, next_run_date,
         asset_ids, scope_type, scope_value, default_assignee_id, default_assignee_name,
         default_priority, auto_create_workorder, status, remark, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tenantId, code, data.plan_name, data.template_id || null,
        data.cycle_days || 30, data.cycle_type || 'monthly',
        data.weekday ?? null, data.day_of_month ?? null,
        data.start_date, data.end_date || null,
        data.next_run_date || data.start_date,
        data.asset_ids ? JSON.stringify(data.asset_ids) : null,
        data.scope_type || 'assets', data.scope_value || null,
        data.default_assignee_id || null, data.default_assignee_name || null,
        data.default_priority || 'medium',
        data.auto_create_workorder ? 1 : 0,
        data.status || 'active', data.remark || null, userId,
      ],
    );
    return { id: r.insertId, plan_code: code };
  }

  async updatePlan(id, data, tenantId) {
    const fields = [];
    const values = [];
    [
      'plan_name', 'template_id', 'cycle_days', 'cycle_type', 'weekday', 'day_of_month',
      'start_date', 'end_date', 'next_run_date', 'asset_ids', 'scope_type', 'scope_value',
      'default_assignee_id', 'default_assignee_name', 'default_priority',
      'auto_create_workorder', 'status', 'remark',
    ].forEach(k => {
      if (data[k] !== undefined) {
        fields.push(`${k} = ?`);
        values.push(k === 'asset_ids' && typeof data[k] !== 'string'
          ? JSON.stringify(data[k]) : data[k]);
      }
    });
    if (fields.length === 0) return false;
    values.push(id, tenantId);
    const [r] = await db.execute(
      `UPDATE inspection_plans SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ? AND tenant_id = ?`,
      values,
    );
    return r.affectedRows > 0;
  }

  async deletePlan(id, tenantId) {
    const [r] = await db.execute(
      'DELETE FROM inspection_plans WHERE id = ? AND tenant_id = ?',
      [id, tenantId],
    );
    return r.affectedRows > 0;
  }

  // ============ 巡检路线 CRUD ============

  async getRoutes(params) {
    const { tenantId, page = 1, pageSize = 20, status, keyword } = params;
    const where = ['tenant_id = ?'];
    const args = [tenantId];
    if (status) { where.push('status = ?'); args.push(status); }
    if (keyword) { where.push('(route_code LIKE ? OR route_name LIKE ?)'); args.push(`%${keyword}%`, `%${keyword}%`); }
    const [rows] = await db.execute(
      `SELECT * FROM inspection_routes WHERE ${where.join(' AND ')} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...args, parseInt(pageSize), (page - 1) * pageSize],
    );
    const [cnt] = await db.execute(
      `SELECT COUNT(*) AS total FROM inspection_routes WHERE ${where.join(' AND ')}`, args,
    );
    return { data: rows, pagination: { page: parseInt(page), pageSize: parseInt(pageSize), total: cnt[0].total } };
  }

  async getRouteById(id, tenantId) {
    const [rows] = await db.execute(
      'SELECT * FROM inspection_routes WHERE id = ? AND tenant_id = ?',
      [id, tenantId],
    );
    if (rows.length === 0) return null;
    const [points] = await db.execute(
      `SELECT p.*, a.asset_name, a.asset_code FROM inspection_route_points p
       LEFT JOIN assets a ON p.asset_id = a.id AND a.tenant_id = p.tenant_id AND a.is_deleted = 0
       WHERE p.route_id = ? ORDER BY p.point_order ASC`,
      [id],
    );
    return { ...rows[0], points };
  }

  async createRoute(data, tenantId, userId) {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const code = data.route_code || (await generateSequenceCode(tenantId, 'route', 'ROUTE'));
      const [r] = await conn.execute(
        `INSERT INTO inspection_routes
          (tenant_id, route_code, route_name, description, status, estimated_minutes, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [tenantId, code, data.route_name, data.description || null,
         data.status || 'active', data.estimated_minutes || 60, userId],
      );
      const routeId = r.insertId;
      if (Array.isArray(data.points)) {
        for (let i = 0; i < data.points.length; i++) {
          const p = data.points[i];
          await conn.execute(
            `INSERT INTO inspection_route_points
              (route_id, tenant_id, point_order, asset_id, location_code, location_name,
               check_items, qr_code, remark)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              routeId, tenantId, p.point_order ?? i, p.asset_id || null,
              p.location_code || null, p.location_name || null,
              p.check_items ? JSON.stringify(p.check_items) : null,
              p.qr_code || null, p.remark || null,
            ],
          );
        }
      }
      await conn.commit();
      return { id: routeId, route_code: code };
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  }

  async updateRoute(id, data, tenantId) {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const fields = [];
      const values = [];
      ['route_name', 'description', 'status', 'estimated_minutes'].forEach(k => {
        if (data[k] !== undefined) { fields.push(`${k} = ?`); values.push(data[k]); }
      });
      if (fields.length > 0) {
        values.push(id, tenantId);
        await conn.execute(
          `UPDATE inspection_routes SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ? AND tenant_id = ?`,
          values,
        );
      }
      if (Array.isArray(data.points)) {
        await conn.execute('DELETE FROM inspection_route_points WHERE route_id = ?', [id]);
        for (let i = 0; i < data.points.length; i++) {
          const p = data.points[i];
          await conn.execute(
            `INSERT INTO inspection_route_points
              (route_id, tenant_id, point_order, asset_id, location_code, location_name, check_items, qr_code, remark)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              id, tenantId, p.point_order ?? i, p.asset_id || null,
              p.location_code || null, p.location_name || null,
              p.check_items ? JSON.stringify(p.check_items) : null,
              p.qr_code || null, p.remark || null,
            ],
          );
        }
      }
      await conn.commit();
      return true;
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  }

  async deleteRoute(id, tenantId) {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      await conn.execute('DELETE FROM inspection_route_points WHERE route_id = ?', [id]);
      const [r] = await conn.execute(
        'DELETE FROM inspection_routes WHERE id = ? AND tenant_id = ?', [id, tenantId],
      );
      await conn.commit();
      return r.affectedRows > 0;
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  }

  // ============ 专门复核 API ============

  async reviewRecord(id, payload, tenantId, userInfo) {
    const { decision, remark } = payload; // decision: 'approve' | 'reject'
    const status = decision === 'approve' ? 'reviewed' : 'submitted';
    const updateData = {
      status,
      reviewer_id: userInfo.id,
      reviewer_name: userInfo.username || userInfo.name,
      reviewed_remark: remark,
    };
    if (decision === 'approve') {
      updateData.review_action = 'review';
    }
    return coreInspection.updateRecord(id, updateData, tenantId);
  }

  // ============ 异常转工单 ============

  async convertIssueToWorkOrder(issueId, tenantId, userInfo) {
    // 读问题详情
    const [issues] = await db.execute(
      `SELECT i.*, r.record_code, r.inspection_title, r.task_id, r.template_id
       FROM inspection_issues i
       LEFT JOIN inspection_records r ON i.record_id = r.id AND r.tenant_id = i.tenant_id
       WHERE i.id = ? AND i.tenant_id = ?`,
      [issueId, tenantId],
    );
    if (issues.length === 0) throw new Error('问题不存在');
    const issue = issues[0];
    if (issue.work_order_id) {
      throw new Error(`该问题已关联工单 ${issue.work_order_code}`);
    }

    // 查资产编码(工单接口需要 asset_code 而非 asset_id)
    let assetCode = null;
    if (issue.asset_id) {
      const [assets] = await db.execute(
        'SELECT asset_code FROM assets WHERE id = ? AND tenant_id = ?',
        [issue.asset_id, tenantId],
      );
      assetCode = assets[0]?.asset_code || null;
    }
    if (!assetCode) {
      throw new Error('问题未关联资产,无法转工单');
    }

    const workOrderPayload = {
      title: issue.problem_title || '巡检异常',
      description: issue.problem_desc || '',
      asset_code: assetCode,
      source_type: 'inspection',
      priority: issue.risk_level === 'high' ? 'high' : (issue.risk_level === 'low' ? 'low' : 'medium'),
      assigned_to: issue.rectification_assignee_name || null,
    };
    let workOrder;
    try {
      // 构造 req 形状符合 workordersService 内部 addTenantFilter/getTenantId
      const fakeReq = {
        user: {
          id: userInfo.id,
          username: userInfo.username || userInfo.name,
          real_name: userInfo.real_name || userInfo.username || userInfo.name,
          tenant_id: tenantId,
        },
      };
      workOrder = await workordersService.createWorkOrder(workOrderPayload, fakeReq);
    } catch (e) {
      logger.error('调用工单服务失败,使用降级方案', { error: e.message });
      workOrder = { id: null, code: null };
    }

    // 回写问题表
    const woId = workOrder?.id || null;
    const woCode = workOrder?.work_order_no || workOrder?.code || workOrder?.work_order_code || null;
    await db.execute(
      `UPDATE inspection_issues SET work_order_id = ?, work_order_code = ?, updated_at = NOW()
       WHERE id = ? AND tenant_id = ?`,
      [woId, woCode, issueId, tenantId],
    );

    return { work_order_id: woId, work_order_code: woCode };
  }

  // ============ 巡检日历数据 ============

  async getCalendarData(tenantId, params) {
    const { start_date, end_date, assignee_id } = params;
    const where = ['t.tenant_id = ?', "t.status IN ('pending', 'in_progress', 'overdue')"];
    const args = [tenantId];
    if (start_date) { where.push('t.plan_date >= ?'); args.push(start_date); }
    if (end_date) { where.push('t.plan_date <= ?'); args.push(end_date); }
    if (assignee_id) { where.push('t.assignee_id = ?'); args.push(assignee_id); }

    const [rows] = await db.execute(
      `SELECT t.id, t.task_code, t.task_name, t.plan_date, t.status, t.priority,
              t.assignee_id, t.assignee_name, t.inspection_type,
              t.inspection_area, a.asset_name, a.asset_code, it.template_name
       FROM inspection_tasks t
       LEFT JOIN assets a ON t.asset_id = a.id AND a.tenant_id = t.tenant_id AND a.is_deleted = 0
       LEFT JOIN inspection_templates it ON t.template_id = it.id AND it.tenant_id = t.tenant_id AND a.is_deleted = 0
       WHERE ${where.join(' AND ')}
       ORDER BY t.plan_date ASC`,
      args,
    );

    // 按日期分组
    const byDate = {};
    for (const r of rows) {
      const d = r.plan_date instanceof Date ? r.plan_date.toISOString().slice(0, 10) : r.plan_date;
      if (!byDate[d]) byDate[d] = [];
      byDate[d].push(r);
    }
    return { total: rows.length, by_date: byDate, list: rows };
  }

  // ============ 完成自动派发下一周期 ============

  async maybeScheduleNextTask(currentTaskId, tenantId) {
    const [rows] = await db.execute(
      'SELECT * FROM inspection_tasks WHERE id = ? AND tenant_id = ?',
      [currentTaskId, tenantId],
    );
    if (rows.length === 0) return null;
    const task = rows[0];
    if (!task.cycle_days && !task.recurring_plan_id) return null;

    // 通过计划生成
    if (task.recurring_plan_id) {
      const [plans] = await db.execute(
        'SELECT * FROM inspection_plans WHERE id = ? AND tenant_id = ?',
        [task.recurring_plan_id, tenantId],
      );
      if (plans.length === 0) return null;
      return this.dispatchFromPlan(plans[0], tenantId, null);
    }

    // 单任务 cycle_days
    if (task.cycle_days) {
      const next = new Date(task.plan_date);
      next.setDate(next.getDate() + parseInt(task.cycle_days));
      const nextStr = next.toISOString().slice(0, 10);
      const r = await coreInspection.createTask(
        {
          task_name: task.task_name,
          template_id: task.template_id,
          asset_id: task.asset_id,
          inspection_area: task.inspection_area,
          inspection_type: task.inspection_type,
          assignee_id: task.assignee_id,
          assignee_name: task.assignee_name,
          plan_date: nextStr,
          deadline: task.deadline,
          cycle_days: task.cycle_days,
          priority: task.priority,
          remark: task.remark,
          auto_generated: true,
        },
        tenantId, null,
      );
      // 关联父子任务
      await db.execute(
        'UPDATE inspection_tasks SET parent_task_id = ? WHERE id = ?',
        [currentTaskId, r.id],
      );
      return r;
    }
    return null;
  }

  // ============ 从计划派发（按 next_run_date） ============

  async dispatchFromPlan(plan, tenantId, userId) {
    if (!plan.asset_ids) return null;
    let assets = [];
    try { assets = JSON.parse(plan.asset_ids); } catch (e) { /* ignore */ }
    if (assets.length === 0) return null;

    const nextRun = plan.next_run_date
      ? new Date(plan.next_run_date)
      : new Date(plan.start_date);
    const planDateStr = nextRun.toISOString().slice(0, 10);

    const results = await this.batchCreateTasks(
      {
        plan_id: plan.id,
        asset_ids: assets,
        task_name: `${plan.plan_name}-${planDateStr}`,
        template_id: plan.template_id,
        inspection_type: 'daily',
        assignee_id: plan.default_assignee_id,
        assignee_name: plan.default_assignee_name,
        plan_date: planDateStr,
        priority: plan.default_priority,
        cycle_days: plan.cycle_days,
      },
      tenantId, userId,
    );

    // 计算下次执行时间
    const nextDate = new Date(nextRun);
    nextDate.setDate(nextDate.getDate() + parseInt(plan.cycle_days));
    const nextRunStr = nextDate.toISOString().slice(0, 10);

    // 判断是否到 end_date
    if (plan.end_date && new Date(planDateStr) >= new Date(plan.end_date)) {
      await db.execute(
        'UPDATE inspection_plans SET status = "ended", last_run_date = ? WHERE id = ?',
        [planDateStr, plan.id],
      );
    } else {
      await db.execute(
        'UPDATE inspection_plans SET last_run_date = ?, next_run_date = ? WHERE id = ?',
        [planDateStr, nextRunStr, plan.id],
      );
    }
    return { plan_id: plan.id, plan_date: planDateStr, ...results, next_run_date: nextRunStr };
  }

  // ============ 计划派发调度（cron 调用） ============

  async runPlanDispatch(tenantId = null) {
    const where = ["status = 'active'", 'next_run_date IS NOT NULL', 'next_run_date <= CURDATE()'];
    const args = [];
    if (tenantId !== null) { where.push('tenant_id = ?'); args.push(tenantId); }
    const [plans] = await db.execute(
      `SELECT * FROM inspection_plans WHERE ${where.join(' AND ')}`,
      args,
    );
    const out = { total: plans.length, results: [] };
    for (const plan of plans) {
      try {
        const r = await this.dispatchFromPlan(plan, plan.tenant_id, null);
        out.results.push({ plan_id: plan.id, plan_name: plan.plan_name, ...r });
      } catch (e) {
        logger.error('计划派发失败', { plan_id: plan.id, error: e.message });
        out.results.push({ plan_id: plan.id, error: e.message });
      }
    }
    return out;
  }

  // ============ 逾期任务标记（cron 调用） ============

  async runOverdueMark(tenantId = null) {
    const where = ["status IN ('pending')", 'plan_date < CURDATE()'];
    const args = [];
    if (tenantId !== null) { where.push('tenant_id = ?'); args.push(tenantId); }
    const [result] = await db.execute(
      `UPDATE inspection_tasks SET status = 'overdue', updated_at = NOW()
       WHERE ${where.join(' AND ')}`,
      args,
    );
    return { affected: result.affectedRows };
  }

  // ============ 到期提醒（cron 调用） ============

  async runExpiringAlerts(days = 3, tenantId = null) {
    const where = [
      "t.status IN ('pending', 'in_progress')",
      't.plan_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY)',
      't.plan_date >= CURDATE()',
    ];
    const args = [days];
    if (tenantId !== null) { where.push('t.tenant_id = ?'); args.push(tenantId); }

    const [tasks] = await db.execute(
      `SELECT t.*, a.asset_name
       FROM inspection_tasks t
       LEFT JOIN assets a ON t.asset_id = a.id AND a.tenant_id = t.tenant_id AND a.is_deleted = 0
       WHERE ${where.join(' AND ')}`,
      args,
    );

    let notified = 0;
    for (const t of tasks) {
      if (!t.assignee_id) continue;
      // 查今日是否已通知
      const [exists] = await db.execute(
        `SELECT id FROM inspection_notifications
         WHERE tenant_id = ? AND notify_type = 'task_expiring' AND ref_id = ? AND recipient_id = ?
           AND DATE(created_at) = CURDATE() LIMIT 1`,
        [t.tenant_id, t.id, t.assignee_id],
      );
      if (exists.length > 0) continue;

      await createNotification({
        tenantId: t.tenant_id,
        notifyType: 'task_expiring',
        refId: t.id,
        refCode: t.task_code,
        recipientId: t.assignee_id,
        recipientName: t.assignee_name,
        title: `巡检任务 ${t.task_code} 即将到期`,
        content: `任务「${t.task_name}」计划于 ${t.plan_date} 执行,还有 ${days} 天到期。`,
      });
      notified += 1;
    }
    return { candidates: tasks.length, notified };
  }

  // ============ 整改超期提醒 ============

  async runIssueOverdueAlerts(tenantId = null) {
    const where = [
      "status IN ('open', 'in_progress')",
      'rectification_deadline IS NOT NULL',
      'rectification_deadline < CURDATE()',
    ];
    const args = [];
    if (tenantId !== null) { where.push('tenant_id = ?'); args.push(tenantId); }
    const [issues] = await db.execute(
      `SELECT * FROM inspection_issues WHERE ${where.join(' AND ')}`,
      args,
    );
    let notified = 0;
    for (const issue of issues) {
      if (!issue.rectification_assignee_id) continue;
      const [exists] = await db.execute(
        `SELECT id FROM inspection_notifications
         WHERE tenant_id = ? AND notify_type = 'issue_overdue' AND ref_id = ?
           AND DATE(created_at) = CURDATE() LIMIT 1`,
        [issue.tenant_id, issue.id],
      );
      if (exists.length > 0) continue;
      await createNotification({
        tenantId: issue.tenant_id,
        notifyType: 'issue_overdue',
        refId: issue.id,
        refCode: issue.issue_code,
        recipientId: issue.rectification_assignee_id,
        recipientName: issue.rectification_assignee_name,
        title: `整改问题 ${issue.issue_code} 已超期`,
        content: `问题「${issue.problem_title}」整改期限为 ${issue.rectification_deadline},请尽快处理。`,
      });
      notified += 1;
    }
    return { candidates: issues.length, notified };
  }

  // ============ 通知列表 ============

  async getNotifications(params) {
    const { tenantId, recipient_id, is_read, page = 1, pageSize = 20 } = params;
    const where = ['tenant_id = ?'];
    const args = [tenantId];
    if (recipient_id) { where.push('recipient_id = ?'); args.push(recipient_id); }
    if (is_read !== undefined) { where.push('is_read = ?'); args.push(is_read ? 1 : 0); }
    const [rows] = await db.execute(
      `SELECT * FROM inspection_notifications WHERE ${where.join(' AND ')}
       ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...args, parseInt(pageSize), (page - 1) * pageSize],
    );
    const [cnt] = await db.execute(
      `SELECT COUNT(*) AS total FROM inspection_notifications WHERE ${where.join(' AND ')}`, args,
    );
    return { data: rows, pagination: { page: parseInt(page), pageSize: parseInt(pageSize), total: cnt[0].total } };
  }

  async markNotificationRead(id, tenantId, userId) {
    const [r] = await db.execute(
      `UPDATE inspection_notifications SET is_read = 1, read_at = NOW()
       WHERE id = ? AND tenant_id = ? AND recipient_id = ?`,
      [id, tenantId, userId],
    );
    return r.affectedRows > 0;
  }

  // ============ 统计增强（按部门/按人员/趋势） ============

  async getEnrichedStatistics(tenantId, params = {}) {
    const { start_date, end_date } = params;
    const dateFilter = start_date && end_date ? 'AND inspection_date BETWEEN ? AND ?' : '';
    const dateParams = start_date && end_date ? [start_date, end_date] : [];

    // 按人员统计
    const [byInspector] = await db.execute(
      `SELECT inspector_id, inspector_name, COUNT(*) AS records,
              SUM(CASE WHEN overall_result = 'abnormal' THEN 1 ELSE 0 END) AS abnormal
       FROM inspection_records WHERE tenant_id = ? ${dateFilter}
       GROUP BY inspector_id, inspector_name
       ORDER BY records DESC LIMIT 20`,
      dateParams.length > 0 ? [tenantId, ...dateParams] : [tenantId],
    );

    // 按部门统计
    const [byDepartment] = await db.execute(
      `SELECT d.id, d.department_name, COUNT(r.id) AS records,
              SUM(CASE WHEN r.overall_result = 'abnormal' THEN 1 ELSE 0 END) AS abnormal
       FROM inspection_records r
       LEFT JOIN assets a ON r.asset_id = a.id AND a.tenant_id = r.tenant_id AND a.is_deleted = 0
       LEFT JOIN departments d ON a.department_id = d.id AND a.is_deleted = 0
       WHERE r.tenant_id = ? ${dateFilter.replace('inspection_date', 'r.inspection_date')}
       GROUP BY d.id, d.department_name
       ORDER BY records DESC LIMIT 20`,
      dateParams.length > 0 ? [tenantId, ...dateParams] : [tenantId],
    );

    // 整改效率
    const [rectificationStats] = await db.execute(
      `SELECT
        COUNT(*) AS total,
        AVG(DATEDIFF(IFNULL(rectification_date, CURDATE()), created_at)) AS avg_days,
        SUM(CASE WHEN rectification_deadline IS NOT NULL
                  AND rectification_date IS NOT NULL
                  AND rectification_date <= rectification_deadline THEN 1 ELSE 0 END) AS on_time
       FROM inspection_issues WHERE tenant_id = ?`,
      [tenantId],
    );

    return { by_inspector: byInspector, by_department: byDepartment, rectification: rectificationStats[0] };
  }

  // ============ 问题操作历史 ============

  async getIssueHistory(issueId, tenantId) {
    const [rows] = await db.execute(
      `SELECT * FROM inspection_issue_histories
       WHERE issue_id = ? AND tenant_id = ? ORDER BY created_at ASC`,
      [issueId, tenantId],
    );
    return rows;
  }

  // ============ 记录单 PDF 导出 ============

  async exportRecordPdf(id, tenantId) {
    const record = await coreInspection.getRecordById(id, tenantId);
    if (!record) throw new Error('记录单不存在');

    // 读模板
    const tmplPath = path.join(__dirname, '../templates/inspection-record.html');
    if (!fs.existsSync(tmplPath)) {
      // 兜底：动态生成
      const html = this._buildRecordHtml(record);
      return this._renderPdfFromHtml(html);
    }
    const html = await ejs.renderFile(tmplPath, { record });
    return this._renderPdfFromHtml(html);
  }

  _buildRecordHtml(record) {
    const items = record.items || [];
    const issues = record.issues || [];
    const rows = items.map((it, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td>${this._esc(it.item_name)}</td>
        <td>${this._esc(it.item_category)}</td>
        <td>${this._esc(it.check_standard)}</td>
        <td>${this._esc(it.expected_value)}</td>
        <td>${this._esc(it.actual_value)}</td>
        <td>${this._resultBadge(it.check_result)}</td>
        <td>${this._esc(it.problem_desc)}</td>
        <td>${this._esc(it.risk_level)}</td>
      </tr>
    `).join('');
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
      body { font-family: "Microsoft YaHei", sans-serif; padding: 24px; color: #222; }
      h1 { text-align: center; font-size: 22px; }
      .meta { margin: 12px 0; font-size: 12px; color: #555; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; }
      th, td { border: 1px solid #999; padding: 6px 8px; text-align: left; }
      th { background: #f0f0f0; }
      .footer { margin-top: 32px; font-size: 12px; }
      .signature { display: inline-block; width: 200px; border-bottom: 1px solid #333; }
    </style></head><body>
      <h1>巡检记录单</h1>
      <div class="meta">
        <div>记录单编号: ${this._esc(record.record_code)}</div>
        <div>巡检标题: ${this._esc(record.inspection_title)}</div>
        <div>巡检日期: ${this._esc(record.inspection_date)}  类型: ${this._esc(record.inspection_type)}</div>
        <div>巡检区域: ${this._esc(record.inspection_area || '-')}</div>
        <div>巡检人: ${this._esc(record.inspector_name)}  复核人: ${this._esc(record.reviewer_name || '-')}</div>
        <div>关联资产: ${this._esc(record.asset_name || '-')} (${this._esc(record.asset_code || '-')})</div>
        <div>检查项: 共 ${record.total_items || 0} 项, 正常 ${record.normal_items || 0}, 异常 ${record.abnormal_items || 0}, 总体结论: ${this._esc(record.overall_result)}</div>
      </div>
      <table>
        <thead><tr><th>#</th><th>检查项</th><th>类别</th><th>标准</th><th>期望值</th><th>实测值</th><th>结果</th><th>问题描述</th><th>风险</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="footer">
        <p>巡检总结: ${this._esc(record.summary || '')}</p>
        <p>改进建议: ${this._esc(record.suggestions || '')}</p>
        <p style="margin-top: 24px;">
          巡检人签字: <span class="signature">${this._esc(record.signature_inspector || '')}</span>
          复核人签字: <span class="signature">${this._esc(record.signature_reviewer || '')}</span>
        </p>
      </div>
    </body></html>`;
  }

  _esc(v) {
    if (v === null || v === undefined) return '';
    return String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  _resultBadge(r) {
    const map = { normal: '正常', abnormal: '异常', na: '不适用' };
    return `<span style="color:${r === 'abnormal' ? '#cf1322' : r === 'normal' ? '#389e0d' : '#999'}">${map[r] || r || ''}</span>`;
  }

  async _renderPdfFromHtml(html) {
    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdf = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' } });
      return pdf;
    } finally {
      await browser.close();
    }
  }
}

module.exports = new InspectionExtendedService();
