/**
 * @swagger
 * /api/barcode-scan:
 *   get:
 *     summary: 条码扫描API信息
 *     tags: [条码扫描]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: API信息
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 endpoints:
 *                   type: object
 *                   properties:
 *                     generate:
 *                       type: string
 *                       example: /api/barcode-scan/generate/:asset_code
 *                     logs:
 *                       type: string
 *                       example: /api/barcode-scan/logs
 */

/**
 * @swagger
 * /api/barcode-scan/generate/{asset_code}:
 *   get:
 *     summary: 生成资产二维码
 *     description: 根据资产编号生成包含资产信息的二维码图片
 *     tags: [条码扫描]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: asset_code
 *         required: true
 *         schema:
 *           type: string
 *         description: 资产编号
 *     responses:
 *       200:
 *         description: 二维码图片
 *         content:
 *           image/png:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: 资产不存在
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: 资产不存在
 *       500:
 *         description: 服务器错误
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                 error:
 *                   type: string
 */

/**
 * @swagger
 * /api/barcode-scan/verify:
 *   post:
 *     summary: 扫码验证资产
 *     description: 通过扫描资产二维码验证资产信息
 *     tags: [条码扫描]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - qr_data
 *             properties:
 *               qr_data:
 *                 type: string
 *                 description: 二维码数据(JSON字符串)
 *                 example: '{"type":"asset","asset_code":"AST001","timestamp":1234567890}'
 *     responses:
 *       200:
 *         description: 验证成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: 资产验证成功
 *                 data:
 *                   type: object
 *       400:
 *         description: 参数错误
 *       404:
 *         description: 资产不存在
 *       500:
 *         description: 服务器错误
 */

/**
 * @swagger
 * /api/barcode-scan/inventory:
 *   post:
 *     summary: 扫码进行盘点
 *     description: 通过扫描资产二维码进行资产盘点
 *     tags: [条码扫描]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - qr_data
 *               - inventory_id
 *             properties:
 *               qr_data:
 *                 type: string
 *                 description: 二维码数据
 *               inventory_id:
 *                 type: integer
 *                 description: 盘点记录ID
 *               actual_location:
 *                 type: string
 *                 description: 实际位置
 *               actual_status:
 *                 type: string
 *                 description: 实际状态
 *     responses:
 *       200:
 *         description: 盘点成功
 *       400:
 *         description: 参数错误
 *       404:
 *         description: 资产或盘点记录不存在
 *       500:
 *         description: 服务器错误
 */

