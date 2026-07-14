const adverseEventService = require('../services/adverse-event.service');
const db = require('../../../config/database');
const logger = require('../../../config/logger');
const { getTenantId } = require('../../../middleware/tenant-filter');

// 错误类型定义
const ERROR_TYPES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  DUPLICATE_ERROR: 'DUPLICATE_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
};

class AdverseEventController {
  /**
   * 获取不良事件记录列表
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async getAdverseEvents(req, res) {
    try {
      const tenantId = this._resolveTenantIdOrRespond(req, res);
      if (!tenantId) return;

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

      logger.info('获取不良事件列表请求', {
        tenantId,
        page,
        pageSize,
        report_type,
        severity,
        status,
      });

      const result = await adverseEventService.getAdverseEvents({
        page,
        pageSize,
        report_type,
        severity,
        event_level,
        status,
        reporter,
        start_date,
        end_date,
        keyword,
        tenantId,
        user: req.user,
      });

      logger.info('获取不良事件列表成功', {
        tenantId,
        count: result.data.length,
        total: result.pagination.total,
      });

      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error('获取不良事件列表失败', {
        error: error.message,
        stack: error.stack,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });

      res.status(500).json({
        success: false,
        message: '获取不良事件列表失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }

  /**
   * 获取单个不良事件记录详情
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async getAdverseEventById(req, res) {
    try {
      const tenantId = this._resolveTenantIdOrRespond(req, res);
      if (!tenantId) return;

      const { id } = req.params;

      const record = await adverseEventService.getAdverseEventById(id, tenantId, req.user);

      if (!record) {
        return res.status(404).json({ success: false, message: '不良事件记录不存在' });
      }

      res.json({ success: true, data: record });
    } catch (error) {
      logger.error('获取不良事件详情失败', {
        error: error.message,
        stack: error.stack,
        recordId: req.params?.id,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });

      res.status(500).json({
        success: false,
        message: '获取不良事件详情失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }

  /**
   * 创建不良事件记录
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async createAdverseEvent(req, res) {
    try {
      const tenantId = this._resolveTenantIdOrRespond(req, res);
      if (!tenantId) return;

      const result = await adverseEventService.createAdverseEvent(req.body, tenantId, req.user);

      logger.info('创建不良事件成功', {
        tenantId,
        id: result.id,
        report_no: result.report_no,
      });

      res.json({
        success: true,
        message: '不良事件记录创建成功',
        data: result,
      });
    } catch (error) {
      logger.error('创建不良事件失败', {
        error: error.message,
        stack: error.stack,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });

      if (error.status) {
        return res.status(error.status).json({
          success: false,
          message: error.message,
          errorType: error.errorType || ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      res.status(500).json({
        success: false,
        message: '创建不良事件失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }

  /**
   * 更新不良事件记录
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async updateAdverseEvent(req, res) {
    try {
      const tenantId = this._resolveTenantIdOrRespond(req, res);
      if (!tenantId) return;

      const { id } = req.params;

      await adverseEventService.updateAdverseEvent(id, req.body, tenantId, req.user);

      logger.info('更新不良事件成功', {
        tenantId,
        id,
      });

      res.json({ success: true, message: '不良事件记录更新成功' });
    } catch (error) {
      logger.error('更新不良事件失败', {
        error: error.message,
        stack: error.stack,
        recordId: req.params?.id,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });

      if (error.status) {
        return res.status(error.status).json({
          success: false,
          message: error.message,
          errorType: error.errorType || ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      res.status(500).json({
        success: false,
        message: '更新不良事件失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }

  /**
   * 删除不良事件记录
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async deleteAdverseEvent(req, res) {
    try {
      const tenantId = this._resolveTenantIdOrRespond(req, res);
      if (!tenantId) return;

      const { id } = req.params;

      await adverseEventService.deleteAdverseEvent(id, tenantId, req.user);

      logger.info('删除不良事件成功', {
        tenantId,
        id,
      });

      res.json({ success: true, message: '不良事件记录删除成功' });
    } catch (error) {
      logger.error('删除不良事件失败', {
        error: error.message,
        stack: error.stack,
        recordId: req.params?.id,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });

      if (error.status) {
        return res.status(error.status).json({
          success: false,
          message: error.message,
          errorType: error.errorType || ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      res.status(500).json({
        success: false,
        message: '删除不良事件失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }

  /**
   * 审批不良事件
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async approveAdverseEvent(req, res) {
    try {
      const tenantId = this._resolveTenantIdOrRespond(req, res);
      if (!tenantId) return;

      const { id } = req.params;
      const { approved, comment, next_handler } = req.body;

      const result = await adverseEventService.approveAdverseEvent(
        id,
        { approved, comment, next_handler },
        tenantId,
        req.user,
      );

      logger.info('审批不良事件成功', {
        tenantId,
        id,
        approved,
        newStatus: result.status,
      });

      res.json({
        success: true,
        message: `审批${approved ? '通过' : '拒绝'}成功`,
        data: result,
      });
    } catch (error) {
      logger.error('审批不良事件失败', {
        error: error.message,
        stack: error.stack,
        recordId: req.params?.id,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });

      if (error.status) {
        return res.status(error.status).json({
          success: false,
          message: error.message,
          errorType: error.errorType || ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      res.status(500).json({
        success: false,
        message: '审批失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }

  /**
   * 关闭不良事件
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async closeAdverseEvent(req, res) {
    try {
      const tenantId = this._resolveTenantIdOrRespond(req, res);
      if (!tenantId) return;

      const { id } = req.params;
      const { close_reason } = req.body;

      await adverseEventService.closeAdverseEvent(id, close_reason, tenantId, req.user);

      logger.info('关闭不良事件成功', {
        tenantId,
        id,
      });

      res.json({ success: true, message: '事件已关闭' });
    } catch (error) {
      logger.error('关闭不良事件失败', {
        error: error.message,
        stack: error.stack,
        recordId: req.params?.id,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });

      if (error.status) {
        return res.status(error.status).json({
          success: false,
          message: error.message,
          errorType: error.errorType || ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      res.status(500).json({
        success: false,
        message: '关闭失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }

  /**
   * 获取工作流记录
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async getWorkflow(req, res) {
    try {
      const tenantId = this._resolveTenantIdOrRespond(req, res);
      if (!tenantId) return;

      const { id } = req.params;

      const workflow = await adverseEventService.getWorkflow(id, tenantId, req.user);

      res.json({ success: true, data: workflow });
    } catch (error) {
      logger.error('获取工作流记录失败', {
        error: error.message,
        stack: error.stack,
        recordId: req.params?.id,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });

      if (error.status) {
        return res.status(error.status).json({
          success: false,
          message: error.message,
          errorType: error.errorType || ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      res.status(500).json({
        success: false,
        message: '获取工作流记录失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }

  /**
   * 获取统计数据
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async getStatistics(req, res) {
    try {
      const tenantId = this._resolveTenantIdOrRespond(req, res);
      if (!tenantId) return;

      const { start_date, end_date } = req.query;

      const stats = await adverseEventService.getStatistics({
        start_date,
        end_date,
        tenantId,
        user: req.user,
      });

      res.json({ success: true, data: stats });
    } catch (error) {
      logger.error('获取统计数据失败', {
        error: error.message,
        stack: error.stack,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });

      res.status(500).json({
        success: false,
        message: '获取统计数据失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }

  /**
   * 获取按科室统计
   */
  async getStatisticsByDepartment(req, res) {
    try {
      const tenantId = this._resolveTenantIdOrRespond(req, res);
      if (!tenantId) return;
      const { start_date, end_date } = req.query;
      const data = await adverseEventService.getStatisticsByDepartment({
        start_date, end_date, tenantId, user: req.user,
      });
      res.json({ success: true, data });
    } catch (error) {
      logger.error('获取按科室统计失败', { error: error.message, tenantId: req.user?.tenant_id || req.headers['x-tenant-id'] });
      res.status(500).json({ success: false, message: '获取按科室统计失败', error: error.message });
    }
  }

