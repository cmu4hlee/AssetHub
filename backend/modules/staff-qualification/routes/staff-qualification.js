/**
 * 员工资质路由
 * 处理资质、培训、考核相关HTTP请求
 */

const express = require('express');
const router = express.Router();
const staffQualificationController = require('../controllers/staff-qualification.controller');
const { authenticate } = require('../../../middleware/auth');

// 所有路由都需要认证
router.use(authenticate);

/**
 * 资质管理路由
 */

// 获取资质列表
router.get('/qualifications', staffQualificationController.getQualifications);

// 获取即将到期的资质
router.get('/qualifications/expiring', staffQualificationController.getExpiringQualifications);

// 获取资质详情
router.get('/qualifications/:id', staffQualificationController.getQualificationById);

// 创建资质
router.post('/qualifications', staffQualificationController.createQualification);

// 更新资质
router.put('/qualifications/:id', staffQualificationController.updateQualification);

// 删除资质
router.delete('/qualifications/:id', staffQualificationController.deleteQualification);

/**
 * 培训管理路由
 */

// 获取培训记录列表
router.get('/training-records', staffQualificationController.getTrainingRecords);

// 创建培训记录
router.post('/training-records', staffQualificationController.createTrainingRecord);

/**
 * 考核管理路由
 */

// 获取考核记录列表
router.get('/assessments', staffQualificationController.getAssessments);

// 创建考核记录
router.post('/assessments', staffQualificationController.createAssessment);

/**
 * 统计路由
 */

// 获取资质统计
router.get('/statistics', staffQualificationController.getStatistics);

module.exports = router;
