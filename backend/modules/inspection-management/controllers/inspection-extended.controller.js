/**
 * 巡检管理扩展控制器
 */
const ext = require('../services/inspection-extended.service');
const coreService = require('../services/inspection.service');
const logger = require('../../../config/logger');

class InspectionExtendedController {
  // ============ 模板复制 ============
  async copyTemplate(req, res) {
    try {
      const { id } = req.params;
      const { target_name } = req.body;
      const result = await ext.copyTemplate(id, target_name, req.user.tenant_id, req.user.id);
      res.json({ success: true, message: '复制成功', data: result });
    } catch (e) {
      logger.error('复制模板失败', { error: e.message });
      res.status(400).json({ success: false, message: e.message });
    }
  }

  // ============ 批量生成任务 ============
  async batchCreateTasks(req, res) {
    try {
      const result = await ext.batchCreateTasks(req.body, req.user.tenant_id, req.user.id);
      res.json({ success: true, message: '批量任务生成完成', data: result });
    } catch (e) {
      logger.error('批量生成任务失败', { error: e.message });
      res.status(400).json({ success: false, message: e.message });
    }
  }

  // ============ 计划 CRUD ============
  async getPlans(req, res) {
    try {
      const r = await ext.getPlans({ ...req.query, tenantId: req.user.tenant_id });
      res.json({ success: true, data: r.data, pagination: r.pagination });
    } catch (e) {
      res.status(500).json({ success: false, message: e.message });
    }
  }
  async getPlanById(req, res) {
    try {
      const r = await ext.getPlanById(req.params.id, req.user.tenant_id);
      if (!r) return res.status(404).json({ success: false, message: '计划不存在' });
      res.json({ success: true, data: r });
    } catch (e) {
      res.status(500).json({ success: false, message: e.message });
    }
  }
  async createPlan(req, res) {
    try {
      const r = await ext.createPlan(req.body, req.user.tenant_id, req.user.id);
      res.json({ success: true, message: '创建成功', data: r });
    } catch (e) {
      res.status(400).json({ success: false, message: e.message });
    }
  }
  async updatePlan(req, res) {
    try {
      const ok = await ext.updatePlan(req.params.id, req.body, req.user.tenant_id);
      res.json({ success: ok, message: ok ? '更新成功' : '更新失败' });
    } catch (e) {
      res.status(400).json({ success: false, message: e.message });
    }
  }
  async deletePlan(req, res) {
    try {
      const ok = await ext.deletePlan(req.params.id, req.user.tenant_id);
      res.json({ success: ok, message: ok ? '删除成功' : '计划不存在' });
    } catch (e) {
      res.status(500).json({ success: false, message: e.message });
    }
  }
  async dispatchPlanNow(req, res) {
    try {
      const plan = await ext.getPlanById(req.params.id, req.user.tenant_id);
      if (!plan) return res.status(404).json({ success: false, message: '计划不存在' });
      const r = await ext.dispatchFromPlan(plan, req.user.tenant_id, req.user.id);
      res.json({ success: true, message: '派发完成', data: r });
    } catch (e) {
      res.status(400).json({ success: false, message: e.message });
    }
  }

  // ============ 路线 CRUD ============
  async getRoutes(req, res) {
    try {
      const r = await ext.getRoutes({ ...req.query, tenantId: req.user.tenant_id });
      res.json({ success: true, data: r.data, pagination: r.pagination });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
  }
  async getRouteById(req, res) {
    try {
      const r = await ext.getRouteById(req.params.id, req.user.tenant_id);
      if (!r) return res.status(404).json({ success: false, message: '路线不存在' });
      res.json({ success: true, data: r });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
  }
  async createRoute(req, res) {
    try {
      const r = await ext.createRoute(req.body, req.user.tenant_id, req.user.id);
      res.json({ success: true, message: '创建成功', data: r });
    } catch (e) { res.status(400).json({ success: false, message: e.message }); }
  }
  async updateRoute(req, res) {
    try {
      const ok = await ext.updateRoute(req.params.id, req.body, req.user.tenant_id);
      res.json({ success: ok });
    } catch (e) { res.status(400).json({ success: false, message: e.message }); }
  }
  async deleteRoute(req, res) {
    try {
      const ok = await ext.deleteRoute(req.params.id, req.user.tenant_id);
      res.json({ success: ok });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
  }

  // ============ 复核 ============
  async reviewRecord(req, res) {
    try {
      const { decision, remark, signature_reviewer, overall_result } = req.body;
      if (!['approve', 'reject'].includes(decision)) {
        return res.status(400).json({ success: false, message: 'decision 必须是 approve 或 reject' });
      }
      const ok = await ext.reviewRecord(req.params.id, { decision, remark, signature_reviewer, overall_result }, req.user.tenant_id, {
        id: req.user.id,
        username: req.user.username || req.user.name,
        real_name: req.user.real_name || req.user.username || req.user.name,
      });
      res.json({ success: ok, message: ok ? '复核成功' : '记录单不存在' });
    } catch (e) {
      res.status(500).json({ success: false, message: e.message });
    }
  }

  // ============ 异常转工单 ============
  async convertToWorkOrder(req, res) {
    try {
      const r = await ext.convertIssueToWorkOrder(req.params.id, req.user.tenant_id, {
        id: req.user.id,
        username: req.user.username || req.user.name,
        real_name: req.user.real_name || req.user.username || req.user.name,
      });
      res.json({ success: true, message: '转工单成功', data: r });
    } catch (e) {
      res.status(400).json({ success: false, message: e.message });
    }
  }

  // ============ 日历 ============
  async getCalendar(req, res) {
    try {
      const r = await ext.getCalendarData(req.user.tenant_id, req.query);
      res.json({ success: true, data: r });
    } catch (e) {
      res.status(500).json({ success: false, message: e.message });
    }
  }

  // ============ PDF 导出 ============
  async exportRecordPdf(req, res) {
    try {
      const pdf = await ext.exportRecordPdf(req.params.id, req.user.tenant_id);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="inspection-record-${req.params.id}.pdf"`);
      res.send(pdf);
    } catch (e) {
      logger.error('PDF 导出失败', { error: e.message });
      res.status(500).json({ success: false, message: e.message });
    }
  }

  // ============ 通知 ============
  async getNotifications(req, res) {
    try {
      const r = await ext.getNotifications({
        ...req.query,
        tenantId: req.user.tenant_id,
        recipient_id: req.query.recipient_id || req.user.id,
      });
      res.json({ success: true, data: r.data, pagination: r.pagination });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
  }

  async markNotificationRead(req, res) {
    try {
      const ok = await ext.markNotificationRead(req.params.id, req.user.tenant_id, req.user.id);
      res.json({ success: ok });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
  }

  // ============ 增强统计 ============
  async getEnrichedStatistics(req, res) {
    try {
      const r = await ext.getEnrichedStatistics(req.user.tenant_id, req.query);
      res.json({ success: true, data: r });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
  }

  // ============ 问题历史 ============
  async getIssueHistory(req, res) {
    try {
      const r = await ext.getIssueHistory(req.params.id, req.user.tenant_id);
      res.json({ success: true, data: r });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
  }

  // ============ 完成自动派发下一周期 ============
  async scheduleNextTask(req, res) {
    try {
      const r = await ext.maybeScheduleNextTask(req.params.id, req.user.tenant_id);
      res.json({ success: true, data: r });
    } catch (e) {
      res.status(500).json({ success: false, message: e.message });
    }
  }
}

module.exports = new InspectionExtendedController();
