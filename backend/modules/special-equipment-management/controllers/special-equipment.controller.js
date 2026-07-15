const specialEquipmentService = require('../services/special-equipment.service');
const specialEquipmentImportService = require('../services/special-equipment-import.service');
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
      const { page, pageSize, status, safety_status, keyword, equipment_type, use_status, department } = req.query;
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
        use_status,
        department,
        keyword,
      });

      const result = await specialEquipmentService.getEquipments({
        page,
        pageSize,
        status,
        safety_status,
        keyword,
        equipment_type,
        use_status,
        department,
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

// ==================== 导入 / 导出 ====================

SpecialEquipmentController.prototype.getImportTemplate = async function getImportTemplate(req, res) {
  try {
    const buffer = await specialEquipmentImportService.buildImportTemplateBuffer();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="special_equipment_import_template.xlsx"',
    );
    res.send(buffer);
  } catch (error) {
    logger.error('生成特种设备导入模板失败', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: '生成模板失败' });
  }
};

SpecialEquipmentController.prototype.validateImport = async function validateImport(req, res) {
  try {
    const uploadedFile = req.file;
    if (!uploadedFile) {
      return res.status(400).json({ success: false, message: '请选择要上传的 Excel 文件' });
    }
    const fileBuffer = uploadedFile.buffer;
    const tenantId = req.user.tenant_id || req.headers['x-tenant-id'];
    if (!tenantId) {
      return res.status(400).json({ success: false, message: '缺少租户ID' });
    }

    const { rows } = await specialEquipmentImportService.parseSpecialEquipmentImportBuffer(fileBuffer);
    const { validRows, failedRows, associatedCount, unassociatedCount } =
      await specialEquipmentImportService.validateSpecialEquipmentImportRows(rows, tenantId);

    return res.json({
      success: true,
      message: `预校验完成：可导入 ${validRows.length} 条（已关联资产 ${associatedCount} / 未关联 ${unassociatedCount}），异常 ${failedRows.length} 条`,
      totalRows: rows.length,
      validCount: validRows.length,
      invalidCount: failedRows.length,
      associatedCount,
      unassociatedCount,
      failedRows,
      preview: validRows.map(item => ({
        rowNumber: item.rowNumber,
        rowData: item.rowData,
        association: item.association,
      })),
    });
  } catch (error) {
    logger.error('特种设备导入预校验失败', { error: error.message, stack: error.stack });
    return res.status(400).json({ success: false, message: error.message || '预校验失败' });
  }
};

SpecialEquipmentController.prototype.importEquipments = async function importEquipments(req, res) {
  try {
    const uploadedFile = req.file;
    if (!uploadedFile) {
      return res.status(400).json({ success: false, message: '请选择要上传的 Excel 文件' });
    }
    const fileBuffer = uploadedFile.buffer;
    const tenantId = req.user.tenant_id || req.headers['x-tenant-id'];
    if (!tenantId) {
      return res.status(400).json({ success: false, message: '缺少租户ID' });
    }

    const { rows } = await specialEquipmentImportService.parseSpecialEquipmentImportBuffer(fileBuffer);
    const { validRows, failedRows } = await specialEquipmentImportService.validateSpecialEquipmentImportRows(rows, tenantId);
    const { successCount, failedRows: persistedFailedRows, associatedCount, unassociatedCount } =
      await specialEquipmentImportService.importSpecialEquipments(validRows, tenantId, req.user.id);

    const allFailed = [...failedRows, ...persistedFailedRows];
    return res.json({
      success: true,
      message: `导入完成：成功 ${successCount} 条（已关联资产 ${associatedCount} / 未关联 ${unassociatedCount}），失败 ${allFailed.length} 条`,
      totalRows: rows.length,
      successCount,
      failedCount: allFailed.length,
      associatedCount,
      unassociatedCount,
      failedRows: allFailed,
    });
  } catch (error) {
    logger.error('特种设备导入失败', { error: error.message, stack: error.stack });
    return res.status(400).json({ success: false, message: error.message || '导入失败' });
  }
};

SpecialEquipmentController.prototype.exportEquipments = async function exportEquipments(req, res) {
  try {
    const { status, safety_status, equipment_type, keyword } = req.query;
    const tenantId = req.user.tenant_id || req.headers['x-tenant-id'];
    if (!tenantId) {
      return res.status(400).json({ success: false, message: '缺少租户ID' });
    }
    const buffer = await specialEquipmentImportService.buildExportBuffer(tenantId, {
      status, safety_status, equipment_type, keyword,
    });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="special_equipment_export_${Date.now()}.xlsx"`);
    res.send(buffer);
  } catch (error) {
    logger.error('导出特种设备失败', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: '导出失败' });
  }
};

// ==================== 批量操作 ====================

SpecialEquipmentController.prototype.batchDelete = async function batchDelete(req, res) {
  try {
    const { ids } = req.body;
    const tenantId = req.user.tenant_id || req.headers['x-tenant-id'];
    if (!tenantId) return res.status(400).json({ success: false, message: '缺少租户ID' });
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: '请选择要删除的设备' });
    }
    const result = await specialEquipmentService.batchDelete(ids, tenantId);
    res.json({
      success: true,
      message: `批量删除完成：成功 ${result.successCount} 条，失败 ${result.failedCount} 条`,
      data: result,
    });
  } catch (error) {
    logger.error('批量删除失败', { error: error.message, stack: error.stack });
    res.status(500).json({ success: false, message: '批量删除失败', error: error.message });
  }
};

SpecialEquipmentController.prototype.batchUpdateStatus = async function batchUpdateStatus(req, res) {
  try {
    const { ids, safety_status, use_status } = req.body;
    const tenantId = req.user.tenant_id || req.headers['x-tenant-id'];
    if (!tenantId) return res.status(400).json({ success: false, message: '缺少租户ID' });
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: '请选择要更新的设备' });
    }
    if (!safety_status && !use_status) {
      return res.status(400).json({ success: false, message: '请选择要更新的状态字段' });
    }
    const result = await specialEquipmentService.batchUpdateStatus(ids, { safety_status, use_status }, tenantId);
    res.json({
      success: true,
      message: `批量更新完成：成功 ${result.successCount} 条，失败 ${result.failedCount} 条`,
      data: result,
    });
  } catch (error) {
    logger.error('批量更新状态失败', { error: error.message, stack: error.stack });
    if (error.message.includes('没有可更新')) {
      return res.status(400).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: '批量更新状态失败', error: error.message });
  }
};

module.exports = new SpecialEquipmentController();
