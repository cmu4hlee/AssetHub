const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

// 不良事件模块权限集合
const AR_GET_ROLES = ['adverse_reaction.view', 'quality_control.view_all', 'quality_control.view_own_department', 'asset.view_all', 'asset.view_own_department'];
const AR_WRITE_ROLES = ['adverse_reaction.edit', 'quality_control.edit_all', 'quality_control.edit_own_department', 'asset.edit_all', 'asset.edit_own_department'];
const AR_APPROVE_ROLES = ['adverse_reaction.approve', 'quality_control.approve', 'maintenance.approve'];
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const iconv = require('iconv-lite');
const { fileSecurity } = require('../middleware/fileSecurity');
const { getTenantId } = require('../middleware/tenant-filter');

const sanitizeUploadFileName = value =>
  String(value || '')
    .replace(/[<>:"/\\|?*]/g, '_')
    .split('')
    .map(char => (char.charCodeAt(0) < 32 ? '_' : char))
    .join('');

// 设置文件存储
const storage = multer.diskStorage({
  destination(req, file, cb) {
    const uploadPath = path.join(__dirname, '../uploads/adverse-reaction');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename(req, file, cb) {
    const timestamp = Date.now();
    const random = Math.round(Math.random() * 1e9);
    const uuidFragment = crypto.randomBytes(4).toString('hex');

    // 优先使用预解析的文件名
    let originalFileName = null;
    if (req.parsedFileName) {
      originalFileName = req.parsedFileName;
      console.log(`[不良事件 multer filename] ✅ 使用预解析的文件名: ${originalFileName}`);
    } else {
      originalFileName = file.originalname;
      console.log(`[不良事件 multer filename] ⚠️ 使用 multer 解析的文件名: ${originalFileName}`);

      // 检测乱码并修复
      const hasChinese = /[\u4e00-\u9fa5]/.test(originalFileName);
      const hasReplacementChar = originalFileName.includes('') || originalFileName.includes('?');
      const hasLatin1Mojibake = /[çåéè£æé«º¾´¨]/i.test(originalFileName);

      if (!hasChinese && (hasReplacementChar || hasLatin1Mojibake)) {
        console.log('[不良事件 multer filename] 检测到文件名可能乱码，开始修复...');
        try {
          const latin1Buffer = Buffer.from(originalFileName, 'latin1');
          const utf8Decoded = latin1Buffer.toString('utf8');
          if (/[\u4e00-\u9fa5]/.test(utf8Decoded)) {
            originalFileName = utf8Decoded;
            console.log(`[不良事件 multer filename] ✅ UTF-8 解码成功: ${originalFileName}`);
          } else {
            const encodings = ['gbk', 'gb2312', 'gb18030'];
            for (const encoding of encodings) {
              try {
                const decoded = iconv.decode(latin1Buffer, encoding);
                if (/[\u4e00-\u9fa5]/.test(decoded)) {
                  originalFileName = decoded;
                  console.log(
                    `[不良事件 multer filename] ✅ 使用 ${encoding} 编码成功: ${originalFileName}`,
                  );
                  break;
                }
              } catch (e) {
                // 继续尝试下一个编码
              }
            }
          }
        } catch (e) {
          console.warn('[不良事件 multer filename] 编码修复失败:', e);
        }
      }
    }

    const ext = path.extname(originalFileName);
    let baseName = path.basename(originalFileName, ext);
    baseName = sanitizeUploadFileName(baseName);
    if (baseName.length > 100) {
      baseName = baseName.substring(0, 100);
    }

    const fileName = `ar-${timestamp}-${random}-${uuidFragment}-${baseName}${ext}`;
    const uploadPath = path.join(__dirname, '../uploads/adverse-reaction');
    let finalFileName = fileName;
    let counter = 1;

    while (fs.existsSync(path.join(uploadPath, finalFileName))) {
      const nameWithoutExt = path.basename(fileName, ext);
      finalFileName = `${nameWithoutExt}_${counter}${ext}`;
      counter++;
      if (counter > 1000) {
        finalFileName = `${crypto.randomBytes(16).toString('hex')}${ext}`;
        break;
      }
    }

    console.log(`[不良事件 multer filename] 最终存储的文件名: ${finalFileName}`);
    cb(null, finalFileName);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
    files: 10,
  },
});

// 文件名解析中间件
const parseFileNameFromRequest = (req, res, next) => {
  req.parsedFileName = null;

  if (req.body && req.body.originalFileName) {
    try {
      const decoded = decodeURIComponent(req.body.originalFileName);
      req.parsedFileName = decoded;
      console.log(`[不良事件 文件名解析] ✅ 从请求体获取文件名: ${req.parsedFileName}`);
    } catch (e) {
      console.warn('[不良事件 文件名解析] 从请求体解码失败:', e);
    }
  }

  const contentDisposition = req.headers['content-disposition'];
  if (contentDisposition && !req.parsedFileName) {
    const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;,\s]+)/i);
    if (utf8Match) {
      try {
        const decoded = decodeURIComponent(utf8Match[1]);
        req.parsedFileName = decoded;
        console.log(
          `[不良事件 文件名解析] ✅ 从 Content-Disposition (RFC 5987) 提取: ${req.parsedFileName}`,
        );
      } catch (e) {
        console.warn('[不良事件 文件名解析] RFC 5987 解码失败:', e);
      }
    }

    if (!req.parsedFileName) {
      const rfc2231Match = contentDisposition.match(/filename\*=([^']+)'[^']*'([^;,\s]+)/i);
      if (rfc2231Match) {
        try {
          const charset = rfc2231Match[1].toLowerCase();
          const encoded = rfc2231Match[2];
          const decoded = decodeURIComponent(encoded);
          req.parsedFileName = decoded;
          console.log(
            `[不良事件 文件名解析] ✅ 从 Content-Disposition (RFC 2231, ${charset}) 提取: ${req.parsedFileName}`,
          );
        } catch (e) {
          console.warn('[不良事件 文件名解析] RFC 2231 解码失败:', e);
        }
      }
    }
  }

  next();
};

// 生成报告编号
function generateReportNo() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, '0');
  return `BLFY${year}${month}${day}${random}`;
}

const sendTenantScopeRequired = (req, res) =>
  res.status(400).json({
    success: false,
    message: req.user?.role === 'super_admin' ? '请先选择企业空间' : '当前用户未分配企业空间',
    code: 'REQUIRE_TENANT',
  });

const resolveTenantIdOrRespond = (req, res) => {
  const tenantId = Number.parseInt(String(getTenantId(req) ?? ''), 10);
  if (!Number.isInteger(tenantId) || tenantId <= 0) {
    sendTenantScopeRequired(req, res);
    return null;
  }
  return tenantId;
};

const hasTenantWideAccess = req =>
  req.user?.role === 'super_admin' ||
  req.user?.role === 'system_admin' ||
  req.user?.has_all_departments === true ||
  (Array.isArray(req.user?.managed_departments) && req.user.managed_departments.includes('*'));

const getManagedDepartmentCodes = req =>
  Array.isArray(req.user?.managed_departments)
    ? req.user.managed_departments.filter(code => code && code !== '*')
    : [];

const applyManagedDepartmentScope = (
  req,
  tenantId,
  whereClause,
  params,
  { recordAlias = 'ar', assetAlias = '' } = {},
) => {
  if (hasTenantWideAccess(req)) {
    return { whereClause, params };
  }

  const managedDepartments = Array.isArray(req.user?.managed_departments)
    ? req.user.managed_departments.filter(code => code && code !== '*')
    : [];

  if (managedDepartments.length === 0) {
    return { whereClause: `${whereClause} AND 1 = 0`, params };
  }

  const placeholders = managedDepartments.map(() => '?').join(',');
  let scopedWhereClause = `${whereClause} AND (`;
  const scopedParams = [...params];

  scopedWhereClause += `${recordAlias}.department IN (
    SELECT department_name FROM departments
    WHERE tenant_id = ? AND department_code IN (${placeholders})
  ) OR ${recordAlias}.department IN (${placeholders})`;
  scopedParams.push(tenantId, ...managedDepartments, ...managedDepartments);

  if (assetAlias) {
    scopedWhereClause += ` OR ${assetAlias}.department_new IN (${placeholders})`;
    scopedParams.push(...managedDepartments);

    if (assetAlias !== recordAlias) {
      scopedWhereClause += ` OR ${assetAlias}.department IN (${placeholders})`;
      scopedParams.push(...managedDepartments);
    }
  }

  scopedWhereClause += ')';
  return { whereClause: scopedWhereClause, params: scopedParams };
};

const adverseReactionAssetJoin = `
  FROM adverse_reaction_records ar
  LEFT JOIN assets a ON a.asset_code = ar.asset_code AND a.tenant_id = ar.tenant_id AND a.is_deleted = 0
`;

const adverseReactionAttachmentJoin = `
  FROM adverse_reaction_attachments aa
  INNER JOIN adverse_reaction_records ar ON ar.id = aa.record_id AND ar.tenant_id = aa.tenant_id
  LEFT JOIN assets a ON a.asset_code = ar.asset_code AND a.tenant_id = ar.tenant_id AND a.is_deleted = 0
`;

const buildScopedRecordFilter = (req, tenantId, recordId) => {
  let whereClause = 'WHERE ar.id = ? AND ar.tenant_id = ?';
  let params = [recordId, tenantId];
  ({ whereClause, params } = applyManagedDepartmentScope(req, tenantId, whereClause, params, {
    recordAlias: 'ar',
    assetAlias: 'a',
  }));
  return { whereClause, params };
};

const buildScopedAttachmentFilter = (req, tenantId, attachmentId) => {
  let whereClause = 'WHERE aa.id = ? AND aa.tenant_id = ?';
  let params = [attachmentId, tenantId];
  ({ whereClause, params } = applyManagedDepartmentScope(req, tenantId, whereClause, params, {
    recordAlias: 'ar',
    assetAlias: 'a',
  }));
  return { whereClause, params };
};

const buildScopedAssetFilter = (req, tenantId, assetCode, assetAlias = 'a') => {
  let whereClause = `WHERE ${assetAlias}.asset_code = ? AND ${assetAlias}.tenant_id = ?`;
  let params = [assetCode, tenantId];
  ({ whereClause, params } = applyManagedDepartmentScope(req, tenantId, whereClause, params, {
    recordAlias: assetAlias,
    assetAlias,
  }));
  return { whereClause, params };
};

const canAccessManagedDepartment = async (executor, req, tenantId, department) => {
  if (!department || hasTenantWideAccess(req)) {
    return true;
  }

  const managedDepartments = getManagedDepartmentCodes(req);
  if (managedDepartments.length === 0) {
    return false;
  }

  if (managedDepartments.includes(department)) {
    return true;
  }

  const placeholders = managedDepartments.map(() => '?').join(',');
  const [rows] = await executor.execute(
    `SELECT 1
     FROM departments
     WHERE tenant_id = ? AND department_name = ? AND department_code IN (${placeholders})
     LIMIT 1`,
    [tenantId, department, ...managedDepartments],
  );

  return rows.length > 0;
};

// ============================================
// 不良事件管理相关接口
// ============================================

// 获取不良事件记录列表
router.get('/', authenticate, authorize(AR_GET_ROLES), async (req, res) => {
  try {
    const tenantId = resolveTenantIdOrRespond(req, res);
    if (!tenantId) return;

    // 检查表是否存在，如果不存在则自动创建
    try {
      await db.execute('SELECT 1 FROM adverse_reaction_records LIMIT 1');
    } catch (tableError) {
      if (tableError.code === 'ER_NO_SUCH_TABLE') {
        console.warn('[不良事件] 警告：表不存在，尝试自动创建（应该在服务器启动时已创建）');
        // 这里可以调用创建表的逻辑，但为了简化，先返回错误提示
        return res.status(500).json({
          success: false,
          message: '数据库表不存在，请先运行脚本创建表',
          hint: '请执行: node scripts/create-adverse-reaction-tables.js',
        });
      } else {
        throw tableError;
      }
    }

    const {
      page = 1,
      pageSize = 20,
      report_type,
      severity,
      event_level,
      status,
      reporter,
      start_date,
      end_date,
      keyword,
    } = req.query;
    const offset = (page - 1) * pageSize;

    let whereClause = 'WHERE ar.tenant_id = ?';
    let params = [tenantId];
    ({ whereClause, params } = applyManagedDepartmentScope(req, tenantId, whereClause, params, {
      recordAlias: 'ar',
      assetAlias: 'a',
    }));

    if (report_type) {
      whereClause += ' AND ar.report_type = ?';
      params.push(report_type);
    }

    if (severity) {
      whereClause += ' AND ar.severity = ?';
      params.push(severity);
    }

    if (event_level) {
      whereClause += ' AND ar.event_level = ?';
      params.push(event_level);
    }

    if (status) {
      whereClause += ' AND ar.status = ?';
      params.push(status);
    }

    if (reporter) {
      whereClause += ' AND ar.reporter LIKE ?';
      params.push(`%${reporter}%`);
    }

    if (start_date) {
      whereClause += ' AND ar.occurrence_date >= ?';
      params.push(start_date);
    }

    if (end_date) {
      whereClause += ' AND ar.occurrence_date <= ?';
      params.push(end_date);
    }

    if (keyword) {
      whereClause += ' AND (ar.report_no LIKE ? OR ar.asset_name LIKE ? OR ar.description LIKE ?)';
      const keywordParam = `%${keyword}%`;
      params.push(keywordParam, keywordParam, keywordParam);
    }

    const [countResult] = await db.execute(
      `SELECT COUNT(DISTINCT ar.id) as total ${adverseReactionAssetJoin} ${whereClause}`,
      params,
    );
    const { total } = countResult[0];

    const [rows] = await db.execute(
      `SELECT ar.*, a.department, a.department_new
       ${adverseReactionAssetJoin}
       ${whereClause}
       ORDER BY ar.occurrence_date DESC, ar.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(pageSize), offset],
    );

    res.json({
      success: true,
      data: rows,
      pagination: {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error('获取不良事件记录失败:', error);
    res.status(500).json({ success: false, message: '获取不良事件记录失败', error: error.message });
  }
});

// 获取单个不良事件记录详情
router.get('/:id', authenticate, authorize(AR_GET_ROLES), async (req, res) => {
  try {
    const tenantId = resolveTenantIdOrRespond(req, res);
    if (!tenantId) return;

    const { id } = req.params;
    const scopedRecord = buildScopedRecordFilter(req, tenantId, id);

    const [records] = await db.execute(
      `SELECT ar.*, a.department, a.department_new, a.brand, a.model, a.specification
       ${adverseReactionAssetJoin}
       ${scopedRecord.whereClause}`,
      scopedRecord.params,
    );

    if (records.length === 0) {
      return res.status(404).json({ success: false, message: '不良事件记录不存在' });
    }

    // 获取附件
    const [attachments] = await db.execute(
      'SELECT * FROM adverse_reaction_attachments WHERE record_id = ? AND tenant_id = ? ORDER BY upload_time DESC',
      [id, tenantId],
    );

    res.json({
      success: true,
      data: {
        ...records[0],
        attachments,
      },
    });
  } catch (error) {
    console.error('获取不良事件记录详情失败:', error);
    res
      .status(500)
      .json({ success: false, message: '获取不良事件记录详情失败', error: error.message });
  }
});

// 创建不良事件记录
router.post('/', authenticate, authorize(AR_WRITE_ROLES), async (req, res) => {
  const tenantId = resolveTenantIdOrRespond(req, res);
  if (!tenantId) return;

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const {
      report_no,
      asset_id,
      report_type,
      event_category,
      severity,
      event_consequence,
      occurrence_date,
      discovery_date,
      location,
      department,
      reporter,
      reporter_phone,
      report_source,
      involved_persons,
      description,
      cause_analysis,
      cause_category,
      impact_assessment,
      handling_measures,
      prevention_measures,
      improvement_suggestions,
      status,
      is_serious,
      related_assets,
      remark,
    } = req.body;

    // 验证必填字段
    if (!report_type) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ success: false, message: '报告类型不能为空' });
    }

    if (!occurrence_date) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ success: false, message: '发生时间不能为空' });
    }

    if (!reporter) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ success: false, message: '上报人不能为空' });
    }

    if (!description) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({ success: false, message: '事件描述不能为空' });
    }

    if (!(await canAccessManagedDepartment(connection, req, tenantId, department))) {
      await connection.rollback();
      connection.release();
      return res.status(403).json({ success: false, message: '无权操作该科室的不良事件记录' });
    }

    // 生成报告编号（如果未提供）
    let finalReportNo = report_no;
    if (!finalReportNo) {
      finalReportNo = generateReportNo();
      // 确保报告编号唯一
      let [existing] = await connection.execute(
        'SELECT id FROM adverse_reaction_records WHERE report_no = ? AND tenant_id = ?',
        [finalReportNo, tenantId],
      );
      while (existing.length > 0) {
        finalReportNo = generateReportNo();
        [existing] = await connection.execute(
          'SELECT id FROM adverse_reaction_records WHERE report_no = ? AND tenant_id = ?',
          [finalReportNo, tenantId],
        );
      }
    } else {
      // 检查报告编号是否已存在
      const [existing] = await connection.execute(
        'SELECT id FROM adverse_reaction_records WHERE report_no = ? AND tenant_id = ?',
        [finalReportNo, tenantId],
      );
      if (existing.length > 0) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({ success: false, message: '报告编号已存在' });
      }
    }

    // 获取资产信息（如果提供了资产ID）
    let asset_code = null;
    let asset_name = null;
    if (asset_id) {
      const assetScope = buildScopedAssetFilter(req, tenantId, asset_id);
      const [assets] = await connection.execute(
        `SELECT a.asset_code, a.asset_name FROM assets a ${assetScope.whereClause}`,
        assetScope.params,
      );
      if (assets.length === 0) {
        await connection.rollback();
        connection.release();
        return res.status(404).json({ success: false, message: '关联资产不存在或无权访问' });
      }
      asset_code = assets[0].asset_code;
      asset_name = assets[0].asset_name;
    }

    // 处理相关资产（JSON格式）
    let relatedAssetsJson = null;
    if (related_assets) {
      if (typeof related_assets === 'string') {
        relatedAssetsJson = related_assets;
      } else if (Array.isArray(related_assets)) {
        relatedAssetsJson = JSON.stringify(related_assets);
      }
    }

    // 处理涉及人员（JSON格式）
    let involvedPersonsJson = null;
    if (involved_persons) {
      if (typeof involved_persons === 'string') {
        involvedPersonsJson = involved_persons;
      } else if (Array.isArray(involved_persons)) {
        involvedPersonsJson = JSON.stringify(involved_persons);
      }
    }

    // 自动计算事件等级
    const finalSeverity = severity || '一般';
    const finalEventConsequence = event_consequence || '无伤害';
    const finalIsSerious = is_serious ? 1 : 0;
    const eventLevel = calculateEventLevel(
      finalSeverity,
      finalEventConsequence,
      finalIsSerious === 1,
    );

    // 自动计算处理时限
    const handleDeadline = calculateHandleDeadline(finalSeverity, eventLevel);

    const createdBy = req.user.real_name || req.user.username || '系统管理员';

    const [insertResult] = await connection.execute(
      `INSERT INTO adverse_reaction_records (
        tenant_id, report_no, asset_id, asset_code, asset_name, report_type, event_category, severity,
        event_level, event_consequence, occurrence_date, discovery_date, location, department,
        reporter, reporter_phone, report_source, involved_persons, description, cause_analysis,
        cause_category, impact_assessment, handling_measures, prevention_measures,
        improvement_suggestions, status, is_serious, related_assets, handle_deadline,
        remark, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tenantId,
        finalReportNo,
        asset_id || null,
        asset_code,
        asset_name,
        report_type,
        event_category || null,
        finalSeverity,
        eventLevel,
        finalEventConsequence,
        occurrence_date,
        discovery_date || null,
        location || null,
        department || null,
        reporter,
        reporter_phone || null,
        report_source || '系统上报',
        involvedPersonsJson,
        description,
        cause_analysis || null,
        cause_category || null,
        impact_assessment || null,
        handling_measures || null,
        prevention_measures || null,
        improvement_suggestions || null,
        status || '待处理',
        finalIsSerious,
        relatedAssetsJson,
        handleDeadline,
        remark || null,
        createdBy,
      ],
    );

    // 记录工作流 - 上报
    await connection.execute(
      `INSERT INTO adverse_reaction_workflow
       (tenant_id, record_id, step_name, step_type, operator, operation_time, operation_result, comment)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tenantId,
        insertResult.insertId,
        '事件上报',
        '上报',
        reporter,
        new Date(),
        '通过',
        '事件已上报，等待处理',
      ],
    );

    await connection.commit();
    connection.release();

    res.json({
      success: true,
      message: '不良反应记录创建成功',
      data: { id: insertResult.insertId, report_no: finalReportNo },
    });
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error('创建不良事件记录失败:', error);
    res.status(500).json({ success: false, message: '创建不良事件记录失败', error: error.message });
  }
});

// 更新不良事件记录
router.put('/:id', authenticate, authorize(AR_WRITE_ROLES), async (req, res) => {
  const tenantId = resolveTenantIdOrRespond(req, res);
  if (!tenantId) return;

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const { id } = req.params;
    const b = req.body || {};
    const {
      report_no = null,
      asset_id = null,
      report_type = null,
      event_category = null,
      severity = null,
      event_consequence = null,
      occurrence_date = null,
      discovery_date = null,
      location = null,
      department = null,
      reporter = null,
      reporter_phone = null,
      report_source = null,
      involved_persons = null,
      description = null,
      cause_analysis = null,
      cause_category = null,
      impact_assessment = null,
      handling_measures = null,
      prevention_measures = null,
      improvement_suggestions = null,
      status = null,
      handler = null,
      handle_date = null,
      handle_result = null,
      reviewer = null,
      review_date = null,
      review_comment = null,
      is_serious = null,
      related_assets = null,
      remark = null,
    } = b;

    // 检查记录是否存在
    const scopedRecord = buildScopedRecordFilter(req, tenantId, id);
    const [existing] = await connection.execute(
      `SELECT ar.id, ar.event_level, ar.severity, ar.event_consequence, ar.is_serious, ar.handle_deadline, ar.status
       ${adverseReactionAssetJoin}
       ${scopedRecord.whereClause}`,
      scopedRecord.params,
    );

    if (existing.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ success: false, message: '不良事件记录不存在' });
    }

    // 检查报告编号是否已被其他记录使用
    if (report_no) {
      const [sameNo] = await connection.execute(
        'SELECT id FROM adverse_reaction_records WHERE report_no = ? AND id != ? AND tenant_id = ?',
        [report_no, id, tenantId],
      );

      if (sameNo.length > 0) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({ success: false, message: '报告编号已被其他记录使用' });
      }
    }

    if (department !== undefined) {
      const nextDepartment = department === '' ? null : department;
      if (!(await canAccessManagedDepartment(connection, req, tenantId, nextDepartment))) {
        await connection.rollback();
        connection.release();
        return res.status(403).json({ success: false, message: '无权操作该科室的不良事件记录' });
      }
    }

    // 获取资产信息（如果提供了资产ID）
    let asset_code = null;
    let asset_name = null;
    if (asset_id) {
      const assetScope = buildScopedAssetFilter(req, tenantId, asset_id);
      const [assets] = await connection.execute(
        `SELECT a.asset_code, a.asset_name FROM assets a ${assetScope.whereClause}`,
        assetScope.params,
      );
      if (assets.length === 0) {
        await connection.rollback();
        connection.release();
        return res.status(404).json({ success: false, message: '关联资产不存在或无权访问' });
      }
      asset_code = assets[0].asset_code;
      asset_name = assets[0].asset_name;
    }

    // 处理相关资产（JSON格式）
    let relatedAssetsJson = null;
    if (related_assets !== undefined) {
      if (related_assets === null || related_assets === '') {
        relatedAssetsJson = null;
      } else if (typeof related_assets === 'string') {
        relatedAssetsJson = related_assets;
      } else if (Array.isArray(related_assets)) {
        relatedAssetsJson = JSON.stringify(related_assets);
      }
    }

    // 处理涉及人员（JSON格式）
    let involvedPersonsJson = null;
    if (involved_persons !== undefined) {
      if (involved_persons === null || involved_persons === '') {
        involvedPersonsJson = null;
      } else if (typeof involved_persons === 'string') {
        involvedPersonsJson = involved_persons;
      } else if (Array.isArray(involved_persons)) {
        involvedPersonsJson = JSON.stringify(involved_persons);
      }
    }

    // 自动计算事件等级（如果严重程度或后果发生变化）
    let eventLevel = existing[0].event_level;
    if (severity || event_consequence !== undefined || is_serious !== undefined) {
      const finalSeverity = severity || existing[0].severity || '一般';
      const finalEventConsequence =
        event_consequence !== undefined
          ? event_consequence
          : existing[0].event_consequence || '无伤害';
      const finalIsSerious =
        is_serious !== undefined ? (is_serious ? 1 : 0) : existing[0].is_serious;
      eventLevel = calculateEventLevel(finalSeverity, finalEventConsequence, finalIsSerious === 1);
    }

    // 自动计算处理时限
    let handleDeadline = existing[0].handle_deadline;
    if (severity || eventLevel !== existing[0].event_level) {
      const finalSeverity = severity || existing[0].severity || '一般';
      handleDeadline = calculateHandleDeadline(finalSeverity, eventLevel);
    }

    // 检查是否超时
    let isOverdue = 0;
    if (handleDeadline && occurrence_date) {
      const hoursPassed = Math.floor((new Date() - new Date(occurrence_date)) / (1000 * 60 * 60));
      if (
        hoursPassed > handleDeadline &&
        ['待处理', '处理中'].includes(status || existing[0].status)
      ) {
        isOverdue = 1;
      }
    }

    await connection.execute(
      `UPDATE adverse_reaction_records SET
        report_no = COALESCE(?, report_no),
        asset_id = ?,
        asset_code = ?,
        asset_name = ?,
        report_type = COALESCE(?, report_type),
        event_category = ?,
        severity = COALESCE(?, severity),
        event_level = ?,
        event_consequence = COALESCE(?, event_consequence),
        occurrence_date = COALESCE(?, occurrence_date),
        discovery_date = ?,
        location = ?,
        department = ?,
        reporter = COALESCE(?, reporter),
        reporter_phone = ?,
        report_source = COALESCE(?, report_source),
        involved_persons = ?,
        description = COALESCE(?, description),
        cause_analysis = ?,
        cause_category = ?,
        impact_assessment = ?,
        handling_measures = ?,
        prevention_measures = ?,
        improvement_suggestions = ?,
        status = COALESCE(?, status),
        handler = ?,
        handle_date = ?,
        handle_result = ?,
        reviewer = ?,
        review_date = ?,
        review_comment = ?,
        is_serious = ?,
        related_assets = ?,
        handle_deadline = ?,
        is_overdue = ?,
        remark = ?,
        updated_at = NOW()
      WHERE id = ? AND tenant_id = ?`,
      [
        report_no,
        asset_id || null,
        asset_code,
        asset_name,
        report_type,
        event_category !== undefined ? event_category : null,
        severity,
        eventLevel,
        event_consequence !== undefined ? event_consequence : null,
        occurrence_date,
        discovery_date || null,
        location || null,
        department || null,
        reporter,
        reporter_phone || null,
        report_source !== undefined ? report_source : null,
        involvedPersonsJson,
        description,
        cause_analysis || null,
        cause_category !== undefined ? cause_category : null,
        impact_assessment || null,
        handling_measures || null,
        prevention_measures || null,
        improvement_suggestions !== undefined ? improvement_suggestions : null,
        status,
        handler || null,
        handle_date || null,
        handle_result || null,
        reviewer || null,
        review_date || null,
        review_comment || null,
        is_serious !== undefined ? (is_serious ? 1 : 0) : undefined,
        relatedAssetsJson,
        handleDeadline !== undefined ? handleDeadline : null,
        isOverdue,
        remark || null,
        id,
        tenantId,
      ],
    );

    await connection.commit();
    connection.release();

    res.json({
      success: true,
      message: '不良事件记录更新成功',
    });
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error('更新不良事件记录失败:', error);
    res.status(500).json({ success: false, message: '更新不良事件记录失败', error: error.message });
  }
});

// 删除不良事件记录
router.delete('/:id', authenticate, authorize(AR_WRITE_ROLES), async (req, res) => {
  const tenantId = resolveTenantIdOrRespond(req, res);
  if (!tenantId) return;

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const { id } = req.params;

    // 检查记录是否存在
    const scopedRecord = buildScopedRecordFilter(req, tenantId, id);
    const [existing] = await connection.execute(
      `SELECT ar.id
       ${adverseReactionAssetJoin}
       ${scopedRecord.whereClause}`,
      scopedRecord.params,
    );

    if (existing.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ success: false, message: '不良事件记录不存在' });
    }

    // 删除附件（外键会自动删除）
    const [attachments] = await connection.execute(
      'SELECT file_path FROM adverse_reaction_attachments WHERE record_id = ? AND tenant_id = ?',
      [id, tenantId],
    );
    for (const attachment of attachments) {
      const filePath = path.join(
        __dirname,
        '..',
        attachment.file_path.replace('/uploads/', 'uploads/'),
      );
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    // 删除记录
    await connection.execute('DELETE FROM adverse_reaction_records WHERE id = ? AND tenant_id = ?', [
      id,
      tenantId,
    ]);

    await connection.commit();
    connection.release();

    res.json({ success: true, message: '不良事件记录删除成功' });
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error('删除不良事件记录失败:', error);
    res.status(500).json({ success: false, message: '删除不良事件记录失败', error: error.message });
  }
});

// 上传不良事件附件
router.post(
  '/:id/attachments',
  authenticate,
  parseFileNameFromRequest,
  upload.array('files', 10),
  fileSecurity(),
  async (req, res) => {
    const tenantId = resolveTenantIdOrRespond(req, res);
    if (!tenantId) return;

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      const { id } = req.params;

      if (!req.files || req.files.length === 0) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({ success: false, message: '请选择要上传的文件' });
      }

      // 检查记录是否存在
      const scopedRecord = buildScopedRecordFilter(req, tenantId, id);
      const [existing] = await connection.execute(
        `SELECT ar.id
         ${adverseReactionAssetJoin}
         ${scopedRecord.whereClause}`,
        scopedRecord.params,
      );

      if (existing.length === 0) {
        await connection.rollback();
        connection.release();
        return res.status(404).json({ success: false, message: '不良事件记录不存在' });
      }

      const attachments = [];
      for (let i = 0; i < req.files.length; i++) {
        const file = req.files[i];

        // 优先使用请求体中的 originalFileName
        let fileName = null;
        if (req.body && req.body.originalFileName) {
          try {
            const originalFileNameValue = Array.isArray(req.body.originalFileName)
              ? req.body.originalFileName[i]
              : req.body.originalFileName;
            if (originalFileNameValue) {
              fileName = decodeURIComponent(originalFileNameValue);
              console.log(`[不良事件附件上传] ✅ 从请求体获取文件名: ${fileName}`);
            }
          } catch (e) {
            console.warn('[不良事件附件上传] 从请求体解码文件名失败:', e);
          }
        }

        if (!fileName) {
          fileName = req.parsedFileName || file.originalname;
        }

        // 如果文件名仍然可能是乱码，尝试修复
        if (fileName && !/[\u4e00-\u9fa5]/.test(fileName) && /[çåéè£æé«º¾´¨]/i.test(fileName)) {
          try {
            const latin1Buffer = Buffer.from(fileName, 'latin1');
            const utf8Decoded = latin1Buffer.toString('utf8');
            if (/[\u4e00-\u9fa5]/.test(utf8Decoded)) {
              fileName = utf8Decoded;
              console.log(`[不良事件附件上传] ✅ 文件名编码修复成功: ${fileName}`);
            } else {
              const encodings = ['gbk', 'gb2312', 'gb18030'];
              for (const encoding of encodings) {
                try {
                  const decoded = iconv.decode(latin1Buffer, encoding);
                  if (/[\u4e00-\u9fa5]/.test(decoded)) {
                    fileName = decoded;
                    console.log(`[不良事件附件上传] ✅ 使用 ${encoding} 编码修复成功: ${fileName}`);
                    break;
                  }
                } catch (e) {
                  // 继续尝试下一个编码
                }
              }
            }
          } catch (e) {
            console.error('[不良事件附件上传] 编码修复失败:', e);
          }
        }

        // 确保文件名安全
        fileName = sanitizeUploadFileName(fileName);

        const [result] = await connection.execute(
          `INSERT INTO adverse_reaction_attachments (tenant_id, record_id, file_name, file_path, file_size, file_type)
         VALUES (?, ?, ?, ?, ?, ?)`,
          [
            tenantId,
            id,
            fileName,
            `/uploads/adverse-reaction/${file.filename}`,
            file.size,
            file.mimetype,
          ],
        );
        attachments.push({
          id: result.insertId,
          file_name: fileName,
          file_path: `/uploads/adverse-reaction/${file.filename}`,
          file_size: file.size,
          file_type: file.mimetype,
        });
      }

      await connection.commit();
      connection.release();

      res.json({
        success: true,
        message: `成功上传 ${attachments.length} 个文件`,
        data: attachments,
      });
    } catch (error) {
      await connection.rollback();
      connection.release();
      console.error('上传不良事件附件失败:', error);
      res
        .status(500)
        .json({ success: false, message: '上传不良事件附件失败', error: error.message });
    }
  },
);

// 删除不良事件附件
router.delete('/attachments/:id', authenticate, authorize(AR_WRITE_ROLES), async (req, res) => {
  const tenantId = resolveTenantIdOrRespond(req, res);
  if (!tenantId) return;

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const { id } = req.params;

    // 获取附件信息
    const scopedAttachment = buildScopedAttachmentFilter(req, tenantId, id);
    const [attachments] = await connection.execute(
      `SELECT aa.*
       ${adverseReactionAttachmentJoin}
       ${scopedAttachment.whereClause}`,
      scopedAttachment.params,
    );

    if (attachments.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ success: false, message: '附件不存在' });
    }

    const attachment = attachments[0];

    // 删除文件
    const filePath = path.join(
      __dirname,
      '..',
      attachment.file_path.replace('/uploads/', 'uploads/'),
    );
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // 删除数据库记录
    await connection.execute('DELETE FROM adverse_reaction_attachments WHERE id = ? AND tenant_id = ?', [
      id,
      tenantId,
    ]);

    await connection.commit();
    connection.release();

    res.json({ success: true, message: '附件删除成功' });
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error('删除不良事件附件失败:', error);
    res.status(500).json({ success: false, message: '删除附件失败', error: error.message });
  }
});

// ============================================
// 工作流和审批相关接口
// ============================================

// 审批不良事件
router.post('/:id/approve', authenticate, authorize(AR_APPROVE_ROLES), async (req, res) => {
  const tenantId = resolveTenantIdOrRespond(req, res);
  if (!tenantId) return;

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const { id } = req.params;
    const { approved, comment, next_handler } = req.body;

    // 检查记录是否存在
    const scopedRecord = buildScopedRecordFilter(req, tenantId, id);
    const [records] = await connection.execute(
      `SELECT ar.*
       ${adverseReactionAssetJoin}
       ${scopedRecord.whereClause}`,
      scopedRecord.params,
    );

    if (records.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ success: false, message: '不良事件记录不存在' });
    }

    const record = records[0];

    // 检查状态
    if (!['待处理', '处理中'].includes(record.status)) {
      await connection.rollback();
      connection.release();
      return res.status(400).json({
        success: false,
        message: `该记录已处理，当前状态：${record.status}`,
      });
    }

    const operator = req.user.real_name || req.user.username || '系统管理员';
    const operationTime = new Date();

    // 更新记录状态
    let newStatus = record.status;
    let operationResult = '通过';

    if (approved === false) {
      operationResult = '拒绝';
      newStatus = '待处理';
    } else if (record.status === '待处理') {
      newStatus = '处理中';
    } else if (record.status === '处理中') {
      newStatus = '已处理';
    }

    await connection.execute(
      `UPDATE adverse_reaction_records SET
        status = ?,
        reviewer = ?,
        review_date = ?,
        review_comment = ?,
        handler = COALESCE(?, handler),
        updated_at = NOW()
      WHERE id = ? AND tenant_id = ?`,
      [newStatus, operator, operationTime, comment || null, next_handler || null, id, tenantId],
    );

    // 记录工作流
    await connection.execute(
      `INSERT INTO adverse_reaction_workflow
       (tenant_id, record_id, step_name, step_type, operator, operation_time, operation_result, comment, next_handler)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tenantId,
        id,
        approved ? '审批通过' : '审批拒绝',
        '审核',
        operator,
        operationTime,
        operationResult,
        comment || null,
        next_handler || null,
      ],
    );

    await connection.commit();
    connection.release();

    res.json({
      success: true,
      message: `审批${approved ? '通过' : '拒绝'}成功`,
      data: { status: newStatus },
    });
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error('审批不良事件失败:', error);
    res.status(500).json({ success: false, message: '审批失败', error: error.message });
  }
});

