const patientVolumeService = require('../services/patient-volume-pipeline.service');

const resolveSessionTenantId = req => Number(req.user?.tenant_id || req.headers['x-tenant-id']);

const resolveBatchFailureMessage = (batchResult, fallbackMessage) =>
  batchResult?.results?.find(item => item && item.success === false)?.message || fallbackMessage;

class PatientVolumeController {
  async ingest(req, res) {
    try {
      const tenantId = resolveSessionTenantId(req);
      if (!Number.isFinite(tenantId) || tenantId <= 0) {
        return res.status(400).json({ success: false, message: '缺少有效的租户ID' });
      }

      if (Array.isArray(req.body)) {
        const events = req.body;
        const batchResult = await patientVolumeService.ingestBatch(events, 'http_batch', {
          request_ip: req.ip,
          auth_user_id: req.user?.id || null,
          auth_username: req.user?.username || null,
          auth_role: req.user?.role || null,
          iot_auth_tenant_id: tenantId,
        });
        return res.json({
          success: true,
          message: `批量接收完成，成功 ${batchResult.success}/${batchResult.total}`,
          data: batchResult,
        });
      }

      const result = await patientVolumeService.ingestEvent(req.body || {}, 'http', {
        request_ip: req.ip,
        auth_user_id: req.user?.id || null,
        auth_username: req.user?.username || null,
        auth_role: req.user?.role || null,
        iot_auth_tenant_id: tenantId,
      });

      return res.json({ success: true, message: '患者量数据接收成功', data: result });
    } catch (error) {
      return res.status(400).json({ success: false, message: error.message || '患者量数据接收失败' });
    }
  }

  async ingestBatch(req, res) {
    try {
      const tenantId = resolveSessionTenantId(req);
      if (!Number.isFinite(tenantId) || tenantId <= 0) {
        return res.status(400).json({ success: false, message: '缺少有效的租户ID' });
      }

      const events = Array.isArray(req.body?.events) ? req.body.events : [];
      if (events.length === 0) {
        return res.status(400).json({ success: false, message: 'events 不能为空' });
      }

      const batchResult = await patientVolumeService.ingestBatch(events, 'http_batch', {
        request_ip: req.ip,
        auth_user_id: req.user?.id || null,
        auth_username: req.user?.username || null,
        auth_role: req.user?.role || null,
        iot_auth_tenant_id: tenantId,
      });

      return res.json({
        success: true,
        message: `批量接收完成，成功 ${batchResult.success}/${batchResult.total}`,
        data: batchResult,
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: '批量接收失败', error: error.message });
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

      const batchResult = await patientVolumeService.ingestBatch(events, 'ui_sample', {
        request_ip: req.ip,
        auth_user_id: req.user?.id || null,
        auth_username: req.user?.username || null,
        auth_role: req.user?.role || null,
        iot_auth_tenant_id: tenantId,
      });

      if (batchResult.success === 0) {
        return res.status(400).json({
          success: false,
          message: resolveBatchFailureMessage(batchResult, '样例患者量数据写入失败'),
          data: batchResult,
        });
      }

      return res.json({
        success: true,
        message: `样例患者量数据写入完成，成功 ${batchResult.success}/${batchResult.total}`,
        data: batchResult,
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message || '样例患者量数据写入失败' });
    }
  }

  async getUsageStats(req, res) {
    try {
      const tenantId = resolveSessionTenantId(req);
      if (!Number.isFinite(tenantId) || tenantId <= 0) {
        return res.status(400).json({ success: false, message: '缺少有效的租户ID' });
      }

      const data = await patientVolumeService.getUsageStats(tenantId, req.query || {});
      return res.json({ success: true, data });
    } catch (error) {
      return res.status(500).json({ success: false, message: '查询资产使用量统计失败', error: error.message });
    }
  }

