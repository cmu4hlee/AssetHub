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

class MaintenanceService {
  /**
   * 获取维护日志列表
   * @param {Object} params - 查询参数
   * @param {Object} req - 请求对象
   * @returns {Promise<Object>} 维护日志列表
   */
  async getLogs(params, req) {
    return logsService.getLogs(params, req);
  }

  /**
   * 获取维护日志详情
   * @param {number} id - 日志ID
   * @param {Object} req - 请求对象
   * @returns {Promise<Object>} 维护日志详情
   */
  async getLogById(id, req) {
    return logsService.getLogById(id, req);
  }

  /**
   * 创建维护日志
   * @param {Object} data - 日志数据
   * @param {Object} req - 请求对象
   * @returns {Promise<Object>} 创建结果
   */
  async createLog(data, req) {
    return logsService.createLog(data, req);
  }

  /**
   * 更新维护日志
   * @param {number} id - 日志ID
   * @param {Object} data - 更新数据
   * @param {Object} req - 请求对象
   * @returns {Promise<Object>} 更新结果
   */
  async updateLog(id, data, req) {
    return logsService.updateLog(id, data, req);
  }

  /**
   * 删除维护日志
   * @param {number} id - 日志ID
   * @param {Object} req - 请求对象
   * @returns {Promise<Object>} 删除结果
   */
  async deleteLog(id, req) {
    return logsService.deleteLog(id, req);
  }

  /**
   * 获取维修申请列表
   * @param {Object} params - 查询参数
   * @param {Object} req - 请求对象
   * @returns {Promise<Object>} 维修申请列表
   */
  async getRequests(params, req) {
    return requestsService.getRequests(params, req);
  }

  /**
   * 获取维修申请详情
   * @param {number} id - 申请ID
   * @param {Object} req - 请求对象
   * @returns {Promise<Object>} 维修申请详情
   */
  async getRequestById(id, req) {
    return requestsService.getRequest(id, req);
  }

  /**
   * 创建维修申请
   * @param {Object} data - 申请数据
   * @param {Object} req - 请求对象
   * @returns {Promise<Object>} 创建结果
   */
  async createRequest(data, req) {
    return requestsService.createRequest(data, req);
  }

  /**
   * 更新维修申请
   * @param {number} id - 申请ID
   * @param {Object} data - 更新数据
   * @param {Object} req - 请求对象
   * @returns {Promise<Object>} 更新结果
   */
  async updateRequest(id, data, req) {
    return requestsService.updateRequest(id, data, req);
  }

  /**
   * 审批维修申请
   * @param {number} id - 申请ID
   * @param {Object} data - 审批数据
   * @param {Object} req - 请求对象
   * @returns {Promise<Object>} 审批结果
   */
  async approveRequest(id, data, req) {
    return requestsService.approveRequest(id, data, req);
  }

  /**
   * 开始维修
   * @param {number} id - 申请ID
   * @param {Object} data - 开始维修数据
   * @param {Object} req - 请求对象
   * @returns {Promise<Object>} 开始维修结果
   */
  async startRequest(id, data, req) {
    return requestsService.startRequest(id, data, req);
  }

  /**
   * 完成维修
   * @param {number} id - 申请ID
   * @param {Object} data - 完成维修数据
   * @param {Object} req - 请求对象
   * @returns {Promise<Object>} 完成维修结果
   */
  async completeRequest(id, data, req) {
    return requestsService.completeRequest(id, data, req);
  }

  /**
   * 取消维修申请
   * @param {number} id - 申请ID
   * @param {Object} req - 请求对象
   * @returns {Promise<Object>} 取消结果
   */
  async cancelRequest(id, req) {
    return requestsService.cancelRequest(id, req);
  }

  /**
   * 删除维修申请
   * @param {number} id - 申请ID
   * @param {Object} req - 请求对象
   * @returns {Promise<Object>} 删除结果
   */
  async deleteRequest(id, req) {
    return requestsService.deleteRequest(id, req);
  }

  /**
   * 获取工单列表
   * @param {Object} params - 查询参数
   * @param {Object} req - 请求对象
   * @returns {Promise<Object>} 工单列表
   */
  async getWorkOrders(params, req) {
    return workordersService.getWorkOrders(params, req);
  }

  /**
   * 获取工单详情
   * @param {number} id - 工单ID
   * @param {Object} req - 请求对象
   * @returns {Promise<Object>} 工单详情
   */
  async getWorkOrderById(id, req) {
    return workordersService.getWorkOrder(id, req);
  }

  /**
   * 创建工单
   * @param {Object} data - 工单数据
   * @param {Object} req - 请求对象
   * @returns {Promise<Object>} 创建结果
   */
  async createWorkOrder(data, req) {
    return workordersService.createWorkOrder(data, req);
  }

  /**
   * 更新工单
   * @param {number} id - 工单ID
   * @param {Object} data - 更新数据
   * @param {Object} req - 请求对象
   * @returns {Promise<Object>} 更新结果
   */
  async updateWorkOrder(id, data, req) {
    return workordersService.updateWorkOrder(id, data, req);
  }

  /**
   * 删除工单
   * @param {number} id - 工单ID
   * @param {Object} req - 请求对象
   * @returns {Promise<Object>} 删除结果
   */
  async deleteWorkOrder(id, req) {
    return workordersService.deleteWorkOrder(id, req);
  }

