/**
 * 财务管理路由
 * 包含预算管理、收支记录、财务报表三个子模块
 */
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { getTenantId } = require('../middleware/tenant-filter');
const db = require('../config/database');

// ==================== 辅助函数 ====================

const VALID_BUDGET_TYPES = ['equipment_procurement', 'maintenance', 'operation', 'other'];
const VALID_TRANSACTION_TYPES = ['income', 'expense'];

function success(res, data, message = '操作成功') {
  res.json({ success: true, data, message });
}

function fail(res, message = '操作失败', status = 500) {
  res.status(status).json({ success: false, message });
}

function requireFields(body, fields, res) {
  for (const f of fields) {
    if (body[f] === undefined || body[f] === null || body[f] === '') {
      fail(res, `${f} 不能为空`, 400);
      return false;
    }
  }
  return true;
}

// ==================== 预算管理 API ====================

/**
 * @swagger
 * /api/finance/budgets:
 *   get:
 *     summary: 获取预算列表
 *     tags: [财务管理]
 */
router.get('/budgets', authenticate, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const page = parseInt(req.query.page) || 1;
    const pageSize = Math.min(parseInt(req.query.pageSize) || 20, 100);
    const offset = (page - 1) * pageSize;
    const { year, department_name, budget_type, keyword } = req.query;

    let where = 'WHERE tenant_id = ?';
    const params = [tenantId];

    if (year) { where += ' AND year = ?'; params.push(parseInt(year)); }
    if (department_name) { where += ' AND department_name = ?'; params.push(department_name); }
    if (budget_type) { where += ' AND budget_type = ?'; params.push(budget_type); }
    if (keyword) { where += ' AND (department_name LIKE ? OR notes LIKE ?)'; params.push(`%${keyword}%`, `%${keyword}%`); }

    const [countResult] = await db.execute(
      `SELECT COUNT(*) as total FROM financial_budgets ${where}`, params
    );
    const total = countResult[0]?.total || 0;

    const [rows] = await db.execute(
      `SELECT * FROM financial_budgets ${where} ORDER BY year DESC, created_at DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );

    success(res, {
      list: rows,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) }
    });
  } catch (error) {
    console.error('获取预算列表失败:', error);
    fail(res, error.message);
  }
});

router.post('/budgets', authenticate, async (req, res) => {
  if (!requireFields(req.body, ['year', 'department_name', 'budget_type', 'budget_amount'], res)) return;
  try {
    const tenantId = getTenantId(req);
    const { year, department_name, budget_type, budget_amount, actual_amount, notes } = req.body;

    if (!VALID_BUDGET_TYPES.includes(budget_type)) return fail(res, '预算类型不合法', 400);
    if (isNaN(budget_amount) || Number(budget_amount) < 0) return fail(res, '预算金额不合法', 400);

    const [existing] = await db.execute(
      'SELECT id FROM financial_budgets WHERE tenant_id = ? AND year = ? AND department_name = ? AND budget_type = ?',
      [tenantId, year, department_name, budget_type]
    );
    if (existing.length > 0) {
      return fail(res, '该年份该部门该类型的预算已存在', 409);
    }

    const [result] = await db.execute(
      `INSERT INTO financial_budgets (tenant_id, year, department_name, budget_type, budget_amount, actual_amount, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [tenantId, year, department_name, budget_type, budget_amount, actual_amount || 0, notes || '', req.user?.real_name || '']
    );

    success(res, { id: result.insertId }, '创建成功');
  } catch (error) {
    console.error('创建预算失败:', error);
    fail(res, error.message);
  }
});

router.put('/budgets/:id', authenticate, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { id } = req.params;
    if (isNaN(id)) return fail(res, 'ID不合法', 400);

    const [existing] = await db.execute(
      'SELECT id FROM financial_budgets WHERE id = ? AND tenant_id = ?', [id, tenantId]
    );
    if (existing.length === 0) return fail(res, '预算记录不存在', 404);

    const fields = [];
    const values = [];
    const allowedFields = ['budget_amount', 'actual_amount', 'notes'];
    allowedFields.forEach(f => {
      if (req.body[f] !== undefined) {
        fields.push(`${f} = ?`);
        values.push(req.body[f]);
      }
    });

    if (fields.length === 0) return fail(res, '没有可更新的字段', 400);

    values.push(id, tenantId);
    await db.execute(
      `UPDATE financial_budgets SET ${fields.join(', ')} WHERE id = ? AND tenant_id = ?`, values
    );

    success(res, null, '更新成功');
  } catch (error) {
    console.error('更新预算失败:', error);
    fail(res, error.message);
  }
});

router.delete('/budgets/:id', authenticate, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { id } = req.params;
    if (isNaN(id)) return fail(res, 'ID不合法', 400);

    const [result] = await db.execute(
      'DELETE FROM financial_budgets WHERE id = ? AND tenant_id = ?', [id, tenantId]
    );
    if (result.affectedRows === 0) return fail(res, '预算记录不存在', 404);

    success(res, null, '删除成功');
  } catch (error) {
    console.error('删除预算失败:', error);
    fail(res, error.message);
  }
});

