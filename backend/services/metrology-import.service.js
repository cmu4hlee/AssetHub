/**
 * 计量证书批量导入服务
 * --------------------------------------------------
 * 设计要点（“能够关联就关联”）：
 *   1. 解析 Excel（ExcelJS），按表头映射为 metrology_records 字段。
 *   2. 逐行校验（必填 / 枚举 / 长度 / 格式）。
 *   3. 资产自动关联：优先按 asset_code 匹配，未命中再按 serial_number 匹配；
 *      - 命中  -> 关联（采用系统内的资产编码与资产名称）。
 *      - 未命中 -> 未关联（保留用户填写的资产编码作为自由文本，便于后续手动关联）。
 *   4. 证书编号去重（文件内 + 已存在于库），避免重复导入。
 *   5. 事务批量入库，单条失败不影响其它行。
 */

const ExcelJS = require('exceljs');
const db = require('../config/database');
const { TransactionManager } = require('../utils/error-handler');
const MetrologyService = require('./metrology-service');

// 导入模板字段定义（label 用于表头，field 用于内部字段名）
const METROLOGY_IMPORT_FIELDS = [
  { field: 'certificate_no', label: '证书编号', required: true, type: 'string', maxLength: 100 },
  { field: 'asset_code', label: '资产编码', required: false, type: 'string', maxLength: 50 },
  { field: 'serial_number', label: '序列号', required: false, type: 'string', maxLength: 100 },
  { field: 'asset_name', label: '资产名称', required: false, type: 'string', maxLength: 200 },
  { field: 'metrology_type', label: '计量类型', required: true, type: 'enum' },
  { field: 'metrology_date', label: '计量日期', required: true, type: 'date' },
  { field: 'next_metrology_date', label: '下次计量日期', required: false, type: 'date' },
  { field: 'metrology_agency', label: '计量机构', required: false, type: 'string', maxLength: 200 },
  { field: 'result', label: '计量结果', required: false, type: 'enum' },
  { field: 'accuracy_level', label: '准确度等级', required: false, type: 'string', maxLength: 50 },
  { field: 'measurement_range', label: '测量范围', required: false, type: 'string', maxLength: 100 },
  { field: 'cost', label: '计量费用', required: false, type: 'number', min: 0 },
  { field: 'operator', label: '操作人员', required: false, type: 'string', maxLength: 100 },
  { field: 'specification', label: '规格型号', required: false, type: 'string', maxLength: 200 },
  { field: 'conformance_standard', label: '符合标准', required: false, type: 'string', maxLength: 200 },
  { field: 'customer_name', label: '委托方', required: false, type: 'string', maxLength: 200 },
  { field: 'metrology_cycle', label: '计量周期(月)', required: false, type: 'integer', default: 12 },
  { field: 'warning_days', label: '预警天数', required: false, type: 'integer', default: 30 },
  { field: 'status', label: '状态', required: false, type: 'enum', default: '待检' },
  { field: 'remark', label: '备注', required: false, type: 'string', maxLength: 1000 },
];

const LABEL_TO_FIELD = new Map(METROLOGY_IMPORT_FIELDS.map(item => [item.label, item.field]));
const REQUIRED_HEADERS = ['certificate_no', 'metrology_type', 'metrology_date'];
const FORMULA_PREFIX_REGEX = /^[=+\-@]/;

const normalizeImportCellValue = value => {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string') {
    const normalized = value.trim();
    return normalized || null;
  }
  return value;
};

// 表头归一化：支持“证书编号(必填)”这类带括号标题
const normalizeImportHeader = rawHeader => {
  const header = String(rawHeader || '').trim();
  if (!header) return '';
  if (LABEL_TO_FIELD.has(header)) return LABEL_TO_FIELD.get(header);
  const stripped = header.replace(/\s*\([^)]*\)\s*$/, '').trim();
  if (LABEL_TO_FIELD.has(stripped)) return LABEL_TO_FIELD.get(stripped);
  return header;
};

const normalizeWorkbookCellValue = value => {
  if (value === undefined || value === null) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    if (Object.prototype.hasOwnProperty.call(value, 'result')) return normalizeWorkbookCellValue(value.result);
    if (Object.prototype.hasOwnProperty.call(value, 'text')) return normalizeWorkbookCellValue(value.text);
    if (Array.isArray(value.richText)) return value.richText.map(item => item.text || '').join('');
    if (Object.prototype.hasOwnProperty.call(value, 'hyperlink')) {
      return normalizeWorkbookCellValue(value.text || value.hyperlink);
    }
    return String(value);
  }
  return value;
};

