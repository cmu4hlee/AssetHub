/**
 * 资产导入导出路由模块
 */

const fs = require('fs');
const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs');
const db = require('../../config/database');
const { authenticate, authorize } = require('../../middleware/auth');

// 资产变更权限集合（与 asset.mutation.js / 前端 useCan('asset', ...) 对齐）
const ASSET_WRITE_ROLES = ['asset.add', 'asset.edit_all', 'asset.edit_own_department'];
const { requireTenantId, getTenantId } = require('../../middleware/tenant-filter');
const { fileSecurity } = require('../../middleware/fileSecurity');
const logger = require('../../config/logger');
const multer = require('multer');
const { normalizeAssetCreatePayload } = require('../../utils/asset-create-validation');
const { resolveDepartmentMeta } = require('../../utils/common');

const upload = multer({ storage: multer.memoryStorage() });

// 导入模板字段定义
const IMPORT_TEMPLATE_FIELDS = [
  { field: 'asset_code', label: '资产编码', required: true, type: 'string', maxLength: 50 },
  { field: 'asset_name', label: '资产名称', required: true, type: 'string', maxLength: 200 },
  { field: 'category_name', label: '资产分类', required: true, type: 'string' },
  { field: 'brand', label: '品牌', required: false, type: 'string', maxLength: 100 },
  { field: 'model', label: '型号', required: false, type: 'string', maxLength: 100 },
  { field: 'serial_number', label: '序列号', required: false, type: 'string', maxLength: 100 },
  { field: 'purchase_date', label: '购置日期', required: true, type: 'date', format: 'YYYY-MM-DD' },
  { field: 'purchase_price', label: '购置价格', required: true, type: 'number', min: 0 },
  { field: 'current_value', label: '当前价值', required: false, type: 'number', min: 0 },
  { field: 'depreciation_years', label: '折旧年限', required: false, type: 'integer', default: 5 },
  { field: 'location', label: '存放位置', required: false, type: 'string', maxLength: 255 },
  { field: 'department_name', label: '使用部门', required: false, type: 'string' },
  { field: 'responsible_person_name', label: '责任人', required: false, type: 'string' },
  {
    field: 'status',
    label: '状态',
    required: false,
    type: 'enum',
    values: ['在用', '闲置', '维修', '报废'],
    default: '在用',
  },
  { field: 'supplier', label: '供应商', required: false, type: 'string', maxLength: 100 },
  { field: 'warranty_period', label: '保修期(月)', required: false, type: 'integer', min: 0 },
  { field: 'remark', label: '备注', required: false, type: 'string', maxLength: 1000 },
];

const IMPORT_REQUIRED_HEADERS = ['asset_code', 'asset_name'];
const LABEL_TO_FIELD = new Map(IMPORT_TEMPLATE_FIELDS.map(item => [item.label, item.field]));
const FORMULA_PREFIX_REGEX = /^[=+\-@]/;

const normalizeImportCellValue = value => {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string') {
    const normalized = value.trim();
    return normalized || null;
  }
  return value;
};

const normalizeImportHeader = rawHeader => {
  const header = String(rawHeader || '').trim();
  if (!header) return '';
  if (LABEL_TO_FIELD.has(header)) {
    return LABEL_TO_FIELD.get(header);
  }

  // 兼容“资产编码(必填)”一类标题
  const stripped = header.replace(/\s*\([^)]*\)\s*$/, '').trim();
  if (LABEL_TO_FIELD.has(stripped)) {
    return LABEL_TO_FIELD.get(stripped);
  }

  return header;
};

const normalizeWorkbookCellValue = value => {
  if (value === undefined || value === null) return null;
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === 'object') {
    if (Object.prototype.hasOwnProperty.call(value, 'result')) {
      return normalizeWorkbookCellValue(value.result);
    }
    if (Object.prototype.hasOwnProperty.call(value, 'text')) {
      return normalizeWorkbookCellValue(value.text);
    }
    if (Array.isArray(value.richText)) {
      return value.richText.map(item => item.text || '').join('');
    }
    if (Object.prototype.hasOwnProperty.call(value, 'hyperlink')) {
      return normalizeWorkbookCellValue(value.text || value.hyperlink);
    }
    return String(value);
  }
  return value;
};