/**
 * @swagger
 * /api/barcode-scan/logs:
 *   get:
 *     summary: 获取扫码日志
 *     description: 查询资产扫码日志记录
 *     tags: [条码扫描]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: asset_code
 *         schema:
 *           type: string
 *         description: 资产编号
 *       - in: query
 *         name: start_date
 *         schema:
 *           type: string
 *           format: date
 *         description: 开始日期
 *       - in: query
 *         name: end_date
 *         schema:
 *           type: string
 *           format: date
 *         description: 结束日期
 *       - in: query
 *         name: scan_type
 *         schema:
 *           type: string
 *           enum: [verify, inventory]
 *         description: 扫码类型
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: 页码
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: 每页数量
 *     responses:
 *       200:
 *         description: 成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       asset_code:
 *                         type: string
 *                       scan_type:
 *                         type: string
 *                       scan_by:
 *                         type: string
 *                       scan_time:
 *                         type: string
 *                         format: date-time
 *                       asset_name:
 *                         type: string
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *       500:
 *         description: 服务器错误
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const logger = require('../config/logger');
const { authenticate, authorize } = require('../middleware/auth');
const { addTenantFilter, getTenantId } = require('../middleware/tenant-filter');
const QRCode = require('qrcode');

const BARCODE_SCAN_DEPARTMENT_JOIN =
  'LEFT JOIN departments d ON a.department_new = d.department_code AND d.tenant_id = a.tenant_id';
const BARCODE_SCAN_LOG_ASSET_JOIN =
  'LEFT JOIN assets a ON sl.asset_code = a.asset_code AND a.tenant_id = sl.tenant_id';
const path = require('path');
const fs = require('fs');

function logBarcodeScanError(message, error, req, context = {}) {
  logger.error(message, {
    error: error?.message || String(error || ''),
    code: error?.code || undefined,
    tenantId: getTenantId(req) || null,
    userId: req?.user?.id || null,
    ...context,
  });
}

router.get('/', authenticate, async (req, res) => {
  res.json({
    success: true,
    message: '条码扫描API',
    endpoints: {
      generate: '/api/barcode-scan/generate/:asset_code',
      logs: '/api/barcode-scan/logs',
    },
  });
});

// 生成资产二维码
router.get('/generate/:asset_code', authenticate, authorize('view_all_assets'), async (req, res) => {
  try {
    const { asset_code } = req.params;

    // 验证资产是否存在
    const tenantFilter = addTenantFilter(req, 'a');
    const [assets] = await db.execute(
      `SELECT a.asset_code, a.asset_name, a.brand, a.model 
       FROM assets a 
       WHERE a.asset_code = ? ${tenantFilter.whereClause}`,
      [asset_code, ...tenantFilter.params],
    );

    if (assets.length === 0) {
      return res.status(404).json({ success: false, message: '资产不存在' });
    }

    const asset = assets[0];

    // 生成二维码数据
    const qrData = JSON.stringify({
      type: 'asset',
      asset_code: asset.asset_code,
      timestamp: Date.now(),
    });

    // 生成二维码图片
    const qrCodeBuffer = await QRCode.toBuffer(qrData, {
      width: 200,
      margin: 1,
    });

    // 设置响应头
    res.set('Content-Type', 'image/png');
    res.set('Content-Disposition', `inline; filename="${asset.asset_code}.png"`);

    // 发送二维码图片
    res.send(qrCodeBuffer);
  } catch (error) {
    logBarcodeScanError('生成资产二维码失败', error, req, {
      assetCode: req.params.asset_code,
    });
    res.status(500).json({ success: false, message: '生成资产二维码失败', error: error.message });
  }
});

// 扫码验证资产
router.post('/verify', authenticate, authorize('view_all_assets'), async (req, res) => {
  try {
    const { qr_data } = req.body;

    if (!qr_data) {
      return res.status(400).json({ success: false, message: '缺少二维码数据' });
    }

    let qrInfo;
    try {
      qrInfo = JSON.parse(qr_data);
    } catch (parseError) {
      return res.status(400).json({ success: false, message: '无效的二维码数据' });
    }

    if (qrInfo.type !== 'asset' || !qrInfo.asset_code) {
      return res.status(400).json({ success: false, message: '非资产二维码' });
    }

    // 验证资产是否存在
    const tenantFilter = addTenantFilter(req, 'a');
    const [assets] = await db.execute(
      `SELECT a.*, COALESCE(d.department_name, a.department) as department_name 
       FROM assets a 
       ${BARCODE_SCAN_DEPARTMENT_JOIN}
       WHERE a.asset_code = ? ${tenantFilter.whereClause}`,
      [qrInfo.asset_code, ...tenantFilter.params],
    );

    if (assets.length === 0) {
      return res.status(404).json({ success: false, message: '资产不存在' });
    }

    const asset = assets[0];

    // 记录扫码日志
    await db.execute(
      `INSERT INTO scan_logs (asset_code, scan_type, scan_by, scan_time, tenant_id) 
       VALUES (?, ?, ?, NOW(), ?)`,
      [asset.asset_code, 'verify', req.user.username, getTenantId(req)],
    );

    res.json({
      success: true,
      message: '资产验证成功',
      data: asset,
    });
  } catch (error) {
    logBarcodeScanError('扫码验证资产失败', error, req, {
      hasQrData: Boolean(req.body?.qr_data),
    });
    res.status(500).json({ success: false, message: '扫码验证资产失败', error: error.message });
  }
});

// 扫码进行盘点
router.post('/inventory', authenticate, authorize('edit_all_inventory'), async (req, res) => {
  try {
    const { qr_data, inventory_id, actual_location, actual_status } = req.body;

    if (!qr_data || !inventory_id) {
      return res.status(400).json({ success: false, message: '缺少必要参数' });
    }

    let qrInfo;
    try {
      qrInfo = JSON.parse(qr_data);
    } catch (parseError) {
      return res.status(400).json({ success: false, message: '无效的二维码数据' });
    }

    if (qrInfo.type !== 'asset' || !qrInfo.asset_code) {
      return res.status(400).json({ success: false, message: '非资产二维码' });
    }

    // 验证盘点记录是否存在
    const tenantFilter = addTenantFilter(req, 'ir');
    const [inventoryRecords] = await db.execute(
      `SELECT ir.* FROM inventory_records ir 
       WHERE ir.id = ? ${tenantFilter.whereClause}`,
      [inventory_id, ...tenantFilter.params],
    );

    if (inventoryRecords.length === 0) {
      return res.status(404).json({ success: false, message: '盘点记录不存在' });
    }

    const inventoryRecord = inventoryRecords[0];

    // 验证资产是否存在
    const assetTenantFilter = addTenantFilter(req, 'a');
    const [assets] = await db.execute(
      `SELECT a.* FROM assets a 
       WHERE a.asset_code = ? ${assetTenantFilter.whereClause}`,
      [qrInfo.asset_code, ...assetTenantFilter.params],
    );

    if (assets.length === 0) {
      return res.status(404).json({ success: false, message: '资产不存在' });
    }

    const asset = assets[0];

    // 检查是否已经盘点过
    const detailTenantFilter = addTenantFilter(req, 'id');
    const [existingDetails] = await db.execute(
      `SELECT id.* FROM inventory_details id 
       WHERE id.inventory_id = ? AND id.asset_code = ? ${detailTenantFilter.whereClause}`,
      [inventory_id, qrInfo.asset_code, ...detailTenantFilter.params],
    );

    let discrepancyType = '正常';
    let discrepancyDesc = '';

    // 比较实际值与期望值
    if (actual_location && actual_location !== asset.location) {
      discrepancyType = '位置差异';
      discrepancyDesc += `位置: 期望[${asset.location}]，实际[${actual_location}]`;
    }

    if (actual_status && actual_status !== asset.status) {
      if (discrepancyDesc) discrepancyDesc += '; ';
      discrepancyType = '状态差异';
      discrepancyDesc += `状态: 期望[${asset.status}]，实际[${actual_status}]`;
    }

    if (existingDetails.length > 0) {
      // 更新现有盘点明细
      await db.execute(
        `UPDATE inventory_details 
         SET actual_location = ?, actual_status = ?, 
             discrepancy_type = ?, discrepancy_desc = ?, 
             checked_by = ?, checked_by_name = ?, checked_at = NOW(),
             check_method = '扫码' 
         WHERE id = ? AND tenant_id = ?`,
        [actual_location || asset.location, actual_status || asset.status,
         discrepancyType, discrepancyDesc,
         req.user.id, req.user.username,
         existingDetails[0].id, getTenantId(req)],
      );
    } else {
      // 创建新的盘点明细
      await db.execute(
        `INSERT INTO inventory_details 
         (inventory_id, asset_code, expected_location, expected_status, 
          actual_location, actual_status, discrepancy_type, discrepancy_desc, 
          checked_by, checked_by_name, checked_at, check_method, tenant_id) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), '扫码', ?)`,
        [inventory_id, qrInfo.asset_code, asset.location, asset.status,
         actual_location || asset.location, actual_status || asset.status,
         discrepancyType, discrepancyDesc,
         req.user.id, req.user.username,
         getTenantId(req)],
      );
    }

    // 记录扫码日志
    await db.execute(
      `INSERT INTO scan_logs (asset_code, scan_type, scan_by, scan_time, tenant_id) 
       VALUES (?, ?, ?, NOW(), ?)`,
      [asset.asset_code, 'inventory', req.user.username, getTenantId(req)],
    );

    res.json({
      success: true,
      message: '扫码盘点成功',
      data: {
        asset,
        discrepancy_type: discrepancyType,
        discrepancy_desc: discrepancyDesc,
      },
    });
  } catch (error) {
    logBarcodeScanError('扫码盘点失败', error, req, {
      inventoryId: req.body?.inventory_id || null,
      hasQrData: Boolean(req.body?.qr_data),
    });
    res.status(500).json({ success: false, message: '扫码盘点失败', error: error.message });
  }
});

// 获取扫码日志
router.get('/logs', authenticate, authorize('view_all_inventory'), async (req, res) => {
  try {
    const { asset_code, start_date, end_date, scan_type, page = 1, limit = 20 } = req.query;

    let whereClause = 'WHERE 1=1';
    const params = [];

    // 添加租户过滤
    const tenantFilter = addTenantFilter(req, 'sl');
    whereClause += tenantFilter.whereClause;
    params.push(...tenantFilter.params);

    if (asset_code) {
      whereClause += ' AND sl.asset_code = ?';
      params.push(asset_code);
    }

    if (start_date) {
      whereClause += ' AND sl.scan_time >= ?';
      params.push(start_date);
    }

    if (end_date) {
      whereClause += ' AND sl.scan_time <= ?';
      params.push(end_date);
    }

    if (scan_type) {
      whereClause += ' AND sl.scan_type = ?';
      params.push(scan_type);
    }

    // 计算偏移量
    const offset = (page - 1) * limit;

    // 查询扫码日志
    const [logs] = await db.execute(
      `SELECT sl.*, a.asset_name 
       FROM scan_logs sl 
       ${BARCODE_SCAN_LOG_ASSET_JOIN}
       ${whereClause} 
       ORDER BY sl.scan_time DESC 
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset],
    );

    // 查询总数
    const [countResult] = await db.execute(
      `SELECT COUNT(*) as total 
       FROM scan_logs sl 
       ${whereClause}`,
      params,
    );

    const {total} = countResult[0];
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: logs,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages,
      },
    });
  } catch (error) {
    logBarcodeScanError('获取扫码日志失败', error, req, {
      assetCode: req.query?.asset_code || null,
      scanType: req.query?.scan_type || null,
      page: Number(req.query?.page) || 1,
      limit: Number(req.query?.limit) || 20,
    });
    res.status(500).json({ success: false, message: '获取扫码日志失败', error: error.message });
  }
});

module.exports = router;