  async getRecentRecords(req, res) {
    try {
      const tenantId = resolveSessionTenantId(req);
      if (!Number.isFinite(tenantId) || tenantId <= 0) {
        return res.status(400).json({ success: false, message: '缺少有效的租户ID' });
      }

      const data = await patientVolumeService.getRecentRecords(tenantId, req.query || {});
      return res.json({ success: true, data });
    } catch (error) {
      return res.status(500).json({ success: false, message: '查询患者使用记录列表失败', error: error.message });
    }
  }

  async getLatestByAsset(req, res) {
    try {
      const { assetCode } = req.params;
      const tenantId = resolveSessionTenantId(req);
      if (!Number.isFinite(tenantId) || tenantId <= 0) {
        return res.status(400).json({ success: false, message: '缺少有效的租户ID' });
      }

      const data = await patientVolumeService.getLatestByAsset(assetCode, tenantId);
      if (!data) {
        return res.json({ success: true, data: null, message: '当前资产暂无患者量记录' });
      }

      return res.json({ success: true, data });
    } catch (error) {
      return res.status(500).json({ success: false, message: '查询资产最新患者量失败', error: error.message });
    }
  }

  async getAssetSeries(req, res) {
    try {
      const { assetCode } = req.params;
      const tenantId = resolveSessionTenantId(req);
      if (!Number.isFinite(tenantId) || tenantId <= 0) {
        return res.status(400).json({ success: false, message: '缺少有效的租户ID' });
      }

      const data = await patientVolumeService.getAssetSeries(assetCode, tenantId, req.query || {});
      return res.json({ success: true, data });
    } catch (error) {
      return res.status(500).json({ success: false, message: '查询资产患者量趋势失败', error: error.message });
    }
  }

  async getPatientListByAsset(req, res) {
    try {
      const { assetCode } = req.params;
      const tenantId = resolveSessionTenantId(req);
      if (!Number.isFinite(tenantId) || tenantId <= 0) {
        return res.status(400).json({ success: false, message: '缺少有效的租户ID' });
      }

      const data = await patientVolumeService.getPatientListByAsset(assetCode, tenantId, req.query || {});
      return res.json({ success: true, data });
    } catch (error) {
      return res.status(500).json({ success: false, message: '查询资产患者列表失败', error: error.message });
    }
  }

  async pipelineHealth(req, res) {
    try {
      await patientVolumeService.init();
      return res.json({ success: true, data: patientVolumeService.getPipelineHealth() });
    } catch (error) {
      return res.status(500).json({ success: false, message: '查询患者量管道状态失败', error: error.message });
    }
  }

  async pipelineDocs(req, res) {
    try {
      await patientVolumeService.init();
      return res.json({ success: true, data: patientVolumeService.getPipelineDocs() });
    } catch (error) {
      return res.status(500).json({ success: false, message: '查询接口文档失败', error: error.message });
    }
  }

  async getAllRecords(req, res) {
    try {
      const tenantId = resolveSessionTenantId(req);
      if (!Number.isFinite(tenantId) || tenantId <= 0) {
        return res.status(400).json({ success: false, message: '缺少有效的租户ID' });
      }

      const data = await patientVolumeService.getAllRecords(tenantId, req.query || {});
      return res.json({ success: true, ...data });
    } catch (error) {
      return res.status(500).json({ success: false, message: '全量查询患者使用记录失败', error: error.message });
    }
  }

  async getAllAssetStats(req, res) {
    try {
      const tenantId = resolveSessionTenantId(req);
      if (!Number.isFinite(tenantId) || tenantId <= 0) {
        return res.status(400).json({ success: false, message: '缺少有效的租户ID' });
      }

      const data = await patientVolumeService.getAllAssetStats(tenantId, req.query || {});
      return res.json({ success: true, ...data });
    } catch (error) {
      return res.status(500).json({ success: false, message: '全量查询资产使用统计失败', error: error.message });
    }
  }
}

module.exports = new PatientVolumeController();