const sanitizeExportCellValue = value => {
  if (value === undefined || value === null) {
    return '';
  }
  if (typeof value === 'string' && FORMULA_PREFIX_REGEX.test(value)) {
    return `'${value}`;
  }
  return value;
};

const addAoaWorksheet = (workbook, sheetName, rows, columnWidths = []) => {
  const worksheet = workbook.addWorksheet(sheetName);
  rows.forEach(row => {
    worksheet.addRow((row || []).map(sanitizeExportCellValue));
  });
  columnWidths.forEach((width, index) => {
    worksheet.getColumn(index + 1).width = width;
  });
  return worksheet;
};

async function parseImportRowsFromBuffer(fileBuffer) {
  if (!fileBuffer || !Buffer.isBuffer(fileBuffer)) {
    throw new Error('上传文件无效，无法读取文件数据');
  }

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(fileBuffer);
  } catch (error) {
    throw new Error('Excel文件格式不正确，无法解析');
  }

  if (!workbook.worksheets || workbook.worksheets.length === 0) {
    throw new Error('Excel文件格式不正确，没有工作表');
  }

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error('Excel文件格式不正确，工作表不存在');
  }

  const data = [];
  const columnCount = Math.max(worksheet.columnCount, 1);
  worksheet.eachRow({ includeEmpty: true }, row => {
    const values = [];
    for (let columnIndex = 1; columnIndex <= columnCount; columnIndex++) {
      values.push(normalizeWorkbookCellValue(row.getCell(columnIndex).value));
    }
    data.push(values);
  });

  if (!Array.isArray(data) || data.length < 3) {
    throw new Error('Excel文件格式不正确，至少需要包含表头和一行数据');
  }

  const headers = (data[0] || []).map(normalizeImportHeader).filter(Boolean);
  if (headers.length === 0) {
    throw new Error('Excel文件格式不正确，表头不存在');
  }

  for (const header of IMPORT_REQUIRED_HEADERS) {
    if (!headers.includes(header)) {
      throw new Error(`Excel文件缺少必要字段: ${header}`);
    }
  }

  if (!headers.includes('category_id') && !headers.includes('category_name')) {
    throw new Error('Excel文件缺少必要字段: category_id');
  }

  const rows = [];
  const sourceRows = data.slice(2);
  for (let rowIndex = 0; rowIndex < sourceRows.length; rowIndex++) {
    const row = sourceRows[rowIndex] || [];
    const rowData = {};
    let hasValue = false;

    for (let i = 0; i < headers.length; i++) {
      const header = headers[i];
      const value = normalizeImportCellValue(row[i]);
      rowData[header] = value;
      if (value !== null) {
        hasValue = true;
      }
    }

    if (!hasValue) {
      continue;
    }

    rows.push({
      rowNumber: rowIndex + 3,
      rowData,
    });
  }

  if (rows.length === 0) {
    throw new Error('Excel文件格式不正确，没有数据行');
  }

  return { headers, rows };
}

const normalizeAssetCodeKey = value =>
  String(value || '')
    .trim()
    .toLowerCase();