router.get('/budgets/summary', authenticate, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { year } = req.query;
    let where = 'WHERE tenant_id = ?';
    const params = [tenantId];
    if (year) { where += ' AND year = ?'; params.push(parseInt(year)); }

    const [byType] = await db.execute(
      `SELECT budget_type, SUM(budget_amount) as total_budget, SUM(actual_amount) as total_actual,
              COUNT(*) as count
       FROM financial_budgets ${where} GROUP BY budget_type`, params
    );

    const [byDept] = await db.execute(
      `SELECT department_name, SUM(budget_amount) as total_budget, SUM(actual_amount) as total_actual,
              COUNT(*) as count
       FROM financial_budgets ${where} GROUP BY department_name ORDER BY total_budget DESC`, params
    );

    success(res, { byType, byDept });
  } catch (error) {
    console.error('预算汇总失败:', error);
    fail(res, error.message);
  }
});

router.get('/budgets/export', authenticate, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { year } = req.query;
    let where = 'WHERE tenant_id = ?';
    const params = [tenantId];
    if (year) { where += ' AND year = ?'; params.push(parseInt(year)); }

    const [rows] = await db.execute(
      `SELECT * FROM financial_budgets ${where} ORDER BY year DESC, department_name`, params
    );

    const headers = ['年份', '部门', '预算类型', '预算金额', '实际金额', '备注', '创建时间'];
    const csvRows = [headers.join(',')];
    const typeLabels = { equipment_procurement: '设备采购', maintenance: '维修维护', operation: '运营', other: '其他' };

    rows.forEach(r => {
      csvRows.push([
        r.year, `"${r.department_name}"`, typeLabels[r.budget_type] || r.budget_type,
        r.budget_amount, r.actual_amount, `"${(r.notes || '').replace(/"/g, '""')}"`,
        r.created_at
      ].join(','));
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=budgets.csv');
    res.send('\uFEFF' + csvRows.join('\n'));
  } catch (error) {
    console.error('导出预算失败:', error);
    fail(res, error.message);
  }
});

// ==================== 收支记录 API ====================

router.get('/transactions', authenticate, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const page = parseInt(req.query.page) || 1;
    const pageSize = Math.min(parseInt(req.query.pageSize) || 20, 100);
    const offset = (page - 1) * pageSize;
    const { transaction_type, category, keyword, start_date, end_date } = req.query;

    let where = 'WHERE tenant_id = ?';
    const params = [tenantId];

    if (transaction_type) { where += ' AND transaction_type = ?'; params.push(transaction_type); }
    if (category) { where += ' AND category = ?'; params.push(category); }
    if (start_date) { where += ' AND transaction_date >= ?'; params.push(start_date); }
    if (end_date) { where += ' AND transaction_date <= ?'; params.push(end_date); }
    if (keyword) { where += ' AND (description LIKE ? OR asset_code LIKE ? OR voucher_no LIKE ?)'; params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`); }

    const [countResult] = await db.execute(
      `SELECT COUNT(*) as total FROM financial_transactions ${where}`, params
    );
    const total = countResult[0]?.total || 0;

    const [rows] = await db.execute(
      `SELECT * FROM financial_transactions ${where} ORDER BY transaction_date DESC, created_at DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );

    success(res, {
      list: rows,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) }
    });
  } catch (error) {
    console.error('获取收支记录失败:', error);
    fail(res, error.message);
  }
});

