const express = require('express');
const router = express.Router();
const db = require('../config/database');
const logger = require('../config/logger');
const { authenticate, authorize } = require('../middleware/auth');
const { addTenantFilter, getTenantId } = require('../middleware/tenant-filter');
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

const INVENTORY_RECORD_DETAIL_JOIN =
  'LEFT JOIN inventory_details idetail ON ir.id = idetail.inventory_id AND idetail.tenant_id = ir.tenant_id';
const INVENTORY_DETAIL_ASSET_JOIN =
  'LEFT JOIN assets a ON idetail.asset_code = a.asset_code AND a.tenant_id = idetail.tenant_id AND a.is_deleted = 0';
const INVENTORY_DISCREPANCY_RECORD_JOIN =
  'LEFT JOIN inventory_records ir ON id.inventory_id = ir.id AND ir.tenant_id = id.tenant_id';
const INVENTORY_DISCREPANCY_ASSET_JOIN =
  'LEFT JOIN assets a ON id.asset_code = a.asset_code AND a.tenant_id = id.tenant_id AND a.is_deleted = 0';

function logInventoryReportError(message, error, req, context = {}) {
  logger.error(message, {
    error: error?.message || String(error || ''),
    code: error?.code || undefined,
    tenantId: getTenantId(req) || null,
    userId: req?.user?.id || null,
    ...context,
  });
}

const REPORTS_DIR = path.join(__dirname, '../uploads/reports');

function cleanupReportFile(filePath) {
  setTimeout(() => {
    fs.rm(filePath, { force: true }, () => {});
  }, 5000);
}

async function writeReportWorkbook(worksheetData, sheetName, fileNamePrefix) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);
  const headers = worksheetData.length > 0 ? Object.keys(worksheetData[0]) : [];

  if (headers.length > 0) {
    worksheet.columns = headers.map(header => ({
      header,
      key: header,
      width: Math.max(String(header).length + 4, 12),
    }));
    worksheet.addRows(worksheetData);
  }

  const fileName = `${fileNamePrefix}-${Date.now()}.xlsx`;
  const filePath = path.join(REPORTS_DIR, fileName);
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
  await workbook.xlsx.writeFile(filePath);

  return { fileName, filePath };
}

function downloadReport(res, req, filePath, fileName, reportType) {
  res.download(filePath, fileName, (err) => {
    if (err) {
      logInventoryReportError('下载文件失败', err, req, { fileName, reportType });
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: '下载文件失败' });
      }
    }
    cleanupReportFile(filePath);
  });
}

// 列出所有盘点报告
router.get('/', authenticate, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(400).json({ success: false, message: '租户ID缺失' });
    const { page = 1, pageSize = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(pageSize);
    const [rows] = await db.execute(
      `SELECT ir.id, ir.inventory_no, ir.inventory_date, ir.inventory_type, ir.inventory_person, ir.status, ir.created_at
       FROM inventory_records ir
       WHERE ir.tenant_id = ?
       ORDER BY ir.inventory_date DESC
       LIMIT ? OFFSET ?`,
      [tenantId, Number(pageSize), Number(offset)]
    );
    const [countRows] = await db.execute(
      `SELECT COUNT(*) AS total FROM inventory_records WHERE tenant_id = ?`,
      [tenantId]
    );
    res.json({
      success: true,
      data: { list: rows, pagination: { total: countRows[0].total, page: Number(page), pageSize: Number(pageSize) } },
    });
  } catch (e) {
    logInventoryReportError('列出盘点报告失败', e, req);
    res.status(500).json({ success: false, message: '列出盘点报告失败' });
  }
});

// 导出盘点记录报表
router.get('/export/inventory-records', authenticate, authorize('view_all_inventory'), async (req, res) => {
  try {
    const { start_date, end_date, status } = req.query;

    let whereClause = 'WHERE 1=1';
    const params = [];

    // 添加租户过滤
    const tenantFilter = addTenantFilter(req, 'ir');
    whereClause += tenantFilter.whereClause;
    params.push(...tenantFilter.params);

    if (start_date) {
      whereClause += ' AND ir.inventory_date >= ?';
      params.push(start_date);
    }

    if (end_date) {
      whereClause += ' AND ir.inventory_date <= ?';
      params.push(end_date);
    }

    if (status) {
      whereClause += ' AND ir.status = ?';
      params.push(status);
    }

    // 查询盘点记录
    const [records] = await db.execute(
      `SELECT ir.*, 
       COUNT(idetail.id) as detail_count,
       SUM(CASE WHEN idetail.discrepancy_type = '正常' THEN 1 ELSE 0 END) as normal_count,
       SUM(CASE WHEN idetail.discrepancy_type != '正常' THEN 1 ELSE 0 END) as abnormal_count
       FROM inventory_records ir
       ${INVENTORY_RECORD_DETAIL_JOIN}
       ${whereClause}
       GROUP BY ir.id
       ORDER BY ir.inventory_date DESC`,
      params,
    );

    // 准备Excel数据
    const worksheetData = records.map(record => ({
      '盘点单号': record.inventory_no,
      '盘点日期': record.inventory_date,
      '盘点类型': record.inventory_type,
      '盘点人': record.inventory_person,
      '状态': record.status,
      '资产总数': record.detail_count || 0,
      '正常数量': record.normal_count || 0,
      '异常数量': record.abnormal_count || 0,
      '备注': record.remark || '',
      '创建时间': record.created_at,
    }));

    const { fileName, filePath } = await writeReportWorkbook(
      worksheetData,
      '盘点记录',
      'inventory-records',
    );
    downloadReport(res, req, filePath, fileName, 'inventory-records');
  } catch (error) {
    logInventoryReportError('导出盘点记录报表失败', error, req, {
      startDate: req.query?.start_date || null,
      endDate: req.query?.end_date || null,
      status: req.query?.status || null,
    });
    res.status(500).json({ success: false, message: '导出盘点记录报表失败', error: error.message });
  }
});

