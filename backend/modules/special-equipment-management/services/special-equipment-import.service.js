/**
 * 特种设备批量导入 / 导出服务
 * --------------------------------------------------
 * 设计要点（“能够关联就关联”，与计量证书导入保持一致）：
 *   1. 解析 Excel（ExcelJS），按表头映射为 special_equipment 字段。
 *   2. 逐行校验（必填 / 枚举 / 日期 / 长度 / 编号唯一）。
 *   3. 资产自动关联：按导入的 asset_code 在当前租户内匹配 assets，命中则回填 asset_id。
 *   4. equipment_code 去重（文件内 + 已存在于库），避免重复导入。
 *   5. 事务批量入库，单条失败不影响其它行（捕获后归入失败明细）。
 *   6. 导出：按当前筛选条件导出 Excel，表头与导入模板一致，可回灌。
 */

const ExcelJS = require('exceljs');
const db = require('../../../config/database');
const { TransactionManager } = require('../../../utils/error-handler');
const SpecialEquipmentService = require('./special-equipment.service');

// ===================== 字段定义 =====================
const SPECIAL_EQUIPMENT_IMPORT_FIELDS = [
  { field: 'equipment_code', label: '设备编号', required: true, type: 'string', maxLength: 100 },
  { field: 'equipment_name', label: '设备名称', required: true, type: 'string', maxLength: 200 },
  { field: 'equipment_type', label: '设备类型', required: true, type: 'enum' },
  { field: 'asset_code', label: '资产编码', required: false, type: 'string', maxLength: 50 },
  { field: 'manufacturer', label: '制造商', required: false, type: 'string', maxLength: 200 },
  { field: 'model_spec', label: '型号规格', required: false, type: 'string', maxLength: 100 },
  { field: 'serial_number', label: '出厂编号', required: false, type: 'string', maxLength: 100 },
  { field: 'manufacturing_date', label: '制造日期', required: false, type: 'date' },
  { field: 'department', label: '所属部门', required: false, type: 'string', maxLength: 100 },
  { field: 'use_certificate_no', label: '使用登记证编号', required: false, type: 'string', maxLength: 100 },
  { field: 'registration_date', label: '注册登记日期', required: false, type: 'date' },
  { field: 'safety_manager', label: '安全管理员', required: false, type: 'string', maxLength: 50 },
  { field: 'first_inspection_date', label: '首次检验日期', required: false, type: 'date' },
  { field: 'next_inspection_date', label: '下次检验日期', required: false, type: 'date' },
  { field: 'inspection_cycle_months', label: '检验周期(月)', required: false, type: 'integer' },
  { field: 'location', label: '安装位置', required: false, type: 'string', maxLength: 200 },
  { field: 'registrant', label: '登记人', required: false, type: 'string', maxLength: 50 },
  { field: 'safety_status', label: '安全状态', required: false, type: 'enum', default: 'normal' },
  { field: 'use_status', label: '使用状态', required: false, type: 'enum', default: 'in_use' },
  { field: 'safety_notes', label: '安全注意事项', required: false, type: 'string', maxLength: 1000 },
  { field: 'remark', label: '备注', required: false, type: 'string', maxLength: 1000 },
];

const LABEL_TO_FIELD = new Map(SPECIAL_EQUIPMENT_IMPORT_FIELDS.map(item => [item.label, item.field]));
const REQUIRED_HEADERS = ['equipment_code', 'equipment_name', 'equipment_type'];
const FORMULA_PREFIX_REGEX = /^[=+\-@]/;

// 枚举值归一化映射（导入同时支持枚举值与中文标签）
const EQUIPMENT_TYPE_OPTIONS = [
  { value: 'elevator', label: '电梯' },
  { value: 'pressure_vessel', label: '压力容器' },
  { value: 'boiler', label: '锅炉' },
  { value: 'crane', label: '起重机械' },
  { value: 'forklift', label: '厂内机动车辆' },
  { value: 'pressure_pipeline', label: '压力管道' },
  { value: 'passenger_ropeway', label: '客运索道' },
  { value: 'large_amusement', label: '大型游乐设施' },
];
const EQUIPMENT_TYPE_MAP = (() => {
  const m = {};
  EQUIPMENT_TYPE_OPTIONS.forEach(o => { m[o.value] = o.value; m[o.label] = o.value; });
  return m;
})();