router.post('/transactions', authenticate, async (req, res) => {
  if (!requireFields(req.body, ['transaction_type', 'category', 'amount', 'transaction_date'], res)) return;
  try {
    const tenantId = getTenantId(req);
    const { transaction_type, category, amount, transaction_date, asset_code, description, voucher_no } = req.body;

    if (!VALID_TRANSACTION_TYPES.includes(transaction_type)) return fail(res, '收支类型不合法', 400);
    if (isNaN(amount) || Number(amount) <= 0) return fail(res, '金额不合法', 400);

    const [result] = await db.execute(
      `INSERT INTO financial_transactions (tenant_id, transaction_type, category, amount, transaction_date, asset_code, description, voucher_no, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [tenantId, transaction_type, category, amount, transaction_date, asset_code || '', description || '', voucher_no || '', req.user?.real_name || '']
    );

    success(res, { id: result.insertId }, '创建成功');
  } catch (error) {
    console.error('创建收支记录失败:', error);
    fail(res, error.message);
  }
});

router.put('/transactions/:id', authenticate, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { id } = req.params;
    if (isNaN(id)) return fail(res, 'ID不合法', 400);

    const [existing] = await db.execute(
      'SELECT id FROM financial_transactions WHERE id = ? AND tenant_id = ?', [id, tenantId]
    );
    if (existing.length === 0) return fail(res, '记录不存在', 404);

    const fields = [];
    const values = [];
    const allowedFields = ['transaction_type', 'category', 'amount', 'transaction_date', 'asset_code', 'description', 'voucher_no'];
    allowedFields.forEach(f => {
      if (req.body[f] !== undefined) {
        fields.push(`${f} = ?`);
        values.push(req.body[f]);
      }
    });

    if (fields.length === 0) return fail(res, '没有可更新的字段', 400);

    values.push(id, tenantId);
    await db.execute(
      `UPDATE financial_transactions SET ${fields.join(', ')} WHERE id = ? AND tenant_id = ?`, values
    );

    success(res, null, '更新成功');
  } catch (error) {
    console.error('更新收支记录失败:', error);
    fail(res, error.message);
  }
});

router.delete('/transactions/:id', authenticate, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { id } = req.params;
    if (isNaN(id)) return fail(res, 'ID不合法', 400);

    const [result] = await db.execute(
      'DELETE FROM financial_transactions WHERE id = ? AND tenant_id = ?', [id, tenantId]
    );
    if (result.affectedRows === 0) return fail(res, '记录不存在', 404);

    success(res, null, '删除成功');
  } catch (error) {
    console.error('删除收支记录失败:', error);
    fail(res, error.message);
  }
});

router.get('/transactions/summary', authenticate, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { year } = req.query;
    let where = 'WHERE tenant_id = ?';
    const params = [tenantId];
    if (year) { where += ' AND YEAR(transaction_date) = ?'; params.push(parseInt(year)); }

    const [byCategory] = await db.execute(
      `SELECT category, transaction_type, SUM(amount) as total_amount, COUNT(*) as count
       FROM financial_transactions ${where} GROUP BY category, transaction_type ORDER BY total_amount DESC`, params
    );

    const [byMonth] = await db.execute(
      `SELECT DATE_FORMAT(transaction_date, '%Y-%m') as month, transaction_type, SUM(amount) as total_amount
       FROM financial_transactions ${where} GROUP BY month, transaction_type ORDER BY month`, params
    );

    const [totals] = await db.execute(
      `SELECT transaction_type, SUM(amount) as total_amount
       FROM financial_transactions ${where} GROUP BY transaction_type`, params
    );

    success(res, { byCategory, byMonth, totals });
  } catch (error) {
    console.error('收支汇总失败:', error);
    fail(res, error.message);
  }
});

router.get('/transactions/export', authenticate, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { start_date, end_date } = req.query;
    let where = 'WHERE tenant_id = ?';
    const params = [tenantId];
    if (start_date) { where += ' AND transaction_date >= ?'; params.push(start_date); }
    if (end_date) { where += ' AND transaction_date <= ?'; params.push(end_date); }

    const [rows] = await db.execute(
      `SELECT * FROM financial_transactions ${where} ORDER BY transaction_date DESC`, params
    );

    const headers = ['日期', '类型', '类别', '金额', '资产编码', '凭证号', '说明', '创建时间'];
    const csvRows = [headers.join(',')];
    const typeLabels = { income: '收入', expense: '支出' };

    rows.forEach(r => {
      csvRows.push([
        r.transaction_date, typeLabels[r.transaction_type] || r.transaction_type,
        r.category, r.amount, r.asset_code || '', r.voucher_no || '',
        `"${(r.description || '').replace(/"/g, '""')}"`, r.created_at
      ].join(','));
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=transactions.csv');
    res.send('\uFEFF' + csvRows.join('\n'));
  } catch (error) {
    console.error('导出收支记录失败:', error);
    fail(res, error.message);
  }
});

// ==================== 财务报表 API ====================

router.get('/reports/overview', authenticate, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { year } = req.query;
    const currentYear = year ? parseInt(year) : new Date().getFullYear();

    const [depreciationByDept] = await db.execute(
      `SELECT 
         COALESCE(department_new, department) as dept_name,
         COUNT(*) as asset_count,
         SUM(CAST(COALESCE(purchase_price, 0) AS DECIMAL(15,2))) as total_value
       FROM assets
       WHERE tenant_id = ? AND status != '已处置'
       GROUP BY COALESCE(department_new, department)
       ORDER BY total_value DESC`,
      [tenantId]
    );

    const [budgetSummary] = await db.execute(
      `SELECT year, budget_type, SUM(budget_amount) as total_budget, SUM(actual_amount) as total_actual
       FROM financial_budgets
       WHERE tenant_id = ? AND year = ?
       GROUP BY year, budget_type`,
      [tenantId, currentYear]
    );

    const [transactionSummary] = await db.execute(
      `SELECT transaction_type, SUM(amount) as total_amount
       FROM financial_transactions
       WHERE tenant_id = ? AND YEAR(transaction_date) = ?
       GROUP BY transaction_type`,
      [tenantId, currentYear]
    );

    const [transactionTrend] = await db.execute(
      `SELECT DATE_FORMAT(transaction_date, '%Y-%m') as month, transaction_type, SUM(amount) as total_amount
       FROM financial_transactions
       WHERE tenant_id = ? AND YEAR(transaction_date) = ?
       GROUP BY month, transaction_type ORDER BY month`,
      [tenantId, currentYear]
    );

    success(res, {
      year: currentYear,
      depreciationByDept,
      budgetSummary,
      transactionSummary,
      transactionTrend,
    });
  } catch (error) {
    console.error('获取财务总览失败:', error);
    fail(res, error.message);
  }
});

module.exports = router;
