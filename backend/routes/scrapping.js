const express = require('express');
const router = express.Router();
const db = require('../config/database');
const logger = require('../config/logger');
const { authenticate, requireSystemAdmin, authorize } = require('../middleware/auth');

// 报废管理权限集合
const SCRAP_VIEW_ROLES = ['scrapping.view', 'asset.view_all', 'asset.view_own_department'];
const SCRAP_WRITE_ROLES = ['scrapping.apply', 'asset.edit_all', 'asset.edit_own_department'];
const SCRAP_APPROVE_ROLES = ['scrapping.approve', 'asset.edit_all'];
const { auditLogger } = require('../middleware/auditLogger');
const { addTenantFilter, getTenantId, requireTenantId } = require('../middleware/tenant-filter');
const eventBus = require('../core/EventBus').getEventBus();
const fs = require('fs');
const path = require('path');
const multer = require('multer');

// 安全发布事件
function safeEmit(eventName, payload) {
  try { eventBus.emit(eventName, payload || {}); } catch (e) { /* 静默 */ }
}
const crypto = require('crypto');
const { fileSecurity } = require('../middleware/fileSecurity');

// 配置multer中间件（用于文件上传）
const storage = multer.diskStorage({
  destination(req, file, cb) {
    const uploadPath = path.join(__dirname, '../uploads/scrapping-files');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename(req, file, cb) {
    const timestamp = Date.now();
    const random = Math.round(Math.random() * 1e9);
    const uuidFragment = crypto.randomBytes(4).toString('hex');
    const fileExt = path.extname(file.originalname);
    const fileName = `${timestamp}-${random}-${uuidFragment}${fileExt}`;
    cb(null, fileName);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB限制
  },
});

// 创建报废申请
router.post('/', authenticate, requireTenantId, authorize(SCRAP_WRITE_ROLES), auditLogger('create', 'scrapping'), async (req, res) => {
  try {
    const {
      asset_code,
      asset_name,
      asset_model,
      department,
      applicant,
      applicant_id,
      scrapping_reason,
      estimated_value,
      remark,
    } = req.body;

    const tenantId = getTenantId(req);
    const applyDate = new Date();

    // 验证必填字段
    if (!asset_code || !asset_name || !applicant || !scrapping_reason) {
      return res.status(400).json({
        success: false,
        message: '资产编码、资产名称、申请人和报废原因不能为空',
      });
    }

    // 验证字段长度
    if (String(asset_code).length > 100) {
      return res.status(400).json({ success: false, message: '资产编码长度不能超过100个字符' });
    }
    if (String(asset_name).length > 200) {
      return res.status(400).json({ success: false, message: '资产名称长度不能超过200个字符' });
    }
    if (String(applicant).length > 100) {
      return res.status(400).json({ success: false, message: '申请人长度不能超过100个字符' });
    }
    if (String(scrapping_reason).length > 1000) {
      return res.status(400).json({ success: false, message: '报废原因长度不能超过1000个字符' });
    }

    // 插入报废记录（将undefined转换为null）
    const insertParams = [
      asset_code,
      asset_name,
      asset_model ?? null,
      department ?? null,
      applicant,
      applicant_id ?? null,
      applyDate,
      scrapping_reason,
      estimated_value ?? null,
      'pending',
      remark ?? null,
      tenantId,
      applyDate,
      applyDate,
    ];
    const result = await db.execute(
      `INSERT INTO asset_scrapping_records
       (asset_code, asset_name, asset_model, department, applicant, applicant_id,
        apply_date, scrapping_reason, estimated_value, current_status, remark, tenant_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      insertParams,
    );

    console.log('创建报废申请结果:', JSON.stringify(result, null, 2));
    console.log('result类型:', typeof result);
    console.log('result是否为数组:', Array.isArray(result));

    // 正确获取insertId
    let insertId = 'unknown';
    if (Array.isArray(result) && result.length > 0) {
      console.log('result[0]:', JSON.stringify(result[0], null, 2));
      console.log('result[0].insertId:', result[0].insertId);
      // 处理数组格式的结果
      if (result[0] && typeof result[0] === 'object') {
        if (result[0].insertId) {
          insertId = result[0].insertId;
        }
      }
    } else if (result && result.insertId) {
      // 处理非数组格式的结果
      insertId = result.insertId;
    }

    console.log('获取的insertId:', insertId);

    res.status(201).json({
      success: true,
      message: '报废申请创建成功',
      data: { id: insertId },
    });
    safeEmit('scrapping:created', {
      tenantId, scrapId: insertId, assetCode: asset_code,
      actorUserId: req.user?.id, source: 'scrapping.create',
    });
  } catch (error) {
    console.error('创建报废申请失败:', error);
    res.status(500).json({
      success: false,
      message: '创建报废申请失败',
      error: error.message,
    });
  }
});

// 获取报废记录列表
router.get('/', authenticate, async (req, res) => {
  try {
    const { page = 1, pageSize = 10, status, asset_code, start_date, end_date } = req.query;
    const tenantId = getTenantId(req);

    let query = 'SELECT * FROM asset_scrapping_records WHERE tenant_id = ?';
    const params = [tenantId];
    let countQuery = 'SELECT COUNT(*) as total FROM asset_scrapping_records WHERE tenant_id = ?';
    const countParams = [tenantId];

    // 添加过滤条件
    if (status) {
      query += ' AND current_status = ?';
      countQuery += ' AND current_status = ?';
      params.push(status);
      countParams.push(status);
    }

    if (asset_code) {
      query += ' AND asset_code LIKE ?';
      countQuery += ' AND asset_code LIKE ?';
      params.push(`%${asset_code}%`);
      countParams.push(`%${asset_code}%`);
    }

    if (start_date) {
      query += ' AND apply_date >= ?';
      countQuery += ' AND apply_date >= ?';
      params.push(start_date);
      countParams.push(start_date);
    }

    if (end_date) {
      query += ' AND apply_date <= ?';
      countQuery += ' AND apply_date <= ?';
      params.push(end_date);
      countParams.push(end_date);
    }

    // 添加排序和分页
    query += ' ORDER BY apply_date DESC LIMIT ? OFFSET ?';
    params.push(parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize));

    // 执行查询
    const [records] = await db.execute(query, params);
    const [countResult] = await db.execute(countQuery, countParams);
    const { total } = countResult[0];

    res.json({
      success: true,
      data: {
        records,
        pagination: {
          page: parseInt(page),
          pageSize: parseInt(pageSize),
          total,
          totalPages: Math.ceil(total / parseInt(pageSize)),
        },
      },
    });
  } catch (error) {
    console.error('获取报废记录失败:', error);
    res.status(500).json({
      success: false,
      message: '获取报废记录失败',
      error: error.message,
    });
  }
});

// 获取单个报废记录详情
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = getTenantId(req);

    // 获取报废记录
    const [records] = await db.execute(
      'SELECT * FROM asset_scrapping_records WHERE id = ? AND tenant_id = ?',
      [id, tenantId],
    );

    if (records.length === 0) {
      return res.status(404).json({
        success: false,
        message: '报废记录不存在',
      });
    }

    const record = records[0];

    // 获取相关审批记录
    const [approvals] = await db.execute(
      'SELECT * FROM asset_scrapping_approvals WHERE scrapping_id = ? AND tenant_id = ? ORDER BY approval_level',
      [id, tenantId],
    );

    // 获取相关鉴定记录
    const [appraisals] = await db.execute(
      'SELECT * FROM asset_scrapping_appraisals WHERE scrapping_id = ? AND tenant_id = ?',
      [id, tenantId],
    );

    // 获取相关处置记录
    const [disposals] = await db.execute(
      'SELECT * FROM asset_scrapping_disposals WHERE scrapping_id = ? AND tenant_id = ?',
      [id, tenantId],
    );

    // 获取相关文件
    const [files] = await db.execute(
      'SELECT * FROM asset_scrapping_files WHERE scrapping_id = ? AND tenant_id = ?',
      [id, tenantId],
    );

    res.json({
      success: true,
      data: {
        ...record,
        approvals,
        appraisals,
        disposals,
        files,
      },
    });
  } catch (error) {
    console.error('获取报废记录详情失败:', error);
    res.status(500).json({
      success: false,
      message: '获取报废记录详情失败',
      error: error.message,
    });
  }
});

// 更新报废记录
router.put('/:id', authenticate, authorize(SCRAP_WRITE_ROLES), auditLogger('update', 'scrapping'), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      asset_code,
      asset_name,
      asset_model,
      department,
      scrapping_reason,
      estimated_value,
      remark,
    } = req.body;
    const tenantId = getTenantId(req);

    // 验证记录存在且属于当前租户
    const [records] = await db.execute(
      'SELECT * FROM asset_scrapping_records WHERE id = ? AND tenant_id = ?',
      [id, tenantId],
    );

    if (records.length === 0) {
      return res.status(404).json({
        success: false,
        message: '报废记录不存在',
      });
    }

    const record = records[0];

    // 只能更新待处理状态的记录
    if (record.current_status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: '只能更新待处理状态的记录',
      });
    }

    // 计算最终值（处理null和undefined）
    const finalAssetCode = (asset_code !== null && asset_code !== undefined) ? asset_code : record.asset_code;
    const finalAssetName = (asset_name !== null && asset_name !== undefined) ? asset_name : record.asset_name;

    // 使用请求数据或保留数据库中的值（必填字段不能为null）
    const updateParams = [
      finalAssetCode,
      finalAssetName,
      asset_model ?? record.asset_model,
      department ?? record.department,
      scrapping_reason ?? record.scrapping_reason,
      estimated_value ?? record.estimated_value,
      remark ?? record.remark,
      id,
      tenantId,
    ];

    await db.execute(
      `UPDATE asset_scrapping_records
       SET asset_code = ?, asset_name = ?, asset_model = ?, department = ?,
           scrapping_reason = ?, estimated_value = ?, remark = ?, updated_at = NOW()
       WHERE id = ? AND tenant_id = ?`,
      updateParams,
    );

    res.json({
      success: true,
      message: '报废记录更新成功',
    });
  } catch (error) {
    console.error('更新报废记录失败:', error);
    res.status(500).json({
      success: false,
      message: '更新报废记录失败',
      error: error.message,
    });
  }
});

// 提交鉴定结果
router.post(
  '/:id/appraise',
  authenticate,
  auditLogger('approve', 'scrapping'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const {
        appraiser,
        appraiser_id,
        technical_condition,
        scrapping_necessity,
        estimated_value,
        appraisal_result,
      } = req.body;
      const tenantId = getTenantId(req);

      // 验证记录存在且属于当前租户
      const [records] = await db.execute(
        'SELECT * FROM asset_scrapping_records WHERE id = ? AND tenant_id = ?',
        [id, tenantId],
      );

      if (records.length === 0) {
        return res.status(404).json({
          success: false,
          message: '报废记录不存在',
        });
      }

      const record = records[0];

      // 验证状态
      if (record.current_status !== 'pending' && record.current_status !== 'appraising') {
        return res.status(400).json({
          success: false,
          message: '只能对待处理或鉴定中的记录进行鉴定',
        });
      }

      const appraisalDate = new Date();

      // 使用事务处理（将undefined转换为null）
      await db.transaction(async connection => {
        // 更新报废记录状态为鉴定中
        await connection.execute(
          `UPDATE asset_scrapping_records
          SET current_status = 'appraising', appraiser = ?, appraiser_id = ?,
              appraisal_date = ?, appraisal_result = ?, updated_at = NOW()
          WHERE id = ? AND tenant_id = ?`,
          [
            appraiser ?? null,
            appraiser_id ?? null,
            appraisalDate,
            appraisal_result ?? null,
            id,
            tenantId,
          ],
        );

        // 插入鉴定记录
        await connection.execute(
          `INSERT INTO asset_scrapping_appraisals
          (scrapping_id, appraiser, appraiser_id, appraisal_date,
           technical_condition, scrapping_necessity, estimated_value,
           appraisal_result, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [
            id,
            appraiser ?? null,
            appraiser_id ?? null,
            appraisalDate,
            technical_condition ?? null,
            scrapping_necessity ?? null,
            estimated_value ?? null,
            appraisal_result ?? null,
          ],
        );
      });

      res.json({
        success: true,
        message: '鉴定结果提交成功',
      });
    } catch (error) {
      console.error('提交鉴定结果失败:', error);
      res.status(500).json({
        success: false,
        message: '提交鉴定结果失败',
        error: error.message,
      });
    }
  },
);

