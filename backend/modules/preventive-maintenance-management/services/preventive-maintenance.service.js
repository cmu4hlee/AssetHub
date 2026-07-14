/**
 * 预防性维护服务
 */
const db = require('../../../config/database');
const logger = require('../../../config/logger');

class PreventiveMaintenanceService {
  // ==================== 维护计划管理 ====================

  /**
   * 获取维护计划列表
   * @param {Object} params - 查询参数
   * @returns {Promise<Object>} 维护计划列表和分页信息
   */
  async getMaintenancePlans(params) {
    const { page = 1, pageSize = 20, keyword, assetCode, status, tenantId } = params;
    const offset = (page - 1) * pageSize;

    let whereClause = 'WHERE pm.tenant_id = ?';
    const queryParams = [tenantId];

    if (keyword) {
      whereClause += ' AND (pm.plan_name LIKE ? OR pm.description LIKE ?)';
      queryParams.push(`%${keyword}%`, `%${keyword}%`);
    }

    if (assetCode) {
      whereClause += ' AND pm.asset_code = ?';
      queryParams.push(assetCode);
    }

    if (status) {
      whereClause += ' AND pm.status = ?';
      queryParams.push(status);
    }

    const [countRows] = await db.execute(
      `SELECT COUNT(*) as total FROM preventive_maintenance_plans pm ${whereClause}`,
      queryParams,
    );
    const { total } = countRows[0];

    const [rows] = await db.execute(
      `SELECT pm.*, a.asset_name
       FROM preventive_maintenance_plans pm
       LEFT JOIN assets a ON pm.asset_code = a.asset_code AND a.tenant_id = pm.tenant_id
       ${whereClause}
       ORDER BY pm.created_at DESC
       LIMIT ? OFFSET ?`,
      [...queryParams, parseInt(pageSize), offset],
    );

    return {
      data: rows,
      pagination: {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  /**
   * 获取维护计划详情
   * @param {number} id - 计划ID
   * @param {string} tenantId - 租户ID
   * @returns {Promise<Object>} 维护计划详情
   */
  async getMaintenancePlan(id, tenantId) {
    const [rows] = await db.execute(
      `SELECT pm.*, a.asset_name
       FROM preventive_maintenance_plans pm
       LEFT JOIN assets a ON pm.asset_code = a.asset_code AND a.tenant_id = pm.tenant_id
       WHERE pm.id = ? AND pm.tenant_id = ?`,
      [id, tenantId],
    );
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * 创建维护计划
   * @param {Object} planData - 计划数据
   * @param {string} tenantId - 租户ID
   * @returns {Promise<Object>} 创建结果
   */
  async createMaintenancePlan(planData, tenantId) {
    const { plan_name, asset_code, description, cycle_days, start_date, next_due_date, assignee, priority } = planData;

    if (!plan_name || !asset_code) {
      throw new Error('计划名称和资产编码不能为空');
    }

    const [result] = await db.execute(
      `INSERT INTO preventive_maintenance_plans
       (tenant_id, plan_name, asset_code, description, cycle_days, start_date, next_due_date, assignee, priority, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [
        tenantId,
        plan_name,
        asset_code,
        description || null,
        cycle_days || 30,
        start_date || new Date(),
        next_due_date || null,
        assignee || null,
        priority || 'normal',
      ],
    );

    return { id: result.insertId };
  }

  /**
   * 更新维护计划
   * @param {number} id - 计划ID
   * @param {Object} planData - 计划数据
   * @param {string} tenantId - 租户ID
   * @returns {Promise<boolean>} 更新结果
   */
  async updateMaintenancePlan(id, planData, tenantId) {
    const { plan_name, description, cycle_days, start_date, next_due_date, assignee, priority, status } = planData;

    const updateFields = [];
    const updateValues = [];

    if (plan_name !== undefined) {
      updateFields.push('plan_name = ?');
      updateValues.push(plan_name);
    }
    if (description !== undefined) {
      updateFields.push('description = ?');
      updateValues.push(description);
    }
    if (cycle_days !== undefined) {
      updateFields.push('cycle_days = ?');
      updateValues.push(cycle_days);
    }
    if (start_date !== undefined) {
      updateFields.push('start_date = ?');
      updateValues.push(start_date);
    }
    if (next_due_date !== undefined) {
      updateFields.push('next_due_date = ?');
      updateValues.push(next_due_date);
    }
    if (assignee !== undefined) {
      updateFields.push('assignee = ?');
      updateValues.push(assignee);
    }
    if (priority !== undefined) {
      updateFields.push('priority = ?');
      updateValues.push(priority);
    }
    if (status !== undefined) {
      updateFields.push('status = ?');
      updateValues.push(status);
    }

    if (updateFields.length === 0) {
      throw new Error('没有要更新的字段');
    }

    updateFields.push('updated_at = NOW()');
    updateValues.push(id, tenantId);

    const [result] = await db.execute(
      `UPDATE preventive_maintenance_plans SET ${updateFields.join(', ')} WHERE id = ? AND tenant_id = ?`,
      updateValues,
    );

    return result.affectedRows > 0;
  }

  /**
   * 完成维护计划
   * @param {number} id - 计划ID
   * @param {Object} completionData - 完成数据
   * @param {string} tenantId - 租户ID
   * @returns {Promise<boolean>} 完成结果
   */
  async completeMaintenancePlan(id, completionData, tenantId) {
    const { remarks, completed_by } = completionData;

    // 获取当前计划
    const plan = await this.getMaintenancePlan(id, tenantId);
    if (!plan) {
      throw new Error('维护计划不存在');
    }

    // 记录完成历史
    await db.execute(
      `INSERT INTO maintenance_plan_history
       (tenant_id, plan_id, asset_code, completed_at, completed_by, remarks, cycle_days)
       VALUES (?, ?, ?, NOW(), ?, ?, ?)`,
      [tenantId, id, plan.asset_code, completed_by || null, remarks || null, plan.cycle_days],
    );

    // 计算下次到期日期
    const nextDueDate = new Date();
    nextDueDate.setDate(nextDueDate.getDate() + (plan.cycle_days || 30));

    // 更新计划状态
    const [result] = await db.execute(
      `UPDATE preventive_maintenance_plans
       SET status = 'active', last_completed_at = NOW(), next_due_date = ?, updated_at = NOW()
       WHERE id = ? AND tenant_id = ?`,
      [nextDueDate, id, tenantId],
    );

    return result.affectedRows > 0;
  }

  /**
   * 获取维护计划历史
   * @param {number} id - 计划ID
   * @param {string} tenantId - 租户ID
   * @returns {Promise<Array>} 历史记录
   */
  async getMaintenancePlanHistory(id, tenantId) {
    const [rows] = await db.execute(
      `SELECT * FROM maintenance_plan_history
       WHERE plan_id = ? AND tenant_id = ?
       ORDER BY completed_at DESC`,
      [id, tenantId],
    );
    return rows;
  }

  /**
   * 删除维护计划
   * @param {number} id - 计划ID
   * @param {string} tenantId - 租户ID
   * @returns {Promise<boolean>} 删除结果
   */
  async deleteMaintenancePlan(id, tenantId) {
    const [result] = await db.execute(
      'DELETE FROM preventive_maintenance_plans WHERE id = ? AND tenant_id = ?',
      [id, tenantId],
    );
    return result.affectedRows > 0;
  }

  // ==================== 维护模板管理 ====================

  /**
   * 获取维护模板列表
   * @param {Object} params - 查询参数
   * @returns {Promise<Object>} 模板列表
   */
  async getMaintenanceTemplates(params) {
    const { page = 1, pageSize = 20, keyword, tenantId } = params;
    const offset = (page - 1) * pageSize;

    let whereClause = 'WHERE tenant_id = ?';
    const queryParams = [tenantId];

    if (keyword) {
      whereClause += ' AND (name LIKE ? OR code LIKE ?)';
      queryParams.push(`%${keyword}%`, `%${keyword}%`);
    }

    const [countRows] = await db.execute(
      `SELECT COUNT(*) as total FROM maintenance_templates ${whereClause}`,
      queryParams,
    );
    const { total } = countRows[0];

    const [rows] = await db.execute(
      `SELECT * FROM maintenance_templates ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...queryParams, parseInt(pageSize), offset],
    );

    return {
      data: rows,
      pagination: {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  /**
   * 创建维护模板
   * @param {Object} templateData - 模板数据
   * @param {string} tenantId - 租户ID
   * @returns {Promise<Object>} 创建结果
   */
  async createMaintenanceTemplate(templateData, tenantId) {
    const { name, code, description, items } = templateData;

    if (!name || !code) {
      throw new Error('模板名称和编码不能为空');
    }

    const [result] = await db.execute(
      `INSERT INTO maintenance_templates (tenant_id, name, code, description)
       VALUES (?, ?, ?, ?)`,
      [tenantId, name, code, description || null],
    );

    const templateId = result.insertId;

    // 添加模板项
    if (items && Array.isArray(items)) {
      for (const item of items) {
        await db.execute(
          `INSERT INTO maintenance_template_items (template_id, tenant_id, item_name, description, sort_order)
           VALUES (?, ?, ?, ?, ?)`,
          [templateId, tenantId, item.item_name, item.description || null, item.sort_order || 0],
        );
      }
    }

    return { id: templateId };
  }

  /**
   * 更新维护模板
   * @param {number} id - 模板ID
   * @param {Object} templateData - 模板数据
   * @param {string} tenantId - 租户ID
   * @returns {Promise<boolean>} 更新结果
   */
  async updateMaintenanceTemplate(id, templateData, tenantId) {
    const { name, description } = templateData;

    const updateFields = [];
    const updateValues = [];

    if (name !== undefined) {
      updateFields.push('name = ?');
      updateValues.push(name);
    }
    if (description !== undefined) {
      updateFields.push('description = ?');
      updateValues.push(description);
    }

    if (updateFields.length === 0) {
      throw new Error('没有要更新的字段');
    }

    updateFields.push('updated_at = NOW()');
    updateValues.push(id, tenantId);

    const [result] = await db.execute(
      `UPDATE maintenance_templates SET ${updateFields.join(', ')} WHERE id = ? AND tenant_id = ?`,
      updateValues,
    );

    return result.affectedRows > 0;
  }

  /**
   * 删除维护模板
   * @param {number} id - 模板ID
   * @param {string} tenantId - 租户ID
   * @returns {Promise<boolean>} 删除结果
   */
  async deleteMaintenanceTemplate(id, tenantId) {
    // 先删除模板项
    await db.execute('DELETE FROM maintenance_template_items WHERE template_id = ? AND tenant_id = ?', [
      id,
      tenantId,
    ]);

    const [result] = await db.execute('DELETE FROM maintenance_templates WHERE id = ? AND tenant_id = ?', [
      id,
      tenantId,
    ]);
    return result.affectedRows > 0;
  }

  // ==================== 维护提醒管理 ====================

  /**
   * 获取维护提醒列表
   * @param {Object} params - 查询参数
   * @returns {Promise<Object>} 提醒列表
   */
  async getMaintenanceReminders(params) {
    const { page = 1, pageSize = 20, tenantId } = params;
    const offset = (page - 1) * pageSize;

    const [countRows] = await db.execute(
      'SELECT COUNT(*) as total FROM maintenance_reminders WHERE tenant_id = ?',
      [tenantId],
    );
    const { total } = countRows[0];

    const [rows] = await db.execute(
      `SELECT mr.*, pm.plan_name
       FROM maintenance_reminders mr
       LEFT JOIN preventive_maintenance_plans pm ON mr.plan_id = pm.id AND pm.tenant_id = mr.tenant_id
       WHERE mr.tenant_id = ?
       ORDER BY mr.created_at DESC
       LIMIT ? OFFSET ?`,
      [tenantId, parseInt(pageSize), offset],
    );

    return {
      data: rows,
      pagination: {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  /**
   * 发送维护提醒
   * @param {Object} reminderData - 提醒数据
   * @param {string} tenantId - 租户ID
   * @returns {Promise<Object>} 发送结果
   */
  async sendMaintenanceReminder(reminderData, tenantId) {
    const { plan_id, recipient, message } = reminderData;

    if (!plan_id) {
      throw new Error('计划ID不能为空');
    }

    const [result] = await db.execute(
      `INSERT INTO maintenance_reminders (tenant_id, plan_id, recipient, message, status, sent_at)
       VALUES (?, ?, ?, ?, 'sent', NOW())`,
      [tenantId, plan_id, recipient || null, message || null],
    );

    return { id: result.insertId };
  }

  /**
   * 配置维护提醒
   * @param {number} id - 提醒ID
   * @param {Object} configData - 配置数据
   * @param {string} tenantId - 租户ID
   * @returns {Promise<boolean>} 配置结果
   */
  async configMaintenanceReminder(id, configData, tenantId) {
    const { enabled, advance_days, notification_method } = configData;

    const updateFields = [];
    const updateValues = [];

    if (enabled !== undefined) {
      updateFields.push('enabled = ?');
      updateValues.push(enabled);
    }
    if (advance_days !== undefined) {
      updateFields.push('advance_days = ?');
      updateValues.push(advance_days);
    }
    if (notification_method !== undefined) {
      updateFields.push('notification_method = ?');
      updateValues.push(notification_method);
    }

    if (updateFields.length === 0) {
      throw new Error('没有要更新的字段');
    }

    updateFields.push('updated_at = NOW()');
    updateValues.push(id, tenantId);

    const [result] = await db.execute(
      `UPDATE maintenance_reminders SET ${updateFields.join(', ')} WHERE id = ? AND tenant_id = ?`,
      updateValues,
    );

    return result.affectedRows > 0;
  }

  // ==================== 维护效率分析 ====================

  /**
   * 获取效率概览
   * @param {Object} params - 查询参数
   * @param {string} tenantId - 租户ID
   * @returns {Promise<Object>} 效率统计数据
   */
  async getEfficiencyOverview(params, tenantId) {
    const { startDate, endDate } = params;

    let whereClause = 'WHERE tenant_id = ?';
    const queryParams = [tenantId];

    if (startDate) {
      whereClause += ' AND completed_at >= ?';
      queryParams.push(startDate);
    }

    if (endDate) {
      whereClause += ' AND completed_at <= ?';
      queryParams.push(endDate);
    }

    const [rows] = await db.execute(
      `SELECT
        COUNT(*) as total_completions,
        AVG(TIMESTAMPDIFF(HOUR, completed_at, DATE_ADD(completed_at, INTERVAL COALESCE(cycle_days, 30) DAY))) as avg_interval_hours,
        COUNT(DISTINCT plan_id) as unique_plans
       FROM maintenance_plan_history ${whereClause}`,
      queryParams,
    );

    return rows[0];
  }
}

module.exports = new PreventiveMaintenanceService();
