/**
 * 质量通用控制器
 */
const qualityCommonService = require('../services/quality-common.service');
const logger = require('../../../config/logger');

const ERROR_TYPES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  DUPLICATE_ERROR: 'DUPLICATE_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
};

class QualityCommonController {
  // ==================== 权限管理 ====================

  /**
   * 获取所有权限
   */
  async getPermissions(req, res) {
    try {
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: '缺少租户ID',
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      const permissions = await qualityCommonService.getPermissions(tenantId);

      res.json({ success: true, data: permissions });
    } catch (error) {
      logger.error('获取权限列表失败', { error: error.message, stack: error.stack });
      res.status(500).json({ success: false, message: '获取权限列表失败', error: error.message });
    }
  }

  /**
   * 创建新权限
   */
  async createPermission(req, res) {
    try {
      const permission = req.body;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: '缺少租户ID',
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      const result = await qualityCommonService.createPermission(permission, tenantId);

      res.json({
        success: true,
        message: '权限创建成功',
        data: result,
      });
    } catch (error) {
      logger.error('创建权限失败', { error: error.message, stack: error.stack });
      if (error.message === '权限编码已存在') {
        return res.status(400).json({ success: false, message: error.message });
      }
      res.status(500).json({ success: false, message: error.message || '创建权限失败' });
    }
  }

  /**
   * 更新权限
   */
  async updatePermission(req, res) {
    try {
      const { id } = req.params;
      const permission = req.body;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: '缺少租户ID',
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      const success = await qualityCommonService.updatePermission(id, permission, tenantId);

      if (!success) {
        return res.status(404).json({ success: false, message: '权限不存在' });
      }

      res.json({ success: true, message: '权限更新成功' });
    } catch (error) {
      logger.error('更新权限失败', { error: error.message, stack: error.stack });
      res.status(500).json({ success: false, message: error.message || '更新权限失败' });
    }
  }

  /**
   * 删除权限
   */
  async deletePermission(req, res) {
    try {
      const { id } = req.params;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: '缺少租户ID',
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      const success = await qualityCommonService.deletePermission(id, tenantId);

      if (!success) {
        return res.status(404).json({ success: false, message: '权限不存在' });
      }

      res.json({ success: true, message: '权限删除成功' });
    } catch (error) {
      logger.error('删除权限失败', { error: error.message, stack: error.stack });
      res.status(500).json({ success: false, message: '删除权限失败', error: error.message });
    }
  }

  // ==================== 数据字典管理 ====================

  /**
   * 获取所有数据字典
   */
  async getDictionary(req, res) {
    try {
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: '缺少租户ID',
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      const dictionary = await qualityCommonService.getDictionary(tenantId);

      res.json({ success: true, data: dictionary });
    } catch (error) {
      logger.error('获取数据字典失败', { error: error.message, stack: error.stack });
      res.status(500).json({ success: false, message: '获取数据字典失败', error: error.message });
    }
  }

  /**
   * 根据类型获取数据字典
   */
  async getDictionaryByType(req, res) {
    try {
      const { type } = req.params;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: '缺少租户ID',
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      const dictionary = await qualityCommonService.getDictionaryByType(type, tenantId);

      res.json({ success: true, data: dictionary });
    } catch (error) {
      logger.error('获取数据字典失败', { error: error.message, stack: error.stack });
      res.status(500).json({ success: false, message: '获取数据字典失败', error: error.message });
    }
  }

  /**
   * 创建字典项
   */
  async createDictionaryItem(req, res) {
    try {
      const item = req.body;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: '缺少租户ID',
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      const result = await qualityCommonService.createDictionaryItem(item, tenantId);

      res.json({
        success: true,
        message: '字典项创建成功',
        data: result,
      });
    } catch (error) {
      logger.error('创建字典项失败', { error: error.message, stack: error.stack });
      if (error.message === '字典项编码已存在') {
        return res.status(400).json({ success: false, message: error.message });
      }
      res.status(500).json({ success: false, message: error.message || '创建字典项失败' });
    }
  }

  /**
   * 更新字典项
   */
  async updateDictionaryItem(req, res) {
    try {
      const { id } = req.params;
      const item = req.body;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: '缺少租户ID',
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      const success = await qualityCommonService.updateDictionaryItem(id, item, tenantId);

      if (!success) {
        return res.status(404).json({ success: false, message: '字典项不存在' });
      }

      res.json({ success: true, message: '字典项更新成功' });
    } catch (error) {
      logger.error('更新字典项失败', { error: error.message, stack: error.stack });
      res.status(500).json({ success: false, message: error.message || '更新字典项失败' });
    }
  }

  /**
   * 删除字典项
   */
  async deleteDictionaryItem(req, res) {
    try {
      const { id } = req.params;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: '缺少租户ID',
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      const success = await qualityCommonService.deleteDictionaryItem(id, tenantId);

      if (!success) {
        return res.status(404).json({ success: false, message: '字典项不存在' });
      }

      res.json({ success: true, message: '字典项删除成功' });
    } catch (error) {
      logger.error('删除字典项失败', { error: error.message, stack: error.stack });
      res.status(500).json({ success: false, message: '删除字典项失败', error: error.message });
    }
  }

  // ==================== 日志管理 ====================

  /**
   * 获取系统日志
   */
  async getLogs(req, res) {
    try {
      const { page, pageSize, level, module, startDate, endDate } = req.query;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: '缺少租户ID',
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      const result = await qualityCommonService.getLogs(
        { page, pageSize, level, module, startDate, endDate },
        tenantId,
      );

      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error('获取日志列表失败', { error: error.message, stack: error.stack });
      res.status(500).json({ success: false, message: '获取日志列表失败', error: error.message });
    }
  }

  /**
   * 创建系统日志
   */
  async createLog(req, res) {
    try {
      const logData = req.body;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: '缺少租户ID',
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      const result = await qualityCommonService.createLog(logData, tenantId);

      res.json({
        success: true,
        message: '日志创建成功',
        data: result,
      });
    } catch (error) {
      logger.error('创建日志失败', { error: error.message, stack: error.stack });
      res.status(500).json({ success: false, message: error.message || '创建日志失败' });
    }
  }
}

module.exports = new QualityCommonController();