  /**
   * 获取维修计划列表
   * @param {Object} params - 查询参数
   * @param {Object} req - 请求对象
   * @returns {Promise<Object>} 维修计划列表
   */
  async getPlans(params, req) {
    return plansService.getPlans(params, req);
  }

  /**
   * 获取维修计划详情
   * @param {number} id - 计划ID
   * @param {Object} req - 请求对象
   * @returns {Promise<Object>} 维修计划详情
   */
  async getPlanById(id, req) {
    return plansService.getPlan(id, req);
  }

  /**
   * 创建维修计划
   * @param {Object} data - 计划数据
   * @param {Object} req - 请求对象
   * @returns {Promise<Object>} 创建结果
   */
  async createPlan(data, req) {
    return plansService.createPlan(data, req);
  }

  /**
   * 更新维修计划
   * @param {number} id - 计划ID
   * @param {Object} data - 更新数据
   * @param {Object} req - 请求对象
   * @returns {Promise<Object>} 更新结果
   */
  async updatePlan(id, data, req) {
    return plansService.updatePlan(id, data, req);
  }

  /**
   * 删除维修计划
   * @param {number} id - 计划ID
   * @param {Object} req - 请求对象
   * @returns {Promise<Object>} 删除结果
   */
  async deletePlan(id, req) {
    return plansService.deletePlan(id, req);
  }

  /**
   * 获取维修费用列表
   * @param {Object} params - 查询参数
   * @param {Object} req - 请求对象
   * @returns {Promise<Object>} 维修费用列表
   */
  async getCosts(params, req) {
    return costsService.getCosts(params, req);
  }

  /**
   * 获取费用趋势
   * @param {Object} params - 查询参数
   * @param {Object} req - 请求对象
   * @returns {Promise<Object>} 费用趋势
   */
  async getCostTrend(params, req) {
    return costsService.getCostTrend(params, req);
  }

  /**
   * 获取部门费用统计
   * @param {Object} params - 查询参数
   * @param {Object} req - 请求对象
   * @returns {Promise<Object>} 部门费用统计
   */
  async getCostDepartment(params, req) {
    return costsService.getCostDepartment(params, req);
  }

  /**
   * 创建维修费用
   * @param {Object} data - 费用数据
   * @param {Object} req - 请求对象
   * @returns {Promise<Object>} 创建结果
   */
  async createCost(data, req) {
    return costsService.createCost(data, req);
  }

  /**
   * 更新维修费用
   * @param {number} id - 费用ID
   * @param {Object} data - 更新数据
   * @param {Object} req - 请求对象
   * @returns {Promise<Object>} 更新结果
   */
  async updateCost(id, data, req) {
    return costsService.updateCost(id, data, req);
  }

  /**
   * 删除维修费用
   * @param {number} id - 费用ID
   * @param {Object} req - 请求对象
   * @returns {Promise<Object>} 删除结果
   */
  async deleteCost(id, req) {
    return costsService.deleteCost(id, req);
  }

  /**
   * 获取维修模板列表
   * @param {Object} params - 查询参数
   * @param {Object} req - 请求对象
   * @returns {Promise<Object>} 维修模板列表
   */
  async getTemplates(params, req) {
    return templatesService.getTemplates(params, req);
  }

  /**
   * 获取维修模板详情
   * @param {number} id - 模板ID
   * @param {Object} req - 请求对象
   * @returns {Promise<Object>} 维修模板详情
   */
  async getTemplateById(id, req) {
    return templatesService.getTemplate(id, req);
  }

  /**
   * 创建维修模板
   * @param {Object} data - 模板数据
   * @param {Object} req - 请求对象
   * @returns {Promise<Object>} 创建结果
   */
  async createTemplate(data, req) {
    return templatesService.createTemplate(data, req);
  }

  /**
   * 更新维修模板
   * @param {number} id - 模板ID
   * @param {Object} data - 更新数据
   * @param {Object} req - 请求对象
   * @returns {Promise<Object>} 更新结果
   */
  async updateTemplate(id, data, req) {
    return templatesService.updateTemplate(id, data, req);
  }

  /**
   * 删除维修模板
   * @param {number} id - 模板ID
   * @param {Object} req - 请求对象
   * @returns {Promise<Object>} 删除结果
   */
  async deleteTemplate(id, req) {
    return templatesService.deleteTemplate(id, req);
  }

  /**
   * 获取维修提醒列表
   * @param {Object} params - 查询参数
   * @param {Object} req - 请求对象
   * @returns {Promise<Object>} 维修提醒列表
   */
  async getReminders(params, req) {
    return remindersService.getReminders(params, req);
  }

  /**
   * 获取维修分析数据
   * @param {Object} params - 查询参数
   * @param {Object} req - 请求对象
   * @returns {Promise<Object>} 维修分析数据
   */
  async getAnalytics(params, req) {
    return analyticsService.getAnalytics(params, req);
  }

  /**
   * 获取使用统计数据
   * @param {Object} params - 查询参数
   * @param {Object} req - 请求对象
   * @returns {Promise<Object>} 使用统计数据
   */
  async getUsage(params, req) {
    return usageService.getUsage(params, req);
  }

  /**
   * 获取效率评估数据
   * @param {Object} params - 查询参数
   * @param {Object} req - 请求对象
   * @returns {Promise<Object>} 效率评估数据
   */
  async getEvaluations(params, req) {
    return evaluationsService.getEvaluations(params, req);
  }
}

module.exports = new MaintenanceService();