// 导出盘点明细报表
router.get('/export/inventory-details/:inventory_id', authenticate, authorize('view_all_inventory'), async (req, res) => {
  try {
    const { inventory_id } = req.params;

    // 检查盘点记录是否存在并验证租户
    const tenantFilter = addTenantFilter(req, 'ir');
    const [inventory] = await db.execute(
      `SELECT id, inventory_no FROM inventory_records ir WHERE ir.id = ? ${tenantFilter.whereClause}`,
      [inventory_id, ...tenantFilter.params],
    );

    if (inventory.length === 0) {
      return res.status(404).json({ success: false, message: '盘点记录不存在' });
    }

    const inventoryNo = inventory[0].inventory_no;

    // 查询盘点明细
    const detailTenantFilter = addTenantFilter(req, 'idetail');
    const [details] = await db.execute(
      `SELECT idetail.*, a.asset_name, a.brand, a.model, a.department
       FROM inventory_details idetail
       ${INVENTORY_DETAIL_ASSET_JOIN}
       WHERE idetail.inventory_id = ? ${detailTenantFilter.whereClause}`,
      [inventory_id, ...detailTenantFilter.params],
    );

    // 准备Excel数据
    const worksheetData = details.map(detail => ({
      '资产编码': detail.asset_code,
      '资产名称': detail.asset_name || '',
      '品牌': detail.brand || '',
      '型号': detail.model || '',
      '科室': detail.department || '',
      '期望位置': detail.expected_location || '',
      '实际位置': detail.actual_location || '',
      '期望状态': detail.expected_status || '',
      '实际状态': detail.actual_status || '',
      '差异类型': detail.discrepancy_type || '',
      '差异描述': detail.discrepancy_desc || '',
      '盘点人': detail.checked_by_name || '',
      '盘点时间': detail.checked_at || '',
      '盘点方式': detail.check_method || '',
    }));

    const { fileName, filePath } = await writeReportWorkbook(
      worksheetData,
      '盘点明细',
      `inventory-details-${inventoryNo}`,
    );
    downloadReport(res, req, filePath, fileName, 'inventory-details');
  } catch (error) {
    logInventoryReportError('导出盘点明细报表失败', error, req, {
      inventoryId: req.params.inventory_id,
    });
    res.status(500).json({ success: false, message: '导出盘点明细报表失败', error: error.message });
  }
});

// 导出盘点差异报表
router.get('/export/inventory-discrepancies', authenticate, authorize('view_all_inventory'), async (req, res) => {
  try {
    const { inventory_id, handling_status } = req.query;

    let whereClause = 'WHERE 1=1';
    const params = [];

    // 添加租户过滤
    const tenantFilter = addTenantFilter(req, 'id');
    whereClause += tenantFilter.whereClause;
    params.push(...tenantFilter.params);

    if (inventory_id) {
      whereClause += ' AND id.inventory_id = ?';
      params.push(inventory_id);
    }

    if (handling_status) {
      whereClause += ' AND id.handling_status = ?';
      params.push(handling_status);
    }

    // 查询盘点差异
    const [discrepancies] = await db.execute(
      `SELECT id.*, ir.inventory_no, a.asset_name, a.brand, a.model
       FROM inventory_discrepancies id
       ${INVENTORY_DISCREPANCY_RECORD_JOIN}
       ${INVENTORY_DISCREPANCY_ASSET_JOIN}
       ${whereClause}
       ORDER BY id.created_at DESC`,
      params,
    );

    // 准备Excel数据
    const worksheetData = discrepancies.map(discrepancy => ({
      '盘点单号': discrepancy.inventory_no || '',
      '资产编码': discrepancy.asset_code,
      '资产名称': discrepancy.asset_name || '',
      '品牌': discrepancy.brand || '',
      '型号': discrepancy.model || '',
      '差异类型': discrepancy.discrepancy_type,
      '差异描述': discrepancy.description,
      '期望位置': discrepancy.expected_location || '',
      '实际位置': discrepancy.actual_location || '',
      '期望状态': discrepancy.expected_status || '',
      '实际状态': discrepancy.actual_status || '',
      '处理状态': discrepancy.handling_status,
      '处理方式': discrepancy.handling_method || '',
      '处理人': discrepancy.handler_name || '',
      '处理日期': discrepancy.handling_date || '',
      '处理备注': discrepancy.handling_notes || '',
    }));

    const { fileName, filePath } = await writeReportWorkbook(
      worksheetData,
      '盘点差异',
      'inventory-discrepancies',
    );
    downloadReport(res, req, filePath, fileName, 'inventory-discrepancies');
  } catch (error) {
    logInventoryReportError('导出盘点差异报表失败', error, req, {
      inventoryId: req.query?.inventory_id || null,
      handlingStatus: req.query?.handling_status || null,
    });
    res.status(500).json({ success: false, message: '导出盘点差异报表失败', error: error.message });
  }
});

