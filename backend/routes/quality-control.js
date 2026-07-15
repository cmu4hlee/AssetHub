const express = require('express');
const router = express.Router();
const fs = require('fs');
const multer = require('multer');
const path = require('path');
const { authenticate, authorize } = require('../middleware/auth');

// 质量控制模块权限集合（仅用于质控记录，不含计量）
const QC_GET_ROLES = ['quality_control.view_all', 'quality_control.view_own_department', 'asset.view_all', 'asset.view_own_department', 'maintenance.view'];
const QC_WRITE_ROLES = ['quality_control.edit_all', 'quality_control.edit_own_department', 'asset.edit_all', 'asset.edit_own_department'];
const QC_APPROVE_ROLES = ['quality_control.approve'];

// 计量管理权限集合（独立于质量控制）
const MT_GET_ROLES = ['metrology.view', 'quality_control.view_all', 'quality_control.view_own_department', 'asset.view_all', 'asset.view_own_department'];
const MT_WRITE_ROLES = ['metrology.edit', 'quality_control.edit_all', 'quality_control.edit_own_department', 'asset.edit_all', 'asset.edit_own_department'];
const { addTenantFilter, getTenantId } = require('../middleware/tenant-filter');
const { fileSecurity } = require('../middleware/fileSecurity');
const MetrologyService = require('../services/metrology-service');
const MetrologyImportService = require('../services/metrology-import.service');
const QualityControlService = require('../services/quality-control-service');
const ImageAnalysisService = require('../services/image-analysis-service');
const { AppError, ValidationUtil } = require('../utils/error-handler');

