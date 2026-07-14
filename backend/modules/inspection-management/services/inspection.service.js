const db = require('../../../config/database');
const logger = require('../../../config/logger');
const {
  generateSequenceCode,
  assertTenantAsset,
  assertTenantTask,
  assertTenantTemplate,
  logIssueHistory,
  createNotification,
} = require('../utils/inspection.utils');

const ASSET_JOIN =
  'LEFT JOIN assets a ON r.asset_id = a.id AND a.tenant_id = r.tenant_id';

class InspectionService {
  // ============ 巡检模板管理 ============

  /**
   * 获取巡检模板列表
   */
  async getTemplates(params) {
    const { tenantId, page = 1, pageSize = 20, inspection_type, status, keyword } = params;
    let sql = 'SELECT * FROM inspection_templates WHERE tenant_id = ?';
    const queryParams = [tenantId];

    if (inspection_type) {
      sql += ' AND inspection_type = ?';
      queryParams.push(inspection_type);
    }
    if (status) {
      sql += ' AND status = ?';
      queryParams.push(status);
    }
    if (keyword) {
      sql += ' AND (template_name LIKE ? OR template_code LIKE ?)';
      queryParams.push(`%${keyword}%`, `%${keyword}%`);
    }

    // 计算总数
    let countSql = 'SELECT COUNT(*) as total FROM inspection_templates WHERE tenant_id = ?';
    const countParams = [tenantId];
    if (inspection_type) {
      countSql += ' AND inspection_type = ?';
      countParams.push(inspection_type);
    }
    if (status) {
      countSql += ' AND status = ?';
      countParams.push(status);
    }
    if (keyword) {
      countSql += ' AND (template_name LIKE ? OR template_code LIKE ?)';
      countParams.push(`%${keyword}%`, `%${keyword}%`);
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    queryParams.push(parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize));

    const [rows] = await db.execute(sql, queryParams);
    const [countResult] = await db.execute(countSql, countParams);

    // 为每个模板附加检查项数量
    const templateIds = rows.map(r => r.id);
    let itemCountMap = {};
    if (templateIds.length > 0) {
      const [itemCounts] = await db.execute(
        `SELECT template_id, COUNT(*) as cnt FROM inspection_template_items WHERE template_id IN (${templateIds.map(() => '?').join(',')}) GROUP BY template_id`,
        templateIds,
      );
      itemCountMap = itemCounts.reduce((acc, item) => {
        acc[item.template_id] = item.cnt;
        return acc;
      }, {});
    }

    return {
      data: rows.map(r => ({ ...r, item_count: itemCountMap[r.id] || 0 })),
      pagination: {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        total: countResult[0].total,
      },
    };
  }

  /**
   * 获取模板详情（含检查项）
   */
  async getTemplateById(id, tenantId) {
    const [templates] = await db.execute(
      'SELECT * FROM inspection_templates WHERE id = ? AND tenant_id = ?',
      [id, tenantId],
    );
    if (templates.length === 0) return null;

    const [items] = await db.execute(
      'SELECT * FROM inspection_template_items WHERE template_id = ? ORDER BY sort_order ASC, id ASC',
      [id],
    );

    return { ...templates[0], items };
  }