// 提交审批结果
router.post('/:id/approve', authenticate, authorize(SCRAP_APPROVE_ROLES), auditLogger('approve', 'scrapping'), async (req, res) => {
  try {
    const { id } = req.params;
    const { approver, approver_id, approval_status, approval_comment, approval_level } = req.body;
    const tenantId = getTenantId(req);

    // 验证记录存在且属于当前租户
    const [records] = await db.execute(
      'SELECT * FROM asset_scrapping_records WHERE id = ? AND tenant_id = ?',
      [id, tenantId],
    );

    if (records.length === 0) {
      return res.status(404).json({
        success: false,
        message: '报废记录不存在',
      });
    }

    const record = records[0];

    // 验证状态
    if (record.current_status !== 'appraising' && record.current_status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: '只能对鉴定中或待处理的记录进行审批',
      });
    }

    // 验证审批状态值
    if (approval_status && !['approved', 'rejected'].includes(approval_status)) {
      return res.status(400).json({
        success: false,
        message: '审批状态值无效，只能为 approved 或 rejected',
      });
    }

      const approvalDate = new Date();

      // 使用事务处理（将undefined转换为null）
      await db.transaction(async connection => {
        // 插入审批记录
        await connection.execute(
          `INSERT INTO asset_scrapping_approvals
           (scrapping_id, approver, approver_id, approval_level,
            approval_status, approval_comment, approval_date, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [
            id,
            approver ?? null,
            approver_id ?? null,
            approval_level ?? 1,
            approval_status ?? null,
            approval_comment ?? null,
            approvalDate,
          ],
        );

        // 更新报废记录状态
        let newStatus = record.current_status;
        if (approval_status === 'approved') {
          newStatus = 'approved';
        } else if (approval_status === 'rejected') {
          newStatus = 'rejected';
        }

        await connection.execute(
          `UPDATE asset_scrapping_records
           SET current_status = ?, approver = ?, approver_id = ?,
               approval_date = ?, approval_comment = ?, updated_at = NOW()
           WHERE id = ? AND tenant_id = ?`,
          [newStatus, approver ?? null, approver_id ?? null, approvalDate, approval_comment ?? null, id, tenantId],
        );
      });

    res.json({
      success: true,
      message: '审批结果提交成功',
    });
    safeEmit(approval_status === 'approved' ? 'scrapping:approved' : 'scrapping:rejected', {
      tenantId, scrapId: parseInt(id), approvalStatus: approval_status,
      actorUserId: req.user?.id, source: 'scrapping.approve',
    });
  } catch (error) {
    console.error('提交审批结果失败:', error);
    res.status(500).json({
      success: false,
      message: '提交审批结果失败',
      error: error.message,
    });
  }
});

// 提交处置结果
router.post('/:id/dispose', authenticate, authorize(SCRAP_WRITE_ROLES), auditLogger('update', 'scrapping'), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      disposer,
      disposer_id,
      disposal_method,
      disposal_company,
      actual_value,
      disposal_result,
      disposal_certificate,
    } = req.body;
    const tenantId = getTenantId(req);

    // 验证记录存在且属于当前租户
    const [records] = await db.execute(
      'SELECT * FROM asset_scrapping_records WHERE id = ? AND tenant_id = ?',
      [id, tenantId],
    );

    if (records.length === 0) {
      return res.status(404).json({
        success: false,
        message: '报废记录不存在',
      });
    }

    const record = records[0];

    // 验证状态
    if (record.current_status !== 'approved') {
      return res.status(400).json({
        success: false,
        message: '只能对已批准的记录进行处置',
      });
    }

      const disposalDate = new Date();

      // 使用事务处理（将undefined转换为null）
      await db.transaction(async connection => {
        // 更新报废记录状态为处置中
        await connection.execute(
          `UPDATE asset_scrapping_records
           SET current_status = 'disposing', disposer = ?, disposer_id = ?,
               disposal_date = ?, disposal_method = ?, disposal_result = ?,
               actual_value = ?, updated_at = NOW()
           WHERE id = ? AND tenant_id = ?`,
          [
            disposer ?? null,
            disposer_id ?? null,
            disposalDate,
            disposal_method ?? null,
            disposal_result ?? null,
            actual_value ?? null,
            id,
            tenantId,
          ],
        );

        // 插入处置记录
        await connection.execute(
          `INSERT INTO asset_scrapping_disposals
           (scrapping_id, disposer, disposer_id, disposal_date,
            disposal_method, disposal_company, actual_value,
            disposal_result, disposal_certificate, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [
            id,
            disposer ?? null,
            disposer_id ?? null,
            disposalDate,
            disposal_method ?? null,
            disposal_company ?? null,
            actual_value ?? null,
            disposal_result ?? null,
            disposal_certificate ?? null,
          ],
        );
      });

    res.json({
      success: true,
      message: '处置结果提交成功',
    });
  } catch (error) {
    console.error('提交处置结果失败:', error);
    res.status(500).json({
      success: false,
      message: '提交处置结果失败',
      error: error.message,
    });
  }
});

