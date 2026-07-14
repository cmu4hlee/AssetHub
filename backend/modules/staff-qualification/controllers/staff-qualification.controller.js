/**
 * 员工资质控制器
 * 处理员工资质相关HTTP请求
 */

const qualificationService = require('../services/staff-qualification.service');
const logger = require('../../../config/logger');

const ERROR_TYPES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  DUPLICATE_ERROR: 'DUPLICATE_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
};

class StaffQualificationController {
  /**
   * 获取资质列表
   * GET /api/staff/qualifications
   */
  async getQualifications(req, res) {
    try {
      const { page, pageSize, keyword, qualification_type, status } = req.query;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      if (!tenantId) {
        logger.warn('获取资质列表缺少租户ID', { path: req.path, method: req.method });
        return res.status(400).json({
          success: false,
          message: '缺少租户ID',
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      logger.info('获取资质列表请求', {
        tenantId,
        page,
        pageSize,
        keyword,
        qualification_type,
        status,
      });

      const result = await qualificationService.getQualifications({
        page,
        pageSize,
        keyword,
        qualification_type,
        status,
        tenantId,
      });

      logger.info('获取资质列表成功', {
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
      logger.error('获取资质列表失败', {
        error: error.message,
        stack: error.stack,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });

      res.status(500).json({
        success: false,
        message: '获取资质列表失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }

  /**
   * 获取即将到期的资质
   * GET /api/staff/qualifications/expiring
   */
  async getExpiringQualifications(req, res) {
    try {
      const { days = 90 } = req.query;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: '缺少租户ID',
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      const result = await qualificationService.getExpiringQualifications(
        Number(days),
        tenantId,
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('获取即将到期资质失败', {
        error: error.message,
        stack: error.stack,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });

      res.status(500).json({
        success: false,
        message: '获取即将到期资质失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }

  /**
   * 获取资质详情
   * GET /api/staff/qualifications/:id
   */
  async getQualificationById(req, res) {
    try {
      const { id } = req.params;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      const qualification = await qualificationService.getQualificationById(
        id,
        tenantId,
      );

      if (!qualification) {
        return res.status(404).json({
          success: false,
          message: '资质不存在',
          errorType: ERROR_TYPES.NOT_FOUND,
        });
      }

      res.json({
        success: true,
        data: qualification,
      });
    } catch (error) {
      logger.error('获取资质详情失败', {
        error: error.message,
        stack: error.stack,
        qualificationId: req.params?.id,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });

      res.status(500).json({
        success: false,
        message: '获取资质详情失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }

  /**
   * 创建资质
   * POST /api/staff/qualifications
   */
  async createQualification(req, res) {
    try {
      const qualificationData = req.body;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      // 验证必填字段
      if (
        !qualificationData.user_id ||
        !qualificationData.qualification_type ||
        !qualificationData.qualification_name
      ) {
        return res.status(400).json({
          success: false,
          message: 'user_id、qualification_type、qualification_name 不能为空',
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      const result = await qualificationService.createQualification(
        qualificationData,
        tenantId,
      );

      logger.info('创建资质成功', {
        qualificationId: result.id,
        tenantId,
      });

      res.status(201).json({
        success: true,
        message: '资质创建成功',
        data: result,
      });
    } catch (error) {
      logger.error('创建资质失败', {
        error: error.message,
        stack: error.stack,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });

      if (error.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({
          success: false,
          message: '资质记录已存在',
          errorType: ERROR_TYPES.DUPLICATE_ERROR,
        });
      }

      res.status(500).json({
        success: false,
        message: '创建资质失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }

  /**
   * 更新资质
   * PUT /api/staff/qualifications/:id
   */
  async updateQualification(req, res) {
    try {
      const { id } = req.params;
      const qualificationData = req.body;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      const success = await qualificationService.updateQualification(
        id,
        qualificationData,
        tenantId,
      );

      if (!success) {
        return res.status(404).json({
          success: false,
          message: '资质不存在',
          errorType: ERROR_TYPES.NOT_FOUND,
        });
      }

      logger.info('更新资质成功', {
        qualificationId: id,
        tenantId,
      });

      res.json({
        success: true,
        message: '资质更新成功',
      });
    } catch (error) {
      logger.error('更新资质失败', {
        error: error.message,
        stack: error.stack,
        qualificationId: req.params?.id,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });

      res.status(500).json({
        success: false,
        message: '更新资质失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }

  /**
   * 删除资质
   * DELETE /api/staff/qualifications/:id
   */
  async deleteQualification(req, res) {
    try {
      const { id } = req.params;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      const success = await qualificationService.deleteQualification(id, tenantId);

      if (!success) {
        return res.status(404).json({
          success: false,
          message: '资质不存在',
          errorType: ERROR_TYPES.NOT_FOUND,
        });
      }

      logger.info('删除资质成功', {
        qualificationId: id,
        tenantId,
      });

      res.json({
        success: true,
        message: '资质删除成功',
      });
    } catch (error) {
      logger.error('删除资质失败', {
        error: error.message,
        stack: error.stack,
        qualificationId: req.params?.id,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });

      res.status(500).json({
        success: false,
        message: '删除资质失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }

  /**
   * 获取培训记录列表
   * GET /api/staff/training-records
   */
  async getTrainingRecords(req, res) {
    try {
      const { page, pageSize, user_id, training_type, start_date, end_date } =
        req.query;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: '缺少租户ID',
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      const result = await qualificationService.getTrainingRecords({
        page,
        pageSize,
        user_id,
        training_type,
        start_date,
        end_date,
        tenantId,
      });

      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error('获取培训记录失败', {
        error: error.message,
        stack: error.stack,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });

      res.status(500).json({
        success: false,
        message: '获取培训记录失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }

  /**
   * 创建培训记录
   * POST /api/staff/training-records
   */
  async createTrainingRecord(req, res) {
    try {
      const trainingData = req.body;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      if (!trainingData.user_id || !trainingData.training_name) {
        return res.status(400).json({
          success: false,
          message: 'user_id、training_name 不能为空',
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      const result = await qualificationService.createTrainingRecord(
        trainingData,
        tenantId,
      );

      logger.info('创建培训记录成功', {
        trainingId: result.id,
        tenantId,
      });

      res.status(201).json({
        success: true,
        message: '培训记录创建成功',
        data: result,
      });
    } catch (error) {
      logger.error('创建培训记录失败', {
        error: error.message,
        stack: error.stack,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });

      res.status(500).json({
        success: false,
        message: '创建培训记录失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }

  /**
   * 获取考核记录列表
   * GET /api/staff/assessments
   */
  async getAssessments(req, res) {
    try {
      const { page, pageSize, assessment_type } = req.query;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: '缺少租户ID',
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      const result = await qualificationService.getAssessments({
        page,
        pageSize,
        assessment_type,
        tenantId,
      });

      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error('获取考核记录失败', {
        error: error.message,
        stack: error.stack,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });

      res.status(500).json({
        success: false,
        message: '获取考核记录失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }

  /**
   * 创建考核记录
   * POST /api/staff/assessments
   */
  async createAssessment(req, res) {
    try {
      const assessmentData = req.body;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      if (!assessmentData.user_id) {
        return res.status(400).json({
          success: false,
          message: 'user_id 不能为空',
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      const result = await qualificationService.createAssessment(
        assessmentData,
        tenantId,
      );

      logger.info('创建考核记录成功', {
        assessmentId: result.id,
        tenantId,
      });

      res.status(201).json({
        success: true,
        message: '考核记录创建成功',
        data: result,
      });
    } catch (error) {
      logger.error('创建考核记录失败', {
        error: error.message,
        stack: error.stack,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });

      res.status(500).json({
        success: false,
        message: '创建考核记录失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }

  /**
   * 获取资质统计
   * GET /api/staff/statistics
   */
  async getStatistics(req, res) {
    try {
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: '缺少租户ID',
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      const result = await qualificationService.getStatistics(tenantId);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('获取资质统计失败', {
        error: error.message,
        stack: error.stack,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });

      res.status(500).json({
        success: false,
        message: '获取资质统计失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }
}

module.exports = new StaffQualificationController();