const SAFETY_STATUS_MAP = {
  normal: 'normal', expiring: 'expiring', expired: 'expired', stopped: 'stopped',
  正常: 'normal', 即将过期: 'expiring', 已过期: 'expired', 停用: 'stopped',
};
const USE_STATUS_MAP = {
  in_use: 'in_use', out_of_service: 'out_of_service', scrapped: 'scrapped',
  suspended: 'suspended', transferred: 'transferred',
  在用: 'in_use', 停用: 'out_of_service', 报废: 'scrapped', 停用待修: 'suspended', 移装: 'transferred',
};

// ===================== 通用工具 =====================
const normalizeImportCellValue = value => {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string') {
    const normalized = value.trim();
    return normalized || null;
  }
  if (typeof value === 'number' && !Number.isFinite(value)) return null;
  return value;
};

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
  const alt = datePart.replace(/\//g, '-');
  if (/^\d{4}-\d{2}-\d{2}$/.test(alt)) return alt;
  return null;
};

const isDateLike = value => toDateStr(value) !== null;

// ===================== 解析 Excel =====================
/**
 * 解析 Excel 文件缓冲为 { headers, rows }
 */
async function parseSpecialEquipmentImportBuffer(fileBuffer) {
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
  const sourceRows = data.slice(1);
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
    if (!hasValue) continue;
    rows.push({ rowNumber: rowIndex + 2, rowData });
  }

  if (rows.length === 0) throw new Error('Excel文件中没有可导入的数据行');

  return { headers, rows };
}

// ===================== 校验 + 资产自动关联 =====================
/**
 * 校验 + 资产自动关联（按 asset_code 匹配）
 * @returns {Promise<{validRows, failedRows, associatedCount, unassociatedCount}>}
 */
async function validateSpecialEquipmentImportRows(rows, tenantId) {
  // 预查已存在设备编号（按租户），用于去重
  const [existing] = await db.execute(
    'SELECT equipment_code FROM special_equipment WHERE tenant_id = ?',
    [tenantId],
  );
  const existingCodeSet = new Set(existing.map(r => String(r.equipment_code)));

  const seenCodes = new Set();
  const validRows = [];
  const failedRows = [];
  let associatedCount = 0;
  let unassociatedCount = 0;

  for (const rowItem of rows) {
    const raw = rowItem.rowData;
    const errors = [];

    const equipmentCode = normalizeImportCellValue(raw.equipment_code);
    const equipmentName = normalizeImportCellValue(raw.equipment_name);
    const equipmentTypeRaw = normalizeImportCellValue(raw.equipment_type);

    if (!equipmentCode) errors.push('设备编号不能为空');
    if (!equipmentName) errors.push('设备名称不能为空');
    if (!equipmentTypeRaw) {
      errors.push('设备类型不能为空');
    } else if (!EQUIPMENT_TYPE_MAP[equipmentTypeRaw]) {
      errors.push('设备类型无效（请使用：电梯/压力容器/锅炉/起重机械/厂内机动车辆/压力管道/客运索道/大型游乐设施）');
    }

    // 日期合法性
    const dateFields = ['manufacturing_date', 'registration_date', 'first_inspection_date', 'next_inspection_date'];
    dateFields.forEach(f => {
      const v = normalizeImportCellValue(raw[f]);
      if (v && !isDateLike(v)) errors.push(`${f} 格式应为 YYYY-MM-DD`);
    });

    // 枚举合法性
    const safetyRaw = normalizeImportCellValue(raw.safety_status);
    if (safetyRaw && !SAFETY_STATUS_MAP[safetyRaw]) errors.push('安全状态无效');
    const useRaw = normalizeImportCellValue(raw.use_status);
    if (useRaw && !USE_STATUS_MAP[useRaw]) errors.push('使用状态无效');

    // 检验周期必须为正整数
    const cycleRaw = normalizeImportCellValue(raw.inspection_cycle_months);
    if (cycleRaw !== null) {
      const n = parseInt(cycleRaw, 10);
      if (!Number.isFinite(n) || n <= 0) errors.push('检验周期(月)必须为正整数');
    }

    // 去重（文件内 + 已存在库）
    if (equipmentCode) {
      const codeKey = String(equipmentCode).toLowerCase();
      if (existingCodeSet.has(equipmentCode)) errors.push('设备编号已存在，请勿重复导入');
      else if (seenCodes.has(codeKey)) errors.push('设备编号在文件中重复');
      else seenCodes.add(codeKey);
    }

    if (errors.length > 0) {
      failedRows.push({ rowNumber: rowItem.rowNumber, error: errors.join('；'), rowData: raw });
      continue;
    }

    // 资产自动关联：按 asset_code 匹配当前租户资产
    const inputAssetCode = normalizeImportCellValue(raw.asset_code);
    let matchedAssetId = null;
    if (inputAssetCode) {
      const [assetRows] = await db.execute(
        'SELECT id FROM assets WHERE asset_code = ? AND tenant_id = ? LIMIT 1',
        [inputAssetCode, tenantId],
      );
      if (assetRows.length > 0) matchedAssetId = assetRows[0].id;
    }
    if (matchedAssetId) associatedCount += 1;
    else unassociatedCount += 1;

    const normalizedData = {
      equipment_code: equipmentCode,
      equipment_name: equipmentName,
      equipment_type: EQUIPMENT_TYPE_MAP[equipmentTypeRaw],
      asset_id: matchedAssetId,
      manufacturer: normalizeImportCellValue(raw.manufacturer),
      model_spec: normalizeImportCellValue(raw.model_spec),
      serial_number: normalizeImportCellValue(raw.serial_number),
      manufacturing_date: raw.manufacturing_date ? toDateStr(raw.manufacturing_date) : null,
      department: normalizeImportCellValue(raw.department),
      use_certificate_no: normalizeImportCellValue(raw.use_certificate_no),
      registration_date: raw.registration_date ? toDateStr(raw.registration_date) : null,
      safety_manager: normalizeImportCellValue(raw.safety_manager),
      first_inspection_date: raw.first_inspection_date ? toDateStr(raw.first_inspection_date) : null,
      next_inspection_date: raw.next_inspection_date ? toDateStr(raw.next_inspection_date) : null,
      inspection_cycle_months: cycleRaw !== null ? parseInt(cycleRaw, 10) : null,
      location: normalizeImportCellValue(raw.location),
      registrant: normalizeImportCellValue(raw.registrant),
      safety_status: safetyRaw ? SAFETY_STATUS_MAP[safetyRaw] : 'normal',
      use_status: useRaw ? USE_STATUS_MAP[useRaw] : 'in_use',
      safety_notes: normalizeImportCellValue(raw.safety_notes),
      remark: normalizeImportCellValue(raw.remark),
    };

    validRows.push({
      rowNumber: rowItem.rowNumber,
      rowData: raw,
      normalizedData,
      association: {
        matched: !!matchedAssetId,
        asset_code: inputAssetCode,
        asset_id: matchedAssetId,
      },
    });
  }

  return { validRows, failedRows, associatedCount, unassociatedCount };
}

