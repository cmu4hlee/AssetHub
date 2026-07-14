const db = require('../../config/database');
const { getTenantId } = require('../../middleware/tenant-filter');

function badRequest(message) {
  return { statusCode: 400, body: { success: false, message } };
}

function notFound(message) {
  return { statusCode: 404, body: { success: false, message } };
}

function getPageParams(query) {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const pageSize = Math.min(Math.max(parseInt(query.pageSize, 10) || 20, 1), 200);
  const offset = (page - 1) * pageSize;
  return { page, pageSize, offset };
}

// 生成单号
function generateNo(prefix) {
  const now = new Date();
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const random = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, '0');
  return `${prefix}${dateStr}${random}`;
}

// 自动更新保修状态（在保/即将到期/过保）
function autoStatus(endDate) {
  if (!endDate) return '待确认';
  const today = new Date();
  const end = new Date(endDate);
  const diffDays = Math.ceil((end - today) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return '过保';
  if (diffDays <= 30) return '即将到期';
  return '在保';
}

// 合同状态映射（与 warranty_status 对齐）
function contractStatus(endDate) {
  const status = autoStatus(endDate);
  if (status === '过保') return '已过期';
  if (status === '即将到期') return '即将到期';
  return '生效中';
}

// =====================================================
// 1. 保修合同管理
// =====================================================

async function getContracts(query, req) {
  const { page, pageSize, offset } = getPageParams(query);
  const tenantId = getTenantId(req);

  let whereClause = 'WHERE tenant_id = ?';
  const params = [tenantId];

  if (query.asset_code) {
    whereClause += ' AND asset_code = ?';
    params.push(query.asset_code);
  }
  if (query.status) {
    whereClause += ' AND status = ?';
    params.push(query.status);
  }
  if (query.warranty_type) {
    whereClause += ' AND warranty_type = ?';
    params.push(query.warranty_type);
  }
  if (query.keyword) {
    whereClause += ' AND (contract_no LIKE ? OR contract_name LIKE ? OR asset_name LIKE ? OR supplier_name LIKE ?)';
    const kw = `%${query.keyword}%`;
    params.push(kw, kw, kw, kw);
  }

  const [countResult] = await db.execute(
    `SELECT COUNT(*) as total FROM warranty_contracts ${whereClause}`,
    params,
  );
  const { total } = countResult[0];

  const [rows] = await db.execute(
    `SELECT * FROM warranty_contracts ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
  );

  return {
    success: true,
    data: rows,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
}

async function getContractById(id, req) {
  const tenantId = getTenantId(req);
  const [rows] = await db.execute(
    'SELECT * FROM warranty_contracts WHERE id = ? AND tenant_id = ?',
    [id, tenantId],
  );
  if (rows.length === 0) return notFound('合同不存在');
  return { success: true, data: rows[0] };
}

async function createContract(body, req) {
  const tenantId = getTenantId(req);
  const {
    contract_no,
    contract_name,
    asset_code,
    asset_name,
    supplier_name,
    supplier_contact,
    warranty_type,
    start_date,
    end_date,
    contract_amount,
    coverage_scope,
    service_level,
    response_time,
    remark,
  } = body;

  if (!contract_name || !asset_code || !start_date || !end_date) {
    return badRequest('合同名称、资产编号、开始日期、结束日期不能为空');
  }

  const finalContractNo = contract_no || generateNo('HT');

  // 获取资产名称
  let finalAssetName = asset_name;
  if (!finalAssetName) {
    const [assetRows] = await db.execute(
      'SELECT asset_name FROM assets WHERE asset_code = ? AND tenant_id = ?',
      [asset_code, tenantId],
    );
    if (assetRows.length > 0) finalAssetName = assetRows[0].asset_name;
  }

  const status = contractStatus(end_date);

  const [result] = await db.execute(
    `INSERT INTO warranty_contracts
     (tenant_id, contract_no, contract_name, asset_code, asset_name, supplier_name, supplier_contact,
      warranty_type, start_date, end_date, contract_amount, coverage_scope, service_level, response_time,
      status, remark, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      tenantId, finalContractNo, contract_name, asset_code, finalAssetName,
      supplier_name || null, supplier_contact || null, warranty_type || '原厂保修',
      start_date, end_date, contract_amount || 0, coverage_scope || null,
      service_level || null, response_time || null, status, remark || null,
      req.user?.username || null,
    ],
  );

  return { success: true, message: '合同创建成功', data: { id: result.insertId, contract_no: finalContractNo } };
}

async function updateContract(id, body, req) {
  const tenantId = getTenantId(req);

  const [existing] = await db.execute(
    'SELECT * FROM warranty_contracts WHERE id = ? AND tenant_id = ?',
    [id, tenantId],
  );
  if (existing.length === 0) return notFound('合同不存在');

  const old = existing[0];
  const fields = [
    'contract_name', 'asset_name', 'supplier_name', 'supplier_contact', 'warranty_type',
    'start_date', 'end_date', 'contract_amount', 'coverage_scope', 'service_level',
    'response_time', 'status', 'remark',
  ];

  const updates = [];
  const params = [];
  for (const field of fields) {
    if (body[field] !== undefined) {
      updates.push(`${field} = ?`);
      params.push(body[field]);
    }
  }

  if (body.end_date) {
    updates.push('status = ?');
    params.push(contractStatus(body.end_date));
  }

  if (updates.length === 0) return badRequest('没有需要更新的字段');

  params.push(id, tenantId);
  await db.execute(
    `UPDATE warranty_contracts SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ? AND tenant_id = ?`,
    params,
  );

  return { success: true, message: '合同更新成功' };
}

async function deleteContract(id, req) {
  const tenantId = getTenantId(req);
  const [result] = await db.execute(
    'DELETE FROM warranty_contracts WHERE id = ? AND tenant_id = ?',
    [id, tenantId],
  );
  if (result.affectedRows === 0) return notFound('合同不存在');
  return { success: true, message: '合同删除成功' };
}

// =====================================================
// 2. 发票管理
// =====================================================

async function getInvoices(query, req) {
  const { page, pageSize, offset } = getPageParams(query);
  const tenantId = getTenantId(req);

  let whereClause = 'WHERE wi.tenant_id = ?';
  const params = [tenantId];

  if (query.contract_id) {
    whereClause += ' AND wi.contract_id = ?';
    params.push(query.contract_id);
  }
  if (query.status) {
    whereClause += ' AND wi.status = ?';
    params.push(query.status);
  }
  if (query.keyword) {
    whereClause += ' AND (wi.invoice_no LIKE ? OR wi.issuer LIKE ?)';
    const kw = `%${query.keyword}%`;
    params.push(kw, kw);
  }

  const [countResult] = await db.execute(
    `SELECT COUNT(*) as total FROM warranty_invoices wi ${whereClause}`,
    params,
  );
  const { total } = countResult[0];

  const [rows] = await db.execute(
    `SELECT wi.*, wc.contract_no, wc.contract_name
     FROM warranty_invoices wi
     LEFT JOIN warranty_contracts wc ON wi.contract_id = wc.id
     ${whereClause}
     ORDER BY wi.created_at DESC LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
  );

  return {
    success: true,
    data: rows,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
}

async function getInvoiceById(id, req) {
  const tenantId = getTenantId(req);
  const [rows] = await db.execute(
    `SELECT wi.*, wc.contract_no, wc.contract_name
     FROM warranty_invoices wi
     LEFT JOIN warranty_contracts wc ON wi.contract_id = wc.id
     WHERE wi.id = ? AND wi.tenant_id = ?`,
    [id, tenantId],
  );
  if (rows.length === 0) return notFound('发票不存在');
  return { success: true, data: rows[0] };
}

async function createInvoice(body, req) {
  const tenantId = getTenantId(req);
  const {
    contract_id, invoice_no, invoice_code, invoice_type, amount, tax_amount,
    invoice_date, issuer, receiver, file_path, remark,
  } = body;

  if (!invoice_no || !amount || !invoice_date) {
    return badRequest('发票编号、金额、开票日期不能为空');
  }

  const [result] = await db.execute(
    `INSERT INTO warranty_invoices
     (tenant_id, contract_id, invoice_no, invoice_code, invoice_type, amount, tax_amount,
      invoice_date, issuer, receiver, file_path, status, remark, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '待审核', ?, ?, NOW())`,
    [
      tenantId, contract_id || null, invoice_no, invoice_code || null,
      invoice_type || '增值税普通发票', amount, tax_amount || 0,
      invoice_date, issuer || null, receiver || null, file_path || null,
      remark || null, req.user?.username || null,
    ],
  );

  return { success: true, message: '发票创建成功', data: { id: result.insertId } };
}

async function updateInvoice(id, body, req) {
  const tenantId = getTenantId(req);
  const [existing] = await db.execute(
    'SELECT * FROM warranty_invoices WHERE id = ? AND tenant_id = ?',
    [id, tenantId],
  );
  if (existing.length === 0) return notFound('发票不存在');

  const fields = [
    'contract_id', 'invoice_code', 'invoice_type', 'amount', 'tax_amount',
    'invoice_date', 'issuer', 'receiver', 'file_path', 'status', 'remark',
  ];
  const updates = [];
  const params = [];
  for (const field of fields) {
    if (body[field] !== undefined) {
      updates.push(`${field} = ?`);
      params.push(body[field]);
    }
  }
  if (updates.length === 0) return badRequest('没有需要更新的字段');

  params.push(id, tenantId);
  await db.execute(
    `UPDATE warranty_invoices SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ? AND tenant_id = ?`,
    params,
  );
  return { success: true, message: '发票更新成功' };
}

async function deleteInvoice(id, req) {
  const tenantId = getTenantId(req);
  const [result] = await db.execute(
    'DELETE FROM warranty_invoices WHERE id = ? AND tenant_id = ?',
    [id, tenantId],
  );
  if (result.affectedRows === 0) return notFound('发票不存在');
  return { success: true, message: '发票删除成功' };
}

// =====================================================
// 3. 付款管理
// =====================================================

async function getPayments(query, req) {
  const { page, pageSize, offset } = getPageParams(query);
  const tenantId = getTenantId(req);

  let whereClause = 'WHERE wp.tenant_id = ?';
  const params = [tenantId];

  if (query.contract_id) {
    whereClause += ' AND wp.contract_id = ?';
    params.push(query.contract_id);
  }
  if (query.status) {
    whereClause += ' AND wp.status = ?';
    params.push(query.status);
  }
  if (query.keyword) {
    whereClause += ' AND (wp.payment_no LIKE ? OR wp.payee LIKE ?)';
    const kw = `%${query.keyword}%`;
    params.push(kw, kw);
  }

  const [countResult] = await db.execute(
    `SELECT COUNT(*) as total FROM warranty_payments wp ${whereClause}`,
    params,
  );
  const { total } = countResult[0];

  const [rows] = await db.execute(
    `SELECT wp.*, wc.contract_no, wc.contract_name, wi.invoice_no
     FROM warranty_payments wp
     LEFT JOIN warranty_contracts wc ON wp.contract_id = wc.id
     LEFT JOIN warranty_invoices wi ON wp.invoice_id = wi.id
     ${whereClause}
     ORDER BY wp.created_at DESC LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
  );

  return {
    success: true,
    data: rows,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
}

async function getPaymentById(id, req) {
  const tenantId = getTenantId(req);
  const [rows] = await db.execute(
    `SELECT wp.*, wc.contract_no, wc.contract_name, wi.invoice_no
     FROM warranty_payments wp
     LEFT JOIN warranty_contracts wc ON wp.contract_id = wc.id
     LEFT JOIN warranty_invoices wi ON wp.invoice_id = wi.id
     WHERE wp.id = ? AND wp.tenant_id = ?`,
    [id, tenantId],
  );
  if (rows.length === 0) return notFound('付款记录不存在');
  return { success: true, data: rows[0] };
}

async function createPayment(body, req) {
  const tenantId = getTenantId(req);
  const {
    contract_id, invoice_id, payment_no, payment_type, amount, payment_method,
    payment_date, payee, bank_account, file_path, remark,
  } = body;

  if (!amount || !payment_date) {
    return badRequest('付款金额、付款日期不能为空');
  }

  const finalPaymentNo = payment_no || generateNo('FK');

  const [result] = await db.execute(
    `INSERT INTO warranty_payments
     (tenant_id, contract_id, invoice_id, payment_no, payment_type, amount, payment_method,
      payment_date, payee, bank_account, file_path, status, remark, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '待付款', ?, ?, NOW())`,
    [
      tenantId, contract_id || null, invoice_id || null, finalPaymentNo,
      payment_type || '全款', amount, payment_method || '银行转账',
      payment_date, payee || null, bank_account || null, file_path || null,
      remark || null, req.user?.username || null,
    ],
  );

  return { success: true, message: '付款记录创建成功', data: { id: result.insertId, payment_no: finalPaymentNo } };
}

async function updatePayment(id, body, req) {
  const tenantId = getTenantId(req);
  const [existing] = await db.execute(
    'SELECT * FROM warranty_payments WHERE id = ? AND tenant_id = ?',
    [id, tenantId],
  );
  if (existing.length === 0) return notFound('付款记录不存在');

  const fields = [
    'contract_id', 'invoice_id', 'payment_type', 'amount', 'payment_method',
    'payment_date', 'payee', 'bank_account', 'file_path', 'status', 'remark',
  ];
  const updates = [];
  const params = [];
  for (const field of fields) {
    if (body[field] !== undefined) {
      updates.push(`${field} = ?`);
      params.push(body[field]);
    }
  }
  if (updates.length === 0) return badRequest('没有需要更新的字段');

  params.push(id, tenantId);
  await db.execute(
    `UPDATE warranty_payments SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ? AND tenant_id = ?`,
    params,
  );
  return { success: true, message: '付款记录更新成功' };
}

async function deletePayment(id, req) {
  const tenantId = getTenantId(req);
  const [result] = await db.execute(
    'DELETE FROM warranty_payments WHERE id = ? AND tenant_id = ?',
    [id, tenantId],
  );
  if (result.affectedRows === 0) return notFound('付款记录不存在');
  return { success: true, message: '付款记录删除成功' };
}

// =====================================================
// 4. 档案管理
// =====================================================

async function getArchives(query, req) {
  const { page, pageSize, offset } = getPageParams(query);
  const tenantId = getTenantId(req);

  let whereClause = 'WHERE wa.tenant_id = ?';
  const params = [tenantId];

  if (query.contract_id) {
    whereClause += ' AND wa.contract_id = ?';
    params.push(query.contract_id);
  }
  if (query.document_type) {
    whereClause += ' AND wa.document_type = ?';
    params.push(query.document_type);
  }
  if (query.asset_code) {
    whereClause += ' AND wa.asset_code = ?';
    params.push(query.asset_code);
  }
  if (query.keyword) {
    whereClause += ' AND (wa.archive_no LIKE ? OR wa.archive_name LIKE ?)';
    const kw = `%${query.keyword}%`;
    params.push(kw, kw);
  }

  const [countResult] = await db.execute(
    `SELECT COUNT(*) as total FROM warranty_archives wa ${whereClause}`,
    params,
  );
  const { total } = countResult[0];

  const [rows] = await db.execute(
    `SELECT wa.*, wc.contract_no, wc.contract_name
     FROM warranty_archives wa
     LEFT JOIN warranty_contracts wc ON wa.contract_id = wc.id
     ${whereClause}
     ORDER BY wa.created_at DESC LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
  );

  return {
    success: true,
    data: rows,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
}

async function getArchiveById(id, req) {
  const tenantId = getTenantId(req);
  const [rows] = await db.execute(
    `SELECT wa.*, wc.contract_no, wc.contract_name
     FROM warranty_archives wa
     LEFT JOIN warranty_contracts wc ON wa.contract_id = wc.id
     WHERE wa.id = ? AND wa.tenant_id = ?`,
    [id, tenantId],
  );
  if (rows.length === 0) return notFound('档案不存在');
  return { success: true, data: rows[0] };
}

async function createArchive(body, req) {
  const tenantId = getTenantId(req);
  const {
    contract_id, archive_no, archive_name, document_type, asset_code,
    file_path, file_size, description, archive_date, retention_until, remark,
  } = body;

  if (!archive_name || !file_path) {
    return badRequest('档案名称、文件路径不能为空');
  }

  const finalArchiveNo = archive_no || generateNo('DA');

  const [result] = await db.execute(
    `INSERT INTO warranty_archives
     (tenant_id, contract_id, archive_no, archive_name, document_type, asset_code,
      file_path, file_size, description, archive_date, retention_until, status, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '在档', ?, NOW())`,
    [
      tenantId, contract_id || null, finalArchiveNo, archive_name,
      document_type || '其他', asset_code || null,
      file_path, file_size || 0, description || null,
      archive_date || null, retention_until || null,
      req.user?.username || null,
    ],
  );

  return { success: true, message: '档案创建成功', data: { id: result.insertId, archive_no: finalArchiveNo } };
}

async function updateArchive(id, body, req) {
  const tenantId = getTenantId(req);
  const [existing] = await db.execute(
    'SELECT * FROM warranty_archives WHERE id = ? AND tenant_id = ?',
    [id, tenantId],
  );
  if (existing.length === 0) return notFound('档案不存在');

  const fields = [
    'contract_id', 'archive_name', 'document_type', 'asset_code', 'file_path',
    'file_size', 'description', 'archive_date', 'retention_until', 'status', 'remark',
  ];
  const updates = [];
  const params = [];
  for (const field of fields) {
    if (body[field] !== undefined) {
      updates.push(`${field} = ?`);
      params.push(body[field]);
    }
  }
  if (updates.length === 0) return badRequest('没有需要更新的字段');

  params.push(id, tenantId);
  await db.execute(
    `UPDATE warranty_archives SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ? AND tenant_id = ?`,
    params,
  );
  return { success: true, message: '档案更新成功' };
}

async function deleteArchive(id, req) {
  const tenantId = getTenantId(req);
  const [result] = await db.execute(
    'DELETE FROM warranty_archives WHERE id = ? AND tenant_id = ?',
    [id, tenantId],
  );
  if (result.affectedRows === 0) return notFound('档案不存在');
  return { success: true, message: '档案删除成功' };
}

// =====================================================
// 5. 保修信息维护
// =====================================================

async function getWarrantyInfo(query, req) {
  const { page, pageSize, offset } = getPageParams(query);
  const tenantId = getTenantId(req);

  let whereClause = 'WHERE wi.tenant_id = ?';
  const params = [tenantId];

  if (query.asset_code) {
    whereClause += ' AND wi.asset_code = ?';
    params.push(query.asset_code);
  }
  if (query.warranty_status) {
    whereClause += ' AND wi.warranty_status = ?';
    params.push(query.warranty_status);
  }
  if (query.warranty_type) {
    whereClause += ' AND wi.warranty_type = ?';
    params.push(query.warranty_type);
  }
  if (query.keyword) {
    whereClause += ' AND (wi.asset_code LIKE ? OR wi.asset_name LIKE ? OR wi.supplier_name LIKE ?)';
    const kw = `%${query.keyword}%`;
    params.push(kw, kw, kw);
  }

  const [countResult] = await db.execute(
    `SELECT COUNT(*) as total FROM warranty_info wi ${whereClause}`,
    params,
  );
  const { total } = countResult[0];

  const [rows] = await db.execute(
    `SELECT wi.*, wc.contract_no, wc.contract_name
     FROM warranty_info wi
     LEFT JOIN warranty_contracts wc ON wi.contract_id = wc.id
     ${whereClause}
     ORDER BY wi.updated_at DESC, wi.created_at DESC LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
  );

  return {
    success: true,
    data: rows,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
}

// 在保清单
async function getInWarrantyList(query, req) {
  const modifiedQuery = { ...query, warranty_status: '在保' };
  return getWarrantyInfo(modifiedQuery, req);
}

// 过保清单
async function getOutWarrantyList(query, req) {
  const modifiedQuery = { ...query, warranty_status: '过保' };
  return getWarrantyInfo(modifiedQuery, req);
}

// 维修清单（从 assets 表 + warranty_info 关联查询保修状态）
async function getRepairList(query, req) {
  const { page, pageSize, offset } = getPageParams(query);
  const tenantId = getTenantId(req);

  let whereClause = 'WHERE a.tenant_id = ? AND a.is_deleted = 0';
  const params = [tenantId];

  if (query.keyword) {
    whereClause += ' AND (a.asset_code LIKE ? OR a.asset_name LIKE ?)';
    const kw = `%${query.keyword}%`;
    params.push(kw, kw);
  }

  const [countResult] = await db.execute(
    `SELECT COUNT(*) as total FROM assets a ${whereClause}`,
    params,
  );
  const { total } = countResult[0];

  const [rows] = await db.execute(
    `SELECT a.asset_code, a.asset_name, a.brand, a.model, a.department_new,
            a.warranty_period, a.warranty_end_date,
            wi.warranty_status, wi.warranty_type, wi.supplier_name, wi.service_hotline,
            DATEDIFF(a.warranty_end_date, CURDATE()) as days_until_expire
     FROM assets a
     LEFT JOIN warranty_info wi ON a.asset_code = wi.asset_code AND wi.tenant_id = a.tenant_id
     ${whereClause}
     ORDER BY days_until_expire ASC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
  );

  return {
    success: true,
    data: rows,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
}

async function getWarrantyInfoById(id, req) {
  const tenantId = getTenantId(req);
  const [rows] = await db.execute(
    `SELECT wi.*, wc.contract_no, wc.contract_name
     FROM warranty_info wi
     LEFT JOIN warranty_contracts wc ON wi.contract_id = wc.id
     WHERE wi.id = ? AND wi.tenant_id = ?`,
    [id, tenantId],
  );
  if (rows.length === 0) return notFound('保修信息不存在');
  return { success: true, data: rows[0] };
}

async function createWarrantyInfo(body, req) {
  const tenantId = getTenantId(req);
  const {
    asset_code, asset_name, contract_id, warranty_type, start_date, end_date,
    warranty_period_months, supplier_name, supplier_contact, coverage_details,
    exclusions, service_hotline, remark,
  } = body;

  if (!asset_code) {
    return badRequest('资产编号不能为空');
  }

  // 获取资产名称
  let finalAssetName = asset_name;
  if (!finalAssetName) {
    const [assetRows] = await db.execute(
      'SELECT asset_name FROM assets WHERE asset_code = ? AND tenant_id = ?',
      [asset_code, tenantId],
    );
    if (assetRows.length > 0) finalAssetName = assetRows[0].asset_name;
  }

  const warrantyStatus = autoStatus(end_date);

  const [result] = await db.execute(
    `INSERT INTO warranty_info
     (tenant_id, asset_code, asset_name, contract_id, warranty_status, warranty_type,
      start_date, end_date, warranty_period_months, supplier_name, supplier_contact,
      coverage_details, exclusions, service_hotline, remark, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      tenantId, asset_code, finalAssetName, contract_id || null,
      warrantyStatus, warranty_type || '原厂保修',
      start_date || null, end_date || null, warranty_period_months || null,
      supplier_name || null, supplier_contact || null,
      coverage_details || null, exclusions || null, service_hotline || null,
      remark || null, req.user?.username || null,
    ],
  );

  // 同步更新 assets 表的保修字段
  if (end_date || warranty_period_months) {
    const assetUpdates = [];
    const assetParams = [];
    if (end_date) {
      assetUpdates.push('warranty_end_date = ?');
      assetParams.push(end_date);
    }
    if (warranty_period_months) {
      assetUpdates.push('warranty_period = ?');
      assetParams.push(warranty_period_months);
    }
    assetParams.push(asset_code, tenantId);
    await db.execute(
      `UPDATE assets SET ${assetUpdates.join(', ')} WHERE asset_code = ? AND tenant_id = ?`,
      assetParams,
    );
  }

  // 记录历史
  await db.execute(
    `INSERT INTO warranty_history
     (tenant_id, warranty_info_id, asset_code, asset_name, change_type, change_description, changed_by, changed_at)
     VALUES (?, ?, ?, ?, '新增', '新建保修信息', ?, NOW())`,
    [tenantId, result.insertId, asset_code, finalAssetName, req.user?.username || null],
  );

  return { success: true, message: '保修信息创建成功', data: { id: result.insertId } };
}

async function updateWarrantyInfo(id, body, req) {
  const tenantId = getTenantId(req);
  const [existing] = await db.execute(
    'SELECT * FROM warranty_info WHERE id = ? AND tenant_id = ?',
    [id, tenantId],
  );
  if (existing.length === 0) return notFound('保修信息不存在');

  const old = existing[0];
  const fields = [
    'asset_name', 'contract_id', 'warranty_type', 'start_date', 'end_date',
    'warranty_period_months', 'supplier_name', 'supplier_contact',
    'coverage_details', 'exclusions', 'service_hotline', 'remark',
  ];

  const updates = [];
  const params = [];
  const changes = [];

  for (const field of fields) {
    if (body[field] !== undefined && String(body[field]) !== String(old[field] || '')) {
      updates.push(`${field} = ?`);
      params.push(body[field]);
      changes.push({ field, old_value: old[field], new_value: body[field] });
    }
  }

  // 自动更新保修状态
  if (body.end_date !== undefined) {
    const newStatus = autoStatus(body.end_date);
    if (newStatus !== old.warranty_status) {
      updates.push('warranty_status = ?');
      params.push(newStatus);
      changes.push({ field: 'warranty_status', old_value: old.warranty_status, new_value: newStatus });
    }
  }

  if (updates.length === 0) return badRequest('没有需要更新的字段');

  params.push(id, tenantId);
  await db.execute(
    `UPDATE warranty_info SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ? AND tenant_id = ?`,
    params,
  );

  // 记录历史
  for (const change of changes) {
    await db.execute(
      `INSERT INTO warranty_history
       (tenant_id, warranty_info_id, asset_code, asset_name, change_type, field_name,
        old_value, new_value, change_description, changed_by, changed_at)
       VALUES (?, ?, ?, ?, '修改', ?, ?, ?, ?, NOW())`,
      [
        tenantId, id, old.asset_code, old.asset_name,
        change.field,
        change.old_value !== null ? String(change.old_value) : null,
        change.new_value !== null ? String(change.new_value) : null,
        `字段 ${change.field} 从 "${change.old_value || '空'}" 改为 "${change.new_value || '空'}"`,
        req.user?.username || null,
      ],
    );
  }

  // 同步更新 assets 表
  if (body.end_date || body.warranty_period_months) {
    const assetUpdates = [];
    const assetParams = [];
    if (body.end_date) {
      assetUpdates.push('warranty_end_date = ?');
      assetParams.push(body.end_date);
    }
    if (body.warranty_period_months) {
      assetUpdates.push('warranty_period = ?');
      assetParams.push(body.warranty_period_months);
    }
    assetParams.push(old.asset_code, tenantId);
    await db.execute(
      `UPDATE assets SET ${assetUpdates.join(', ')} WHERE asset_code = ? AND tenant_id = ?`,
      assetParams,
    );
  }

  return { success: true, message: '保修信息更新成功' };
}

async function deleteWarrantyInfo(id, req) {
  const tenantId = getTenantId(req);
  const [existing] = await db.execute(
    'SELECT * FROM warranty_info WHERE id = ? AND tenant_id = ?',
    [id, tenantId],
  );
  if (existing.length === 0) return notFound('保修信息不存在');

  await db.execute('DELETE FROM warranty_info WHERE id = ? AND tenant_id = ?', [id, tenantId]);

  // 记录历史
  await db.execute(
    `INSERT INTO warranty_history
     (tenant_id, warranty_info_id, asset_code, asset_name, change_type, change_description, changed_by, changed_at)
     VALUES (?, ?, ?, ?, '终止', '删除保修信息', ?, NOW())`,
    [tenantId, id, existing[0].asset_code, existing[0].asset_name, req.user?.username || null],
  );

  return { success: true, message: '保修信息删除成功' };
}

// =====================================================
// 6. 保修历史记录
// =====================================================

async function getHistory(query, req) {
  const { page, pageSize, offset } = getPageParams(query);
  const tenantId = getTenantId(req);

  let whereClause = 'WHERE wh.tenant_id = ?';
  const params = [tenantId];

  if (query.asset_code) {
    whereClause += ' AND wh.asset_code = ?';
    params.push(query.asset_code);
  }
  if (query.warranty_info_id) {
    whereClause += ' AND wh.warranty_info_id = ?';
    params.push(query.warranty_info_id);
  }
  if (query.change_type) {
    whereClause += ' AND wh.change_type = ?';
    params.push(query.change_type);
  }
  if (query.start_date) {
    whereClause += ' AND wh.changed_at >= ?';
    params.push(query.start_date);
  }
  if (query.end_date) {
    whereClause += ' AND wh.changed_at <= ?';
    params.push(query.end_date + ' 23:59:59');
  }

  const [countResult] = await db.execute(
    `SELECT COUNT(*) as total FROM warranty_history wh ${whereClause}`,
    params,
  );
  const { total } = countResult[0];

  const [rows] = await db.execute(
    `SELECT * FROM warranty_history wh ${whereClause} ORDER BY wh.changed_at DESC LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
  );

  return {
    success: true,
    data: rows,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
}

// =====================================================
// 7. 保修提醒管理
// =====================================================

async function getReminders(query, req) {
  const { page, pageSize, offset } = getPageParams(query);
  const tenantId = getTenantId(req);

  let whereClause = 'WHERE wr.tenant_id = ?';
  const params = [tenantId];

  if (query.status) {
    whereClause += ' AND wr.status = ?';
    params.push(query.status);
  }
  if (query.reminder_type) {
    whereClause += ' AND wr.reminder_type = ?';
    params.push(query.reminder_type);
  }
  if (query.asset_code) {
    whereClause += ' AND wr.asset_code = ?';
    params.push(query.asset_code);
  }
  if (query.start_date) {
    whereClause += ' AND wr.reminder_date >= ?';
    params.push(query.start_date);
  }
  if (query.end_date) {
    whereClause += ' AND wr.reminder_date <= ?';
    params.push(query.end_date);
  }

  const [countResult] = await db.execute(
    `SELECT COUNT(*) as total FROM warranty_reminders wr ${whereClause}`,
    params,
  );
  const { total } = countResult[0];

  const [rows] = await db.execute(
    `SELECT wr.*, wc.contract_no
     FROM warranty_reminders wr
     LEFT JOIN warranty_contracts wc ON wr.contract_id = wc.id
     ${whereClause}
     ORDER BY wr.reminder_date ASC, wr.created_at DESC LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
  );

  return {
    success: true,
    data: rows,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
}

async function createReminder(body, req) {
  const tenantId = getTenantId(req);
  const {
    warranty_info_id, contract_id, asset_code, asset_name, reminder_type,
    reminder_date, expire_date, recipients, recipient_names, reminder_days_before,
    message,
  } = body;

  if (!asset_code || !reminder_date) {
    return badRequest('资产编号、提醒日期不能为空');
  }

  // 获取资产名称
  let finalAssetName = asset_name;
  if (!finalAssetName) {
    const [assetRows] = await db.execute(
      'SELECT asset_name FROM assets WHERE asset_code = ? AND tenant_id = ?',
      [asset_code, tenantId],
    );
    if (assetRows.length > 0) finalAssetName = assetRows[0].asset_name;
  }

  const [result] = await db.execute(
    `INSERT INTO warranty_reminders
     (tenant_id, warranty_info_id, contract_id, asset_code, asset_name, reminder_type,
      reminder_date, expire_date, recipients, recipient_names, reminder_days_before,
      message, status, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '待发送', ?, NOW())`,
    [
      tenantId, warranty_info_id || null, contract_id || null,
      asset_code, finalAssetName, reminder_type || '到期提醒',
      reminder_date, expire_date || null,
      recipients ? JSON.stringify(recipients) : null,
      recipient_names || null,
      reminder_days_before || 30, message || null,
      req.user?.username || null,
    ],
  );

  return { success: true, message: '提醒创建成功', data: { id: result.insertId } };
}

async function updateReminder(id, body, req) {
  const tenantId = getTenantId(req);
  const [existing] = await db.execute(
    'SELECT * FROM warranty_reminders WHERE id = ? AND tenant_id = ?',
    [id, tenantId],
  );
  if (existing.length === 0) return notFound('提醒不存在');

  const fields = [
    'reminder_type', 'reminder_date', 'expire_date', 'recipients', 'recipient_names',
    'reminder_days_before', 'message', 'status',
  ];
  const updates = [];
  const params = [];
  for (const field of fields) {
    if (body[field] !== undefined) {
      updates.push(`${field} = ?`);
      if (field === 'recipients' && Array.isArray(body[field])) {
        params.push(JSON.stringify(body[field]));
      } else {
        params.push(body[field]);
      }
    }
  }

  // 标记为已发送
  if (body.status === '已发送') {
    updates.push('sent_at = NOW()');
  }

  if (updates.length === 0) return badRequest('没有需要更新的字段');

  params.push(id, tenantId);
  await db.execute(
    `UPDATE warranty_reminders SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ? AND tenant_id = ?`,
    params,
  );
  return { success: true, message: '提醒更新成功' };
}

async function deleteReminder(id, req) {
  const tenantId = getTenantId(req);
  const [result] = await db.execute(
    'DELETE FROM warranty_reminders WHERE id = ? AND tenant_id = ?',
    [id, tenantId],
  );
  if (result.affectedRows === 0) return notFound('提醒不存在');
  return { success: true, message: '提醒删除成功' };
}

// 检查即将到期的保修，自动生成提醒
async function checkExpiringWarranties(req) {
  const tenantId = getTenantId(req);

  // 查找即将到期（30天内）和已过期的保修信息
  const [rows] = await db.execute(
    `SELECT wi.id, wi.asset_code, wi.asset_name, wi.end_date, wi.warranty_status,
            wi.supplier_name, wi.service_hotline
     FROM warranty_info wi
     WHERE wi.tenant_id = ? AND wi.end_date IS NOT NULL
     AND wi.end_date BETWEEN DATE_SUB(CURDATE(), INTERVAL 30 DAY) AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)
     ORDER BY wi.end_date ASC`,
    [tenantId],
  );

  // 查找 assets 表中有保修到期日但无 warranty_info 记录的资产
  const [assetRows] = await db.execute(
    `SELECT a.asset_code, a.asset_name, a.warranty_end_date
     FROM assets a
     LEFT JOIN warranty_info wi ON a.asset_code = wi.asset_code AND wi.tenant_id = a.tenant_id
     WHERE a.tenant_id = ? AND a.is_deleted = 0
     AND a.warranty_end_date IS NOT NULL
     AND a.warranty_end_date BETWEEN DATE_SUB(CURDATE(), INTERVAL 30 DAY) AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)
     AND wi.id IS NULL
     ORDER BY a.warranty_end_date ASC`,
    [tenantId],
  );

  return {
    success: true,
    data: {
      warranty_info_expiring: rows,
      assets_expiring: assetRows,
      total: rows.length + assetRows.length,
    },
    message: `发现 ${rows.length + assetRows.length} 个即将到期或已过期的保修`,
  };
}

// =====================================================
// 8. 保修提醒配置（全局/资产级）
// =====================================================

async function getReminderConfigs(query, req) {
  const tenantId = getTenantId(req);

  let whereClause = 'WHERE tenant_id = ?';
  const params = [tenantId];

  if (query.asset_code) {
    whereClause += ' AND (asset_code = ? OR asset_code IS NULL)';
    params.push(query.asset_code);
  }

  const [rows] = await db.execute(
    `SELECT * FROM warranty_reminder_configs ${whereClause} ORDER BY asset_code ASC, created_at DESC`,
    params,
  );

  return { success: true, data: rows };
}

async function saveReminderConfig(body, req) {
  const tenantId = getTenantId(req);
  const {
    asset_code, reminder_days_before, reminder_dates, recipients,
    recipient_names, reminder_types, enabled,
  } = body;

  if (!reminder_days_before) {
    return badRequest('提前提醒天数不能为空');
  }

  const [existing] = await db.execute(
    'SELECT * FROM warranty_reminder_configs WHERE tenant_id = ? AND (asset_code = ? OR (asset_code IS NULL AND ? IS NULL))',
    [tenantId, asset_code || null, asset_code || null],
  );

  if (existing.length > 0) {
    await db.execute(
      `UPDATE warranty_reminder_configs
       SET reminder_days_before = ?, reminder_dates = ?, recipients = ?, recipient_names = ?,
           reminder_types = ?, enabled = ?, updated_at = NOW()
       WHERE id = ? AND tenant_id = ?`,
      [
        reminder_days_before,
        reminder_dates ? JSON.stringify(reminder_dates) : null,
        recipients ? JSON.stringify(recipients) : null,
        recipient_names || null,
        reminder_types ? JSON.stringify(reminder_types) : '["system"]',
        enabled !== false ? 1 : 0,
        existing[0].id, tenantId,
      ],
    );
    return { success: true, message: '提醒配置更新成功' };
  }

  const [result] = await db.execute(
    `INSERT INTO warranty_reminder_configs
     (tenant_id, asset_code, reminder_days_before, reminder_dates, recipients,
      recipient_names, reminder_types, enabled, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      tenantId, asset_code || null, reminder_days_before,
      reminder_dates ? JSON.stringify(reminder_dates) : null,
      recipients ? JSON.stringify(recipients) : null,
      recipient_names || null,
      reminder_types ? JSON.stringify(reminder_types) : '["system"]',
      enabled !== false ? 1 : 0,
      req.user?.username || null,
    ],
  );

  return { success: true, message: '提醒配置创建成功', data: { id: result.insertId } };
}

async function deleteReminderConfig(id, req) {
  const tenantId = getTenantId(req);
  const [result] = await db.execute(
    'DELETE FROM warranty_reminder_configs WHERE id = ? AND tenant_id = ?',
    [id, tenantId],
  );
  if (result.affectedRows === 0) return notFound('提醒配置不存在');
  return { success: true, message: '提醒配置删除成功' };
}

// =====================================================
// 9. 保修统计
// =====================================================

async function getStatistics(req) {
  const tenantId = getTenantId(req);

  const [statusStats] = await db.execute(
    `SELECT warranty_status, COUNT(*) as count FROM warranty_info WHERE tenant_id = ? GROUP BY warranty_status`,
    [tenantId],
  );

  const [typeStats] = await db.execute(
    `SELECT warranty_type, COUNT(*) as count FROM warranty_info WHERE tenant_id = ? GROUP BY warranty_type`,
    [tenantId],
  );

  const [contractStats] = await db.execute(
    `SELECT status, COUNT(*) as count, COALESCE(SUM(contract_amount), 0) as total_amount
     FROM warranty_contracts WHERE tenant_id = ? GROUP BY status`,
    [tenantId],
  );

  const [expiringSoon] = await db.execute(
    `SELECT COUNT(*) as count FROM warranty_info
     WHERE tenant_id = ? AND end_date IS NOT NULL
     AND end_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)`,
    [tenantId],
  );

  const [expiredCount] = await db.execute(
    `SELECT COUNT(*) as count FROM warranty_info
     WHERE tenant_id = ? AND warranty_status = '过保'`,
    [tenantId],
  );

  return {
    success: true,
    data: {
      status_stats: statusStats,
      type_stats: typeStats,
      contract_stats: contractStats,
      expiring_soon: expiringSoon[0]?.count || 0,
      expired: expiredCount[0]?.count || 0,
    },
  };
}

module.exports = {
  // 保修合同
  getContracts,
  getContractById,
  createContract,
  updateContract,
  deleteContract,
  // 发票
  getInvoices,
  getInvoiceById,
  createInvoice,
  updateInvoice,
  deleteInvoice,
  // 付款
  getPayments,
  getPaymentById,
  createPayment,
  updatePayment,
  deletePayment,
  // 档案
  getArchives,
  getArchiveById,
  createArchive,
  updateArchive,
  deleteArchive,
  // 保修信息
  getWarrantyInfo,
  getWarrantyInfoById,
  createWarrantyInfo,
  updateWarrantyInfo,
  deleteWarrantyInfo,
  // 在保/过保/维修清单
  getInWarrantyList,
  getOutWarrantyList,
  getRepairList,
  // 保修历史
  getHistory,
  // 保修提醒
  getReminders,
  createReminder,
  updateReminder,
  deleteReminder,
  checkExpiringWarranties,
  // 提醒配置
  getReminderConfigs,
  saveReminderConfig,
  deleteReminderConfig,
  // 统计
  getStatistics,
};
