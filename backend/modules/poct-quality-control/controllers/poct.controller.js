/**
 * POCT 临床科室日常质控管理 Controller
 */
const poctService = require('../services/poct.service');
const logger = require('../../../config/logger');

const E = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  DUPLICATE_ERROR: 'DUPLICATE_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
};

function tenantOf(req) {
  return poctService.getTenantId(req);
}

function wrap(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (error) {
      logger.error('[poct] ' + error.message, { stack: error.stack, path: req.path });
      const status = error.message.includes('不存在') || error.message.includes('不允许') ? 400 : 500;
      res.status(status).json({ success: false, message: error.message || 'Internal Error' });
    }
  };
}

class PoctController {
  // ==================== 监测科目 subjects ====================

  listSubjects = wrap(async (req, res) => {
    const result = await poctService.listSubjects({ ...req.query, tenantId: tenantOf(req) });
    res.json({ success: true, data: result.data, total: result.total });
  });

  createSubject = wrap(async (req, res) => {
    const r = await poctService.createSubject(req.body, tenantOf(req));
    res.json({ success: true, data: r, message: '科目创建成功' });
  });

  updateSubject = wrap(async (req, res) => {
    const r = await poctService.updateSubject(req.params.id, req.body, tenantOf(req));
    res.json({ success: true, data: r, message: '科目更新成功' });
  });

  deleteSubject = wrap(async (req, res) => {
    const r = await poctService.deleteSubject(req.params.id, tenantOf(req));
    res.json({ success: true, data: r, message: '科目已删除' });
  });

  // ==================== 科室启用科目 ====================

  listDepartmentSubjects = wrap(async (req, res) => {
    const data = await poctService.listDepartmentSubjects(req.params.departmentId, tenantOf(req));
    res.json({ success: true, data });
  });

  upsertDepartmentSubject = wrap(async (req, res) => {
    const r = await poctService.upsertDepartmentSubject(req.body, tenantOf(req));
    res.json({ success: true, data: r, message: '配置已保存' });
  });

  removeDepartmentSubject = wrap(async (req, res) => {
    const r = await poctService.removeDepartmentSubject(req.params.departmentId, req.params.subjectId, tenantOf(req));
    res.json({ success: true, data: r });
  });

  // ==================== 班次 shifts ====================

  listShifts = wrap(async (req, res) => {
    const data = await poctService.listShifts(tenantOf(req));
    res.json({ success: true, data });
  });

  createShift = wrap(async (req, res) => {
    const r = await poctService.createShift(req.body, tenantOf(req));
    res.json({ success: true, data: r, message: '班次创建成功' });
  });

  updateShift = wrap(async (req, res) => {
    const r = await poctService.updateShift(req.params.id, req.body, tenantOf(req));
    res.json({ success: true, data: r });
  });

  deleteShift = wrap(async (req, res) => {
    const r = await poctService.deleteShift(req.params.id, tenantOf(req));
    res.json({ success: true, data: r });
  });

  // ==================== 排班 schedules ====================

  listSchedules = wrap(async (req, res) => {
    const data = await poctService.listSchedules(req.query, tenantOf(req));
    res.json({ success: true, data });
  });

  upsertSchedule = wrap(async (req, res) => {
    const r = await poctService.upsertSchedule(req.body, tenantOf(req));
    res.json({ success: true, data: r, message: '排班已保存' });
  });

  deleteSchedule = wrap(async (req, res) => {
    const r = await poctService.deleteSchedule(req.params.id, tenantOf(req));
    res.json({ success: true, data: r });
  });

  // ==================== 质控记录 records ====================

  listRecords = wrap(async (req, res) => {
    const result = await poctService.listRecords(req.query, tenantOf(req));
    res.json({ success: true, data: result.data, pagination: { page: result.page, pageSize: result.pageSize, total: result.total } });
  });

  getRecordDetail = wrap(async (req, res) => {
    const data = await poctService.getRecordDetail(req.params.id, tenantOf(req));
    if (!data) return res.status(404).json({ success: false, message: '记录不存在' });
    res.json({ success: true, data });
  });

  createRecord = wrap(async (req, res) => {
    const tenantId = tenantOf(req);
    const operatorId = req.user?.id;
    const r = await poctService.createRecord({ ...req.body, operator_id: operatorId }, tenantId);
    res.json({ success: true, data: r, message: '质控记录已提交' });
  });

  updateRecord = wrap(async (req, res) => {
    const r = await poctService.updateRecord(req.params.id, req.body, tenantOf(req));
    res.json({ success: true, data: r, message: '已更新' });
  });

  deleteRecord = wrap(async (req, res) => {
    const r = await poctService.deleteRecord(req.params.id, tenantOf(req));
    res.json({ success: true, data: r, message: '已删除' });
  });

  /**
   * 移动端/PC 端 - 当班待办
   * GET /api/poct-quality-control/shift-tasks?department_id=&shift_id=&date=
   */
  getShiftTasks = wrap(async (req, res) => {
    const { department_id, shift_id, date } = req.query;
    const operatorId = req.query.operator_id || req.user?.id;
    if (!department_id || !shift_id || !date) {
      return res.status(400).json({ success: false, message: 'department_id / shift_id / date 必填' });
    }
    const data = await poctService.getShiftTasks({
      department_id: parseInt(department_id),
      shift_id: parseInt(shift_id),
      date,
      operator_id: operatorId ? parseInt(operatorId) : null,
      tenantId: tenantOf(req),
    });
    res.json({ success: true, data });
  });

  getStatistics = wrap(async (req, res) => {
    const data = await poctService.getStatistics({ ...req.query, tenantId: tenantOf(req) });
    res.json({ success: true, data });
  });

  /**
   * 报表导出(返回 JSON 数组,前端用 xlsx 转 Excel)
   * GET /api/poct-quality-control/records/export
   */
  exportRecords = wrap(async (req, res) => {
    const data = await poctService.exportRecords(req.query, tenantOf(req));
    res.json({ success: true, data, total: data.length });
  });

  // ==================== 签名 signatures ====================

  addSignature = wrap(async (req, res) => {
    const operatorId = req.user?.id;
    const r = await poctService.addSignature({
      ...req.body, operator_id: operatorId, tenantId: tenantOf(req),
    });
    res.json({ success: true, data: r, message: '签名已保存' });
  });

  // ==================== 提醒规则 reminders ====================

  listReminders = wrap(async (req, res) => {
    const data = await poctService.listReminders(tenantOf(req));
    res.json({ success: true, data });
  });

  upsertReminder = wrap(async (req, res) => {
    const r = await poctService.upsertReminder(req.body, tenantOf(req));
    res.json({ success: true, data: r, message: '提醒规则已保存' });
  });

  deleteReminder = wrap(async (req, res) => {
    const r = await poctService.deleteReminder(req.params.id, tenantOf(req));
    res.json({ success: true, data: r });
  });

  // ==================== 健康检查 ====================

  health(req, res) {
    res.json({
      success: true,
      message: 'POCT Quality Control Module is healthy',
      module: 'poct-quality-control',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    });
  }
}

module.exports = new PoctController();