// 任意值转 YYYY-MM-DD；无法识别返回 null
const toDateStr = value => {
  if (value === undefined || value === null) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const s = String(value).trim();
  if (!s) return null;
  const datePart = s.split(' ')[0].split('T')[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return datePart;
  // 兼容 2024/01/15 形式
  const alt = datePart.replace(/\//g, '-');
  if (/^\d{4}-\d{2}-\d{2}$/.test(alt)) return alt;
  return null;
};

const isDateLike = value => toDateStr(value) !== null;

/**
 * 解析 Excel 文件缓冲为 { headers, rows }
 * @param {Buffer} fileBuffer
 * @returns {Promise<{headers: string[], rows: Array<{rowNumber:number, rowData:Object}>}>}
 */
async function parseMetrologyImportBuffer(fileBuffer) {
  if (!fileBuffer || !Buffer.isBuffer(fileBuffer)) {
    throw new Error('上传文件无效，无法读取文件数据');
  }

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(fileBuffer);
  } catch (error) {
    throw new Error('Excel文件格式不正确，无法解析（仅支持 .xlsx）');
  }

  if (!workbook.worksheets || workbook.worksheets.length === 0) {
    throw new Error('Excel文件格式不正确，没有工作表');
  }

  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new Error('Excel文件格式不正确，工作表不存在');

  const data = [];
  const columnCount = Math.max(worksheet.columnCount, 1);
  worksheet.eachRow({ includeEmpty: true }, row => {
    const values = [];
    for (let columnIndex = 1; columnIndex <= columnCount; columnIndex += 1) {
      values.push(normalizeWorkbookCellValue(row.getCell(columnIndex).value));
    }
    data.push(values);
  });

  if (!Array.isArray(data) || data.length < 2) {
    throw new Error('Excel文件格式不正确，至少需要包含表头和一行数据');
  }

  const headers = (data[0] || []).map(normalizeImportHeader).filter(Boolean);
  if (headers.length === 0) throw new Error('Excel文件格式不正确，表头不存在');

  for (const header of REQUIRED_HEADERS) {
    if (!headers.includes(header)) {
      throw new Error(`Excel文件缺少必要字段列: ${header}`);
    }
  }

  const rows = [];
  const sourceRows = data.slice(1); // 第二行起为数据（与资产导入一致，第一行表头）
  for (let rowIndex = 0; rowIndex < sourceRows.length; rowIndex += 1) {
    const row = sourceRows[rowIndex] || [];
    const rowData = {};
    let hasValue = false;
    for (let i = 0; i < headers.length; i += 1) {
      const header = headers[i];
      const value = normalizeImportCellValue(row[i]);
      rowData[header] = value;
      if (value !== null) hasValue = true;
    }
    if (!hasValue) continue; // 跳过全空行
    rows.push({ rowNumber: rowIndex + 2, rowData });
  }

  if (rows.length === 0) throw new Error('Excel文件中没有可导入的数据行');

  return { headers, rows };
}

/**
 * 校验 + 资产自动关联
 * @param {Array} rows parseMetrologyImportBuffer 的结果
 * @param {string} tenantId
 * @returns {Promise<{validRows:Array, failedRows:Array, associatedCount:number, unassociatedCount:number}>}
 */
async function validateMetrologyImportRows(rows, tenantId) {
  // 批量预查已存在的证书编号（按租户），用于去重
  const certsInFile = [];
  rows.forEach(r => {
    const c = normalizeImportCellValue(r.rowData.certificate_no);
    if (c) certsInFile.push(c);
  });

  const existingCertSet = new Set();
  if (certsInFile.length > 0) {
    const placeholders = certsInFile.map(() => '?').join(',');
    const [existing] = await db.execute(
      `SELECT certificate_no FROM metrology_records WHERE tenant_id = ? AND certificate_no IN (${placeholders})`,
      [tenantId, ...certsInFile],
    );
    existing.forEach(row => existingCertSet.add(String(row.certificate_no)));
  }

  const seenCerts = new Set();
  const validRows = [];
  const failedRows = [];
  let associatedCount = 0;
  let unassociatedCount = 0;

  for (const rowItem of rows) {
    const raw = rowItem.rowData;
    const errors = [];

    // 必填校验
    const certificateNo = normalizeImportCellValue(raw.certificate_no);
    const metrologyType = normalizeImportCellValue(raw.metrology_type);
    const metrologyDateRaw = normalizeImportCellValue(raw.metrology_date);

    if (!certificateNo) errors.push('证书编号不能为空');
    if (!metrologyType) errors.push('计量类型不能为空');
    if (!metrologyDateRaw) {
      errors.push('计量日期不能为空');
    } else if (!isDateLike(metrologyDateRaw)) {
      errors.push('计量日期格式应为 YYYY-MM-DD');
    }

    // 枚举归一化 + 字段校验
    const { normalized, errors: enumErrors } = MetrologyService.normalizeMetrologyEnums({
      metrology_type: metrologyType,
      result: normalizeImportCellValue(raw.result),
      status: normalizeImportCellValue(raw.status),
    });
    errors.push(...enumErrors);

    // 数值 / 日期 / 长度 预校验（借助服务内的校验器）
    const fieldCheckData = {
      ...raw,
      metrology_type: normalized.metrology_type,
      result: normalized.result,
      status: normalized.status,
      metrology_date: metrologyDateRaw,
      next_metrology_date: normalizeImportCellValue(raw.next_metrology_date),
      metrology_cycle: normalizeImportCellValue(raw.metrology_cycle),
      warning_days: normalizeImportCellValue(raw.warning_days),
      cost: normalizeImportCellValue(raw.cost),
    };
    const fieldErrors = MetrologyService.validateMetrologyInput(fieldCheckData);
    errors.push(...fieldErrors);

    // 日期合法性
    const nextDate = normalizeImportCellValue(raw.next_metrology_date);
    if (nextDate && !isDateLike(nextDate)) errors.push('下次计量日期格式应为 YYYY-MM-DD');

    // 证书编号去重（文件内 + 已存在库）
    if (certificateNo) {
      const certKey = String(certificateNo).toLowerCase();
      if (seenCerts.has(certKey)) errors.push('证书编号在文件中重复');
      else seenCerts.add(certKey);
      if (existingCertSet.has(certificateNo)) errors.push('证书编号已存在，请勿重复导入');
    }

    if (errors.length > 0) {
      failedRows.push({ rowNumber: rowItem.rowNumber, error: errors.join('；'), rowData: raw });
      continue;
    }

    // 资产自动关联（asset_code 优先，序列号兜底）
    const inputAssetCode = normalizeImportCellValue(raw.asset_code);
    const inputSerial = normalizeImportCellValue(raw.serial_number);
    const inputAssetName = normalizeImportCellValue(raw.asset_name);

    let matched = false;
    let matchedBy = null;
    let finalAssetCode = inputAssetCode;
    let finalAssetName = inputAssetName;

    if (inputAssetCode) {
      const [assetRows] = await db.execute(
        'SELECT id, asset_name, asset_code FROM assets WHERE asset_code = ? AND tenant_id = ? LIMIT 1',
        [inputAssetCode, tenantId],
      );
      if (assetRows.length > 0) {
        matched = true;
        matchedBy = 'asset_code';
        finalAssetCode = assetRows[0].asset_code;
        finalAssetName = assetRows[0].asset_name;
      }
    }

    if (!matched && inputSerial) {
      const [assetRows] = await db.execute(
        'SELECT id, asset_name, asset_code FROM assets WHERE serial_number = ? AND tenant_id = ? LIMIT 1',
        [inputSerial, tenantId],
      );
      if (assetRows.length > 0) {
        matched = true;
        matchedBy = 'serial_number';
        finalAssetCode = assetRows[0].asset_code;
        finalAssetName = assetRows[0].asset_name;
      }
    }

    if (!matched) {
      // 未关联：保留自由文本资产编码（便于后续手动关联），资产名称取导入值或默认
      finalAssetName = finalAssetName || '未知资产';
    }

    if (matched) associatedCount += 1;
    else unassociatedCount += 1;

    const normalizedData = {
      certificate_no: certificateNo,
      asset_code: finalAssetCode || null,
      asset_name: finalAssetName,
      serial_number: inputSerial,
      metrology_type: normalized.metrology_type,
      metrology_date: toDateStr(metrologyDateRaw),
      next_metrology_date: nextDate ? toDateStr(nextDate) : null,
      metrology_agency: normalizeImportCellValue(raw.metrology_agency),
      result: normalized.result || '待检',
      accuracy_level: normalizeImportCellValue(raw.accuracy_level),
      measurement_range: normalizeImportCellValue(raw.measurement_range),
      cost: raw.cost != null && raw.cost !== '' ? parseFloat(raw.cost) || 0 : 0,
      operator: normalizeImportCellValue(raw.operator),
      specification: normalizeImportCellValue(raw.specification),
      conformance_standard: normalizeImportCellValue(raw.conformance_standard),
      customer_name: normalizeImportCellValue(raw.customer_name),
      metrology_cycle: raw.metrology_cycle != null && raw.metrology_cycle !== ''
        ? parseInt(raw.metrology_cycle, 10) || 12
        : 12,
      warning_days: raw.warning_days != null && raw.warning_days !== ''
        ? parseInt(raw.warning_days, 10) || 30
        : 30,
      status: normalized.status || '待检',
      remark: normalizeImportCellValue(raw.remark),
    };

    validRows.push({
      rowNumber: rowItem.rowNumber,
      rowData: raw,
      normalizedData,
      association: { matched, matchedBy, asset_code: finalAssetCode, asset_name: finalAssetName },
    });
  }

  return { validRows, failedRows, associatedCount, unassociatedCount };
}

// metrology_records 插入列（与 MetrologyService.createMetrologyRecord 保持一致）
const INSERT_COLUMNS = [
  'tenant_id', 'record_no', 'asset_code', 'asset_name', 'customer_name', 'specification',
  'serial_number', 'technical_document', 'conformance_standard', 'metrology_type',
  'metrology_date', 'next_metrology_date', 'metrology_agency', 'certificate_no', 'result',
  'accuracy_level', 'measurement_range', 'cost', 'operator', 'remark', 'status',
  'metrology_cycle', 'warning_days', 'created_by',
];
const INSERT_SQL = `INSERT INTO metrology_records (${INSERT_COLUMNS.join(
  ', ',
)}) VALUES (${INSERT_COLUMNS.map(() => '?').join(', ')})`;

/**
 * 事务批量入库
 * @returns {Promise<{successCount:number, failedRows:Array, associatedCount:number, unassociatedCount:number}>}
 */
async function importMetrologyRecords(validRows, tenantId, createdBy) {
  let successCount = 0;
  const failedRows = [];
  let associatedCount = 0;
  let unassociatedCount = 0;

  if (validRows.length === 0) {
    return { successCount, failedRows, associatedCount, unassociatedCount };
  }

  await TransactionManager.executeTransaction(async connection => {
    for (const item of validRows) {
      try {
        const recordNo = await MetrologyService.generateRecordNo(tenantId);
        const d = item.normalizedData;
        const params = [
          tenantId,
          recordNo,
          d.asset_code ?? null,
          d.asset_name ?? '未知资产',
          d.customer_name ?? null,
          d.specification ?? null,
          d.serial_number ?? null,
          d.technical_document ?? null,
          d.conformance_standard ?? null,
          d.metrology_type,
          d.metrology_date,
          d.next_metrology_date ?? null,
          d.metrology_agency ?? null,
          d.certificate_no ?? null,
          d.result ?? '待检',
          d.accuracy_level ?? null,
          d.measurement_range ?? null,
          d.cost ?? 0,
          d.operator ?? null,
          d.remark ?? null,
          d.status ?? '待检',
          d.metrology_cycle ?? 12,
          d.warning_days ?? 30,
          createdBy,
        ];
        // eslint-disable-next-line no-await-in-loop
        await connection.execute(INSERT_SQL, params);
        successCount += 1;
        if (item.association.matched) associatedCount += 1;
        else unassociatedCount += 1;
      } catch (error) {
        failedRows.push({
          rowNumber: item.rowNumber,
          error: error.message || '入库失败',
          rowData: item.rowData,
        });
      }
    }
  });

  return { successCount, failedRows, associatedCount, unassociatedCount };
}

/**
 * 生成导入模板（xlsx buffer）
 */
async function buildImportTemplateBuffer() {
  const workbook = new ExcelJS.Workbook();

  const headers = METROLOGY_IMPORT_FIELDS.map(f => f.label);
  const markers = METROLOGY_IMPORT_FIELDS.map(f => (f.required ? `${f.label}(必填)` : `${f.label}(选填)`));
  const examples = [
    ['JL2024-0001', 'SB-0001', '', '示例呼吸机', '校准', '2024-01-15', '2025-01-14', '市计量院', '合格', '0.5级', '0-100kPa', 200, '张三', 'Model-X', 'JJG 100-2020', '某医院', 12, 30, '已完成', '示例：已关联资产'],
    ['JL2024-0002', '', 'SN-XYZ-999', '示例血压计', '期间核查', '2024-02-10', '', '院内', '限用', '', '', 0, '李四', '', '', '', 6, 15, '待检', '示例：按序列号未匹配则未关联'],
  ];

  const worksheet = workbook.addWorksheet('计量证书导入模板');
  worksheet.addRow(headers);
  worksheet.addRow(markers);
  examples.forEach(row => worksheet.addRow(row));
  worksheet.columns.forEach(col => {
    col.width = 18;
  });
  worksheet.getRow(1).font = { bold: true };

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

module.exports = {
  METROLOGY_IMPORT_FIELDS,
  parseMetrologyImportBuffer,
  validateMetrologyImportRows,
  importMetrologyRecords,
  buildImportTemplateBuffer,
};