// 导出盘点任务报表
router.get('/export/inventory-tasks', authenticate, authorize('view_all_inventory'), async (req, res) => {
  try {
    const { inventory_id, status, assignee } = req.query;

    let whereClause = 'WHERE 1=1';
    const params = [];

    // 添加租户过滤
    const tenantFilter = addTenantFilter(req, 'it');
    whereClause += tenantFilter.whereClause;
    params.push(...tenantFilter.params);

    if (inventory_id) {
      whereClause += ' AND it.inventory_id = ?';
      params.push(inventory_id);
    }

    if (status) {
      whereClause += ' AND it.status = ?';
      params.push(status);
    }

    if (assignee) {
      whereClause += ' AND it.assignee = ?';
      params.push(assignee);
    }

    // 查询盘点任务
    const [tasks] = await db.execute(
      `SELECT it.*, ir.inventory_no, ir.inventory_type
       FROM inventory_tasks it
       LEFT JOIN inventory_records ir ON it.inventory_id = ir.id AND ir.tenant_id = it.tenant_id
       ${whereClause}
       ORDER BY it.created_at DESC`,
      params,
    );

    // 准备Excel数据
    const worksheetData = tasks.map(task => ({
      '任务名称': task.task_name,
      '盘点单号': task.inventory_no || '',
      '盘点类型': task.inventory_type || '',
      '负责人': task.assignee_name,
      '科室': task.department_code || '',
      '位置': task.location || '',
      '预计数量': task.estimated_count,
      '实际数量': task.actual_count,
      '状态': task.status,
      '开始时间': task.start_time || '',
      '结束时间': task.end_time || '',
      '创建时间': task.created_at,
    }));

    const { fileName, filePath } = await writeReportWorkbook(
      worksheetData,
      '盘点任务',
      'inventory-tasks',
    );
    downloadReport(res, req, filePath, fileName, 'inventory-tasks');
  } catch (error) {
    logInventoryReportError('导出盘点任务报表失败', error, req, {
      inventoryId: req.query?.inventory_id || null,
      status: req.query?.status || null,
      assignee: req.query?.assignee || null,
    });
    res.status(500).json({ success: false, message: '导出盘点任务报表失败', error: error.message });
  }
});

// 导出盘点计划报表
router.get('/export/inventory-plans', authenticate, authorize('view_all_inventory'), async (req, res) => {
  try {
    const { start_date, end_date, status } = req.query;

    let whereClause = 'WHERE 1=1';
    const params = [];

    // 添加租户过滤
    const tenantFilter = addTenantFilter(req, 'ip');
    whereClause += tenantFilter.whereClause;
    params.push(...tenantFilter.params);

    if (start_date) {
      whereClause += ' AND ip.start_date >= ?';
      params.push(start_date);
    }

    if (end_date) {
      whereClause += ' AND ip.end_date <= ?';
      params.push(end_date);
    }

    if (status) {
      whereClause += ' AND ip.status = ?';
      params.push(status);
    }

    // 查询盘点计划
    const [plans] = await db.execute(
      `SELECT ip.* FROM inventory_plans ip ${whereClause} ORDER BY ip.created_at DESC`,
      params,
    );

    // 准备Excel数据
    const worksheetData = plans.map(plan => ({
      '计划编号': plan.plan_no,
      '计划名称': plan.plan_name,
      '开始日期': plan.start_date || '',
      '结束日期': plan.end_date || '',
      '状态': plan.status,
      '备注': plan.remark || '',
      '创建人': plan.created_by || '',
      '创建时间': plan.created_at,
    }));

    const { fileName, filePath } = await writeReportWorkbook(
      worksheetData,
      '盘点计划',
      'inventory-plans',
    );
    downloadReport(res, req, filePath, fileName, 'inventory-plans');
  } catch (error) {
    logInventoryReportError('导出盘点计划报表失败', error, req, {
      startDate: req.query?.start_date || null,
      endDate: req.query?.end_date || null,
      status: req.query?.status || null,
    });
    res.status(500).json({ success: false, message: '导出盘点计划报表失败', error: error.message });
  }
});

module.exports = router;
