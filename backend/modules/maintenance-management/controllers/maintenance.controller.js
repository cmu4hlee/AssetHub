const logsService = require('../../../services/maintenance/logs.service');
const requestsService = require('../../../services/maintenance/requests.service');
const workordersService = require('../../../services/maintenance/workorders.service');
const costsService = require('../../../services/maintenance/costs.service');
const plansService = require('../../../services/maintenance/plans.service');
const templatesService = require('../../../services/maintenance/templates.service');
const remindersService = require('../../../services/maintenance/reminders.service');
const analyticsService = require('../../../services/maintenance/analytics.service');
const usageService = require('../../../services/maintenance/usage.service');
const evaluationsService = require('../../../services/maintenance/evaluations.service');
const logger = require('../../../config/logger');
const eventBus = require('../../../core/EventBus').getEventBus();

// 定义错误类型
const ERROR_TYPES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  DUPLICATE_ERROR: 'DUPLICATE_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
};

class MaintenanceController {
  /**
   * 发送结果到客户端
   * @param {Object} res - 响应对象
   * @param {Object} result - 结果对象
   */
  sendResult(res, result) {
    if (result.statusCode && result.statusCode !== 200) {
      return res.status(result.statusCode).json(result.body);
    }
    if (result.body) {
      return res.json(result.body);
    }
    return res.json(result);
  }

  /**
   * 安全地向 EventBus 发布事件（fail-soft）
   * - 监听器抛错由 EventBus + 监听器自身双层 catch，主流程不受影响
   * - 这里再 catch 一次纯粹防御性：避免 EventBus 自身异常阻塞后续逻辑
   *
   * @param {string} eventName - 事件名
   * @param {Object} payload - 事件载荷
   */
  emitMaintenanceEvent(eventName, payload) {
    try {
      // debug 级日志：事件发布在生产常态下不需要刷屏
      logger.debug(`[maintenance-event] emit ${eventName}`, {
        requestId: payload?.requestId,
        requestNo: payload?.requestNo,
      });
      eventBus.emit(eventName, payload || {});
    } catch (err) {
      logger.warn(`emit ${eventName} failed`, { error: err.message });
    }
  }

  /**
   * 判断 service 返回值是否表示成功
   */
  isServiceSuccess(result) {
    if (!result) return false;
    if (result.statusCode !== undefined) return result.statusCode === 200;
    return true;
  }

  // ==================== 维护日志 ====================

