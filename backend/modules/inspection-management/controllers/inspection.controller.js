const inspectionService = require('../services/inspection.service');
const logger = require('../../../config/logger');

const ERROR_TYPES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  DATABASE_ERROR: 'DATABASE_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
};

class InspectionController {
  // ============ 巡检模板 ============

  async getTemplates(req, res) {
    try {
      const tenantId = req.user.tenant_id;
      const result = await inspectionService.getTemplates({ ...req.query, tenantId });
      res.json({ success: true, data: result.data, pagination: result.pagination });
    } catch (error) {
      logger.error('获取巡检模板列表失败', { error: error.message, stack: error.stack });
      res.status(500).json({ success: false, message: '获取巡检模板列表失败', error: error.message });
    }
  }

  async getTemplateById(req, res) {
    try {
      const tenantId = req.user.tenant_id;
      const template = await inspectionService.getTemplateById(req.params.id, tenantId);
      if (!template) {
        return res.status(404).json({ success: false, message: '巡检模板不存在' });
      }
      res.json({ success: true, data: template });
    } catch (error) {
      logger.error('获取巡检模板详情失败', { error: error.message });
      res.status(500).json({ success: false, message: '获取巡检模板详情失败', error: error.message });
    }
  }

  async createTemplate(req, res) {
    try {
      const tenantId = req.user.tenant_id;
      const userId = req.user.id;
      const data = req.body;

      if (!data.template_code || !data.template_name) {
        return res.status(400).json({
          success: false,
          message: '模板编号和名称不能为空',
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      const result = await inspectionService.createTemplate(data, tenantId, userId);
      logger.info('创建巡检模板成功', { tenantId, templateId: result.id });
      res.json({ success: true, message: '创建成功', data: result });
    } catch (error) {
      logger.error('创建巡检模板失败', { error: error.message, stack: error.stack });
      if (error.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ success: false, message: '模板编号已存在' });
      }
      res.status(500).json({ success: false, message: '创建巡检模板失败', error: error.message });
    }
  }

  async updateTemplate(req, res) {
    try {
      const tenantId = req.user.tenant_id;
      const success = await inspectionService.updateTemplate(req.params.id, req.body, tenantId);
      if (!success) {
        return res.status(404).json({ success: false, message: '巡检模板不存在' });
      }
      res.json({ success: true, message: '更新成功' });
    } catch (error) {
      logger.error('更新巡检模板失败', { error: error.message, stack: error.stack });
      res.status(500).json({ success: false, message: '更新巡检模板失败', error: error.message });
    }
  }

  async deleteTemplate(req, res) {
    try {
      const tenantId = req.user.tenant_id;
      const success = await inspectionService.deleteTemplate(req.params.id, tenantId);
      if (!success) {
        return res.status(404).json({ success: false, message: '巡检模板不存在' });
      }
      res.json({ success: true, message: '删除成功' });
    } catch (error) {
      logger.error('删除巡检模板失败', { error: error.message });
      res.status(500).json({ success: false, message: '删除巡检模板失败', error: error.message });
    }
  }

  // ============ 巡检任务 ============

  async getTasks(req, res) {
    try {
      const tenantId = req.user.tenant_id;
      const result = await inspectionService.getTasks({ ...req.query, tenantId });
      res.json({ success: true, data: result.data, pagination: result.pagination });
    } catch (error) {
      logger.error('获取巡检任务列表失败', { error: error.message });
      res.status(500).json({ success: false, message: '获取巡检任务列表失败', error: error.message });
    }
  }

  async getTaskById(req, res) {
    try {
      const tenantId = req.user.tenant_id;
      const task = await inspectionService.getTaskById(req.params.id, tenantId);
      if (!task) {
        return res.status(404).json({ success: false, message: '巡检任务不存在' });
      }
      res.json({ success: true, data: task });
    } catch (error) {
      logger.error('获取巡检任务详情失败', { error: error.message });
      res.status(500).json({ success: false, message: '获取巡检任务详情失败', error: error.message });
    }
  }

  async createTask(req, res) {
    try {
      const tenantId = req.user.tenant_id;
      const userId = req.user.id;
      const data = req.body;

      if (!data.task_name || !data.plan_date) {
        return res.status(400).json({
          success: false,
          message: '任务名称和计划日期不能为空',
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      const result = await inspectionService.createTask(data, tenantId, userId);
      logger.info('创建巡检任务成功', { tenantId, taskId: result.id });
      res.json({ success: true, message: '创建成功', data: result });
    } catch (error) {
      logger.error('创建巡检任务失败', { error: error.message, stack: error.stack });
      if (error.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ success: false, message: '任务编号已存在' });
      }
      res.status(500).json({ success: false, message: '创建巡检任务失败', error: error.message });
    }
  }

  async updateTask(req, res) {
    try {
      const tenantId = req.user.tenant_id;
      const success = await inspectionService.updateTask(req.params.id, req.body, tenantId);
      if (!success) {
        return res.status(404).json({ success: false, message: '巡检任务不存在' });
      }
      res.json({ success: true, message: '更新成功' });
    } catch (error) {
      logger.error('更新巡检任务失败', { error: error.message });
      res.status(500).json({ success: false, message: '更新巡检任务失败', error: error.message });
    }
  }

  async deleteTask(req, res) {
    try {
      const tenantId = req.user.tenant_id;
      const success = await inspectionService.deleteTask(req.params.id, tenantId);
      if (!success) {
        return res.status(404).json({ success: false, message: '巡检任务不存在' });
      }
      res.json({ success: true, message: '删除成功' });
    } catch (error) {
      logger.error('删除巡检任务失败', { error: error.message });
      res.status(500).json({ success: false, message: '删除巡检任务失败', error: error.message });
    }
  }

  async getExpiringTasks(req, res) {
    try {
      const tenantId = req.user.tenant_id;
      const { days = 3 } = req.query;
      const tasks = await inspectionService.getExpiringTasks(tenantId, parseInt(days));
      res.json({ success: true, data: tasks });
    } catch (error) {
      logger.error('获取到期巡检任务失败', { error: error.message });
      res.status(500).json({ success: false, message: '获取到期巡检任务失败', error: error.message });
    }
  }

  // ============ 巡检记录单 ============

  async getRecords(req, res) {
    try {
      const tenantId = req.user.tenant_id;
      const result = await inspectionService.getRecords({ ...req.query, tenantId });
      res.json({ success: true, data: result.data, pagination: result.pagination });
    } catch (error) {
      logger.error('获取巡检记录单列表失败', { error: error.message });
      res.status(500).json({ success: false, message: '获取巡检记录单列表失败', error: error.message });
    }
  }

  async getRecordById(req, res) {
    try {
      const tenantId = req.user.tenant_id;
      const record = await inspectionService.getRecordById(req.params.id, tenantId);
      if (!record) {
        return res.status(404).json({ success: false, message: '巡检记录单不存在' });
      }
      res.json({ success: true, data: record });
    } catch (error) {
      logger.error('获取巡检记录单详情失败', { error: error.message });
      res.status(500).json({ success: false, message: '获取巡检记录单详情失败', error: error.message });
    }
  }

  async createRecord(req, res) {
    try {
      const tenantId = req.user.tenant_id;
      const userId = req.user.id;
      const data = req.body;

      if (!data.inspection_title || !data.inspection_date || !data.inspector_name) {
        return res.status(400).json({
          success: false,
          message: '巡检标题、巡检日期和巡检人不能为空',
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      const result = await inspectionService.createRecord(data, tenantId, userId);
      logger.info('创建巡检记录单成功', { tenantId, recordId: result.id });
      res.json({ success: true, message: '创建成功', data: result });
    } catch (error) {
      logger.error('创建巡检记录单失败', { error: error.message, stack: error.stack });
      if (error.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ success: false, message: '记录单编号已存在' });
      }
      res.status(500).json({ success: false, message: '创建巡检记录单失败', error: error.message });
    }
  }

  async updateRecord(req, res) {
    try {
      const tenantId = req.user.tenant_id;
      const success = await inspectionService.updateRecord(req.params.id, req.body, tenantId);
      if (!success) {
        return res.status(404).json({ success: false, message: '巡检记录单不存在' });
      }
      res.json({ success: true, message: '更新成功' });
    } catch (error) {
      logger.error('更新巡检记录单失败', { error: error.message });
      res.status(500).json({ success: false, message: '更新巡检记录单失败', error: error.message });
    }
  }

  async deleteRecord(req, res) {
    try {
      const tenantId = req.user.tenant_id;
      const success = await inspectionService.deleteRecord(req.params.id, tenantId);
      if (!success) {
        return res.status(404).json({ success: false, message: '巡检记录单不存在' });
      }
      res.json({ success: true, message: '删除成功' });
    } catch (error) {
      logger.error('删除巡检记录单失败', { error: error.message });
      res.status(500).json({ success: false, message: '删除巡检记录单失败', error: error.message });
    }
  }

  // ============ 巡检问题 ============

  async getIssues(req, res) {
    try {
      const tenantId = req.user.tenant_id;
      const result = await inspectionService.getIssues({ ...req.query, tenantId });
      res.json({ success: true, data: result.data, pagination: result.pagination });
    } catch (error) {
      logger.error('获取巡检问题列表失败', { error: error.message });
      res.status(500).json({ success: false, message: '获取巡检问题列表失败', error: error.message });
    }
  }

  async getIssueById(req, res) {
    try {
      const tenantId = req.user.tenant_id;
      const issue = await inspectionService.getIssueById(req.params.id, tenantId);
      if (!issue) {
        return res.status(404).json({ success: false, message: '巡检问题不存在' });
      }
      res.json({ success: true, data: issue });
    } catch (error) {
      logger.error('获取巡检问题详情失败', { error: error.message });
      res.status(500).json({ success: false, message: '获取巡检问题详情失败', error: error.message });
    }
  }

  async updateIssue(req, res) {
    try {
      const tenantId = req.user.tenant_id;
      const success = await inspectionService.updateIssue(req.params.id, req.body, tenantId);
      if (!success) {
        return res.status(404).json({ success: false, message: '巡检问题不存在' });
      }
      res.json({ success: true, message: '更新成功' });
    } catch (error) {
      logger.error('更新巡检问题失败', { error: error.message });
      res.status(500).json({ success: false, message: '更新巡检问题失败', error: error.message });
    }
  }

  // ============ 统计 ============

  async getStatistics(req, res) {
    try {
      const tenantId = req.user.tenant_id;
      const stats = await inspectionService.getStatistics(tenantId, req.query);
      res.json({ success: true, data: stats });
    } catch (error) {
      logger.error('获取巡检统计失败', { error: error.message });
      res.status(500).json({ success: false, message: '获取巡检统计失败', error: error.message });
    }
  }
}

module.exports = new InspectionController();