// 关闭不良事件
router.post('/:id/close', authenticate, authorize(AR_APPROVE_ROLES), async (req, res) => {
  const tenantId = resolveTenantIdOrRespond(req, res);
  if (!tenantId) return;

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const { id } = req.params;
    const { close_reason } = req.body;

    // 检查记录是否存在
    const scopedRecord = buildScopedRecordFilter(req, tenantId, id);
    const [records] = await connection.execute(
      `SELECT ar.*
       ${adverseReactionAssetJoin}
       ${scopedRecord.whereClause}`,
      scopedRecord.params,
    );

    if (records.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ success: false, message: '不良事件记录不存在' });
    }

    const operator = req.user.real_name || req.user.username || '系统管理员';
    const operationTime = new Date();

    // 更新记录状态
    await connection.execute(
      `UPDATE adverse_reaction_records SET
        status = '已关闭',
        close_reason = ?,
        updated_at = NOW()
      WHERE id = ? AND tenant_id = ?`,
      [close_reason || null, id, tenantId],
    );

    // 记录工作流
    await connection.execute(
      `INSERT INTO adverse_reaction_workflow
       (tenant_id, record_id, step_name, step_type, operator, operation_time, operation_result, comment)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [tenantId, id, '关闭事件', '关闭', operator, operationTime, '完成', close_reason || null],
    );

    await connection.commit();
    connection.release();

    res.json({
      success: true,
      message: '事件已关闭',
    });
  } catch (error) {
    await connection.rollback();
    connection.release();
    console.error('关闭不良事件失败:', error);
    res.status(500).json({ success: false, message: '关闭失败', error: error.message });
  }
});

// 获取工作流记录
router.get('/:id/workflow', authenticate, authorize(AR_GET_ROLES), async (req, res) => {
  try {
    const tenantId = resolveTenantIdOrRespond(req, res);
    if (!tenantId) return;

    const { id } = req.params;
    const scopedRecord = buildScopedRecordFilter(req, tenantId, id);
    const [records] = await db.execute(
      `SELECT ar.id
       ${adverseReactionAssetJoin}
       ${scopedRecord.whereClause}`,
      scopedRecord.params,
    );

    if (records.length === 0) {
      return res.status(404).json({ success: false, message: '不良事件记录不存在' });
    }

    const [workflow] = await db.execute(
      `SELECT * FROM adverse_reaction_workflow
       WHERE record_id = ? AND tenant_id = ?
       ORDER BY operation_time ASC`,
      [id, tenantId],
    );

    res.json({
      success: true,
      data: workflow,
    });
  } catch (error) {
    console.error('获取工作流记录失败:', error);
    res.status(500).json({ success: false, message: '获取工作流记录失败', error: error.message });
  }
});

// 自动判断事件等级
function calculateEventLevel(severity, eventConsequence, isSerious) {
  if (isSerious || eventConsequence === '死亡') {
    return 'I级';
  }
  if (eventConsequence === '重度伤害' || severity === '重大') {
    return 'II级';
  }
  if (eventConsequence === '中度伤害' || severity === '严重') {
    return 'III级';
  }
  return 'IV级';
}

// 计算处理时限（根据严重程度）
function calculateHandleDeadline(severity, eventLevel) {
  if (eventLevel === 'I级' || severity === '重大') {
    return 2; // 2小时
  }
  if (eventLevel === 'II级' || severity === '严重') {
    return 24; // 24小时
  }
  if (eventLevel === 'III级' || severity === '一般') {
    return 72; // 72小时
  }
  return 168; // 7天
}

// ============================================
// 统计分析相关接口
// ============================================

// 获取统计数据
router.get('/statistics/overview', authenticate, authorize(AR_GET_ROLES), async (req, res) => {
  try {
    const tenantId = resolveTenantIdOrRespond(req, res);
    if (!tenantId) return;

    const { start_date, end_date } = req.query;

    let whereClause = 'WHERE ar.tenant_id = ?';
    let params = [tenantId];
    ({ whereClause, params } = applyManagedDepartmentScope(req, tenantId, whereClause, params, {
      recordAlias: 'ar',
    }));

    if (start_date) {
      whereClause += ' AND occurrence_date >= ?';
      params.push(start_date);
    }

    if (end_date) {
      whereClause += ' AND occurrence_date <= ?';
      params.push(end_date);
    }

    // 总体统计
    const [totalStats] = await db.execute(
      `SELECT
        COUNT(*) as total_count,
        SUM(CASE WHEN is_serious = 1 THEN 1 ELSE 0 END) as serious_count,
        SUM(CASE WHEN is_overdue = 1 THEN 1 ELSE 0 END) as overdue_count,
        SUM(CASE WHEN status = '待处理' THEN 1 ELSE 0 END) as pending_count,
        SUM(CASE WHEN status = '处理中' THEN 1 ELSE 0 END) as processing_count,
        SUM(CASE WHEN status = '已处理' THEN 1 ELSE 0 END) as handled_count,
        SUM(CASE WHEN status = '已关闭' THEN 1 ELSE 0 END) as closed_count
       FROM adverse_reaction_records ar
       ${whereClause}`,
      params,
    );

    // 按类型统计
    const [typeStats] = await db.execute(
      `SELECT
        report_type,
        COUNT(*) as count
       FROM adverse_reaction_records ar
       ${whereClause}
       GROUP BY report_type`,
      params,
    );

    // 按严重程度统计
    const [severityStats] = await db.execute(
      `SELECT
        severity,
        COUNT(*) as count
       FROM adverse_reaction_records ar
       ${whereClause}
       GROUP BY severity`,
      params,
    );

    // 按事件等级统计
    const [levelStats] = await db.execute(
      `SELECT
        event_level,
        COUNT(*) as count
       FROM adverse_reaction_records ar
       ${whereClause}
       GROUP BY event_level`,
      params,
    );

    // 按月统计趋势
    const [monthlyStats] = await db.execute(
      `SELECT
        DATE_FORMAT(occurrence_date, '%Y-%m') as month,
        COUNT(*) as count
       FROM adverse_reaction_records ar
       ${whereClause}
       GROUP BY month
       ORDER BY month DESC
       LIMIT 12`,
      params,
    );

    res.json({
      success: true,
      data: {
        total: totalStats[0],
        byType: typeStats,
        bySeverity: severityStats,
        byLevel: levelStats,
        monthly: monthlyStats,
      },
    });
  } catch (error) {
    console.error('获取统计数据失败:', error);
    res.status(500).json({ success: false, message: '获取统计数据失败', error: error.message });
  }
});

// 获取按科室统计
router.get('/statistics/by-department', authenticate, authorize(AR_GET_ROLES), async (req, res) => {
  try {
    const tenantId = resolveTenantIdOrRespond(req, res);
    if (!tenantId) return;

    const { start_date, end_date } = req.query;
    let whereClause = 'WHERE ar.tenant_id = ?';
    let params = [tenantId];
    ({ whereClause, params } = applyManagedDepartmentScope(req, tenantId, whereClause, params, {
      recordAlias: 'ar',
    }));

    if (start_date) {
      whereClause += ' AND occurrence_date >= ?';
      params.push(start_date);
    }
    if (end_date) {
      whereClause += ' AND occurrence_date <= ?';
      params.push(end_date);
    }

    const [rows] = await db.execute(
      `SELECT
        COALESCE(ar.department, '未知') as department,
        COUNT(*) as count,
        SUM(CASE WHEN is_serious = 1 THEN 1 ELSE 0 END) as serious_count,
        SUM(CASE WHEN status = '待处理' THEN 1 ELSE 0 END) as pending_count,
        SUM(CASE WHEN status IN ('已处理','已关闭') THEN 1 ELSE 0 END) as handled_count
       FROM adverse_reaction_records ar
       ${whereClause}
       GROUP BY ar.department
       ORDER BY count DESC`,
      params,
    );

    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('获取按科室统计失败:', error);
    res.status(500).json({ success: false, message: '获取按科室统计失败', error: error.message });
  }
});

// 获取按资产统计 TOP N
router.get('/statistics/by-asset', authenticate, authorize(AR_GET_ROLES), async (req, res) => {
  try {
    const tenantId = resolveTenantIdOrRespond(req, res);
    if (!tenantId) return;

    const { start_date, end_date, limit = 10 } = req.query;
    let whereClause = 'WHERE ar.tenant_id = ? AND ar.asset_code IS NOT NULL';
    let params = [tenantId];
    ({ whereClause, params } = applyManagedDepartmentScope(req, tenantId, whereClause, params, {
      recordAlias: 'ar',
    }));

    if (start_date) {
      whereClause += ' AND occurrence_date >= ?';
      params.push(start_date);
    }
    if (end_date) {
      whereClause += ' AND occurrence_date <= ?';
      params.push(end_date);
    }

    const [rows] = await db.execute(
      `SELECT
        ar.asset_id, ar.asset_code, ar.asset_name,
        COUNT(*) as count,
        SUM(CASE WHEN ar.is_serious = 1 THEN 1 ELSE 0 END) as serious_count,
        MAX(ar.occurrence_date) as last_occurrence
       FROM adverse_reaction_records ar
       ${whereClause}
       GROUP BY ar.asset_id, ar.asset_code, ar.asset_name
       ORDER BY count DESC
       LIMIT ?`,
      [...params, parseInt(limit)],
    );

    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('获取按资产统计失败:', error);
    res.status(500).json({ success: false, message: '获取按资产统计失败', error: error.message });
  }
});

// 获取处理效率统计
router.get('/statistics/handle-efficiency', authenticate, authorize(AR_GET_ROLES), async (req, res) => {
  try {
    const tenantId = resolveTenantIdOrRespond(req, res);
    if (!tenantId) return;

    const { start_date, end_date } = req.query;
    let whereClause = 'WHERE ar.tenant_id = ?';
    let params = [tenantId];
    ({ whereClause, params } = applyManagedDepartmentScope(req, tenantId, whereClause, params, {
      recordAlias: 'ar',
    }));

    if (start_date) {
      whereClause += ' AND ar.occurrence_date >= ?';
      params.push(start_date);
    }
    if (end_date) {
      whereClause += ' AND ar.occurrence_date <= ?';
      params.push(end_date);
    }

    // 平均处理时长、超时数、各状态分布
    const [stats] = await db.execute(
      `SELECT
        COUNT(*) as total_handled,
        AVG(
          CASE
            WHEN ar.handle_date IS NOT NULL AND ar.occurrence_date IS NOT NULL
            THEN TIMESTAMPDIFF(HOUR, ar.occurrence_date, ar.handle_date)
            ELSE NULL
          END
        ) as avg_handle_hours,
        SUM(CASE WHEN ar.is_overdue = 1 THEN 1 ELSE 0 END) as overdue_count,
        SUM(CASE WHEN ar.status = '待处理' THEN 1 ELSE 0 END) as pending_count,
        SUM(CASE WHEN ar.status = '处理中' THEN 1 ELSE 0 END) as processing_count,
        SUM(CASE WHEN ar.status IN ('已处理','已关闭') THEN 1 ELSE 0 END) as completed_count
       FROM adverse_reaction_records ar
       ${whereClause}
       AND (ar.handle_date IS NOT NULL OR ar.status IN ('已处理','已关闭'))`,
      params,
    );

    res.json({ success: true, data: stats[0] || {} });
  } catch (error) {
    console.error('获取处理效率统计失败:', error);
    res.status(500).json({ success: false, message: '获取处理效率统计失败', error: error.message });
  }
});

// 导出 Excel
router.get('/export/excel', authenticate, authorize(AR_GET_ROLES), async (req, res) => {
  try {
    const tenantId = resolveTenantIdOrRespond(req, res);
    if (!tenantId) return;

    const { report_type, severity, event_level, status, keyword, start_date, end_date } = req.query;

    let whereClause = 'WHERE ar.tenant_id = ?';
    let params = [tenantId];
    ({ whereClause, params } = applyManagedDepartmentScope(req, tenantId, whereClause, params, {
      recordAlias: 'ar',
    }));

    if (report_type) {
      whereClause += ' AND ar.report_type = ?';
      params.push(report_type);
    }
    if (severity) {
      whereClause += ' AND ar.severity = ?';
      params.push(severity);
    }
    if (event_level) {
      whereClause += ' AND ar.event_level = ?';
      params.push(event_level);
    }
    if (status) {
      whereClause += ' AND ar.status = ?';
      params.push(status);
    }
    if (start_date) {
      whereClause += ' AND ar.occurrence_date >= ?';
      params.push(start_date);
    }
    if (end_date) {
      whereClause += ' AND ar.occurrence_date <= ?';
      params.push(end_date);
    }
    if (keyword) {
      whereClause += ' AND (ar.report_no LIKE ? OR ar.asset_name LIKE ? OR ar.description LIKE ?)';
      const kw = `%${keyword}%`;
      params.push(kw, kw, kw);
    }

    const [rows] = await db.execute(
      `SELECT ar.* FROM adverse_reaction_records ar ${whereClause} ORDER BY ar.occurrence_date DESC`,
      params,
    );

    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'AssetHub';
    workbook.created = new Date();
    const ws = workbook.addWorksheet('不良事件记录');

    ws.columns = [
      { header: '报告编号', key: 'report_no', width: 20 },
      { header: '报告类型', key: 'report_type', width: 14 },
      { header: '资产编号', key: 'asset_code', width: 18 },
      { header: '资产名称', key: 'asset_name', width: 24 },
      { header: '严重程度', key: 'severity', width: 12 },
      { header: '事件等级', key: 'event_level', width: 12 },
      { header: '发生时间', key: 'occurrence_date', width: 20 },
      { header: '发生科室', key: 'department', width: 16 },
      { header: '上报人', key: 'reporter', width: 14 },
      { header: '处理状态', key: 'status', width: 12 },
      { header: '处理人', key: 'handler', width: 14 },
      { header: '事件描述', key: 'description', width: 40 },
      { header: '原因分析', key: 'cause_analysis', width: 30 },
      { header: '处理措施', key: 'handling_measures', width: 30 },
      { header: '预防措施', key: 'prevention_measures', width: 30 },
      { header: '处理结果', key: 'handle_result', width: 30 },
      { header: '是否超时', key: 'is_overdue', width: 12 },
      { header: '创建人', key: 'created_by', width: 14 },
      { header: '创建时间', key: 'created_at', width: 20 },
    ];

    // 样式
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1890FF' } };
    ws.getRow(1).alignment = { horizontal: 'center', vertical: 'middle' };

    for (const row of rows) {
      ws.addRow({
        report_no: row.report_no,
        report_type: row.report_type,
        asset_code: row.asset_code,
        asset_name: row.asset_name,
        severity: row.severity,
        event_level: row.event_level,
        occurrence_date: row.occurrence_date ? new Date(row.occurrence_date).toISOString().replace('T', ' ').substring(0, 19) : '',
        department: row.department,
        reporter: row.reporter,
        status: row.status,
        handler: row.handler,
        description: row.description,
        cause_analysis: row.cause_analysis,
        handling_measures: row.handling_measures,
        prevention_measures: row.prevention_measures,
        handle_result: row.handle_result,
        is_overdue: row.is_overdue === 1 ? '是' : '否',
        created_by: row.created_by,
        created_at: row.created_at ? new Date(row.created_at).toISOString().replace('T', ' ').substring(0, 19) : '',
      });
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=不良事件记录_${new Date().toISOString().substring(0, 10)}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('导出 Excel 失败:', error);
    res.status(500).json({ success: false, message: '导出 Excel 失败', error: error.message });
  }
});

// 获取超时提醒列表
router.get('/alerts/overdue', authenticate, authorize(AR_GET_ROLES), async (req, res) => {
  try {
    const tenantId = resolveTenantIdOrRespond(req, res);
    if (!tenantId) return;

    let whereClause = `WHERE ar.tenant_id = ?
       AND ar.status IN ('待处理', '处理中')
       AND (
         (handle_deadline IS NOT NULL AND TIMESTAMPDIFF(HOUR, occurrence_date, NOW()) > handle_deadline)
         OR (handle_deadline IS NULL AND TIMESTAMPDIFF(HOUR, occurrence_date, NOW()) > 72)
       )`;
    let params = [tenantId];
    ({ whereClause, params } = applyManagedDepartmentScope(req, tenantId, whereClause, params, {
      recordAlias: 'ar',
    }));

    const [overdue] = await db.execute(
      `SELECT ar.*,
        TIMESTAMPDIFF(HOUR, occurrence_date, NOW()) as hours_passed,
        handle_deadline
       FROM adverse_reaction_records ar
       ${whereClause}
       ORDER BY occurrence_date ASC
       LIMIT 50`,
      params,
    );

    res.json({
      success: true,
      data: overdue,
    });
  } catch (error) {
    console.error('获取超时提醒失败:', error);
    res.status(500).json({ success: false, message: '获取超时提醒失败', error: error.message });
  }
});

module.exports = router;
