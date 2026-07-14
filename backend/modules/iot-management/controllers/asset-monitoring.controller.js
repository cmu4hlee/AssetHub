const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const db = require('../../../config/database');
const assetMonitoringService = require('../services/asset-monitoring-pipeline.service');
const { verifyIngestToken } = require('./ingest-auth.util');

const REPORT_UPLOAD_DIR = path.join(__dirname, '../../../uploads');
const IMAGE_EXTENSIONS_BY_MIME = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/bmp': '.bmp',
};

const KNOWN_CLIENT_ERROR_MESSAGES = new Set([
  '监测参数不能为空',
  '设备不存在',
  '设备租户与令牌所属企业不一致',
]);

const trimString = value => (typeof value === 'string' ? value.trim() : '');

const createHttpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const createBadRequestError = message => createHttpError(400, message);

const ensureAssetExists = async ({ assetCode, tenantId, statusCode = 400, message }) => {
  const [assets] = await db.execute(
    `SELECT id
     FROM assets
     WHERE asset_code = ? AND tenant_id = ?
     LIMIT 1`,
    [assetCode, tenantId],
  );

  if (!Array.isArray(assets) || assets.length === 0) {
    throw createHttpError(statusCode, message);
  }

  return assets[0];
};

const fetchDeviceByID = async deviceId => {
  if (!deviceId) return null;

  const [devices] = await db.execute(
    `SELECT id, tenant_id, device_id
     FROM iot_devices
     WHERE device_id = ?
     LIMIT 1`,
    [deviceId],
  );

  if (!Array.isArray(devices) || devices.length === 0) {
    return null;
  }

  return devices[0];
};

const resolveMappedDeviceIDByAsset = async ({ assetCode, tenantId }) => {
  const [rows] = await db.execute(
    `SELECT device_id
     FROM asset_locations
     WHERE tenant_id = ? AND asset_code = ? AND is_active = 1 AND device_id IS NOT NULL AND device_id <> ''
     ORDER BY last_update_time DESC, updated_at DESC, created_at DESC
     LIMIT 1`,
    [tenantId, assetCode],
  );

  const deviceId = rows?.[0]?.device_id ? String(rows[0].device_id).trim() : '';
  return deviceId || null;
};

const buildVirtualDeviceIDForAsset = ({ assetCode, tenantId }) => {
  const baseID = `asset-report-${tenantId}-${assetCode}`;
  if (baseID.length <= 100) {
    return baseID;
  }

  const digest = crypto.createHash('sha1').update(`${tenantId}:${assetCode}`).digest('hex').slice(0, 16);
  return `asset-report-${tenantId}-${digest}`;
};