// 配置文件上传
const storage = multer.diskStorage({
  destination(req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads');
    // 确保上传目录存在
    const fs = require('fs');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename(req, file, cb) {
    // 生成唯一文件名
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `metrology-report-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const fileFilter = (req, file, cb) => {
  // 允许图像文件和PDF文件
  if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new AppError('只允许上传图像文件和PDF文件', 400, 'INVALID_FILE_TYPE'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 限制文件大小为10MB
  },
});

// ============================================
// 计量记录附件 - 多文件上传（支持证书/报告/Word/Excel/PDF/图片）
// ============================================

const attachmentStorage = multer.diskStorage({
  destination(req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads/metrology-attachments');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename(req, file, cb) {
    const { id } = req.params;
    const timestamp = Date.now();
    const random = Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `metrology-${id}-${timestamp}-${random}${ext}`);
  },
});

const attachmentFileFilter = (req, file, cb) => {
  const allowed = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/bmp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
  ];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError(`不支持的文件类型: ${file.mimetype}`, 400, 'INVALID_FILE_TYPE'), false);
  }
};

const attachmentUpload = multer({
  storage: attachmentStorage,
  fileFilter: attachmentFileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
    files: 10,
  },
});

// 计量证书批量导入（Excel，内存存储，不落盘）
const importUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter(req, file, cb) {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const ok =
      ['.xlsx', '.xls'].includes(ext) ||
      /excel|spreadsheet|officedocument/.test(file.mimetype || '');
    if (ok) {
      cb(null, true);
    } else {
      cb(new AppError('仅支持 Excel 文件（.xlsx / .xls）', 400, 'INVALID_FILE_TYPE'), false);
    }
  },
});

// 解析多文件的 originalFileName（前端 formData.append('originalFileName', ...) 可能多值）
const parseFileNamesFromRequest = (req, res, next) => {
  req.parsedFileNames = [];
  // Express 4 默认会把同名 form 字段聚合成数组
  const raw = req.body && req.body.originalFileName;
  if (Array.isArray(raw)) {
    req.parsedFileNames = raw.map(v => {
      try {
        return decodeURIComponent(v);
      } catch (e) {
        return v;
      }
    });
  } else if (typeof raw === 'string') {
    try {
      req.parsedFileNames = [decodeURIComponent(raw)];
    } catch (e) {
      req.parsedFileNames = [raw];
    }
  }
  next();
};

const handleAttachmentMulterError = (err, req, res, next) => {
  if (err) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ success: false, message: '文件大小超过限制（最大50MB）' });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ success: false, message: '文件数量超过限制（最多10个）' });
    }
    if (err.message && (err.message.includes('不支持的文件类型') || err.statusCode === 400)) {
      return res.status(400).json({ success: false, message: err.message });
    }
    return res.status(400).json({ success: false, message: `文件上传失败: ${err.message}` });
  }
  return next();
};

function sendAttachmentResult(res, result) {
  if (result.statusCode && result.statusCode !== 200) {
    return res.status(result.statusCode).json(result.body);
  }
  if (result.body) {
    return res.json(result.body);
  }
  return res.json(result);
}

// ============================================
// 计量管理相关接口
// ============================================

// 获取计量记录列表
router.get('/metrology', authenticate, authorize(MT_GET_ROLES), async (req, res) => {
  try {
    const {
      page = 1,
      pageSize = 10,
      keyword,
      metrology_type,
      result,
      status,
      start_date,
      end_date,
    } = req.query;

    // 添加租户过滤
    const tenantFilter = addTenantFilter(req, 'm');

    const serviceResult = await MetrologyService.getMetrologyRecords(
      {
        page,
        pageSize,
        keyword,
        metrology_type,
        result,
        status,
        start_date,
        end_date,
      },
      tenantFilter,
    );

    res.json({
      success: true,
      ...serviceResult,
    });
  } catch (error) {
    console.error('获取计量记录失败:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || '获取计量记录失败',
      error: error.message,
    });
  }
});

// ============================================
// 计量证书批量导入（支持关联资产 / 未关联资产，能够关联就关联）
// ============================================

function pickImportFile(req) {
  if (req.file) return req.file;
  if (req.files && typeof req.files === 'object') {
    const files = Object.values(req.files).flat();
    if (files.length > 0) return files[0];
  }
  return null;
}

function resolveImportBuffer(uploadedFile) {
  if (!uploadedFile) return null;
  if (Buffer.isBuffer(uploadedFile.buffer)) return uploadedFile.buffer;
  if (uploadedFile.buffer instanceof Uint8Array) return Buffer.from(uploadedFile.buffer);
  return null;
}

// 下载导入模板
router.get('/metrology/import-template', authenticate, authorize(MT_GET_ROLES), async (req, res) => {
  try {
    const buffer = await MetrologyImportService.buildImportTemplateBuffer();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="metrology_certificate_import_template.xlsx"',
    );
    res.send(buffer);
  } catch (error) {
    console.error('生成计量导入模板失败:', error);
    res.status(500).json({ success: false, message: '生成模板失败' });
  }
});

// 预校验：解析 + 资产关联 + 校验（不入库），返回可导入/异常明细与关联状态
router.post(
  '/metrology/import/validate',
  authenticate,
  authorize(MT_WRITE_ROLES),
  importUpload.single('file'),
  fileSecurity(),
  async (req, res) => {
    try {
      const uploadedFile = pickImportFile(req);
      if (!uploadedFile) {
        return res.status(400).json({ success: false, message: '请选择要上传的 Excel 文件' });
      }
      const fileBuffer = resolveImportBuffer(uploadedFile);
      const { rows } = await MetrologyImportService.parseMetrologyImportBuffer(fileBuffer);
      const tenantId = getTenantId(req);
      const { validRows, failedRows, associatedCount, unassociatedCount } =
        await MetrologyImportService.validateMetrologyImportRows(rows, tenantId);
      return res.json({
        success: true,
        message: `预校验完成：可导入 ${validRows.length} 条（已关联 ${associatedCount} / 未关联 ${unassociatedCount}），异常 ${failedRows.length} 条`,
        totalRows: rows.length,
        validCount: validRows.length,
        invalidCount: failedRows.length,
        associatedCount,
        unassociatedCount,
        failedRows,
        preview: validRows.map(item => ({
          rowNumber: item.rowNumber,
          rowData: item.rowData,
          association: item.association,
        })),
      });
    } catch (error) {
      console.error('计量证书导入预校验失败:', error);
      return res.status(400).json({ success: false, message: error.message || '预校验失败' });
    }
  },
);

// 执行导入
router.post(
  '/metrology/import',
  authenticate,
  authorize(MT_WRITE_ROLES),
  importUpload.single('file'),
  fileSecurity(),
  async (req, res) => {
    try {
      const uploadedFile = pickImportFile(req);
      if (!uploadedFile) {
        return res.status(400).json({ success: false, message: '请选择要上传的 Excel 文件' });
      }
      const fileBuffer = resolveImportBuffer(uploadedFile);
      const { rows } = await MetrologyImportService.parseMetrologyImportBuffer(fileBuffer);
      const tenantId = getTenantId(req);
      const { validRows, failedRows } = await MetrologyImportService.validateMetrologyImportRows(
        rows,
        tenantId,
      );
      const {
        successCount,
        failedRows: persistedFailedRows,
        associatedCount,
        unassociatedCount,
      } = await MetrologyImportService.importMetrologyRecords(validRows, tenantId, req.user.username);
      const allFailed = [...failedRows, ...persistedFailedRows];
      return res.json({
        success: true,
        message: `导入完成：成功 ${successCount} 条（已关联 ${associatedCount} / 未关联 ${unassociatedCount}），失败 ${allFailed.length} 条`,
        totalRows: rows.length,
        successCount,
        failedCount: allFailed.length,
        associatedCount,
        unassociatedCount,
        failedRows: allFailed,
      });
    } catch (error) {
      console.error('计量证书导入失败:', error);
      return res.status(400).json({ success: false, message: error.message || '导入失败' });
    }
  },
);

// 获取计量统计分析 - 修复路由优先级问题
router.get('/metrology/statistics', authenticate, authorize(MT_GET_ROLES), async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    // 添加租户过滤
    const tenantFilter = addTenantFilter(req, 'm');

    const result = await MetrologyService.getMetrologyStatistics(
      {
        start_date,
        end_date,
      },
      tenantFilter,
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('获取计量统计失败:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || '获取计量统计失败',
      error: error.message,
    });
  }
});

// 获取高级计量统计分析
router.get('/metrology/statistics/advanced', authenticate, authorize(MT_GET_ROLES), async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    // 添加租户过滤
    const tenantFilter = addTenantFilter(req, 'm');

    const result = await MetrologyService.getAdvancedMetrologyStatistics(
      {
        start_date,
        end_date,
      },
      tenantFilter,
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('获取高级计量统计失败:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || '获取高级计量统计失败',
      error: error.message,
    });
  }
});

// 获取即将到期计量记录 - 修复路由优先级问题
router.get('/metrology/expiring', authenticate, authorize(MT_GET_ROLES), async (req, res) => {
  try {
    const { days = 30 } = req.query;

    // 添加租户过滤
    const tenantFilter = addTenantFilter(req, 'm');

    const result = await MetrologyService.getExpiringMetrologyRecords(
      {
        days,
      },
      tenantFilter,
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('获取即将到期计量记录失败:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || '获取即将到期计量记录失败',
      error: error.message,
    });
  }
});

// 计量记录详情 - 参数化路由放在具体路由之后
router.get('/metrology/:id', authenticate, authorize(MT_GET_ROLES), async (req, res) => {
  try {
    const { id } = req.params;

    // 添加租户过滤
    const tenantFilter = addTenantFilter(req, 'm');

    const result = await MetrologyService.getMetrologyRecordById(id, tenantFilter);

    if (!result) {
      return res.status(404).json({ success: false, message: '计量记录不存在' });
    }

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('获取计量记录详情失败:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || '获取计量记录详情失败',
      error: error.message,
    });
  }
});

// 创建计量记录
router.post('/metrology', authenticate, authorize(MT_WRITE_ROLES), async (req, res) => {
  try {
    const {
      asset_code,
      metrology_type,
      metrology_date,
      next_metrology_date,
      metrology_agency,
      certificate_no,
      result = '待检',
      accuracy_level,
      measurement_range,
      cost = 0,
      operator,
      remark,
      status = '待检',
      metrology_cycle,
      warning_days = 30,
    } = req.body;

    // 获取租户ID
    const tenant_id = getTenantId(req);

    const resultData = await MetrologyService.createMetrologyRecord(
      {
        asset_code,
        metrology_type,
        metrology_date,
        next_metrology_date,
        metrology_agency,
        certificate_no,
        result,
        accuracy_level,
        measurement_range,
        cost,
        operator,
        remark,
        status,
        metrology_cycle,
        warning_days,
      },
      tenant_id,
      req.user.username,
    );

    res.json({
      success: true,
      message: '计量记录创建成功',
      data: resultData,
    });
  } catch (error) {
    console.error('创建计量记录失败:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || '创建计量记录失败',
      error: error.message,
    });
  }
});

// 更新计量记录
router.put('/metrology/:id', authenticate, authorize(MT_WRITE_ROLES), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      asset_code,
      metrology_type,
      metrology_date,
      next_metrology_date,
      metrology_agency,
      certificate_no,
      result,
      accuracy_level,
      measurement_range,
      cost,
      operator,
      remark,
      status,
      metrology_cycle,
      warning_days,
    } = req.body;

    // 获取租户ID
    const tenant_id = getTenantId(req);

    const resultData = await MetrologyService.updateMetrologyRecord(
      id,
      {
        asset_code,
        metrology_type,
        metrology_date,
        next_metrology_date,
        metrology_agency,
        certificate_no,
        result,
        accuracy_level,
        measurement_range,
        cost,
        operator,
        remark,
        status,
        metrology_cycle,
        warning_days,
      },
      tenant_id,
      req.user.username,
    );

    res.json({
      success: true,
      message: '计量记录更新成功',
      data: resultData,
    });
  } catch (error) {
    console.error('更新计量记录失败:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || '更新计量记录失败',
      error: error.message,
    });
  }
});

// 删除计量记录
router.delete('/metrology/:id', authenticate, authorize(MT_WRITE_ROLES), async (req, res) => {
  try {
    const { id } = req.params;

    // 获取租户ID
    const tenant_id = getTenantId(req);

    await MetrologyService.deleteMetrologyRecord(id, tenant_id, req.user.username);

    res.json({
      success: true,
      message: '计量记录删除成功',
    });
  } catch (error) {
    console.error('删除计量记录失败:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || '删除计量记录失败',
      error: error.message,
    });
  }
});

// ============================================
// 质量控制相关接口
// ============================================

async function getQualityControlListHandler(req, res) {
  try {
    const { page = 1, pageSize = 10, keyword, qc_type, result, status, start_date, end_date } = req.query;

    // 添加租户过滤
    const tenantFilter = addTenantFilter(req, 'q');

    const resultData = await QualityControlService.getQualityControlRecords(
      {
        page,
        pageSize,
        keyword,
        qc_type,
        result,
        status,
        start_date,
        end_date,
      },
      tenantFilter,
    );

    res.json({
      success: true,
      ...resultData,
    });
  } catch (error) {
    console.error('获取质量控制记录失败:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || '获取质量控制记录失败',
      error: error.message,
    });
  }
}

async function getQualityControlStatisticsHandler(req, res) {
  try {
    const { start_date, end_date } = req.query;

    // 添加租户过滤
    const tenantFilter = addTenantFilter(req, 'q');

    const result = await QualityControlService.getQualityControlStatistics(
      {
        start_date,
        end_date,
      },
      tenantFilter,
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('获取质量控制统计失败:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || '获取质量控制统计失败',
      error: error.message,
    });
  }
}

async function getAdvancedQualityControlStatisticsHandler(req, res) {
  try {
    const { start_date, end_date } = req.query;

    // 添加租户过滤
    const tenantFilter = addTenantFilter(req, 'q');

    const result = await QualityControlService.getAdvancedQualityControlStatistics(
      {
        start_date,
        end_date,
      },
      tenantFilter,
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('获取高级质量控制统计失败:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || '获取高级质量控制统计失败',
      error: error.message,
    });
  }
}

async function getExpiringQualityControlRecordsHandler(req, res) {
  try {
    const { days = 30 } = req.query;

    // 添加租户过滤
    const tenantFilter = addTenantFilter(req, 'q');

    const result = await QualityControlService.getExpiringQualityControlRecords(
      {
        days,
      },
      tenantFilter,
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('获取即将到期质控记录失败:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || '获取即将到期质控记录失败',
      error: error.message,
    });
  }
}

// 兼容历史路径：/api/quality-control 与 /api/quality-control/quality-control 并存
router.get('/', authenticate, authorize(QC_GET_ROLES), getQualityControlListHandler);
router.get('/quality-control', authenticate, authorize(QC_GET_ROLES), getQualityControlListHandler);
router.get('/statistics', authenticate, authorize(QC_GET_ROLES), getQualityControlStatisticsHandler);
router.get('/quality-control/statistics', authenticate, authorize(QC_GET_ROLES), getQualityControlStatisticsHandler);
router.get('/statistics/advanced', authenticate, authorize(QC_GET_ROLES), getAdvancedQualityControlStatisticsHandler);
router.get(
  '/quality-control/statistics/advanced',
  authenticate,
  getAdvancedQualityControlStatisticsHandler,
);
router.get('/expiring', authenticate, authorize(QC_GET_ROLES), getExpiringQualityControlRecordsHandler);
router.get('/quality-control/expiring', authenticate, authorize(QC_GET_ROLES), getExpiringQualityControlRecordsHandler);

// ============================================
// 资产关联功能
// ============================================

// 获取资产质量管理历史
router.get('/asset/:assetCode/history', authenticate, authorize(QC_GET_ROLES), async (req, res) => {
  try {
    const { assetCode } = req.params;

    // 添加租户过滤
    const tenantFilter = addTenantFilter(req, 'm');

    const history = await QualityControlService.getAssetQualityHistory(assetCode, tenantFilter);

    res.json({
      success: true,
      data: history,
    });
  } catch (error) {
    console.error('获取资产质量管理历史失败:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || '获取资产质量管理历史失败',
      error: error.message,
    });
  }
});

// ============================================
// 智能读取报告功能
// ============================================

// 上传计量报告并进行智能分析（支持图像和PDF）
router.post(
  '/metrology/analyze-report',
  authenticate,
  upload.single('reportFile'),
  fileSecurity(),
  async (req, res) => {
    try {
      if (!req.file) {
        throw new AppError('请上传计量报告文件', 400, 'NO_FILE_UPLOADED');
      }

      // 添加租户过滤
      const tenantFilter = addTenantFilter(req, 'm');

      let analysisResult;

      // 根据文件类型选择适当的分析服务
      if (req.file.mimetype === 'application/pdf') {
        // PDF文件分析
        const PdfAnalysisService = require('../services/pdf-analysis-service');
        analysisResult = await PdfAnalysisService.analyzeMetrologyReportPdf(
          req.file.path,
          tenantFilter,
        );
      } else if (req.file.mimetype.startsWith('image/')) {
        // 图像文件分析
        analysisResult = await ImageAnalysisService.analyzeMetrologyReport(
          req.file.path,
          tenantFilter,
        );
      } else {
        throw new AppError('不支持的文件类型', 400, 'UNSUPPORTED_FILE_TYPE');
      }

      res.json({
        success: true,
        message: '报告分析成功',
        data: analysisResult,
      });
    } catch (error) {
      console.error('计量报告分析失败:', error);
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || '计量报告分析失败',
        error: error.message,
      });
    } finally {
      // 清理上传的文件
      if (req.file) {
        const fs = require('fs');
        setTimeout(() => {
          try {
            fs.unlinkSync(req.file.path);
          } catch (err) {
            console.error('删除临时文件失败:', err);
          }
        }, 1000); // 延迟1秒删除文件，确保处理完成
      }
    }
  },
);

// 从文件分析结果创建计量记录（支持图像和PDF）
router.post('/metrology/from-file', authenticate, authorize(MT_WRITE_ROLES), upload.single('reportFile'), fileSecurity(), async (req, res) => {
  try {
    if (!req.file) {
      throw new AppError('请上传计量报告文件', 400, 'NO_FILE_UPLOADED');
    }

    // 添加租户过滤
    const tenantFilter = addTenantFilter(req, 'm');

    let analysisResult;

    // 根据文件类型选择适当的分析服务
    if (req.file.mimetype === 'application/pdf') {
      // PDF文件分析
      const PdfAnalysisService = require('../services/pdf-analysis-service');
      analysisResult = await PdfAnalysisService.analyzeMetrologyReportPdf(
        req.file.path,
        tenantFilter,
      );

      // 使用PDF分析结果创建计量记录
      const recordResult = await PdfAnalysisService.createMetrologyRecordFromPdf(
        analysisResult,
        tenantFilter,
        req.user.username,
      );

      res.json({
        success: true,
        message: '计量记录创建成功',
        data: {
          analysis: analysisResult,
          record: recordResult,
        },
      });
    } else if (req.file.mimetype.startsWith('image/')) {
      // 图像文件分析
      analysisResult = await ImageAnalysisService.analyzeMetrologyReport(
        req.file.path,
        tenantFilter,
      );

      // 使用图像分析结果创建计量记录
      const recordResult = await ImageAnalysisService.createMetrologyRecordFromImage(
        analysisResult,
        tenantFilter,
        req.user.username,
      );

      res.json({
        success: true,
        message: '计量记录创建成功',
        data: {
          analysis: analysisResult,
          record: recordResult,
        },
      });
    } else {
      throw new AppError('不支持的文件类型', 400, 'UNSUPPORTED_FILE_TYPE');
    }
  } catch (error) {
    console.error('从文件创建计量记录失败:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || '从文件创建计量记录失败',
      error: error.message,
    });
  } finally {
    // 清理上传的文件
    if (req.file) {
      const fs = require('fs');
      setTimeout(() => {
        try {
          fs.unlinkSync(req.file.path);
        } catch (err) {
          console.error('删除临时文件失败:', err);
        }
      }, 1000); // 延迟1秒删除文件，确保处理完成
    }
  }
});

// ============================================
// 质量控制记录 CRUD 操作
// ============================================

// ============================================
// 质量报告生成
// ============================================

const QualityReportGenerator = require('../services/quality-report-generator');

// 生成计量质量报告
router.get('/reports/metrology', authenticate, authorize(MT_GET_ROLES), async (req, res) => {
  try {
    const { start_date, end_date, format = 'json' } = req.query;

    // 添加租户过滤
    const tenantFilter = addTenantFilter(req, 'm');

    const report = await QualityReportGenerator.generateMetrologyReport(
      {
        start_date,
        end_date,
        format,
      },
      tenantFilter,
    );

    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    console.error('生成计量质量报告失败:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || '生成计量质量报告失败',
      error: error.message,
    });
  }
});

// 生成质量控制报告
router.get('/reports/quality-control', authenticate, authorize(QC_GET_ROLES), async (req, res) => {
  try {
    const { start_date, end_date, format = 'json' } = req.query;

    // 添加租户过滤
    const tenantFilter = addTenantFilter(req, 'q');

    const report = await QualityReportGenerator.generateQualityControlReport(
      {
        start_date,
        end_date,
        format,
      },
      tenantFilter,
    );

    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    console.error('生成质量控制报告失败:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || '生成质量控制报告失败',
      error: error.message,
    });
  }
});

// 生成综合质量报告
router.get('/reports/comprehensive', authenticate, authorize(QC_GET_ROLES), async (req, res) => {
  try {
    const { start_date, end_date, format = 'json' } = req.query;

    // 添加租户过滤
    const tenantFilter = addTenantFilter(req, 'm'); // 使用m作为通用过滤

    const report = await QualityReportGenerator.generateComprehensiveQualityReport(
      {
        start_date,
        end_date,
        format,
      },
      tenantFilter,
    );

    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    console.error('生成综合质量报告失败:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || '生成综合质量报告失败',
      error: error.message,
    });
  }
});

// ============================================
// 质量控制记录 CRUD 操作
// ============================================

async function getQualityControlDetailHandler(req, res) {
  try {
    const { id } = req.params;

    // 添加租户过滤
    const tenantFilter = addTenantFilter(req, 'q');

    const result = await QualityControlService.getQualityControlRecordById(id, tenantFilter);

    if (!result) {
      return res.status(404).json({ success: false, message: '质量控制记录不存在' });
    }

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('获取质量控制记录详情失败:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || '获取质量控制记录详情失败',
      error: error.message,
    });
  }
}

async function createQualityControlRecordHandler(req, res) {
  try {
    const {
      asset_code,
      qc_type,
      qc_date,
      qc_item,
      standard_value,
      actual_value,
      tolerance,
      result,
      qc_method,
      qc_person,
      department,
      remark,
      status = '待处理',
    } = req.body;

    // 获取租户ID
    const tenant_id = getTenantId(req);

    const resultData = await QualityControlService.createQualityControlRecord(
      {
        asset_code,
        qc_type,
        qc_date,
        qc_item,
        standard_value,
        actual_value,
        tolerance,
        result,
        qc_method,
        qc_person,
        department,
        remark,
        status,
      },
      tenant_id,
      req.user.username,
    );

    res.json({
      success: true,
      message: '质量控制记录创建成功',
      data: resultData,
    });
  } catch (error) {
    console.error('创建质量控制记录失败:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || '创建质量控制记录失败',
      error: error.message,
    });
  }
}

async function updateQualityControlRecordHandler(req, res) {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // 添加租户过滤
    const tenantFilter = addTenantFilter(req, 'q');

    const result = await QualityControlService.updateQualityControlRecord(
      id,
      updateData,
      tenantFilter,
      req.user.username,
    );

    res.json({
      success: true,
      message: '质量控制记录更新成功',
      data: result,
    });
  } catch (error) {
    console.error('更新质量控制记录失败:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || '更新质量控制记录失败',
      error: error.message,
    });
  }
}

async function deleteQualityControlRecordHandler(req, res) {
  try {
    const { id } = req.params;

    // 添加租户过滤
    const tenantFilter = addTenantFilter(req, 'q');

    const result = await QualityControlService.deleteQualityControlRecord(id, tenantFilter);

    res.json({
      success: true,
      message: '质量控制记录删除成功',
      data: result,
    });
  } catch (error) {
    console.error('删除质量控制记录失败:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || '删除质量控制记录失败',
      error: error.message,
    });
  }
}

router.get('/quality-control/:id', authenticate, authorize(QC_GET_ROLES), getQualityControlDetailHandler);
router.get('/:id', authenticate, authorize(QC_GET_ROLES), getQualityControlDetailHandler);
router.post('/quality-control', authenticate, authorize(QC_WRITE_ROLES), createQualityControlRecordHandler);
router.post('/', authenticate, authorize(QC_WRITE_ROLES), createQualityControlRecordHandler);
router.put('/quality-control/:id', authenticate, authorize(QC_WRITE_ROLES), updateQualityControlRecordHandler);
router.put('/:id', authenticate, authorize(QC_WRITE_ROLES), updateQualityControlRecordHandler);
router.delete('/quality-control/:id', authenticate, authorize(QC_WRITE_ROLES), deleteQualityControlRecordHandler);
router.delete('/:id', authenticate, authorize(QC_WRITE_ROLES), deleteQualityControlRecordHandler);

// ============================================
// 计量记录附件管理
// ============================================

// 获取附件列表
router.get('/metrology/:id/attachments', authenticate, authorize(MT_GET_ROLES), async (req, res) => {
  try {
    const result = await MetrologyService.getMetrologyAttachments(req.params.id, req);
    sendAttachmentResult(res, result);
  } catch (error) {
    console.error('获取计量附件列表失败:', error);
    res.status(500).json({ success: false, message: '获取附件列表失败', error: error.message });
  }
});

// 上传附件（多文件）
router.post(
  '/metrology/:id/attachments',
  authenticate,
  parseFileNamesFromRequest,
  attachmentUpload.array('files', 10),
  fileSecurity(),
  handleAttachmentMulterError,
  async (req, res) => {
    try {
      const result = await MetrologyService.uploadMetrologyAttachments(req.params.id, req);
      sendAttachmentResult(res, result);
    } catch (error) {
      console.error('计量附件上传失败:', error);
      res.status(500).json({ success: false, message: '附件上传失败', error: error.message });
    }
  },
);

// 获取单个附件（用于浏览器直链下载/预览）
router.get('/metrology/:metrologyId/attachments/:attachmentId', authenticate, authorize(MT_GET_ROLES), async (req, res) => {
  try {
    const { metrologyId, attachmentId } = req.params;
    const result = await MetrologyService.getMetrologyAttachment(metrologyId, attachmentId, req);
    if (result.statusCode && result.statusCode !== 200) {
      return res.status(result.statusCode).json(result.body);
    }
    const { attachment, filePath } = result.data;
    if (attachment.file_type && attachment.file_type.startsWith('image/')) {
      res.setHeader('Content-Type', attachment.file_type);
      res.setHeader('Cache-Control', 'public, max-age=31536000');
    }
    return res.sendFile(path.resolve(filePath));
  } catch (error) {
    console.error('获取计量附件失败:', error);
    res.status(500).json({ success: false, message: '获取附件失败', error: error.message });
  }
});

// 删除附件
router.delete('/metrology/attachments/:id', authenticate, authorize(MT_WRITE_ROLES), async (req, res) => {
  try {
    const result = await MetrologyService.deleteMetrologyAttachment(req.params.id, req);
    sendAttachmentResult(res, result);
  } catch (error) {
    console.error('删除计量附件失败:', error);
    res.status(500).json({ success: false, message: '删除附件失败', error: error.message });
  }
});

module.exports = router;