// 完成处置
router.post('/:id/complete', authenticate, authorize(SCRAP_WRITE_ROLES), auditLogger('update', 'scrapping'), async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = getTenantId(req);

    // 验证记录存在且属于当前租户
    const [records] = await db.execute(
      'SELECT * FROM asset_scrapping_records WHERE id = ? AND tenant_id = ?',
      [id, tenantId],
    );

    if (records.length === 0) {
      return res.status(404).json({
        success: false,
        message: '报废记录不存在',
      });
    }

    const record = records[0];

    // 验证状态
    if (record.current_status !== 'disposing') {
      return res.status(400).json({
        success: false,
        message: '只能对处置中的记录进行完成操作',
      });
    }

    // 使用事务确保原子性
    await db.transaction(async connection => {
      // 更新报废记录状态为已完成
      await connection.execute(
        `UPDATE asset_scrapping_records
         SET current_status = 'completed', updated_at = NOW()
         WHERE id = ? AND tenant_id = ?`,
        [id, tenantId],
      );

      // 报废完成后，同步更新资产主表状态为"报废"
      if (record.asset_code) {
        await connection.execute(
          `UPDATE assets
           SET status = '报废', updated_at = NOW()
           WHERE asset_code = ? AND tenant_id = ? AND is_deleted = 0`,
          [record.asset_code, tenantId],
        );

        logger.info(`资产 ${record.asset_code} 状态已更新为"报废"`);
      }
    });

    res.json({
      success: true,
      message: '处置完成成功',
    });
    safeEmit('scrapping:completed', {
      tenantId, scrapId: parseInt(id),
      actorUserId: req.user?.id, source: 'scrapping.dispose',
    });
  } catch (error) {
    console.error('完成处置失败:', error);
    res.status(500).json({
      success: false,
      message: '完成处置失败',
      error: error.message,
    });
  }
});