async function preValidateImportRows(executor, req, rows) {
  const tenantId = getTenantId(req);
  const isAdmin = req.user.role === 'super_admin' || req.user.role === 'system_admin';
  const managedDepartments = Array.isArray(req.user.managed_departments)
    ? req.user.managed_departments.map(item => String(item))
    : [];

  const seenAssetCodes = new Set();
  const validRows = [];
  const failedRows = [];

  for (const rowItem of rows) {
    const rowData = { ...(rowItem.rowData || {}) };

    try {
      // 支持 category_name 导入
      if ((!rowData.category_id || String(rowData.category_id).trim() === '') && rowData.category_name) {
        const [categoryRows] = await executor.execute(
          'SELECT id FROM asset_categories WHERE name = ? AND tenant_id = ? LIMIT 1',
          [String(rowData.category_name).trim(), tenantId],
        );
        if (Array.isArray(categoryRows) && categoryRows.length > 0) {
          rowData.category_id = categoryRows[0].id;
        }
      }

      // 支持 department_name 导入
      if (!rowData.department_new && rowData.department_name) {
        rowData.department_new = rowData.department_name;
      }

      const normalizedPayload = normalizeAssetCreatePayload(rowData);
      const normalizedAssetCode = normalizeAssetCodeKey(normalizedPayload.asset_code);

      if (seenAssetCodes.has(normalizedAssetCode)) {
        throw new Error('文件内资产编号重复');
      }
      seenAssetCodes.add(normalizedAssetCode);

      const [existing] = await executor.execute(
        'SELECT id FROM assets WHERE LOWER(TRIM(asset_code)) = LOWER(?) AND tenant_id = ? LIMIT 1',
        [normalizedPayload.asset_code, tenantId],
      );
      if (existing.length > 0) {
        throw new Error('资产编号已存在');
      }

      const [categoryCheck] = await executor.execute(
        'SELECT id, parent_id FROM asset_categories WHERE id = ? AND tenant_id = ?',
        [normalizedPayload.category_id, tenantId],
      );
      if (categoryCheck.length === 0) {
        throw new Error('分类不存在');
      }
      if (categoryCheck[0].parent_id === 0) {
        throw new Error('大分类必须选择一级分类');
      }

      if (normalizedPayload.category_secondary_id) {
        const [secondaryCategoryCheck] = await executor.execute(
          'SELECT id, parent_id FROM asset_categories WHERE id = ? AND tenant_id = ?',
          [normalizedPayload.category_secondary_id, tenantId],
        );
        if (secondaryCategoryCheck.length === 0 || secondaryCategoryCheck[0].parent_id === 0) {
          throw new Error('二级分类必须选择有效的子分类');
        }
        if (String(secondaryCategoryCheck[0].parent_id) !== String(normalizedPayload.category_id)) {
          throw new Error('二级分类必须属于所选一级分类');
        }
      }

      const inputDepartmentValue =
        normalizedPayload.department_new || normalizedPayload.department || rowData.department_name;
      const departmentMeta = await resolveDepartmentMeta(executor, tenantId, inputDepartmentValue);

      if (inputDepartmentValue && !departmentMeta) {
        throw new Error('资产科室信息无效');
      }

      if (!isAdmin) {
        if (managedDepartments.length === 0) {
          throw new Error('用户未分配管理科室');
        }
        if (!departmentMeta) {
          throw new Error('资产科室信息无效');
        }
        if (!managedDepartments.includes(String(departmentMeta.department_code))) {
          throw new Error('只能导入属于自己管理科室的资产');
        }
      }

      validRows.push({
        rowNumber: rowItem.rowNumber,
        rowData: rowItem.rowData,
        normalizedData: {
          ...normalizedPayload,
          department: departmentMeta?.department_name || normalizedPayload.department,
          department_new: departmentMeta?.department_code || normalizedPayload.department_new,
          created_by:
            normalizedPayload.created_by || req.user.real_name || req.user.username || '系统管理员',
        },
      });
    } catch (error) {
      failedRows.push({
        rowNumber: rowItem.rowNumber,
        error: error.message,
        rowData: rowItem.rowData,
      });
    }
  }

  return { validRows, failedRows };
}

function pickUploadedFile(req) {
  if (req.file) {
    return req.file;
  }

  if (req.files && typeof req.files === 'object') {
    const files = Object.values(req.files).flat();
    if (files.length > 0) {
      return files[0];
    }
  }

  return null;
}

function resolveUploadedFileBuffer(uploadedFile) {
  if (!uploadedFile) {
    return null;
  }

  if (Buffer.isBuffer(uploadedFile.data)) {
    return uploadedFile.data;
  }
  if (Buffer.isBuffer(uploadedFile.buffer)) {
    return uploadedFile.buffer;
  }
  if (uploadedFile.buffer instanceof Uint8Array) {
    return Buffer.from(uploadedFile.buffer);
  }
  if (typeof uploadedFile.tempFilePath === 'string' && uploadedFile.tempFilePath) {
    try {
      return fs.readFileSync(uploadedFile.tempFilePath);
    } catch (error) {
      return null;
    }
  }

  return null;
}

