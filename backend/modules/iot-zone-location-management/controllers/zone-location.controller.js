const zoneLocationPipelineService = require('../services/zone-location-pipeline.service');
const { verifyIngestToken } = require('./ingest-auth.util');

const resolveSessionTenantId = req => Number(req.user?.tenant_id || req.headers['x-tenant-id']);

const resolveBatchFailureMessage = (batchResult, fallbackMessage) =>
  batchResult?.results?.find(item => item && item.success === false)?.message || fallbackMessage;

class ZoneLocationController {
  async ingest(req, res) {
    try {
      if (
        !(await verifyIngestToken(req, res, {
          expectedToken: process.env.IOT_ZONE_INGEST_TOKEN,
          moduleName: '区域定位',
          scope: 'zone-location',
        }))
      ) {
        return;
      }

      if (Array.isArray(req.body)) {
        const events = req.body;
        const batchResult = await zoneLocationPipelineService.ingestBatch(events, 'http_batch', {
          request_ip: req.ip,
          iot_auth_tenant_id: req.iotAuth?.tenant_id || null,
        });
        return res.json({
          success: true,
          message: `批量接收完成，成功 ${batchResult.success}/${batchResult.total}`,
          data: batchResult,
        });
      }

      const result = await zoneLocationPipelineService.ingestEvent(req.body || {}, 'http', {
        request_ip: req.ip,
        iot_auth_tenant_id: req.iotAuth?.tenant_id || null,
      });

      res.json({
        success: true,
        message: '区域定位数据接收成功',
        data: result,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message || '区域定位数据接收失败',
      });
    }
  }

  async ingestBatch(req, res) {
    try {
      if (
        !(await verifyIngestToken(req, res, {
          expectedToken: process.env.IOT_ZONE_INGEST_TOKEN,
          moduleName: '区域定位',
          scope: 'zone-location',
        }))
      ) {
        return;
      }

      const events = Array.isArray(req.body?.events) ? req.body.events : [];
      if (events.length === 0) {
        return res.status(400).json({ success: false, message: 'events 不能为空' });
      }

      const batchResult = await zoneLocationPipelineService.ingestBatch(events, 'http_batch', {
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

      const batchResult = await zoneLocationPipelineService.ingestBatch(events, 'ui_sample', {
        request_ip: req.ip,
        auth_user_id: req.user?.id || null,
        auth_username: req.user?.username || null,
        auth_role: req.user?.role || null,
        iot_auth_tenant_id: tenantId,
      });

      if (batchResult.success === 0) {
        return res.status(400).json({
          success: false,
          message: resolveBatchFailureMessage(batchResult, '样例区域定位数据写入失败'),
          data: batchResult,
        });
      }

      return res.json({
        success: true,
        message: `样例区域定位数据写入完成，成功 ${batchResult.success}/${batchResult.total}`,
        data: batchResult,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message || '样例区域定位数据写入失败',
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

      const data = await zoneLocationPipelineService.getLatestByDevice(deviceId, tenantId);
      if (!data) {
        return res.status(404).json({ success: false, message: '未找到设备时序数据' });
      }

      res.json({ success: true, data });
    } catch (error) {
      res.status(500).json({ success: false, message: '查询最新区域定位失败', error: error.message });
    }
  }

  async getAssetSeries(req, res) {
    try {
      const { assetCode } = req.params;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      if (!tenantId) {
        return res.status(400).json({ success: false, message: '缺少租户ID' });
      }

      const data = await zoneLocationPipelineService.getAssetSeries(assetCode, tenantId, req.query || {});
      res.json({ success: true, data });
    } catch (error) {
      res.status(500).json({ success: false, message: '查询资产区域定位时序失败', error: error.message });
    }
  }

  async getLatestByAsset(req, res) {
    try {
      const { assetCode } = req.params;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      if (!tenantId) {
        return res.status(400).json({ success: false, message: '缺少租户ID' });
      }

      const data = await zoneLocationPipelineService.getLatestByAsset(assetCode, tenantId);
      if (!data) {
        return res.status(404).json({ success: false, message: '未找到资产区域定位数据' });
      }

      return res.json({ success: true, data });
    } catch (error) {
      return res.status(500).json({ success: false, message: '查询资产最新区域定位失败', error: error.message });
    }
  }

  async pipelineHealth(req, res) {
    try {
      await zoneLocationPipelineService.init();
      res.json({ success: true, data: zoneLocationPipelineService.getPipelineHealth() });
    } catch (error) {
      res.status(500).json({ success: false, message: '查询管道状态失败', error: error.message });
    }
  }

  async pipelineDocs(req, res) {
    try {
      await zoneLocationPipelineService.init();
      res.json({ success: true, data: zoneLocationPipelineService.getPipelineDocs() });
    } catch (error) {
      res.status(500).json({ success: false, message: '查询接口文档失败', error: error.message });
    }
  }
}

module.exports = new ZoneLocationController();