  /**
   * 创建巡检模板（含检查项）
   */
  async createTemplate(data, tenantId, userId) {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      const [result] = await conn.execute(
        `INSERT INTO inspection_templates (
          tenant_id, template_code, template_name, inspection_type,
          applicable_scope, cycle_days, description, status, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          tenantId,
          data.template_code,
          data.template_name,
          data.inspection_type || 'daily',
          data.applicable_scope || null,
          data.cycle_days || 30,
          data.description || null,
          data.status || 'active',
          userId,
        ],
      );

      const templateId = result.insertId;

      // 插入检查项
      if (Array.isArray(data.items) && data.items.length > 0) {
        for (let i = 0; i < data.items.length; i++) {
          const item = data.items[i];
          await conn.execute(
            `INSERT INTO inspection_template_items (
              template_id, tenant_id, item_code, item_name, item_category,
              check_method, check_standard, expected_value, unit, is_required, sort_order, remark
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              templateId,
              tenantId,
              item.item_code || `ITEM-${String(i + 1).padStart(3, '0')}`,
              item.item_name,
              item.item_category || null,
              item.check_method || null,
              item.check_standard || null,
              item.expected_value || null,
              item.unit || null,
              item.is_required !== false,
              item.sort_order || i,
              item.remark || null,
            ],
          );
        }
      }

      await conn.commit();
      logger.info('创建巡检模板成功', { templateId, tenantId });
      return { id: templateId };
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }

  /**
   * 更新巡检模板（含检查项整体替换）
   */
  async updateTemplate(id, data, tenantId) {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      const fields = [];
      const values = [];
      ['template_name', 'inspection_type', 'applicable_scope', 'cycle_days', 'description', 'status'].forEach(key => {
        if (data[key] !== undefined) {
          fields.push(`${key} = ?`);
          values.push(data[key]);
        }
      });

      if (fields.length > 0) {
        values.push(id, tenantId);
        await conn.execute(
          `UPDATE inspection_templates SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ? AND tenant_id = ?`,
          values,
        );
      }

      // 如果提供了 items，则整体替换检查项
      if (Array.isArray(data.items)) {
        await conn.execute('DELETE FROM inspection_template_items WHERE template_id = ?', [id]);
        for (let i = 0; i < data.items.length; i++) {
          const item = data.items[i];
          await conn.execute(
            `INSERT INTO inspection_template_items (
              template_id, tenant_id, item_code, item_name, item_category,
              check_method, check_standard, expected_value, unit, is_required, sort_order, remark
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              id,
              tenantId,
              item.item_code || `ITEM-${String(i + 1).padStart(3, '0')}`,
              item.item_name,
              item.item_category || null,
              item.check_method || null,
              item.check_standard || null,
              item.expected_value || null,
              item.unit || null,
              item.is_required !== false,
              item.sort_order || i,
              item.remark || null,
            ],
          );
        }
      }

      await conn.commit();
      return true;
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }

  /**
   * 删除巡检模板
   */
  async deleteTemplate(id, tenantId) {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      await conn.execute('DELETE FROM inspection_template_items WHERE template_id = ?', [id]);
      const [result] = await conn.execute(
        'DELETE FROM inspection_templates WHERE id = ? AND tenant_id = ?',
        [id, tenantId],
      );
      await conn.commit();
      return result.affectedRows > 0;
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }

  // ============ 巡检任务管理 ============

  /**
   * 获取巡检任务列表
   */
  async getTasks(params) {
    const { tenantId, page = 1, pageSize = 20, status, inspection_type, assignee_id, keyword, start_date, end_date } = params;
    let sql = `
      SELECT t.*, a.asset_name, a.asset_code, it.template_name
      FROM inspection_tasks t
      LEFT JOIN assets a ON t.asset_id = a.id AND a.tenant_id = t.tenant_id
      LEFT JOIN inspection_templates it ON t.template_id = it.id AND it.tenant_id = t.tenant_id
      WHERE t.tenant_id = ?
    `;
    const queryParams = [tenantId];

    if (status) {
      sql += ' AND t.status = ?';
      queryParams.push(status);
    }
    if (inspection_type) {
      sql += ' AND t.inspection_type = ?';
      queryParams.push(inspection_type);
    }
    if (assignee_id) {
      sql += ' AND t.assignee_id = ?';
      queryParams.push(assignee_id);
    }
    if (keyword) {
      sql += ' AND (t.task_name LIKE ? OR t.task_code LIKE ?)';
      queryParams.push(`%${keyword}%`, `%${keyword}%`);
    }
    if (start_date) {
      sql += ' AND t.plan_date >= ?';
      queryParams.push(start_date);
    }
    if (end_date) {
      sql += ' AND t.plan_date <= ?';
      queryParams.push(end_date);
    }

    sql += ' ORDER BY t.plan_date DESC, t.created_at DESC LIMIT ? OFFSET ?';
    queryParams.push(parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize));

    const [rows] = await db.execute(sql, queryParams);

    // 总数
    let countSql = 'SELECT COUNT(*) as total FROM inspection_tasks WHERE tenant_id = ?';
    const countParams = [tenantId];
    if (status) {
      countSql += ' AND status = ?';
      countParams.push(status);
    }
    if (inspection_type) {
      countSql += ' AND inspection_type = ?';
      countParams.push(inspection_type);
    }
    if (assignee_id) {
      countSql += ' AND assignee_id = ?';
      countParams.push(assignee_id);
    }
    if (keyword) {
      countSql += ' AND (task_name LIKE ? OR task_code LIKE ?)';
      countParams.push(`%${keyword}%`, `%${keyword}%`);
    }
    if (start_date) {
      countSql += ' AND plan_date >= ?';
      countParams.push(start_date);
    }
    if (end_date) {
      countSql += ' AND plan_date <= ?';
      countParams.push(end_date);
    }
    const [countResult] = await db.execute(countSql, countParams);

    return {
      data: rows,
      pagination: {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        total: countResult[0].total,
      },
    };
  }

  /**
   * 获取任务详情
   */
  async getTaskById(id, tenantId) {
    const [rows] = await db.execute(
      `SELECT t.*, a.asset_name, a.asset_code, it.template_name
       FROM inspection_tasks t
       LEFT JOIN assets a ON t.asset_id = a.id AND a.tenant_id = t.tenant_id
       LEFT JOIN inspection_templates it ON t.template_id = it.id AND it.tenant_id = t.tenant_id
       WHERE t.id = ? AND t.tenant_id = ?`,
      [id, tenantId],
    );
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * 创建巡检任务
   */
  async createTask(data, tenantId, userId) {
    // 跨租户校验
    if (data.asset_id && !(await assertTenantAsset(data.asset_id, tenantId))) {
      throw new Error('关联资产不存在或不属于当前租户');
    }
    if (data.template_id && !(await assertTenantTemplate(data.template_id, tenantId))) {
      throw new Error('关联模板不存在或不属于当前租户');
    }

    const taskCode = data.task_code || (await generateSequenceCode(tenantId, 'task', 'TASK'));
    const [result] = await db.execute(
      `INSERT INTO inspection_tasks (
        tenant_id, task_code, task_name, template_id, asset_id, inspection_area,
        inspection_type, assignee_id, assignee_name, plan_date, deadline,
        cycle_days, status, priority, remark, auto_generated, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tenantId,
        taskCode,
        data.task_name,
        data.template_id || null,
        data.asset_id || null,
        data.inspection_area || null,
        data.inspection_type || 'daily',
        data.assignee_id || null,
        data.assignee_name || null,
        data.plan_date,
        data.deadline || null,
        data.cycle_days || null,
        data.status || 'pending',
        data.priority || 'medium',
        data.remark || null,
        data.auto_generated ? 1 : 0,
        userId,
      ],
    );
    return { id: result.insertId, task_code: taskCode };
  }

  /**
   * 更新巡检任务
   */
  async updateTask(id, updates, tenantId) {
    const fields = [];
    const values = [];
    [
      'task_name', 'template_id', 'asset_id', 'inspection_area', 'inspection_type',
      'assignee_id', 'assignee_name', 'plan_date', 'deadline', 'cycle_days',
      'status', 'priority', 'remark',
    ].forEach(key => {
      if (updates[key] !== undefined) {
        fields.push(`${key} = ?`);
        values.push(updates[key]);
      }
    });

    if (fields.length === 0) return false;
    values.push(id, tenantId);

    const [result] = await db.execute(
      `UPDATE inspection_tasks SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ? AND tenant_id = ?`,
      values,
    );
    return result.affectedRows > 0;
  }

  /**
   * 删除巡检任务
   */
  async deleteTask(id, tenantId) {
    const [result] = await db.execute(
      'DELETE FROM inspection_tasks WHERE id = ? AND tenant_id = ?',
      [id, tenantId],
    );
    return result.affectedRows > 0;
  }

  /**
   * 获取即将到期的巡检任务
   */
  async getExpiringTasks(tenantId, days = 3) {
    const [rows] = await db.execute(
      `SELECT t.*, a.asset_name, a.asset_code
       FROM inspection_tasks t
       LEFT JOIN assets a ON t.asset_id = a.id AND a.tenant_id = t.tenant_id
       WHERE t.tenant_id = ?
         AND t.status IN ('pending', 'in_progress')
         AND t.plan_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY)
         AND t.plan_date >= CURDATE()
       ORDER BY t.plan_date ASC`,
      [tenantId, days],
    );
    return rows;
  }

  /**
   * 标记逾期任务
   */
  async markOverdueTasks(tenantId) {
    const [result] = await db.execute(
      `UPDATE inspection_tasks
       SET status = 'overdue', updated_at = NOW()
       WHERE tenant_id = ? AND status = 'pending' AND plan_date < CURDATE()`,
      [tenantId],
    );
    return result.affectedRows;
  }

  // ============ 巡检记录单管理 ============

  /**
   * 获取巡检记录单列表
   */
  async getRecords(params) {
    const {
      tenantId, page = 1, pageSize = 20, status, inspection_type,
      overall_result, inspector_id, keyword, start_date, end_date,
    } = params;
    let sql = `
      SELECT r.*, t.task_code, t.task_name, a.asset_name, a.asset_code
      FROM inspection_records r
      LEFT JOIN inspection_tasks t ON r.task_id = t.id AND t.tenant_id = r.tenant_id
      ${ASSET_JOIN}
      WHERE r.tenant_id = ?
    `;
    const queryParams = [tenantId];

    if (status) {
      sql += ' AND r.status = ?';
      queryParams.push(status);
    }
    if (inspection_type) {
      sql += ' AND r.inspection_type = ?';
      queryParams.push(inspection_type);
    }
    if (overall_result) {
      sql += ' AND r.overall_result = ?';
      queryParams.push(overall_result);
    }
    if (inspector_id) {
      sql += ' AND r.inspector_id = ?';
      queryParams.push(inspector_id);
    }
    if (keyword) {
      sql += ' AND (r.record_code LIKE ? OR r.inspection_title LIKE ? OR r.inspector_name LIKE ?)';
      queryParams.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }
    if (start_date) {
      sql += ' AND r.inspection_date >= ?';
      queryParams.push(start_date);
    }
    if (end_date) {
      sql += ' AND r.inspection_date <= ?';
      queryParams.push(end_date);
    }

    sql += ' ORDER BY r.inspection_date DESC, r.created_at DESC LIMIT ? OFFSET ?';
    queryParams.push(parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize));

    const [rows] = await db.execute(sql, queryParams);

    // 总数
    let countSql = 'SELECT COUNT(*) as total FROM inspection_records WHERE tenant_id = ?';
    const countParams = [tenantId];
    if (status) {
      countSql += ' AND status = ?';
      countParams.push(status);
    }
    if (inspection_type) {
      countSql += ' AND inspection_type = ?';
      countParams.push(inspection_type);
    }
    if (overall_result) {
      countSql += ' AND overall_result = ?';
      countParams.push(overall_result);
    }
    if (inspector_id) {
      countSql += ' AND inspector_id = ?';
      countParams.push(inspector_id);
    }
    if (keyword) {
      countSql += ' AND (record_code LIKE ? OR inspection_title LIKE ? OR inspector_name LIKE ?)';
      countParams.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }
    if (start_date) {
      countSql += ' AND inspection_date >= ?';
      countParams.push(start_date);
    }
    if (end_date) {
      countSql += ' AND inspection_date <= ?';
      countParams.push(end_date);
    }
    const [countResult] = await db.execute(countSql, countParams);

    return {
      data: rows,
      pagination: {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        total: countResult[0].total,
      },
    };
  }

  /**
   * 获取巡检记录单详情（含检查项明细和问题）
   */
  async getRecordById(id, tenantId) {
    const [records] = await db.execute(
      `SELECT r.*, t.task_code, t.task_name, a.asset_name, a.asset_code
       FROM inspection_records r
       LEFT JOIN inspection_tasks t ON r.task_id = t.id AND t.tenant_id = r.tenant_id
       ${ASSET_JOIN}
       WHERE r.id = ? AND r.tenant_id = ?`,
      [id, tenantId],
    );
    if (records.length === 0) return null;

    const [items] = await db.execute(
      'SELECT * FROM inspection_record_items WHERE record_id = ? ORDER BY sort_order ASC, id ASC',
      [id],
    );

    const [issues] = await db.execute(
      'SELECT * FROM inspection_issues WHERE record_id = ? ORDER BY created_at ASC',
      [id],
    );

    return { ...records[0], items, issues };
  }

  /**
   * 创建巡检记录单（含检查项明细，自动生成问题）
   */
  async createRecord(data, tenantId, userId) {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      // 跨租户校验
      if (data.asset_id && !(await assertTenantAsset(data.asset_id, tenantId))) {
        throw new Error('关联资产不存在或不属于当前租户');
      }
      if (data.task_id && !(await assertTenantTask(data.task_id, tenantId))) {
        throw new Error('关联任务不存在或不属于当前租户');
      }
      if (data.template_id && !(await assertTenantTemplate(data.template_id, tenantId))) {
        throw new Error('关联模板不存在或不属于当前租户');
      }

      const recordCode = data.record_code || (await generateSequenceCode(tenantId, 'record', 'INS'));

      // 获取资产信息冗余
      let assetName = null;
      let assetCode = null;
      if (data.asset_id) {
        const [assets] = await conn.execute(
          'SELECT asset_name, asset_code FROM assets WHERE id = ? AND tenant_id = ?',
          [data.asset_id, tenantId],
        );
        if (assets.length > 0) {
          assetName = assets[0].asset_name;
          assetCode = assets[0].asset_code;
        }
      }

      // 统计检查项结果
      const items = Array.isArray(data.items) ? data.items : [];
      const totalItems = items.length;
      const normalItems = items.filter(i => i.check_result === 'normal').length;
      const abnormalItems = items.filter(i => i.check_result === 'abnormal').length;

      // 自动判定总体结论
      let overallResult = data.overall_result || 'normal';
      if (!data.overall_result) {
        if (abnormalItems > 0) {
          overallResult = 'abnormal';
        } else if (items.some(i => i.check_result === 'na')) {
          overallResult = 'need_attention';
        }
      }

      const [result] = await conn.execute(
        `INSERT INTO inspection_records (
          tenant_id, record_code, task_id, template_id, route_id, plan_id,
          asset_id, asset_code, asset_name,
          inspection_title, inspection_type, inspection_area, inspection_date, start_time, end_time,
          inspector_id, inspector_name, reviewer_id, reviewer_name,
          total_items, normal_items, abnormal_items, overall_result,
          summary, suggestions, remark, attachments, status, signature_inspector, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          tenantId,
          recordCode,
          data.task_id || null,
          data.template_id || null,
          data.route_id || null,
          data.plan_id || null,
          data.asset_id || null,
          assetCode,
          assetName,
          data.inspection_title,
          data.inspection_type || 'daily',
          data.inspection_area || null,
          data.inspection_date,
          data.start_time || null,
          data.end_time || null,
          data.inspector_id || userId,
          data.inspector_name,
          data.reviewer_id || null,
          data.reviewer_name || null,
          totalItems,
          normalItems,
          abnormalItems,
          overallResult,
          data.summary || null,
          data.suggestions || null,
          data.remark || null,
          data.attachments ? JSON.stringify(data.attachments) : null,
          data.status || 'submitted',
          data.signature_inspector || null,
          userId,
        ],
      );

      const recordId = result.insertId;

      // 插入检查项明细（拿到 insertId 用于关联 issue）
      const insertedItemIds = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const [itemResult] = await conn.execute(
          `INSERT INTO inspection_record_items (
            record_id, tenant_id, template_item_id, item_code, item_name, item_category,
            check_method, check_standard, expected_value,
            check_result, actual_value, unit, problem_desc, risk_level, photo_urls, remark, sort_order
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            recordId,
            tenantId,
            item.template_item_id || null,
            item.item_code || null,
            item.item_name,
            item.item_category || null,
            item.check_method || null,
            item.check_standard || null,
            item.expected_value || null,
            item.check_result || 'normal',
            item.actual_value || null,
            item.unit || null,
            item.problem_desc || null,
            item.risk_level || null,
            item.photo_urls ? JSON.stringify(item.photo_urls) : null,
            item.remark || null,
            item.sort_order || i,
          ],
        );
        insertedItemIds.push(itemResult.insertId);

        // 异常项自动生成问题记录（修复 record_item_id 关联）
        if (item.check_result === 'abnormal') {
          const issueCode = await generateSequenceCode(tenantId, 'issue', 'ISSUE');
          const [issueResult] = await conn.execute(
            `INSERT INTO inspection_issues (
              tenant_id, issue_code, record_id, record_item_id, asset_id, asset_name,
              problem_title, problem_desc, problem_category, risk_level, photo_urls, status, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              tenantId,
              issueCode,
              recordId,
              itemResult.insertId,
              data.asset_id || null,
              assetName,
              item.item_name ? `${item.item_name}-异常` : '巡检异常',
              item.problem_desc || item.actual_value || '巡检发现异常',
              item.item_category || 'other',
              item.risk_level || 'medium',
              item.photo_urls ? JSON.stringify(item.photo_urls) : null,
              'open',
              userId,
            ],
          );
          // 写操作历史
          await logIssueHistory(conn, {
            tenantId,
            issueId: issueResult.insertId,
            action: 'created',
            operatorId: userId,
            toStatus: 'open',
            remark: `由巡检记录单 ${recordCode} 自动生成`,
          });

          // 自动转工单（如果 plan 配置了）
          if (data.plan_id) {
            const [plans] = await conn.execute(
              'SELECT auto_create_workorder FROM inspection_plans WHERE id = ? AND tenant_id = ?',
              [data.plan_id, tenantId],
            );
            if (plans[0]?.auto_create_workorder) {
              // 留 hook 位:工单服务支持后这里调用
              logger.info('异常问题需自动转工单', { issueId: issueResult.insertId, planId: data.plan_id });
            }
          }
        }
      }

      // 如果有关联任务，更新任务状态为已完成，并记录完成时间
      if (data.task_id) {
        await conn.execute(
          `UPDATE inspection_tasks
           SET status = 'completed', completed_at = NOW(), completed_by = ?, updated_at = NOW()
           WHERE id = ? AND tenant_id = ?`,
          [userId, data.task_id, tenantId],
        );
      }

      await conn.commit();
      logger.info('创建巡检记录单成功', { recordId, recordCode, tenantId, abnormalItems });

      // 通知计划责任人（如有）
      if (data.inspector_id && data.inspector_id !== userId && abnormalItems > 0) {
        await createNotification({
          tenantId,
          notifyType: 'record_submitted',
          refId: recordId,
          refCode: recordCode,
          recipientId: data.inspector_id,
          recipientName: data.inspector_name,
          title: `巡检记录单 ${recordCode} 提交`,
          content: `发现 ${abnormalItems} 项异常，请关注整改。`,
        });
      }

      return { id: recordId, record_code: recordCode };
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }

  /**
   * 更新巡检记录单
   */
  async updateRecord(id, updates, tenantId) {
    const fields = [];
    const values = [];
    [
      'inspection_title', 'inspection_type', 'inspection_area', 'inspection_date',
      'start_time', 'end_time', 'inspector_id', 'inspector_name',
      'reviewer_id', 'reviewer_name', 'overall_result', 'summary', 'suggestions',
      'remark', 'attachments', 'status', 'signature_inspector', 'signature_reviewer',
      'reviewed_remark',
    ].forEach(key => {
      if (updates[key] !== undefined) {
        fields.push(`${key} = ?`);
        values.push(
          key === 'attachments' && typeof updates[key] !== 'string'
            ? JSON.stringify(updates[key])
            : updates[key],
        );
      }
    });

    // 复核操作：调用专门的 reviewRecord
    if (updates.review_action === 'review' && updates.reviewer_id) {
      fields.push('reviewed_at = NOW()');
    }

    if (fields.length === 0) return false;
    values.push(id, tenantId);

    const [result] = await db.execute(
      `UPDATE inspection_records SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ? AND tenant_id = ?`,
      values,
    );
    return result.affectedRows > 0;
  }

  /**
   * 删除巡检记录单（级联删除明细和问题）
   */
  async deleteRecord(id, tenantId) {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      await conn.execute('DELETE FROM inspection_record_items WHERE record_id = ?', [id]);
      await conn.execute('DELETE FROM inspection_issues WHERE record_id = ?', [id]);
      const [result] = await conn.execute(
        'DELETE FROM inspection_records WHERE id = ? AND tenant_id = ?',
        [id, tenantId],
      );
      await conn.commit();
      return result.affectedRows > 0;
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }

  // ============ 巡检问题管理 ============

  /**
   * 获取巡检问题列表
   */
  async getIssues(params) {
    const { tenantId, page = 1, pageSize = 20, status, risk_level, record_id, keyword } = params;
    let sql = `
      SELECT i.*, r.record_code, r.inspection_title, a.asset_name, a.asset_code
      FROM inspection_issues i
      LEFT JOIN inspection_records r ON i.record_id = r.id AND r.tenant_id = i.tenant_id
      LEFT JOIN assets a ON i.asset_id = a.id AND a.tenant_id = i.tenant_id
      WHERE i.tenant_id = ?
    `;
    const queryParams = [tenantId];

    if (status) {
      sql += ' AND i.status = ?';
      queryParams.push(status);
    }
    if (risk_level) {
      sql += ' AND i.risk_level = ?';
      queryParams.push(risk_level);
    }
    if (record_id) {
      sql += ' AND i.record_id = ?';
      queryParams.push(record_id);
    }
    if (keyword) {
      sql += ' AND (i.issue_code LIKE ? OR i.problem_title LIKE ?)';
      queryParams.push(`%${keyword}%`, `%${keyword}%`);
    }

    sql += ' ORDER BY i.created_at DESC LIMIT ? OFFSET ?';
    queryParams.push(parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize));

    const [rows] = await db.execute(sql, queryParams);

    let countSql = 'SELECT COUNT(*) as total FROM inspection_issues WHERE tenant_id = ?';
    const countParams = [tenantId];
    if (status) {
      countSql += ' AND status = ?';
      countParams.push(status);
    }
    if (risk_level) {
      countSql += ' AND risk_level = ?';
      countParams.push(risk_level);
    }
    if (record_id) {
      countSql += ' AND record_id = ?';
      countParams.push(record_id);
    }
    if (keyword) {
      countSql += ' AND (issue_code LIKE ? OR problem_title LIKE ?)';
      countParams.push(`%${keyword}%`, `%${keyword}%`);
    }
    const [countResult] = await db.execute(countSql, countParams);

    return {
      data: rows,
      pagination: {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        total: countResult[0].total,
      },
    };
  }

  /**
   * 获取问题详情
   */
  async getIssueById(id, tenantId) {
    const [rows] = await db.execute(
      `SELECT i.*, r.record_code, r.inspection_title, a.asset_name, a.asset_code
       FROM inspection_issues i
       LEFT JOIN inspection_records r ON i.record_id = r.id AND r.tenant_id = i.tenant_id
       LEFT JOIN assets a ON i.asset_id = a.id AND a.tenant_id = i.tenant_id
       WHERE i.id = ? AND i.tenant_id = ?`,
      [id, tenantId],
    );
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * 更新问题（整改跟踪）
   */
  async updateIssue(id, updates, tenantId, operatorInfo = {}) {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      // 读取旧值用于历史
      const [oldRows] = await conn.execute(
        'SELECT id, status, rectification_assignee_id, rectification_assignee_name FROM inspection_issues WHERE id = ? AND tenant_id = ?',
        [id, tenantId],
      );
      if (oldRows.length === 0) {
        await conn.rollback();
        return false;
      }
      const oldIssue = oldRows[0];

      const fields = [];
      const values = [];
      [
        'problem_title', 'problem_desc', 'problem_category', 'risk_level', 'photo_urls',
        'rectification_measures', 'rectification_assignee_id', 'rectification_assignee_name',
        'rectification_deadline', 'status', 'rectification_result',
        'rectification_photo_urls', 'rectification_date',
        'verifier_id', 'verifier_name', 'verify_remark',
      ].forEach(key => {
        if (updates[key] !== undefined) {
          fields.push(`${key} = ?`);
          const val = updates[key];
          values.push(['photo_urls', 'rectification_photo_urls'].includes(key) && typeof val !== 'string'
            ? JSON.stringify(val)
            : val);
        }
      });

      // 验证操作时记录验证时间
      if (updates.status === 'verified' && !fields.find(f => f.startsWith('verified_at'))) {
        fields.push('verified_at = NOW()');
      }

      if (fields.length === 0) {
        await conn.rollback();
        return false;
      }
      values.push(id, tenantId);

      const [result] = await conn.execute(
        `UPDATE inspection_issues SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ? AND tenant_id = ?`,
        values,
      );

      const updated = result.affectedRows > 0;

      // 写操作历史
      if (updated && operatorInfo.userId) {
        const fromStatus = oldIssue.status;
        const toStatus = updates.status || fromStatus;
        if (fromStatus !== toStatus) {
          await logIssueHistory(conn, {
            tenantId,
            issueId: id,
            action: toStatus,
            operatorId: operatorInfo.userId,
            operatorName: operatorInfo.userName,
            fromStatus,
            toStatus,
            remark: updates.verify_remark || updates.rectification_measures || null,
          });
        } else if (updates.rectification_assignee_id && updates.rectification_assignee_id !== oldIssue.rectification_assignee_id) {
          await logIssueHistory(conn, {
            tenantId,
            issueId: id,
            action: 'assigned',
            operatorId: operatorInfo.userId,
            operatorName: operatorInfo.userName,
            toStatus: fromStatus,
            remark: `指派给 ${updates.rectification_assignee_name || updates.rectification_assignee_id}`,
          });
        }
      }

      await conn.commit();
      return updated;
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }

  // ============ 统计分析 ============

  /**
   * 获取巡检统计概览
   */
  async getStatistics(tenantId, params = {}) {
    const { start_date, end_date } = params;
    const dateFilter = start_date && end_date
      ? 'AND inspection_date BETWEEN ? AND ?'
      : '';
    const dateParams = start_date && end_date ? [start_date, end_date] : [];

    // 任务统计
    const [taskStats] = await db.execute(
      `SELECT
        COUNT(*) as total_tasks,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_tasks,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_tasks,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_tasks,
        SUM(CASE WHEN status = 'overdue' THEN 1 ELSE 0 END) as overdue_tasks
       FROM inspection_tasks WHERE tenant_id = ?`,
      [tenantId],
    );

    // 记录单统计
    const [recordStats] = await db.execute(
      `SELECT
        COUNT(*) as total_records,
        SUM(CASE WHEN overall_result = 'normal' THEN 1 ELSE 0 END) as normal_records,
        SUM(CASE WHEN overall_result = 'abnormal' THEN 1 ELSE 0 END) as abnormal_records,
        SUM(CASE WHEN overall_result = 'need_attention' THEN 1 ELSE 0 END) as attention_records
       FROM inspection_records
       WHERE tenant_id = ? ${dateFilter}`,
      dateParams.length > 0 ? [tenantId, ...dateParams] : [tenantId],
    );

    // 问题统计
    const [issueStats] = await db.execute(
      `SELECT
        COUNT(*) as total_issues,
        SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open_issues,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_issues,
        SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved_issues,
        SUM(CASE WHEN status = 'verified' THEN 1 ELSE 0 END) as verified_issues,
        SUM(CASE WHEN risk_level = 'high' THEN 1 ELSE 0 END) as high_risk_issues,
        SUM(CASE WHEN risk_level = 'medium' THEN 1 ELSE 0 END) as medium_risk_issues,
        SUM(CASE WHEN risk_level = 'low' THEN 1 ELSE 0 END) as low_risk_issues
       FROM inspection_issues WHERE tenant_id = ?`,
      [tenantId],
    );

    // 按巡检类型分组统计
    const [typeStats] = await db.execute(
      `SELECT inspection_type, COUNT(*) as count,
        SUM(CASE WHEN overall_result = 'abnormal' THEN 1 ELSE 0 END) as abnormal_count
       FROM inspection_records
       WHERE tenant_id = ? ${dateFilter}
       GROUP BY inspection_type`,
      dateParams.length > 0 ? [tenantId, ...dateParams] : [tenantId],
    );

    // 近30天趋势
    const [trend] = await db.execute(
      `SELECT DATE(inspection_date) as date, COUNT(*) as count,
        SUM(CASE WHEN overall_result = 'abnormal' THEN 1 ELSE 0 END) as abnormal_count
       FROM inspection_records
       WHERE tenant_id = ? AND inspection_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
       GROUP BY DATE(inspection_date) ORDER BY date ASC`,
      [tenantId],
    );

    return {
      tasks: taskStats[0],
      records: recordStats[0],
      issues: issueStats[0],
      by_type: typeStats,
      trend,
    };
  }
}

module.exports = new InspectionService();