  /**
   * 获取维护日志列表
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async getLogs(req, res) {
    try {
      const result = await logsService.getLogs(req.query, req);
      res.json(result);
    } catch (error) {
      logger.error('获取维护日志列表失败', {
        error: error.message,
        stack: error.stack,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });
      res.status(500).json({
        success: false,
        message: '获取维护日志列表失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }

  /**
   * 获取维护日志详情
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async getLogById(req, res) {
    try {
      const { id } = req.params;
      if (id && id.includes('attachments')) {
        return res.status(404).json({ success: false, message: '路由匹配错误，请检查路由顺序' });
      }
      const result = await logsService.getLogById(id, req);
      this.sendResult(res, result);
    } catch (error) {
      logger.error('获取维护日志详情失败', {
        error: error.message,
        stack: error.stack,
        logId: req.params?.id,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });
      res.status(500).json({
        success: false,
        message: '获取维护日志详情失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }

  /**
   * 创建维护日志
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async createLog(req, res) {
    try {
      const result = await logsService.createLog(req.body, req);
      this.sendResult(res, result);
    } catch (error) {
      logger.error('创建维护日志失败', {
        error: error.message,
        stack: error.stack,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });
      res.status(500).json({
        success: false,
        message: '创建维护日志失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }

  /**
   * 更新维护日志
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async updateLog(req, res) {
    try {
      const result = await logsService.updateLog(req.params.id, req.body, req);
      this.sendResult(res, result);
    } catch (error) {
      logger.error('更新维护日志失败', {
        error: error.message,
        stack: error.stack,
        logId: req.params?.id,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });
      res.status(500).json({
        success: false,
        message: '更新维护日志失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }

  /**
   * 删除维护日志
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async deleteLog(req, res) {
    try {
      const result = await logsService.deleteLog(req.params.id, req);
      this.sendResult(res, result);
    } catch (error) {
      logger.error('删除维护日志失败', {
        error: error.message,
        stack: error.stack,
        logId: req.params?.id,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });
      res.status(500).json({
        success: false,
        message: '删除维护日志失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }

  /**
   * 获取维护日志附件列表
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async getAttachments(req, res) {
    try {
      const result = await logsService.getAttachments(req.params.id, req);
      res.json(result);
    } catch (error) {
      logger.error('获取附件列表失败', {
        error: error.message,
        stack: error.stack,
        logId: req.params?.id,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });
      res.status(500).json({
        success: false,
        message: '获取附件列表失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }

  /**
   * 上传维护日志附件
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async uploadAttachment(req, res) {
    try {
      const result = await logsService.uploadAttachment(req.params.id, req);
      this.sendResult(res, result);
    } catch (error) {
      logger.error('上传附件失败', {
        error: error.message,
        stack: error.stack,
        logId: req.params?.id,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });
      res.status(500).json({
        success: false,
        message: '上传附件失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }

  /**
   * 获取维护统计
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async getStatistics(req, res) {
    try {
      const result = await logsService.getStatistics(req.query, req);
      res.json(result);
    } catch (error) {
      logger.error('获取维护统计失败', {
        error: error.message,
        stack: error.stack,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });
      res.status(500).json({
        success: false,
        message: '获取维护统计失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }

  // ==================== 维修申请 ====================

  /**
   * 获取维修申请列表
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async getRequests(req, res) {
    try {
      const result = await requestsService.getRequests(req.query, req);
      res.json(result);
    } catch (error) {
      logger.error('获取维修申请列表失败', {
        error: error.message,
        stack: error.stack,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });
      res.status(500).json({
        success: false,
        message: '获取维修申请列表失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }

  /**
   * 获取维修申请详情
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async getRequestById(req, res) {
    try {
      const result = await requestsService.getRequest(req.params.id, req);
      this.sendResult(res, result);
    } catch (error) {
      logger.error('获取维修申请详情失败', {
        error: error.message,
        stack: error.stack,
        requestId: req.params?.id,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });
      res.status(500).json({
        success: false,
        message: '获取维修申请详情失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }

  /**
   * 创建维修申请
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async createRequest(req, res) {
    try {
      const result = await requestsService.createRequest(req.body, req);
      this.sendResult(res, result);
      // 出站事件：飞书出站通知等下游订阅者会收到
      if (this.isServiceSuccess(result)) {
        const data = result.body?.data || {};
        this.emitMaintenanceEvent('maintenance.request.created', {
          tenantId: req.user?.tenant_id,
          requestId: data.id,
          requestNo: data.request_no,
          actorUserId: req.user?.id,
          source: 'maintenance.controller.createRequest',
        });
      }
    } catch (error) {
      logger.error('创建维修申请失败', {
        error: error.message,
        stack: error.stack,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });
      res.status(500).json({
        success: false,
        message: '创建维修申请失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }

  /**
   * 更新维修申请
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async updateRequest(req, res) {
    try {
      const result = await requestsService.updateRequest(req.params.id, req.body, req);
      this.sendResult(res, result);
    } catch (error) {
      logger.error('更新维修申请失败', {
        error: error.message,
        stack: error.stack,
        requestId: req.params?.id,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });
      res.status(500).json({
        success: false,
        message: '更新维修申请失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }

  /**
   * 审批维修申请
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async approveRequest(req, res) {
    try {
      const result = await requestsService.approveRequest(req.params.id, req.body, req);
      this.sendResult(res, result);
      // 出站事件
      if (this.isServiceSuccess(result)) {
        this.emitMaintenanceEvent('maintenance.request.approved', {
          tenantId: req.user?.tenant_id,
          requestId: req.params.id,
          approved: req.body?.approved,
          actorUserId: req.user?.id,
          approverName: req.user?.real_name || req.user?.username,
          source: 'maintenance.controller.approveRequest',
        });
      }
    } catch (error) {
      logger.error('审批维修申请失败', {
        error: error.message,
        stack: error.stack,
        requestId: req.params?.id,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });
      res.status(500).json({
        success: false,
        message: '审批维修申请失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }

  /**
   * 开始维修
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async startRequest(req, res) {
    try {
      const result = await requestsService.startRequest(req.params.id, req.body, req);
      this.sendResult(res, result);
    } catch (error) {
      logger.error('开始维修失败', {
        error: error.message,
        stack: error.stack,
        requestId: req.params?.id,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });
      res.status(500).json({
        success: false,
        message: '开始维修失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }

  /**
   * 完成维修
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async completeRequest(req, res) {
    try {
      const result = await requestsService.completeRequest(req.params.id, req.body, req);
      this.sendResult(res, result);
      // 出站事件
      if (this.isServiceSuccess(result)) {
        this.emitMaintenanceEvent('maintenance.request.completed', {
          tenantId: req.user?.tenant_id,
          requestId: req.params.id,
          actorUserId: req.user?.id,
          repairPersonName: req.body?.repair_person || req.body?.maintenance_person,
          source: 'maintenance.controller.completeRequest',
        });
      }
    } catch (error) {
      logger.error('完成维修失败', {
        error: error.message,
        stack: error.stack,
        requestId: req.params?.id,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });
      res.status(500).json({
        success: false,
        message: '完成维修失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }

  /**
   * 取消维修申请
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async cancelRequest(req, res) {
    try {
      const result = await requestsService.cancelRequest(req.params.id, req);
      this.sendResult(res, result);
    } catch (error) {
      logger.error('取消维修申请失败', {
        error: error.message,
        stack: error.stack,
        requestId: req.params?.id,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });
      res.status(500).json({
        success: false,
        message: '取消维修申请失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }

  /**
   * 删除维修申请
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async deleteRequest(req, res) {
    try {
      const result = await requestsService.deleteRequest(req.params.id, req);
      this.sendResult(res, result);
    } catch (error) {
      logger.error('删除维修申请失败', {
        error: error.message,
        stack: error.stack,
        requestId: req.params?.id,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });
      res.status(500).json({
        success: false,
        message: '删除维修申请失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }

  // ==================== 维修工单 ====================

  /**
   * 获取工单列表
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async getWorkOrders(req, res) {
    try {
      const result = await workordersService.getWorkOrders(req.query, req);
      res.json(result);
    } catch (error) {
      logger.error('获取工单列表失败', {
        error: error.message,
        stack: error.stack,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });
      res.status(500).json({
        success: false,
        message: '获取工单列表失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }

  /**
   * 获取工单详情
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async getWorkOrderById(req, res) {
    try {
      const result = await workordersService.getWorkOrder(req.params.id, req);
      this.sendResult(res, result);
    } catch (error) {
      logger.error('获取工单详情失败', {
        error: error.message,
        stack: error.stack,
        workOrderId: req.params?.id,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });
      res.status(500).json({
        success: false,
        message: '获取工单详情失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }

  /**
   * 创建工单
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async createWorkOrder(req, res) {
    try {
      const result = await workordersService.createWorkOrder(req.body, req);
      this.sendResult(res, result);
    } catch (error) {
      logger.error('创建工单失败', {
        error: error.message,
        stack: error.stack,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });
      res.status(500).json({
        success: false,
        message: '创建工单失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }

  /**
   * 更新工单
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async updateWorkOrder(req, res) {
    try {
      const result = await workordersService.updateWorkOrder(req.params.id, req.body, req);
      this.sendResult(res, result);
    } catch (error) {
      logger.error('更新工单失败', {
        error: error.message,
        stack: error.stack,
        workOrderId: req.params?.id,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });
      res.status(500).json({
        success: false,
        message: '更新工单失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }

  /**
   * 申请人评价工单
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async evaluateWorkOrder(req, res) {
    try {
      const result = await workordersService.evaluateWorkOrder(req.params.id, req.body, req);
      this.sendResult(res, result);
    } catch (error) {
      const status = error.statusCode || 500;
      logger.error('评价工单失败', {
        error: error.message,
        stack: error.stack,
        workOrderId: req.params?.id,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });
      res.status(status).json({
        success: false,
        message: error.message || '评价工单失败',
        error: error.message,
        errorType: status === 400 ? ERROR_TYPES.VALIDATION_ERROR : ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }

  /**
   * 删除工单
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async deleteWorkOrder(req, res) {
    try {
      const result = await workordersService.deleteWorkOrder(req.params.id, req);
      this.sendResult(res, result);
    } catch (error) {
      logger.error('删除工单失败', {
        error: error.message,
        stack: error.stack,
        workOrderId: req.params?.id,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });
      res.status(500).json({
        success: false,
        message: '删除工单失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }

  // ==================== 维修计划 ====================

  /**
   * 获取维修计划列表
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async getPlans(req, res) {
    try {
      const result = await plansService.getPlans(req.query, req);
      res.json(result);
    } catch (error) {
      logger.error('获取维修计划列表失败', {
        error: error.message,
        stack: error.stack,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });
      res.status(500).json({
        success: false,
        message: '获取维修计划列表失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }

  /**
   * 获取维修计划详情
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async getPlanById(req, res) {
    try {
      const result = await plansService.getPlan(req.params.id, req);
      this.sendResult(res, result);
    } catch (error) {
      logger.error('获取维修计划详情失败', {
        error: error.message,
        stack: error.stack,
        planId: req.params?.id,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });
      res.status(500).json({
        success: false,
        message: '获取维修计划详情失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }

  /**
   * 创建维修计划
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async createPlan(req, res) {
    try {
      const result = await plansService.createPlan(req.body, req);
      this.sendResult(res, result);
    } catch (error) {
      logger.error('创建维修计划失败', {
        error: error.message,
        stack: error.stack,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });
      res.status(500).json({
        success: false,
        message: '创建维修计划失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }

  /**
   * 更新维修计划
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async updatePlan(req, res) {
    try {
      const result = await plansService.updatePlan(req.params.id, req.body, req);
      this.sendResult(res, result);
    } catch (error) {
      logger.error('更新维修计划失败', {
        error: error.message,
        stack: error.stack,
        planId: req.params?.id,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });
      res.status(500).json({
        success: false,
        message: '更新维修计划失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }

  /**
   * 删除维修计划
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async deletePlan(req, res) {
    try {
      const result = await plansService.deletePlan(req.params.id, req);
      this.sendResult(res, result);
    } catch (error) {
      logger.error('删除维修计划失败', {
        error: error.message,
        stack: error.stack,
        planId: req.params?.id,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });
      res.status(500).json({
        success: false,
        message: '删除维修计划失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }

  // ==================== 维修费用 ====================

  /**
   * 获取维修费用列表
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async getCosts(req, res) {
    try {
      const result = await costsService.getCosts(req.query, req);
      res.json(result);
    } catch (error) {
      logger.error('获取维修费用列表失败', {
        error: error.message,
        stack: error.stack,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });
      res.status(500).json({
        success: false,
        message: '获取维修费用列表失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }

  /**
   * 获取费用趋势
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async getCostTrend(req, res) {
    try {
      const result = await costsService.getCostTrend(req.query, req);
      res.json(result);
    } catch (error) {
      logger.error('获取费用趋势失败', {
        error: error.message,
        stack: error.stack,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });
      res.status(500).json({
        success: false,
        message: '获取费用趋势失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }

  /**
   * 获取部门费用统计
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async getCostDepartment(req, res) {
    try {
      const result = await costsService.getCostDepartment(req.query, req);
      res.json(result);
    } catch (error) {
      logger.error('获取部门费用统计失败', {
        error: error.message,
        stack: error.stack,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });
      res.status(500).json({
        success: false,
        message: '获取部门费用统计失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }

  /**
   * 创建维修费用
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async createCost(req, res) {
    try {
      const result = await costsService.createCost(req.body, req);
      this.sendResult(res, result);
    } catch (error) {
      logger.error('创建维修费用失败', {
        error: error.message,
        stack: error.stack,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });
      res.status(500).json({
        success: false,
        message: '创建维修费用失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }

  /**
   * 更新维修费用
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async updateCost(req, res) {
    try {
      const result = await costsService.updateCost(req.params.id, req.body, req);
      this.sendResult(res, result);
    } catch (error) {
      logger.error('更新维修费用失败', {
        error: error.message,
        stack: error.stack,
        costId: req.params?.id,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });
      res.status(500).json({
        success: false,
        message: '更新维修费用失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }

  /**
   * 删除维修费用
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async deleteCost(req, res) {
    try {
      const result = await costsService.deleteCost(req.params.id, req);
      this.sendResult(res, result);
    } catch (error) {
      logger.error('删除维修费用失败', {
        error: error.message,
        stack: error.stack,
        costId: req.params?.id,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });
      res.status(500).json({
        success: false,
        message: '删除维修费用失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }

  // ==================== 维修模板 ====================

  /**
   * 获取维修模板列表
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async getTemplates(req, res) {
    try {
      const result = await templatesService.getTemplates(req.query, req);
      res.json(result);
    } catch (error) {
      logger.error('获取维修模板列表失败', {
        error: error.message,
        stack: error.stack,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });
      res.status(500).json({
        success: false,
        message: '获取维修模板列表失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }

  /**
   * 获取维修模板详情
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async getTemplateById(req, res) {
    try {
      const result = await templatesService.getLegacyTemplate(req.params.id, req);
      this.sendResult(res, result);
    } catch (error) {
      logger.error('获取维修模板详情失败', {
        error: error.message,
        stack: error.stack,
        templateId: req.params?.id,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });
      res.status(500).json({
        success: false,
        message: '获取维修模板详情失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }

  /**
   * 创建维修模板
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async createTemplate(req, res) {
    try {
      const result = await templatesService.createTemplate(req.body, req);
      this.sendResult(res, result);
    } catch (error) {
      logger.error('创建维修模板失败', {
        error: error.message,
        stack: error.stack,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });
      res.status(500).json({
        success: false,
        message: '创建维修模板失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }

  /**
   * 更新维修模板
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async updateTemplate(req, res) {
    try {
      const result = await templatesService.updateTemplate(req.params.id, req.body, req);
      this.sendResult(res, result);
    } catch (error) {
      logger.error('更新维修模板失败', {
        error: error.message,
        stack: error.stack,
        templateId: req.params?.id,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });
      res.status(500).json({
        success: false,
        message: '更新维修模板失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }

  /**
   * 删除维修模板
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async deleteTemplate(req, res) {
    try {
      const result = await templatesService.deleteTemplate(req.params.id, req);
      this.sendResult(res, result);
    } catch (error) {
      logger.error('删除维修模板失败', {
        error: error.message,
        stack: error.stack,
        templateId: req.params?.id,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });
      res.status(500).json({
        success: false,
        message: '删除维修模板失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }

  // ==================== 维修提醒 ====================

  /**
   * 获取维修提醒列表
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async getReminders(req, res) {
    try {
      const result = await remindersService.getReminders(req.query, req);
      res.json(result);
    } catch (error) {
      logger.error('获取维修提醒列表失败', {
        error: error.message,
        stack: error.stack,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });
      res.status(500).json({
        success: false,
        message: '获取维修提醒列表失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }

  // ==================== 维修分析 ====================

  /**
   * 获取维修分析数据
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async getAnalytics(req, res) {
    try {
      const result = await analyticsService.getEfficiencyOverview(req.query, req);
      res.json(result);
    } catch (error) {
      logger.error('获取维修分析数据失败', {
        error: error.message,
        stack: error.stack,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });
      res.status(500).json({
        success: false,
        message: '获取维修分析数据失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }

  // ==================== 使用统计 ====================

  /**
   * 获取使用统计数据
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async getUsage(req, res) {
    try {
      const result = await usageService.getUsageHistory(req.query);
      res.json(result);
    } catch (error) {
      logger.error('获取使用统计数据失败', {
        error: error.message,
        stack: error.stack,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });
      res.status(500).json({
        success: false,
        message: '获取使用统计数据失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }

  // ==================== 效率评估 ====================

  /**
   * 获取效率评估数据
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async getEvaluations(req, res) {
    try {
      const result = await evaluationsService.getEvaluations(req.query, req);
      res.json(result);
    } catch (error) {
      logger.error('获取效率评估数据失败', {
        error: error.message,
        stack: error.stack,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });
      res.status(500).json({
        success: false,
        message: '获取效率评估数据失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }

  // ==================== 健康检查 ====================

  /**
   * 模块健康检查
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  getModuleHealth(req, res) {
    res.json({
      success: true,
      message: 'Maintenance Management Module is healthy',
      timestamp: new Date().toISOString(),
    });
  }
}

module.exports = new MaintenanceController();