// ===================== 事务批量入库 =====================
/**
 * 事务批量入库（动态列检测，与 createEquipment 别名映射一致）
 */
async function importSpecialEquipments(validRows, tenantId, createdBy) {
  let successCount = 0;
  const failedRows = [];
  let associatedCount = 0;
  let unassociatedCount = 0;

  if (validRows.length === 0) {
    return { successCount, failedRows, associatedCount, unassociatedCount };
  }

  const meta = await SpecialEquipmentService.getTableMeta('special_equipment');
  if (!meta.exists) {
    throw new Error('special_equipment 表不存在');
  }
  const { columns } = meta;

  const addField = (fields, values, column, value) => {
    if (!columns.has(column)) return;
    fields.push(column);
    values.push(value === undefined || value === null ? null : value);
  };

  await TransactionManager.executeTransaction(async connection => {
    for (const item of validRows) {
      try {
        const d = item.normalizedData;
        const fields = [];
        const values = [];

        addField(fields, values, 'equipment_code', d.equipment_code);
        addField(fields, values, 'equipment_name', d.equipment_name);
        addField(fields, values, 'equipment_type', d.equipment_type);
        if (d.asset_id) addField(fields, values, 'asset_id', d.asset_id);

        if (columns.has('registration_code')) {
          addField(fields, values, 'registration_code', d.use_certificate_no);
        } else if (columns.has('registration_no')) {
          addField(fields, values, 'registration_no', d.use_certificate_no);
        }

        if (columns.has('install_location')) {
          addField(fields, values, 'install_location', d.location);
        } else if (columns.has('location')) {
          addField(fields, values, 'location', d.location);
        }

        addField(fields, values, 'next_inspection_date', d.next_inspection_date);

        if (columns.has('safety_status')) {
          addField(fields, values, 'safety_status', d.safety_status);
        }
        if (columns.has('status')) {
          addField(fields, values, 'status', d.use_status);
        } else if (columns.has('use_status')) {
          addField(fields, values, 'use_status', d.use_status);
        }

        if (columns.has('remarks')) {
          addField(fields, values, 'remarks', d.remark);
        } else if (columns.has('remark')) {
          addField(fields, values, 'remark', d.remark);
        }

        // 扩展字段
        addField(fields, values, 'manufacturer', d.manufacturer);
        addField(fields, values, 'model_spec', d.model_spec);
        addField(fields, values, 'serial_number', d.serial_number);
        addField(fields, values, 'manufacturing_date', d.manufacturing_date);
        addField(fields, values, 'department', d.department);
        addField(fields, values, 'use_certificate_no', d.use_certificate_no);
        addField(fields, values, 'registration_date', d.registration_date);
        addField(fields, values, 'safety_manager', d.safety_manager);
        addField(fields, values, 'first_inspection_date', d.first_inspection_date);
        addField(fields, values, 'inspection_cycle_months', d.inspection_cycle_months);
        addField(fields, values, 'registrant', d.registrant);
        addField(fields, values, 'safety_notes', d.safety_notes);

        addField(fields, values, 'tenant_id', tenantId);
        addField(fields, values, 'created_by', createdBy);

        if (fields.length === 0) {
          throw new Error('无可写入字段');
        }

        // eslint-disable-next-line no-await-in-loop
        await connection.execute(
          `INSERT INTO special_equipment (${fields.join(', ')}) VALUES (${fields.map(() => '?').join(', ')})`,
          values,
        );
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

// ===================== 导出 =====================
/**
 * 按筛选条件导出特种设备 Excel
 */
async function getExportRows(tenantId, filters = {}) {
  const { status, safety_status, equipment_type, keyword } = filters;
  let sql = `
    SELECT se.*, a.asset_code AS asset_code
    FROM special_equipment se
    LEFT JOIN assets a ON se.asset_id = a.id AND a.tenant_id = se.tenant_id AND a.is_deleted = 0
    WHERE se.tenant_id = ?
  `;
  const params = [tenantId];
  if (status) { sql += ' AND se.status = ?'; params.push(status); }
  if (safety_status) { sql += ' AND se.safety_status = ?'; params.push(safety_status); }
  if (equipment_type) { sql += ' AND se.equipment_type = ?'; params.push(equipment_type); }
  if (keyword) {
    sql += ' AND (se.equipment_name LIKE ? OR se.equipment_code LIKE ? OR a.asset_code LIKE ?)';
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }
  sql += ' ORDER BY se.next_inspection_date ASC';

  const [rows] = await db.execute(sql, params);
  return rows;
}

const cellStr = v => {
  if (v === undefined || v === null) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v);
};

async function buildExportBuffer(tenantId, filters = {}) {
  const rows = await getExportRows(tenantId, filters);

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('特种设备台账');

  const headers = SPECIAL_EQUIPMENT_IMPORT_FIELDS.map(f => f.label);
  worksheet.addRow(headers);

  rows.forEach(row => {
    const out = SPECIAL_EQUIPMENT_IMPORT_FIELDS.map(f => {
      const v = row[f.field];
      return cellStr(v);
    });
    worksheet.addRow(out);
  });

  worksheet.columns.forEach(col => { col.width = 18; });
  worksheet.getRow(1).font = { bold: true };

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

// ===================== 导入模板 =====================
async function buildImportTemplateBuffer() {
  const workbook = new ExcelJS.Workbook();

  const headers = SPECIAL_EQUIPMENT_IMPORT_FIELDS.map(f => f.label);
  const markers = SPECIAL_EQUIPMENT_IMPORT_FIELDS.map(f => (f.required ? `${f.label}(必填)` : `${f.label}(选填)`));
  const examples = [
    ['SB-TY-0001', '示例电梯A', '电梯', 'SB-0001', '示例制造商', 'Model-X', 'SN-XYZ-001', '2023-05-10', '后勤保障部', 'TS1111', '2023-06-01', '张三', '2023-06-15', '2024-06-14', 12, '1号住院楼', '李四', 'normal', 'in_use', '定期检验，注意制动器', '示例备注'],
    ['SB-TY-0002', '示例压力容器B', '压力容器', '', '示例制造商2', 'R-200', 'SN-ABC-002', '2022-01-20', '设备科', '', '2022-02-01', '王五', '', '2024-02-01', 24, '锅炉房', '赵六', 'expiring', 'in_use', '', ''],
  ];

  const worksheet = workbook.addWorksheet('特种设备导入模板');
  worksheet.addRow(headers);
  worksheet.addRow(markers);
  examples.forEach(row => worksheet.addRow(row));
  worksheet.columns.forEach(col => { col.width = 18; });
  worksheet.getRow(1).font = { bold: true };

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

module.exports = {
  SPECIAL_EQUIPMENT_IMPORT_FIELDS,
  parseSpecialEquipmentImportBuffer,
  validateSpecialEquipmentImportRows,
  importSpecialEquipments,
  buildExportBuffer,
  buildImportTemplateBuffer,
};
