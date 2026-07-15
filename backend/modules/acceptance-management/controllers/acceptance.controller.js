const db = require('../../../config/database');
const { authenticate } = require('../../../middleware/auth');
const { getTenantId } = require('../../../middleware/tenant-filter');
const { TransactionManager } = require('../../../utils/error-handler');
const { checkModuleHealth } = require('../../../core/module-health');
const {
  logger,
  resolveTenantFilter,
  checkDepartmentPermission,
  generateApplicationCode,
  canTransitionApplicationStatus,
  validateTemplateInput,
  validateApplicationInput,
} = require('../utils/helpers');
const acceptanceService = require('../services/acceptance.service');

// ============================================
// 验收申请工作流
// ============================================

// 获取验收申请列表
const getApplications = async (req, res) => {
  try {
    const { page = 1, pageSize = 20, status, priority, keyword, department } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const pageSizeNum = Math.min(200, parseInt(pageSize, 10) || 20);
    const offset = (pageNum - 1) * pageSizeNum;
    const tenantFilter = resolveTenantFilter(req, res);
    if (!tenantFilter) return;

    let filterClause = '';
    const filterParams = [];
    if (status) { filterClause += ' AND status = ?'; filterParams.push(status); }
    if (priority) { filterClause += ' AND priority = ?'; filterParams.push(priority); }
    if (department) { filterClause += ' AND department LIKE ?'; filterParams.push(`%${department}%`); }
    if (keyword) {
      filterClause += ' AND (title LIKE ? OR application_code LIKE ? OR asset_name LIKE ?)';
      filterParams.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }

    const baseWhere = `WHERE is_deleted = 0${tenantFilter.whereClause}${filterClause}`;
    const query = `SELECT * FROM acceptance_applications ${baseWhere} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    const params = [...tenantFilter.params, ...filterParams, pageSizeNum, offset];

    const [records] = await db.execute(query, params);
    const [totalResult] = await db.execute(
      `SELECT COUNT(*) as total FROM acceptance_applications ${baseWhere}`,
      [...tenantFilter.params, ...filterParams]
    );

    res.json({
      success: true,
      data: records,
      pagination: {
        total: totalResult[0]?.total || 0,
        page: pageNum,
        pageSize: pageSizeNum,
        totalPages: Math.ceil((totalResult[0]?.total || 0) / pageSizeNum),
      },
    });
  } catch (error) {
    logger.error('获取验收申请列表失败:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
};

// 获取验收申请详情
const getApplication = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantFilter = resolveTenantFilter(req, res);
    if (!tenantFilter) return;

    const [records] = await db.execute(
      `SELECT * FROM acceptance_applications WHERE id = ? AND is_deleted = 0${tenantFilter.whereClause}`,
      [id, ...tenantFilter.params]
    );
    if (records.length === 0) {
      return res.status(404).json({ success: false, message: '验收申请不存在' });
    }

    const application = records[0];

    // 获取审批记录（仅显示未删除的）
    const [approvals] = await db.execute(
      'SELECT * FROM acceptance_approvals WHERE application_id = ? AND is_deleted = 0 ORDER BY created_at ASC',
      [id]
    );

    res.json({ success: true, data: { ...application, approvals } });
  } catch (error) {
    logger.error('获取验收申请详情失败:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
};

// 创建验收申请
const createApplication = async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(400).json({ success: false, message: '当前用户未分配企业空间' });

    const { title, asset_code, asset_name, supplier, planned_acceptance_date, department, functional_department, priority = '中', description } = req.body;

    const validation = validateApplicationInput({ title, asset_code, priority, description });
    if (!validation.valid) {
      return res.status(400).json({ success: false, message: validation.errors.join('; ') });
    }

    const permission = await checkDepartmentPermission(req, department, functional_department);
    if (!permission.allowed) {
      return res.status(403).json({ success: false, message: permission.message });
    }

    const applicationCode = generateApplicationCode(tenantId);
    const applicantName = req.user.real_name || req.user.username;

    const [result] = await db.execute(
      `INSERT INTO acceptance_applications (tenant_id, application_code, title, asset_code, asset_name, supplier, planned_acceptance_date, applicant_id, applicant_name, department, functional_department, priority, status, description, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '草稿', ?, ?, NOW(), NOW())`,
      [tenantId, applicationCode, title, asset_code || null, asset_name || null, supplier || null,
       planned_acceptance_date || null, req.user.id, applicantName, department || null,
       functional_department || null, priority, description || null, req.user.username]
    );

    // 记录审批流水
    await db.execute(
      `INSERT INTO acceptance_approvals (tenant_id, application_id, approver_name, action, comment, from_status, to_status, created_at)
       VALUES (?, ?, ?, 'submit', '创建申请', NULL, '草稿', NOW())`,
      [tenantId, result.insertId, applicantName]
    );

    res.json({
      success: true,
      message: '验收申请创建成功',
      data: { id: result.insertId, application_code: applicationCode },
    });
  } catch (error) {
    logger.error('创建验收申请失败:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
};

// 更新验收申请（仅草稿状态可编辑）
const updateApplication = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantFilter = resolveTenantFilter(req, res);
    if (!tenantFilter) return;

    const [existing] = await db.execute(
      `SELECT * FROM acceptance_applications WHERE id = ? AND is_deleted = 0${tenantFilter.whereClause}`,
      [id, ...tenantFilter.params]
    );
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: '验收申请不存在' });
    }
    if (existing[0].status !== '草稿') {
      return res.status(400).json({ success: false, message: '只有草稿状态的申请可以编辑' });
    }

    const { title, asset_code, asset_name, supplier, planned_acceptance_date, department, functional_department, priority, description } = req.body;
    const validation = validateApplicationInput({ title, asset_code, priority, description });
    if (!validation.valid) {
      return res.status(400).json({ success: false, message: validation.errors.join('; ') });
    }

    await db.execute(
      `UPDATE acceptance_applications SET title=?, asset_code=?, asset_name=?, supplier=?, planned_acceptance_date=?, department=?, functional_department=?, priority=?, description=?, updated_by=?, updated_at=NOW() WHERE id=?`,
      [title, asset_code || null, asset_name || null, supplier || null, planned_acceptance_date || null,
       department || null, functional_department || null, priority || '中', description || null, req.user.username, id]
    );

    res.json({ success: true, message: '验收申请更新成功' });
  } catch (error) {
    logger.error('更新验收申请失败:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
};

// 提交申请（草稿→待审批）
const submitApplication = async (req, res) => {
  try {
    await transitionApplicationStatus(req, res, 'submit', '待审批', '提交申请');
  } catch (error) {
    logger.error('提交验收申请失败:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
};

// 审批通过
const approveApplication = async (req, res) => {
  try {
    await transitionApplicationStatus(req, res, 'approve', '已批准', '审批通过', true);
  } catch (error) {
    logger.error('审批通过失败:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
};

// 审批拒绝
const rejectApplication = async (req, res) => {
  try {
    await transitionApplicationStatus(req, res, 'reject', '已拒绝', '审批拒绝', true);
  } catch (error) {
    logger.error('审批拒绝失败:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
};

// 撤回申请
const withdrawApplication = async (req, res) => {
  try {
    await transitionApplicationStatus(req, res, 'withdraw', '已撤回', '撤回申请');
  } catch (error) {
    logger.error('撤回验收申请失败:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
};

// 完成申请（已批准→已完成）
const completeApplication = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantFilter = resolveTenantFilter(req, res);
    if (!tenantFilter) return;

    const [existing] = await db.execute(
      `SELECT * FROM acceptance_applications WHERE id = ? AND is_deleted = 0${tenantFilter.whereClause}`,
      [id, ...tenantFilter.params]
    );
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: '验收申请不存在' });
    }
    if (existing[0].status !== '已批准') {
      return res.status(400).json({ success: false, message: '只有已批准的申请可以完成' });
    }

    const { acceptance_record_id, comment } = req.body;
    const approverName = req.user.real_name || req.user.username;

    await db.execute(
      `UPDATE acceptance_applications SET status='已完成', acceptance_record_id=?, approval_comment=?, approved_by=?, approved_at=NOW(), updated_at=NOW() WHERE id=?`,
      [acceptance_record_id || null, comment || null, approverName, id]
    );

    await db.execute(
      `INSERT INTO acceptance_approvals (tenant_id, application_id, approver_name, action, comment, from_status, to_status, created_at) VALUES (?, ?, ?, 'complete', ?, '已批准', '已完成', NOW())`,
      [existing[0].tenant_id, id, approverName, comment || '验收完成']
    );

    res.json({ success: true, message: '验收申请已完成' });
  } catch (error) {
    logger.error('完成验收申请失败:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
};

// 删除申请（仅草稿/已撤回/已拒绝可删，软删 + 级联软删审批记录）
const deleteApplication = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const { id } = req.params;
    const tenantFilter = resolveTenantFilter(req, res);
    if (!tenantFilter) return;

    await connection.beginTransaction();

    const [existing] = await connection.execute(
      `SELECT id, status, tenant_id FROM acceptance_applications WHERE id = ? AND is_deleted = 0${tenantFilter.whereClause}`,
      [id, ...tenantFilter.params],
    );
    if (existing.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: '验收申请不存在' });
    }
    const status = existing[0].status;
    if (status !== '草稿' && status !== '已撤回' && status !== '已拒绝') {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: `仅【草稿/已撤回/已拒绝】状态可删除，当前状态：${status}`,
      });
    }

    const deletedBy = req.user?.username || null;
    const now = new Date();

    // 1) 软删申请主表
    const [result] = await connection.execute(
      `UPDATE acceptance_applications SET is_deleted = 1, deleted_at = ?, deleted_by = ?
       WHERE id = ? AND is_deleted = 0${tenantFilter.whereClause}`,
      [now, deletedBy, id, ...tenantFilter.params],
    );
    if (result.affectedRows === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: '验收申请不存在' });
    }

    // 2) 级联软删审批记录
    await connection.execute(
      `UPDATE acceptance_approvals SET is_deleted = 1, deleted_at = ?, deleted_by = ?
       WHERE application_id = ? AND is_deleted = 0`,
      [now, deletedBy, id],
    );

    await connection.commit();
    res.json({ success: true, message: '验收申请已删除' });
  } catch (error) {
    await connection.rollback();
    logger.error('删除验收申请失败:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  } finally {
    connection.release();
  }
};

// 通用状态转换函数
async function transitionApplicationStatus(req, res, action, toStatus, defaultComment, requireApprover = false) {
  const { id } = req.params;
  const { comment } = req.body || {};
  const tenantFilter = resolveTenantFilter(req, res);
  if (!tenantFilter) return;

  const [existing] = await db.execute(
    `SELECT * FROM acceptance_applications WHERE id = ? AND is_deleted = 0${tenantFilter.whereClause}`,
    [id, ...tenantFilter.params]
  );
  if (existing.length === 0) {
    return res.status(404).json({ success: false, message: '验收申请不存在' });
  }

  const fromStatus = existing[0].status;
  if (!canTransitionApplicationStatus(fromStatus, toStatus)) {
    return res.status(400).json({ success: false, message: `不允许从[${fromStatus}]转换到[${toStatus}]` });
  }

  const approverName = req.user.real_name || req.user.username;
  const updateFields = ['status = ?', 'updated_at = NOW()'];
  const updateParams = [toStatus];
  if (requireApprover) {
    updateFields.push('approval_comment = ?', 'approved_by = ?', 'approved_at = NOW()');
    updateParams.push(comment || defaultComment, approverName);
  }
  updateParams.push(id);

  await db.execute(
    `UPDATE acceptance_applications SET ${updateFields.join(', ')} WHERE id = ?`,
    updateParams
  );

  await db.execute(
    `INSERT INTO acceptance_approvals (tenant_id, application_id, approver_name, action, comment, from_status, to_status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
    [existing[0].tenant_id, id, approverName, action, comment || defaultComment, fromStatus, toStatus]
  );

  res.json({ success: true, message: `${defaultComment}成功` });
}

// ============================================
// 验收模板管理（CRUD）
// ============================================

const getTemplates = async (req, res) => {
  try {
    const tenantFilter = resolveTenantFilter(req, res);
    if (!tenantFilter) return;
    const { grouped = 'true', category } = req.query;

    let query = `SELECT * FROM asset_acceptance_templates WHERE (tenant_id = ? OR tenant_id IS NULL) AND is_deleted = 0`;
    const params = [getTenantId(req)];
    if (category) { query += ' AND category = ?'; params.push(category); }
    query += ' ORDER BY category, sort_order, id';

    const [templates] = await db.execute(query, params);

    if (grouped === 'true') {
      const grouped = {};
      for (const t of templates) {
        if (!grouped[t.category]) grouped[t.category] = [];
        grouped[t.category].push(t);
      }
      return res.json({ success: true, data: grouped });
    }
    res.json({ success: true, data: templates });
  } catch (error) {
    logger.error('获取验收模板失败:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
};

const getTemplateCategories = async (req, res) => {
  try {
    const tenantFilter = resolveTenantFilter(req, res);
    if (!tenantFilter) return;

    const [categories] = await db.execute(
      `SELECT DISTINCT category FROM asset_acceptance_templates WHERE (tenant_id = ? OR tenant_id IS NULL) AND is_deleted = 0 ORDER BY category`,
      [getTenantId(req)]
    );
    res.json({ success: true, data: categories.map(r => r.category) });
  } catch (error) {
    logger.error('获取模板分类失败:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
};

const createTemplate = async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(400).json({ success: false, message: '当前用户未分配企业空间' });

    const { asset_category, template_name, category, item_name, item_description, is_required = 1, sort_order = 0, is_enabled = 1, template_description } = req.body;

    const validation = validateTemplateInput({ category, item_name, item_description });
    if (!validation.valid) {
      return res.status(400).json({ success: false, message: validation.errors.join('; ') });
    }

    const [result] = await db.execute(
      `INSERT INTO asset_acceptance_templates (tenant_id, asset_category, template_name, template_description, category, item_name, item_description, is_required, sort_order, is_enabled)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [tenantId, asset_category || null, template_name || null, template_description || null,
       category, item_name, item_description || null, is_required ? 1 : 0, sort_order || 0, is_enabled ? 1 : 0]
    );

    res.json({ success: true, message: '模板创建成功', data: { id: result.insertId } });
  } catch (error) {
    logger.error('创建验收模板失败:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
};

const updateTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantFilter = resolveTenantFilter(req, res);
    if (!tenantFilter) return;

    const { asset_category, template_name, category, item_name, item_description, is_required, sort_order, is_enabled, template_description } = req.body;
    const validation = validateTemplateInput({ category, item_name, item_description });
    if (!validation.valid) {
      return res.status(400).json({ success: false, message: validation.errors.join('; ') });
    }

    const [result] = await db.execute(
      `UPDATE asset_acceptance_templates SET asset_category=?, template_name=?, template_description=?, category=?, item_name=?, item_description=?, is_required=?, sort_order=?, is_enabled=? WHERE id=? AND (tenant_id = ? OR tenant_id IS NULL)`,
      [asset_category || null, template_name || null, template_description || null,
       category, item_name, item_description || null, is_required ? 1 : 0, sort_order || 0, is_enabled ? 1 : 0,
       id, getTenantId(req)]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: '模板不存在或无权限' });
    }
    res.json({ success: true, message: '模板更新成功' });
  } catch (error) {
    logger.error('更新验收模板失败:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
};

const deleteTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantFilter = resolveTenantFilter(req, res);
    if (!tenantFilter) return;

    const [result] = await db.execute(
      `UPDATE asset_acceptance_templates SET is_deleted = 1, deleted_at = NOW(), deleted_by = ? WHERE id = ? AND tenant_id = ? AND is_deleted = 0`,
      [req.user?.username || null, id, getTenantId(req)]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: '模板不存在或为系统内置模板，无法删除' });
    }
    res.json({ success: true, message: '模板删除成功' });
  } catch (error) {
    logger.error('删除验收模板失败:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
};

// ============================================
// 统计扩展
// ============================================

const getStatisticsOverview = async (req, res) => {
  try {
    const tenantFilter = resolveTenantFilter(req, res);
    if (!tenantFilter) return;
    const { startDate, endDate } = req.query;

    // 验收记录按验收日期范围过滤
    let dateClause = '';
    const dateParams = [];
    if (startDate && endDate) {
      dateClause = ' AND acceptance_date >= ? AND acceptance_date <= ?';
      dateParams.push(startDate, endDate);
    }
    const params = [...tenantFilter.params, ...dateParams];

    // 验收记录统计
    const [totalResult] = await db.execute(
      `SELECT COUNT(*) as total FROM asset_acceptance_records WHERE 1=1${tenantFilter.whereClause}${dateClause}`, params
    );
    const [statusResult] = await db.execute(
      `SELECT status, COUNT(*) as count FROM asset_acceptance_records WHERE 1=1${tenantFilter.whereClause}${dateClause} GROUP BY status`, params
    );
    const [deptResult] = await db.execute(
      `SELECT department, COUNT(*) as count FROM asset_acceptance_records WHERE 1=1${tenantFilter.whereClause}${dateClause} GROUP BY department ORDER BY count DESC LIMIT 10`, params
    );

    // 验收申请统计（按创建日期范围过滤）
    let appDateClause = '';
    const appDateParams = [];
    if (startDate && endDate) {
      appDateClause = ' AND created_at >= ? AND created_at <= ?';
      appDateParams.push(`${startDate} 00:00:00`, `${endDate} 23:59:59`);
    }
    const appParams = [...tenantFilter.params, ...appDateParams];

    const [appTotal] = await db.execute(
      `SELECT COUNT(*) as total FROM acceptance_applications WHERE is_deleted = 0${tenantFilter.whereClause}${appDateClause}`, appParams
    );
    const [appStatus] = await db.execute(
      `SELECT status, COUNT(*) as count FROM acceptance_applications WHERE is_deleted = 0${tenantFilter.whereClause}${appDateClause} GROUP BY status`, appParams
    );

    // 合格率计算
    const passed = statusResult.find(s => s.status === '已验收')?.count || 0;
    const failed = statusResult.find(s => s.status === '验收不合格')?.count || 0;
    const completed = passed + failed;
    const passRate = completed > 0 ? ((passed / completed) * 100).toFixed(1) : '0.0';

    // 模板数量
    const [templateCount] = await db.execute(
      `SELECT COUNT(*) as total FROM asset_acceptance_templates WHERE (tenant_id = ? OR tenant_id IS NULL) AND is_deleted = 0`, [getTenantId(req)]
    );

    res.json({
      success: true,
      data: {
        records: {
          total: totalResult[0].total,
          statusDistribution: statusResult,
          departmentDistribution: deptResult,
        },
        applications: {
          total: appTotal[0].total,
          statusDistribution: appStatus,
        },
        passRate: parseFloat(passRate),
        templateCount: templateCount[0].total,
      },
    });
  } catch (error) {
    logger.error('获取验收统计概览失败:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
};

const getStatisticsTrend = async (req, res) => {
  try {
    const tenantFilter = resolveTenantFilter(req, res);
    if (!tenantFilter) return;
    const { months = 12, startDate, endDate } = req.query;
    const params = [...tenantFilter.params];

    // 优先使用 startDate/endDate 精确区间；否则回退到近 N 个月
    let dateCondition;
    let trendParams;
    if (startDate && endDate) {
      dateCondition = 'AND acceptance_date >= ? AND acceptance_date <= ?';
      trendParams = [...params, startDate, endDate];
    } else {
      dateCondition = 'AND acceptance_date >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)';
      trendParams = [...params, parseInt(months, 10) || 12];
    }

    const [trend] = await db.execute(
      `SELECT DATE_FORMAT(acceptance_date, '%Y-%m') as month,
        COUNT(*) as total,
        SUM(CASE WHEN status = '已验收' THEN 1 ELSE 0 END) as passed,
        SUM(CASE WHEN status = '验收不合格' THEN 1 ELSE 0 END) as failed
       FROM asset_acceptance_records
       WHERE 1=1${tenantFilter.whereClause}
         ${dateCondition}
       GROUP BY DATE_FORMAT(acceptance_date, '%Y-%m')
       ORDER BY month ASC`,
      trendParams
    );

    res.json({ success: true, data: trend });
  } catch (error) {
    logger.error('获取验收趋势失败:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
};

// ============================================
// 验收报告
// ============================================

const getReport = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantFilter = resolveTenantFilter(req, res);
    if (!tenantFilter) return;

    const [records] = await db.execute(
      `SELECT * FROM asset_acceptance_records WHERE id = ?${tenantFilter.whereClause}`,
      [id, ...tenantFilter.params]
    );
    if (records.length === 0) {
      return res.status(404).json({ success: false, message: '验收记录不存在' });
    }

    const record = records[0];

    const [checklist] = await db.execute(
      `SELECT * FROM asset_acceptance_checklist WHERE acceptance_id = ? AND is_deleted = 0 ORDER BY category, sort_order, id`, [id]
    );
    const [files] = await db.execute(
      `SELECT * FROM asset_acceptance_files WHERE acceptance_id = ? AND is_deleted = 0`, [id]
    );
    const [team] = await db.execute(
      `SELECT * FROM acceptance_teams WHERE acceptance_record_id = ? AND is_deleted = 0`, [id]
    );

    // 计算统计
    const total = checklist.length;
    const passed = checklist.filter(c => c.is_passed === 1).length;
    const failed = checklist.filter(c => c.is_passed === 0).length;
    const unchecked = checklist.filter(c => c.is_passed === null).length;

    // 按类别分组
    const byCategory = {};
    for (const c of checklist) {
      if (!byCategory[c.category]) {
        byCategory[c.category] = { total: 0, passed: 0, failed: 0, unchecked: 0 };
      }
      byCategory[c.category].total++;
      if (c.is_passed === 1) byCategory[c.category].passed++;
      else if (c.is_passed === 0) byCategory[c.category].failed++;
      else byCategory[c.category].unchecked++;
    }

    res.json({
      success: true,
      data: {
        record,
        checklist,
        files,
        team,
        summary: {
          total, passed, failed, unchecked,
          passRate: total > 0 ? ((passed / total) * 100).toFixed(1) : '0.0',
          byCategory,
        },
      },
    });
  } catch (error) {
    logger.error('获取验收报告失败:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
};

const generateReport = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantFilter = resolveTenantFilter(req, res);
    if (!tenantFilter) return;

    const [records] = await db.execute(
      `SELECT * FROM asset_acceptance_records WHERE id = ?${tenantFilter.whereClause}`,
      [id, ...tenantFilter.params]
    );
    if (records.length === 0) {
      return res.status(404).json({ success: false, message: '验收记录不存在' });
    }

    const [checklist] = await db.execute(
      `SELECT * FROM asset_acceptance_checklist WHERE acceptance_id = ? AND is_deleted = 0`, [id]
    );
    const passed = checklist.filter(c => c.is_passed === 1).length;
    const failed = checklist.filter(c => c.is_passed === 0).length;
    const unchecked = checklist.filter(c => c.is_passed === null).length;
    const total = checklist.length;
    const passRate = total > 0 ? ((passed / total) * 100).toFixed(1) : '0.0';

    const reportSummary = `验收报告：共${total}项检查，通过${passed}项，不通过${failed}项，未检查${unchecked}项，合格率${passRate}%。`;

    await db.execute(
      `UPDATE asset_acceptance_records SET report_summary = ?, report_generated_at = NOW(), report_generated_by = ? WHERE id = ?`,
      [reportSummary, req.user.real_name || req.user.username, id]
    );

    res.json({
      success: true,
      message: '验收报告生成成功',
      data: { report_summary: reportSummary, pass_rate: parseFloat(passRate) },
    });
  } catch (error) {
    logger.error('生成验收报告失败:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
};

// ============================================
// 提醒管理
// ============================================

const getReminders = async (req, res) => {
  try {
    const tenantFilter = resolveTenantFilter(req, res);
    if (!tenantFilter) return;
    const { page = 1, pageSize = 20, status, reminder_type } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const pageSizeNum = Math.min(200, parseInt(pageSize, 10) || 20);
    const offset = (pageNum - 1) * pageSizeNum;

    let filterClause = '';
    const filterParams = [];
    if (status) { filterClause += ' AND status = ?'; filterParams.push(status); }
    if (reminder_type) { filterClause += ' AND reminder_type = ?'; filterParams.push(reminder_type); }

    const baseWhere = `WHERE 1=1${tenantFilter.whereClause} AND is_deleted = 0${filterClause}`;
    const [records] = await db.execute(
      `SELECT * FROM acceptance_reminders ${baseWhere} ORDER BY remind_date DESC, created_at DESC LIMIT ? OFFSET ?`,
      [...tenantFilter.params, ...filterParams, pageSizeNum, offset]
    );
    const [totalResult] = await db.execute(
      `SELECT COUNT(*) as total FROM acceptance_reminders ${baseWhere}`,
      [...tenantFilter.params, ...filterParams]
    );

    res.json({
      success: true,
      data: records,
      pagination: {
        total: totalResult[0]?.total || 0,
        page: pageNum,
        pageSize: pageSizeNum,
        totalPages: Math.ceil((totalResult[0]?.total || 0) / pageSizeNum),
      },
    });
  } catch (error) {
    logger.error('获取验收提醒失败:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
};

// ============================================
// 验收小组管理（acceptance_teams）
// ============================================

// 获取验收记录的小组成员
const getTeamMembers = async (req, res) => {
  try {
    const { recordId } = req.params;
    const tenantFilter = resolveTenantFilter(req, res);
    if (!tenantFilter) return;

    const record = await acceptanceService.findAcceptanceRecord(parseInt(recordId, 10), tenantFilter);
    if (!record) {
      return res.status(404).json({ success: false, message: '验收记录不存在' });
    }

    const members = await acceptanceService.listTeamMembers(parseInt(recordId, 10), tenantFilter);
    res.json({ success: true, data: members });
  } catch (error) {
    logger.error('获取验收小组成员失败:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
};

// 添加小组成员
const addTeamMember = async (req, res) => {
  try {
    const { recordId } = req.params;
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(400).json({ success: false, message: '当前用户未分配企业空间' });

    const tenantFilter = resolveTenantFilter(req, res);
    if (!tenantFilter) return;

    const record = await acceptanceService.findAcceptanceRecord(parseInt(recordId, 10), tenantFilter);
    if (!record) {
      return res.status(404).json({ success: false, message: '验收记录不存在' });
    }

    const validation = acceptanceService.validateTeamMemberInput(req.body);
    if (!validation.valid) {
      return res.status(400).json({ success: false, message: validation.errors.join('; ') });
    }

    const result = await acceptanceService.addTeamMember(tenantId, parseInt(recordId, 10), req.body);
    res.json({ success: true, message: '成员添加成功', data: { id: result.id } });
  } catch (error) {
    logger.error('添加验收小组成员失败:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
};

// 更新小组成员
const updateTeamMember = async (req, res) => {
  try {
    const { recordId, memberId } = req.params;
    const tenantFilter = resolveTenantFilter(req, res);
    if (!tenantFilter) return;

    const validation = acceptanceService.validateTeamMemberInput(req.body);
    if (!validation.valid) {
      return res.status(400).json({ success: false, message: validation.errors.join('; ') });
    }

    const ok = await acceptanceService.updateTeamMember(
      parseInt(memberId, 10), parseInt(recordId, 10), tenantFilter, req.body,
    );
    if (!ok) {
      return res.status(404).json({ success: false, message: '成员不存在或无权限' });
    }
    res.json({ success: true, message: '成员更新成功' });
  } catch (error) {
    logger.error('更新验收小组成员失败:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
};

// 删除小组成员
const deleteTeamMember = async (req, res) => {
  try {
    const { recordId, memberId } = req.params;
    const tenantFilter = resolveTenantFilter(req, res);
    if (!tenantFilter) return;

    const ok = await acceptanceService.deleteTeamMember(
      parseInt(memberId, 10), parseInt(recordId, 10), tenantFilter, req.user?.username,
    );
    if (!ok) {
      return res.status(404).json({ success: false, message: '成员不存在或无权限' });
    }
    res.json({ success: true, message: '成员删除成功' });
  } catch (error) {
    logger.error('删除验收小组成员失败:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
};

// ============================================
// 验收提醒（写接口）
// ============================================

// 手动创建提醒
const createReminder = async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(400).json({ success: false, message: '当前用户未分配企业空间' });

    const validation = acceptanceService.validateReminderInput(req.body);
    if (!validation.valid) {
      return res.status(400).json({ success: false, message: validation.errors.join('; ') });
    }

    const result = await acceptanceService.createReminder(tenantId, req.body);
    res.json({ success: true, message: '提醒创建成功', data: { id: result.id } });
  } catch (error) {
    logger.error('创建验收提醒失败:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
};

// 更新提醒状态（已读 / 已忽略）
const updateReminderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const tenantFilter = resolveTenantFilter(req, res);
    if (!tenantFilter) return;

    const result = await acceptanceService.updateReminderStatus(parseInt(id, 10), tenantFilter, status);
    if (!result.ok) {
      if (result.reason === 'INVALID_STATUS') {
        return res.status(400).json({ success: false, message: '无效的提醒状态' });
      }
      return res.status(404).json({ success: false, message: '提醒不存在或无权限' });
    }
    res.json({ success: true, message: '提醒状态更新成功' });
  } catch (error) {
    logger.error('更新验收提醒状态失败:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
};

// 删除提醒
const deleteReminder = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantFilter = resolveTenantFilter(req, res);
    if (!tenantFilter) return;

    const ok = await acceptanceService.deleteReminder(parseInt(id, 10), tenantFilter, req.user?.username);
    if (!ok) {
      return res.status(404).json({ success: false, message: '提醒不存在或无权限' });
    }
    res.json({ success: true, message: '提醒删除成功' });
  } catch (error) {
    logger.error('删除验提醒失败:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
};

// 提醒统计
const getReminderStats = async (req, res) => {
  try {
    const tenantFilter = resolveTenantFilter(req, res);
    if (!tenantFilter) return;
    const stats = await acceptanceService.getReminderStats(tenantFilter);
    res.json({ success: true, data: stats });
  } catch (error) {
    logger.error('获取验收提醒统计失败:', error);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  }
};

// 健康检查（真实检测：DB 连接 + 模块表存在性 + 连接池/断路器状态）
const getModuleHealth = async (req, res) => {
  const result = await checkModuleHealth({
    tables: [
      'asset_acceptance_records',
      'asset_acceptance_templates',
      'acceptance_applications',
    ],
    checkDb: true,
  });
  res.status(result.status === 'healthy' ? 200 : 503).json({
    success: result.status === 'healthy',
    data: result,
  });
};

module.exports = {
  getApplications,
  getApplication,
  createApplication,
  updateApplication,
  submitApplication,
  approveApplication,
  rejectApplication,
  withdrawApplication,
  completeApplication,
  deleteApplication,
  getTemplates,
  getTemplateCategories,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  getStatisticsOverview,
  getStatisticsTrend,
  getReport,
  generateReport,
  getReminders,
  getReminderStats,
  getTeamMembers,
  addTeamMember,
  updateTeamMember,
  deleteTeamMember,
  createReminder,
  updateReminderStatus,
  deleteReminder,
  getModuleHealth,
};
