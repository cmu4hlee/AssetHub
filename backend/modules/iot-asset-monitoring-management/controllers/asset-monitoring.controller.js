const assetMonitoringPipelineService = require('../services/asset-monitoring-pipeline.service');
const { verifyIngestToken } = require('./ingest-auth.util');

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
      ) {
        return;
      }

      if (Array.isArray(req.body)) {
        const events = req.body;
        const batchResult = await assetMonitoringPipelineService.ingestBatch(events, 'http_batch', {
          request_ip: req.ip,
          iot_auth_tenant_id: req.iotAuth?.tenant_id || null,
        });
        return res.json({
          success: true,
          message: `批量接收完成，成功 ${batchResult.success}/${batchResult.total}`,
          data: batchResult,
        });
      }

      const result = await assetMonitoringPipelineService.ingestEvent(req.body || {}, 'http', {
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
      ) {
        return;
      }

      const events = Array.isArray(req.body?.events) ? req.body.events : [];
      if (events.length === 0) {
        return res.status(400).json({ success: false, message: 'events 不能为空' });
      }

      const batchResult = await assetMonitoringPipelineService.ingestBatch(events, 'http_batch', {
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

      const batchResult = await assetMonitoringPipelineService.ingestBatch(events, 'ui_sample', {
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

      if (!tenantId) {
        return res.status(400).json({ success: false, message: '缺少租户ID' });
      }

      const data = await assetMonitoringPipelineService.getLatestByDevice(deviceId, tenantId);
      if (!data) {
        return res.status(404).json({ success: false, message: '未找到设备资产监测数据' });
      }

      res.json({ success: true, data });
    } catch (error) {
      res.status(500).json({ success: false, message: '查询最新资产监测失败', error: error.message });
    }
  }

  async getAssetSeries(req, res) {
    try {
      const { assetCode } = req.params;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      if (!tenantId) {
        return res.status(400).json({ success: false, message: '缺少租户ID' });
      }

      const data = await assetMonitoringPipelineService.getAssetSeries(assetCode, tenantId, req.query || {});
      res.json({ success: true, data });
    } catch (error) {
      res.status(500).json({ success: false, message: '查询资产监测时序失败', error: error.message });
    }
  }

  async getLatestByAsset(req, res) {
    try {
      const { assetCode } = req.params;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      if (!tenantId) {
        return res.status(400).json({ success: false, message: '缺少租户ID' });
      }

      const data = await assetMonitoringPipelineService.getLatestByAsset(assetCode, tenantId);
      if (!data) {
        return res.status(404).json({ success: false, message: '未找到资产监测数据' });
      }

      return res.json({ success: true, data });
    } catch (error) {
      return res.status(500).json({ success: false, message: '查询资产最新监测失败', error: error.message });
    }
  }

  async pipelineHealth(req, res) {
    try {
      await assetMonitoringPipelineService.init();
      res.json({ success: true, data: assetMonitoringPipelineService.getPipelineHealth() });
    } catch (error) {
      res.status(500).json({ success: false, message: '查询资产监测管道状态失败', error: error.message });
    }
  }

  async pipelineDocs(req, res) {
    try {
      await assetMonitoringPipelineService.init();
      res.json({ success: true, data: assetMonitoringPipelineService.getPipelineDocs() });
    } catch (error) {
      res.status(500).json({ success: false, message: '查询接口文档失败', error: error.message });
    }
  }
}

module.exports = new AssetMonitoringController();
