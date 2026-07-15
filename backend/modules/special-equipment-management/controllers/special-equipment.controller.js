const specialEquipmentService = require('../services/special-equipment.service');
const logger = require('../../../config/logger');

// 定义错误类型
const ERROR_TYPES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  DUPLICATE_ERROR: 'DUPLICATE_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
};

class SpecialEquipmentController {
  /**
   * 获取特种设备列表
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async getEquipments(req, res) {
    try {
      const { page, pageSize, status, safety_status, keyword, equipment_type } = req.query;
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

      if (!tenantId) {
        logger.warn('获取特种设备列表缺少租户ID', { path: req.path, method: req.method });
        return res.status(400).json({
          success: false,
          message: '缺少租户ID',
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      logger.info('获取特种设备列表请求', {
        tenantId,
        page,
        pageSize,
        status,
        safety_status,
        keyword,
      });

      const result = await specialEquipmentService.getEquipments({
        page,
        pageSize,
        status,
        safety_status,
        keyword,
        equipment_type,
        tenantId,
      });

      logger.info('获取特种设备列表成功', {
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
      logger.error('获取特种设备列表失败', {
        error: error.message,
        stack: error.stack,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });

      res.status(500).json({
        success: false,
        message: '获取特种设备列表失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }

  /**
   * 获取特种设备详情
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async getEquipmentById(req, res) {
    try {
      const { id } = req.params;
      const tenantId = req.user.tenant_id || req.headers['x-tenant-id'];

      const equipment = await specialEquipmentService.getEquipmentById(id, tenantId);

      if (!equipment) {
        return res.status(404).json({ success: false, message: '特种设备不存在' });
      }

      res.json({ success: true, data: equipment });
    } catch (error) {
      logger.error('获取特种设备详情失败', {
        error: error.message,
        stack: error.stack,
        equipmentId: req.params?.id,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });
      res.status(500).json({ success: false, message: '获取特种设备详情失败', error: error.message });
    }
  }

  /**
   * 创建设备
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async createEquipment(req, res) {
    try {
      const equipmentData = req.body;
      const tenantId = req.user.tenant_id || req.headers['x-tenant-id'];
      const userId = req.user.id;

      if (!equipmentData.equipment_name || !equipmentData.equipment_type) {
        return res.status(400).json({ success: false, message: '设备名称和类型不能为空' });
      }

      const result = await specialEquipmentService.createEquipment(equipmentData, tenantId, userId);

      res.json({
        success: true,
        message: '特种设备创建成功',
        data: result,
      });
    } catch (error) {
      logger.error('创建设备失败', {
        error: error.message,
        stack: error.stack,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });

      if (error.message.includes('不存在')) {
        return res.status(404).json({ success: false, message: error.message });
      }

      if (error.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ success: false, message: '设备编号已存在' });
      }

      res.status(500).json({ success: false, message: '创建设备失败', error: error.message });
    }
  }

  /**
   * 更新设备
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async updateEquipment(req, res) {
    try {
      const { id } = req.params;
      const equipmentData = req.body;
      const tenantId = req.user.tenant_id || req.headers['x-tenant-id'];

      const success = await specialEquipmentService.updateEquipment(id, equipmentData, tenantId);

      if (!success) {
        return res.status(404).json({ success: false, message: '特种设备不存在' });
      }

      res.json({ success: true, message: '特种设备更新成功' });
    } catch (error) {
      logger.error('更新设备失败', {
        error: error.message,
        stack: error.stack,
        equipmentId: req.params?.id,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });

      if (error.message.includes('不存在')) {
        return res.status(404).json({ success: false, message: error.message });
      }

      res.status(500).json({ success: false, message: '更新设备失败', error: error.message });
    }
  }

  /**
   * 删除设备
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async deleteEquipment(req, res) {
    try {
      const { id } = req.params;
      const tenantId = req.user.tenant_id || req.headers['x-tenant-id'];

      const success = await specialEquipmentService.deleteEquipment(id, tenantId);

      if (!success) {
        return res.status(404).json({ success: false, message: '特种设备不存在' });
      }

      res.json({ success: true, message: '特种设备删除成功' });
    } catch (error) {
      logger.error('删除设备失败', {
        error: error.message,
        stack: error.stack,
        equipmentId: req.params?.id,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });
      res.status(500).json({ success: false, message: '删除设备失败', error: error.message });
    }
  }

  /**
   * 获取检验记录列表
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async getInspections(req, res) {
    try {
      const { page, pageSize, equipment_id, inspection_type, keyword, inspection_result } = req.query;
      const tenantId = req.user.tenant_id || req.headers['x-tenant-id'];

      if (!tenantId) {
        logger.warn('获取检验记录列表缺少租户ID', { path: req.path, method: req.method });
        return res.status(400).json({
          success: false,
          message: '缺少租户ID',
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      const result = await specialEquipmentService.getInspections({
        page,
        pageSize,
        equipment_id,
        inspection_type,
        keyword,
        inspection_result,
        tenantId,
      });

      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error('获取检验记录列表失败', {
        error: error.message,
        stack: error.stack,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });

      res.status(500).json({
        success: false,
        message: '获取检验记录列表失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }

  /**
   * 创建检验记录
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async createInspection(req, res) {
    try {
      const inspectionData = req.body;
      const tenantId = req.user.tenant_id || req.headers['x-tenant-id'];
      const userId = req.user.id;

      if (!inspectionData.equipment_id) {
        return res.status(400).json({ success: false, message: '设备ID不能为空' });
      }

      const result = await specialEquipmentService.createInspection(inspectionData, tenantId, userId);

      res.json({
        success: true,
        message: '检验记录创建成功',
        data: result,
      });
    } catch (error) {
      logger.error('创建检验记录失败', {
        error: error.message,
        stack: error.stack,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });

      if (error.message.includes('不存在')) {
        return res.status(404).json({ success: false, message: error.message });
      }

      res.status(500).json({ success: false, message: '创建检验记录失败', error: error.message });
    }
  }

  /**
   * 更新检验记录
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async updateInspection(req, res) {
    try {
      const { id } = req.params;
      const inspectionData = req.body;
      const tenantId = req.user.tenant_id || req.headers['x-tenant-id'];

      const success = await specialEquipmentService.updateInspection(id, inspectionData, tenantId);

      if (!success) {
        return res.status(404).json({ success: false, message: '检验记录不存在' });
      }

      res.json({ success: true, message: '检验记录更新成功' });
    } catch (error) {
      logger.error('更新检验记录失败', {
        error: error.message,
        stack: error.stack,
        inspectionId: req.params?.id,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });

      if (error.message.includes('不存在')) {
        return res.status(404).json({ success: false, message: error.message });
      }

      res.status(500).json({ success: false, message: '更新检验记录失败', error: error.message });
    }
  }

  /**
   * 删除检验记录
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async deleteInspection(req, res) {
    try {
      const { id } = req.params;
      const tenantId = req.user.tenant_id || req.headers['x-tenant-id'];

      const success = await specialEquipmentService.deleteInspection(id, tenantId);

      if (!success) {
        return res.status(404).json({ success: false, message: '检验记录不存在' });
      }

      res.json({ success: true, message: '检验记录删除成功' });
    } catch (error) {
      logger.error('删除检验记录失败', {
        error: error.message,
        stack: error.stack,
        inspectionId: req.params?.id,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });
      res.status(500).json({ success: false, message: '删除检验记录失败', error: error.message });
    }
  }

  /**
   * 获取即将到期检验的设备
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async getExpiringInspections(req, res) {
    try {
      const { days = 90 } = req.query;
      const tenantId = req.user.tenant_id || req.headers['x-tenant-id'];

      if (!tenantId) {
        logger.warn('获取即将到期检验缺少租户ID', { path: req.path, method: req.method });
        return res.status(400).json({
          success: false,
          message: '缺少租户ID',
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      const result = await specialEquipmentService.getExpiringInspections(days, tenantId);

      res.json({ success: true, data: result });
    } catch (error) {
      logger.error('获取即将到期检验失败', {
        error: error.message,
        stack: error.stack,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });

      res.status(500).json({
        success: false,
        message: '获取即将到期检验失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }

  /**
   * 获取特种设备统计
   * @param {Object} req - 请求对象
   * @param {Object} res - 响应对象
   */
  async getStatistics(req, res) {
    try {
      const tenantId = req.user.tenant_id || req.headers['x-tenant-id'];

      if (!tenantId) {
        logger.warn('获取特种设备统计缺少租户ID', { path: req.path, method: req.method });
        return res.status(400).json({
          success: false,
          message: '缺少租户ID',
          errorType: ERROR_TYPES.VALIDATION_ERROR,
        });
      }

      const result = await specialEquipmentService.getStatistics(tenantId);

      res.json({ success: true, data: result });
    } catch (error) {
      logger.error('获取特种设备统计失败', {
        error: error.message,
        stack: error.stack,
        tenantId: req.user?.tenant_id || req.headers['x-tenant-id'],
      });

      res.status(500).json({
        success: false,
        message: '获取特种设备统计失败',
        error: error.message,
        errorType: ERROR_TYPES.INTERNAL_ERROR,
      });
    }
  }
}

module.exports = new SpecialEquipmentController();