// 上传报废相关文件
router.post(
  '/:id/files',
  authenticate,
  upload.single('file'),
  fileSecurity(),
  auditLogger('create', 'scrapping'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { file_type } = req.body;
      const tenantId = getTenantId(req);

      // 验证记录存在且属于当前租户
      const [records] = await db.execute(
        'SELECT * FROM asset_scrapping_records WHERE id = ? AND tenant_id = ?',
        [id, tenantId],
      );

      if (records.length === 0) {
        return res.status(404).json({
          success: false,
          message: '报废记录不存在',
        });
      }

      // 验证文件
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: '请选择要上传的文件',
        });
      }

      // 验证文件类型
      const validFileTypes = ['application', 'appraisal', 'approval', 'disposal'];
      if (!file_type || !validFileTypes.includes(file_type)) {
        return res.status(400).json({
          success: false,
          message: '文件类型无效，有效值为：application, appraisal, approval, disposal',
        });
      }

      const uploadedAt = new Date();
      const filePath = `/uploads/scrapping-files/${req.file.filename}`;

      // 插入文件记录
      const [result] = await db.execute(
        `INSERT INTO asset_scrapping_files
       (scrapping_id, file_type, file_name, file_path,
        file_size, mime_type, uploaded_by, uploaded_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          file_type,
          req.file.originalname,
          filePath,
          req.file.size,
          req.file.mimetype,
          req.user?.username || '系统',
          uploadedAt,
        ],
      );

      res.json({
        success: true,
        message: '文件上传成功',
        data: {
          id: result.insertId,
          file_name: req.file.originalname,
          file_path: filePath,
          file_size: req.file.size,
          mime_type: req.file.mimetype,
        },
      });
    } catch (error) {
      console.error('上传文件失败:', error);
      res.status(500).json({
        success: false,
        message: '上传文件失败',
        error: error.message,
      });
    }
  },
);

// 获取报废统计数据（支持 /stats 和 /statistics/summary 两种路径）
const getStatisticsHandler = async (req, res) => {
  try {
    const tenantId = getTenantId(req);

    // 获取各状态的统计数据
    const [statusStats] = await db.execute(
      `SELECT current_status, COUNT(*) as count,
              SUM(estimated_value) as total_estimated_value,
              SUM(actual_value) as total_actual_value
       FROM asset_scrapping_records
       WHERE tenant_id = ?
       GROUP BY current_status`,
      [tenantId],
    );

    // 获取总体统计
    const [totalStats] = await db.execute(
      `SELECT COUNT(*) as total_count,
              SUM(estimated_value) as total_estimated_value,
              SUM(actual_value) as total_actual_value
       FROM asset_scrapping_records
       WHERE tenant_id = ?`,
      [tenantId],
    );

    res.json({
      success: true,
      data: {
        statusStats,
        totalStats: totalStats[0],
      },
    });
  } catch (error) {
    console.error('获取报废统计数据失败:', error);
    res.status(500).json({
      success: false,
      message: '获取报废统计数据失败',
      error: error.message,
    });
  }
};

router.get('/statistics/summary', authenticate, getStatisticsHandler);
router.get('/stats', authenticate, getStatisticsHandler);

// 驳回报废申请（独立接口，便于前端直接调用）
router.post('/:id/reject', authenticate, authorize(SCRAP_APPROVE_ROLES), auditLogger('approve', 'scrapping'), async (req, res) => {
  try {
    const { id } = req.params;
    const { approver, approver_id, approval_comment } = req.body;
    const tenantId = getTenantId(req);

    const [records] = await db.execute(
      'SELECT * FROM asset_scrapping_records WHERE id = ? AND tenant_id = ?',
      [id, tenantId],
    );

    if (records.length === 0) {
      return res.status(404).json({ success: false, message: '报废记录不存在' });
    }

    const record = records[0];

    if (record.current_status !== 'pending' && record.current_status !== 'appraising') {
      return res.status(400).json({ success: false, message: '只能对待处理或鉴定中的记录进行驳回' });
    }

    const approvalDate = new Date();

    await db.transaction(async connection => {
      await connection.execute(
        `INSERT INTO asset_scrapping_approvals
         (scrapping_id, approver, approver_id, approval_level, approval_status, approval_comment, approval_date, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'rejected', ?, ?, NOW(), NOW())`,
        [id, approver ?? null, approver_id ?? null, 1, approval_comment ?? null, approvalDate],
      );

      await connection.execute(
        `UPDATE asset_scrapping_records
         SET current_status = 'rejected', approver = ?, approver_id = ?, approval_date = ?, approval_comment = ?, updated_at = NOW()
         WHERE id = ? AND tenant_id = ?`,
        [approver ?? null, approver_id ?? null, approvalDate, approval_comment ?? null, id, tenantId],
      );
    });

    res.json({ success: true, message: '报废申请已驳回' });
    safeEmit('scrapping:rejected', {
      tenantId, scrapId: parseInt(id),
      actorUserId: req.user?.id, source: 'scrapping.reject',
    });
  } catch (error) {
    console.error('驳回报废申请失败:', error);
    res.status(500).json({ success: false, message: '驳回报废申请失败', error: error.message });
  }
});

// 归档报废记录
router.post('/:id/archive', authenticate, authorize(SCRAP_WRITE_ROLES), auditLogger('update', 'scrapping'), async (req, res) => {
  try {
    const { id } = req.params;
    const { archived_by, archived_by_id, archive_location, archive_remark } = req.body;
    const tenantId = getTenantId(req);

    const [records] = await db.execute(
      'SELECT * FROM asset_scrapping_records WHERE id = ? AND tenant_id = ?',
      [id, tenantId],
    );

    if (records.length === 0) {
      return res.status(404).json({ success: false, message: '报废记录不存在' });
    }

    const record = records[0];

    // 只有已完成的记录才能归档
    if (record.current_status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: '只能对已完成的报废记录进行归档',
      });
    }

    // 如果已归档则不允许重复归档
    if (record.current_status === 'archived') {
      return res.status(400).json({ success: false, message: '该记录已归档，不可重复操作' });
    }

    const archivedAt = new Date();
    // 生成归档编号: ARCH-YYYYMMDD-随机6位
    const dateStr = archivedAt.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(100000 + Math.random() * 900000);
    const archiveNo = `ARCH-${dateStr}-${random}`;

    await db.execute(
      `UPDATE asset_scrapping_records
       SET current_status = 'archived',
           archive_no = ?, archived_by = ?, archived_by_id = ?,
           archived_at = ?, archive_location = ?, archive_remark = ?,
           updated_at = NOW()
       WHERE id = ? AND tenant_id = ?`,
      [
        archiveNo,
        archived_by ?? null,
        archived_by_id ?? null,
        archivedAt,
        archive_location ?? null,
        archive_remark ?? null,
        id,
        tenantId,
      ],
    );

    logger.info(`报废记录 ${id} 已归档，归档编号: ${archiveNo}`);

    res.json({
      success: true,
      message: '归档成功',
      data: { id, archive_no: archiveNo, archived_at: archivedAt },
    });
  } catch (error) {
    console.error('归档报废记录失败:', error);
    res.status(500).json({ success: false, message: '归档失败', error: error.message });
  }
});

// 删除报废记录
router.delete('/:id', authenticate, authorize(SCRAP_WRITE_ROLES), auditLogger('delete', 'scrapping'), async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = getTenantId(req);

    // 验证记录存在且属于当前租户
    const [records] = await db.execute(
      'SELECT * FROM asset_scrapping_records WHERE id = ? AND tenant_id = ?',
      [id, tenantId],
    );

    if (records.length === 0) {
      return res.status(404).json({
        success: false,
        message: '报废记录不存在',
      });
    }

    const record = records[0];

    // 验证状态
    if (record.current_status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: '只能删除待处理状态的记录',
      });
    }

    // 使用事务处理
    await db.transaction(async connection => {
      // 删除相关文件记录
      await connection.execute('DELETE FROM asset_scrapping_files WHERE scrapping_id = ?', [id]);

      // 删除相关审批记录
      await connection.execute('DELETE FROM asset_scrapping_approvals WHERE scrapping_id = ?', [
        id,
      ]);

      // 删除相关鉴定记录
      await connection.execute('DELETE FROM asset_scrapping_appraisals WHERE scrapping_id = ?', [
        id,
      ]);

      // 删除相关处置记录
      await connection.execute('DELETE FROM asset_scrapping_disposals WHERE scrapping_id = ?', [
        id,
      ]);

      // 删除报废记录
      await connection.execute(
        'DELETE FROM asset_scrapping_records WHERE id = ? AND tenant_id = ?',
        [id, tenantId],
      );
    });

    res.json({
      success: true,
      message: '报废记录删除成功',
    });
  } catch (error) {
    console.error('删除报废记录失败:', error);
    res.status(500).json({
      success: false,
      message: '删除报废记录失败',
      error: error.message,
    });
  }
});

module.exports = router;
