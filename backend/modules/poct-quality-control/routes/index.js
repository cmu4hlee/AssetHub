/**
 * POCT 临床科室日常质控管理 - 路由
 *
 * API 路径: /api/poct-quality-control
 * 模块 ID:  poct-quality-control
 */
const express = require('express');
const router = express.Router();
const c = require('../controllers/poct.controller');
const { authenticate } = require('../../../middleware/auth');

router.get('/health', c.health);

// ==================== 监测科目 ====================
router.get('/subjects',              authenticate, c.listSubjects);
router.post('/subjects',             authenticate, c.createSubject);
router.put('/subjects/:id',          authenticate, c.updateSubject);
router.delete('/subjects/:id',       authenticate, c.deleteSubject);

// 科室启用科目
router.get('/department-subjects/:departmentId',                   authenticate, c.listDepartmentSubjects);
router.post('/department-subjects',                                 authenticate, c.upsertDepartmentSubject);
router.delete('/department-subjects/:departmentId/:subjectId',      authenticate, c.removeDepartmentSubject);

// ==================== 班次 ====================
router.get('/shifts',           authenticate, c.listShifts);
router.post('/shifts',          authenticate, c.createShift);
router.put('/shifts/:id',       authenticate, c.updateShift);
router.delete('/shifts/:id',    authenticate, c.deleteShift);

// ==================== 排班 ====================
router.get('/schedules',        authenticate, c.listSchedules);
router.post('/schedules',       authenticate, c.upsertSchedule);
router.delete('/schedules/:id', authenticate, c.deleteSchedule);

// ==================== 质控记录 (核心) ====================
// 静态路径放在 /:id 之前
router.get('/records/shift-tasks',     authenticate, c.getShiftTasks);
router.get('/records/statistics',      authenticate, c.getStatistics);
router.get('/records/export',          authenticate, c.exportRecords);

router.get('/records',           authenticate, c.listRecords);
router.post('/records',          authenticate, c.createRecord);
router.get('/records/:id',       authenticate, c.getRecordDetail);
router.put('/records/:id',       authenticate, c.updateRecord);
router.delete('/records/:id',    authenticate, c.deleteRecord);

// ==================== 签名 ====================
router.post('/signatures', authenticate, c.addSignature);

// ==================== 提醒规则 ====================
router.get('/reminders',           authenticate, c.listReminders);
router.post('/reminders',          authenticate, c.upsertReminder);
router.put('/reminders/:id',       authenticate, c.upsertReminder);
router.delete('/reminders/:id',    authenticate, c.deleteReminder);

module.exports = router;