  /**
   * 获取按资产统计 TOP N
   */
  async getStatisticsByAsset(req, res) {
    try {
      const tenantId = this._resolveTenantIdOrRespond(req, res);
      if (!tenantId) return;
      const { start_date, end_date, limit } = req.query;
      const data = await adverseEventService.getStatisticsByAsset({
        start_date, end_date, limit, tenantId, user: req.user,
      });
      res.json({ success: true, data });
    } catch (error) {
      logger.error('获取按资产统计失败', { error: error.message, tenantId: req.user?.tenant_id || req.headers['x-tenant-id'] });
      res.status(500).json({ success: false, message: '获取按资产统计失败', error: error.message });
    }
  }

  /**
   * 获取处理效率统计
   */
  async getHandleEfficiency(req, res) {
    try {
      const tenantId = this._resolveTenantIdOrRespond(req, res);
      if (!tenantId) return;
      const { start_date, end_date } = req.query;
      const data = await adverseEventService.getHandleEfficiency({
        start_date, end_date, tenantId, user: req.user,
      });
      res.json({ success: true, data });
    } catch (error) {
      logger.error('获取处理效率统计失败', { error: error.message, tenantId: req.user?.tenant_id || req.headers['x-tenant-id'] });
      res.status(500).json({ success: false, message: '获取处理效率统计失败', error: error.message });
    }
  }

  /**
   * 获取超时提醒列表
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async getOverdueAlerts(req, res) {
    try {
      const tenantId = this._resolveTenantIdOrRespond(req, res);
      if (!tenantId) return;

      const overdue = await adverseEventService.getOverdueAlerts(tenantId, req.user);

      res.json({ success: true, data: overdue });
    } catch (error) {
      logger.error('获取超时提醒失败', {
        error: error.message,
        stack: error.stack,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });

      res.status(500).json({
        success: false,
        message: '获取超时提醒失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }

  // ==================== 私有辅助方法 ====================

  _resolveTenantIdOrRespond(req, res) {
    const tenantId = Number.parseInt(String(getTenantId(req) ?? ''), 10);
    if (!Number.isInteger(tenantId) || tenantId <= 0) {
      res.status(400).json({
        success: false,
        message:
          req.user?.role === 'super_admin'
            ? '请先选择企业空间'
            : '当前用户未分配企业空间',
        code: 'REQUIRE_TENANT',
      });
      return null;
    }
    return tenantId;
  }
}

module.exports = new AdverseEventController();
