const locationService = require('../services/location.service');
const { verifyIngestToken } = require('./ingest-auth.util');

const resolveSessionTenantId = req => Number(req.user?.tenant_id || req.headers['x-tenant-id']);

const resolveBatchFailureMessage = (batchResult, fallbackMessage) =>
  batchResult?.results?.find(item => item && item.success === false)?.message || fallbackMessage;

class GeoLocationController {
  async ingest(req, res) {
    try {
      if (
        !(await verifyIngestToken(req, res, {
          expectedToken: process.env.IOT_GEO_INGEST_TOKEN,
          moduleName: '地理定位',
          scope: 'geo-location',
        }))
      ) {
        return;
      }

      if (Array.isArray(req.body)) {
        const events = req.body;
        const batchResult = await locationService.ingestGeoBatch(events, 'http_batch', {
          request_ip: req.ip,
          iot_auth_tenant_id: req.iotAuth?.tenant_id || null,
        });
        return res.json({
          success: true,
          message: `批量接收完成，成功 ${batchResult.success}/${batchResult.total}`,
          data: batchResult,
        });
      }

      const result = await locationService.ingestGeoEvent(req.body || {}, 'http', {
        request_ip: req.ip,
        iot_auth_tenant_id: req.iotAuth?.tenant_id || null,
      });

      res.json({
        success: true,
        message: '地理定位数据接收成功',
        data: result,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message || '地理定位数据接收失败',
      });
    }
  }

  async ingestBatch(req, res) {
    try {
      if (
        !(await verifyIngestToken(req, res, {
          expectedToken: process.env.IOT_GEO_INGEST_TOKEN,
          moduleName: '地理定位',
          scope: 'geo-location',
        }))
      ) {
        return;
      }

      const events = Array.isArray(req.body?.events) ? req.body.events : [];
      if (events.length === 0) {
        return res.status(400).json({ success: false, message: 'events 不能为空' });
      }

      const batchResult = await locationService.ingestGeoBatch(events, 'http_batch', {
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

      const batchResult = await locationService.ingestGeoBatch(events, 'ui_sample', {
        request_ip: req.ip,
        auth_user_id: req.user?.id || null,
        auth_username: req.user?.username || null,
        auth_role: req.user?.role || null,
        iot_auth_tenant_id: tenantId,
      });

      if (batchResult.success === 0) {
        return res.status(400).json({
          success: false,
          message: resolveBatchFailureMessage(batchResult, '样例地理定位数据写入失败'),
          data: batchResult,
        });
      }

      return res.json({
        success: true,
        message: `样例地理定位数据写入完成，成功 ${batchResult.success}/${batchResult.total}`,
        data: batchResult,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message || '样例地理定位数据写入失败',
      });
    }
  }

  async getLatestByDevice(req, res) {
    try {
      const { deviceId } = req.params;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      if (!tenantId) {
        return res.status(400).json({ success: false, message: '缺少租户ID' });
      }

      const data = await locationService.getLatestGeoByDevice(deviceId, tenantId);
      if (!data) {
        return res.status(404).json({ success: false, message: '未找到设备地理定位数据' });
      }

      res.json({ success: true, data });
    } catch (error) {
      res.status(500).json({ success: false, message: '查询最新地理定位失败', error: error.message });
    }
  }

  async getAssetSeries(req, res) {
    try {
      const { assetCode } = req.params;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      if (!tenantId) {
        return res.status(400).json({ success: false, message: '缺少租户ID' });
      }

      const data = await locationService.getAssetGeoSeries(assetCode, tenantId, req.query || {});
      res.json({ success: true, data });
    } catch (error) {
      res.status(500).json({ success: false, message: '查询资产地理定位时序失败', error: error.message });
    }
  }

  async getLatestByAsset(req, res) {
    try {
      const { assetCode } = req.params;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      if (!tenantId) {
        return res.status(400).json({ success: false, message: '缺少租户ID' });
      }

      const data = await locationService.getLatestGeoByAsset(assetCode, tenantId);
      if (!data) {
        return res.status(404).json({ success: false, message: '未找到资产地理定位数据' });
      }

      return res.json({ success: true, data });
    } catch (error) {
      return res.status(500).json({ success: false, message: '查询资产最新地理定位失败', error: error.message });
    }
  }

  async pipelineHealth(req, res) {
    try {
      await locationService.initGeoPipeline();
      res.json({ success: true, data: locationService.getGeoPipelineHealth() });
    } catch (error) {
      res.status(500).json({ success: false, message: '查询地理定位管道状态失败', error: error.message });
    }
  }

  async pipelineDocs(req, res) {
    try {
      await locationService.initGeoPipeline();
      res.json({ success: true, data: locationService.getGeoPipelineDocs() });
    } catch (error) {
      res.status(500).json({ success: false, message: '查询接口文档失败', error: error.message });
    }
  }
}

module.exports = new GeoLocationController();