const ensureVirtualDeviceForAsset = async ({ assetCode, tenantId }) => {
  const deviceId = buildVirtualDeviceIDForAsset({ assetCode, tenantId });
  const existing = await fetchDeviceByID(deviceId);
  if (existing) {
    return deviceId;
  }

  const deviceName = `资产故障上报通道-${assetCode}`.slice(0, 200);
  const remark = 'Auto-provisioned virtual device for asset-scoped external fault reports';

  await db.execute(
    `INSERT INTO iot_devices (
      tenant_id, device_id, device_name, device_type,
      manufacturer, model, serial_number, is_active, remark, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      tenantId,
      deviceId,
      deviceName,
      'WiFi',
      'MedGuard',
      'AssetFaultReporter',
      assetCode,
      1,
      remark,
    ],
  );

  return deviceId;
};

const resolveExternalReportDeviceID = async ({ requestedDeviceId, assetCode, tenantId }) => {
  const normalizedRequested = trimString(requestedDeviceId);
  if (normalizedRequested) {
    return normalizedRequested;
  }

  const mappedDeviceId = await resolveMappedDeviceIDByAsset({ assetCode, tenantId });
  if (mappedDeviceId) {
    const mappedDevice = await fetchDeviceByID(mappedDeviceId);
    if (mappedDevice && Number(mappedDevice.tenant_id) === tenantId) {
      return mappedDeviceId;
    }
  }

  return ensureVirtualDeviceForAsset({ assetCode, tenantId });
};

const parseMetadata = value => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value === 'object') {
    return value;
  }

  if (typeof value !== 'string') {
    throw createBadRequestError('metadata 必须是 JSON 字符串');
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    throw createBadRequestError('metadata 不是合法的 JSON 字符串');
  }
};

const getUploadedFiles = req => {
  if (!req.files) return [];
  if (Array.isArray(req.files)) return req.files;
  return Object.values(req.files)
    .flat()
    .filter(Boolean);
};

const buildStoredFileName = file => {
  const timestamp = Date.now();
  const random = Math.round(Math.random() * 1e9);
  const extension = IMAGE_EXTENSIONS_BY_MIME[file.mimetype] || '.img';
  return `device-error-report-${timestamp}-${random}${extension}`;
};

const resolveSessionTenantId = req => Number(req.user?.tenant_id || req.headers['x-tenant-id']);

const resolveBatchFailureMessage = (batchResult, fallbackMessage) =>
  batchResult?.results?.find(item => item && item.success === false)?.message || fallbackMessage;

class AssetMonitoringController {
  async ingest(req, res) {
    try {
      if (
        !(await verifyIngestToken(req, res, {
          expectedToken: process.env.IOT_ASSET_MON_INGEST_TOKEN,
          moduleName: '资产监测',
          scope: 'asset-monitoring',
        }))
      ) return;
      if (Array.isArray(req.body)) {
        const events = req.body;
        const batchResult = await assetMonitoringService.ingestBatch(events, 'http_batch', {
          request_ip: req.ip,
          iot_auth_tenant_id: req.iotAuth?.tenant_id || null,
        });
        return res.json({
          success: true,
          message: `批量接收完成，成功 ${batchResult.success}/${batchResult.total}`,
          data: batchResult,
        });
      }
      const result = await assetMonitoringService.ingestEvent(req.body || {}, 'http', {
        request_ip: req.ip,
        iot_auth_tenant_id: req.iotAuth?.tenant_id || null,
      });
      res.json({ success: true, message: '资产监测数据接收成功', data: result });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message || '资产监测数据接收失败' });
    }
  }

  async ingestBatch(req, res) {
    try {
      if (
        !(await verifyIngestToken(req, res, {
          expectedToken: process.env.IOT_ASSET_MON_INGEST_TOKEN,
          moduleName: '资产监测',
          scope: 'asset-monitoring',
        }))
      ) return;
      const events = Array.isArray(req.body?.events) ? req.body.events : [];
      if (events.length === 0) {
        return res.status(400).json({ success: false, message: 'events 不能为空' });
      }

      const batchResult = await assetMonitoringService.ingestBatch(events, 'http_batch', {
        request_ip: req.ip,
        iot_auth_tenant_id: req.iotAuth?.tenant_id || null,
      });
      res.json({
        success: true,
        message: `批量接收完成，成功 ${batchResult.success}/${batchResult.total}`,
        data: batchResult,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: '批量接收失败', error: error.message });
    }
  }

  async ingestSample(req, res) {
    try {
      const tenantId = resolveSessionTenantId(req);
      if (!Number.isFinite(tenantId) || tenantId <= 0) {
        return res.status(400).json({ success: false, message: '缺少有效的租户ID' });
      }

      const events = Array.isArray(req.body?.events) ? req.body.events : [];
      if (events.length === 0) {
        return res.status(400).json({ success: false, message: 'events 不能为空' });
      }

      const batchResult = await assetMonitoringService.ingestBatch(events, 'ui_sample', {
        request_ip: req.ip,
        auth_user_id: req.user?.id || null,
        auth_username: req.user?.username || null,
        auth_role: req.user?.role || null,
        iot_auth_tenant_id: tenantId,
      });

      if (batchResult.success === 0) {
        return res.status(400).json({
          success: false,
          message: resolveBatchFailureMessage(batchResult, '样例监测数据写入失败'),
          data: batchResult,
        });
      }

      return res.json({
        success: true,
        message: `样例监测数据写入完成，成功 ${batchResult.success}/${batchResult.total}`,
        data: batchResult,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message || '样例监测数据写入失败',
      });
    }
  }

  async getLatestByDevice(req, res) {
    try {
      const { deviceId } = req.params;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];
      if (!tenantId) return res.status(400).json({ success: false, message: '缺少租户ID' });

      const data = await assetMonitoringService.getLatestByDevice(deviceId, tenantId);
      if (!data) return res.status(404).json({ success: false, message: '未找到设备资产监测数据' });
      res.json({ success: true, data });
    } catch (error) {
      res.status(500).json({ success: false, message: '查询最新资产监测失败', error: error.message });
    }
  }

  async getAssetSeries(req, res) {
    try {
      const { assetCode } = req.params;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];
      if (!tenantId) return res.status(400).json({ success: false, message: '缺少租户ID' });
      const data = await assetMonitoringService.getAssetSeries(assetCode, tenantId, req.query || {});
      res.json({ success: true, data });
    } catch (error) {
      res.status(500).json({ success: false, message: '查询资产监测时序失败', error: error.message });
    }
  }

  async getLatestByAsset(req, res) {
    try {
      const { assetCode } = req.params;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];
      if (!tenantId) return res.status(400).json({ success: false, message: '缺少租户ID' });
      const data = await assetMonitoringService.getLatestByAsset(assetCode, tenantId);
      if (!data) return res.status(404).json({ success: false, message: '未找到资产监测数据' });
      return res.json({ success: true, data });
    } catch (error) {
      return res.status(500).json({ success: false, message: '查询资产最新监测失败', error: error.message });
    }
  }

  async pipelineHealth(req, res) {
    try {
      await assetMonitoringService.init();
      res.json({ success: true, data: assetMonitoringService.getPipelineHealth() });
    } catch (error) {
      res.status(500).json({ success: false, message: '查询资产监测管道状态失败', error: error.message });
    }
  }

  async pipelineDocs(req, res) {
    try {
      await assetMonitoringService.init();
      res.json({ success: true, data: assetMonitoringService.getPipelineDocs() });
    } catch (error) {
      res.status(500).json({ success: false, message: '查询接口文档失败', error: error.message });
    }
  }

  async getAssetErrorReports(req, res) {
    try {
      const { assetCode } = req.params;
      const tenantId = Number(req.user?.tenant_id || req.headers['x-tenant-id']);

      if (!Number.isFinite(tenantId) || tenantId <= 0) {
        return res.status(400).json({ success: false, message: '缺少有效的租户ID' });
      }

      await ensureAssetExists({
        assetCode,
        tenantId,
        statusCode: 404,
        message: '资产不存在或不属于当前租户',
      });

      const data = await assetMonitoringService.getErrorReportsByAsset(assetCode, tenantId, req.query || {});
      return res.json({ success: true, data });
    } catch (error) {
      const statusCode = error.statusCode || 500;
      return res.status(statusCode).json({
        success: false,
        message: error.message || '查询资产故障记录失败',
      });
    }
  }

  async externalReport(req, res) {
    const savedFiles = [];

    try {
      const files = getUploadedFiles(req);
      const tenantId = Number(req.user?.tenant_id || req.headers['x-tenant-id']);

      if (!Number.isFinite(tenantId) || tenantId <= 0) {
        throw createBadRequestError('缺少有效的租户ID');
      }

      const requestedDeviceId = trimString(req.body?.device_id || req.body?.deviceId) || undefined;
      const assetCode = trimString(req.body?.asset_code || req.body?.assetCode) || undefined;
      const runtimeStateInput =
        trimString(req.body?.runtime_state || req.body?.runtimeState) || undefined;
      const errorCode = trimString(req.body?.error_code || req.body?.errorCode) || undefined;
      const errorMessage =
        trimString(req.body?.error_message || req.body?.errorMessage) || undefined;
      const errorAnalysis =
        trimString(req.body?.error_analysis || req.body?.errorAnalysis) || undefined;
      const severity = trimString(req.body?.severity) || undefined;
      const eventTime = trimString(req.body?.event_time || req.body?.eventTime) || undefined;
      const metadata = parseMetadata(req.body?.metadata);

      if (!assetCode) {
        throw createBadRequestError('asset_code 不能为空');
      }

      if (!errorCode && !errorMessage && !errorAnalysis && files.length === 0) {
        throw createBadRequestError('至少提供错误编码、错误信息、错误分析或截图之一');
      }

      await ensureAssetExists({
        assetCode,
        tenantId,
        statusCode: 400,
        message: 'asset_code 对应的资产不存在或不属于当前租户',
      });

      const deviceId = await resolveExternalReportDeviceID({
        requestedDeviceId,
        assetCode,
        tenantId,
      });

      await fs.mkdir(REPORT_UPLOAD_DIR, { recursive: true });

      const uploadedImages = [];
      for (const file of files) {
        const storedName = buildStoredFileName(file);
        const relativeUrl = `/uploads/${storedName}`;
        const absolutePath = path.join(REPORT_UPLOAD_DIR, storedName);

        await fs.writeFile(absolutePath, file.buffer);
        savedFiles.push(absolutePath);

        uploadedImages.push({
          field_name: file.fieldname,
          original_name: file.originalname,
          mime_type: file.mimetype,
          size: file.size,
          file_name: storedName,
          file_url: relativeUrl,
        });
      }

      const runtimeState = runtimeStateInput || 'error';
      const payload = {
        device_id: deviceId,
        asset_code: assetCode,
        runtime_state: runtimeState,
        error_code: errorCode,
        error_message: errorMessage,
        error_analysis: errorAnalysis,
        severity,
        event_time: eventTime || new Date().toISOString(),
        screenshot_urls: uploadedImages.map(item => item.file_url),
        uploaded_images: uploadedImages,
        metadata,
        report_type: 'device_error',
        report_source: 'external_app',
      };

      const result = await assetMonitoringService.ingestEvent(payload, 'external_app_report', {
        request_ip: req.ip,
        auth_user_id: req.user?.id || null,
        auth_username: req.user?.username || null,
        auth_role: req.user?.role || null,
        iot_auth_tenant_id: tenantId,
        upload_mode: 'jwt_multipart',
      });

      return res.json({
        success: true,
        message: '设备故障上报成功',
        data: {
          ...result,
          tenant_id: tenantId,
          runtime_state: runtimeState,
          error_code: errorCode || null,
          error_message: errorMessage || null,
          error_analysis: errorAnalysis || null,
          severity: severity || null,
          uploaded_images: uploadedImages,
        },
      });
    } catch (error) {
      if (savedFiles.length > 0) {
        await Promise.all(savedFiles.map(filePath => fs.unlink(filePath).catch(() => null)));
      }

      const statusCode =
        error.statusCode ||
        (KNOWN_CLIENT_ERROR_MESSAGES.has(error.message) ? 400 : 500);

      return res.status(statusCode).json({
        success: false,
        message: error.message || '设备故障上报失败',
      });
    }
  }
}

module.exports = new AssetMonitoringController();