const resolveAssetPersistError = (error, fallbackMessage = '入库失败') => {
  if (error?.code === 'ER_DUP_ENTRY' || error?.errno === 1062 || error?.message === '资产编号已存在') {
    return {
      conflict: true,
      statusCode: 400,
      message: '资产编号已存在',
    };
  }

  return {
    conflict: false,
    statusCode: 500,
    message: error?.message || fallbackMessage,
  };
};

async function withImportTransaction(callback) {
  if (typeof db.transaction === 'function') {
    return db.transaction(callback);
  }

  const connection = await db.getConnection();
  const canBegin = typeof connection.beginTransaction === 'function';
  const canCommit = typeof connection.commit === 'function';
  const canRollback = typeof connection.rollback === 'function';

  try {
    if (canBegin) {
      await connection.beginTransaction();
    }
    const result = await callback(connection);
    if (canCommit) {
      await connection.commit();
    }
    return result;
  } catch (error) {
    if (canRollback) {
      await connection.rollback();
    }
    throw error;
  } finally {
    if (typeof connection.release === 'function') {
      connection.release();
    }
  }
}

async function insertAsset(connection, tenantId, data) {
  const [existing] = await connection.execute(
    'SELECT id FROM assets WHERE tenant_id = ? AND LOWER(TRIM(asset_code)) = LOWER(?) LIMIT 1',
    [tenantId, data.asset_code],
  );
  if (existing.length > 0) {
    throw new Error('资产编号已存在');
  }

  const [result] = await connection.execute(
    `INSERT INTO assets (
      tenant_id,
      asset_code,
      asset_name,
      category_id,
      category_secondary_id,
      brand,
      model,
      serial_number,
      purchase_date,
      purchase_price,
      current_value,
      depreciation_years,
      depreciation_method,
      location,
      department,
      department_new,
      responsible_person,
      status,
      supplier,
      warranty_period,
      remark,
      created_by,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      tenantId,
      data.asset_code,
      data.asset_name,
      data.category_id,
      data.category_secondary_id || null,
      data.brand || null,
      data.model || null,
      data.serial_number || null,
      data.purchase_date || null,
      data.purchase_price || 0,
      data.current_value ?? data.purchase_price ?? 0,
      data.depreciation_years ?? 5,
      data.depreciation_method || null,
      data.location || null,
      data.department || null,
      data.department_new || null,
      data.responsible_person || null,
      data.status || '在用',
      data.supplier || null,
      data.warranty_period || null,
      data.remark || null,
      data.created_by || null,
    ],
  );

  return result;
}

async function validateImportHandler(req, res) {
  try {
    const uploadedFile = pickUploadedFile(req);
    if (!uploadedFile) {
      return res.status(400).json({ success: false, message: '请选择要上传的Excel文件' });
    }

    const fileBuffer = resolveUploadedFileBuffer(uploadedFile);
    const { headers, rows } = await parseImportRowsFromBuffer(fileBuffer);
    const { validRows, failedRows } = await preValidateImportRows(db, req, rows);

    return res.json({
      success: true,
      message: `预校验完成，可导入 ${validRows.length} 条，异常 ${failedRows.length} 条`,
      totalRows: rows.length,
      validCount: validRows.length,
      invalidCount: failedRows.length,
      headers,
      failedRows,
      errorMessages: failedRows.map(item => `行 ${item.rowNumber}: ${item.error}`),
      data: {
        total: rows.length,
        valid: validRows.length,
        invalid: failedRows.length,
        errors: failedRows,
        preview: validRows.slice(0, 5).map(item => item.rowData),
      },
    });
  } catch (error) {
    logger.error('资产导入预校验失败:', error.message);
    return res.status(400).json({
      success: false,
      message: error.message || '资产导入预校验失败',
    });
  }
}

async function importHandler(req, res) {
  try {
    const uploadedFile = pickUploadedFile(req);
    if (!uploadedFile) {
      return res.status(400).json({ success: false, message: '请选择要上传的Excel文件' });
    }

    const fileBuffer = resolveUploadedFileBuffer(uploadedFile);
    const { headers, rows } = await parseImportRowsFromBuffer(fileBuffer);
    const { validRows, failedRows } = await preValidateImportRows(db, req, rows);

    const tenantId = getTenantId(req);
    let successCount = 0;
    const persistedFailedRows = [...failedRows];

    if (validRows.length > 0) {
      await withImportTransaction(async connection => {
        for (const item of validRows) {
          try {
            await insertAsset(connection, tenantId, item.normalizedData);
            successCount += 1;
          } catch (error) {
            const persistError = resolveAssetPersistError(error);
            persistedFailedRows.push({
              rowNumber: item.rowNumber,
              error: persistError.message || '入库失败',
              rowData: item.rowData,
            });
          }
        }
      });
    }

    const failedCount = persistedFailedRows.length;
    return res.json({
      success: true,
      message: `导入完成，成功 ${successCount} 条，失败 ${failedCount} 条`,
      totalRows: rows.length,
      validatedCount: validRows.length,
      successCount,
      failedCount,
      headers,
      failedRows: persistedFailedRows,
      errorMessages: persistedFailedRows.map(item => `行 ${item.rowNumber}: ${item.error}`),
      data: {
        imported: successCount,
        failed: failedCount,
      },
    });
  } catch (error) {
    logger.error('导入资产失败:', error.message);
    return res.status(400).json({ success: false, message: error.message || '导入资产失败' });
  }
}

/**
 * 获取导入模板
 */
router.get('/import-template', authenticate, async (req, res) => {
  try {
    const workbook = new ExcelJS.Workbook();

    const templateData = [
      IMPORT_TEMPLATE_FIELDS.map(f => f.label),
      IMPORT_TEMPLATE_FIELDS.map(f => (f.required ? `${f.label}(必填)` : `${f.label}(选填)`)),
    ];
    addAoaWorksheet(workbook, '导入模板', templateData, IMPORT_TEMPLATE_FIELDS.map(() => 20));

    const dictData = [
      ['字段名', '说明', '示例值'],
      ...IMPORT_TEMPLATE_FIELDS.map(f => [
        f.label,
        `${f.type}${f.required ? ' 必填' : ' 选填'}`,
        f.type === 'date' ? '2024-01-15' : f.type === 'enum' ? f.values.join('/') : '示例文本',
      ]),
    ];
    addAoaWorksheet(workbook, '数据字典', dictData, [20, 30, 20]);

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="asset_import_template.xlsx"');
    res.send(buffer);
  } catch (error) {
    logger.error('Generate import template failed:', error);
    res.status(500).json({ success: false, message: '生成模板失败' });
  }
});

router.post(
  '/import/validate',
  authenticate,
  requireTenantId,
  upload.single('file'),
  fileSecurity(),
  validateImportHandler,
);

router.post('/import', authenticate, requireTenantId, authorize(ASSET_WRITE_ROLES), upload.single('file'), fileSecurity(), importHandler);

// 历史兼容接口
router.post(
  '/legacy/import',
  authenticate,
  requireTenantId,
  authorize(ASSET_WRITE_ROLES),
  upload.single('file'),
  fileSecurity(),
  importHandler,
);

/**
 * 导出模板（兼容前端调用的 /export/template 路径）
 */
router.get('/export/template', authenticate, async (req, res) => {
  try {
    const workbook = new ExcelJS.Workbook();

    const templateData = [
      IMPORT_TEMPLATE_FIELDS.map(f => f.label),
      IMPORT_TEMPLATE_FIELDS.map(f => (f.required ? `${f.label}(必填)` : `${f.label}(选填)`)),
    ];
    addAoaWorksheet(workbook, '导入模板', templateData, IMPORT_TEMPLATE_FIELDS.map(() => 20));

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="asset_template.xlsx"');
    res.send(buffer);
  } catch (error) {
    logger.error('Generate export template failed:', error);
    res.status(500).json({ success: false, message: '生成模板失败' });
  }
});

/**
 * 导出资产
 */
router.get('/export', authenticate, requireTenantId, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const {
      search = '',
      status,
      department_id,
      department = '',
      category_id,
      location,
      format = 'xlsx',
      sortField = 'created_at',
      sortOrder = 'desc',
    } = req.query;

    const normalizedSearch = String(search || '').trim().substring(0, 100);
    const normalizedDepartment = String(department || '').trim().substring(0, 100);
    const normalizedFormat = String(format || 'xlsx').toLowerCase() === 'csv' ? 'csv' : 'xlsx';
    const safeSortField = ['created_at', 'updated_at', 'purchase_date', 'asset_name', 'purchase_price', 'current_value'].includes(sortField)
      ? sortField
      : 'created_at';
    const safeSortOrder = ['asc', 'desc'].includes(String(sortOrder).toLowerCase())
      ? String(sortOrder).toLowerCase()
      : 'desc';

    // 构建查询条件
    const conditions = ['a.tenant_id = ? AND a.is_deleted = 0'];
    const params = [tenantId];

    if (status) {
      conditions.push('a.status = ?');
      params.push(status);
    }
    if (department_id) {
      conditions.push('a.department_new = ?');
      params.push(department_id);
    }
    if (normalizedDepartment) {
      const departmentLike = `%${normalizedDepartment}%`;
      conditions.push(`(
        a.department LIKE ?
        OR a.department_new LIKE ?
        OR a.department_new IN (
          SELECT department_code
          FROM departments
          WHERE tenant_id = ?
            AND department_name LIKE ?
        )
        OR a.department IN (
          SELECT department_name
          FROM departments
          WHERE tenant_id = ?
            AND department_name LIKE ?
        )
      )`);
      params.push(
        departmentLike,
        departmentLike,
        tenantId,
        departmentLike,
        tenantId,
        departmentLike,
      );
    }
    if (category_id) {
      conditions.push('a.category_id = ?');
      params.push(category_id);
    }
    if (location) {
      conditions.push('a.location LIKE ?');
      params.push(`${String(location).trim()}%`);
    }
    if (normalizedSearch) {
      conditions.push('(a.asset_code LIKE ? OR a.asset_name LIKE ? OR a.brand LIKE ?)');
      params.push(`${normalizedSearch}%`, `%${normalizedSearch}%`, `${normalizedSearch}%`);
    }

    // 查询数据
    const [assets] = await db.execute(
      `SELECT
        a.asset_code, a.asset_name, c.name as category_name,
        a.brand, a.model, a.serial_number,
        a.purchase_date, a.purchase_price, a.current_value,
        a.depreciation_years, a.location, d.department_name,
        a.status, a.supplier, a.warranty_period, a.remark
       FROM assets a
       LEFT JOIN asset_categories c ON a.category_id = c.id
       LEFT JOIN departments d ON a.department_new = d.department_code AND a.tenant_id = d.tenant_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY a.${safeSortField} ${safeSortOrder.toUpperCase()}`,
      params,
    );

    // 生成导出文件
    if (normalizedFormat === 'csv') {
      const headers = IMPORT_TEMPLATE_FIELDS.map(f => f.label);
      const rows = assets.map(a => IMPORT_TEMPLATE_FIELDS.map(f => a[f.field] || ''));

      const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="assets_export.csv"');
      res.send(`\uFEFF${  csv}`); // BOM for Excel
    } else {
      const headers = IMPORT_TEMPLATE_FIELDS.map(f => f.label);
      const rows = assets.map(a => IMPORT_TEMPLATE_FIELDS.map(f => a[f.field] || ''));

      const workbook = new ExcelJS.Workbook();
      addAoaWorksheet(workbook, '资产列表', [headers, ...rows], IMPORT_TEMPLATE_FIELDS.map(() => 20));
      const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="assets_export.xlsx"');
      res.send(buffer);
    }
  } catch (error) {
    logger.error('Export assets failed:', error);
    res.status(500).json({ success: false, message: '导出失败' });
  }
});

router.__testables = {
  normalizeImportCellValue,
  parseImportRowsFromBuffer,
  preValidateImportRows,
  resolveUploadedFileBuffer,
};

module.exports = router;
