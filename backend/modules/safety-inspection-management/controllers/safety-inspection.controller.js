const safetyInspectionService = require('../services/safety-inspection.service');
const logger = require('../../../config/logger');

// 定义错误类型
const ERROR_TYPES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  DATABASE_ERROR: 'DATABASE_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
};

class SafetyInspectionController {
  /**
   * 获取检测列表
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async getInspections(req, res) {
    try {
      const { page = 1, pageSize = 20, inspection_type, result, keyword } = req.query;
      const tenantId = req.user.tenant_id;

      logger.info('获取检测列表请求', {
        tenantId,
        page,
        pageSize,
        inspection_type,
        result,
        keyword,
      });

      const result_data = await safetyInspectionService.getInspections({
        tenantId,
        page,
        pageSize,
        inspection_type,
        result,
        keyword,
      });

      logger.info('获取检测列表成功', {
        tenantId,
        count: result_data.data.length,
        total: result_data.pagination.total,
      });

      res.json({
        success: true,
        data: result_data.data,
        pagination: result_data.pagination,
      });
    } catch (error) {
      logger.error('获取检测列表失败', {
        error: error.message,
        stack: error.stack,
        tenantId: req.user?.tenant_id,
      });
      res.status(500).json({
        success: false,
        message: '获取检测列表失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }

  /**
   * 获取检测详情
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async getInspectionById(req, res) {
    try {
      const { id } = req.params;
      const tenantId = req.user.tenant_id;

      const inspection = await safetyInspectionService.getInspectionById(id, tenantId);

      if (!inspection) {
        return res.status(404).json({ success: false, message: '检测记录不存在' });
      }

      res.json({ success: true, data: inspection });
    } catch (error) {
      logger.error('获取检测详情失败', {
        error: error.message,
        stack: error.stack,
        inspectionId: req.params?.id,
        tenantId: req.user?.tenant_id,
      });
      res.status(500).json({ success: false, message: '获取检测详情失败', error: error.message });
    }
  }

  /**
   * 创建检测记录
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async createInspection(req, res) {
    try {
      const data = req.body;
      const tenantId = req.user.tenant_id;
      const userId = req.user.id;

      // 验证必填字段
      if (!data.inspection_code || !data.inspection_name || !data.asset_id) {
        return res.status(400).json({
          success: false,
          message: '检测编号、检测名称和资产ID不能为空',
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      // 验证资产是否存在
      if (!(await safetyInspectionService.hasTenantAsset(data.asset_id, tenantId))) {
        return res.status(404).json({ success: false, message: '资产不存在' });
      }

      logger.info('创建检测记录请求', {
        tenantId,
        inspectionCode: data.inspection_code,
        assetId: data.asset_id,
      });

      const result_data = await safetyInspectionService.createInspection(data, tenantId, userId);

      logger.info('创建检测记录成功', {
        tenantId,
        inspectionId: result_data.id,
      });

      res.json({
        success: true,
        message: '创建成功',
        data: result_data,
      });
    } catch (error) {
      logger.error('创建检测失败', {
        error: error.message,
        stack: error.stack,
        tenantId: req.user?.tenant_id,
      });
      if (error.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ success: false, message: '检测编号已存在' });
      }
      res.status(500).json({
        success: false,
        message: '创建检测失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }

  /**
   * 更新检测记录
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async updateInspection(req, res) {
    try {
      const { id } = req.params;
      const updates = req.body;
      const tenantId = req.user.tenant_id;

      // 如果更新资产ID，验证资产是否存在
      if (updates.asset_id !== undefined && !(await safetyInspectionService.hasTenantAsset(updates.asset_id, tenantId))) {
        return res.status(404).json({ success: false, message: '资产不存在' });
      }

      logger.info('更新检测记录请求', {
        tenantId,
        inspectionId: id,
        updates: Object.keys(updates),
      });

      const success = await safetyInspectionService.updateInspection(id, updates, tenantId);

      if (!success) {
        return res.status(404).json({ success: false, message: '检测记录不存在' });
      }

      logger.info('更新检测记录成功', {
        tenantId,
        inspectionId: id,
      });

      res.json({ success: true, message: '更新成功' });
    } catch (error) {
      logger.error('更新检测失败', {
        error: error.message,
        stack: error.stack,
        inspectionId: req.params?.id,
        tenantId: req.user?.tenant_id,
      });
      res.status(500).json({
        success: false,
        message: '更新检测失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }

  /**
   * 删除检测记录
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async deleteInspection(req, res) {
    try {
      const { id } = req.params;
      const tenantId = req.user.tenant_id;

      logger.info('删除检测记录请求', {
        tenantId,
        inspectionId: id,
      });

      const success = await safetyInspectionService.deleteInspection(id, tenantId);

      if (!success) {
        return res.status(404).json({ success: false, message: '检测记录不存在' });
      }

      logger.info('删除检测记录成功', {
        tenantId,
        inspectionId: id,
      });

      res.json({ success: true, message: '删除成功' });
    } catch (error) {
      logger.error('删除检测失败', {
        error: error.message,
        stack: error.stack,
        inspectionId: req.params?.id,
        tenantId: req.user?.tenant_id,
      });
      res.status(500).json({
        success: false,
        message: '删除检测失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }

  /**
   * 获取即将到期的检测列表
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async getExpiringInspections(req, res) {
    try {
      const { days = 30 } = req.query;
      const tenantId = req.user.tenant_id;

      logger.info('获取到期提醒列表请求', {
        tenantId,
        days,
      });

      const inspections = await safetyInspectionService.listExpiringInspections({
        tenantId,
        days: parseInt(days),
      });

      logger.info('获取到期提醒列表成功', {
        tenantId,
        count: inspections.length,
      });

      res.json({
        success: true,
        data: inspections,
      });
    } catch (error) {
      logger.error('获取到期提醒列表失败', {
        error: error.message,
        stack: error.stack,
        tenantId: req.user?.tenant_id,
      });
      res.status(500).json({
        success: false,
        message: '获取到期提醒列表失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }

  // ============ 复核 ============
  async reviewInspection(req, res) {
    try {
      const { decision, remark } = req.body;
      if (!['approve', 'reject'].includes(decision)) {
        return res.status(400).json({ success: false, message: 'decision 必须是 approve 或 reject' });
      }
      const ok = await safetyInspectionService.reviewInspection(
        req.params.id, { decision, remark }, req.user.tenant_id,
        { id: req.user.id, username: req.user.username || req.user.name, real_name: req.user.real_name || req.user.username },
      );
      res.json({ success: ok, message: ok ? '复核成功' : '记录不存在' });
    } catch (error) {
      logger.error('复核安全检测失败', { error: error.message });
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // ============ 整改问题 ============
  async getIssues(req, res) {
    try {
      const r = await safetyInspectionService.getIssues({ ...req.query, tenantId: req.user.tenant_id });
      res.json({ success: true, data: r.data, pagination: r.pagination });
    } catch (error) {
      logger.error('获取安全检测问题失败', { error: error.message });
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async getIssueById(req, res) {
    try {
      const issue = await safetyInspectionService.getIssueById(req.params.id, req.user.tenant_id);
      if (!issue) return res.status(404).json({ success: false, message: '问题不存在' });
      res.json({ success: true, data: issue });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async updateIssue(req, res) {
    try {
      const ok = await safetyInspectionService.updateIssue(req.params.id, req.body, req.user.tenant_id);
      res.json({ success: ok, message: ok ? '更新成功' : '问题不存在' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // ============ 统计 ============
  async getStatistics(req, res) {
    try {
      const r = await safetyInspectionService.getStatistics(req.user.tenant_id, req.query);
      res.json({ success: true, data: r });
    } catch (error) {
      logger.error('获取安全检测统计失败', { error: error.message });
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

module.exports = new SafetyInspectionController();
